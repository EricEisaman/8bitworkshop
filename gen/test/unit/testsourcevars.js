"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const sourcevars_1 = require("../../src/common/sourcevars");
(0, mocha_1.describe)('Source variables', function () {
    const mem = {
        0x10: 0x34, 0x11: 0x12, // u16 score = 0x1234
        0x12: 0xff, // i8 delta = -1
        0x13: 0x01, // bool running = true
        0x14: 0x01, 0x15: 0x02, 0x16: 0x03, // [u8; 3]
        0x30: 0x78, 0x31: 0x56, // global u16 SCORE = 0x5678
        0x40: 0xaa, 0x41: 0xbb, 0x42: 0xcc, // global [u8; 3] PALETTE
    };
    const read = (a) => mem[a] || 0;
    const symbolmap = { main: 0x8000, helper: 0x8100 };
    const symbolsizes = { main: 0x20, helper: 0x10 };
    const vars = [
        { name: 'score', type: 'u16', size: 2, function: 'main', addr: 0x10, range: [0x8000, 0x8010] },
        { name: 'score', type: 'u16', size: 2, function: 'main', addr: 0x20, range: [0x8010, 0x8020] },
        { name: 'delta', type: 'i8', size: 1, function: 'main', addr: 0x12, range: [0x8000, 0x8020] },
        { name: 'running', type: 'bool', size: 1, function: 'main', addr: 0x13, range: [0x8000, 0x8020] },
        { name: 'items', type: '[u8; 3]', size: 3, function: 'main', addr: 0x14, range: [0x8000, 0x8020] },
        // no storage: shown when its function is current, never guessed at
        { name: 'i', type: 'usize', size: 2, function: 'main', addr: null, range: null, location: 'optimized out' },
        { name: 'other', type: 'u8', size: 1, function: 'helper', addr: 0x10, range: null },
    ];
    const globals = [
        { name: 'SCORE', type: 'u16', size: 2, addr: 0x30, ram: true, mutable: true, file: 'main.rs', line: 12, col: 1 },
        { name: 'PALETTE', type: '[u8; 3]', size: 3, addr: 0x40, ram: false, mutable: false, file: 'main.rs', line: 16, col: 1, expandable: true },
    ];
    (0, mocha_1.it)('names a local operand in the frame of the instruction', function () {
        // score is at $10 in the first half of main and $20 in the second
        assert_1.default.strictEqual((0, sourcevars_1.localSymbolAt)(vars, 0x8004, 0x10, symbolmap, symbolsizes), 'score');
        assert_1.default.strictEqual((0, sourcevars_1.localSymbolAt)(vars, 0x8004, 0x11, symbolmap, symbolsizes), 'score+1');
        assert_1.default.strictEqual((0, sourcevars_1.localSymbolAt)(vars, 0x8014, 0x10, symbolmap, symbolsizes), null);
        assert_1.default.strictEqual((0, sourcevars_1.localSymbolAt)(vars, 0x8014, 0x21, symbolmap, symbolsizes), 'score+1');
        // helper's `other` is at $10 too, but only inside helper
        assert_1.default.strictEqual((0, sourcevars_1.localSymbolAt)(vars, 0x8104, 0x10, symbolmap, symbolsizes), 'other');
        // frame-relative variables have no fixed address
        const rel = [{ name: 'p', type: 'u8', size: 1, function: 'main', addr: 2, baseAddr: 0x80, range: [0x8000, 0x8020] }];
        assert_1.default.strictEqual((0, sourcevars_1.localSymbolAt)(rel, 0x8000, 2, symbolmap, symbolsizes), null);
    });
    (0, mocha_1.it)('rewrites an operand as a local, then a global, then a global+1', function () {
        const syms = { addr2symbol: { 0x10: 'GLOBAL', 0x30: 'SCORE' },
            symbolmap, symbolsizes, debuginfo: { sourceVariables: vars } };
        // the local beats the global at the same cell, but only where it is live
        assert_1.default.strictEqual((0, sourcevars_1.symbolizeOperand)('LDA $11', 0x8004, syms), 'LDA score+1');
        assert_1.default.strictEqual((0, sourcevars_1.symbolizeOperand)('LDA $10', 0x8104, syms), 'LDA other');
        assert_1.default.strictEqual((0, sourcevars_1.symbolizeOperand)('LDA $10', 0x9000, syms), 'LDA GLOBAL');
        assert_1.default.strictEqual((0, sourcevars_1.symbolizeOperand)('LDA $31', 0x9000, syms), 'LDA SCORE+1');
        assert_1.default.strictEqual((0, sourcevars_1.symbolizeOperand)('LDA #$10', 0x8004, syms), 'LDA #$10');
        assert_1.default.strictEqual((0, sourcevars_1.symbolizeOperand)('LDA $99', 0x8004, syms), 'LDA $99');
        assert_1.default.strictEqual((0, sourcevars_1.symbolizeOperand)('LDA $10', 0x8004, null), 'LDA $10');
    });
    (0, mocha_1.it)('reads the variables out of debuginfo', function () {
        assert_1.default.deepStrictEqual((0, sourcevars_1.sourceVariablesOf)({ sourceVariables: vars }), vars);
        assert_1.default.deepStrictEqual((0, sourcevars_1.sourceVariablesOf)({}), []);
        assert_1.default.deepStrictEqual((0, sourcevars_1.sourceVariablesOf)(null), []);
        assert_1.default.deepStrictEqual((0, sourcevars_1.globalVariablesOf)({ globalVariables: globals }), globals);
        assert_1.default.deepStrictEqual((0, sourcevars_1.globalVariablesOf)({}), []);
        assert_1.default.deepStrictEqual((0, sourcevars_1.globalVariablesOf)(null), []);
        // mutable says whether the program can write it, regardless of where it lives
        const readonlyRam = Object.assign(Object.assign({}, globals[0]), { name: 'LOCKED', mutable: false });
        const writableRom = Object.assign(Object.assign({}, globals[1]), { name: 'ROMVAR', mutable: true });
        assert_1.default.deepStrictEqual((0, sourcevars_1.writableGlobalVariablesOf)({ globalVariables: [globals[0], globals[1], readonlyRam, writableRom] }), [globals[0], writableRom]);
        assert_1.default.deepStrictEqual((0, sourcevars_1.writableGlobalVariablesOf)({}), []);
        // older output has no mutable flag; keep it rather than hide every global
        const unmarked = Object.assign(Object.assign({}, globals[1]), { ram: false, mutable: undefined });
        assert_1.default.deepStrictEqual((0, sourcevars_1.writableGlobalVariablesOf)({ globalVariables: [unmarked] }), [unmarked]);
    });
    (0, mocha_1.it)('finds the function whose code contains the PC', function () {
        assert_1.default.strictEqual((0, sourcevars_1.functionAtPC)(0x8004, symbolmap, symbolsizes), 'main');
        assert_1.default.strictEqual((0, sourcevars_1.functionAtPC)(0x8104, symbolmap, symbolsizes), 'helper');
        assert_1.default.strictEqual((0, sourcevars_1.functionAtPC)(0x8200, symbolmap, symbolsizes), null);
    });
    (0, mocha_1.it)('keeps the definition live at the PC, not the overlaid one', function () {
        assert_1.default.deepStrictEqual((0, sourcevars_1.liveSourceVariables)(vars, 0x8004, symbolmap, symbolsizes).map(v => v.name), ['score', 'delta', 'running', 'items', 'i']);
        const later = (0, sourcevars_1.liveSourceVariables)(vars, 0x8014, symbolmap, symbolsizes);
        assert_1.default.strictEqual(later.find(v => v.name === 'score').addr, 0x20);
        // the helper's range is unknown, so it is shown for the helper only
        assert_1.default.ok(!(0, sourcevars_1.liveSourceVariables)(vars, 0x8004, symbolmap, symbolsizes).some(v => v.name === 'other'));
        assert_1.default.ok((0, sourcevars_1.liveSourceVariables)(vars, 0x8104, symbolmap, symbolsizes).some(v => v.name === 'other'));
    });
    (0, mocha_1.it)('formats scalar, bool, array and optimized-out values', function () {
        const byName = (name, pc = 0x8004) => (0, sourcevars_1.liveSourceVariables)(vars, pc, symbolmap, symbolsizes).find(v => v.name === name);
        assert_1.default.strictEqual((0, sourcevars_1.formatSourceValue)(byName('score'), read), '$1234 (4660)');
        assert_1.default.strictEqual((0, sourcevars_1.formatSourceValue)(byName('delta'), read), '$FF (-1)');
        assert_1.default.strictEqual((0, sourcevars_1.formatSourceValue)(byName('running'), read), 'true');
        assert_1.default.strictEqual((0, sourcevars_1.formatSourceValue)(byName('items'), read), '01 02 03');
        assert_1.default.strictEqual((0, sourcevars_1.formatSourceValue)(byName('i'), read), '<optimized out>');
        // folded to a constant: no storage, but the value is known
        assert_1.default.strictEqual((0, sourcevars_1.formatSourceValue)({ type: 'u16', size: 2, addr: null, constant: 0x1234 }, read), '$1234 (4660)');
        assert_1.default.strictEqual((0, sourcevars_1.formatSourceValue)({ type: 'bool', size: 1, addr: null, constant: 1 }, read), 'true');
        assert_1.default.strictEqual((0, sourcevars_1.formatSourceVariableLine)(byName('score'), read), 'score: u16 = $1234 (4660)');
    });
    (0, mocha_1.it)('builds a tree keyed by name and type', function () {
        const tree = (0, sourcevars_1.sourceVariableTree)(vars, 0x8004, symbolmap, symbolsizes, read);
        assert_1.default.deepStrictEqual(tree, {
            'delta:i8': '$FF (-1)',
            'i:usize': '<optimized out>',
            'items:[u8;3]': '01 02 03',
            'running:bool': 'true',
            'score:u16': '$1234 (4660)',
        });
        assert_1.default.strictEqual((0, sourcevars_1.sourceVariableTree)(vars, 0x8200, symbolmap, symbolsizes, read), null);
    });
    (0, mocha_1.it)('shows every global, with no live range to filter on', function () {
        assert_1.default.deepStrictEqual((0, sourcevars_1.globalVariableTree)(globals, read), {
            'PALETTE:[u8;3]': 'AA BB CC',
            'SCORE:u16': '$5678 (22136)',
        });
        assert_1.default.strictEqual((0, sourcevars_1.globalVariableTree)([], read), null);
        assert_1.default.strictEqual((0, sourcevars_1.formatSourceVariableLine)(globals[0], read), 'SCORE: u16 = $5678 (22136)');
    });
});
(0, mocha_1.describe)('Inline source values', function () {
    const mem = { 0x10: 5, 0x11: 7 };
    const read = (a) => mem[a] || 0;
    const symbolmap = { main: 0x8000 };
    const symbolsizes = { main: 0x20 };
    const vars = [
        { name: 'i', type: 'u8', size: 1, function: 'main', addr: 0x10, range: [0x8000, 0x8020], line: 2 },
        { name: 'sum', type: 'u8', size: 1, function: 'main', addr: 0x11, range: [0x8008, 0x8020], line: 3 },
    ];
    const text = ['fn main() {', '  let mut i = 0;', '  let mut sum = 0;', '  sum += i;', '  i += 1;'];
    const lines = [
        { line: 1, offset: 0x8000 }, { line: 2, offset: 0x8002 }, { line: 3, offset: 0x8008 },
        { line: 4, offset: 0x8010 }, { line: 5, offset: 0x8018 },
    ];
    const run = (stop) => (0, sourcevars_1.inlineSourceValues)(vars, 0x8010, symbolmap, symbolsizes, lines, l => text[l - 1], read, stop);
    (0, mocha_1.it)('shows the variables a line names, with their values', function () {
        const m = run(4);
        assert_1.default.strictEqual(m.get(4), 'i = 5, sum = 7');
    });
    (0, mocha_1.it)('shows each variable once, on the line nearest the stop', function () {
        const m = run(5);
        assert_1.default.strictEqual(m.get(5), 'i = 5');
        assert_1.default.strictEqual(m.get(4), 'sum = 7');
        assert_1.default.strictEqual([...m.values()].join().split('i = ').length, 2);
    });
    (0, mocha_1.it)('skips a variable outside its live range and a line that does not name it', function () {
        const m = run(2);
        assert_1.default.strictEqual(m.get(2), 'i = 5'); // `sum` is not live until line 3's code
        assert_1.default.strictEqual(m.has(3), true);
        assert_1.default.strictEqual(m.has(1), false);
    });
    (0, mocha_1.it)('matches whole identifiers only', function () {
        const t = text.slice();
        t[4] = '  idx += 1;';
        const m = (0, sourcevars_1.inlineSourceValues)(vars, 0x8010, symbolmap, symbolsizes, lines, l => t[l - 1], read, 5);
        assert_1.default.strictEqual(m.has(5), false);
    });
    (0, mocha_1.it)('shows an inlined callee\'s variable under its source name', function () {
        // the compiler names it `mangled_callee::name`; the line only says `name`
        const inl = [{ name: 'mod__callee::i', type: 'u8', size: 1, function: 'main', addr: 0x10, range: [0x8000, 0x8020], line: 2 }];
        const m = (0, sourcevars_1.inlineSourceValues)(inl, 0x8010, symbolmap, symbolsizes, lines, l => text[l - 1], read, 4);
        assert_1.default.strictEqual(m.get(4), 'i = 5');
        // two inlined copies with the same name and value are listed once
        const twice = [...inl, Object.assign(Object.assign({}, inl[0]), { name: 'mod__other::i' })];
        assert_1.default.strictEqual((0, sourcevars_1.inlineSourceValues)(twice, 0x8010, symbolmap, symbolsizes, lines, l => text[l - 1], read, 4).get(4), 'i = 5');
    });
    (0, mocha_1.it)('draws only the variables of the file whose lines it is given', function () {
        // `i` is declared at line 2 of other.rs, which this file's line 2 must not pick up
        const mine = lines.map(l => (Object.assign(Object.assign({}, l), { path: 'rs8/mine.rs' })));
        const two = [
            Object.assign(Object.assign({}, vars[0]), { file: 'other.rs' }),
            Object.assign(Object.assign({}, vars[1]), { file: 'mine.rs' }),
        ];
        const m = (0, sourcevars_1.inlineSourceValues)(two, 0x8010, symbolmap, symbolsizes, mine, l => text[l - 1], read, 4);
        assert_1.default.deepStrictEqual([...m.values()], ['sum = 7']);
    });
});
//# sourceMappingURL=testsourcevars.js.map