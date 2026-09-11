const std = @import("std");
const asteroid = @import("./Asteroid.zig");
const solver = @import("./AsteroidSolver.zig");

const colorUnoccupied = 0xffffff;

pub const ImageData = struct {
    width: usize,
    height: usize,
    data: []u24,
};

pub fn render(
    alloc: std.mem.Allocator,
    roid: *const asteroid.Asteroid,
    p0: *const solver.Phase0Data,
    p1: *const solver.Phase1Data,
) !*ImageData {
    const result: *ImageData = try alloc.create(ImageData);
    result.width = @intCast(roid.maxX + 1);
    result.height = @intCast(roid.maxY + 1);
    result.data = try alloc.alloc(u24, result.width * result.height);
    @memset(result.data, 0);

    var gridIter = roid.gridSet.iterator(.{});
    while (gridIter.next()) |encPos| {
        const x = asteroid.decodeX(roid.maxY, @intCast(encPos));
        const y = asteroid.decodeY(roid.maxY, @intCast(encPos));
        const encImgPos = x + ((roid.maxX + 1) * y);
        result.data[encImgPos] = colorUnoccupied;
    }

    const numShades = 8;
    const step = 255 / numShades;
    var curShade: u8 = step;
    var tempMinoIds: [4]u32 = undefined;
    for (0.., p1.edgeMinerChoices) |i, c| {
        if (solver.decodeTetrominoLayout(roid, p0, i, &p0.tileList.items[i], c, &tempMinoIds)) {
            for (tempMinoIds) |id| {
                drawTile(roid, p0, result, id, @as(u24, @intCast(curShade)) << 8);
            }
            curShade, const overflow = @addWithOverflow(curShade, step);
            if (overflow != 0) {
                curShade = step;
            }
        }
    }

    return result;
}

pub fn renderP2(
    alloc: std.mem.Allocator,
    roid: *const asteroid.Asteroid,
    p0: *const solver.Phase0Data,
    p1: *const solver.Phase1Data,
    p2: *const solver.Phase2Data,
) !*ImageData {
    const result = try render(alloc, roid, p0, p1);
    const numShades = 8;
    const step = 255 / numShades;
    var curShade: u8 = step;
    var tempMinoIds: [4]u32 = undefined;
    for (p2.updatedEdges.items) |*update| {
        const updTile: *solver.Tile = &p0.tileList.items[update.edgeId];
        if (solver.decodeTetrominoLayout(roid, p0, update.edgeId, updTile, update.encChoice, &tempMinoIds)) {
            for (tempMinoIds) |id| {
                if (update.occupy == 0) {
                    drawTile(roid, p0, result, id, colorUnoccupied);
                } else {
                    drawTile(roid, p0, result, id, @as(u24, curShade));
                }
            }
            if (update.occupy == 1) {
                curShade, const overflow = @addWithOverflow(curShade, step);
                if (overflow != 0) {
                    curShade = step;
                }
            }
        }
    }
    return result;
}

pub fn renderP3(
    alloc: std.mem.Allocator,
    roid: *const asteroid.Asteroid,
    p0: *const solver.Phase0Data,
    p1: *const solver.Phase1Data,
    p2: *const solver.Phase2Data,
    p3: *const solver.Phase3Data,
) !*ImageData {
    const result = try renderP2(alloc, roid, p0, p1, p2);
    const colorCycle = [_]u24{
        0x602000,
        0x404000,
        0x206000,
        0x006020,
        0x004040,
        0x002060,
        0x200060,
        0x400040,
        0x600020,
    };
    const colorShifts = [_]u24{
        0x060606,
        0x0A0A0A,
        0x0E0E0E,
    };
    var curColorIdx: usize = 0;
    for (p3.committedChoices) |*choice| {
        const id = choice.choice.gridId;
        const tile = &p0.tileList.items[id];
        const extIds = &choice.choice.minerExtIds;
        if (choice.occupy == 0) {
            drawTile(roid, p0, result, id, colorUnoccupied);
            for (tile.nIds) |nId| {
                drawTile(roid, p0, result, nId, colorUnoccupied);
            }
            for (extIds) |extId| {
                drawTile(roid, p0, result, extId, colorUnoccupied);
            }
        } else {
            const color = colorCycle[curColorIdx];
            const color1 = color | colorShifts[0];
            const color2 = color | colorShifts[1];
            const color3 = color | colorShifts[2];
            const liftDir = choice.choice.miner.dir;
            drawTile(roid, p0, result, id, color);
            drawTile(roid, p0, result, tile.nIds[liftDir & 0b11], color);
            drawTile(roid, p0, result, tile.nIds[(liftDir + 1) & 0b11], color1);
            drawTile(roid, p0, result, tile.nIds[(liftDir + 2) & 0b11], color2);
            drawTile(roid, p0, result, tile.nIds[(liftDir + 3) & 0b11], color3);
            for (0..3, 3.., 6..) |i_1, i_2, i_3| {
                drawTile(roid, p0, result, extIds[i_1], color1);
                drawTile(roid, p0, result, extIds[i_2], color2);
                drawTile(roid, p0, result, extIds[i_3], color3);
            }

            curColorIdx += 1;
            if (curColorIdx >= colorCycle.len) {
                curColorIdx = 0;
            }
        }
    }
    return result;
}

fn drawTile(roid: *const asteroid.Asteroid, p0: *const solver.Phase0Data, img: *ImageData, id: u32, color: u24) void {
    const tile = &p0.tileList.items[id];
    const encTile = tile.x + ((roid.maxX + 1) * tile.y);
    img.data[encTile] = color;
}

pub fn writeToFile(alloc: std.mem.Allocator, image: *const ImageData, fileWithoutExt: []const u8) !void {
    var parentDir = try alloc.alloc(u8, fileWithoutExt.len + "/..".len);
    @memcpy(parentDir[0..fileWithoutExt.len], fileWithoutExt);
    @memcpy(parentDir[fileWithoutExt.len..], "/..");

    var fileWithExt = try alloc.alloc(u8, fileWithoutExt.len + ".ppm".len);
    @memcpy(fileWithExt[0..fileWithoutExt.len], fileWithoutExt);
    @memcpy(fileWithExt[fileWithoutExt.len..], ".ppm");

    try std.fs.cwd().makePath(parentDir);
    const file = try std.fs.cwd().createFile(fileWithExt, .{});
    defer file.close();
    try file.writeAll(try std.fmt.allocPrint(alloc, "P6 {} {} 255\n", .{ image.width, image.height }));
    for (image.data) |pixel| {
        const components: *const [3]u8 = @ptrCast(&pixel);
        try file.writeAll(components[0..3]);
    }
}
