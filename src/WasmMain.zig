const std = @import("std");
const bpParser = @import("./lib/BlueprintParser.zig");
const bpWriter = @import("./lib/BlueprintWriter.zig");
const asteroid = @import("./lib/Asteroid.zig");
const solver = @import("./lib/AsteroidSolver.zig");
const dir = @import("./lib/Direction.zig");
const ProblemCallback = @import("./lib/ProblemCallback.zig");
const dt = @import("./lib/DataTypes.zig");

const msg_allocBytes_outOfMemory: []const u8 = "allocBytes: Out of Memory";
const msg_reportErrorFmt_outOfMemory: []const u8 = "Failed to report error, because the errormessage could not be allocated. See 'fmt' string below (next message)";

var arenaAlloc: std.heap.ArenaAllocator = std.heap.ArenaAllocator.init(std.heap.wasm_allocator);
var alloc: std.mem.Allocator = arenaAlloc.allocator();

extern fn reportError(errPtr: [*]const u8, errLen: usize) void;

extern fn logWarning(msgPtr: [*]const u8, msgLen: usize) void;

extern fn getTimestampMillis() i64;

/// called once per island passed to 'parseBlueprint'. May be called multiple times if tiles are disconnected.
extern fn onAsteroidParsed(jsonPtr: [*]const u8, jsonLen: usize) void;

extern fn onEdgeMinerPlacement(solverId: u32, xCoordsPtr: *const [4]u32, yCoordsPtr: *const [4]u32) void;
extern fn onCenterMinerPlacement(solverId: u32, xCoordsPtr: *const [14]u32, yCoordsPtr: *const [14]u32) void;
extern fn onUndoPlacement(solverId: u32) void;

extern fn onTileRotation(tileX: u32, tileY: u32, rotation: u8) void;
extern fn onStatsComputed(edgeMiners: i32, centerMiners: i32, gapTiles: i32, gapIslands: i32) void;

extern fn onSolutionBpMerged(bpPtr: [*]const u8, bpLen: usize) void;

export fn resetArena() void {
    _ = arenaAlloc.reset(.retain_capacity);
}

fn reportErrorFmt(comptime fmt: []const u8, args: anytype) void {
    if (std.fmt.allocPrint(alloc, fmt, args)) |msg| {
        reportError(msg.ptr, msg.len);
        alloc.free(msg);
    } else |_| {
        reportError(msg_reportErrorFmt_outOfMemory.ptr, msg_reportErrorFmt_outOfMemory.len);
        reportError(fmt.ptr, fmt.len);
    }
}

/// returns the offset of the allocated buffer | or maxInt(u32) if out of memory
export fn allocBytes(len: u32) u32 {
    const buffer = alloc.alloc(u8, len) catch {
        reportError(msg_allocBytes_outOfMemory.ptr, msg_allocBytes_outOfMemory.len);
        return std.math.maxInt(u32);
    };
    return @intFromPtr(buffer.ptr);
}

const JsonOptions = struct {
    parser: bpParser.ParseOptions,
    phase1: solver.Phase1Options,
    phase2: solver.Phase2Options,
    phase3: solver.Phase3Options,
    shapeMinerBpStr: []const u8,
    fluidMinerBpStr: []const u8,
};

const SolverWorkItem = struct {
    jsonOptions: JsonOptions,
    shapeMinerContentRotations: *const [dt.Rotation.numRotations]dt.BuildingBlueprint,
    fluidMinerContentRotations: *const [dt.Rotation.numRotations]dt.BuildingBlueprint,
    outBpVersion: dt.BlueprintVersion,
    islandBlueprints: std.ArrayList(*const dt.IslandBlueprint),
};

/// 'options' must be a JSON-String representing the 'JsonOptions' struct.
/// <br/>returns a pointer to the parsed options. (or '0' on failure)
export fn parseOptions(options: [*]const u8, optionsLen: u32) u32 {
    const optParsed: std.json.Parsed(JsonOptions) = std.json.parseFromSlice(
        JsonOptions,
        alloc,
        options[0..optionsLen],
        .{ .allocate = .alloc_if_needed },
    ) catch |e| {
        reportErrorFmt("parseOptions.options are not valid Json. {}", .{e});
        return 0;
    };

    const slot: *SolverWorkItem = alloc.create(SolverWorkItem) catch |e| {
        reportErrorFmt("Failed to allocate memory for the JsonOptions-Struct. {}", .{e});
        return 0;
    };
    const handler = CallbackHandler.initCallback();
    slot.* = .{
        .jsonOptions = optParsed.value,
        .outBpVersion = dt.BlueprintVersion.latest,
        .shapeMinerContentRotations = solver.processMinerBlueprint(alloc, optParsed.value.shapeMinerBpStr, &handler) catch (return 0),
        .fluidMinerContentRotations = solver.processMinerBlueprint(alloc, optParsed.value.fluidMinerBpStr, &handler) catch (return 0),
        .islandBlueprints = std.ArrayList(*const dt.IslandBlueprint).init(alloc),
    };
    return @intFromPtr(slot);
}

const JsonAsteroid = struct {
    bufferPtr: usize,
    bufferLen: usize,
    originX: i32,
    originY: i32,
    asteroidType: asteroid.AsteroidType,
    maxX: u32,
    maxY: u32,
    posXArr: []u32,
    posYArr: []u32,
    posLen: usize,
};

const CallbackHandler = struct {
    fn onWarn(_: *anyopaque, msg: []const u8) void {
        logWarning(msg.ptr, msg.len);
    }
    fn onError(_: *anyopaque, msg: []const u8) void {
        reportError(msg.ptr, msg.len);
    }

    pub fn initCallback() ProblemCallback {
        return ProblemCallback{
            .ctx = undefined,
            .onWarn = CallbackHandler.onWarn,
            .onError = CallbackHandler.onError,
        };
    }
};

/// <br/>returns a status code.
/// <br/>'0' = ok.
/// <br/>'-2' = blueprint parser error
/// <br/>'-3' = error during response phase
export fn parseBlueprint(bpPtr: [*]const u8, len: u32, workItem: *SolverWorkItem) i32 {
    const handler = CallbackHandler.initCallback();
    var asteroids = std.ArrayList(asteroid.Asteroid).init(alloc);
    workItem.outBpVersion = bpParser.parseRoidMask(bpPtr[0..len], alloc, &workItem.jsonOptions.parser, &handler, &asteroids) catch |e| {
        reportErrorFmt("Failed to parse blueprint. {}", .{e});
        return -2;
    };

    respondAsteroids(asteroids) catch |e| {
        reportErrorFmt("Failed to return asteroids to javascript. {}", .{e});
        return -3;
    };

    return 0;
}

fn respondAsteroids(asteroids: std.ArrayList(asteroid.Asteroid)) !void {
    if (asteroids.items.len == 0)
        return;

    for (asteroids.items, 0..) |roid, i| {
        const posLen = roid.gridSet.count();
        const posX: []u32 = try alloc.alloc(u32, posLen);
        const posY: []u32 = try alloc.alloc(u32, posLen);
        var gridIter = roid.gridSet.iterator(.{});
        var posIdx: usize = 0;
        while (gridIter.next()) |encPos| {
            posX[posIdx] = asteroid.decodeX(roid.maxY, encPos);
            posY[posIdx] = asteroid.decodeY(roid.maxY, encPos);
            posIdx += 1;
        }

        const jsonRoid: JsonAsteroid = .{
            .bufferPtr = @intFromPtr(&asteroids.items[i]),
            .bufferLen = @sizeOf(asteroid.Asteroid),
            .originX = roid.originX,
            .originY = roid.originY,
            .asteroidType = roid.asteroidType,
            .maxX = roid.maxX,
            .maxY = roid.maxY,
            .posXArr = posX,
            .posYArr = posY,
            .posLen = posLen,
        };

        const jsonRoidStr = try std.json.stringifyAlloc(alloc, jsonRoid, .{ .whitespace = .minified });
        onAsteroidParsed(jsonRoidStr.ptr, jsonRoidStr.len);
    }
}

/// returns a pointer to the Phase0Data. ; or 0 on error.
export fn phase0(roid: *const asteroid.Asteroid) u32 {
    const handler = CallbackHandler.initCallback();
    const p0 = solver.phase0(alloc, roid, &handler) catch |e| {
        reportErrorFmt("Failed to process Phase0. {}", .{e});
        return 0;
    };
    return @intFromPtr(p0);
}

/// returns a pointer to the Phase1StepData. ; or 0 on error
export fn phase1_init(p0: *solver.Phase0Data, workItem: *const SolverWorkItem) u32 {
    const p1 = solver.phase1_stepper_init(alloc, p0, &workItem.jsonOptions.phase1) catch |e| {
        reportErrorFmt("Failed to initialize Phase1. {}", .{e});
        return 0;
    };
    return @intFromPtr(p1);
}

/// <br/>returns a status code.
/// <br/>'0' = OK, done.
/// <br/>'1' = OK, buffer exhausted. (call this function again to proceed)
/// <br/>'-1' = error while allocating response
export fn phase1_step(
    roid: *const asteroid.Asteroid,
    p0: *solver.Phase0Data,
    p1: *solver.Phase1StepData,
    workItem: *const SolverWorkItem,
    timeoutMillis: i32,
) i32 {
    const checkTimeEveryNSteps: comptime_int = 32; // poll for timeout roughly once/30ms (purely empirical/hardware-dependent guesstimate)
    const timeoutTs = getTimestampMillis() + timeoutMillis;
    var interrupted = false;
    var stepI: usize = 0;
    while (solver.phase1_step(roid, p0, &workItem.jsonOptions.phase1, p1)) |edgeIdx| {
        if (p1.edgeMinerChoices[edgeIdx] != solver.CHOICE_SKIP) {
            var tempX: [4]u32 = undefined;
            var tempY: [4]u32 = undefined;
            var tempMinoIds: [4]u32 = undefined;
            const tile: *const solver.Tile = &p0.tileList.items[edgeIdx];
            const encChoice = p1.edgeMinerChoices[edgeIdx];
            if (solver.decodeTetrominoLayout(roid, p0, edgeIdx, tile, encChoice, &tempMinoIds)) {
                for (tempMinoIds, 0..4) |minoTileIdx, minoIdx| {
                    const minoTile: *const solver.Tile = &p0.tileList.items[minoTileIdx];
                    tempX[minoIdx] = minoTile.x;
                    tempY[minoIdx] = minoTile.y;
                }
                onEdgeMinerPlacement(edgeIdx, &tempX, &tempY);
            } else {
                // phase1 *should* not de-occupy previous placements or create invalid layouts.
                reportErrorFmt("phase1_step created an invalid layout, on edge-tile ({}, {}), encChoice={}", .{ tile.x, tile.y, encChoice });
            }
        }
        stepI += 1;
        if (stepI % checkTimeEveryNSteps == 0 and getTimestampMillis() >= timeoutTs) {
            interrupted = true;
            break;
        }
    }
    return if (interrupted) 1 else 0;
}

/// returns a pointer to the Phase2StepData. ; or 0 on error
export fn phase2_init(
    p0: *const solver.Phase0Data,
    p1: *const solver.Phase1StepData,
) u32 {
    const p1Result = solver.Phase1Data{ .edgeMinerChoices = p1.edgeMinerChoices };
    const p2 = solver.phase2_stepper_init(alloc, p0, &p1Result) catch |e| {
        reportErrorFmt("Failed to initialize Phase2. {}", .{e});
        return 0;
    };
    return @intFromPtr(p2);
}

/// <br/>returns a status code.
/// <br/>'0' = OK, done.
/// <br/>'1' = OK, buffer exhausted. (call this function again to proceed)
/// <br/>'-1' = error processing phase 2
/// <br/>'-2' = error while allocating result
export fn phase2_step(
    roid: *const asteroid.Asteroid,
    p0: *solver.Phase0Data,
    p2: *solver.Phase2StepData,
    workItem: *const SolverWorkItem,
    timeoutMillis: i32,
) i32 {
    const numChoicesInitial = p2.result.updatedEdges.items.len;
    const timeoutTs = getTimestampMillis() + timeoutMillis;
    var interrupted = false;
    while (true) {
        const shouldContinue: bool = solver.phase2_step(alloc, roid, p0, &workItem.jsonOptions.phase2, p2) catch |e| {
            reportErrorFmt("Unexpected exception while processing Phase2. {}", .{e});
            return -1;
        };
        if (!shouldContinue) {
            break;
        }
        if (getTimestampMillis() >= timeoutTs) {
            interrupted = true;
            break;
        }
    }

    const numNewChoices: usize = p2.result.updatedEdges.items.len - numChoicesInitial;
    var tempMinoIds: [4]u32 = undefined;
    var tempXCoords: [4]u32 = undefined;
    var tempYCoords: [4]u32 = undefined;
    for (0..numNewChoices) |i| {
        const choiceIdx = numChoicesInitial + i;
        const choice = &p2.result.updatedEdges.items[choiceIdx];
        const choiceTile = &p0.tileList.items[choice.edgeId];
        if (choice.occupy == 1) {
            if (solver.decodeTetrominoLayout(roid, p0, choice.edgeId, choiceTile, choice.encChoice, &tempMinoIds)) {
                for (tempMinoIds, 0..) |id, coordIdx| {
                    const minoTile = &p0.tileList.items[id];
                    tempXCoords[coordIdx] = minoTile.x;
                    tempYCoords[coordIdx] = minoTile.y;
                }
                onEdgeMinerPlacement(choice.edgeId, &tempXCoords, &tempYCoords);
            }
        } else {
            if (choice.encChoice != solver.CHOICE_SKIP) {
                onUndoPlacement(choice.edgeId);
            }
        }
    }

    return if (interrupted) 1 else 0;
}

/// returns a pointer to the Phase3StepData. ; or 0 on error
export fn phase3_init(
    p0: *solver.Phase0Data,
    workItem: *const SolverWorkItem,
) u32 {
    const p3 = solver.phase3_stepper_init(alloc, p0, &workItem.jsonOptions.phase3) catch |e| {
        reportErrorFmt("Failed to initialize Phase3. {}", .{e});
        return 0;
    };
    return @intFromPtr(p3);
}

/// <br/>returns a status code.
/// <br/>'0' = OK, done.
/// <br/>'1' = OK, buffer exhausted. (call this function again to proceed)
/// <br/>'-1' = error processing phase 2
/// <br/>'-2' = error while allocating result
export fn phase3_step(
    roid: *const asteroid.Asteroid,
    p0: *solver.Phase0Data,
    p3: *solver.Phase3StepData,
    workItem: *const SolverWorkItem,
    timeoutMillis: i32,
) i32 {
    const numChoicesInitial = p3.result.committedChoices.len;
    const timeoutTs = getTimestampMillis() + timeoutMillis;
    var interrupted = false;
    while (true) {
        const shouldContinue: bool = solver.phase3_step(alloc, roid, p0, &workItem.jsonOptions.phase3, p3) catch |e| {
            reportErrorFmt("Unexpected exception while processing Phase3. {}", .{e});
            return -1;
        };
        if (!shouldContinue) {
            break;
        }
        if (getTimestampMillis() >= timeoutTs) {
            interrupted = true;
            break;
        }
    }

    const numNewChoices: usize = p3.result.committedChoices.len - numChoicesInitial;
    var tempXCoords: [14]u32 = undefined;
    var tempYCoords: [14]u32 = undefined;
    for (0..numNewChoices) |i| {
        const choiceIdx = numChoicesInitial + i;
        const choice = &p3.result.committedChoices[choiceIdx];
        const minerGridId = choice.choice.gridId;

        if (choice.occupy == 1) {
            const minerTile = &p0.tileList.items[minerGridId];
            std.debug.assert(minerTile.nIds.len == 4); // neighbors in order of dir.cardinals
            const liftDir = choice.choice.miner.dir;

            pushCoords(p0, minerGridId, 0, tempXCoords[0..], tempYCoords[0..]);
            pushCoords(p0, minerTile.nIds[liftDir], 1, tempXCoords[0..], tempYCoords[0..]);
            for (0..3) |quadIdx| {
                pushCoords(p0, minerTile.nIds[(liftDir + quadIdx + 1) & 0b11], 2 + (quadIdx * 4), tempXCoords[0..], tempYCoords[0..]);
                for (0..3) |extIdx| {
                    pushCoords(p0, choice.choice.minerExtIds[extIdx + (quadIdx * 3)], 3 + extIdx + (quadIdx * 4), tempXCoords[0..], tempYCoords[0..]);
                }
            }

            onCenterMinerPlacement(minerGridId, &tempXCoords, &tempYCoords);
        } else {
            onUndoPlacement(minerGridId);
        }
    }

    return if (interrupted) 1 else 0;
}

fn pushCoords(p0: *const solver.Phase0Data, tileId: u32, idx: usize, xBuffer: []u32, yBuffer: []u32) void {
    const tile = &p0.tileList.items[tileId];
    xBuffer[idx] = tile.x;
    yBuffer[idx] = tile.y;
}

/// <br/>returns a status code.
/// <br/>'0' = OK, done.
/// <br/>'-1' = error computing tile directions
/// <br/>'-2' = error constructing the result blueprint
export fn finishSingle(
    roid: *const asteroid.Asteroid,
    p0: *solver.Phase0Data,
    p1: *const solver.Phase1StepData,
    p2: *const solver.Phase2StepData,
    p3: *const solver.Phase3StepData,
    workItem: *SolverWorkItem,
) i32 {
    const p1Result = solver.Phase1Data{ .edgeMinerChoices = p1.edgeMinerChoices };
    const rots = solver.findRotations(alloc, roid, p0, &p1Result, &p2.result, &p3.result) catch |e| {
        reportErrorFmt("Unexpected exception while computing tile-rotations. {}", .{e});
        return -1;
    };

    for (0..(p0.tileList.items.len)) |tileId| {
        // yes, iterating over the packed list would (probably) be faster, BUT we're deferring back to JS on every tile anyways, so it does not matter.
        const rot = @as(u8, @intCast(@intFromEnum(rots.get(tileId))));
        const tile = &p0.tileList.items[tileId];
        onTileRotation(tile.x, tile.y, rot);
    }

    const stats = solver.calcStats(p0, &p1Result, &p2.result, &p3.result);
    onStatsComputed(stats.numEdgeMiners, stats.numCenterMiners, stats.gapTiles, stats.gapIslands);

    const solutionBp = bpWriter.solverSolutionToBlueprint(
        alloc,
        roid,
        p0,
        &p1Result,
        &p2.result,
        &p3.result,
        rots,
        switch (roid.asteroidType) {
            .shape => workItem.shapeMinerContentRotations,
            .fluid => workItem.fluidMinerContentRotations,
        },
    ) catch |e| {
        reportErrorFmt("Unexpected exception while converting the solution to a blueprint. {}", .{e});
        return -2;
    };
    const bpSlot = workItem.islandBlueprints.addOne() catch |e| {
        reportErrorFmt("Failed to allocate memory for the island blueprint. {}", .{e});
        return -2;
    };
    bpSlot.* = solutionBp;
    return 0;
}

/// <br/>returns a status code.
/// <br/>'0' = OK, done.
/// <br/>'-1' = error allocating the result blueprint
/// <br/>'-2' = error serializing the result blueprint
export fn mergeBlueprintsToStr(
    workItem: *const SolverWorkItem,
) i32 {
    var numTotalIslandEntries: usize = 0;
    for (workItem.islandBlueprints.items) |bp| {
        numTotalIslandEntries += bp.Entries.len;
    }
    var mergedBp = dt.IslandBlueprint{ .Entries = undefined };
    mergedBp.Entries = alloc.alloc(dt.IslandEntry, numTotalIslandEntries) catch |e| {
        reportErrorFmt("Failed to allocate memory for the merged blueprint. {}", .{e});
        return -1;
    };
    var mergeIdx: usize = 0;
    for (workItem.islandBlueprints.items) |bp| {
        @memcpy(mergedBp.Entries[mergeIdx..][0..bp.Entries.len], bp.Entries);
        mergeIdx += bp.Entries.len;
    }
    const mergedBpStr = bpWriter.encodeBlueprint(alloc, &mergedBp, workItem.outBpVersion) catch |e| {
        reportErrorFmt("Failed to encode the merged blueprint to a string. {}", .{e});
        return -2;
    };

    onSolutionBpMerged(mergedBpStr.items.ptr, mergedBpStr.items.len);
    return 0;
}
