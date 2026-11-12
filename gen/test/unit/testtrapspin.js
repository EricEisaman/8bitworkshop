"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const baseplatform_1 = require("../../src/common/baseplatform");
const emu_1 = require("../../src/common/emu");
// A platform only as far as the trap watchdog needs it: a PC, an SP, memory
// and a symbol table. The real ones add video, input and breakpoints.
class Fake6502 extends baseplatform_1.Base6502Platform {
    constructor(spin = 0x8000) {
        super();
        this.pc = 0;
        this.sp = 0xfd;
        this.stable = true;
        this.mem = new Uint8Array(0x10000);
        this.debugSymbols = new baseplatform_1.DebugSymbols({ __trap_spin: spin }, {});
    }
    readAddress(addr) { return this.mem[addr & 0xffff]; }
    getCPUState() { return { PC: this.pc, SP: this.sp, A: 0, X: 0, Y: 0 }; }
    isStable() { return this.stable; }
    loadState(state) { }
    saveState() { return {}; }
    pause() { }
    resume() { }
    advance() { return 0; }
}
class FakeZ80 extends baseplatform_1.BaseZ80Platform {
    constructor(spin = 0x8000) {
        super();
        this.pc = 0;
        this.sp = 0x1000;
        this.mem = new Uint8Array(0x10000);
        this.debugSymbols = new baseplatform_1.DebugSymbols({ __trap_spin: spin }, {});
    }
    readAddress(addr) { return this.mem[addr & 0xffff]; }
    getPC() { return this.pc; }
    getSP() { return this.sp; }
    getCPUState() { return { PC: this.pc, SP: this.sp, AF: 0, BC: 0, DE: 0, HL: 0 }; }
    isStable() { return true; }
    loadState(state) { }
    saveState() { return {}; }
    pause() { }
    resume() { }
    advance() { return 0; }
}
function trap(times, p) {
    for (let i = 0; i < times; i++)
        p.checkTrapSpin();
}
(0, mocha_1.describe)('trap spin watchdog', function () {
    (0, mocha_1.it)('waits ten consecutive frames before halting', function () {
        const p = new Fake6502(0x8000);
        p.pc = 0x8000;
        trap(baseplatform_1.TRAP_SPIN_FRAMES - 1, p);
        assert_1.default.throws(() => p.checkTrapSpin(), (e) => e instanceof emu_1.EmuHalt);
    });
    (0, mocha_1.it)('resets the count when the PC leaves the spin', function () {
        const p = new Fake6502(0x8000);
        p.pc = 0x8000;
        trap(baseplatform_1.TRAP_SPIN_FRAMES - 1, p);
        p.pc = 0x1234;
        p.checkTrapSpin();
        p.pc = 0x8000;
        trap(baseplatform_1.TRAP_SPIN_FRAMES - 1, p);
        assert_1.default.throws(() => p.checkTrapSpin(), (e) => e instanceof emu_1.EmuHalt);
    });
    (0, mocha_1.it)('keeps counting through frames that end mid-instruction', function () {
        const p = new Fake6502(0x8000);
        p.pc = 0x8000;
        trap(1, p); // a stable frame on the spin
        p.stable = false;
        p.pc = 0x1234; // the WASM cores' PC is not the opcode here
        trap(baseplatform_1.TRAP_SPIN_FRAMES - 2, p);
        p.stable = true;
        p.pc = 0x8000;
        assert_1.default.throws(() => p.checkTrapSpin(), (e) => e instanceof emu_1.EmuHalt);
    });
    (0, mocha_1.it)('reads a 6502 JSR return address off the stack (minus 2)', function () {
        const p = new Fake6502(0x8000);
        p.pc = 0x8000;
        // jsr pushed site + 2; SP points just below the two bytes
        p.mem[0x100 + p.sp + 1] = (0x1234 + 2) & 0xff;
        p.mem[0x100 + p.sp + 2] = (0x1234 + 2) >> 8;
        assert_1.default.throws(() => trap(baseplatform_1.TRAP_SPIN_FRAMES, p), (e) => e instanceof emu_1.EmuHalt && e.message === 'Program trapped at $1234');
    });
    (0, mocha_1.it)('reads a Z80 CALL return address off the stack (minus 3)', function () {
        const p = new FakeZ80(0x8000);
        p.pc = 0x8000;
        // call pushed site + 3, low byte first
        p.mem[p.sp] = (0xBEEF + 3) & 0xff;
        p.mem[p.sp + 1] = (0xBEEF + 3) >> 8;
        assert_1.default.throws(() => trap(baseplatform_1.TRAP_SPIN_FRAMES, p), (e) => e instanceof emu_1.EmuHalt && e.message === 'Program trapped at $BEEF');
    });
    (0, mocha_1.it)('does nothing without the symbol, or on a platform with no stack to read', function () {
        const p = new Fake6502(0x8000);
        p.debugSymbols = new baseplatform_1.DebugSymbols({}, {});
        p.pc = 0x8000;
        trap(baseplatform_1.TRAP_SPIN_FRAMES * 2, p);
        // the base class has no architecture and so no site, but the spin is
        // still a hang
        const q = new Fake6502(0x8000);
        q.getTrapSite = () => null;
        q.pc = 0x8000;
        assert_1.default.throws(() => trap(baseplatform_1.TRAP_SPIN_FRAMES, q), (e) => e instanceof emu_1.EmuHalt && e.message === 'Program trapped in __trap_spin');
    });
});
//# sourceMappingURL=testtrapspin.js.map