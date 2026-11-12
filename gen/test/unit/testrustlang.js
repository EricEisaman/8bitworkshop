"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const lang_rust_1 = require("@codemirror/lang-rust");
const language_1 = require("@codemirror/language");
const state_1 = require("@codemirror/state");
const toolmeta_1 = require("../../src/common/toolmeta");
const includedecorations_1 = require("../../src/ide/views/includedecorations");
const symbols_1 = require("../../src/common/symbols");
(0, mocha_1.describe)('Rust editor support', function () {
    (0, mocha_1.it)('maps .rs files to urust with the rust editor style', function () {
        assert_1.default.ok((0, toolmeta_1.getToolMetaForFilename)('main.rs').some(m => m.id === 'urust'));
        assert_1.default.strictEqual(toolmeta_1.TOOL_META.urust.editorStyle, 'rust');
    });
    (0, mocha_1.it)('parses a Rust source file', function () {
        const code = 'fn main() {\n    let x: u8 = 1; // hi\n    loop {}\n}\n';
        const state = state_1.EditorState.create({ doc: code, extensions: [(0, lang_rust_1.rust)()] });
        const names = [];
        (0, language_1.syntaxTree)(state).iterate({ enter: n => { names.push(n.name); } });
        for (const expected of ['FunctionItem', 'LetDeclaration', 'LoopExpression', 'LineComment']) {
            assert_1.default.ok(names.includes(expected), `expected ${expected} in ${names.join(' ')}`);
        }
    });
    (0, mocha_1.it)('shows one include badge per mod line, preferring the file that exists', function () {
        const doc = state_1.EditorState.create({ doc: 'mod audio;\nmod bcd;\n' }).doc;
        const ranges = [{ from: 0, to: doc.length }];
        // both foo.rs and foo/mod.rs patterns match each mod line; keep one badge
        assert_1.default.deepStrictEqual((0, includedecorations_1.findIncludeLinks)(doc, ranges, toolmeta_1.URUST_INCLUDE_PATTERNS).map(l => l.filename), ['audio.rs', 'bcd.rs']);
        // if only the subdirectory form exists, link to that one
        assert_1.default.deepStrictEqual((0, includedecorations_1.findIncludeLinks)(doc, ranges, toolmeta_1.URUST_INCLUDE_PATTERNS, fn => fn === 'audio/mod.rs').map(l => l.filename), ['audio/mod.rs', 'bcd.rs']);
    });
    (0, mocha_1.it)('links a nested rs8 module to the child source', function () {
        const doc = state_1.EditorState.create({
            doc: 'use rs8::nes::util::{pad_poll, ppu_off, PpuSafe};\nuse rs8::nes::PPUCTRL;\n'
        }).doc;
        const ranges = [{ from: 0, to: doc.length }];
        // the child module is its own file; an item of the parent stays with it
        assert_1.default.deepStrictEqual((0, includedecorations_1.findIncludeLinks)(doc, ranges, toolmeta_1.URUST_INCLUDE_PATTERNS).map(l => l.filename), ['nes/util.rs', 'nes.rs']);
    });
    (0, mocha_1.it)('shows a badge for each module in a use brace group', function () {
        const doc = state_1.EditorState.create({
            doc: 'use rs8::apple2;\nuse rs8::apple2::util;\nuse rs8::gfx::surface::*;\nuse rs8::{io, reset};\n'
        }).doc;
        const ranges = [{ from: 0, to: doc.length }];
        // `reset` is an item, not a module, so the group has one link
        assert_1.default.deepStrictEqual((0, includedecorations_1.findIncludeLinks)(doc, ranges, toolmeta_1.URUST_INCLUDE_PATTERNS).map(l => l.filename), ['apple2.rs', 'apple2/util.rs', 'gfx/surface.rs', 'io.rs']);
    });
    (0, mocha_1.it)('extracts Rust fn declarations as symbols', function () {
        const records = (0, symbols_1.extractSymbols)('fn draw(x: u8) {}\nfn main() {}\n', 'main.rs', 'rust', 'project');
        assert_1.default.deepStrictEqual(records.filter(r => r.kind === 'func').map(r => r.name), ['draw', 'main']);
    });
});
//# sourceMappingURL=testrustlang.js.map