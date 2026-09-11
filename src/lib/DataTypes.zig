const std = @import("std");
const vec2i = @import("./util/Vector2I.zig");

pub const BlueprintVersion = enum {
    other,
    _4,
    _5,

    pub const latest: BlueprintVersion = ._5;
    pub const supportedVersionsStr: []const u8 = "(4, 5)";

    pub fn fromInt(int: u32) BlueprintVersion {
        return switch(int) {
            4 => ._4,
            5 => ._5,
            else => .other,
        };
    }
};

pub const Rotation = enum(u2) {
    east = 0,
    south = 1,
    west = 2,
    north = 3,

    pub const numRotations = 4;

    pub fn rotate(item: *const Rotation) Rotation {
        return @enumFromInt((@intFromEnum(item.*) + 1) & 0b11);
    }

    pub fn fromCardinalUnitVec(vec: vec2i.Vector2I) ?Rotation {
        if (vec.isCardinalUnitVec()) {
            if (vec.x == 1) return .east;
            if (vec.x == -1) return .west;
            if (vec.y == 1) return .south;
            if (vec.y == -1) return .north;
        }
        return null;
    }
};

pub const IslandBlueprint = struct {
    Entries: []IslandEntry,
};

pub const IslandEntry = struct {
    X: i32,
    Y: i32,
    Z: u2, // layer [0, 2]
    R: Rotation,
    T: []const u8, // Definition-name
    S: ?std.json.Value, // Configuration
    C: ?std.json.Value, // Always null
    B: ?BuildingBlueprint,
};

pub const BuildingBlueprint = struct {
    Entries: []BuildingEntry,
};

pub const BuildingEntry = struct {
    X: i32,
    Y: i32,
    L: u2, // layer [0, 2]
    R: Rotation,
    T: []const u8, // Definition-name
    C: ?std.json.Value, // Configuration
};

pub fn ArrayStack(comptime T: type) type {
    return struct {
        const Self = @This();
        stack: []T,
        next: usize = 0,
        pub fn init(alloc: std.mem.Allocator, maxNumItems: usize) !Self {
            return Self{
                .stack = try alloc.alloc(T, maxNumItems),
            };
        }
        pub fn clear(self: *Self) void {
            self.next = 0;
        }
        pub fn push(self: *Self, item: T) void {
            self.stack[self.next] = item;
            self.next += 1;
        }
        pub fn pop(self: *Self) T {
            self.next -= 1;
            return self.stack[self.next];
        }
        pub fn empty(self: *const Self) bool {
            return self.next == 0;
        }
    };
}

pub fn FixedList(comptime T: type) type {
    return struct {
        const Self = @This();
        items: []T,
        numItems: usize = 0,
        pub fn add(self: *Self, val: T) void {
            self.items[self.numItems] = val;
            self.numItems += 1;
        }
        pub fn slice(self: *const Self) []T {
            return self.items[0..self.numItems];
        }
    };
}
