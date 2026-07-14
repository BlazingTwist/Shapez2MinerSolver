const std = @import("std");
const md5 = @import("./Md5.zig");

var step: u8 = 0;
var buf: [32]u8 = std.mem.zeroes([32]u8);

export fn computeMd5(message: [*]const u8, len: u32) void {
    const msg_slice: []const u8 = message[0..len];
    var hash: [4]u32 = undefined;
    md5.computeMd5(msg_slice, &hash);

    step = 0;
    md5.toHexString(&hash, &buf) catch unreachable;
}

export fn stepOutput(hash_buffer: [*]u8) void {
    const buffer: *[8]u8 = hash_buffer[0..8];
    if (step >= 4) {
        for (0..8) |i| {
            buffer[i] = 0;
        }
        return;
    } else {
        const startIdx: u8 = step * 8;
        const endIdx: u8 = (step + 1) * 8;
        @memcpy(buffer, buf[startIdx..endIdx]);
        step += 1;
    }
}

test "hash matches expected" {
    const msg: []const u8 = "Hello, World!";
    var buffer: [32]u8 = undefined;
    computeMd5(msg.ptr, msg.len, buffer[0..32].ptr);
    const expected = "65a8e27d8879283831b664bd8b7f0ad4";
    try std.testing.expectEqualStrings(expected, &buffer);
}
