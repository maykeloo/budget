"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const index_1 = require("./index");
(0, vitest_1.describe)('MCP', () => {
    (0, vitest_1.it)('should return correct config', () => {
        const config = (0, index_1.getConfig)();
        (0, vitest_1.expect)(config.name).toBe('mcp');
        (0, vitest_1.expect)(config.version).toBe('1.0.0');
    });
});
//# sourceMappingURL=index.test.js.map