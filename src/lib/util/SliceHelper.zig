const std = @import("std");

pub fn intersects(comptime T: type, a: []const T, b: []const T) bool {
    for(b)|b_item| {
        if(std.mem.indexOfScalar(T, a, b_item) != null) {
            return true;
        }
    }
    return false;
}