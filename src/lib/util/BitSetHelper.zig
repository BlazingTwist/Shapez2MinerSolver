const std = @import("std");

pub fn copyInto(dest: *std.DynamicBitSet, src: *const std.DynamicBitSet) void {
    std.debug.assert(dest.unmanaged.bit_length == src.unmanaged.bit_length);
    const MaskInt = std.bit_set.DynamicBitSetUnmanaged.MaskInt;
    const num_masks = (dest.unmanaged.bit_length + (@bitSizeOf(MaskInt) - 1)) / @bitSizeOf(MaskInt);
    @memcpy(dest.unmanaged.masks[0..num_masks], src.unmanaged.masks[0..num_masks]);
}

pub fn anySetArr(comptime arrLen: usize, self: *const std.DynamicBitSet, idxArr: *const [arrLen]u32) bool {
    for (idxArr) |idx| {
        if (self.isSet(idx)) {
            return true;
        }
    }
    return false;
}

pub fn setAllArr(comptime arrLen: usize, self: *std.DynamicBitSet, idxArr: *const [arrLen]u32) void {
    for (idxArr) |idx| {
        self.set(idx);
    }
}

pub fn unsetAllArr(comptime arrLen: usize, self: *std.DynamicBitSet, idxArr: *const [arrLen]u32) void {
    for (idxArr) |idx| {
        self.unset(idx);
    }
}

pub fn anySetSlice(self: *const std.DynamicBitSet, idxSlice: []u32) bool {
    for (idxSlice) |idx| {
        if (self.isSet(idx)) {
            return true;
        }
    }
    return false;
}

pub fn setAllSlice(self: *std.DynamicBitSet, idxSlice: []u32) void {
    for (idxSlice) |idx| {
        self.set(idx);
    }
}

pub fn unsetAllSlice(self: *std.DynamicBitSet, idxSlice: []u32) void {
    for (idxSlice) |idx| {
        self.unset(idx);
    }
}
