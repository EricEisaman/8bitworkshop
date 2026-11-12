"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const version_1 = require("../../src/common/version");
(0, mocha_1.describe)('version', () => {
    (0, mocha_1.it)('returns no version when the build did not inject one', () => {
        // unit tests are compiled without the esbuild define
        assert_1.default.strictEqual((0, version_1.getAppVersion)(), '');
    });
    (0, mocha_1.it)('formats a version for display', () => {
        assert_1.default.strictEqual((0, version_1.getAppVersionLabel)('4.0.0'), 'v4.0.0');
        assert_1.default.strictEqual((0, version_1.getAppVersionLabel)('v4.0.0'), 'v4.0.0');
        assert_1.default.strictEqual((0, version_1.getAppVersionLabel)('V4.0.0'), 'V4.0.0');
        assert_1.default.strictEqual((0, version_1.getAppVersionLabel)(' 4.0.0 '), 'v4.0.0');
        assert_1.default.strictEqual((0, version_1.getAppVersionLabel)(''), '');
        assert_1.default.strictEqual((0, version_1.getAppVersionLabel)(undefined), '');
    });
});
//# sourceMappingURL=testversion.js.map