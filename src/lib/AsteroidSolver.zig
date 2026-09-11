const std = @import("std");
const asteroid = @import("./Asteroid.zig");
const bpParser = @import("./BlueprintParser.zig");
const bpWriter = @import("./BlueprintWriter.zig");
const vec2i = @import("./util/Vector2I.zig");
const dir = @import("./Direction.zig");
const tet = @import("./Tetromino.zig");
const bh = @import("./util/BitSetHelper.zig");
const sh = @import("./util/SliceHelper.zig");
const cb = @import("./util/CombinationBitSet.zig");
const dt = @import("./DataTypes.zig");
const ProblemCallback = @import("./ProblemCallback.zig");

const tu32: type = u32; // purely because ZLS is dead-set on suggesting ONLY 'maxU32' when trying to pass 'u32' as a type argument...
const maxU32 = std.math.maxInt(u32);
pub const CHOICE_SKIP = maxU32;

pub const Tile = struct {
    x: u32,
    y: u32,
    /// slice of (cardinal) neighbor indices, each an index into 'Phase0Data.tileList'
    nIds: []u32,
};

pub const Phase0Data = struct {
    /// the occupancy bitset contains tiles on which a miner/belt is placed.<br/>
    /// Initially empty, will be updated by the subsequent phases.<br/>
    /// Indexed by tile-id.
    occupancy: std.DynamicBitSet,
    numEdges: usize,
    /// the first numEdges-many Tiles encode: the set of edge-tiles ordered such that they walk the perimeter of the asteroid (clockwise)<br/>
    /// the remaining Tiles are non-edge tiles.
    tileList: std.ArrayList(Tile),
    /// mapping from encoded position to index into 'tileList' (example usage: <code>tileList[tileIdsByEnc[encode(x, y)]]</code>)
    /// <br/>Contains maxU32 for encodings that are not part of the asteroid.
    tileIdsByEnc: []u32,
    /// utility memory slice that can be reused for flood filling. Capacity == number of tiles
    floodFillStack: dt.ArrayStack(u32),
    /// utility memory containing temporary bitsets with one bit per asteroid tile (indexed by tile-id)
    tempBitSets: [6]std.DynamicBitSet,
};

pub const Phase1Options = struct {
    /// the number of miner-placements to "look ahead" when determining a miner placement
    /// <br/>Example: '6' -> on each edge tile, accept the layout that minimizes the necessary gaps when placing *5* more miners.
    maxLookahead: u32 = 6,
    /// How many CW miners to place during the pre-scan.
    /// <br/>About pre-scanning: The first few miner placements are suboptimal because they are unconstrained in both CCW and CW directions.
    /// <br/>Pre-scanning places a few temporary miners in the CCW direction. This way the first "real" miner-placement is unconstrained only in the CW direction.
    preScanCwCount: u32 = 4,
    /// How many miners CCW to place during the pre-scan. After this many miners are placed, the pre-scan CCW miners are discarded.
    preScanCcwCount: u32 = 4,
};

pub const Phase1Data = struct {
    /// Encoded tetromino choice, indexed by edge-miner-id ([0..Phase0Data.numEdges])
    edgeMinerChoices: []u32,
};

pub const Phase2Options = struct {
    /// Controls on which tiles optimization is attempted. Tiles with better/equal score will be ignored.
    /// (negative values are slower, but can result in better solutions)
    targetMinScore: i32 = 3,
    /// If 'true' then occupied tiles will also be evaluated and optimized.
    /// ('false' is much faster, 'true' rarely provides better solutions)
    optimizeOccupied: bool = false,
    /// If negative, no limit. Otherwise limits how many edge-miners are retried in one batch (reduces cost exponentially)
    maxRetryMiners: i32 = 10,
};

pub const P2EdgeUpdate = packed struct {
    /// 0 = deoccupy, 1 = occupy
    occupy: u1,
    edgeId: u31,
    encChoice: u32,
};

pub const Phase2Data = struct {
    updatedEdges: std.ArrayList(P2EdgeUpdate),
};

pub const Phase3Options = struct {
    maxBeamWidth: u8 = 2,
    reduceBeamWidthNTiles: u32 = 750,
};

pub const Phase3Data = struct {
    const Self = @This();
    alloc: std.mem.Allocator,
    committedChoices: []P3MinerUpdate,

    pub fn addChoice(self: *Self, choice: *const Phase3OptimizationChoice) !void {
        try self.grow();
        self.committedChoices[self.committedChoices.len - 1] = P3MinerUpdate{
            .occupy = 1,
            .choice = choice.*,
        };
    }
    pub fn addUndo(self: *Self) !void {
        try self.grow();
        var numSkipChoices: usize = 0;
        for (1..self.committedChoices.len) |i| {
            const prevChoice = &self.committedChoices[self.committedChoices.len - (i + 1)];
            if (prevChoice.occupy == 1) {
                if (numSkipChoices <= 0) {
                    self.committedChoices[self.committedChoices.len - 1] = P3MinerUpdate{
                        .occupy = 0,
                        .choice = prevChoice.choice,
                    };
                    return;
                } else {
                    numSkipChoices -= 1;
                }
            } else {
                // in the current model, only the most recent choice is ever undone.
                // this logic breaks if arbitrary choices can be undone.
                numSkipChoices += 1;
            }
        }
        return error.noPrevChoiceFound;
    }
    fn grow(self: *Self) !void {
        const curLen = self.committedChoices.len;
        const newLen = curLen + 1;
        if (curLen == 0) {
            self.committedChoices = try self.alloc.alloc(P3MinerUpdate, newLen);
        } else if (!self.alloc.resize(self.committedChoices, newLen)) {
            // unfortunately resize may fail if the arenaAllocator created a new node.
            var newBuffer = try self.alloc.alloc(P3MinerUpdate, newLen);
            @memcpy(newBuffer[0..curLen], self.committedChoices[0..curLen]);
            self.committedChoices = newBuffer;
        }
        self.committedChoices.len = newLen;
    }
};

pub const P3MinerUpdate = struct {
    /// 0 = deoccupy, 1 = occupy
    occupy: u1,
    choice: Phase3OptimizationChoice,
};

pub fn processMinerBlueprint(
    alloc: std.mem.Allocator,
    minerBlueprintStr: []const u8,
    logger: *const ProblemCallback,
) !*const [dt.Rotation.numRotations]dt.BuildingBlueprint {
    _, const minerBp = try bpParser.parseGeneric(minerBlueprintStr, alloc, logger);
    if (minerBp.Entries.len != 1) {
        logger.onError(logger.ctx, try std.fmt.allocPrint(alloc, "minerBlueprint must contain exactly one island, but instead contained {} islands.", .{minerBp.Entries.len}));
        return error.invalidMinerBp;
    }

    var curRotation = minerBp.Entries[0].R;
    var rotatedMinerBuildings = try alloc.alloc(dt.BuildingBlueprint, dt.Rotation.numRotations);
    rotatedMinerBuildings[@intFromEnum(curRotation)] = if (minerBp.Entries[0].B) |b| (b) else dt.BuildingBlueprint{ .Entries = &.{} };
    for (1..dt.Rotation.numRotations) |_| {
        const prevRotBp = &rotatedMinerBuildings[@intFromEnum(curRotation)];
        curRotation = curRotation.rotate();
        try bpWriter.getRotatedCopy(alloc, prevRotBp, &rotatedMinerBuildings[@intFromEnum(curRotation)]);
    }
    return rotatedMinerBuildings[0..dt.Rotation.numRotations];
}

/// Phase0 prepares the solver by constructing various helper data structures.
pub fn phase0(
    alloc: std.mem.Allocator,
    roid: *const asteroid.Asteroid,
    logger: *const ProblemCallback,
) !*Phase0Data {
    const numTiles = roid.gridSet.count();
    const numEncodings = roid.gridSet.capacity();
    var p0: *Phase0Data = try alloc.create(Phase0Data);
    p0.occupancy = try std.DynamicBitSet.initEmpty(alloc, numTiles);
    p0.tileList = try std.ArrayList(Tile).initCapacity(alloc, numTiles);
    p0.tileIdsByEnc = try alloc.alloc(u32, numEncodings);
    @memset(p0.tileIdsByEnc, maxU32);
    p0.floodFillStack = try dt.ArrayStack(u32).init(alloc, numTiles);

    // initialize reusable bitsets
    for (0..p0.tempBitSets.len) |i| {
        p0.tempBitSets[i] = try std.DynamicBitSet.initEmpty(alloc, numTiles);
    }

    // for the edge-tiling algorithm, find all edge-tiles (collect to a bitset)
    var edgeTileSet = try std.DynamicBitSet.initEmpty(alloc, numEncodings);
    var gridIter = roid.gridSet.iterator(.{});
    while (gridIter.next()) |encPos| {
        const x: i32 = @intCast(asteroid.decodeX(roid.maxY, @intCast(encPos)));
        const y: i32 = @intCast(asteroid.decodeY(roid.maxY, @intCast(encPos)));
        var isEdgeTile = false;
        for (dir.cardinals) |*cardinal| {
            if (asteroid.encode(roid, x + cardinal.x, y + cardinal.y)) |nEnc| {
                if (!roid.gridSet.isSet(nEnc)) {
                    // if the cardinal neighbor is unoccupied, then this is an edge tile
                    isEdgeTile = true;
                    break;
                }
            } else {
                isEdgeTile = true;
                break;
            }
        }
        if (isEdgeTile) {
            edgeTileSet.set(encPos);
        }
    }
    const numEdgeTiles = edgeTileSet.count();
    p0.numEdges = numEdgeTiles;
    if (numEdgeTiles <= 0) {
        logger.onError(logger.ctx, "SanityError: Did not find any edge-tiles for asteroid. This should be impossible unless the Asteroid contains no tiles.");
        return error.noEdgesFound;
    }

    // now sort these edge-tiles into a list that walks clockwise around the perimeter
    var curTileIdx: u32 = 0;
    var tempEdgeSet = try edgeTileSet.clone(alloc);
    const firstEdge: u32 = @intCast(tempEdgeSet.findFirstSet().?);
    var curEdgeTile = p0.tileList.addOneAssumeCapacity();
    var curEdgeEnc = firstEdge;
    curEdgeTile.x = asteroid.decodeX(roid.maxY, firstEdge);
    curEdgeTile.y = asteroid.decodeY(roid.maxY, firstEdge);
    p0.tileIdsByEnc[firstEdge] = curTileIdx;
    curTileIdx += 1;

    for (0..numEdgeTiles) |_walkTileIdx| {
        tempEdgeSet.unset(curEdgeEnc);
        var exitOffsetIdx: i5 = -1;
        for (dir.cardinals, 0..) |*cardinal, i| {
            const nEnc = asteroid.encode(roid, @as(i32, @intCast(curEdgeTile.x)) + cardinal.x, @as(i32, @intCast(curEdgeTile.y)) + cardinal.y) orelse {
                exitOffsetIdx = @intCast(i);
                break;
            };
            if (!roid.gridSet.isSet(nEnc)) {
                exitOffsetIdx = @intCast(i);
                break;
            }
        }
        std.debug.assert(exitOffsetIdx != -1);

        var foundNextEdge = false;
        // find the first clockwise (edge-)neighbor, start checking at the exit offset
        for (1..8) |i| {
            const checkIdx: u3 = @intCast((@as(i5, @intCast(i)) + (2 * exitOffsetIdx)) & 0b111);
            const checkDir = &dir.eightNeighbors[checkIdx];
            const checkX: i32 = @as(i32, @intCast(curEdgeTile.x)) + checkDir.x;
            const checkY: i32 = @as(i32, @intCast(curEdgeTile.y)) + checkDir.y;
            const checkEnc = asteroid.encode(roid, checkX, checkY) orelse continue;
            if (tempEdgeSet.isSet(checkEnc)) {
                foundNextEdge = true;
                curEdgeEnc = checkEnc;
                curEdgeTile = p0.tileList.addOneAssumeCapacity();
                curEdgeTile.x = @intCast(checkX);
                curEdgeTile.y = @intCast(checkY);
                p0.tileIdsByEnc[checkEnc] = curTileIdx;
                curTileIdx += 1;
                break;
            }
        }

        if (!foundNextEdge and _walkTileIdx != (numEdgeTiles - 1)) {
            // can happen e.g. on Asteroids that are 1 tile wide total (clockwise traversal is blocked by visited tiles)
            // In that case, find the closest next tile.
            var unvisitedIter = tempEdgeSet.iterator(.{});
            var minDistance: u32 = maxU32;
            var minDistanceEnc: u32 = maxU32;
            while (unvisitedIter.next()) |checkEnc| {
                const checkX: i32 = @intCast(asteroid.decodeX(roid.maxY, @intCast(checkEnc)));
                const checkY: i32 = @intCast(asteroid.decodeY(roid.maxY, @intCast(checkEnc)));
                const dx: u32 = @abs(checkX - @as(i32, @intCast(curEdgeTile.x)));
                const dy: u32 = @abs(checkY - @as(i32, @intCast(curEdgeTile.y)));
                const distance = dx + dy;
                if (distance < minDistance) {
                    minDistance = distance;
                    minDistanceEnc = @intCast(checkEnc);
                }
            }

            if (minDistanceEnc != maxU32) {
                const newX: u32 = asteroid.decodeX(roid.maxY, @intCast(minDistanceEnc));
                const newY: u32 = asteroid.decodeY(roid.maxY, @intCast(minDistanceEnc));

                const warning = try std.fmt.allocPrint(alloc, "Unable to walk perimiter at ({}, {}). (Long segment of 1 wide asteroid?) Will continue at ({}, {}).", .{
                    @as(i32, @intCast(curEdgeTile.x)) + roid.originX,
                    @as(i32, @intCast(curEdgeTile.y)) + roid.originY,
                    @as(i32, @intCast(newX)) + roid.originX,
                    @as(i32, @intCast(newY)) + roid.originY,
                });
                logger.onWarn(logger.ctx, warning);

                curEdgeEnc = minDistanceEnc;
                curEdgeTile = p0.tileList.addOneAssumeCapacity();
                curEdgeTile.x = newX;
                curEdgeTile.y = newY;
                p0.tileIdsByEnc[minDistanceEnc] = curTileIdx;
                curTileIdx += 1;
            } else {
                logger.onError(logger.ctx, "SanityError: Failed to find the next tile while walking perimiter.");
                return error.perimeterConstructionFailed;
            }
        }
    }
    if (tempEdgeSet.count() != 0) {
        logger.onError(logger.ctx, "SanityError: Failed to collecting the edges into a set walking the perimeter.");
        return error.perimeterConstructionFailed;
    }

    // now fill the remaining tiles into the tileList
    var nonEdgeSet = tempEdgeSet;
    nonEdgeSet.setUnion(roid.gridSet);
    nonEdgeSet.toggleSet(edgeTileSet); // a roundabout way of doing nonEdgeSet = gridSet.andNot(edgeTileSet) ; works because all edge-tiles are contained in the grid-set.
    var nonEdgeIter = nonEdgeSet.iterator(.{});
    while (nonEdgeIter.next()) |nonEdge| {
        var tile = p0.tileList.addOneAssumeCapacity();
        tile.x = asteroid.decodeX(roid.maxY, @intCast(nonEdge));
        tile.y = asteroid.decodeY(roid.maxY, @intCast(nonEdge));
        p0.tileIdsByEnc[nonEdge] = curTileIdx;
        curTileIdx += 1;
    }

    if (curTileIdx != numTiles) {
        logger.onError(logger.ctx, "SanityError: Not all tiles were visited while collecting them to a list. (length != numTiles)");
        return error.notAllTilesVisited;
    }

    // construct nIds for each tile
    var tempNIds: [4]u32 = undefined;
    for (0..numTiles) |i| {
        var tile: *Tile = &p0.tileList.items[i];
        var numNeighbors: u3 = 0;
        for (dir.cardinals) |*cardinal| {
            const nEnc = asteroid.encode(roid, @as(i32, @intCast(tile.x)) + cardinal.x, @as(i32, @intCast(tile.y)) + cardinal.y) orelse continue;
            const nId = p0.tileIdsByEnc[nEnc];
            if (nId == maxU32) continue; // faster equivalent of: !roid.gridSet.isSet(nEnc)

            tempNIds[numNeighbors] = nId;
            numNeighbors += 1;
        }

        tile.nIds = try alloc.alloc(u32, numNeighbors);
        @memcpy(tile.nIds, tempNIds[0..numNeighbors]);
    }

    return p0;
}

/// Phase1 maximizes the number of miners on edge tiles, without concern for anything else (will be fixed in Phase2)
pub fn phase1(
    alloc: std.mem.Allocator,
    roid: *const asteroid.Asteroid,
    p0: *Phase0Data,
    p1Opts: *const Phase1Options,
) !*Phase1Data {
    const p1: *Phase1Data = try alloc.create(Phase1Data);
    const p1Step: *Phase1StepData = try phase1_stepper_init(alloc, p0, p1Opts);
    while (phase1_step(roid, p0, p1Opts, p1Step) != null) {}
    p1.edgeMinerChoices = p1Step.edgeMinerChoices;
    return p1;
}

/// Phase2 tries to smooth out the inner edges created by Phase1
pub fn phase2(
    alloc: std.mem.Allocator,
    roid: *const asteroid.Asteroid,
    p0: *Phase0Data,
    p1: *Phase1Data,
    p2Opts: *const Phase2Options,
) !*Phase2Data {
    const p2: *Phase2StepData = try phase2_stepper_init(alloc, p0, p1);
    while (try phase2_step(alloc, roid, p0, p2Opts, p2)) {}
    return &p2.result;
}

pub fn phase3(
    alloc: std.mem.Allocator,
    roid: *const asteroid.Asteroid,
    p0: *Phase0Data,
    p3Opts: *const Phase3Options,
) !*Phase3Data {
    const p3: *Phase3StepData = try phase3_stepper_init(alloc, p0, p3Opts);
    while (try phase3_step(alloc, roid, p0, p3Opts, p3)) {}
    return &p3.result;
}

pub const Phase1StepData = struct {
    /// The edge-idx on which to start pre-scanning
    preScanStart: u32,
    /// The total number of edges to visit during pre-scan
    preScanTotal: u32,
    /// How many edges have been pre-scanned so far
    curPreScanIdx: u32,
    /// The current edge-index for the "normal" phase1 step
    curNormalIdx: u32,
    /// Encoded tetromino choice, indexed by edge-miner-id ([0..Phase0Data.numEdges])
    edgeMinerChoices: []u32,
    /// Utility memory containing a step result
    tempEdgeResult: EdgeResult,
    /// Utility memory for storing the tile-indices of a tetromino
    tempMinoIds: [4]u32 = undefined,
};

/// Prepares the phase1 stepper
pub fn phase1_stepper_init(
    alloc: std.mem.Allocator,
    p0: *Phase0Data,
    p1Opts: *const Phase1Options,
) !*Phase1StepData {
    var p1: *Phase1StepData = try alloc.create(Phase1StepData);
    p1.edgeMinerChoices = try alloc.alloc(u32, p0.numEdges);
    @memset(p1.edgeMinerChoices, CHOICE_SKIP);

    const halfNumEdges = p0.numEdges >> 1;
    const preScanCcwCount: u32 = @max(1, @min(p1Opts.preScanCcwCount, halfNumEdges));
    const preScanCwCount: u32 = @min(p1Opts.preScanCwCount, halfNumEdges);
    p1.preScanStart = @as(u32, @intCast(p0.numEdges)) - preScanCcwCount;
    p1.preScanTotal = preScanCcwCount + preScanCwCount;
    p1.tempEdgeResult = EdgeResult{
        .bestInput = try alloc.alloc(u32, p0.numEdges), // it is unlikely, but not impossible that the lookahead spans the entire perimeter
        .numBestInput = 0,
        .curInput = try alloc.alloc(u32, p0.numEdges),
        .numCurInput = 0,
    };
    p1.curPreScanIdx = 0;
    p1.curNormalIdx = preScanCwCount;

    return p1;
}

/// Performs a single step of Phase1
/// <br/>Returns the edge-index that was solved ; or null if Phase1 has completed.
pub fn phase1_step(
    roid: *const asteroid.Asteroid,
    p0: *Phase0Data,
    p1Opts: *const Phase1Options,
    p1: *Phase1StepData,
) ?u32 {
    if (p1.curPreScanIdx < p1.preScanTotal) {
        defer p1.curPreScanIdx += 1;

        // CAUTION: until phase1 completes, tempBitSet0 must not be reused elsewhere.
        const preChoiceOccupancy = &p0.tempBitSets[0];
        const edgeIdx = (p1.preScanStart + p1.curPreScanIdx) % p0.numEdges;
        const numEdgesLeft = p0.numEdges - p1.curPreScanIdx;
        optimizeEdgeChoice(
            roid,
            p0,
            @min(p1Opts.maxLookahead, numEdgesLeft),
            p1.preScanStart - 1,
            preChoiceOccupancy,
            edgeIdx,
            &p1.tempEdgeResult,
        );
        if (edgeResultCheckAndReset(&p1.tempEdgeResult)) {
            const edgeTile: *const Tile = &p0.tileList.items[edgeIdx];
            const bestChoice = p1.tempEdgeResult.bestInput[0];
            const halfNumEdges = p0.numEdges >> 1;
            if (edgeIdx < halfNumEdges) {
                // accept CW miners in the final solution
                p1.edgeMinerChoices[edgeIdx] = bestChoice;
                if (decodeTetrominoLayout(roid, p0, edgeIdx, edgeTile, bestChoice, &p1.tempMinoIds)) {
                    bh.setAllArr(4, preChoiceOccupancy, &p1.tempMinoIds);
                    bh.setAllArr(4, &p0.occupancy, &p1.tempMinoIds);
                }
            } else {
                // CCW miners only update the preChoiceOccupancy
                if (decodeTetrominoLayout(roid, p0, edgeIdx, edgeTile, bestChoice, &p1.tempMinoIds)) {
                    bh.setAllArr(4, preChoiceOccupancy, &p1.tempMinoIds);
                }
            }
        }
        return @as(u32, @intCast(edgeIdx));
    } else if (p1.curNormalIdx < p0.numEdges) {
        defer p1.curNormalIdx += 1;
        // pre-scan has completed, do "normal" step

        const edgeIdx = p1.curNormalIdx;
        const numEdgesLeft = p0.numEdges - edgeIdx;
        optimizeEdgeChoice(
            roid,
            p0,
            @min(p1Opts.maxLookahead, numEdgesLeft),
            0,
            &p0.occupancy,
            edgeIdx,
            &p1.tempEdgeResult,
        );
        if (edgeResultCheckAndReset(&p1.tempEdgeResult)) {
            const edgeTile: *const Tile = &p0.tileList.items[edgeIdx];
            const bestChoice = p1.tempEdgeResult.bestInput[0];
            p1.edgeMinerChoices[edgeIdx] = bestChoice;
            if (decodeTetrominoLayout(roid, p0, edgeIdx, edgeTile, bestChoice, &p1.tempMinoIds)) {
                bh.setAllArr(4, &p0.occupancy, &p1.tempMinoIds);
            }
        }
        return edgeIdx;
    } else {
        // all loops have terminated -> DONE
        return null;
    }
}

const EdgeResult = struct {
    score: i32 = std.math.maxInt(i32),
    bestInput: []u32,
    numBestInput: usize,
    curInput: []u32,
    numCurInput: usize,
};

inline fn updateEdgeResult(self: *EdgeResult, newScore: i32) void {
    if (newScore < self.score and self.numCurInput > 0) {
        self.score = newScore;
        @memcpy(self.bestInput, self.curInput);
        self.numBestInput = self.numCurInput;
    }
}

inline fn edgeResultCheckAndReset(self: *EdgeResult) bool {
    const foundSolution: bool = self.score != std.math.maxInt(i32);
    self.score = std.math.maxInt(i32);
    return foundSolution;
}

pub fn countEdgeChoiceGaps(choices: []u32, numChoices: usize) i32 {
    var result: i32 = 0;
    for (choices[0..numChoices]) |c| {
        if (c == CHOICE_SKIP) {
            result += 1;
        }
    }
    return result;
}

fn optimizeEdgeChoice(
    roid: *const asteroid.Asteroid,
    p0: *Phase0Data,
    numPlacementsLeft: u32,
    lastEdgeIdx: u32,
    occupancy: *std.DynamicBitSet,
    curEdgeIdx: usize,
    result: *EdgeResult,
) void {
    if (numPlacementsLeft == 0 or curEdgeIdx == lastEdgeIdx) {
        updateEdgeResult(result, countEdgeChoiceGaps(result.curInput, result.numCurInput));
        return;
    }

    const nextEdgeIdx = (curEdgeIdx + 1) % p0.numEdges;
    if (occupancy.isSet(curEdgeIdx)) {
        // forced to skip this edge by occupancy.

        const newGaps = countEdgeChoiceGaps(result.curInput, result.numCurInput) + 1;
        if (newGaps >= result.score) {
            // if we are not done and have created at least as many gaps as the best solution, this solutions cannot be better
            return;
        }

        result.curInput[result.numCurInput] = CHOICE_SKIP;
        result.numCurInput += 1;
        optimizeEdgeChoice(roid, p0, numPlacementsLeft, lastEdgeIdx, occupancy, nextEdgeIdx, result);
        result.numCurInput -= 1;
    } else {
        var minoGridIdArr: [4]u32 = undefined;
        var anyFound = false;
        const edgeTile: *const Tile = &p0.tileList.items[curEdgeIdx];

        for (0..tet.numTetrominoLayouts) |encChoice| {
            if (decodeTetrominoLayout(roid, p0, curEdgeIdx, edgeTile, @intCast(encChoice), &minoGridIdArr)) {
                if (bh.anySetArr(minoGridIdArr.len, occupancy, &minoGridIdArr)) {
                    continue;
                }

                bh.setAllArr(minoGridIdArr.len, occupancy, &minoGridIdArr);
                result.curInput[result.numCurInput] = @intCast(encChoice);
                result.numCurInput += 1;
                anyFound = true;
                optimizeEdgeChoice(roid, p0, numPlacementsLeft - 1, lastEdgeIdx, occupancy, nextEdgeIdx, result);
                result.numCurInput -= 1;
                bh.unsetAllArr(minoGridIdArr.len, occupancy, &minoGridIdArr);
            }
        }

        // It might be impossible to place a tetromino on this tile for a given occupancy.
        // In that case, do not recurse.
        // A gap-less tiling should always be possible. (From experience, I have not formally checked)
        // However, the solver does not always find these, so track this as a potential solution with large score penalty (fixes an issue with roid_22)
        if (!anyFound) {
            updateEdgeResult(result, @intCast(100 + numPlacementsLeft));
        }
    }
}

/// Computes the tile-ids (stored in result) for a given position (tileIdx, tile) and Tetromino-Layout (encChoice)
/// <br/> returns true if the layout can be placed on the asteroid.
pub fn decodeTetrominoLayout(roid: *const asteroid.Asteroid, p0: *const Phase0Data, tileIdx: usize, tile: *const Tile, encChoice: u32, result: *[4]u32) bool {
    if (encChoice == CHOICE_SKIP) {
        return false;
    }
    const tetPosIdx: u2 = @truncate(encChoice & 0b11);
    const tetIdx: u30 = @truncate(encChoice >> 2);
    const tetTiles: *const [4]vec2i.Vector2I = &tet.shapes[tetIdx];
    const posTile: *const vec2i.Vector2I = &tetTiles[tetPosIdx];
    if (posTile.x > tile.x)
        return false; // exceeds left bound
    if (posTile.y > tile.y)
        return false; // exceeds top bound

    const posX: u32 = @intCast(@as(i32, @intCast(tile.x)) - posTile.x);
    if (posX > roid.maxX)
        return false; // exceeds right bound
    const posY: u32 = @intCast(@as(i32, @intCast(tile.y)) - posTile.y);
    if (posY > roid.maxY)
        return false; // exceeds bottom bound

    result[0] = @intCast(tileIdx);
    for (1..4) |i| {
        const extTile = tetTiles[(i + tetPosIdx) & 0b11];
        if ((-extTile.x) > posX)
            return false; // exceeds left bound
        if ((-extTile.y) > posY)
            return false; // exceeds top bound

        const x: i32 = extTile.x + @as(i32, @intCast(posX));
        if (x > roid.maxX)
            return false; // exceeds right bound
        const y: i32 = extTile.y + @as(i32, @intCast(posY));
        if (y > roid.maxY)
            return false; // exceeds bottom bound

        const enc = asteroid.encodeUnsafe(roid, x, y);
        const extId = p0.tileIdsByEnc[enc];
        if (extId == maxU32)
            return false; // tile is within bounds but not on the asteroid
        result[i] = extId;
    }
    return true;
}

pub const Phase2StepData = struct {
    tempRelatedGridIds: dt.FixedList(u32),
    /// the edge-ids on which a reflow is attempted
    tempRetryEdgeIds: dt.FixedList(u32),
    /// the edge-ids that will be occupied after a reflow
    tempFixedEdgeIds: dt.FixedList(u32),
    tempBestFixedEdgeIds: dt.FixedList(u32),
    /// A copy of the phase1 choices which will be modified as optimizations are applied
    tempP1Choices: Phase1Data,
    tempWorstPoints: dt.FixedList(Phase2Point),
    /// Utility memory for storing the tile-indices of a tetromino
    tempMinoIds: [4]u32 = undefined,
    tempOptResult: EdgePpOptimizationResult,
    result: Phase2Data,
};

pub const Phase2Point = struct {
    gridId: u32,
    score: i32,
    pub fn isLessThan(_: void, a: Phase2Point, b: Phase2Point) bool {
        return a.score < b.score;
    }
};

pub const EdgePpOptimizationResult = struct {
    const Self = @This();
    anyFound: bool = false,
    bestScore: i32 = 0,
    bestInput: dt.FixedList(u32),
    curInput: dt.FixedList(u32),

    pub fn update(self: *Self, score: i32) void {
        if (score > self.bestScore) {
            self.anyFound = true;
            self.bestScore = score;
            const numItems = self.curInput.numItems;
            self.bestInput.numItems = numItems;
            @memcpy(self.bestInput.items[0..numItems], self.curInput.items[0..numItems]);
        }
    }
};

/// Prepares the phase2 stepper
pub fn phase2_stepper_init(
    alloc: std.mem.Allocator,
    p0: *const Phase0Data,
    p1: *const Phase1Data,
) !*Phase2StepData {
    var p2: *Phase2StepData = try alloc.create(Phase2StepData);
    p2.tempRelatedGridIds = dt.FixedList(u32){ .items = try alloc.alloc(u32, dir.cityBlock2.len + 1) };
    p2.tempRetryEdgeIds = dt.FixedList(u32){ .items = try alloc.alloc(u32, p0.numEdges) };
    p2.tempFixedEdgeIds = dt.FixedList(u32){ .items = try alloc.alloc(u32, p0.numEdges) };
    p2.tempBestFixedEdgeIds = dt.FixedList(u32){ .items = try alloc.alloc(u32, p0.numEdges) };
    p2.tempP1Choices = Phase1Data{ .edgeMinerChoices = try alloc.alloc(u32, p1.edgeMinerChoices.len) };
    @memcpy(p2.tempP1Choices.edgeMinerChoices, p1.edgeMinerChoices);
    p2.tempWorstPoints = dt.FixedList(Phase2Point){ .items = try alloc.alloc(Phase2Point, p0.tileList.items.len) };
    p2.tempOptResult = EdgePpOptimizationResult{
        .bestInput = dt.FixedList(u32){ .items = try alloc.alloc(u32, p0.numEdges) },
        .curInput = dt.FixedList(u32){ .items = try alloc.alloc(u32, p0.numEdges) },
    };
    p2.result.updatedEdges = std.ArrayList(P2EdgeUpdate).init(alloc);
    return p2;
}

/// Performs a single step of Phase2
/// <br/>Returns 'false' if no more steps need to be made ; Returns 'true' otherwise.
pub fn phase2_step(
    alloc: std.mem.Allocator, // beware: any allocations must be freed again, so that the result can resize without reallocating
    roid: *const asteroid.Asteroid,
    p0: *Phase0Data,
    p2Opts: *const Phase2Options,
    p2: *Phase2StepData,
) !bool {
    const edgePpOccupancy = &p0.tempBitSets[0];

    if (p2Opts.optimizeOccupied) {
        std.debug.assert(p2.tempWorstPoints.items.len == p0.tileList.items.len);
        for (0..p0.tileList.items.len) |i| {
            p2.tempWorstPoints.items[i] = Phase2Point{
                .gridId = @intCast(i),
                .score = -calcFlipEdgePpScore(p0, &p0.occupancy, i),
            };
        }
        p2.tempWorstPoints.numItems = p0.tileList.items.len;
    } else {
        p2.tempWorstPoints.numItems = 0;
        var iter = p0.occupancy.iterator(.{ .kind = .unset });
        while (iter.next()) |id| {
            p2.tempWorstPoints.add(Phase2Point{
                .gridId = @intCast(id),
                .score = -calcFlipEdgePpScore(p0, &p0.occupancy, id),
            });
        }
    }
    std.mem.sort(Phase2Point, p2.tempWorstPoints.slice(), {}, Phase2Point.isLessThan);

    for (p2.tempWorstPoints.slice()) |*worstPoint| {
        if (worstPoint.score >= p2Opts.targetMinScore)
            return false;

        const wpTile = &p0.tileList.items[worstPoint.gridId];
        p2.tempRelatedGridIds.items[0] = worstPoint.gridId;
        p2.tempRelatedGridIds.numItems = 1;
        for (dir.cityBlock2) |*offset| {
            if (asteroid.encode(roid, @as(i32, @intCast(wpTile.x)) + offset.x, @as(i32, @intCast(wpTile.y)) + offset.y)) |offsetEnc| {
                const offsetId = p0.tileIdsByEnc[offsetEnc];
                if (offsetId != maxU32 and p0.occupancy.isSet(offsetId)) {
                    p2.tempRelatedGridIds.add(offsetId);
                }
            }
        }

        bh.copyInto(edgePpOccupancy, &p0.occupancy);
        var unsetScoreDelta: i32 = 0; // track score change caused by unsetting the tiles that will be retried

        var numRetryMiners: u32 = 0; // tracks how many miners have been removed
        p2.tempRetryEdgeIds.numItems = 0;
        for (0..p0.numEdges) |edgeId| {
            const edgeTile = &p0.tileList.items[edgeId];
            const edgeChoice = p2.tempP1Choices.edgeMinerChoices[edgeId];
            if (decodeTetrominoLayout(roid, p0, edgeId, edgeTile, edgeChoice, &p2.tempMinoIds)) {
                if (sh.intersects(u32, p2.tempRelatedGridIds.slice(), p2.tempMinoIds[0..])) {
                    numRetryMiners += 1;
                    for (p2.tempMinoIds) |minoId| {
                        unsetScoreDelta += calcFlipEdgePpScore(p0, edgePpOccupancy, minoId);
                        edgePpOccupancy.unset(minoId);
                        const isEdgeId = minoId < p0.numEdges;
                        if (isEdgeId) {
                            // note: this adds no duplicates because edges with extenders on them must choose 'CHOICE_SKIP'
                            p2.tempRetryEdgeIds.add(@intCast(minoId));
                        }
                    }
                }
            }
        }
        // also consider retrying related tiles if they are unoccupied edge-tiles:
        for (p2.tempRelatedGridIds.slice()) |relatedGridId| {
            const isEdgeId = relatedGridId < p0.numEdges;
            if (isEdgeId) {
                if (!p0.occupancy.isSet(relatedGridId)) {
                    // note: this adds no duplicates because so far only occupied tiles have been added.
                    p2.tempRetryEdgeIds.add(relatedGridId);
                }
            }
        }

        if (p2.tempRetryEdgeIds.numItems <= 0) {
            // if this triggers, we're looking at a tile with no miners/extenders in city-block distance<=2.
            // so an unoccupied center-tile. These always have the maximum possible score and cannot be optimized, so it's safe to stop here.
            return false;
        }
        if (p2.tempRetryEdgeIds.numItems >= 32) {
            // the CombinationBitSet does not support more than 31 bits
            // Even if it did, the search-space would be insanely large, skip this candidate reflow
            continue;
        }

        // at this point, 'edgePpOccupancy' is exactly equal to 'occupancy.andNot(retryGridIds)'
        p2.tempBestFixedEdgeIds.numItems = 0;
        p2.tempOptResult.bestScore = 0; // '0' to ignore any solution that does not improve the score
        p2.tempOptResult.bestInput.numItems = 0;

        const maxNumMiners = if (p2Opts.maxRetryMiners < 0) p2.tempRetryEdgeIds.numItems else @min(p2.tempRetryEdgeIds.numItems, @as(usize, @intCast(p2Opts.maxRetryMiners)));
        var searchMinerCount = maxNumMiners;
        const minRetryMiners = @max(1, numRetryMiners);
        while (searchMinerCount >= minRetryMiners) : (searchMinerCount -= 1) {
            var minerCombinations = try cb.CombinationBitSet32.init(@intCast(maxNumMiners), @intCast(searchMinerCount));
            while (minerCombinations.next()) |minerCombination| {
                p2.tempFixedEdgeIds.numItems = 0;
                var resetScoreDelta: i32 = 0; // track score change caused by (re)setting the miner tiles
                var combinationIter = cb.BitIterator32.init(minerCombination);
                while (combinationIter.next()) |retryId| {
                    const gridId = p2.tempRetryEdgeIds.items[retryId];
                    p2.tempFixedEdgeIds.add(gridId);
                    resetScoreDelta += calcFlipEdgePpScore(p0, edgePpOccupancy, gridId);
                    edgePpOccupancy.set(gridId); // mark all miners as occupied to avoid checking bad solutions
                }
                defer {
                    for (p2.tempFixedEdgeIds.slice()) |retryGridId| {
                        edgePpOccupancy.unset(retryGridId);
                    }
                }

                // pre-compute valid choices for this occupancy
                var validMinerChoices = try alloc.alloc(dt.FixedList(u32), p2.tempFixedEdgeIds.numItems);
                defer alloc.free(validMinerChoices);

                for (p2.tempFixedEdgeIds.slice(), 0..) |gridId, choicePoolIdx| {
                    const tile = &p0.tileList.items[gridId];
                    const choicePool = &validMinerChoices[choicePoolIdx];
                    choicePool.* = dt.FixedList(u32){
                        .items = try alloc.alloc(u32, tet.numTetrominoLayouts), // 304 bytes - I don't think a resizing ArrayList is necessary here.
                    };
                    choiceLoop: for (0..tet.numTetrominoLayouts) |encChoice| {
                        const encChoiceU32: u32 = @intCast(encChoice);
                        if (decodeTetrominoLayout(roid, p0, gridId, tile, encChoiceU32, &p2.tempMinoIds)) {
                            for (1..4) |extIdx| {
                                if (edgePpOccupancy.isSet(p2.tempMinoIds[extIdx])) {
                                    continue :choiceLoop;
                                }
                            }

                            choicePool.items[choicePool.numItems] = encChoiceU32;
                            choicePool.numItems += 1;
                        }
                    }
                }
                defer {
                    var choicePoolIdx = p2.tempFixedEdgeIds.numItems;
                    while (choicePoolIdx > 0) {
                        choicePoolIdx -= 1;
                        alloc.free(validMinerChoices[choicePoolIdx].items);
                    }
                }

                p2.tempOptResult.curInput.numItems = 0;
                p2.tempOptResult.anyFound = false;
                optimizeEdgePpScore(
                    roid,
                    p0,
                    edgePpOccupancy,
                    &p2.tempFixedEdgeIds,
                    0,
                    unsetScoreDelta + resetScoreDelta,
                    &p2.tempOptResult,
                    validMinerChoices,
                );
                if (p2.tempOptResult.anyFound) {
                    const numItems = p2.tempFixedEdgeIds.numItems;
                    p2.tempBestFixedEdgeIds.numItems = numItems;
                    @memcpy(p2.tempBestFixedEdgeIds.items[0..numItems], p2.tempFixedEdgeIds.items[0..numItems]);
                }
            }
        }

        if (p2.tempBestFixedEdgeIds.numItems > 0 and p2.tempOptResult.bestScore > 0) {
            for (p2.tempRetryEdgeIds.slice()) |retryEdgeId| {
                const oldChoice = p2.tempP1Choices.edgeMinerChoices[retryEdgeId];
                if (oldChoice != CHOICE_SKIP) {
                    p2.tempP1Choices.edgeMinerChoices[retryEdgeId] = CHOICE_SKIP;
                    (try p2.result.updatedEdges.addOne()).* = P2EdgeUpdate{
                        .occupy = 0,
                        .edgeId = @intCast(retryEdgeId),
                        .encChoice = oldChoice,
                    };
                }
            }

            for (p2.tempBestFixedEdgeIds.slice(), 0..) |reflowEdgeId, choiceIdx| {
                const newChoice = p2.tempOptResult.bestInput.items[choiceIdx];
                p2.tempP1Choices.edgeMinerChoices[reflowEdgeId] = newChoice;
                (try p2.result.updatedEdges.addOne()).* = P2EdgeUpdate{
                    .occupy = 1,
                    .edgeId = @intCast(reflowEdgeId),
                    .encChoice = newChoice,
                };

                const reflowTile = &p0.tileList.items[reflowEdgeId];
                if (decodeTetrominoLayout(roid, p0, reflowEdgeId, reflowTile, newChoice, &p2.tempMinoIds)) {
                    for (p2.tempMinoIds) |minoGridId| {
                        edgePpOccupancy.set(minoGridId);
                    }
                } else unreachable; // impossible because the layout was found as a solution, SKIP is not an option, so it must be decodable.
            }
            bh.copyInto(&p0.occupancy, edgePpOccupancy);

            return true;
        }
    }
    return false;
}

/// Computes the change in phase2-score (edge-post-processing) when flipping a single tile.
/// <br/>Larger is better.
fn calcFlipEdgePpScore(p0: *const Phase0Data, occupancy: *const std.DynamicBitSet, gridId: usize) i32 {
    const selfOccupied = occupancy.isSet(gridId);
    const tile = &p0.tileList.items[gridId];
    var delta: i32 = 0;

    if (gridId < p0.numEdges) {
        delta += if (selfOccupied) -50 else 50; // apply a penalty for unoccupied edge-miners
    } else {
        delta += if (selfOccupied) -1 else 1; // minimal delta to prioritize optimizing unoccupied center tiles
    }

    for (tile.nIds) |nId| {
        delta += if (selfOccupied == occupancy.isSet(nId)) -25 else 25;
    }

    return delta;
}

fn optimizeEdgePpScore(
    roid: *const asteroid.Asteroid,
    p0: *const Phase0Data,
    occupancy: *std.DynamicBitSet,
    minerIds: *const dt.FixedList(u32),
    curMinerIdIdx: u32,
    curScore: i32,
    result: *EdgePpOptimizationResult,
    validMinerChoices: []dt.FixedList(u32),
) void {
    if (curMinerIdIdx >= minerIds.numItems) {
        result.update(curScore);
        return;
    }

    const edgeId = minerIds.items[curMinerIdIdx];
    const edgeTile = &p0.tileList.items[edgeId];
    var tempMinoIds: [4]u32 = undefined;
    const choicePool = &validMinerChoices[curMinerIdIdx];
    choiceLoop: for (choicePool.items[0..choicePool.numItems]) |encChoice| {
        if (decodeTetrominoLayout(roid, p0, edgeId, edgeTile, encChoice, &tempMinoIds)) {
            for (1..4) |minoIdx| {
                if (occupancy.isSet(tempMinoIds[minoIdx])) {
                    continue :choiceLoop;
                }
            }

            var layoutScoreDelta: i32 = 0;
            for (1..4) |minoIdx| {
                const extGridId = tempMinoIds[minoIdx];
                layoutScoreDelta += calcFlipEdgePpScore(p0, occupancy, extGridId);
                occupancy.set(extGridId);
            }
            defer {
                for (1..4) |minoIdx| {
                    occupancy.unset(tempMinoIds[minoIdx]);
                }
            }

            result.curInput.items[result.curInput.numItems] = encChoice;
            result.curInput.numItems += 1;
            defer result.curInput.numItems -= 1;

            optimizeEdgePpScore(
                roid,
                p0,
                occupancy,
                minerIds,
                curMinerIdIdx + 1,
                curScore + layoutScoreDelta,
                result,
                validMinerChoices,
            );
        }
    }
}

pub const TileAndScore = struct {
    tileId: u32,
    score: u32,
};

pub const Phase3StepData = struct {
    /// The set of tiles which belong to the unoccupied island that is currently being solved.
    /// <br/> Can be null, in which case 'nextIslandCandidateTiles' should be checked to find the next island.
    currentIslandTiles: ?*std.DynamicBitSet,
    currentIslandBeamWidth: usize,
    /// The number of choices pushed to 'result' when the currentIslandTiles were selected
    currentIslandInitialNumChoices: usize,
    /// The set of tiles which have not yet been considered for Phase3.
    nextIslandCandidateTiles: *std.DynamicBitSet,

    tempSolvablePositions: dt.FixedList(TileAndScore),

    result: Phase3Data,
};

const Phase3OptimizationChoice = struct {
    gridId: u32,
    scoreDelta: i32,
    miner: *const tet.CenterMinerInfo,
    minerExtIds: [9]u32,
};

/// Prepares the phase3 stepper
pub fn phase3_stepper_init(
    alloc: std.mem.Allocator,
    p0: *Phase0Data,
    p3Opts: *const Phase3Options,
) !*Phase3StepData {
    var p3: *Phase3StepData = try alloc.create(Phase3StepData);
    p3.currentIslandTiles = null;
    p3.currentIslandBeamWidth = 1;
    p3.currentIslandInitialNumChoices = 0;
    p3.nextIslandCandidateTiles = &p0.tempBitSets[0];
    bh.copyInto(p3.nextIslandCandidateTiles, &p0.occupancy);
    p3.nextIslandCandidateTiles.toggleAll(); // mark all unoccupied tiles as candidates.
    p3.tempSolvablePositions = dt.FixedList(TileAndScore){
        .items = try alloc.alloc(TileAndScore, p3Opts.maxBeamWidth),
    };
    p3.result = Phase3Data{
        .alloc = alloc,
        .committedChoices = &.{},
    };
    return p3;
}

/// Performs a single step of Phase3
/// <br/>Returns 'false' if no more steps need to be made ; Returns 'true' otherwise.
pub fn phase3_step(
    alloc: std.mem.Allocator, // beware: any allocations must be freed again, so that the result can resize without reallocating
    roid: *const asteroid.Asteroid,
    p0: *Phase0Data,
    p3Opts: *const Phase3Options,
    p3: *Phase3StepData,
) !bool {
    // TempBitSet usage and lifetime
    // - [0] = nextIslandCandidateTiles, lives for the entirety of phase 3
    // - [1] = currentIslandTiles, lives across multiple p3 steps
    // - [2] = simpleChoiceOccup, lives for a single p3 step

    if (p3.currentIslandTiles == null) {
        p3.currentIslandTiles = &p0.tempBitSets[1];
        p3.currentIslandInitialNumChoices = p3.result.committedChoices.len;
        if (!findIsland(p0, p3.currentIslandTiles.?, p3.nextIslandCandidateTiles)) {
            // cannot find any island in the remaining tiles. Phase3 must be finished.
            return false;
        }
        const islandCount = p3.currentIslandTiles.?.count();
        p3.currentIslandBeamWidth = p3Opts.maxBeamWidth - @max(0, @min(p3Opts.maxBeamWidth - 1, islandCount / p3Opts.reduceBeamWidthNTiles));
    }
    var island = p3.currentIslandTiles.?;
    if (island.count() < 14) {
        p3.currentIslandTiles = null;
        return true; // reject current island -> check next remaining island
    }

    const priorityGridId = findP3MinScoreTile(p0, island);
    findSolvablePositions(roid, p0, island, priorityGridId, p3);
    const numSolvablePositions = p3.tempSolvablePositions.numItems;
    if (numSolvablePositions <= 0) {
        // FIXME: a potential enhancement that I'm not adding here (because it does not affect any of my test-cases) is:
        // 1: while >= 14 tiles left
        //   find adjacent choices for unoccupied tiles
        //   for each adjacent choice
        //     do an exhaustive search after removing the choice
        //       except this time, verify only that a single island is left behind after optimizing
        //     if a placement is found:
        //       accept choices
        //       break (go to 1)
        // This may be more suitable in a separate Phase4, as Phase3 is already quite intense.

        p3.currentIslandTiles = null;
        return true; // Completed the current island -> check next remaining island
    }

    // we now have found some number of tiles on which a center-miner can be placed
    // -> find the best placement
    var simpleChoice = Phase3OptimizationChoice{
        .gridId = 0,
        .scoreDelta = std.math.minInt(i32),
        .miner = undefined,
        .minerExtIds = undefined,
    };
    for (0..numSolvablePositions) |solveIdx| {
        const gridId = p3.tempSolvablePositions.items[solveIdx].tileId;
        const tile = &p0.tileList.items[gridId];
        findP3OptimalMiner(
            roid,
            p0,
            gridId,
            tile,
            island,
            &simpleChoice,
            null,
            &p0.tempBitSets[3],
            &p0.tempBitSets[4],
        );
    }
    try p3.result.addChoice(&simpleChoice);

    const simpleChoiceOccup = &p0.tempBitSets[2];
    bh.copyInto(simpleChoiceOccup, &p0.occupancy);
    occupy(p0, &simpleChoice, simpleChoiceOccup);

    // this is the best solution for this position, however, if it creates a disconnected island, we should check adjacent positions for better solutions
    const tempBitSet2 = &p0.tempBitSets[3];
    bh.copyInto(tempBitSet2, island);
    deoccupy(p0, &simpleChoice, tempBitSet2);
    const newNumIslands = countIslands(p0, simpleChoiceOccup, tempBitSet2);
    if (newNumIslands <= 1) {
        // Solution does not split the island, accept.
        bh.copyInto(&p0.occupancy, simpleChoiceOccup);
        deoccupy(p0, &simpleChoice, island);
        deoccupy(p0, &simpleChoice, p3.nextIslandCandidateTiles);
        return true;
    }

    bh.copyInto(tempBitSet2, island);
    deoccupy(p0, &simpleChoice, tempBitSet2);
    const tempBitSet3 = &p0.tempBitSets[4];
    // try to find an alternative solution which covers the islands (except for the largest one) left behind by the simple solution.
    var maxIslandSize: usize = 0;
    var maxIslandIdx: usize = 0;
    var anyIslandSkipped: bool = false;
    var altSolutionPossible: bool = true;
    var altMustHitIds: [14]u32 = undefined;
    var numMustHitIds: usize = 0;
    while (findIsland(p0, tempBitSet3, tempBitSet2)) {
        const islandSize = tempBitSet3.count();
        if (islandSize >= altMustHitIds.len) {
            // impossible to cover in one move / can accept at least one more whole center-miner -> ignore
            continue;
        }
        if (islandSize + numMustHitIds > altMustHitIds.len) {
            if (anyIslandSkipped) {
                // only allow one of the small islands to be uncovered.
                altSolutionPossible = false;
                break;
            }
            anyIslandSkipped = true;
            if (maxIslandSize > islandSize) {
                // remove the maxIsland
                const maxIslandEnd = maxIslandIdx + maxIslandSize;
                if (numMustHitIds > maxIslandEnd) {
                    const numToMove = numMustHitIds - maxIslandEnd;
                    @memcpy(altMustHitIds[maxIslandIdx..(maxIslandIdx + numToMove)], altMustHitIds[maxIslandEnd..(maxIslandEnd + numToMove)]);
                }
                numMustHitIds -= maxIslandSize;
                // fall through to copying the island tiles into altMustHitIds
            } else {
                // skip this island
                continue;
            }
        }

        if (islandSize > maxIslandSize) {
            maxIslandSize = islandSize;
            maxIslandIdx = numMustHitIds;
        }

        var islandIter = tempBitSet3.iterator(.{});
        while (islandIter.next()) |id| {
            altMustHitIds[numMustHitIds] = @intCast(id);
            numMustHitIds += 1;
        }
    }

    if (!altSolutionPossible or numMustHitIds <= 0) {
        // not worth checking for alt solution, islands are too large, accept simple solution
        bh.copyInto(&p0.occupancy, simpleChoiceOccup);
        p3.nextIslandCandidateTiles.setUnion(island.*);
        // signal that the island was split and a new island must be searched
        p3.currentIslandTiles = null;
        deoccupy(p0, &simpleChoice, p3.nextIslandCandidateTiles);
        return true;
    }

    const minI32: i32 = std.math.minInt(i32);
    var altChoice = Phase3OptimizationChoice{
        .gridId = 0,
        .scoreDelta = minI32,
        .miner = undefined,
        .minerExtIds = undefined,
    };
    const altTile = &p0.tileList.items[simpleChoice.gridId];
    for (dir.cityBlockLessEq3) |checkOffset| {
        if (asteroid.encode(roid, @as(i32, @intCast(altTile.x)) + checkOffset.x, @as(i32, @intCast(altTile.y)) + checkOffset.y)) |encId| {
            const checkId = p0.tileIdsByEnc[encId];
            if (checkId == maxU32)
                continue;

            const checkTile = &p0.tileList.items[checkId];
            if (checkTile.nIds.len < 4)
                continue; // cannot place a '+' here.

            findP3OptimalMiner(
                roid,
                p0,
                checkId,
                checkTile,
                island,
                &altChoice,
                altMustHitIds[0..numMustHitIds],
                &p0.tempBitSets[3],
                &p0.tempBitSets[4],
            );
        }
    }
    if (altChoice.scoreDelta > minI32) {
        // found an alternative solution which covers the altMustHitIds.
        // -> evaluate quality (count islands)
        bh.copyInto(tempBitSet2, island);
        deoccupy(p0, &altChoice, tempBitSet2);
        bh.copyInto(tempBitSet3, &p0.occupancy);
        occupy(p0, &altChoice, tempBitSet3);
        const altNumIslands = countIslands(p0, tempBitSet3, tempBitSet2);
        if (altNumIslands <= 1) {
            // Alt-Solution does not split the island, accept.
            bh.copyInto(&p0.occupancy, tempBitSet3);
            deoccupy(p0, &altChoice, island);
            deoccupy(p0, &altChoice, p3.nextIslandCandidateTiles);
            try p3.result.addUndo();
            try p3.result.addChoice(&altChoice);
            return true;
        }
    }

    // We still have not found a solution that does not split the island, try backtracking once.
    const nowNumChoices = p3.result.committedChoices.len;
    if (nowNumChoices <= (p3.currentIslandInitialNumChoices + 1)) {
        // cannot backtrack because there is no choice to undo (for this current island)
        // accept simpleChoice
        bh.copyInto(&p0.occupancy, simpleChoiceOccup);
        p3.nextIslandCandidateTiles.setUnion(island.*);
        // signal that the island was split and a new island must be searched
        p3.currentIslandTiles = null;
        deoccupy(p0, &simpleChoice, p3.nextIslandCandidateTiles);
        return true;
    }

    const prevChoice = &p3.result.committedChoices[nowNumChoices - 2];
    std.debug.assert(prevChoice.occupy == 1); // can not be an "undo" choice, because for every undo a new choice is pushed immediately after.
    deoccupy(p0, &prevChoice.choice, &p0.occupancy);

    var updatedPrevChoice = prevChoice.choice; // creates a copy
    var updatedChoice = simpleChoice;
    if (try optimizeP3ChoiceExhaustive(
        alloc,
        roid,
        p0,
        &updatedPrevChoice,
        &updatedChoice,
        altMustHitIds[0..numMustHitIds],
        tempBitSet2,
        tempBitSet3,
        &p0.tempBitSets[5],
    )) {
        try p3.result.addUndo();
        try p3.result.addUndo();
        try p3.result.addChoice(&updatedPrevChoice);
        try p3.result.addChoice(&updatedChoice);

        // exhaustive search found a solution that leaves 0 or 1 island. (either by covering the other islands, or by leaving gaps such that they are connected)
        occupy(p0, &prevChoice.choice, island);
        occupy(p0, &prevChoice.choice, p3.nextIslandCandidateTiles);
        deoccupy(p0, &updatedPrevChoice, island);
        deoccupy(p0, &updatedPrevChoice, p3.nextIslandCandidateTiles);
        deoccupy(p0, &updatedChoice, island);
        deoccupy(p0, &updatedChoice, p3.nextIslandCandidateTiles);

        occupy(p0, &updatedPrevChoice, &p0.occupancy);
        occupy(p0, &updatedChoice, &p0.occupancy);
        return true;
    }

    // It seems the split cannot be avoided, accept simpleChoice.
    bh.copyInto(&p0.occupancy, simpleChoiceOccup);
    p3.nextIslandCandidateTiles.setUnion(island.*);
    // signal that the island was split and a new island must be searched
    p3.currentIslandTiles = null;
    deoccupy(p0, &simpleChoice, p3.nextIslandCandidateTiles);
    return true;
}

/// Packs 4 rotations into a u8
pub const FourRotations = packed struct(u8) {
    a: dt.Rotation,
    b: dt.Rotation,
    c: dt.Rotation,
    d: dt.Rotation,
};

pub const TileRotations = struct {
    // packing 4 ids into one index is awkward, but reduces the memory usage for an average sized solution by 600 Bytes.
    // Arguably not worth it, reduces total solver memory usage by 2% at best (testBp1 = 42kB). Oh well..
    rotationsByTileId: []FourRotations,

    const Self = @This();
    pub fn put(self: *Self, tileId: u32, rot: dt.Rotation) void {
        const wordIdx = @divTrunc(tileId, 4);
        var word = &self.rotationsByTileId[wordIdx];
        switch (tileId & 0b11) {
            0 => word.a = rot,
            1 => word.b = rot,
            2 => word.c = rot,
            3 => word.d = rot,
            else => unreachable,
        }
    }
    pub fn get(self: *const Self, tileId: u32) dt.Rotation {
        const wordIdx = @divTrunc(tileId, 4);
        const word = &self.rotationsByTileId[wordIdx];
        return switch (tileId & 0b11) {
            0 => word.a,
            1 => word.b,
            2 => word.c,
            3 => word.d,
            else => unreachable,
        };
    }
};

/// Figures out the rotation of each tile for a given solution
pub fn findRotations(
    alloc: std.mem.Allocator,
    roid: *const asteroid.Asteroid,
    p0: *const Phase0Data,
    p1: *const Phase1Data,
    p2: *const Phase2Data,
    p3: *const Phase3Data,
) !*TileRotations {
    var result = try alloc.create(TileRotations);
    if (p0.tileList.items.len <= 0) {
        result.rotationsByTileId = &[0]FourRotations{};
        return result;
    }

    result.rotationsByTileId = try alloc.alloc(FourRotations, @divTrunc(p0.tileList.items.len - 1, 4) + 1);
    for (0.., p1.edgeMinerChoices) |i, c| {
        try resolveEdgeMinerTileRotations(roid, p0, i, c, result);
    }
    for (p2.updatedEdges.items) |update| {
        if (update.occupy == 1) {
            try resolveEdgeMinerTileRotations(roid, p0, update.edgeId, update.encChoice, result);
        }
    }
    for (p3.committedChoices) |c| {
        if (c.occupy == 1) {
            try resolveCenterMinerTileRotations(p0, c.choice.gridId, c.choice.miner, &c.choice.minerExtIds, result);
        }
    }
    return result;
}

pub const SolutionStats = struct {
    numEdgeMiners: i32,
    numCenterMiners: i32,
    gapTiles: i32,
    gapIslands: i32,
};

pub fn calcStats(
    p0: *Phase0Data,
    p1: *const Phase1Data,
    p2: *const Phase2Data,
    p3: *const Phase3Data,
) SolutionStats {
    const numP1Gaps: i32 = countEdgeChoiceGaps(p1.edgeMinerChoices, p0.numEdges);
    var numP2Gaps: i32 = 0;
    for (p2.updatedEdges.items) |*update| {
        if (update.occupy == 0) {
            numP2Gaps += 1;
        } else if (update.occupy == 1) {
            numP2Gaps -= 1;
        }
    }
    const numEdgeMiners: i32 = @as(i32, @intCast(p0.numEdges)) - numP1Gaps - numP2Gaps;

    var numCenterMiners: i32 = 0;
    for (p3.committedChoices) |p3Choice| {
        if (p3Choice.occupy == 1) {
            numCenterMiners += 1;
        } else {
            numCenterMiners -= 1;
        }
    }

    const numGaps = @as(i32, @intCast(p0.occupancy.capacity())) - @as(i32, @intCast(p0.occupancy.count()));

    const tempBitSet = &p0.tempBitSets[0];
    bh.copyInto(tempBitSet, &p0.occupancy);
    tempBitSet.toggleAll();
    const numGapIslands = countIslands(p0, &p0.occupancy, tempBitSet);

    return SolutionStats{
        .numEdgeMiners = numEdgeMiners,
        .numCenterMiners = numCenterMiners,
        .gapTiles = numGaps,
        .gapIslands = @as(i32, @intCast(numGapIslands)),
    };
}

fn resolveEdgeMinerTileRotations(
    roid: *const asteroid.Asteroid,
    p0: *const Phase0Data,
    edgeTileId: usize,
    encChoice: u32,
    result: *TileRotations,
) !void {
    var tempMinoIds: [4]u32 = undefined;
    const decodeOk = decodeTetrominoLayout(roid, p0, edgeTileId, &p0.tileList.items[edgeTileId], encChoice, &tempMinoIds);
    if (!decodeOk) {
        // almost certainly a skipped edge tile, ignore.
        return;
    }

    const xMid: u32 = roid.maxX / 2;
    const yMid: u32 = roid.maxY / 2;
    const minerTile = &p0.tileList.items[tempMinoIds[0]];
    const dx: u32 = if (minerTile.x >= xMid) (minerTile.x - xMid) else (xMid - minerTile.x);
    const dy: u32 = if (minerTile.y >= yMid) (minerTile.y - yMid) else (yMid - minerTile.y);
    var priorityRotations: [4]dt.Rotation = undefined;
    if (dx > dy) {
        priorityRotations = .{ .east, .west, .north, .south };
    } else {
        priorityRotations = .{ .north, .south, .east, .west };
    }
    var minerRot: ?dt.Rotation = null;
    for (priorityRotations) |rot| {
        const d = dir.cardinals[@intFromEnum(rot) +% 1];
        const nX = @as(i32, @intCast(minerTile.x)) + d.x;
        const nY = @as(i32, @intCast(minerTile.y)) + d.y;
        const encId = asteroid.encode(roid, nX, nY);
        if (encId == null) {
            // off-bounding-box neighbor -> valid direction for belt
            minerRot = rot;
            break;
        }
        const extId = p0.tileIdsByEnc[encId.?];
        if (extId == maxU32) {
            // off-roid neighbor -> valid direction for belt
            minerRot = rot;
            break;
        }
    }
    if (minerRot == null) {
        return error.impossibleEdgeMiner; // this would indicate edge-detection has catastrophically failed, or the choice->tiles mapping is wrong
    }

    result.put(tempMinoIds[0], minerRot.?);
    try resolveMinerExtRotations(p0, minerTile, tempMinoIds[1..], result);
}

fn resolveCenterMinerTileRotations(
    p0: *const Phase0Data,
    centerGridId: u32,
    miner: *const tet.CenterMinerInfo,
    minerExtIds: *const [9]u32,
    result: *TileRotations,
) !void {
    // beware: solver.north = 0, but blueprint.north = 3
    const liftRot: dt.Rotation = @enumFromInt((miner.dir +% 3) & 0b11);
    const liftRotNum: u2 = @intFromEnum(liftRot);
    const centerTile = &p0.tileList.items[centerGridId];

    const minerTileIds: [3]u32 = .{
        centerTile.nIds[(miner.dir + 1) & 0b11],
        centerTile.nIds[(miner.dir + 2) & 0b11],
        centerTile.nIds[(miner.dir + 3) & 0b11],
    };

    result.put(centerGridId, liftRot); // center
    result.put(centerTile.nIds[miner.dir & 0b11], liftRot); // lift
    result.put(minerTileIds[0], @enumFromInt(liftRotNum +% 3)); // first clockwise miner
    result.put(minerTileIds[1], @enumFromInt(liftRotNum)); // second clockwise miner
    result.put(minerTileIds[2], @enumFromInt(liftRotNum +% 1)); // third clockwise miner
    try resolveMinerExtRotations(p0, &p0.tileList.items[minerTileIds[0]], minerExtIds[0..3], result);
    try resolveMinerExtRotations(p0, &p0.tileList.items[minerTileIds[1]], minerExtIds[3..6], result);
    try resolveMinerExtRotations(p0, &p0.tileList.items[minerTileIds[2]], minerExtIds[6..9], result);
}

fn resolveMinerExtRotations(
    p0: *const Phase0Data,
    minerTile: *const Tile,
    extIds: *const [3]u32,
    result: *TileRotations,
) !void {
    var extTiles: [3]*Tile = undefined;
    for (0..3) |extIdx| {
        extTiles[extIdx] = &p0.tileList.items[extIds[extIdx]];
    }

    var resolvedExtRotations = std.bit_set.IntegerBitSet(3).initEmpty();
    for (0..3) |extIdx| {
        const extDx = vec2i.deltaVec(extTiles[extIdx].x, extTiles[extIdx].y, minerTile.x, minerTile.y);
        if (dt.Rotation.fromCardinalUnitVec(extDx)) |extRot| {
            resolvedExtRotations.set(extIdx);
            result.put(extIds[extIdx], extRot);
        }
    }

    // at most 2 extenders are left to be resolved now, and they will always hook onto one of the resolved extenders, never the miner
    for (0..2) |_| {
        var unresolvedIter = resolvedExtRotations.iterator(.{ .kind = .unset });
        loop: while (unresolvedIter.next()) |unresolvedExtIdx| {
            var resolvedIter = resolvedExtRotations.iterator(.{ .kind = .set });
            while (resolvedIter.next()) |resolvedExtIdx| {
                const extDx = vec2i.deltaVec(
                    extTiles[unresolvedExtIdx].x,
                    extTiles[unresolvedExtIdx].y,
                    extTiles[resolvedExtIdx].x,
                    extTiles[resolvedExtIdx].y,
                );
                if (dt.Rotation.fromCardinalUnitVec(extDx)) |extRot| {
                    resolvedExtRotations.set(unresolvedExtIdx);
                    result.put(extIds[unresolvedExtIdx], extRot);
                    break :loop; // iterators are no longer valid
                }
            }
        }
    }
    if (resolvedExtRotations.count() != 3) {
        return error.impossibleMinerExt;
    }
}

/// Collects a single island from the 'remaining' tiles into the 'accumulator' tiles.
fn findIsland(p0: *Phase0Data, accumulator: *std.DynamicBitSet, remaining: *std.DynamicBitSet) bool {
    accumulator.toggleSet(accumulator.*);
    const anyRem = remaining.findFirstSet();
    if (anyRem == null) {
        return false;
    }

    remaining.unset(anyRem.?);
    accumulator.set(anyRem.?);
    p0.floodFillStack.clear();
    p0.floodFillStack.push(@intCast(anyRem.?));
    while (!p0.floodFillStack.empty()) {
        const posId = p0.floodFillStack.pop();
        const posTile = &p0.tileList.items[posId];
        for (posTile.nIds) |nId| {
            if (remaining.isSet(nId)) {
                remaining.unset(nId);
                accumulator.set(nId);
                p0.floodFillStack.push(nId);
            }
        }
    }
    return true;
}

fn findP3MinScoreTile(p0: *const Phase0Data, unoccupied: *const std.DynamicBitSet) u32 {
    var result: u32 = 0;
    var minScore: i32 = std.math.maxInt(i32);
    var iter = unoccupied.iterator(.{});
    while (iter.next()) |gridId| {
        const gridTile = &p0.tileList.items[gridId];
        var score: i32 = @intCast(gridTile.x + gridTile.y);
        for (gridTile.nIds) |nId| {
            const occup = p0.occupancy.isSet(nId);
            const nTile = &p0.tileList.items[nId];
            for (nTile.nIds) |nId2| {
                if (p0.occupancy.isSet(nId2) == occup) {
                    score += 8;
                } else {
                    score -= 8;
                }
            }
        }
        if (score < minScore) {
            minScore = score;
            result = @intCast(gridId);
        }
    }
    return result;
}

fn findSolvablePositions(roid: *const asteroid.Asteroid, p0: *const Phase0Data, island: *const std.DynamicBitSet, priorityGridId: u32, p3: *Phase3StepData) void {
    const priorityTile = &p0.tileList.items[priorityGridId];
    const prioX: i32 = @intCast(priorityTile.x);
    const prioY: i32 = @intCast(priorityTile.y);
    p3.tempSolvablePositions.numItems = 0;
    const targetSolvablePositions: usize = p3.currentIslandBeamWidth;

    var islandIter = island.iterator(.{});
    while (islandIter.next()) |gridId| {
        const gridTile = &p0.tileList.items[gridId];
        const dx: u32 = @abs(prioX - @as(i32, @intCast(gridTile.x)));
        const dy: u32 = @abs(prioY - @as(i32, @intCast(gridTile.y)));
        const score: u32 = dx + dy;

        // find the 'targetSolvablePositions'-many tiles with minimum score, ascending
        const curNumSolvPositions = p3.tempSolvablePositions.numItems;
        if (curNumSolvPositions < targetSolvablePositions) {
            if (canPlaceAnyCenterMiner(roid, p0, gridId, gridTile)) {
                insertionSortMinAsc(&p3.tempSolvablePositions, @as(u32, @intCast(gridId)), score);
            }
        } else if (score < p3.tempSolvablePositions.items[curNumSolvPositions - 1].score) {
            if (canPlaceAnyCenterMiner(roid, p0, gridId, gridTile)) {
                // evict the last item
                p3.tempSolvablePositions.numItems -= 1;
                insertionSortMinAsc(&p3.tempSolvablePositions, @as(u32, @intCast(gridId)), score);
            }
        }
    }
}

fn canPlaceAnyCenterMiner(roid: *const asteroid.Asteroid, p0: *const Phase0Data, gridId: usize, tile: *const Tile) bool {
    // check the '+' piece early since it's shared across all miners. This can avoid an expensive search.
    if (p0.occupancy.isSet(gridId))
        return false;
    if (tile.nIds.len < 4)
        return false; // cannot place a '+' here due to asteroid edges
    for (tile.nIds) |nId| {
        if (p0.occupancy.isSet(nId)) {
            return false; // cannot place a '+' here due to occupancy
        }
    }

    for (tet.getAllCenterMiners()) |miner| {
        if (canPlaceIgnorePlus(roid, p0, tile, miner)) {
            return true;
        }
    }
    return false;
}

fn canPlaceFetchExtIds(roid: *const asteroid.Asteroid, p0: *const Phase0Data, gridId: usize, tile: *const Tile, miner: *const tet.CenterMinerInfo, outExtIds: *[9]u32) bool {
    if (p0.occupancy.isSet(gridId))
        return false;
    if (tile.nIds.len < 4)
        return false;
    for (tile.nIds) |nId| {
        if (p0.occupancy.isSet(nId)) {
            return false;
        }
    }
    return canPlaceIgnorePlusFetchExtIds(roid, p0, tile, miner, outExtIds);
}

/// checks if the given CenterMiner can be placed at the gridId. Ignores the center '+' piece. (caller must check)
fn canPlaceIgnorePlus(roid: *const asteroid.Asteroid, p0: *const Phase0Data, tile: *const Tile, miner: *const tet.CenterMinerInfo) bool {
    for (miner.offsets) |extOffset| {
        const x: i32 = @as(i32, @intCast(extOffset.x)) + @as(i32, @intCast(tile.x));
        const y: i32 = @as(i32, @intCast(extOffset.y)) + @as(i32, @intCast(tile.y));
        const encId = asteroid.encode(roid, x, y);
        if (encId == null)
            return false;
        const extId = p0.tileIdsByEnc[encId.?];
        if (extId == maxU32)
            return false;
        if (p0.occupancy.isSet(extId))
            return false;
    }
    return true;
}

fn canPlaceIgnorePlusFetchExtIds(roid: *const asteroid.Asteroid, p0: *const Phase0Data, tile: *const Tile, miner: *const tet.CenterMinerInfo, outExtIds: *[9]u32) bool {
    for (miner.offsets, 0..) |extOffset, i| {
        const x: i32 = @as(i32, @intCast(extOffset.x)) + @as(i32, @intCast(tile.x));
        const y: i32 = @as(i32, @intCast(extOffset.y)) + @as(i32, @intCast(tile.y));
        const encId = asteroid.encode(roid, x, y);
        if (encId == null)
            return false;
        const extId = p0.tileIdsByEnc[encId.?];
        if (extId == maxU32)
            return false;
        if (p0.occupancy.isSet(extId))
            return false;

        outExtIds[i] = extId;
    }
    return true;
}

fn fetchExtIds(roid: *const asteroid.Asteroid, p0: *const Phase0Data, tile: *const Tile, miner: *const tet.CenterMinerInfo, outExtIds: *[9]u32) bool {
    for (miner.offsets, 0..) |extOffset, i| {
        const x: i32 = @as(i32, @intCast(extOffset.x)) + @as(i32, @intCast(tile.x));
        const y: i32 = @as(i32, @intCast(extOffset.y)) + @as(i32, @intCast(tile.y));
        const encId = asteroid.encode(roid, x, y);
        if (encId == null)
            return false;
        const extId = p0.tileIdsByEnc[encId.?];
        if (extId == maxU32)
            return false;

        outExtIds[i] = extId;
    }
    return true;
}

fn insertionSortMinAsc(result: *dt.FixedList(TileAndScore), gridId: u32, score: u32) void {
    const numItems = result.numItems;
    result.numItems += 1;
    for (0..numItems) |i| {
        if (score < result.items[i].score) {
            var i_2: usize = numItems;
            while (i_2 > i) : (i_2 -= 1) {
                result.items[i_2] = result.items[i_2 - 1];
            }
            result.items[i] = .{
                .score = score,
                .tileId = gridId,
            };
            return;
        }
    }
    result.items[numItems] = .{
        .score = score,
        .tileId = gridId,
    };
}

fn findP3OptimalMiner(
    roid: *const asteroid.Asteroid,
    p0: *Phase0Data,
    gridId: u32,
    tile: *const Tile,
    island: *std.DynamicBitSet,
    p3Choice: *Phase3OptimizationChoice,
    mustHitIds: ?[]u32,
    tempOccupancy: *std.DynamicBitSet,
    tempBitSet: *std.DynamicBitSet,
) void {
    var extIds: [9]u32 = undefined;
    for (tet.getAllCenterMiners()) |miner| {
        if (!canPlaceFetchExtIds(roid, p0, gridId, tile, miner, &extIds)) {
            continue;
        }

        // found a solution -> check quality
        // Optimization: checking the score change is O(14) vs computing the grid score O(grid.size)

        // we can compute the updated score based on the previous score and the flipped bits:
        // there are up to 5 affected tiles
        // for 4 neighbors:
        //   +2 score if the new tile matches the neighbor
        //   -2 score if the new tile doesn't
        // for the self-tile:
        //   for every previously matching neighbor: -2 score
        //   for every previously wrong neighbor: +2 score

        // that can be simplified even further:
        // for 4 neighbors:
        //   +4 score if the new tile matches
        //   -4 score if the new tile doesn't

        bh.copyInto(tempOccupancy, &p0.occupancy);
        var score = calculateScoreDelta(p0, gridId, tile, &extIds, tempOccupancy);
        if (score <= p3Choice.scoreDelta)
            continue;

        if (mustHitIds != null) {
            // tempOccupancy contains the center-miner due to calculateScoreDelta -> reuse.
            var allHit: bool = true;
            for (mustHitIds.?) |mustHitId| {
                if (!tempOccupancy.isSet(mustHitId)) {
                    allHit = false;
                    break;
                }
            }
            if (!allHit)
                continue;
        }

        score = applyP3ScorePenalties(
            roid,
            p0,
            tempOccupancy,
            island,
            tempBitSet,
            gridId,
            tile,
            &extIds,
            score,
            p3Choice.scoreDelta,
        );
        if (score <= p3Choice.scoreDelta)
            continue;

        p3Choice.scoreDelta = score;
        p3Choice.gridId = gridId;
        p3Choice.miner = miner;
        @memcpy(p3Choice.minerExtIds[0..], extIds[0..]);
    }
}

/// tempOccupancy : must contain the current occupancy. During execution the center-miner will be added
fn calculateScoreDelta(p0: *const Phase0Data, gridId: u32, tile: *const Tile, extIds: *const [9]u32, tempOccupancy: *std.DynamicBitSet) i32 {
    tempOccupancy.set(gridId);
    var score: i32 = -16;

    for (tile.nIds) |nId| {
        const nTile = &p0.tileList.items[nId];
        for (nTile.nIds) |nId2| {
            if (tempOccupancy.isSet(nId2)) {
                score += 4;
            } else {
                score -= 4;
            }
        }
        tempOccupancy.set(nId);
    }

    for (extIds) |extId| {
        const extTile = &p0.tileList.items[extId];
        for (extTile.nIds) |nId2| {
            if (tempOccupancy.isSet(nId2)) {
                score += 4;
            } else {
                score -= 4;
            }
        }
        tempOccupancy.set(extId);
    }

    return score;
}

fn applyP3ScorePenalties(
    roid: *const asteroid.Asteroid,
    p0: *Phase0Data,
    occupancy: *const std.DynamicBitSet,
    island: *const std.DynamicBitSet,
    tempBitSet: *std.DynamicBitSet,
    gridId: u32,
    tile: *const Tile,
    extIds: *const [9]u32,
    score: i32,
    maxScore: i32,
) i32 {
    // the current score metric creates poor/impossible shapes relatively frequently, but checking for it is expensive
    // so all checks are extracted into this separate step to run only if the score is high

    var updatedScore = score;
    if (createsImpossibleLayout(roid, p0, occupancy, tile, extIds)) {
        updatedScore -= 50;
        if (updatedScore < maxScore)
            return updatedScore;
    }

    for (extIds) |extId| {
        const extTile = &p0.tileList.items[extId];
        updatedScore += calculateChokePointPenalty(p0, occupancy, extTile);
    }
    for (tile.nIds) |nId| {
        const nTile = &p0.tileList.items[nId];
        updatedScore += calculateChokePointPenalty(p0, occupancy, nTile);
    }
    if (updatedScore < maxScore)
        return updatedScore;

    // apply a penalty for 4-tall corridors of 1 or 2 wide
    if (causes2x4Corridor(roid, p0, occupancy, extIds)) {
        updatedScore -= 20;
        if (updatedScore < maxScore)
            return updatedScore;
    }
    if (causes2x4Corridor(roid, p0, occupancy, tile.nIds)) {
        updatedScore -= 20;
        if (updatedScore < maxScore)
            return updatedScore;
    }

    // check if the placement splits the island into 2 (or more)
    bh.copyInto(tempBitSet, island);
    tempBitSet.unset(gridId);
    for (tile.nIds) |nId| {
        tempBitSet.unset(nId);
    }
    for (extIds) |extId| {
        tempBitSet.unset(extId);
    }
    if (hasDisconnectedIsland(p0, occupancy, tempBitSet)) {
        updatedScore -= 30;
    }
    return updatedScore;
}

fn createsImpossibleLayout(roid: *const asteroid.Asteroid, p0: *const Phase0Data, occupancy: *const std.DynamicBitSet, tile: *const Tile, extIds: *const [9]u32) bool {
    return _createsImpossibleLayout(roid, p0, occupancy, extIds) or _createsImpossibleLayout(roid, p0, occupancy, tile.nIds);
}

fn _createsImpossibleLayout(roid: *const asteroid.Asteroid, p0: *const Phase0Data, occupancy: *const std.DynamicBitSet, checkGridIds: []const u32) bool {
    // x..
    // ...
    // ..x
    // the center presents a chokepoint
    // if either end cannot contain a Center-Miner, then this space will never be filled

    for (checkGridIds) |checkId| {
        const checkTile = &p0.tileList.items[checkId];
        if (checkTile.x + 2 <= roid.maxX) {
            if (checkTile.y + 2 <= roid.maxY) {
                if (_createsImpossibleLayout_directed(
                    roid,
                    p0,
                    occupancy,
                    @as(i32, @intCast(checkTile.x)),
                    @as(i32, @intCast(checkTile.y)),
                    2,
                    2,
                )) {
                    return true;
                }
            }
            if (checkTile.y >= 2) {
                if (_createsImpossibleLayout_directed(
                    roid,
                    p0,
                    occupancy,
                    @as(i32, @intCast(checkTile.x)),
                    @as(i32, @intCast(checkTile.y)) - 2,
                    2,
                    0,
                )) {
                    return true;
                }
            }
        }
        if (checkTile.x >= 2) {
            if (checkTile.y + 2 <= roid.maxY) {
                if (_createsImpossibleLayout_directed(
                    roid,
                    p0,
                    occupancy,
                    @as(i32, @intCast(checkTile.x)) - 2,
                    @as(i32, @intCast(checkTile.y)),
                    0,
                    2,
                )) {
                    return true;
                }
            }
            if (checkTile.y >= 2) {
                if (_createsImpossibleLayout_directed(
                    roid,
                    p0,
                    occupancy,
                    @as(i32, @intCast(checkTile.x)) - 2,
                    @as(i32, @intCast(checkTile.y)) - 2,
                    0,
                    0,
                )) {
                    return true;
                }
            }
        }
    }
    return false;
}

inline fn _createsImpossibleLayout_directed(roid: *const asteroid.Asteroid, p0: *const Phase0Data, occupancy: *const std.DynamicBitSet, xInit: i32, yInit: i32, occXi: i32, occYi: i32) bool {
    for (0..3) |xi| {
        const x = xInit + @as(i32, @intCast(xi));
        for (0..3) |yi| {
            const y = yInit + @as(i32, @intCast(yi));
            const encPos = asteroid.encodeUnsafe(roid, x, y);
            const posId = p0.tileIdsByEnc[encPos];
            if (posId == maxU32)
                return false;

            const expectOccupied = (xi == occXi and yi == occYi) or (xi == (2 - occXi) and yi == (2 - occYi));
            if (occupancy.isSet(posId) != expectOccupied) {
                return false;
            }
        }
    }
    return true;
}

fn calculateChokePointPenalty(p0: *const Phase0Data, occupancy: *const std.DynamicBitSet, tile: *const Tile) i32 {
    var penalty: i32 = 0;
    loop: for (tile.nIds) |checkId| {
        if (occupancy.isSet(checkId))
            continue;

        var numEmptyNeighbors: usize = 0;
        var checkNId: u32 = 0;
        for (p0.tileList.items[checkId].nIds) |nId| {
            if (!occupancy.isSet(nId)) {
                checkNId = nId;
                numEmptyNeighbors += 1;
                if (numEmptyNeighbors > 1)
                    continue :loop;
            }
        }
        if (numEmptyNeighbors == 0)
            continue;

        numEmptyNeighbors = 0;
        for (p0.tileList.items[checkNId].nIds) |nId| {
            if (!occupancy.isSet(nId)) {
                numEmptyNeighbors += 1;
                if (numEmptyNeighbors > 2)
                    continue :loop;
            }
        }

        if (numEmptyNeighbors == 2)
            penalty -= 4;
    }
    return penalty;
}

fn causes2x4Corridor(roid: *const asteroid.Asteroid, p0: *const Phase0Data, occupancy: *const std.DynamicBitSet, checkIds: []const u32) bool {
    for (checkIds) |checkId| {
        const checkTile = &p0.tileList.items[checkId];
        for (dir.cardinals) |checkDir| {
            if (_causes2x4Corridor(roid, p0, occupancy, checkTile, checkDir))
                return true;
        }
    }
    return false;
}

fn _causes2x4Corridor(roid: *const asteroid.Asteroid, p0: *const Phase0Data, occupancy: *const std.DynamicBitSet, checkTile: *const Tile, checkDir: vec2i.Vector2I) bool {
    // first verify that the current tile matches x_x or x__x
    // assume that checkTile is occupied
    if (!_check2x4CorridorRow(roid, p0, occupancy, @intCast(checkTile.x), @intCast(checkTile.y), checkDir))
        return false;

    // then verify that the pattern can grow to ""height"" 4
    var curHeight: u8 = 1;
    // try growing ""up""
    var x: i32 = @intCast(checkTile.x);
    var y: i32 = @intCast(checkTile.y);
    for (0..3) |_| {
        x -= checkDir.y; // intentional x/y swap
        y -= checkDir.x; // intentional x/y swap
        if (!_check2x4CorridorRowIncSelf(roid, p0, occupancy, x, y, checkDir)) {
            break;
        } else {
            curHeight += 1;
        }
    }
    if (curHeight >= 4) {
        return true;
    }

    // try growing ""down""
    x = @intCast(checkTile.x);
    y = @intCast(checkTile.y);
    const numChecks = 4 - curHeight;
    for (0..numChecks) |_| {
        x += checkDir.y; // intentional x/y swap
        y += checkDir.x; // intentional x/y swap
        if (!_check2x4CorridorRowIncSelf(roid, p0, occupancy, x, y, checkDir)) {
            return false;
        }
    }
    return true;
}

fn _check2x4CorridorRow(roid: *const asteroid.Asteroid, p0: *const Phase0Data, occupancy: *const std.DynamicBitSet, xi: i32, yi: i32, checkDir: vec2i.Vector2I) bool {
    var x: i32 = xi;
    var y: i32 = yi;
    for (0..3) |i| {
        x += checkDir.x;
        y += checkDir.y;
        const encPos = asteroid.encode(roid, x, y);
        if (encPos == null)
            return false;
        const posId = p0.tileIdsByEnc[encPos.?];
        if (posId == maxU32)
            return false;

        const occupied = occupancy.isSet(posId);
        if (i == 0 and occupied)
            return false;
        if (occupied)
            return true;
    }
    return false;
}

fn _check2x4CorridorRowIncSelf(roid: *const asteroid.Asteroid, p0: *const Phase0Data, occupancy: *const std.DynamicBitSet, x: i32, y: i32, checkDir: vec2i.Vector2I) bool {
    const encPos = asteroid.encode(roid, x, y);
    if (encPos == null)
        return false;
    const posId = p0.tileIdsByEnc[encPos.?];
    if (posId == maxU32)
        return false;
    if (!occupancy.isSet(posId))
        return false;

    return _check2x4CorridorRow(roid, p0, occupancy, x, y, checkDir);
}

/// occupancy - the current occupancy
/// tempCheckPoints - the set of unvisited tiles that are being optimized. Not necessarily the same as "not(occupancy)".
/// returns: true if more than one island
fn hasDisconnectedIsland(p0: *Phase0Data, occupancy: *const std.DynamicBitSet, tempCheckPoints: *std.DynamicBitSet) bool {
    const firstSet = tempCheckPoints.findFirstSet();
    if (firstSet == null)
        return false;

    floodFill(p0, tempCheckPoints, occupancy, @intCast(firstSet.?));
    return tempCheckPoints.findFirstSet() != null;
}

/// floodFills by unsetting all tiles in 'unvisited' that can be reached from 'startId'
fn floodFill(p0: *Phase0Data, unvisited: *std.DynamicBitSet, occupancy: *const std.DynamicBitSet, startId: u32) void {
    // assert unvisited.isSet(startId)

    p0.floodFillStack.clear();
    unvisited.unset(startId);
    p0.floodFillStack.push(startId);
    while (!p0.floodFillStack.empty()) {
        const posId = p0.floodFillStack.pop();
        const posTile = &p0.tileList.items[posId];
        for (posTile.nIds) |nId| {
            if (!unvisited.isSet(nId))
                continue;
            if (occupancy.isSet(nId))
                continue;
            unvisited.unset(nId);
            p0.floodFillStack.push(nId);
        }
    }
}

fn occupy(p0: *const Phase0Data, choice: *const Phase3OptimizationChoice, occupancy: *std.DynamicBitSet) void {
    const tile = &p0.tileList.items[choice.gridId];

    occupancy.set(choice.gridId);
    for (tile.nIds) |nId| {
        occupancy.set(nId);
    }
    for (choice.minerExtIds) |extId| {
        occupancy.set(extId);
    }
}

fn deoccupy(p0: *const Phase0Data, choice: *const Phase3OptimizationChoice, occupancy: *std.DynamicBitSet) void {
    const tile = &p0.tileList.items[choice.gridId];

    occupancy.unset(choice.gridId);
    for (tile.nIds) |nId| {
        occupancy.unset(nId);
    }
    for (choice.minerExtIds) |extId| {
        occupancy.unset(extId);
    }
}

pub fn countIslands(p0: *Phase0Data, occupancy: *const std.DynamicBitSet, tempUnvisited: *std.DynamicBitSet) usize {
    var numIslands: usize = 0;
    while (tempUnvisited.findFirstSet()) |checkId| {
        floodFill(p0, tempUnvisited, occupancy, @intCast(checkId));
        numIslands += 1;
    }
    return numIslands;
}

const PositionAndChoices = struct {
    id: u32,
    tile: *const Tile,
    miners: dt.FixedList(*const tet.CenterMinerInfo),
};

fn optimizeP3ChoiceExhaustive(
    alloc: std.mem.Allocator,
    roid: *const asteroid.Asteroid,
    p0: *Phase0Data,
    choice1: *Phase3OptimizationChoice,
    choice2: *Phase3OptimizationChoice,
    mustHitIds: []const u32,
    tempVisitable: *std.DynamicBitSet,
    tempBitSet: *std.DynamicBitSet,
    tempIslandEscapeIds: *std.DynamicBitSet,
) !bool {
    // compute which tiles "can" (must / are supposed to) be visited
    tempVisitable.toggleSet(tempVisitable.*);
    for (mustHitIds) |id| {
        tempVisitable.set(id);
    }
    occupy(p0, choice1, tempVisitable);
    occupy(p0, choice2, tempVisitable);

    // compute the neighbors of the visitable tiles which are unoccupied -> these are island-exits
    // if all created islands connect to these escape ids, then no extra island was created in total
    tempIslandEscapeIds.toggleSet(tempIslandEscapeIds.*);
    var visitIter = tempVisitable.iterator(.{});
    while (visitIter.next()) |visitId| {
        const tile = &p0.tileList.items[visitId];
        for (tile.nIds) |nId| {
            if (tempVisitable.isSet(nId))
                continue;
            if (p0.occupancy.isSet(nId))
                continue;
            tempIslandEscapeIds.set(nId);
        }
    }

    // construct a pseudo-occupied set by negation of the current target tiles
    bh.copyInto(tempBitSet, tempVisitable);
    tempBitSet.toggleAll();
    var solvPosBuffer: [64]PositionAndChoices = undefined;
    var solvablePositions = dt.FixedList(PositionAndChoices){
        .items = solvPosBuffer[0..64],
        .numItems = 0,
    };
    try findAllP3SolvablePositions(alloc, roid, p0, tempBitSet, tempVisitable, &solvablePositions);
    defer {
        for (0..solvablePositions.numItems) |revI| {
            const i = solvablePositions.numItems - (revI + 1);
            alloc.free(solvablePositions.items[i].miners.items);
        }
    }
    var posCombinations = try cb.CombinationBitSet64.init(@intCast(solvablePositions.numItems), 2);
    var extIds1: [9]u32 = undefined;
    var extIds2: [9]u32 = undefined;
    while (posCombinations.next()) |combination| {
        const idx1 = 63 - @clz(combination);
        const idx2 = @ctz(combination);
        const pos1 = &solvablePositions.items[idx1];
        const pos2 = &solvablePositions.items[idx2];

        // verify that neighbors of pos1 do not touch pos2 or its neighbors
        if (testIntersect(pos1.tile.nIds, pos2.id, pos2.tile.nIds))
            continue;

        for (pos1.miners.items) |miner1| {
            // this call never fails, but is still needed to update extIds1
            if (!fetchExtIds(roid, p0, pos1.tile, miner1, &extIds1))
                continue;

            // we already know the '+' piece of miner1 does not overlap the '+' of miner2
            // however: we still must verify that the extenders do not overlap
            if (testIntersect(extIds1[0..], pos2.id, pos2.tile.nIds))
                continue;

            for (pos2.miners.items) |miner2| {
                // this call never fails, but is still needed to update extIds2
                if (!fetchExtIds(roid, p0, pos2.tile, miner2, &extIds2))
                    continue;

                // verify that ext2 does not touch the plus of miner1
                if (testIntersect2(&extIds2, pos1.tile.nIds))
                    continue;

                // lastly verify that ext1 does not touch ext2
                if (testIntersect2(&extIds2, &extIds1))
                    continue;

                // now we should have 2 miners that can be placed on the given constraint
                // we still need to check that all remaining tiles connect to an exit

                if (testExhaustiveSearchSolution(
                    p0,
                    tempVisitable,
                    pos1.id,
                    pos1.tile,
                    &extIds1,
                    pos2.id,
                    pos2.tile,
                    &extIds2,
                    tempIslandEscapeIds,
                    tempBitSet,
                )) {
                    choice1.gridId = pos1.id;
                    choice2.gridId = pos2.id;
                    choice1.miner = miner1;
                    choice2.miner = miner2;
                    choice1.minerExtIds = extIds1;
                    choice2.minerExtIds = extIds2;
                    return true;
                }
            }
        }
    }
    return false;
}

fn findAllP3SolvablePositions(
    alloc: std.mem.Allocator,
    roid: *const asteroid.Asteroid,
    p0: *Phase0Data,
    occupancy: *const std.DynamicBitSet,
    unoccupied: *const std.DynamicBitSet,
    solvablePositions: *dt.FixedList(PositionAndChoices),
) !void {
    var iter = unoccupied.iterator(.{});
    while (iter.next()) |id| {
        try findAllCenterMiners(alloc, roid, p0, id, occupancy, solvablePositions);
    }
}

fn findAllCenterMiners(
    alloc: std.mem.Allocator,
    roid: *const asteroid.Asteroid,
    p0: *Phase0Data,
    id: usize,
    occupancy: *const std.DynamicBitSet,
    solvablePositions: *dt.FixedList(PositionAndChoices),
) !void {
    const tile = &p0.tileList.items[id];
    if (tile.nIds.len < 4)
        return; // cannot place a '+' here due to asteroid edges.
    if (occupancy.isSet(id))
        return; // cannot place a '+' here due to occupancy.
    for (tile.nIds) |nId| {
        if (occupancy.isSet(nId)) {
            return; // cannot place a '+' here due to occupancy.
        }
    }

    var posAccumulator = dt.FixedList(*const tet.CenterMinerInfo){
        .items = try alloc.alloc(*const tet.CenterMinerInfo, 1000), // limits the number of layouts, highly unconstrained tiles make poor optimization targets anyways
        .numItems = 0,
    };
    for (tet.getAllCenterMiners()) |miner| {
        if (canPlaceIgnorePlus(roid, p0, tile, miner)) {
            if (posAccumulator.numItems < posAccumulator.items.len) {
                posAccumulator.add(miner);
            } else {
                break;
            }
        }
    }
    if (posAccumulator.numItems > 0) {
        if (!alloc.resize(posAccumulator.items, posAccumulator.numItems)) {
            return error.accShrinkFailed;
        }
        posAccumulator.items.len = posAccumulator.numItems;
        if (solvablePositions.numItems < solvablePositions.items.len) {
            solvablePositions.add(PositionAndChoices{
                .id = @intCast(id),
                .tile = &p0.tileList.items[id],
                .miners = posAccumulator,
            });
        } else {
            return error.bufferOverflow;
        }
    } else {
        alloc.free(posAccumulator.items);
    }
}

fn testIntersect(ids1: []const u32, id2: u32, nIds2: []const u32) bool {
    for (ids1) |id1| {
        if (id1 == id2)
            return true;
        for (nIds2) |nId2| {
            if (id1 == nId2)
                return true;
        }
    }
    return false;
}

fn testIntersect2(ids1: []const u32, ids2: []const u32) bool {
    for (ids1) |id1| {
        for (ids2) |id2| {
            if (id1 == id2)
                return true;
        }
    }
    return false;
}

/// Returns 'true' if all remaining islands touch any of the 'escape'-Ids.
fn testExhaustiveSearchSolution(
    p0: *Phase0Data,
    searchTiles: *const std.DynamicBitSet,
    id1: u32,
    tile1: *const Tile,
    extIds1: *const [9]u32,
    id2: u32,
    tile2: *const Tile,
    extIds2: *const [9]u32,
    tempIslandEscapeIds: *const std.DynamicBitSet,
    tempBitSet: *std.DynamicBitSet,
) bool {
    const unvisited = tempBitSet;
    bh.copyInto(unvisited, searchTiles);

    unvisited.unset(id1);
    unvisited.unset(id2);
    for (tile1.nIds, tile2.nIds) |nId1, nId2| {
        unvisited.unset(nId1);
        unvisited.unset(nId2);
    }
    for (extIds1, extIds2) |extId1, extId2| {
        unvisited.unset(extId1);
        unvisited.unset(extId2);
    }

    while (unvisited.toggleFirstSet()) |startId| {
        var islandTouchesExit = false;
        p0.floodFillStack.clear();
        p0.floodFillStack.push(@intCast(startId));
        while (!p0.floodFillStack.empty()) {
            const checkId = p0.floodFillStack.pop();
            const checkTile = &p0.tileList.items[checkId];
            for (checkTile.nIds) |nId| {
                if (!unvisited.isSet(nId))
                    continue;
                unvisited.unset(nId);

                if (!islandTouchesExit) {
                    const nTile = &p0.tileList.items[nId];
                    for (nTile.nIds) |n2Id| {
                        if (tempIslandEscapeIds.isSet(n2Id)) {
                            islandTouchesExit = true;
                            break;
                        }
                    }
                }

                p0.floodFillStack.push(nId);
            }
        }

        if (!islandTouchesExit)
            return false;
    }
    return true;
}
