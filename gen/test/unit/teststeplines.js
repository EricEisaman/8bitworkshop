"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const projectcore_1 = require("../../src/common/projectcore");
(0, mocha_1.describe)('sourceLineStartPCs', function () {
    (0, mocha_1.it)('keeps one start PC per run of entries on the same line (urust emits one per expression)', function () {
        const mk = (line, offset) => ({ line, offset, path: 'a.rs', iscode: true });
        const listings = { 'a.rs': { lines: [mk(1, 0x800), mk(1, 0x803), mk(1, 0x806), mk(2, 0x809), mk(2, 0x80b), mk(1, 0x80d)] } };
        (0, projectcore_1.processListings)(listings);
        assert_1.default.deepStrictEqual([...(0, projectcore_1.sourceLineStartPCs)(listings)].sort(), [0x800, 0x809, 0x80d]);
    });
});
//# sourceMappingURL=teststeplines.js.map