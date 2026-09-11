const std = @import("std");
const asteroid = @import("./Asteroid.zig");
const vec2i = @import("./util/Vector2I.zig");
const ProblemCallback = @import("./ProblemCallback.zig");
const dt = @import("./DataTypes.zig");

const decoder = std.base64.Base64Decoder.init(std.base64.standard_alphabet_chars, '=');

pub const IslandType = enum {
    shape,
    fluid,
    ignored,
};

pub const ParseOptions = struct {
    shapeCodes: [][]const u8 = @constCast(&[2][]const u8{
        "Layout_ShapeMiner",
        "Layout_ShapeMinerExtension",
    }),
    fluidCodes: [][]const u8 = @constCast(&[2][]const u8{
        "Layout_FluidMiner",
        "Layout_FluidMinerExtension",
    }),
    ignoredCodes: [][]const u8 = &[0][]const u8{},
    fallbackMode: IslandType = .shape,
};

/// Specialized parser for turning blueprints into asteroid masks for solving.
pub fn parseRoidMask(blueprint: []const u8, alloc: std.mem.Allocator, options: *const ParseOptions, callback: *const ProblemCallback, dest: *std.ArrayList(asteroid.Asteroid)) !dt.BlueprintVersion {
    var bpVersion: dt.BlueprintVersion = undefined;
    var remainingBp: []const u8 = undefined;
    try trimBpHeader(blueprint, alloc, callback, &remainingBp, &bpVersion);

    return switch (bpVersion) {
        ._4 => {
            try parseRoidMask_v4(remainingBp, alloc, options, callback, dest);
            return ._4;
        },
        ._5 => {
            try parseRoidMask_v5(remainingBp, alloc, options, callback, dest);
            return ._5;
        },
        .other => {
            return error.UnsupportedBlueprintVersion;
        },
    };
}

/// General purpose parser (used for interpreting the miner blueprint)
pub fn parseGeneric(blueprint: []const u8, alloc: std.mem.Allocator, callback: *const ProblemCallback) !struct { dt.BlueprintVersion, *dt.IslandBlueprint } {
    var bpVersion: dt.BlueprintVersion = undefined;
    var remainingBp: []const u8 = undefined;
    try trimBpHeader(blueprint, alloc, callback, &remainingBp, &bpVersion);

    return switch (bpVersion) {
        ._4 => {
            var decompressedStr: []const u8 = undefined;
            try extractBpPayload_v4(remainingBp, alloc, callback, &decompressedStr);
            return .{ ._4, try parseGeneric_v4_v5(decompressedStr, alloc) };
        },
        ._5 => {
            var decompressedStr: []const u8 = undefined;
            try extractBpPayload_v5(remainingBp, alloc, callback, &decompressedStr);
            return .{ ._5, try parseGeneric_v4_v5(decompressedStr, alloc) };
        },
        .other => {
            return error.UnsupportedBlueprintVersion;
        },
    };
}

fn trimBpHeader(blueprint: []const u8, alloc: std.mem.Allocator, callback: *const ProblemCallback, outRemainingBp: *[]const u8, outBpVersion: *dt.BlueprintVersion) !void {
    const prefix = "SHAPEZ2-";
    if (blueprint.len < prefix.len or !std.mem.eql(u8, prefix, blueprint[0..(prefix.len)])) {
        const bpPrefix = blueprint[0..(@min(blueprint.len, prefix.len))];
        callback.onError(callback.ctx, try std.fmt.allocPrint(alloc, "Invalid Blueprint prefix. Expected '{s}', found '{s}'", .{ prefix, bpPrefix }));
        return error.InvalidBlueprintPrefix;
    }

    const versionEndSepIdx = std.mem.indexOfPos(u8, blueprint, prefix.len, "-");
    if (versionEndSepIdx == null) {
        callback.onError(callback.ctx, "Blueprint version string terminator ('-') is missing.");
        return error.MissingVersionStringTerminator;
    }

    const bpVersionNum = std.fmt.parseInt(u32, blueprint[prefix.len..versionEndSepIdx.?], 10) catch |e| {
        const versionStr = blueprint[prefix.len..versionEndSepIdx.?];
        callback.onError(callback.ctx, try std.fmt.allocPrint(alloc, "Invalid Blueprint version ('{s}'): {any}", .{ versionStr, e }));
        return e;
    };
    outBpVersion.* = dt.BlueprintVersion.fromInt(bpVersionNum);

    if(outBpVersion.* == .other) {
        callback.onError(callback.ctx, try std.fmt.allocPrint(alloc, "Unsupported Blueprint version ({}). Supported versions are {s}", .{bpVersionNum, dt.BlueprintVersion.supportedVersionsStr}));
    }

    const encBpStart = versionEndSepIdx.? + 1;
    outRemainingBp.* = blueprint[encBpStart..];
}

fn inflateBp(encBlueprint: []const u8, alloc: std.mem.Allocator) ![]const u8 {
    const decodeSize = try decoder.calcSizeForSlice(encBlueprint);
    const decoded = try alloc.alloc(u8, decodeSize);
    try decoder.decode(decoded, encBlueprint);
    var decodeStream = std.io.fixedBufferStream(decoded);
    const decodeReader = decodeStream.reader();
    var decompressor = std.compress.gzip.Decompressor(std.io.FixedBufferStream([]u8).Reader).init(decodeReader);
    var decompressed = try std.ArrayList(u8).initCapacity(alloc, decodeSize * 2);
    try decompressor.decompress(decompressed.writer());
    return decompressed.items.ptr[0..decompressed.items.len];
}

fn anyEquals(needle: []const u8, haystack: []const []const u8) bool {
    for (haystack) |hay| {
        if (std.mem.eql(u8, needle, hay)) {
            return true;
        }
    }
    return false;
}

fn decodeIslandType(typeStr: []const u8, x: i64, y: i64, alloc: std.mem.Allocator, options: *const ParseOptions, callback: *const ProblemCallback) IslandType {
    if (anyEquals(typeStr, options.shapeCodes)) {
        return IslandType.shape;
    }
    if (anyEquals(typeStr, options.fluidCodes)) {
        return IslandType.fluid;
    }
    if (anyEquals(typeStr, options.ignoredCodes)) {
        return IslandType.ignored;
    }

    if (std.fmt.allocPrint(
        alloc,
        "Unrecognized island type: '{s}', fallback to mode '{s}' at x={} y={}",
        .{ typeStr, @tagName(options.fallbackMode), x, y },
    )) |msg| {
        callback.onWarn(callback.ctx, msg);
    } else |_| {
        callback.onWarn(callback.ctx, "A warning message failed to print. (out of memory?)");
    }
    return options.fallbackMode;
}

fn getOrElse(comptime T: type, comptime tag: std.meta.Tag(std.json.Value), jsonObj: std.json.Value, key: []const u8, orElse: T) T {
    if (jsonObj != .object)
        return orElse;

    if (jsonObj.object.get(key)) |val| {
        if (val == tag) {
            const value = @field(val, @tagName(tag));
            const tInfo = @typeInfo(T);
            if (tInfo == .Int) {
                return @intCast(value);
            } else {
                return value;
            }
        }
    }
    return orElse;
}

fn extractBpPayload_v4(prefixStrippedBp: []const u8, alloc: std.mem.Allocator, callback: *const ProblemCallback, outPayload: *[]const u8) !void {
    if (prefixStrippedBp.len <= 0) {
        return error.BlueprintIsEmpty;
    }
    const actualSuffix = prefixStrippedBp[prefixStrippedBp.len - 1];
    if (actualSuffix != '$') {
        callback.onError(callback.ctx, try std.fmt.allocPrint(alloc, "Invalid Blueprint suffix: '{}'. Expected: '$'.", .{actualSuffix}));
        return error.InvalidBlueprintSuffix;
    }

    outPayload.* = try inflateBp(prefixStrippedBp[0..(prefixStrippedBp.len - 1)], alloc);
}

fn parseRoidMask_v4(prefixStrippedBp: []const u8, alloc: std.mem.Allocator, options: *const ParseOptions, callback: *const ProblemCallback, dest: *std.ArrayList(asteroid.Asteroid)) !void {
    var decompressedStr: []const u8 = undefined;
    try extractBpPayload_v4(prefixStrippedBp, alloc, callback, &decompressedStr);

    var jsonRoot = try std.json.parseFromSlice(std.json.Value, alloc, decompressedStr, .{ .allocate = .alloc_if_needed });
    const entries = jsonRoot.value.object.get("BP").?.object.get("Entries").?.array;
    var shapeCoords = std.ArrayList(vec2i.Vector2I).init(alloc);
    var fluidCoords = std.ArrayList(vec2i.Vector2I).init(alloc);
    for (entries.items) |value| {
        const x = getOrElse(i64, .integer, value, "X", 0);
        const y = getOrElse(i64, .integer, value, "Y", 0);
        const t = getOrElse([]const u8, .string, value, "T", "NULL");

        const tEnum = decodeIslandType(t, x, y, alloc, options, callback);
        switch (tEnum) {
            .shape, .fluid => {
                var coord: *vec2i.Vector2I = if (tEnum == .shape) try shapeCoords.addOne() else try fluidCoords.addOne();
                coord.x = @intCast(x);
                coord.y = @intCast(y);
            },
            .ignored => {},
        }
    }

    try asteroid.splitIslands1(shapeCoords, fluidCoords, dest, alloc);
}

// supports range [v4, v5]
fn parseGeneric_v4_v5(decompressedStr: []const u8, alloc: std.mem.Allocator) !*dt.IslandBlueprint {
    var islandEntries = try std.ArrayList(dt.IslandEntry).initCapacity(alloc, 100);
    var jsonRoot = try std.json.parseFromSlice(std.json.Value, alloc, decompressedStr, .{ .allocate = .alloc_if_needed });
    const jsonIslandEntriesObj = jsonRoot.value.object.get("BP").?.object.get("Entries").?;
    const jsonIslandEntries = if (jsonIslandEntriesObj == .array) jsonIslandEntriesObj.array else jsonIslandEntriesObj.object.get("$values").?.array;
    for (jsonIslandEntries.items) |jsonIslandEntry| {
        const islandEntry: *dt.IslandEntry = try islandEntries.addOne();
        islandEntry.* = .{
            .X = getOrElse(i32, .integer, jsonIslandEntry, "X", 0),
            .Y = getOrElse(i32, .integer, jsonIslandEntry, "Y", 0),
            .Z = getOrElse(u2, .integer, jsonIslandEntry, "Z", 0),
            .R = @enumFromInt(getOrElse(u2, .integer, jsonIslandEntry, "R", 0)),
            .T = getOrElse([]const u8, .string, jsonIslandEntry, "T", "NULL"),
            .S = jsonIslandEntry.object.get("S"),
            .C = jsonIslandEntry.object.get("C"),
            .B = if (jsonIslandEntry.object.get("B")) |x| try parseBuilding_v4_v5(x, alloc) else null,
        };
    }
    var result = try alloc.create(dt.IslandBlueprint);
    result.Entries = islandEntries.items;
    return result;
}

fn parseBuilding_v4_v5(jsonBuilding: std.json.Value, alloc: std.mem.Allocator) !?dt.BuildingBlueprint {
    if (jsonBuilding == .null) {
        return null;
    }

    var buildingEntries = try std.ArrayList(dt.BuildingEntry).initCapacity(alloc, 100);
    const jsonBuildingEntriesObj = jsonBuilding.object.get("Entries").?;
    const jsonBuildingEntries = if (jsonBuildingEntriesObj == .array) jsonBuildingEntriesObj.array else jsonBuildingEntriesObj.object.get("$values").?.array;
    for (jsonBuildingEntries.items) |jsonBuildingEntry| {
        const buildingEntry: *dt.BuildingEntry = try buildingEntries.addOne();
        buildingEntry.* = .{
            .X = getOrElse(i32, .integer, jsonBuildingEntry, "X", 0),
            .Y = getOrElse(i32, .integer, jsonBuildingEntry, "Y", 0),
            .L = getOrElse(u2, .integer, jsonBuildingEntry, "L", 0),
            .R = @enumFromInt(getOrElse(u2, .integer, jsonBuildingEntry, "R", 0)),
            .T = getOrElse([]const u8, .string, jsonBuildingEntry, "T", "NULL"),
            .C = jsonBuildingEntry.object.get("C"),
        };
    }
    return .{
        .Entries = buildingEntries.items,
    };
}

fn extractBpPayload_v5(prefixStrippedBp: []const u8, alloc: std.mem.Allocator, callback: *const ProblemCallback, outPayload: *[]const u8) !void {
    var bp: []const u8 = prefixStrippedBp;
    // Trailer must be at least len 3: '_0$'
    if (bp.len <= 2) {
        return error.BlueprintIsEmpty;
    }
    const actualSuffix = bp[bp.len - 1];
    if (actualSuffix != '$') {
        callback.onError(callback.ctx, try std.fmt.allocPrint(alloc, "Invalid Blueprint suffix: '{}'. Expected: '$'.", .{actualSuffix}));
        return error.InvalidBlueprintSuffix;
    }
    bp.len -= 1;

    const trailerLenSepIdx = std.mem.lastIndexOf(u8, bp, "_");
    if (trailerLenSepIdx == null) {
        callback.onError(callback.ctx, "Blueprint trailer length separator ('_') is missing.");
        return error.MissingTrailerLengthSeparator;
    }

    const trailerLenStr = bp[(trailerLenSepIdx.? + 1)..];
    const trailerLen = std.fmt.parseInt(usize, trailerLenStr, 10) catch |e| {
        callback.onError(callback.ctx, try std.fmt.allocPrint(alloc, "Invalid trailer length ('{s}'): {any}", .{ trailerLenStr, e }));
        return e;
    };
    bp.len = trailerLenSepIdx.? - trailerLen;

    outPayload.* = try inflateBp(bp, alloc);
}

fn parseRoidMask_v5(prefixStrippedBp: []const u8, alloc: std.mem.Allocator, options: *const ParseOptions, callback: *const ProblemCallback, dest: *std.ArrayList(asteroid.Asteroid)) !void {
    var decompressedStr: []const u8 = undefined;
    try extractBpPayload_v5(prefixStrippedBp, alloc, callback, &decompressedStr);
    var jsonRoot = try std.json.parseFromSlice(std.json.Value, alloc, decompressedStr, .{ .allocate = .alloc_if_needed });
    const entries = jsonRoot.value.object.get("BP").?.object.get("Entries").?.object.get("$values").?.array;
    var shapeCoords = std.ArrayList(vec2i.Vector2I).init(alloc);
    var fluidCoords = std.ArrayList(vec2i.Vector2I).init(alloc);
    for (entries.items) |value| {
        const x = getOrElse(i64, .integer, value, "X", 0);
        const y = getOrElse(i64, .integer, value, "Y", 0);
        const t = getOrElse([]const u8, .string, value, "T", "NULL");

        const tEnum = decodeIslandType(t, x, y, alloc, options, callback);
        switch (tEnum) {
            .shape, .fluid => {
                var coord: *vec2i.Vector2I = if (tEnum == .shape) try shapeCoords.addOne() else try fluidCoords.addOne();
                coord.x = @intCast(x);
                coord.y = @intCast(y);
            },
            .ignored => {},
        }
    }

    try asteroid.splitIslands1(shapeCoords, fluidCoords, dest, alloc);
}

test "verify v5 parser against v4" {
    const bpV4 = "SHAPEZ2-4-H4sIAIxiVmoA/5yTXWvCMBSG/8vLLuNFqm0hl0MFYQNxQzaGSFgzFshSyQdYSv/7YjMqTIdZCQSSPO95Ti5Oiy0YpdOS4H4N1uLONQcBhpVVXFcgWL3X+vQw546DvUGGM1sr7j5q82VBtFcqbrCf/CDYxseFXUew0M5IYUOwxQvYpCB4DtUfeFN7t386BR6lFmZxdEJbGVQdGcjX0FoynxNswLLIL2uvK+7C+54e6cDM0pjovUlOe3KS3mIWA9kfgd8cvcHNhnLnVn/gpfKyugbTJDhPqXzxvzxFcZEqRrmKUa5ylKv8p2sXZklqbpqtMP1NP2Bd9y2AAAMAhWLExmwDAAA=$";
    const bpV5 = "SHAPEZ2-5-H4sIAOPRfmoA/9STUUvDMBRG/4pc9pgV062d5LFjE0FBrIg6xoj0goGYljSRVel/tza4KXuwwsDk5ZJwk/sdDsk7jExTITA45y8YzUuNUSYtVlooE+WoBZfijRtRqv3uSeLuDDn59SIQuANG6eSMQHYNbJ95UUuuiq6/UEYLrL/3/sbjJn2OaVbrYUyjV971uszVEUKHRd4DG6cEHoCdEnjs601fb7vsS96U1mzyZ17hlVCoF1uDqnY3c2DKSklg/rXI3KIl/0BPA6VPDtzHjn5ZWlX0Jzd0Sz0ingZKTAMinvTE41Afdezw4wH4/lHToKinh6rjH9BLaUXhJzQNCjoZbtrDP5kMV+4hfRq0+zRo97Og3c+O7X7dtu2HAAMA9sBxLqMMAAA=[{\"Type\":\"BlueprintIcon, SPZGameAssembly, Version=0.0.0.0, Culture=neutral, PublicKeyToken=null\",\"Content\":\"{\\\"Data\\\":[\\\"icon:Platforms\\\",null,null,\\\"shape:RuRuRuRu\\\"]}\"}]_171$";

    var arenaAlloc = std.heap.ArenaAllocator.init(std.testing.allocator);
    const alloc = arenaAlloc.allocator();
    defer arenaAlloc.deinit();

    const MsgHandler = struct {
        fn onWarn(_: *anyopaque, _: []const u8) void {}
        fn onError(_: *anyopaque, msg: []const u8) void {
            std.debug.print("  callback str: {s}\n", .{msg});
        }
    };
    const handler: ProblemCallback = .{ .ctx = undefined, .onWarn = MsgHandler.onWarn, .onError = MsgHandler.onError };

    var asteroidsV4 = std.ArrayList(asteroid.Asteroid).init(alloc);
    _ = try parseRoidMask(bpV4, alloc, &.{}, &handler, &asteroidsV4);
    var asteroidsV5 = std.ArrayList(asteroid.Asteroid).init(alloc);
    _ = try parseRoidMask(bpV5, alloc, &.{}, &handler, &asteroidsV5);

    try std.testing.expectEqual(asteroidsV4.items.len, asteroidsV5.items.len);
    for (0.., asteroidsV4.items, asteroidsV5.items) |i, *av4, *av5| {
        const debugPath = try std.fmt.allocPrint(alloc, "[{}].", .{i});
        try asteroid.testingAssertEqual(debugPath, av4, av5);
    }
}

test "parse shape only bp does not throw" {
    var arenaAlloc = std.heap.ArenaAllocator.init(std.testing.allocator);
    const alloc = arenaAlloc.allocator();
    defer arenaAlloc.deinit();

    const bp = "SHAPEZ2-4-H4sIAIxiVmoA/5yTXWvCMBSG/8vLLuNFqm0hl0MFYQNxQzaGSFgzFshSyQdYSv/7YjMqTIdZCQSSPO95Ti5Oiy0YpdOS4H4N1uLONQcBhpVVXFcgWL3X+vQw546DvUGGM1sr7j5q82VBtFcqbrCf/CDYxseFXUew0M5IYUOwxQvYpCB4DtUfeFN7t386BR6lFmZxdEJbGVQdGcjX0FoynxNswLLIL2uvK+7C+54e6cDM0pjovUlOe3KS3mIWA9kfgd8cvcHNhnLnVn/gpfKyugbTJDhPqXzxvzxFcZEqRrmKUa5ylKv8p2sXZklqbpqtMP1NP2Bd9y2AAAMAhWLExmwDAAA=$";
    const MsgHandler = struct {
        fn handle(_: *anyopaque, _: []const u8) void {}
    };
    const handler: ProblemCallback = .{ .ctx = undefined, .onWarn = MsgHandler.handle, .onError = MsgHandler.handle };

    var asteroids = std.ArrayList(asteroid.Asteroid).init(alloc);
    _ = try parseRoidMask(bp, alloc, &.{
        .fallbackMode = .shape,
        .shapeCodes = &[0][]const u8{},
        .fluidCodes = &[0][]const u8{},
    }, &handler, &asteroids);
}

test "parse fluid only bp does not throw" {
    var arenaAlloc = std.heap.ArenaAllocator.init(std.testing.allocator);
    const alloc = arenaAlloc.allocator();
    defer arenaAlloc.deinit();

    const bp = "SHAPEZ2-4-H4sIAIxiVmoA/5yTXWvCMBSG/8vLLuNFqm0hl0MFYQNxQzaGSFgzFshSyQdYSv/7YjMqTIdZCQSSPO95Ti5Oiy0YpdOS4H4N1uLONQcBhpVVXFcgWL3X+vQw546DvUGGM1sr7j5q82VBtFcqbrCf/CDYxseFXUew0M5IYUOwxQvYpCB4DtUfeFN7t386BR6lFmZxdEJbGVQdGcjX0FoynxNswLLIL2uvK+7C+54e6cDM0pjovUlOe3KS3mIWA9kfgd8cvcHNhnLnVn/gpfKyugbTJDhPqXzxvzxFcZEqRrmKUa5ylKv8p2sXZklqbpqtMP1NP2Bd9y2AAAMAhWLExmwDAAA=$";
    const MsgHandler = struct {
        fn handle(_: *anyopaque, _: []const u8) void {}
    };
    const handler: ProblemCallback = .{ .ctx = undefined, .onWarn = MsgHandler.handle, .onError = MsgHandler.handle };

    var asteroids = std.ArrayList(asteroid.Asteroid).init(alloc);
    _ = try parseRoidMask(bp, alloc, &.{
        .fallbackMode = .fluid,
        .shapeCodes = &[0][]const u8{},
        .fluidCodes = &[0][]const u8{},
    }, &handler, &asteroids);
}

test "parse blueprint with 3 islands and unknown types" {
    var arenaAlloc = std.heap.ArenaAllocator.init(std.testing.allocator);
    const alloc = arenaAlloc.allocator();
    defer arenaAlloc.deinit();

    const bp = "SHAPEZ2-4-H4sIAIxiVmoA/5yTXWvCMBSG/8vLLuNFqm0hl0MFYQNxQzaGSFgzFshSyQdYSv/7YjMqTIdZCQSSPO95Ti5Oiy0YpdOS4H4N1uLONQcBhpVVXFcgWL3X+vQw546DvUGGM1sr7j5q82VBtFcqbrCf/CDYxseFXUew0M5IYUOwxQvYpCB4DtUfeFN7t386BR6lFmZxdEJbGVQdGcjX0FoynxNswLLIL2uvK+7C+54e6cDM0pjovUlOe3KS3mIWA9kfgd8cvcHNhnLnVn/gpfKyugbTJDhPqXzxvzxFcZEqRrmKUa5ylKv8p2sXZklqbpqtMP1NP2Bd9y2AAAMAhWLExmwDAAA=$";
    var _messages = std.ArrayList([]const u8).init(alloc);

    const MessageCollector = struct {
        const Self = @This();
        messages: *std.ArrayList([]const u8),
        fn handle(ctx: *anyopaque, msg: []const u8) void {
            const self: *Self = @ptrCast(@alignCast(ctx));
            var msgSlot: *[]const u8 = self.messages.addOne() catch unreachable;
            msgSlot.ptr = msg.ptr;
            msgSlot.len = msg.len;
        }
    };

    var collector = MessageCollector{ .messages = &_messages };
    const handler: ProblemCallback = .{ .ctx = &collector, .onWarn = MessageCollector.handle, .onError = MessageCollector.handle };

    var asteroids = std.ArrayList(asteroid.Asteroid).init(alloc);
    _ = try parseRoidMask(bp, alloc, &.{}, &handler, &asteroids);

    try std.testing.expectEqual(3, _messages.items.len);
    for (_messages.items) |msg| {
        const expected = "Unrecognized island type: 'Foundation_1x1'";
        try std.testing.expectEqualStrings(expected, msg[0..(expected.len)]);
    }

    // std.debug.print("found items: {}\n", .{asteroids.items.len});
    // for (asteroids.items) |roid| {
    //     std.debug.print("  roid, maxX: {} , maxY: {} , origin: {} {} , type: {}\n", .{ roid.maxX, roid.maxY, roid.originX, roid.originY, roid.asteroidType });
    //     var iter = roid.gridSet.iterator(.{});
    //     while (iter.next()) |pos| {
    //         const x = asteroid.decodeX(roid.maxY, @intCast(pos));
    //         const y = asteroid.decodeY(roid.maxY, @intCast(pos));
    //         std.debug.print("    pos: {} {}\n", .{ x, y });
    //     }
    // }

    try std.testing.expectEqual(3, asteroids.items.len);
    var found3: bool = false;
    var found5: bool = false;
    var found8: bool = false;
    for (asteroids.items) |roid| {
        const numTiles = roid.gridSet.count();
        if (numTiles == 3) {
            if (found3) {
                std.debug.print("expected only one island to contain 3 tiles, but found at least 2", .{});
                return error.unexpected_num_tiles;
            }
            found3 = true;

            try std.testing.expectEqual(-3, roid.originX);
            try std.testing.expectEqual(-2, roid.originY);
            try std.testing.expectEqual(1, roid.maxX);
            try std.testing.expectEqual(1, roid.maxY);
            try std.testing.expectEqual(asteroid.AsteroidType.shape, roid.asteroidType);
            try std.testing.expect(roid.gridSet.isSet(asteroid.encodeUnsafe(&roid, 1, 0)));
            try std.testing.expect(roid.gridSet.isSet(asteroid.encodeUnsafe(&roid, 0, 1)));
            try std.testing.expect(roid.gridSet.isSet(asteroid.encodeUnsafe(&roid, 1, 1)));
        } else if (numTiles == 5) {
            if (found5) {
                std.debug.print("expected only one island to contain 5 tiles, but found at least 2", .{});
                return error.unexpected_num_tiles;
            }
            found5 = true;

            try std.testing.expectEqual(-6, roid.originX);
            try std.testing.expectEqual(0, roid.originY);
            try std.testing.expectEqual(2, roid.maxX);
            try std.testing.expectEqual(1, roid.maxY);
            try std.testing.expectEqual(asteroid.AsteroidType.shape, roid.asteroidType);
            try std.testing.expect(roid.gridSet.isSet(asteroid.encodeUnsafe(&roid, 0, 0)));
            try std.testing.expect(roid.gridSet.isSet(asteroid.encodeUnsafe(&roid, 1, 0)));
            try std.testing.expect(roid.gridSet.isSet(asteroid.encodeUnsafe(&roid, 2, 0)));
            try std.testing.expect(roid.gridSet.isSet(asteroid.encodeUnsafe(&roid, 0, 1)));
            try std.testing.expect(roid.gridSet.isSet(asteroid.encodeUnsafe(&roid, 2, 1)));
        } else if (numTiles == 8) {
            if (found8) {
                std.debug.print("expected only one island to contain 8 tiles, but found at least 2", .{});
                return error.unexpected_num_tiles;
            }
            found8 = true;

            try std.testing.expectEqual(4, roid.originX);
            try std.testing.expectEqual(-2, roid.originY);
            try std.testing.expectEqual(3, roid.maxX);
            try std.testing.expectEqual(1, roid.maxY);
            try std.testing.expectEqual(asteroid.AsteroidType.fluid, roid.asteroidType);
            try std.testing.expect(roid.gridSet.isSet(asteroid.encodeUnsafe(&roid, 0, 0)));
            try std.testing.expect(roid.gridSet.isSet(asteroid.encodeUnsafe(&roid, 1, 0)));
            try std.testing.expect(roid.gridSet.isSet(asteroid.encodeUnsafe(&roid, 2, 0)));
            try std.testing.expect(roid.gridSet.isSet(asteroid.encodeUnsafe(&roid, 3, 0)));
            try std.testing.expect(roid.gridSet.isSet(asteroid.encodeUnsafe(&roid, 0, 1)));
            try std.testing.expect(roid.gridSet.isSet(asteroid.encodeUnsafe(&roid, 1, 1)));
            try std.testing.expect(roid.gridSet.isSet(asteroid.encodeUnsafe(&roid, 2, 1)));
            try std.testing.expect(roid.gridSet.isSet(asteroid.encodeUnsafe(&roid, 3, 1)));
        } else {
            std.debug.print("expected islands to contain 3, 5 or 8 tiles, but found: {}", .{numTiles});
            return error.unexpected_num_tiles;
        }
    }
}
