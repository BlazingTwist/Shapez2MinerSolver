const std = @import("std");
const vec2i = @import("./util/Vector2I.zig");
const dir = @import("./Direction.zig");

pub const AsteroidType = enum {
    shape,
    fluid,
};

pub const Asteroid = struct {
    originX: i32,
    originY: i32,
    asteroidType: AsteroidType,
    maxX: u32,
    maxY: u32,
    /// the set of tiles of this asteroid, indexed by encoded x/y coordinates.
    /// For encoding coordinates, you should use the 'encode...'-functions.
    /// To obtains x/y coordinates from an index, you should use the 'decode...'-functions.
    gridSet: std.DynamicBitSet,
};

pub inline fn encodeVec(this: *const Asteroid, pos: vec2i.Vector2I) ?u32 {
    return encode(this, pos.x, pos.y);
}

pub inline fn encode(this: *const Asteroid, x: i32, y: i32) ?u32 {
    if (x < 0 or x > this.maxX)
        return null;
    if (y < 0 or y > this.maxY)
        return null;
    return encodeUnsafe(this, x, y);
}

pub inline fn encodeUnsafeVec(this: *const Asteroid, pos: vec2i.Vector2I) u32 {
    return encodeUnsafe(this, pos.x, pos.y);
}

pub inline fn encodeUnsafe(this: *const Asteroid, x: i32, y: i32) u32 {
    return encodeUnsafeRaw(this.maxY, x, y);
}

pub inline fn encodeUnsafeRaw(maxY: u32, x: i32, y: i32) u32 {
    return encodeUnsafeRawW(maxY + 1, x, y);
}

pub inline fn encodeUnsafeRawW(height: u32, x: i32, y: i32) u32 {
    return encodeUnsafeRawWu(height, @as(u32, @intCast(x)), @as(u32, @intCast(y)));
}

pub inline fn encodeUnsafeRawWu(height: u32, x: u32, y: u32) u32 {
    return y + (height * x);
}

pub inline fn decodeX(maxY: u32, encPos: u32) u32 {
    return decodeXW(maxY + 1, encPos);
}

pub inline fn decodeXW(height: u32, encPos: u32) u32 {
    return encPos / height;
}

pub inline fn decodeY(maxY: u32, encPos: u32) u32 {
    return decodeYW(maxY + 1, encPos);
}

pub inline fn decodeYW(height: u32, encPos: u32) u32 {
    return encPos % height;
}

pub fn splitIslands1(shapeCoords: ?std.ArrayList(vec2i.Vector2I), fluidCoords: ?std.ArrayList(vec2i.Vector2I), dest: *std.ArrayList(Asteroid), alloc: std.mem.Allocator) !void {
    if (shapeCoords) |coords| {
        try splitIslands2(coords, .shape, dest, alloc);
    }
    if (fluidCoords) |coords| {
        try splitIslands2(coords, .fluid, dest, alloc);
    }
}

pub fn splitIslands2(coords: std.ArrayList(vec2i.Vector2I), comptime asteroidType: AsteroidType, dest: *std.ArrayList(Asteroid), alloc: std.mem.Allocator) !void {
    if (coords.items.len == 0) {
        return;
    }

    var minX: i32 = std.math.maxInt(i32);
    var maxX: i32 = std.math.minInt(i32);
    var minY: i32 = std.math.maxInt(i32);
    var maxY: i32 = std.math.minInt(i32);
    for (coords.items) |coord| {
        minX = @min(minX, coord.x);
        maxX = @max(maxX, coord.x);
        minY = @min(minY, coord.y);
        maxY = @max(maxY, coord.y);
    }

    const width: u32 = @intCast(maxX - minX + 1);
    const height: u32 = @intCast(maxY - minY + 1);
    var unvisited = try std.DynamicBitSet.initEmpty(alloc, width * height);
    for (coords.items) |coord| {
        const encPos = encodeUnsafeRawW(height, coord.x - minX, coord.y - minY);
        unvisited.set(@as(usize, encPos));
    }

    var visited = try std.DynamicBitSet.initEmpty(alloc, width * height);
    var floodFillStack: []u32 = try alloc.alloc(u32, coords.items.len);
    var sp: usize = 0;

    while (unvisited.count() > 0) {
        const startEncPos: u32 = @intCast(unvisited.toggleFirstSet().?);
        visited.set(startEncPos);
        var islandMinX: u32 = decodeXW(height, startEncPos);
        var islandMaxX: u32 = islandMinX;
        var islandMinY: u32 = decodeYW(height, startEncPos);
        var islandMaxY: u32 = islandMinY;
        floodFillStack[sp] = startEncPos;
        sp += 1;

        while (sp > 0) {
            sp -= 1;
            const encPos: u32 = floodFillStack[sp];
            const curX: u32 = decodeXW(height, encPos);
            const curY: u32 = decodeYW(height, encPos);

            for (dir.cardinals) |*offset| {
                const nX: i32 = @as(i32, @intCast(curX)) + offset.x;
                if (nX < 0 or nX >= width)
                    continue;
                const nY: i32 = @as(i32, @intCast(curY)) + offset.y;
                if (nY < 0 or nY >= height)
                    continue;

                const nEnc = encodeUnsafeRawW(height, nX, nY);
                if (!unvisited.isSet(nEnc)) {
                    continue;
                }

                unvisited.unset(nEnc);
                visited.set(nEnc);
                islandMinX = @min(islandMinX, @as(u32, @intCast(nX)));
                islandMaxX = @max(islandMaxX, @as(u32, @intCast(nX)));
                islandMinY = @min(islandMinY, @as(u32, @intCast(nY)));
                islandMaxY = @max(islandMaxY, @as(u32, @intCast(nY)));
                floodFillStack[sp] = nEnc;
                sp += 1;
            }
        }

        var asteroid: *Asteroid = try dest.addOne();
        asteroid.originX = @as(i32, @intCast(islandMinX)) + minX;
        asteroid.originY = @as(i32, @intCast(islandMinY)) + minY;
        asteroid.asteroidType = asteroidType;
        asteroid.maxX = islandMaxX - islandMinX;
        asteroid.maxY = islandMaxY - islandMinY;
        asteroid.gridSet = try std.DynamicBitSet.initEmpty(alloc, (asteroid.maxX + 1) * (asteroid.maxY + 1));
        var iter = visited.iterator(.{});
        while (iter.next()) |encPos| {
            // decode from the bitset representing the collection of all asteroids
            const visitX = decodeXW(height, @intCast(encPos)) - islandMinX;
            const visitY = decodeYW(height, @intCast(encPos)) - islandMinY;
            // re-encode for the bitset representing a single asteroid
            asteroid.gridSet.set(encodeUnsafeRawWu(asteroid.maxY + 1, visitX, visitY));
        }

        visited.toggleSet(visited);
    }
}

pub fn testingAssertEqual(debugPath: []const u8, a: *const Asteroid, b: *const Asteroid) !void {
    if (a.originX != b.originX) {
        std.debug.print("expected '{s}originX' to be equal. a={}, b={}\n", .{ debugPath, a.originX, b.originX });
        return error.MismatchedOriginX;
    }
    if (a.originY != b.originY) {
        std.debug.print("expected '{s}originY' to be equal. a={}, b={}\n", .{ debugPath, a.originY, b.originY });
        return error.MismatchedOriginY;
    }
    if (a.asteroidType != b.asteroidType) {
        std.debug.print("expected '{s}asteroidType' to be equal. a={}, b={}\n", .{ debugPath, a.asteroidType, b.asteroidType });
        return error.MismatchedAsteroidType;
    }
    if (a.maxX != b.maxX) {
        std.debug.print("expected '{s}maxX' to be equal. a={}, b={}\n", .{ debugPath, a.maxX, b.maxX });
        return error.MismatchedMaxX;
    }
    if (a.maxY != b.maxY) {
        std.debug.print("expected '{s}maxY' to be equal. a={}, b={}\n", .{ debugPath, a.maxY, b.maxY });
        return error.MismatchedMaxY;
    }
    if (!a.gridSet.eql(b.gridSet)) {
        const numMasks = (a.gridSet.unmanaged.bit_length + (@bitSizeOf(std.DynamicBitSet.MaskInt) - 1)) / @bitSizeOf(std.DynamicBitSet.MaskInt);
        std.debug.print("expected '{s}gridSet' to be equal. a={X}, b={X}\n", .{
            debugPath,
            a.gridSet.unmanaged.masks[0..numMasks],
            b.gridSet.unmanaged.masks[0..numMasks],
        });
        return error.MismatchedGridSet;
    }
}
