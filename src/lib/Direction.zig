const vec2i = @import("./util/Vector2I.zig");

pub const cardinals: []const vec2i.Vector2I = &.{
    .{ .x = 0, .y = -1 },
    .{ .x = 1, .y = 0 },
    .{ .x = 0, .y = 1 },
    .{ .x = -1, .y = 0 },
};

pub const eightNeighbors: []const vec2i.Vector2I = &.{
    .{ .x = 0, .y = -1 },
    .{ .x = 1, .y = -1 },
    .{ .x = 1, .y = 0 },
    .{ .x = 1, .y = 1 },
    .{ .x = 0, .y = 1 },
    .{ .x = -1, .y = 1 },
    .{ .x = -1, .y = 0 },
    .{ .x = -1, .y = -1 },
};

pub const cityBlock2: []const vec2i.Vector2I = &.{
    .{ .x = 0, .y = -2 },
    .{ .x = 1, .y = -1 },
    .{ .x = 2, .y = 0 },
    .{ .x = 1, .y = 1 },
    .{ .x = 0, .y = 2 },
    .{ .x = -1, .y = 1 },
    .{ .x = -2, .y = 0 },
    .{ .x = -1, .y = -1 },
};

pub const cityBlock3: []const vec2i.Vector2I = &.{
    .{ .x = 3, .y = 0 },
    .{ .x = 2, .y = 1 },
    .{ .x = 1, .y = 2 },
    .{ .x = 0, .y = 3 },
    .{ .x = -1, .y = 2 },
    .{ .x = -2, .y = 1 },
    .{ .x = -3, .y = 0 },
    .{ .x = -2, .y = -1 },
    .{ .x = -1, .y = -2 },
    .{ .x = 0, .y = -3 },
    .{ .x = 1, .y = -2 },
    .{ .x = 2, .y = -1 },
};

pub const cityBlockLessEq3 = init: {
    const numItems = cardinals.len + cityBlock2.len + cityBlock3.len;
    var resultBuf: [numItems]vec2i.Vector2I = undefined;
    var curIdx: usize = 0;
    for(cardinals)|v| {
        resultBuf[curIdx] = v;
        curIdx += 1;
    }
    for(cityBlock2)|v| {
        resultBuf[curIdx] = v;
        curIdx += 1;
    }
    for(cityBlock3)|v| {
        resultBuf[curIdx] = v;
        curIdx += 1;
    }
    break :init resultBuf;
};
