"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const sourcevars_1 = require("../../src/common/sourcevars");
const oscar64parse_1 = require("../../src/worker/tools/oscar64parse");
(0, mocha_1.describe)('Oscar64 debug info', function () {
    const dbj = {
        types: [
            { name: '', typeid: 0, size: 1, type: 'uint' },
            { name: '', typeid: 1, size: 2, type: 'int' },
            { name: '', typeid: 2, size: 1, type: 'bool' },
            { name: '', typeid: 3, size: 4, type: 'array', eid: 0 },
            { name: '', typeid: 4, size: 2, type: 'ptr', eid: 0 },
            { name: 'point', typeid: 5, size: 4, type: 'struct' },
        ],
        functions: [{
                name: 'main', start: 0x8000, end: 0x8020, source: '/proj/main.c', line: 1,
                lines: [
                    { start: 0x8000, end: 0x8004, source: '/proj/main.c', line: 10 },
                    { start: 0x8004, end: 0x8008, source: '/proj/main.c', line: 12 },
                    { start: 0x8010, end: 0x8018, source: '/proj/main.c', line: 14 },
                    { start: 0x8018, end: 0x8020, source: '/proj/main.c', line: 18 },
                ],
                variables: [
                    { name: 'score', start: 0x9000, end: 0x9002, enter: 10, leave: 14, typeid: 1,
                        references: [{ source: '/proj/main.c', line: 10, column: 5 }] },
                    { name: 'i', start: 2, end: 3, base: 0x23, enter: 12, leave: 14, typeid: 0,
                        references: [{ source: '/proj/main.c', line: 12, column: 7 }] },
                    { name: 'arr', start: 0x9000, end: 0x9004, enter: 10, leave: 18, typeid: 3,
                        references: [{ source: '/proj/main.c', line: 10, column: 11 }] },
                    { name: 'p', start: 0x9004, end: 0x9006, enter: 10, leave: 18, typeid: 4,
                        references: [{ source: '/proj/main.c', line: 10, column: 15 }] },
                    { name: 'pt', start: 0x9006, end: 0x900a, enter: 10, leave: 18, typeid: 5,
                        references: [{ source: '/proj/main.c', line: 10, column: 18 }] },
                    { name: 'n', start: 0x0d, end: 0x0e, typeid: 0,
                        references: [{ source: '/proj/main.c', line: 1, column: 13 }] },
                ],
            }],
    };
    const parsed = (0, oscar64parse_1.parseOscar64Dbj)(JSON.stringify(dbj));
    const vars = parsed.sourceVariables;
    const byName = (name) => vars.find(v => v.name === name);
    (0, mocha_1.it)('maps types and stack-relative homes', function () {
        assert_1.default.deepStrictEqual((0, sourcevars_1.sourceVariablesOf)({ sourceVariables: vars }), vars);
        assert_1.default.strictEqual(byName('score').type, 'i16');
        assert_1.default.strictEqual(byName('arr').type, '[u8; 4]');
        assert_1.default.strictEqual(byName('p').type, '&u8');
        assert_1.default.strictEqual(byName('pt').type, 'point');
        assert_1.default.strictEqual(byName('i').baseAddr, 0x23);
        assert_1.default.strictEqual(byName('i').addr, 2);
        assert_1.default.strictEqual(byName('score').file, 'main.c');
        assert_1.default.strictEqual(byName('score').line, 10);
        assert_1.default.strictEqual(byName('score').col, 5);
    });
    (0, mocha_1.it)('turns enter/leave lines into code ranges', function () {
        assert_1.default.deepStrictEqual(byName('score').ranges, [[0x8000, 0x8008], [0x8010, 0x8018]]);
        // a variable visible on the first and last generated line is live over
        // the whole function, including branch tails with no line entry
        assert_1.default.deepStrictEqual(byName('arr').ranges, [[0x8000, 0x8020]]);
        assert_1.default.deepStrictEqual(byName('i').ranges, [[0x8004, 0x8008], [0x8010, 0x8018]]);
        // a parameter has no enter/leave: it is live in its own function only
        assert_1.default.deepStrictEqual(byName('n').ranges, [[0x8000, 0x8020]]);
    });
    (0, mocha_1.it)('shows only the variables live at the PC', function () {
        const atI = (0, sourcevars_1.liveSourceVariables)(vars, 0x8005, { main: 0x8000 }, { main: 0x20 }).map(v => v.name);
        assert_1.default.deepStrictEqual(atI, ['score', 'i', 'arr', 'p', 'pt', 'n']);
        const atScore = (0, sourcevars_1.liveSourceVariables)(vars, 0x8019, { main: 0x8000 }, { main: 0x20 }).map(v => v.name);
        assert_1.default.deepStrictEqual(atScore, ['arr', 'p', 'pt', 'n']);
        // a parameter without enter/leave falls back to the current function
        assert_1.default.ok((0, sourcevars_1.liveSourceVariables)(vars, 0x8019, { main: 0x8000 }, { main: 0x20 }).some(v => v.name == 'n'));
    });
    (0, mocha_1.it)('reads values through the stack pointer', function () {
        const mem = { 0x9002: 0x34, 0x9003: 0x12 };
        const read = (addr) => {
            if (addr == 0x23)
                return 0x00;
            if (addr == 0x24)
                return 0x90;
            return mem[addr] || 0;
        };
        assert_1.default.strictEqual((0, sourcevars_1.sourceVariableAddress)(byName('i'), read), 0x9002);
        assert_1.default.strictEqual((0, sourcevars_1.formatSourceValue)(byName('i'), read), '$34 (52)');
        const tree = (0, sourcevars_1.sourceVariableTree)(vars, 0x8005, { main: 0x8000 }, { main: 0x20 }, read);
        assert_1.default.strictEqual(tree['i:u8'], '$34 (52)');
        assert_1.default.strictEqual(tree['score:i16'], '$0000 (0)');
    });
    (0, mocha_1.it)('draws each live variable once, near the stop line', function () {
        const text = {
            1: 'int main(int n) {', 10: '  int score = n * 2;', 12: '  for (byte i = 0; i < 4; i++)',
            14: '    score += arr[i];', 18: '  return score;',
        };
        const lines = dbj.functions[0].lines.map(l => ({ line: l.line, offset: l.start }));
        const mem = { 0x9002: 0x34, 0x9003: 0x12, 0x0d: 3 };
        const read = (addr) => addr == 0x24 ? 0x90 : mem[addr] || 0;
        const m = (0, sourcevars_1.inlineSourceValues)(vars, 0x8005, { main: 0x8000 }, { main: 0x20 }, lines, l => { var _a; return (_a = text[l]) !== null && _a !== void 0 ? _a : null; }, read, 12);
        assert_1.default.strictEqual(m.get(12), 'i = 52');
        // `score` and `n` are named on 10, 14 and 18; 10 and 14 are both two
        // lines from the stop, so the earlier one wins and neither is repeated
        assert_1.default.strictEqual(m.get(10), 'score = 0, n = 3');
        assert_1.default.strictEqual(m.has(1), false);
        assert_1.default.strictEqual(m.get(14), 'arr = 00 00 34 12');
    });
});
//# sourceMappingURL=testoscar64.js.map