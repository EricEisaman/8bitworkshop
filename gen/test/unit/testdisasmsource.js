"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const workertypes_1 = require("../../src/common/workertypes");
const disasmsource_1 = require("../../src/ide/views/disasmsource");
function sourceFile(lines) {
    return new workertypes_1.SourceFile(lines, '');
}
(0, mocha_1.describe)('disassembly source lines', function () {
    (0, mocha_1.it)('maps source-line start addresses to their file, line and text', function () {
        const listings = {
            'main.c.lst': {
                lines: [],
                sourcefile: sourceFile([
                    { line: 2, offset: 0x100, path: 'main.c' },
                    { line: 3, offset: 0x104, path: 'main.c' },
                ]),
            },
        };
        const map = (0, disasmsource_1.buildSourceLineMap)(listings, (path, line) => path == 'main.c' ? ['', 'int main() {', '  x++;', '}'][line - 1] : null);
        assert_1.default.deepStrictEqual(map.get(0x100), { path: 'main.c', file: 'main.c', line: 2, text: 'int main() {' });
        assert_1.default.deepStrictEqual(map.get(0x104), { path: 'main.c', file: 'main.c', line: 3, text: '  x++;' });
    });
    (0, mocha_1.it)('derives the source path from a listing name when lines have no path', function () {
        // SDCC writes a hello.c.lst from hello.c, without a per-line file name
        const listings = {
            'hello.c.lst': {
                lines: [],
                sourcefile: sourceFile([{ line: 7, offset: 0x865 }]),
            },
        };
        const map = (0, disasmsource_1.buildSourceLineMap)(listings, (path, line) => path == 'hello.c' && line == 7 ? 'putstr(message);' : null);
        assert_1.default.strictEqual(map.get(0x865).text, 'putstr(message);');
    });
    (0, mocha_1.it)('keeps only the first line at an address', function () {
        const listings = {
            'main.c.lst': {
                lines: [],
                sourcefile: sourceFile([
                    { line: 10, offset: 0x100, path: 'main.c' },
                    { line: 11, offset: 0x100, path: 'main.c' },
                ]),
            },
        };
        const map = (0, disasmsource_1.buildSourceLineMap)(listings, (path, line) => `line ${line}`);
        assert_1.default.strictEqual(map.size, 1);
        assert_1.default.strictEqual(map.get(0x100).line, 10);
    });
    (0, mocha_1.it)('skips lines whose source text is not available', function () {
        const listings = {
            'main.c.lst': {
                lines: [],
                sourcefile: sourceFile([{ line: 1, offset: 0x100, path: 'missing.c' }]),
            },
        };
        assert_1.default.strictEqual((0, disasmsource_1.buildSourceLineMap)(listings, () => null).size, 0);
    });
    (0, mocha_1.it)('lets the caller omit assembly sources', function () {
        const listings = {
            'main.lst': {
                lines: [],
                sourcefile: sourceFile([
                    { line: 2, offset: 0x100, path: 'main.c' },
                    { line: 8, offset: 0x200, path: 'main.s' },
                ]),
            },
        };
        const read = (path, line) => `${path}:${line}`;
        const map = (0, disasmsource_1.buildSourceLineMap)(listings, read, path => !path.endsWith('.s'));
        assert_1.default.strictEqual(map.get(0x100).text, 'main.c:2');
        assert_1.default.strictEqual(map.get(0x200), undefined);
    });
    (0, mocha_1.it)('does not add a mixed listing\'s combined sourcefile twice', function () {
        const sf = sourceFile([{ line: 1, offset: 0x200, path: 'lib.c' }]);
        const listings = {
            'main.lst': {
                lines: [],
                sourcefile: sf,
                sourcefiles: { 'lib.c': sf },
            },
        };
        assert_1.default.strictEqual((0, disasmsource_1.buildSourceLineMap)(listings, () => 'x').size, 1);
    });
    (0, mocha_1.it)('formats a source line as a disassembly comment', function () {
        assert_1.default.strictEqual((0, disasmsource_1.formatSourceComment)({ path: 'src/main.c', file: 'main.c', line: 12, text: '  x++;  ' }), '; main.c:12:   x++;');
        assert_1.default.strictEqual((0, disasmsource_1.formatSourceComment)({ path: 'src/main.c', file: 'main.c', line: 13, text: '' }), '; main.c:13:');
    });
    (0, mocha_1.it)('recognizes its own source comments, not a listing comment', function () {
        assert_1.default.ok((0, disasmsource_1.isSourceComment)((0, disasmsource_1.formatSourceComment)({ path: 'src/main.c', file: 'main.c', line: 12, text: 'x++;' })));
        assert_1.default.ok(!(0, disasmsource_1.isSourceComment)('; main.c: 12: x++;')); // listing-style comment
        assert_1.default.ok(!(0, disasmsource_1.isSourceComment)('; a plain comment'));
        assert_1.default.ok(!(0, disasmsource_1.isSourceComment)('0865  A2 08  LDX #$08'));
    });
});
//# sourceMappingURL=testdisasmsource.js.map