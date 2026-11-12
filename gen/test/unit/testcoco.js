"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const mc6821_1 = require("../../src/machine/chips/mc6821");
const mc6883_1 = require("../../src/machine/chips/mc6883");
const mc6847_1 = require("../../src/machine/chips/mc6847");
const coco_1 = require("../../src/machine/coco");
const emu_1 = require("../../src/common/emu");
const GREEN = mc6847_1.VDG_PALETTE[0], YELLOW = mc6847_1.VDG_PALETTE[1], BLUE = mc6847_1.VDG_PALETTE[2], RED = mc6847_1.VDG_PALETTE[3], BLACK = mc6847_1.VDG_PALETTE[8], DARK_GREEN = mc6847_1.VDG_PALETTE[9];
(0, mocha_1.describe)('MC6821 PIA', () => {
    (0, mocha_1.it)('selects the DDR or the data register with CR bit 2', () => {
        const pia = new mc6821_1.MC6821();
        pia.write(0, 0xf0); // CRA bit 2 clear: this is DDRA
        assert_1.default.strictEqual(pia.ddra, 0xf0);
        assert_1.default.strictEqual(pia.read(0), 0xf0);
        pia.write(1, 0x04); // now port data
        pia.readInA = () => 0x0a;
        pia.write(0, 0x50);
        assert_1.default.strictEqual(pia.ora, 0x50);
        // outputs read back what was written, inputs come from the pins
        assert_1.default.strictEqual(pia.read(0), 0x5a);
    });
    (0, mocha_1.it)('flags an active C1 edge and raises IRQ only when enabled', () => {
        const pia = new mc6821_1.MC6821();
        pia.write(1, 0x04); // data reg, falling edge, IRQ disabled
        pia.setCA1(true);
        assert_1.default.strictEqual(pia.cra & 0x80, 0, 'rising edge is not active');
        pia.setCA1(false);
        assert_1.default.strictEqual(pia.cra & 0x80, 0x80, 'falling edge sets the flag');
        assert_1.default.strictEqual(pia.irqA, false, 'IRQ not enabled');
        pia.write(1, 0x05);
        assert_1.default.strictEqual(pia.irqA, true);
        pia.read(0); // reading the data register clears the flag
        assert_1.default.strictEqual(pia.irqA, false);
        assert_1.default.strictEqual(pia.cra & 0x80, 0);
    });
    (0, mocha_1.it)('uses the rising edge when CR bit 1 is set', () => {
        const pia = new mc6821_1.MC6821();
        pia.write(3, 0x07);
        pia.setCB1(true);
        assert_1.default.strictEqual(pia.irqB, true);
    });
    (0, mocha_1.it)('drives C2 as a manual output', () => {
        const pia = new mc6821_1.MC6821();
        pia.write(1, 0x3c); // C2 output, manual mode, level high
        assert_1.default.strictEqual(pia.c2a, true);
        pia.write(1, 0x34);
        assert_1.default.strictEqual(pia.c2a, false);
    });
});
(0, mocha_1.describe)('MC6883 SAM', () => {
    (0, mocha_1.it)('sets and clears bits through address pairs', () => {
        const sam = new mc6883_1.MC6883();
        sam.access(0xffc3); // V1 set
        sam.access(0xffc5); // V2 set
        assert_1.default.strictEqual(sam.v, 6);
        sam.access(0xffc2); // V1 clear
        assert_1.default.strictEqual(sam.v, 4);
    });
    (0, mocha_1.it)('computes the display address from F0-F6', () => {
        const sam = new mc6883_1.MC6883();
        sam.access(0xffc9); // F1: $0400
        assert_1.default.strictEqual(sam.displayBase, 0x0400);
        sam.access(0xffc7); // F0: +$0200
        assert_1.default.strictEqual(sam.displayBase, 0x0600);
    });
    (0, mocha_1.it)('knows the geometry of each mode', () => {
        const sam = new mc6883_1.MC6883();
        assert_1.default.deepStrictEqual([sam.bytesPerRow, sam.linesPerRow], [32, 12]);
        sam.access(0xffc3);
        sam.access(0xffc5);
        assert_1.default.deepStrictEqual([sam.bytesPerRow, sam.linesPerRow], [32, 1]);
        assert_1.default.strictEqual(sam.allRAM, false);
        sam.access(0xffdf);
        assert_1.default.strictEqual(sam.allRAM, true);
    });
});
(0, mocha_1.describe)('MC6847 VDG', () => {
    const vdg = new mc6847_1.MC6847();
    const line = new Uint32Array(256);
    (0, mocha_1.it)('draws inverted text as a dark glyph on green', () => {
        const ram = new Uint8Array(0x10000);
        ram[0x400] = 0x41; // 'A', INV set: how Color BASIC prints
        ram[0x401] = 0x60; // space
        vdg.drawLine(line, 0, ram, 0x400, 2, 32, 0x00); // first glyph row of the cell
        assert_1.default.strictEqual(line[0], GREEN, 'background');
        assert_1.default.strictEqual(line[2], DARK_GREEN, 'the glyph\'s top bar');
        assert_1.default.strictEqual(line[8], GREEN, 'a space is all background');
        vdg.drawLine(line, 0, ram, 0x400, 0, 32, 0x00); // blank line above the glyph
        assert_1.default.strictEqual(line[2], GREEN);
    });
    (0, mocha_1.it)('draws reverse video without the INV bit, and orange with CSS', () => {
        const ram = new Uint8Array(0x10000);
        ram[0x400] = 0x01; // 'A', no INV
        vdg.drawLine(line, 0, ram, 0x400, 2, 32, 0x00);
        assert_1.default.strictEqual(line[2], GREEN);
        assert_1.default.strictEqual(line[0], DARK_GREEN);
        vdg.drawLine(line, 0, ram, 0x400, 2, 32, 0x08);
        assert_1.default.strictEqual(line[2], mc6847_1.VDG_PALETTE[7]);
    });
    (0, mocha_1.it)('draws semigraphics 4 quadrants', () => {
        const ram = new Uint8Array(0x10000);
        ram[0x400] = 0x8f; // green, all four quadrants
        ram[0x401] = 0xa8; // blue, upper left only
        vdg.drawLine(line, 0, ram, 0x400, 0, 32, 0x00);
        assert_1.default.strictEqual(line[0], GREEN);
        assert_1.default.strictEqual(line[7], GREEN);
        assert_1.default.strictEqual(line[8], BLUE);
        assert_1.default.strictEqual(line[11], BLUE);
        assert_1.default.strictEqual(line[12], BLACK);
        vdg.drawLine(line, 0, ram, 0x400, 6, 32, 0x00); // lower half
        assert_1.default.strictEqual(line[0], GREEN);
        assert_1.default.strictEqual(line[8], BLACK);
    });
    (0, mocha_1.it)('draws RG6: 256 pixels of 1 bit', () => {
        const ram = new Uint8Array(0x10000);
        ram[0x600] = 0x80;
        ram[0x601] = 0x01;
        vdg.drawLine(line, 0, ram, 0x600, 0, 32, 0xf0);
        assert_1.default.strictEqual(line[0], GREEN);
        assert_1.default.strictEqual(line[1], BLACK);
        assert_1.default.strictEqual(line[15], GREEN);
        vdg.drawLine(line, 0, ram, 0x600, 0, 32, 0xf8); // color set 1: buff
        assert_1.default.strictEqual(line[0], mc6847_1.VDG_PALETTE[4]);
    });
    (0, mocha_1.it)('draws CG6: 4 colors, 2 screen pixels each', () => {
        const ram = new Uint8Array(0x10000);
        ram[0x600] = 0x1b; // 00 01 10 11
        vdg.drawLine(line, 0, ram, 0x600, 0, 32, 0xe0);
        assert_1.default.deepStrictEqual([line[0], line[1], line[2], line[3], line[4], line[5], line[6], line[7]], [GREEN, GREEN, YELLOW, YELLOW, BLUE, BLUE, RED, RED]);
    });
    (0, mocha_1.it)('draws CG1: 64 pixels across, 4 screen pixels each', () => {
        const ram = new Uint8Array(0x10000);
        ram[0x600] = 0x1b;
        vdg.drawLine(line, 0, ram, 0x600, 0, 16, 0x80);
        assert_1.default.strictEqual(line[3], GREEN);
        assert_1.default.strictEqual(line[4], YELLOW);
        assert_1.default.strictEqual(line[12], RED);
        assert_1.default.strictEqual(line[15], RED);
    });
});
// a tiny DECB .bin: blocks of (0, len, addr, bytes), then (255, 0, 0, exec)
function decb(addr, exec, bytes) {
    return new Uint8Array([0, bytes.length >> 8, bytes.length & 255, addr >> 8, addr & 255,
        ...bytes, 0xff, 0, 0, exec >> 8, exec & 255]);
}
function boot(program) {
    const m = new coco_1.CoCoMachine();
    m.connectVideo(new Uint32Array(256 * 192));
    m.loadROM(decb(0x2800, 0x2800, program));
    m.reset();
    return m;
}
function frames(m, n) {
    for (let i = 0; i < n; i++)
        m.advanceFrame(() => false);
}
(0, mocha_1.describe)('DECB loader', () => {
    (0, mocha_1.it)('parses blocks and the exec address', () => {
        const d = (0, coco_1.parseDECB)(decb(0x2800, 0x2802, [1, 2, 3]));
        assert_1.default.strictEqual(d.exec, 0x2802);
        assert_1.default.strictEqual(d.blocks.length, 1);
        assert_1.default.strictEqual(d.blocks[0].addr, 0x2800);
        assert_1.default.deepStrictEqual(Array.from(d.blocks[0].bytes), [1, 2, 3]);
    });
    (0, mocha_1.it)('rejects things that are not DECB files', () => {
        assert_1.default.strictEqual((0, coco_1.parseDECB)(new Uint8Array([0x44, 0x4b, 0, 0, 0, 0])), null);
        assert_1.default.strictEqual((0, coco_1.parseDECB)(new Uint8Array([0, 0, 9, 0x28, 0, 1])), null, 'block runs off the end');
        assert_1.default.strictEqual((0, coco_1.parseDECB)(new Uint8Array([0, 0, 1, 0x28, 0, 1])), null, 'no exec trailer');
    });
});
(0, mocha_1.describe)('CoCo machine', () => {
    // LDA #$41 / STA $0400 / BRA *
    const PRINT_A = [0x86, 0x41, 0xb7, 0x04, 0x00, 0x20, 0xfe];
    (0, mocha_1.it)('boots the ROM, clears the screen and runs the program', () => {
        const m = boot(PRINT_A);
        frames(m, 2);
        assert_1.default.strictEqual(m.ram[0x400], 0x41, 'program ran');
        assert_1.default.strictEqual(m.ram[0x401], 0x60, 'screen was cleared to green blanks');
        // the VDG shows it: top-left pixel is part of the cell's blank top lines
        assert_1.default.strictEqual(m.pixels[0], GREEN);
        // and the hardware was set up for text at $0400
        assert_1.default.strictEqual(m.sam.displayBase, 0x400);
        assert_1.default.strictEqual(m.pia1.outB & 0x80, 0, 'alphanumeric mode');
    });
    (0, mocha_1.it)('keeps a 60 Hz tick from the field sync interrupt', () => {
        const m = boot(PRINT_A);
        frames(m, 11);
        const ticks = (m.ram[0x112] << 8) | m.ram[0x113];
        assert_1.default.ok(ticks >= 9 && ticks <= 11, 'TIMER advanced once per frame: ' + ticks);
    });
    (0, mocha_1.it)('reads the keyboard matrix through PIA0', () => {
        const m = boot(PRINT_A);
        frames(m, 1);
        m.write(0xff02, 0xfd); // strobe column 1 low
        assert_1.default.strictEqual(m.read(0xff00) & 0x7f, 0x7f, 'no key down');
        m.setKeyInput(65, 65, emu_1.KeyFlags.KeyDown); // A is row 0, column 1
        assert_1.default.strictEqual(m.read(0xff00) & 0x7f, 0x7e);
        m.write(0xff02, 0xfb); // column 2: not A
        assert_1.default.strictEqual(m.read(0xff00) & 0x7f, 0x7f);
        m.setKeyInput(65, 65, emu_1.KeyFlags.KeyUp);
        m.write(0xff02, 0xfd);
        assert_1.default.strictEqual(m.read(0xff00) & 0x7f, 0x7f);
    });
    (0, mocha_1.it)('maps typed punctuation to the CoCo keys, with SHIFT where needed', () => {
        const m = boot(PRINT_A);
        frames(m, 1);
        // PC '=' is SHIFT-'-' on a CoCo ('-' is row 5, column 5)
        m.setKeyInput(187, 0x3d, emu_1.KeyFlags.KeyDown);
        m.write(0xff02, 0xdf); // column 5
        assert_1.default.strictEqual(m.read(0xff00) & 0x20, 0, 'the - key is down');
        m.write(0xff02, 0x7f); // column 7: SHIFT is row 6
        assert_1.default.strictEqual(m.read(0xff00) & 0x40, 0, 'SHIFT is down');
        m.setKeyInput(187, 0x3d, emu_1.KeyFlags.KeyUp);
        assert_1.default.strictEqual(m.read(0xff00) & 0x40, 0x40, 'SHIFT released with it');
    });
    (0, mocha_1.it)('reports joystick axes through the DAC comparator', () => {
        const m = boot(PRINT_A);
        frames(m, 1);
        m.setPaddleInput(0, 255);
        m.write(0xff20, 0x80); // DAC = 32
        assert_1.default.strictEqual(m.read(0xff00) & 0x80, 0x80, 'axis above the DAC');
        m.setPaddleInput(0, 0);
        assert_1.default.strictEqual(m.read(0xff00) & 0x80, 0, 'axis below the DAC');
    });
    (0, mocha_1.it)('reads the joysticks with the ROM routine at $A9DE', () => {
        // JSR $A9DE / BRA *
        const m = boot([0xbd, 0xa9, 0xde, 0x20, 0xfe]);
        m.setPaddleInput(0, 255); // right X: full right
        m.setPaddleInput(1, 128); // right Y: center
        frames(m, 2);
        assert_1.default.strictEqual(m.ram[0x15a], 63);
        assert_1.default.strictEqual(m.ram[0x15b], 32);
    });
    (0, mocha_1.it)('prints through the ROM routine CMOC calls at [$A002]', () => {
        // LDA #'H' / JSR [$A002] / LDA #'I' / JSR [$A002] / BRA *
        const m = boot([0x86, 0x48, 0xad, 0x9f, 0xa0, 0x02, 0x86, 0x49, 0xad, 0x9f, 0xa0, 0x02, 0x20, 0xfe]);
        frames(m, 2);
        assert_1.default.strictEqual(m.ram[0x400], 0x48);
        assert_1.default.strictEqual(m.ram[0x401], 0x49);
        assert_1.default.strictEqual((m.ram[0x88] << 8) | m.ram[0x89], 0x402, 'cursor advanced');
    });
    (0, mocha_1.it)('makes sound with the DAC, through the ROM routine at $A956', () => {
        // tone $80, duration $0010, then SOUND
        // LDA #$80 / STA $8C / LDX #$10 / STX $8D / JSR $A956 / BRA *
        const m = boot([0x86, 0x80, 0x97, 0x8c, 0x8e, 0x00, 0x10, 0x9f, 0x8d, 0xbd, 0xa9, 0x56, 0x20, 0xfe]);
        const samples = [];
        m.connectAudio({ feedSample: (v) => { samples.push(v); } });
        frames(m, 4);
        assert_1.default.ok(Math.max(...samples) > 0.2, 'DAC goes high');
        assert_1.default.ok(Math.min(...samples) < -0.2, 'and low');
    });
    (0, mocha_1.it)('runs twice as many instructions with the SAM fast clock', () => {
        // BRA * burns the whole frame; the fast clock doubles how many run
        const slow = boot([0x20, 0xfe]);
        const fast = boot([0xb7, 0xff, 0xd9, 0x20, 0xfe]); // STA $FFD9 sets R1
        frames(slow, 1);
        frames(fast, 1); // run the boot ROM
        const a = slow.advanceFrame(() => false);
        const b = fast.advanceFrame(() => false);
        assert_1.default.ok(b > a * 1.9 && b < a * 2.1, `${b} instructions vs ${a}`);
    });
    (0, mocha_1.it)('restores its state', () => {
        const m = boot(PRINT_A);
        frames(m, 3);
        const s = m.saveState();
        const before = (m.ram[0x112] << 8) | m.ram[0x113];
        frames(m, 5);
        m.loadState(s);
        assert_1.default.strictEqual((m.ram[0x112] << 8) | m.ram[0x113], before);
        assert_1.default.strictEqual(m.cpu.getPC(), s.c.PC);
    });
});
//# sourceMappingURL=testcoco.js.map