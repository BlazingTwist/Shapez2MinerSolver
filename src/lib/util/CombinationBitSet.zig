const std = @import("std");

pub const CombinationBitSet32 = CombinationBitSet(u32);
pub const CombinationBitSet64 = CombinationBitSet(u64);

pub fn CombinationBitSet(comptime T: type) type {
    return struct {
        const Self = @This();
        const TBitCount: type = init: {
            const tInfo = @typeInfo(T);
            break :init @Type(std.builtin.Type{
                .Int = .{
                    .signedness = .unsigned,
                    .bits = @ceil(@log2(@as(f64, @floatFromInt(tInfo.Int.bits))))
                }
            });
        };
        bitset: T,
        limit: T,

        pub fn init(totalBits: TBitCount, activeBits: TBitCount) !Self {
            if (totalBits < activeBits)
                return error.totalBitsLessThanActiveBits;
            if (activeBits <= 0)
                return error.activeBitsLeqZero;

            return Self{
                .limit = @as(T, 1) << totalBits,
                .bitset = (@as(T, 1) << activeBits) - 1,
            };
        }

        pub fn next(self: *Self) ?T {
            if (self.bitset >= self.limit) {
                return null;
            }

            const result = self.bitset;

            // Gosper's hack
            const c = self.bitset & ((~self.bitset +% 1));
            const r = self.bitset +% c;
            self.bitset = (((r ^ self.bitset) >> 2) / c) | r;

            return result;
        }
    };
}

pub const BitIterator32 = BitIterator(u32);
pub const BitIterator64 = BitIterator(u64);

pub fn BitIterator(comptime T: type) type {
    return struct {
        const Self = @This();
        remain: T,

        pub fn init(bitset: T) Self {
            return Self{
                .remain = bitset,
            };
        }

        pub fn next(self: *Self) ?u5 {
            if (self.remain == 0) {
                return null;
            }

            const result: u5 = @intCast(@ctz(self.remain));
            self.remain &= self.remain - 1;
            return result;
        }
    };
}

test "CombinationBitSet32 basic iteration" {
    var combinations = try CombinationBitSet32.init(5, 3);
    const expected = [_]u32{
        0b00111,
        0b01011,
        0b01101,
        0b01110,
        0b10011,
        0b10101,
        0b10110,
        0b11001,
        0b11010,
        0b11100,
    };
    var expIdx: usize = 0;
    while(combinations.next())|result| {
        defer expIdx += 1;
        if(result != expected[expIdx]) {
            std.debug.print("ERROR: expected bitset = {}, but found bitset = {}, at step {}\n", .{expected[expIdx], result, expIdx});
            return error.unexpectedValue;
        }
    }
}

test "BitIterator basic test" {
    var iter = BitIterator32.init(0b11001010);
    const exp = [_]u5{
        1, 3, 6, 7
    };
    var expIdx: usize = 0;
    while(iter.next())|result| {
        defer expIdx += 1;
        if(result != exp[expIdx]) {
            std.debug.print("ERROR: expected bit = {}, but found bit = {}, at step {}\n", .{exp[expIdx], result, expIdx});
        }
    }
}