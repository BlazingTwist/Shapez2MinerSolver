pub const Vector2I = struct {
    x: i32 = 0,
    y: i32 = 0,

    const Self = @This();
    pub fn isCardinalUnitVec(self: *const Self) bool {
        if (self.x == 0 and (self.y == 1 or self.y == -1)) {
            return true;
        }
        if (self.y == 0 and (self.x == 1 or self.x == -1)) {
            return true;
        }
        return false;
    }
};

pub fn deltaVec(xFrom: u32, yFrom: u32, xTo: u32, yTo: u32) Vector2I {
    return .{
        .x = @as(i32, @intCast(xTo)) - @as(i32, @intCast(xFrom)),
        .y = @as(i32, @intCast(yTo)) - @as(i32, @intCast(yFrom)),
    };
}
