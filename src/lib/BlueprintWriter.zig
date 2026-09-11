const std = @import("std");
const dt = @import("./DataTypes.zig");
const asteroid = @import("./Asteroid.zig");
const solver = @import("./AsteroidSolver.zig");
const tet = @import("./Tetromino.zig");

pub fn solverSolutionToBlueprint(
    alloc: std.mem.Allocator,
    roid: *const asteroid.Asteroid,
    p0: *const solver.Phase0Data,
    p1: *const solver.Phase1Data,
    p2: *const solver.Phase2Data,
    p3: *const solver.Phase3Data,
    rots: *const solver.TileRotations,
    minerContentRotations: *const [dt.Rotation.numRotations]dt.BuildingBlueprint,
) !*dt.IslandBlueprint {
    var mergedEdgeChoices = try alloc.alloc(u32, p1.edgeMinerChoices.len);
    @memcpy(mergedEdgeChoices, p1.edgeMinerChoices);
    for (p2.updatedEdges.items) |update| {
        if (update.occupy == 0) {
            mergedEdgeChoices[update.edgeId] = solver.CHOICE_SKIP;
        } else {
            mergedEdgeChoices[update.edgeId] = update.encChoice;
        }
    }
    var tempMinoIds: [4]u32 = undefined;

    var result = try alloc.create(dt.IslandBlueprint);
    const numOccupiedTiles = p0.occupancy.count();
    result.Entries = try alloc.alloc(dt.IslandEntry, numOccupiedTiles);
    var islandEntryList = dt.FixedList(dt.IslandEntry){ .items = result.Entries };

    for (0.., mergedEdgeChoices) |edgeId, edgeChoice| {
        const edgeTile = &p0.tileList.items[edgeId];
        if (solver.decodeTetrominoLayout(roid, p0, edgeId, edgeTile, edgeChoice, &tempMinoIds)) {
            addMinerAndExtIslands(roid, p0, minerContentRotations, rots, &tempMinoIds, &islandEntryList);
        }
    }

    var numP3Deoccupied: u32 = 0;
    var p3ChoiceIdx: usize = p3.committedChoices.len;
    while (p3ChoiceIdx > 0) : (p3ChoiceIdx -= 1) {
        const p3Choice = p3.committedChoices[p3ChoiceIdx - 1];
        if (p3Choice.occupy == 0) {
            numP3Deoccupied += 1;
            continue;
        }
        if (numP3Deoccupied > 0) {
            numP3Deoccupied -= 1;
            continue;
        }

        addCenterMinerIslands(
            roid,
            p0,
            minerContentRotations,
            rots,
            p3Choice.choice.gridId,
            p3Choice.choice.miner,
            &p3Choice.choice.minerExtIds,
            &islandEntryList,
        );
    }

    // occupancy should always match final p1/p2/p3 choices
    std.debug.assert(islandEntryList.numItems == islandEntryList.items.len);

    return result;
}

fn addMinerAndExtIslands(
    roid: *const asteroid.Asteroid,
    p0: *const solver.Phase0Data,
    minerContentRotations: []const dt.BuildingBlueprint,
    rots: *const solver.TileRotations,
    tileIds: *const [4]u32,
    collector: *dt.FixedList(dt.IslandEntry),
) void {
    const rot = rots.get(tileIds[0]);
    collector.add(getMinerIslandEntry(roid, &p0.tileList.items[tileIds[0]], rots.get(tileIds[0]), &minerContentRotations[@intFromEnum(rot)]));
    for (0..3) |i| {
        collector.add(getExtenderIslandEntry(roid, &p0.tileList.items[tileIds[1 + i]], rots.get(tileIds[1 + i])));
    }
}

fn addCenterMinerIslands(
    roid: *const asteroid.Asteroid,
    p0: *const solver.Phase0Data,
    minerContentRotations: []const dt.BuildingBlueprint,
    rots: *const solver.TileRotations,
    centerTileId: u32,
    miner: *const tet.CenterMinerInfo,
    minerExtIds: *const [9]u32,
    collector: *dt.FixedList(dt.IslandEntry),
) void {
    const centerTile = &p0.tileList.items[centerTileId];
    collector.add(getTripleMergeIslandEntry(roid, centerTile, rots.get(centerTileId)));

    const liftTileId = centerTile.nIds[miner.dir & 0b11];
    collector.add(getLiftIslandEntry(roid, &p0.tileList.items[liftTileId], rots.get(liftTileId)));

    for (0..3) |i| {
        const minerTileId = centerTile.nIds[(miner.dir + i + 1) & 0b11];
        const minerRot = rots.get(minerTileId);
        collector.add(getMinerIslandEntry(roid, &p0.tileList.items[minerTileId], minerRot, &minerContentRotations[@intFromEnum(minerRot)]));
        for (0..3) |extI| {
            const extIdx = (i * 3) + extI;
            const extTileId = minerExtIds[extIdx];
            collector.add(getExtenderIslandEntry(roid, &p0.tileList.items[extTileId], rots.get(extTileId)));
        }
    }
}

fn getMinerIslandEntry(roid: *const asteroid.Asteroid, tile: *const solver.Tile, r: dt.Rotation, b: *const dt.BuildingBlueprint) dt.IslandEntry {
    return .{
        .X = @as(i32, @intCast(tile.x)) + roid.originX,
        .Y = @as(i32, @intCast(tile.y)) + roid.originY,
        .Z = 0,
        .R = r,
        .T = switch (roid.asteroidType) {
            .shape => "Layout_ShapeMiner",
            .fluid => "Layout_FluidMiner",
        },
        .S = null,
        .C = null,
        .B = b.*,
    };
}

fn getExtenderIslandEntry(roid: *const asteroid.Asteroid, tile: *const solver.Tile, r: dt.Rotation) dt.IslandEntry {
    return .{
        .X = @as(i32, @intCast(tile.x)) + roid.originX,
        .Y = @as(i32, @intCast(tile.y)) + roid.originY,
        .Z = 0,
        .R = r,
        .T = switch (roid.asteroidType) {
            .shape => "Layout_ShapeMinerExtension",
            .fluid => "Layout_FluidMinerExtension",
        },
        .S = null,
        .C = null,
        .B = null,
    };
}

fn getTripleMergeIslandEntry(roid: *const asteroid.Asteroid, tile: *const solver.Tile, r: dt.Rotation) dt.IslandEntry {
    return .{
        .X = @as(i32, @intCast(tile.x)) + roid.originX,
        .Y = @as(i32, @intCast(tile.y)) + roid.originY,
        .Z = 0,
        .R = r,
        .T = switch (roid.asteroidType) {
            .shape => "SpaceBelt_TripleMerger",
            .fluid => "SpacePipe_TripleMerger",
        },
        .S = null,
        .C = null,
        .B = null,
    };
}

fn getLiftIslandEntry(roid: *const asteroid.Asteroid, tile: *const solver.Tile, r: dt.Rotation) dt.IslandEntry {
    return .{
        .X = @as(i32, @intCast(tile.x)) + roid.originX,
        .Y = @as(i32, @intCast(tile.y)) + roid.originY,
        .Z = 0,
        .R = r,
        .T = switch (roid.asteroidType) {
            .shape => "SpaceBelt_Lift1UpForward",
            .fluid => "SpacePipe_Lift1UpForward",
        },
        .S = null,
        .C = null,
        .B = null,
    };
}

pub fn getRotatedCopy(alloc: std.mem.Allocator, srcBp: *const dt.BuildingBlueprint, outBp: *dt.BuildingBlueprint) !void {
    outBp.* = .{
        .Entries = try alloc.alloc(dt.BuildingEntry, srcBp.Entries.len),
    };
    for(0.., srcBp.Entries)|i, entry| {
        outBp.Entries[i] = .{
            .X = 19 - entry.Y,
            .Y = entry.X,
            .L = entry.L,
            .R = entry.R.rotate(),
            .T = entry.T,
            .C = entry.C,
        };
    }
}

fn EncoderWriter(comptime WriterType: type) type {
    return struct {
        inputBuffer: [3]u8 = undefined,
        inputBufferLen: u2 = 0,
        dest: WriterType,

        const Self = @This();
        const encoder = std.base64.Base64Encoder.init(std.base64.standard_alphabet_chars, '=');
        pub const Writer = std.io.Writer(*Self, std.mem.Allocator.Error, appendWrite);

        pub fn init(wrt: WriterType) Self {
            return Self{
                .dest = wrt,
            };
        }

        pub fn writer(self: *Self) Writer {
            return .{ .context = self };
        }

        fn appendWrite(self: *Self, m: []const u8) std.mem.Allocator.Error!usize {
            var remainingMsg: []const u8 = m;
            var encoderBuf: [4]u8 = undefined;
            if (self.inputBufferLen > 0) {
                const numToTake = @min(3 - self.inputBufferLen, m.len);
                if (numToTake == 0) {
                    return 0;
                }

                @memcpy(self.inputBuffer[self.inputBufferLen..(self.inputBufferLen + numToTake)], m[0..numToTake]);
                self.inputBufferLen += numToTake;
                remainingMsg = m[numToTake..];
                if (self.inputBufferLen < 3) {
                    // fully drained the message into the buffer
                    return m.len;
                }

                const encoded = encoder.encode(&encoderBuf, self.inputBuffer[0..]);
                self.dest.writeAll(encoded) catch {
                    return std.mem.Allocator.Error.OutOfMemory;
                };
                self.inputBufferLen = 0;
            }

            if (remainingMsg.len <= 0) {
                return m.len;
            }

            while (remainingMsg.len >= 3) {
                const encoded = encoder.encode(&encoderBuf, remainingMsg[0..3]);
                self.dest.writeAll(encoded) catch {
                    return std.mem.Allocator.Error.OutOfMemory;
                };
                remainingMsg = remainingMsg[3..];
            }

            if (remainingMsg.len > 0) {
                @memcpy(self.inputBuffer[0..remainingMsg.len], remainingMsg);
                self.inputBufferLen = @intCast(remainingMsg.len);
            }
            return m.len;
        }

        fn finish(self: *Self) std.mem.Allocator.Error!void {
            if (self.inputBufferLen <= 0) {
                return;
            }
            var encoderBuf: [4]u8 = undefined;
            const encoded = encoder.encode(&encoderBuf, self.inputBuffer[0..self.inputBufferLen]);
            self.dest.writeAll(encoded) catch {
                return std.mem.Allocator.Error.OutOfMemory;
            };
            self.inputBufferLen = 0;
        }
    };
}

pub fn encodeBlueprint(
    alloc: std.mem.Allocator,
    blueprint: *const dt.IslandBlueprint,
    version: dt.BlueprintVersion,
) !std.ArrayList(u8) {
    if (version == .other)
        return error.unsupportedBlueprintVersion;

    var blueprintStr = try std.ArrayList(u8).initCapacity(alloc, 4096);
    var rawBpWriter = blueprintStr.writer();

    try rawBpWriter.writeAll("SHAPEZ2-");
    switch (version) {
        ._4 => try rawBpWriter.writeAll("4"),
        ._5 => try rawBpWriter.writeAll("5"),
        .other => unreachable,
    }
    try rawBpWriter.writeAll("-");

    const EncoderType: type = EncoderWriter(std.ArrayList(u8).Writer);
    var encoder = EncoderType.init(rawBpWriter);
    const CompressorType: type = std.compress.gzip.Compressor(EncoderType.Writer);
    var compressor = try CompressorType.init(encoder.writer(), .{});
    var writer = compressor.writer();
    try writer.writeAll("{\"V\":");
    const versionStr = switch (version) {
        ._4 => "1137",
        ._5 => "1138",
        .other => unreachable,
    };
    try writer.writeAll(versionStr);
    try writer.writeAll(",\"BP\":{\"$type\":\"Island\",");
    switch (version) {
        ._4 => {
            // this is only needed to suppress an error when upgrading the blueprint to S5, it imports fine without this icon in S4...
            try writer.writeAll("\"Icon\": {\"Data\": [\"icon:Platforms\",null,null,\"shape:RuRuRuRu\"]},");
            try writer.writeAll("\"Entries\":[");
            try writeBlueprintIslands(CompressorType.Writer, writer, blueprint, version);
            try writer.writeAll("]");
        },
        ._5 => {
            try writer.writeAll("\"Entries\":{\"$values\":[");
            try writeBlueprintIslands(CompressorType.Writer, writer, blueprint, version);
            try writer.writeAll("]}");
        },
        .other => unreachable,
    }
    try writer.writeAll("}}");

    try compressor.finish();
    try encoder.finish();

    switch (version) {
        ._4 => try rawBpWriter.writeAll("$"),
        ._5 => try rawBpWriter.writeAll("[]_2$"),
        .other => unreachable,
    }

    return blueprintStr;
}

fn writeBlueprintIslands(
    comptime WriterType: type,
    writer: WriterType,
    blueprint: *const dt.IslandBlueprint,
    version: dt.BlueprintVersion,
) !void {
    for (0.., blueprint.Entries) |i, entry| {
        if (i > 0) {
            try writer.writeAll(",");
        }
        try writer.writeAll("{\"X\":");
        try std.fmt.formatInt(entry.X, 10, .lower, .{}, writer);
        try writer.writeAll(",\"Y\":");
        try std.fmt.formatInt(entry.Y, 10, .lower, .{}, writer);
        try writer.writeAll(",\"Z\":");
        try std.fmt.formatInt(entry.Z, 10, .lower, .{}, writer);
        try writer.writeAll(",\"R\":");
        try std.fmt.formatInt(@intFromEnum(entry.R), 10, .lower, .{}, writer);
        try writer.writeAll(",\"T\":\"");
        try writer.writeAll(entry.T);
        try writer.writeAll("\",\"S\":");
        const sValue = if (entry.S) |x| (x) else std.json.Value.null;
        try std.json.fmt(sValue, .{}).format("", .{}, writer);
        try writer.writeAll(",\"C\":");
        const cValue = if (entry.C) |x| (x) else std.json.Value.null;
        try std.json.fmt(cValue, .{}).format("", .{}, writer);
        try writer.writeAll(",\"B\":");
        if (entry.B) |b| {
            try writer.writeAll("{\"$type\":\"Building\",\"Entries\":");
            switch (version) {
                ._4 => {
                    try writer.writeAll("[");
                    try writeBlueprintBuildings(WriterType, writer, &b);
                    try writer.writeAll("]");
                },
                ._5 => {
                    try writer.writeAll("{\"$values\":[");
                    try writeBlueprintBuildings(WriterType, writer, &b);
                    try writer.writeAll("]}");
                },
                .other => unreachable,
            }
            try writer.writeAll("}");
        } else {
            try writer.writeAll("null");
        }
        try writer.writeAll("}");
    }
}

fn writeBlueprintBuildings(
    comptime WriterType: type,
    writer: WriterType,
    blueprint: *const dt.BuildingBlueprint,
) !void {
    for (0.., blueprint.Entries) |i, entry| {
        if (i > 0) {
            try writer.writeAll(",");
        }
        try writer.writeAll("{\"X\":");
        try std.fmt.formatInt(entry.X, 10, .lower, .{}, writer);
        try writer.writeAll(",\"Y\":");
        try std.fmt.formatInt(entry.Y, 10, .lower, .{}, writer);
        try writer.writeAll(",\"L\":");
        try std.fmt.formatInt(entry.L, 10, .lower, .{}, writer);
        try writer.writeAll(",\"R\":");
        try std.fmt.formatInt(@intFromEnum(entry.R), 10, .lower, .{}, writer);
        try writer.writeAll(",\"T\":\"");
        try writer.writeAll(entry.T);
        try writer.writeAll("\",\"C\":");
        const cValue = if (entry.C) |x| (x) else std.json.Value.null;
        try std.json.fmt(cValue, .{}).format("", .{}, writer);
        try writer.writeAll("}");
    }
}
