const std = @import("std");
const bpParser = @import("../lib/BlueprintParser.zig");
const bpWriter = @import("../lib/BlueprintWriter.zig");
const ProblemCallback = @import("../lib/ProblemCallback.zig");
const dt = @import("../lib/DataTypes.zig");

test "encode and decode matches" {
    var arenaAlloc = std.heap.ArenaAllocator.init(std.testing.allocator);
    const alloc = arenaAlloc.allocator();
    defer arenaAlloc.deinit();

    const ErrorHandler = struct {
        const Self = @This();
        fn onWarn(_: *anyopaque, _: []const u8) void {}
        fn onError(_: *anyopaque, _: []const u8) void {}
    };

    var handlerInstance = ErrorHandler{};
    var problemCallback: ProblemCallback = .{
        .ctx = &handlerInstance,
        .onWarn = ErrorHandler.onWarn,
        .onError = ErrorHandler.onError,
    };

    const bpStr = "SHAPEZ2-4-H4sIAP+XU2oA/6xZXYviMBT9L2Ef+zDpd/tYnAVBQdSRHZZhCRpnw3ZTiXFnRPzvW6eptp3RJjciKNqennO/b+sBLVCKsRc5KJug9IC+yf2GohQNtznhK+Sg4bLgpwMDIglKfyJWfk8nOZHrQvzdIofv8rx6Q9vfZEPT6a56oZejgx65FIxuS+ABzcvLjsi+2Mlfs9OZY8apKBmyJm+2Y/mK8de7Mv8obfQd9Fx9TFHqOR9qHt+lIEtZiAFdk10uh1xSwUm+IIIRLtHRqbCeBda1wGI4NoFDYzg0gkNDCz8pWlyhMprLSSHkjPIVFT2YBwCm5Bmh1IWxlUgMRrpgtSacKhReMxQnoIrC90K8EbG6nQIwcGwDTmzAymb3CnhE193sGzMhCkFXHcNbVxhT8UqFOy/w6La7MJw3MVbe8bam4i5v3Co6fVzd1WBxqvspEO1ZoX0rNLZOsdp4wxyrrQYGujYbkGFJK0dGbC3dp02Pmx7ATTa4gZzSJWX/rmPDTpu1DZFFQdfhwtBAYdPMDM7GgzWHn8apHnVoJ1nhZpucyfJEPC+8HkQV20ZG4qdNRpZ/9MiqSQqp/qCzAdzB0+2xburvS43oeO8yH8/10fThoHjjfV4Mdbyo4YHqOlFTg143ij4D9YurYg2aYKN9WpO2rRVCl5i65+vBDqeGINVwBARVNVxgVBUvSLIHiavqAwnYUJBU3zYnLrLPtWsmPqzxkH0NZHPQsNkzavdh21YzxVHX0P69xYcb2ZTqAsISfW1qv+ZzE+6uS9rjIGpL16aucLG5sZXk8ApQ58Y0NuveMKqkSaW1MsfWbDCsWtVj803dhcZQ9WugXs8sikomkMxvkplqBHIGTU6dtc6/C9uNmaC1jsY2zKAbvRg8yKKuYt1eGZuu3FFbqemDP5OyfHFQxjgR+wUVW3Z67H76T+B49ff/AgwAVmNIEjcYAAA=$";
    _, const parsedBp = try bpParser.parseGeneric(bpStr, alloc, &problemCallback);
    const writtenBp = try bpWriter.encodeBlueprint(alloc, parsedBp, ._5);
    _, const reParsedBp = try bpParser.parseGeneric(writtenBp.items, alloc, &problemCallback);

    const parsedBpJson = try std.json.stringifyAlloc(alloc, parsedBp, .{});
    const reParsedBpJson = try std.json.stringifyAlloc(alloc, reParsedBp, .{});
    try std.testing.expectEqualSlices(u8, parsedBpJson, reParsedBpJson);
}
