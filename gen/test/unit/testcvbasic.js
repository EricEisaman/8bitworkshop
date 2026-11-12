"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const mocha_1 = require("mocha");
const wasishim_1 = require("../../src/common/wasi/wasishim");
const toolmeta_1 = require("../../src/common/toolmeta");
const toolselect_1 = require("../../src/common/toolselect");
const toolroot_1 = require("../../src/tools/toolroot");
const wasiutils_1 = require("../../src/worker/wasiutils");
const cvbasic_1 = require("../../src/worker/tools/cvbasic");
function toolFile(...parts) {
    return path.join((0, toolroot_1.toolRoot)(), ...parts);
}
(0, mocha_1.describe)('CVBasic tool', function () {
    (0, mocha_1.it)('is selected by .bas on the platforms it targets', function () {
        assert_1.default.strictEqual((0, toolselect_1.getToolForPlatform)('coleco', 'game.bas'), 'cvbasic');
        assert_1.default.strictEqual((0, toolselect_1.getToolForPlatform)('coleco.mame', 'game.bas'), 'cvbasic');
        assert_1.default.strictEqual((0, toolselect_1.getToolForPlatform)('msx', 'game.bas'), 'cvbasic');
        assert_1.default.strictEqual((0, toolselect_1.getToolForPlatform)('sms-sg1000-libcv', 'game.bas'), 'cvbasic');
        assert_1.default.strictEqual((0, toolselect_1.getToolForPlatform)('sms-sms-libcv', 'game.bas'), 'cvbasic');
        assert_1.default.strictEqual((0, toolselect_1.getToolForPlatform)('nes', 'game.bas'), 'cvbasic');
        // other sources keep their tools
        assert_1.default.strictEqual((0, toolselect_1.getToolForPlatform)('coleco', 'game.c'), 'sdcc');
        assert_1.default.strictEqual((0, toolselect_1.getToolForPlatform)('nes', 'game.c'), 'cc65');
    });
    (0, mocha_1.it)('maps platforms to CVBasic console flags and ROM extensions', function () {
        assert_1.default.deepStrictEqual((0, cvbasic_1.cvbasicTarget)('coleco'), { console: [], romExt: '.rom', sms: false });
        assert_1.default.deepStrictEqual((0, cvbasic_1.cvbasicTarget)('msx'), { console: ['--msx'], romExt: '.rom', sms: false });
        assert_1.default.deepStrictEqual((0, cvbasic_1.cvbasicTarget)('sms-sg1000-libcv'), { console: ['--sg1000'], romExt: '.sg', sms: false });
        assert_1.default.deepStrictEqual((0, cvbasic_1.cvbasicTarget)('sms-sms-libcv'), { console: ['--sms'], romExt: '.sms', sms: true });
        assert_1.default.deepStrictEqual((0, cvbasic_1.cvbasicTarget)('nes'), { console: ['--nes'], romExt: '.nes', sms: false });
        assert_1.default.strictEqual((0, cvbasic_1.cvbasicTarget)('gb'), null);
    });
    (0, mocha_1.it)('ships the prologue/epilogue files as a WASI filesystem', function () {
        assert_1.default.strictEqual((0, toolmeta_1.getSharedFileSystemName)('cvbasic', 'coleco'), 'wasi:cvbasic-fs.zip');
    });
    (0, mocha_1.it)('maps assembly lines back to BASIC source lines', function () {
        const source = "\tPRINT AT 0,\"HI\"\n\tPRINT AT 0,\"HI\"\n\tGOTO again\n";
        const asm = [
            "\t; CVBasic prologue",
            "\tLD A,1",
            "\t; CVBasic program start.",
            "\t; \tPRINT AT 0,\"HI\"",
            "\tLD HL,0",
            "\t; \tPRINT AT 0,\"HI\"",
            "\tLD HL,0",
            "\t; \tGOTO again",
            "\tJP again",
        ].join("\n");
        const map = (0, cvbasic_1.mapAsmLinesToBasic)(asm, source);
        // the prologue is not mapped; repeated statements advance in order
        assert_1.default.strictEqual(map.size, 3);
        assert_1.default.strictEqual(map.get(4), 1);
        assert_1.default.strictEqual(map.get(6), 2);
        assert_1.default.strictEqual(map.get(8), 3);
    });
    (0, mocha_1.it)('maps assembly lines even without the "program start" marker (NES/6502)', function () {
        const asm = "\tLD A,1\n\t; \tPRINT \"HI\"\n\tJSR print\n";
        const map = (0, cvbasic_1.mapAsmLinesToBasic)(asm, "\tPRINT \"HI\"\n");
        assert_1.default.strictEqual(map.get(2), 1);
    });
    (0, mocha_1.it)('parses gasm80 listing lines at their fixed columns', function () {
        assert_1.default.deepStrictEqual((0, cvbasic_1.parseGasm80ListingLine)('8000  55AA              00136 \tDB $55,$AA'), { address: 0x8000, insns: '55AA', line: 136 });
        assert_1.default.deepStrictEqual((0, cvbasic_1.parseGasm80ListingLine)('858E                    04622 \t; comment'), { address: 0x858E, insns: '', line: 4622 });
        assert_1.default.deepStrictEqual((0, cvbasic_1.parseGasm80ListingLine)('859E  48454C4C4F204356  04630 \tDB $48,$45'), { address: 0x859e, insns: '48454C4C4F204356', line: 4630 });
        assert_1.default.strictEqual((0, cvbasic_1.parseGasm80ListingLine)('not a listing line'), null);
        assert_1.default.strictEqual((0, cvbasic_1.parseGasm80ListingLine)(''), null);
    });
    (0, mocha_1.it)('builds BASIC source lines from a gasm80 listing', function () {
        const lst = [
            '8000                    00010 \tORG $8000',
            '8000  3E01              00011 \tLD A,1',
            '8002  210000            00012 \tLD HL,0',
            '8005                    00013 \t; \tPRINT AT 0',
            '8005  3E00              00014 \tLD A,0',
            '8007  C9                00015 \tRET',
        ].join('\n');
        const map = new Map([[13, 4], [14, 4], [15, 5]]);
        assert_1.default.deepStrictEqual((0, cvbasic_1.parseCVBasicListing)(lst, map), [
            { line: 4, offset: 0x8005, insns: '3E00', iscode: true },
            { line: 5, offset: 0x8007, insns: 'C9', iscode: true },
        ]);
    });
    (0, mocha_1.it)('stops the source listing at the epilogue', function () {
        const asm = "\t; CVBasic program start.\n\tLD A,1\nrom_end:\n\ttimes $fffa-$ db $ff\n";
        const endline = (0, cvbasic_1.findProgramEndLine)(asm);
        assert_1.default.strictEqual(endline, 3);
        const lst = [
            '8000  3E01              00002 \tLD A,1',
            '8002                    00003 rom_end:',
            '8002                    00004 \ttimes $fffa-$ db $ff',
            '0000                    00007 VAR: \trb 1',
        ].join('\n');
        const map = new Map([[2, 1], [4, 1], [7, 1]]);
        assert_1.default.deepStrictEqual((0, cvbasic_1.parseCVBasicListing)(lst, map, endline), [{ line: 1, offset: 0x8000, insns: '3E01', iscode: true }]);
        assert_1.default.strictEqual((0, cvbasic_1.findProgramEndLine)("\tLD A,1\n"), Infinity);
    });
    (0, mocha_1.it)('parses CVBasic diagnostics', function () {
        const errors = [];
        (0, cvbasic_1.parseCVBasicDiagnostics)([
            'CVBasic compiler v0.9.2',
            'ERROR: missing THEN in IF at line 22 (game.bas)',
            'Warning: variable \'x\' read but never assigned at line 7 (game.bas)',
            'INFO: compiling main program at line 1 (game.bas)',
            'Error: PROCEDURE \'foo\' jumped in by GOTO',
            '8 RAM bytes used of 814 bytes available.',
        ].join('\n'), 'game.bas', errors);
        assert_1.default.deepStrictEqual(errors, [
            { line: 22, path: 'game.bas', msg: 'missing THEN in IF' },
            { line: 7, path: 'game.bas', msg: "variable 'x' read but never assigned", severity: 'warning' },
            { line: 0, path: 'game.bas', msg: "PROCEDURE 'foo' jumped in by GOTO" },
        ]);
    });
    (0, mocha_1.it)('maps gasm80 diagnostics onto BASIC lines', function () {
        const errors = [];
        const map = new Map([[42, 9]]);
        (0, cvbasic_1.parseGasm80Diagnostics)([
            "Error: undefined label 'foo' at line 42",
            'Warning: something odd at line 99',
            'First time \'foo\' at line 42',
            'Error: cannot open \'x.asm\' for input',
        ].join('\n'), map, 'game.bas', errors);
        assert_1.default.deepStrictEqual(errors, [
            { line: 9, path: 'game.bas', msg: "undefined label 'foo'" },
            { line: 0, path: 'game.bas', msg: 'something odd', severity: 'warning' },
            { line: 0, path: 'game.bas', msg: "cannot open 'x.asm' for input" },
        ]);
    });
    (0, mocha_1.it)('parses gasm80 symbol files', function () {
        const sym = [
            'ARRAY_#SCORES: equ 00007094h',
            'START: equ 0000853dh',
            'COLECO: equ 00000001h',
            '',
        ].join('\n');
        assert_1.default.deepStrictEqual((0, cvbasic_1.parseGasm80Symbols)(sym), { 'ARRAY_#SCORES': 0x7094, 'START': 0x853d, 'COLECO': 1 });
    });
    (0, mocha_1.it)('compiles and assembles a Coleco preset end-to-end', async function () {
        const cvwasm = toolFile('src/worker/wasm/cvbasic.wasm');
        const gwasm = toolFile('src/worker/wasm/gasm80.wasm');
        const fszip = toolFile('src/worker/fs/cvbasic-fs.zip');
        // the wasm builds live outside the repo, so they may not be here
        if (!fs.existsSync(cvwasm) || !fs.existsSync(gwasm) || !fs.existsSync(fszip))
            return this.skip();
        const cvfs = await (0, wasiutils_1.unzipWASIFilesystem)(fs.readFileSync(fszip), './');
        const cv = new wasishim_1.WASIRunner();
        await cv.loadAsync(fs.readFileSync(cvwasm));
        cv.fs.setParent(cvfs);
        cv.addPreopenDirectory('.');
        const source = fs.readFileSync(toolFile('presets/coleco/hello.bas'), 'utf8');
        cv.fs.putFile('./main.bas', source);
        cv.setArgs(['cvbasic', 'main.bas', 'main.asm', 'share/cvbasic']);
        assert_1.default.strictEqual(cv.run(), 0, cv.fds[2].getBytesAsString());
        const asmtext = cv.fs.getFile('./main.asm').getBytesAsString();
        assert_1.default.ok(asmtext.indexOf('CVBasic prologue') >= 0, 'missing prologue');
        const g8 = new wasishim_1.WASIRunner();
        await g8.loadAsync(fs.readFileSync(gwasm));
        g8.addPreopenDirectory('.');
        g8.fs.putFile('./main.asm', asmtext);
        g8.setArgs(['gasm80', 'main.asm', '-o', 'main.rom', '-l', 'main.lst', '-s', 'main.sym']);
        assert_1.default.strictEqual(g8.run(), 0, g8.fds[2].getBytesAsString());
        const rom = g8.fs.getFile('./main.rom').getBytes();
        assert_1.default.strictEqual(rom.length, 8192);
        assert_1.default.deepStrictEqual([rom[0], rom[1]], [0x55, 0xaa]); // Coleco cartridge header
        // the listing carries BASIC source line info for the debugger
        const map = (0, cvbasic_1.mapAsmLinesToBasic)(asmtext, source);
        const lines = (0, cvbasic_1.parseCVBasicListing)(g8.fs.getFile('./main.lst').getBytesAsString(), map, (0, cvbasic_1.findProgramEndLine)(asmtext));
        assert_1.default.ok(lines.length > 5, 'too few source lines: ' + lines.length);
        assert_1.default.ok(lines.every(l => l.line >= 1 && l.offset >= 0x8000));
    });
});
//# sourceMappingURL=testcvbasic.js.map