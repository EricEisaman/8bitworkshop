"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const errormarkup_1 = require("../../src/common/errormarkup");
(0, mocha_1.describe)('error markup', function () {
    (0, mocha_1.it)('splits backtick code spans from plain text', function () {
        assert_1.default.deepStrictEqual((0, errormarkup_1.parseErrorText)('use `text!("..")` here'), [
            { text: 'use ' },
            { text: 'text!("..")', code: true },
            { text: ' here' },
        ]);
        assert_1.default.deepStrictEqual((0, errormarkup_1.parseErrorText)('`a` and `b`'), [
            { text: 'a', code: true },
            { text: ' and ' },
            { text: 'b', code: true },
        ]);
    });
    (0, mocha_1.it)('leaves unmatched backticks and plain text alone', function () {
        assert_1.default.deepStrictEqual((0, errormarkup_1.parseErrorText)('unclosed `x'), [{ text: 'unclosed `x' }]);
        assert_1.default.deepStrictEqual((0, errormarkup_1.parseErrorText)('a `code\nspan`'), [{ text: 'a `code\nspan`' }]);
        assert_1.default.deepStrictEqual((0, errormarkup_1.parseErrorText)(''), []);
    });
});
//# sourceMappingURL=testerrormarkup.js.map