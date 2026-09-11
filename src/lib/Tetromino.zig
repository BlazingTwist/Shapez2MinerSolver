const std = @import("std");
const vec2i = @import("./util/Vector2I.zig");
const dir = @import("./Direction.zig");

pub const shapes = [_][4]vec2i.Vector2I{
    // 2xI
    initTetromino(1, 0, 2, 0, 3, 0),
    initTetromino(0, 1, 0, 2, 0, 3),
    // 1xO
    initTetromino(1, 0, 1, 1, 0, 1),
    // 4xT
    initTetromino(1, 0, 2, 0, 1, 1),
    initTetromino(1, 0, 2, 0, 1, -1),
    initTetromino(1, -1, 1, 0, 1, 1),
    initTetromino(-1, -1, -1, 0, -1, 1),
    // 4xS
    initTetromino(1, 0, 1, 1, 2, 1),
    initTetromino(1, 0, 1, -1, 2, -1),
    initTetromino(0, -1, 1, -1, 1, -2),
    initTetromino(0, 1, 1, 1, 1, 2),
    // 8xL
    initTetromino(1, 0, 2, 0, 2, 1),
    initTetromino(1, 0, 2, 0, 2, -1),
    initTetromino(1, 0, 2, 0, 0, 1),
    initTetromino(1, 0, 2, 0, 0, -1),
    initTetromino(0, -1, 0, 1, 1, -1),
    initTetromino(0, -1, 0, 1, 1, 1),
    initTetromino(0, -1, 0, 1, -1, -1),
    initTetromino(0, -1, 0, 1, -1, 1),
};

fn initTetromino(x1: i32, y1: i32, x2: i32, y2: i32, x3: i32, y3: i32) [4]vec2i.Vector2I {
    return [4]vec2i.Vector2I{
        vec2i.Vector2I{ .x = 0, .y = 0 },
        vec2i.Vector2I{ .x = x1, .y = y1 },
        vec2i.Vector2I{ .x = x2, .y = y2 },
        vec2i.Vector2I{ .x = x3, .y = y3 },
    };
}

pub const numTetrominoes: usize = shapes.len;
pub const numTetrominoLayouts: usize = numTetrominoes * 4;

pub const Vector2i4 = packed struct(u8) {
    x: i4,
    y: i4,
};

pub const CenterMinerInfo = extern struct {
    const Self = @This();
    /// encodes the lift direction as an index into Direction.cardinals
    /// Implies the location of the 3 miners.
    dir: u8,
    /// Contains the offsets of the miner-extenders. In groups of 3 per miner.
    /// The groups belong to the n-th clockwise miner relative to the lift-direction.
    offsets: [9]Vector2i4,

    pub fn toBytes(self: Self) [10]u8 {
        return @bitCast(self);
    }

    pub fn fromBytes(bytes: *const [10]u8) *const Self {
        return @ptrCast(bytes);
    }
};

fn getCenterMinerFootprintIndexVec(offset: Vector2i4) usize {
    return getCenterMinerFootprintIndex(offset.x, offset.y);
}

/// Calculates the index into the footprint bitset for an offset. (Within city-block distance 4)
/// <br/>
/// Reachable tiles are numbered like this:
/// <code><pre>
/// [ _  _  _  _ 37  _  _  _  _]
///	[ _  _  _ 36 22 38  _  _  _]
///	[ _  _ 35 21 11 23 39  _  _]
///	[ _ 34 20 10  4 12 24 40  _]
///	[33 19  9  3  0  1  5 13 25]
///	[ _ 32 18  8  2  6 14 26  _]
///	[ _  _ 31 17  7 15 27  _  _]
///	[ _  _  _ 30 16 28  _  _  _]
///	[ _  _  _  _ 29  _  _  _  _]
/// </pre></code>
fn getCenterMinerFootprintIndex(x: i32, y: i32) usize {
    std.debug.assert(@abs(x) <= 4);
    std.debug.assert(@abs(y) <= 4);

    var result: usize = 0;
    const dist = @abs(x) + @abs(y);
    if (dist > 1) {
        result += ((dist - 1) * 2) * dist;
    }
    if (x < 0) {
        result += @abs(x) * 2;
    }
    if (y < 0) {
        result += @abs(y) * 3;
    }
    if (x > 0 and y < 0) {
        result += @abs(x) * 4;
    }
    if (x != 0 or y != 0) {
        result += 1;
    }
    if (y > 0) {
        result += @abs(y);
    }
    return result;
}

const CenterMinerFootprint: type = std.bit_set.IntegerBitSet(41);
const CenterMinerFootprintCtx: type = struct {
    const Self = @This();
    pub fn hash(_: Self, k: CenterMinerFootprint) u64 {
        return @intCast(k.mask);
    }
    pub fn eql(_: Self, a: CenterMinerFootprint, b: CenterMinerFootprint) bool {
        return a.eql(b);
    }
};

/// this function exists as a pseudo-comptime function, except that it is only run once and then reused (via @embedFile) on subsequent compilations.
fn ensureFileAllCenterMiners() !void {
    const allMinersFilePath = "./src/lib/AllCenterMiners.bin";
    const minersFile = std.fs.cwd().createFile(allMinersFilePath, .{ .exclusive = true }) catch |e| {
        switch (e) {
            std.fs.File.OpenError.PathAlreadyExists => return,
            else => return e,
        }
    };
    var evalRejected = false;
    defer {
        if(!evalRejected) minersFile.close();
    }

    const maxNumDistinctCenterMiners: usize = 65705; // expect 65704 exactly. Throw if more are found.
    var resultLen: usize = 0;
    const FootprintMap = std.HashMap(CenterMinerFootprint, void, CenterMinerFootprintCtx, 80);
    var buffer: [128 * 65704]u8 = undefined;
    var fba = std.heap.FixedBufferAllocator.init(&buffer);
    const alloc = fba.allocator();
    var uniqueFootPrints = FootprintMap.init(alloc);

    const totalPossibilities = numTetrominoLayouts * numTetrominoLayouts * numTetrominoLayouts * 4;
    for (0..totalPossibilities) |encChoice| {
        const liftDir: usize = encChoice & 0b11;
        const encMinoChoices = encChoice >> 2;
        const minerChoices = [3]usize{
            encMinoChoices % numTetrominoLayouts,
            (encMinoChoices / numTetrominoLayouts) % numTetrominoLayouts,
            (encMinoChoices / (numTetrominoLayouts * numTetrominoLayouts)),
        };

        var footprint = CenterMinerFootprint.initEmpty();
        footprint.set(getCenterMinerFootprintIndex(0, 0));
        footprint.set(getCenterMinerFootprintIndex(dir.cardinals[liftDir].x, dir.cardinals[liftDir].y));
        for (minerChoices, 0..) |minerChoice, i| {
            const minerDir = (liftDir + 1 + i) & 0b11;
            const shape = shapes[minerChoice >> 2];
            const posIdx = minerChoice & 0b11;
            const dirOffset = dir.cardinals[minerDir];
            const posOffset = shape[posIdx];
            const posX = dirOffset.x - posOffset.x;
            const posY = dirOffset.y - posOffset.y;

            footprint.set(getCenterMinerFootprintIndex(dirOffset.x, dirOffset.y));
            for (1..4) |posI| {
                const tile = shape[(posI + posIdx) & 0b11];
                footprint.set(getCenterMinerFootprintIndex(tile.x + posX, tile.y + posY));
            }
        }

        if(footprint.count() != 14) {
            continue; // overlaps self
        }
        if(uniqueFootPrints.contains(footprint)) {
            continue; // duplicate
        }

        // found a distinct layout, save to result
        uniqueFootPrints.put(footprint, {}) catch unreachable;
        var minerInfo = CenterMinerInfo{
            .dir = @intCast(liftDir),
            .offsets = undefined,
        };
        for (minerChoices, 0..) |minerChoice, i| {
            const minerDir = (liftDir + 1 + i) & 0b11;
            const shape = shapes[minerChoice >> 2];
            const posIdx = minerChoice & 0b11;
            const dirOffset = dir.cardinals[minerDir];
            const posOffset = shape[posIdx];
            const posX = dirOffset.x - posOffset.x;
            const posY = dirOffset.y - posOffset.y;

            for (1..4) |posI| {
                const tile = shape[(posI + posIdx) & 0b11];
                minerInfo.offsets[(i * 3) + (posI - 1)] = Vector2i4{ .x = @intCast(tile.x + posX), .y = @intCast(tile.y + posY) };
            }
        }
        try minersFile.writeAll(&minerInfo.toBytes());
        resultLen += 1;
        if (resultLen >= maxNumDistinctCenterMiners) {
            break;
        }
    }
    if (resultLen >= maxNumDistinctCenterMiners) {
        std.debug.print("'ensureFileAllCenterMiners' expected no more than {} results. But found at least {}\n", .{ maxNumDistinctCenterMiners - 1, resultLen });
        evalRejected = true;
        minersFile.close();
        try std.fs.cwd().deleteFile(allMinersFilePath);
        return error.bufferTooSmall;
    }
}

const allCenterMinersRaw = @embedFile("./AllCenterMiners.bin");
pub const numAllCenterMiners: usize = @divExact(allCenterMinersRaw.len, @sizeOf(CenterMinerInfo));
var allCenterMiners: [numAllCenterMiners]*const CenterMinerInfo = undefined;
var allCenterMinersComputed = false;

pub fn getAllCenterMiners()*[numAllCenterMiners]*const CenterMinerInfo {
    if(allCenterMinersComputed) {
        return &allCenterMiners;
    }
    for(&allCenterMiners, 0..)|*cell, i| {
        cell.* = @ptrCast(allCenterMinersRaw[(i * @sizeOf(CenterMinerInfo))..((i + 1) * @sizeOf(CenterMinerInfo))].ptr);
    }
    return &allCenterMiners;
}

test "verify getCenterMinerFootprintIndex" {
    const dc: usize = 99;
    const dnc: usize = dc + 100;
    // ZLS / zig#504 sucks, that's why every item in this table has 100 added to it..
    const expected = [9][9]usize{
        [9]usize{ dnc, dnc, dnc, dnc, 137, dnc, dnc, dnc, dnc },
        [9]usize{ dnc, dnc, dnc, 136, 122, 138, dnc, dnc, dnc },
        [9]usize{ dnc, dnc, 135, 121, 111, 123, 139, dnc, dnc },
        [9]usize{ dnc, 134, 120, 110, 104, 112, 124, 140, dnc },
        [9]usize{ 133, 119, 109, 103, 100, 101, 105, 113, 125 },
        [9]usize{ dnc, 132, 118, 108, 102, 106, 114, 126, dnc },
        [9]usize{ dnc, dnc, 131, 117, 107, 115, 127, dnc, dnc },
        [9]usize{ dnc, dnc, dnc, 130, 116, 128, dnc, dnc, dnc },
        [9]usize{ dnc, dnc, dnc, dnc, 129, dnc, dnc, dnc, dnc },
    };

    var err: ?anyerror = null;
    for (0..9) |yi| {
        for (0..9) |xi| {
            const x: i32 = @as(i32, @intCast(xi)) - 4;
            const y: i32 = @as(i32, @intCast(yi)) - 4;
            const exp = expected[yi][xi] - 100;
            if (exp == dc) {
                continue;
            }

            const idx = getCenterMinerFootprintIndex(x, y);
            std.testing.expectEqual(exp, idx) catch |e| {
                err = e;
                std.debug.print("mismatched footprint idx at ({}, {}). Found {}, expected {}\n", .{ x, y, idx, exp });
            };
        }
    }
    if (err) |e| {
        return e;
    }
}

test "allCenterMiners is properly initialized" {
    try ensureFileAllCenterMiners();

    const miners = getAllCenterMiners();
    var numOk: usize = 0;
    for (miners) |miner| {
        for (miner.offsets) |offset| {
            std.debug.assert(miner.dir < 4);

            const dist = @abs(offset.x) + @abs(offset.y);
            std.debug.assert(dist > 1);
        }
        numOk += 1;
    }
    std.debug.print("allCenterMiners checked: found {} valid layouts.\n", .{numOk});
}
