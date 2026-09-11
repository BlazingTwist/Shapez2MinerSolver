const std = @import("std");
const bpParser = @import("../lib/BlueprintParser.zig");
const asteroid = @import("../lib/Asteroid.zig");
const solver = @import("../lib/AsteroidSolver.zig");
const renderer = @import("../lib/SolutionRenderer.zig");
const ProblemCallback = @import("../lib/ProblemCallback.zig");

test "solve 1st and 3rd island of blueprint with 3 small islands and unknown types" {
    std.debug.print("begin test 'solve 1st and 3rd island of blueprint with 3 small islands and unknown types'\n", .{});

    var arenaAlloc = std.heap.ArenaAllocator.init(std.testing.allocator);
    const alloc = arenaAlloc.allocator();
    defer arenaAlloc.deinit();

    const bp = "SHAPEZ2-4-H4sIAIxiVmoA/5yTXWvCMBSG/8vLLuNFqm0hl0MFYQNxQzaGSFgzFshSyQdYSv/7YjMqTIdZCQSSPO95Ti5Oiy0YpdOS4H4N1uLONQcBhpVVXFcgWL3X+vQw546DvUGGM1sr7j5q82VBtFcqbrCf/CDYxseFXUew0M5IYUOwxQvYpCB4DtUfeFN7t386BR6lFmZxdEJbGVQdGcjX0FoynxNswLLIL2uvK+7C+54e6cDM0pjovUlOe3KS3mIWA9kfgd8cvcHNhnLnVn/gpfKyugbTJDhPqXzxvzxFcZEqRrmKUa5ylKv8p2sXZklqbpqtMP1NP2Bd9y2AAAMAhWLExmwDAAA=$";

    const MessageHandler = struct {
        fn handle(_: *anyopaque, _: []const u8) void {
        }
    };

    var collector = MessageHandler{};
    const callback: ProblemCallback = .{
        .ctx = &collector,
        .onWarn = MessageHandler.handle,
        .onError  = MessageHandler.handle,
    };

    var asteroids = std.ArrayList(asteroid.Asteroid).init(alloc);
    _ = try bpParser.parseRoidMask(bp, alloc, &.{}, &callback, &asteroids);

    try std.testing.expectEqual(3, asteroids.items.len);

    {
        const roid = &asteroids.items[1];
        const p0 = try solver.phase0(alloc, roid, &callback);
        const p1Opts = solver.Phase1Options{};
        const p1 = try solver.phase1(alloc, roid, p0, &p1Opts);
        const p2Opts = solver.Phase2Options{};
        const p2 = try solver.phase2(alloc, roid, p0, p1, &p2Opts);

        std.debug.print("  smallRoid[0] tiles: ", .{});
        var gridIter = roid.gridSet.iterator(.{});
        while (gridIter.next()) |encPos| {
            const x = asteroid.decodeX(roid.maxY, @intCast(encPos));
            const y = asteroid.decodeY(roid.maxY, @intCast(encPos));
            std.debug.print(", ({}, {})", .{x, y});
        }
        std.debug.print("\n", .{});

        std.debug.print("  smallRoid[0]: p1 choices: {any}\n", .{p1.edgeMinerChoices});
        std.debug.print("  smallRoid[0]: p2 choices: {any}\n", .{p2.updatedEdges.items});

        try std.testing.expectEqual(p0.numEdges, p1.edgeMinerChoices.len);
        const numGaps = solver.countEdgeChoiceGaps(p1.edgeMinerChoices, p0.numEdges);
        try std.testing.expectEqual(3, numGaps); // 0 miners on 3 edges total
    }

    {
        const roid = &asteroids.items[2];
        const p0 = try solver.phase0(alloc, roid, &callback);
        const p1Opts = solver.Phase1Options{};
        const p1 = try solver.phase1(alloc, roid, p0, &p1Opts);
        const p2Opts = solver.Phase2Options{};
        const p2 = try solver.phase2(alloc, roid, p0, p1, &p2Opts);

        std.debug.print("  smallRoid[2] tiles: ", .{});
        var gridIter = roid.gridSet.iterator(.{});
        while (gridIter.next()) |encPos| {
            const x = asteroid.decodeX(roid.maxY, @intCast(encPos));
            const y = asteroid.decodeY(roid.maxY, @intCast(encPos));
            std.debug.print(", ({}, {})", .{x, y});
        }
        std.debug.print("\n", .{});

        std.debug.print("  smallRoid[2]: p1 choices: {any}\n", .{p1.edgeMinerChoices});
        std.debug.print("  smallRoid[2]: p2 choices: {any}\n", .{p2.updatedEdges.items});

        try std.testing.expectEqual(p0.numEdges, p1.edgeMinerChoices.len);
        const numGaps = solver.countEdgeChoiceGaps(p1.edgeMinerChoices, p0.numEdges);
        try std.testing.expectEqual(6, numGaps); // 2 miners on 8 edges total
    }
}

test "solve chokepoint asteroid should not fail phase 0/1/2" {
    var arenaAlloc = std.heap.ArenaAllocator.init(std.testing.allocator);
    const alloc = arenaAlloc.allocator();
    defer arenaAlloc.deinit();

    const bp = "SHAPEZ2-4-H4sIAFKnXmoA/5ySUQuCMBSF/8uhx/WgPgR7jHwQCsRCipAYtWhgU7YJiey/NxV67sqFO7adcz/udgeU4FGUbBi2OfiAletbCY7M1kI/wJDdGz1e7IQT4FeosOd5LdyzMW8Lpru6nhPsS7SSF90cqDxDqp1R0gbjgDP4OmG4hCViKMBjhlNA7UXfdO52HN0HpaVJP05qqwLXs5+Nqg8YKiUm6in1qV1TChP7JMqJr7Lsh5MlkL8ZVZhupYXpS2mmk2nkvf8KIMAACSZ8oP4CAAA=$";

    const MessageHandler = struct {
        fn handle(_: *anyopaque, _: []const u8) void {
        }
    };

    var collector = MessageHandler{};
    const callback: ProblemCallback = .{
        .ctx = &collector,
        .onWarn = MessageHandler.handle,
        .onError  = MessageHandler.handle,
    };

    var asteroids = std.ArrayList(asteroid.Asteroid).init(alloc);
    _ = try bpParser.parseRoidMask(bp, alloc, &.{}, &callback, &asteroids);

    try std.testing.expectEqual(1, asteroids.items.len);

    const roid = &asteroids.items[0];
    const p0 = try solver.phase0(alloc, roid, &callback);
    const p1Opts = solver.Phase1Options{};
    const p1 = try solver.phase1(alloc, roid, p0, &p1Opts);
    const p2Opts = solver.Phase2Options{};
    _ = try solver.phase2(alloc, roid, p0, p1, &p2Opts);

    try std.testing.expectEqual(p0.numEdges, p1.edgeMinerChoices.len);
    const numGaps = solver.countEdgeChoiceGaps(p1.edgeMinerChoices, p0.numEdges);
    try std.testing.expectEqual(9, numGaps); // 3 miners on 12 edges total
}