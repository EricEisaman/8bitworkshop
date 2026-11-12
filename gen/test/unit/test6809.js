"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const _6809_1 = require("../../src/common/cpu/6809");
const C = 1, V = 2, Z = 4, N = 8, I = 16, F = 64;
// Run the bytes at 0x100 as one instruction with the given initial state;
// returns the CPU state afterwards and the cycles taken.
function run(code, init = {}) {
    const mem = new Uint8Array(0x10000);
    code.forEach((b, i) => mem[0x100 + i] = b);
    mem[0xfffe] = 0x01;
    mem[0xffff] = 0x00; // reset vector -> 0x100
    mem[0xfff4] = 0x12;
    mem[0xfff5] = 0x34; // SWI2 vector
    mem[0xfff2] = 0x56;
    mem[0xfff3] = 0x78; // SWI3 vector
    mem[0x2000] = 0x30;
    mem[0x2001] = 0x00; // pointer for [$2000]
    const cpu = (0, _6809_1.CPU6809)();
    cpu.init((a, v) => { mem[a] = v; }, (a) => mem[a], () => { });
    const s = Object.assign(Object.assign(Object.assign({}, cpu.saveState()), { SP: 0x8000, U: 0, A: 0, B: 0, X: 0, Y: 0, DP: 0, CC: 0, T: 0 }), init);
    cpu.loadState(s);
    const cycles = cpu.advanceInsn();
    return Object.assign(Object.assign({}, cpu.saveState()), { cycles, mem });
}
(0, mocha_1.describe)('6809 CPU flags and timing', () => {
    (0, mocha_1.it)('NEG sets Z for 0, clears C for 0, sets C otherwise', () => {
        let r = run([0x40], { A: 0 }); // NEGA
        assert_1.default.strictEqual(r.A, 0);
        assert_1.default.strictEqual(r.CC & (Z | C | N | V), Z);
        r = run([0x40], { A: 1 });
        assert_1.default.strictEqual(r.A, 0xff);
        assert_1.default.strictEqual(r.CC & (Z | C | N | V), C | N);
        r = run([0x40], { A: 0x80 });
        assert_1.default.strictEqual(r.CC & (Z | C | N | V), C | N | V);
    });
    (0, mocha_1.it)('ASL and ROL set N and Z', () => {
        assert_1.default.strictEqual(run([0x48], { A: 0x40 }).CC & (N | Z | V), N | V); // ASLA
        assert_1.default.strictEqual(run([0x48], { A: 0x80 }).CC & (N | Z | C | V), Z | C | V);
        assert_1.default.strictEqual(run([0x49], { A: 0x40 }).CC & (N | Z | V), N | V); // ROLA
        assert_1.default.strictEqual(run([0x49], { A: 0x80, CC: 0 }).CC & (N | Z | C), Z | C);
        assert_1.default.strictEqual(run([0x49], { A: 0x00, CC: C }).A, 1);
    });
    (0, mocha_1.it)('INC and DEC set V only on signed overflow', () => {
        assert_1.default.strictEqual(run([0x4c], { A: 0xff, CC: V }).CC & (V | Z), Z); // INCA
        assert_1.default.strictEqual(run([0x4c], { A: 0x7f }).CC & (V | N), V | N);
        assert_1.default.strictEqual(run([0x4a], { A: 0x00, CC: V }).CC & (V | N), N); // DECA
        assert_1.default.strictEqual(run([0x4a], { A: 0x80 }).CC & (V | N), V);
    });
    (0, mocha_1.it)('DAA preserves C and SEX leaves V alone', () => {
        assert_1.default.strictEqual(run([0x19], { A: 0x10, CC: C }).CC & C, C);
        assert_1.default.strictEqual(run([0x1d], { B: 0x80, CC: V }).CC & (V | N), V | N);
    });
    (0, mocha_1.it)('STD sets N and Z', () => {
        assert_1.default.strictEqual(run([0xdd, 0x10], { A: 0x80, B: 0, CC: V }).CC & (N | Z | V), N);
        assert_1.default.strictEqual(run([0xfd, 0x20, 0x00], { A: 0, B: 0 }).CC & (N | Z), Z);
        assert_1.default.strictEqual(run([0xed, 0x84], { A: 0, B: 0, X: 0x1000 }).CC & (N | Z), Z);
    });
    (0, mocha_1.it)('SWI2 and SWI3 leave I and F alone, SWI sets them', () => {
        let r = run([0x10, 0x3f]);
        assert_1.default.strictEqual(r.CC & (I | F), 0);
        assert_1.default.strictEqual(r.PC, 0x1234);
        r = run([0x11, 0x3f]);
        assert_1.default.strictEqual(r.CC & (I | F), 0);
        assert_1.default.strictEqual(r.PC, 0x5678);
        assert_1.default.strictEqual(run([0x3f]).CC & (I | F), I | F);
    });
    (0, mocha_1.it)('indexed extended indirect takes 5 extra cycles', () => {
        const base = run([0xa6, 0x84], { X: 0x1000 }).cycles; // LDA ,X = 4
        assert_1.default.strictEqual(base, 4);
        assert_1.default.strictEqual(run([0xa6, 0x9f, 0x20, 0x00]).cycles, 4 + 5); // LDA [$2000]
        assert_1.default.strictEqual(run([0xa6, 0x94], { X: 0x2000 }).cycles, 4 + 3); // LDA [,X]
    });
    (0, mocha_1.it)('taken long branches take one more cycle than untaken', () => {
        assert_1.default.strictEqual(run([0x10, 0x27, 0x00, 0x10], { CC: Z }).cycles, 6); // LBEQ taken
        assert_1.default.strictEqual(run([0x10, 0x27, 0x00, 0x10], { CC: 0 }).cycles, 5);
        assert_1.default.strictEqual(run([0x10, 0x27, 0x00, 0x10], { CC: Z }).PC, 0x114);
    });
});
//# sourceMappingURL=test6809.js.map