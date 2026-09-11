ctx: *anyopaque,
onWarn: *const fn (ctx: *anyopaque, warning: []const u8) void,
onError: *const fn (ctx: *anyopaque, err: []const u8) void,