"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const books_1 = require("../../src/common/books");
(0, mocha_1.describe)('bookFor', function () {
    (0, mocha_1.it)('finds the book for a platform and its variants', function () {
        var _a, _b, _c, _d, _e;
        assert_1.default.equal((_a = (0, books_1.bookFor)('nes')) === null || _a === void 0 ? void 0 : _a.id, 'nes');
        assert_1.default.equal((_b = (0, books_1.bookFor)('nes-asm')) === null || _b === void 0 ? void 0 : _b.id, 'nes');
        assert_1.default.equal((_c = (0, books_1.bookFor)('vcs.mame')) === null || _c === void 0 ? void 0 : _c.id, 'vcs');
        assert_1.default.equal((_d = (0, books_1.bookFor)('verilog-vga')) === null || _d === void 0 ? void 0 : _d.id, 'verilog');
        assert_1.default.equal((_e = (0, books_1.bookFor)('c64')) === null || _e === void 0 ? void 0 : _e.id, 'c64');
    });
    (0, mocha_1.it)('covers only the arcade platforms in the arcade book', function () {
        var _a;
        for (var p of ['mw8080bw', 'vicdual', 'galaxian-scramble', 'vector-z80color', 'williams-z80'])
            assert_1.default.equal((_a = (0, books_1.bookFor)(p)) === null || _a === void 0 ? void 0 : _a.id, 'arcade', p);
        for (var p of ['williams', 'vector-ataricolor', 'coleco', 'gb', 'msx', 'apple2'])
            assert_1.default.equal((0, books_1.bookFor)(p), undefined, p);
    });
});
(0, mocha_1.describe)('BOOK_DEMOS', function () {
    (0, mocha_1.it)('has a demo for every book', function () {
        for (var book of books_1.BOOKS)
            assert_1.default.ok(books_1.BOOK_DEMOS.some(d => d.book == book.id), book.id);
    });
    (0, mocha_1.it)('demos belong to their book and exist on disk', function () {
        var _a;
        for (var demo of books_1.BOOK_DEMOS) {
            assert_1.default.equal((_a = (0, books_1.bookFor)(demo.platform)) === null || _a === void 0 ? void 0 : _a.id, demo.book, demo.platform);
            const file = path_1.default.join('presets', demo.platform, demo.file);
            assert_1.default.ok(fs_1.default.existsSync(file), file);
        }
    });
});
(0, mocha_1.describe)('pickRandomBookDemo', function () {
    (0, mocha_1.it)('returns a demo for any random value', function () {
        for (var r of [0, 0.2, 0.5, 0.999, 1])
            assert_1.default.ok(books_1.BOOK_DEMOS.includes((0, books_1.pickRandomBookDemo)(() => r)), String(r));
    });
    (0, mocha_1.it)('spreads over the whole list', function () {
        var seen = new Set();
        for (var i = 0; i < 100; i++)
            seen.add((0, books_1.pickRandomBookDemo)().file);
        assert_1.default.ok(seen.size > 1, 'picks more than one demo');
    });
});
(0, mocha_1.describe)('firstVisitDemo', function () {
    (0, mocha_1.it)('picks a demo on a first visit with an empty query', function () {
        var demo = (0, books_1.firstVisitDemo)({}, true, () => 0);
        assert_1.default.equal(demo, books_1.BOOK_DEMOS[0]);
    });
    (0, mocha_1.it)('does nothing when it is not a first visit', function () {
        assert_1.default.equal((0, books_1.firstVisitDemo)({}, false, () => 0), null);
    });
    (0, mocha_1.it)('leaves a query that names its own platform, file, repo or upload alone', function () {
        for (var q of [{ platform: 'nes' }, { file: 'hello.c' }, { repo: 'user/repo' },
            { importURL: 'http://example.com/x.c' }, { file0_name: 'main.c' }])
            assert_1.default.equal((0, books_1.firstVisitDemo)(q, true, () => 0), null, JSON.stringify(q));
    });
});
//# sourceMappingURL=testbooks.js.map