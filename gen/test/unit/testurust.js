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
const jszip_1 = __importDefault(require("jszip"));
const mocha_1 = require("mocha");
const toolmeta_1 = require("../../src/common/toolmeta");
const toolselect_1 = require("../../src/common/toolselect");
const toolroot_1 = require("../../src/tools/toolroot");
const urustparse_1 = require("../../src/worker/tools/urustparse");
(0, mocha_1.describe)('urust tool', function () {
    (0, mocha_1.it)('is selected by .rs on 6502 platforms', function () {
        assert_1.default.strictEqual((0, toolselect_1.getToolForPlatform)('devel-6502', 'main.rs'), 'urust');
        assert_1.default.strictEqual((0, toolselect_1.getToolForPlatform)('nes', 'game.rs'), 'urust');
    });
    (0, mocha_1.it)('scans include_bytes!/include_str! as dependencies', function () {
        const src = 'static A: &[u8] = &*include_bytes!("art/a.bin");\n' +
            'const S: &str = include_str!( "t.txt" );\n// include_bytes!("x") is also matched\n';
        const deps = (0, toolmeta_1.matchDependencyPatterns)(src, (0, toolmeta_1.getIncludePatterns)('urust'));
        assert_1.default.deepStrictEqual(deps, ['art/a.bin', 't.txt', 'x']);
    });
    (0, mocha_1.it)('scans //#resource files as dependencies', function () {
        const src = '//#resource "vicdual.toml"\n//#flag c --board vicdual.toml\nfn main() {}\n';
        assert_1.default.deepStrictEqual((0, toolmeta_1.matchDependencyPatterns)(src, (0, toolmeta_1.getIncludePatterns)('urust')), ['vicdual.toml']);
    });
    (0, mocha_1.it)('scans mod/use as module dependencies', function () {
        const src = 'mod audio;\npub mod bcd;\n' +
            'use audio::{music_play, SND_COIN};\nuse bcd::bcd_add;\nuse rs8::reset;\n';
        const deps = (0, toolmeta_1.matchDependencyPatterns)(src, (0, toolmeta_1.getIncludePatterns)('urust'));
        // `mod` names the file (foo.rs or foo/mod.rs); `use` is scanned for editor
        // links but skips the bare rs8 items (they live in the compiler)
        assert_1.default.deepStrictEqual(deps, ['audio.rs', 'bcd.rs', 'audio/mod.rs', 'bcd/mod.rs', 'audio.rs', 'bcd.rs']);
    });
    (0, mocha_1.it)('links rs8 register modules to the bundled sources', function () {
        const src = 'use rs8::nes::*;\nuse rs8::io;\nuse rs8::{reg, reset};\n';
        const deps = (0, toolmeta_1.matchDependencyPatterns)(src, (0, toolmeta_1.getIncludePatterns)('urust'));
        // one file per register module; bare items (reg/reset) have no file
        assert_1.default.deepStrictEqual(deps, ['nes.rs', 'io.rs']);
    });
    (0, mocha_1.it)('links a nested rs8 module to its child source', function () {
        const src = 'use rs8::nes::util::{pad_poll, ppu_off, PpuSafe};\n' +
            'use rs8::cbm::regs::VIC;\n' +
            'use rs8::math::sin;\n' +
            'use rs8::nes::PPUCTRL;\n';
        // a known child is a file of its own; a lowercase item (math::sin) and an
        // uppercase type (nes::PPUCTRL) stay with their module
        assert_1.default.deepStrictEqual((0, toolmeta_1.matchDependencyPatterns)(src, (0, toolmeta_1.getIncludePatterns)('urust')), ['nes/util.rs', 'cbm/regs.rs', 'math.rs', 'nes.rs']);
    });
    (0, mocha_1.it)('links every platform module urust bundles', function () {
        const src = 'use rs8::apple2::*;\nuse rs8::vic20::*;\nuse rs8::zx::*;\n';
        assert_1.default.deepStrictEqual((0, toolmeta_1.matchDependencyPatterns)(src, (0, toolmeta_1.getIncludePatterns)('urust')), ['apple2.rs', 'vic20.rs', 'zx.rs']);
    });
    (0, mocha_1.it)('links the modules named in a use brace group', function () {
        const src = 'use rs8::apple2;\nuse rs8::apple2::util;\n' +
            'use rs8::gfx::surface::*;\nuse rs8::{io, reset};\n';
        // one regex match cannot list a group's items; scanRs8UseGroups walks
        // the braces with the generated module/child table
        assert_1.default.deepStrictEqual((0, toolmeta_1.matchDependencyPatterns)(src, (0, toolmeta_1.getIncludePatterns)('urust')), ['apple2.rs', 'apple2/util.rs', 'gfx/surface.rs', 'io.rs']);
    });
    (0, mocha_1.it)('links nested modules inside a brace group', function () {
        const src = 'use rs8::{c64::util, nes::{console, X}};\n';
        // c64/util.rs and nes/console.rs are children; X is an item of nes, so
        // it links to the parent source, the same rule as rs8::nes::X
        assert_1.default.deepStrictEqual((0, toolmeta_1.matchDependencyPatterns)(src, (0, toolmeta_1.getIncludePatterns)('urust')), ['c64/util.rs', 'nes/console.rs', 'nes.rs']);
    });
    (0, mocha_1.it)('exposes the rs8 sources as a WASI filesystem for the editor', function () {
        assert_1.default.strictEqual((0, toolmeta_1.getSharedFileSystemName)('urust', 'devel-6502'), 'wasi:urust-fs.zip');
        assert_1.default.deepStrictEqual((0, toolmeta_1.getIncludeDirs)('urust', 'devel-6502'), ['/rs8']);
    });
    (0, mocha_1.it)('ships the rs8 module sources in the WASI filesystem package', async function () {
        // the package is built outside the repo, so it may not be here
        const zipfile = path.resolve((0, toolroot_1.toolRoot)(), 'src/worker/fs/urust-fs.zip');
        if (!fs.existsSync(zipfile))
            return this.skip();
        // /rs8/<module>.rs has to resolve for every module the include pattern links
        const zip = await jszip_1.default.loadAsync(fs.readFileSync(zipfile));
        for (const f of ['lib.rs', 'apple2.rs', 'atari8.rs', 'c64.rs', 'conio.rs', 'gb.rs', 'io.rs', 'nes.rs', 'rand.rs', 'vcs.rs', 'vic20.rs', 'zx.rs']) {
            assert_1.default.ok(zip.file('rs8/' + f), 'missing rs8/' + f);
        }
        // and every module the pattern links has to be in the package too (a
        // module urust dropped must not linger in URUST_RS8_MODULES)
        for (const module of toolmeta_1.URUST_RS8_MODULES) {
            assert_1.default.ok(zip.file(`rs8/${module}.rs`), `missing rs8/${module}.rs`);
        }
        // nested modules too: a link to rs8/nes/util.rs has to find the file
        for (const [module, children] of Object.entries(toolmeta_1.URUST_RS8_CHILDREN)) {
            for (const child of children) {
                assert_1.default.ok(zip.file(`rs8/${module}/${child}.rs`), `missing rs8/${module}/${child}.rs`);
            }
        }
        // ... and every source the package ships has to be linkable (so a new
        // urust module or child cannot ship without being added to the pattern)
        for (const entry of Object.keys(zip.files)) {
            const nested = /^rs8\/([^/]+)\/([^/]+)\.rs$/.exec(entry);
            if (nested) {
                assert_1.default.ok((toolmeta_1.URUST_RS8_CHILDREN[nested[1]] || []).includes(nested[2]), `unlisted child module ${entry}; run \`npm run gen-urustmods\``);
                continue;
            }
            const top = /^rs8\/([^/]+)\.rs$/.exec(entry);
            if (top && top[1] !== 'lib') {
                assert_1.default.ok(toolmeta_1.URUST_RS8_MODULES.includes(top[1]), `unlisted module ${entry}; run \`npm run gen-urustmods\``);
            }
        }
    });
    (0, mocha_1.it)('maps platform ids to urust platforms', function () {
        assert_1.default.strictEqual((0, urustparse_1.urustPlatformName)('devel-6502'), 'devel-6502');
        assert_1.default.strictEqual((0, urustparse_1.urustPlatformName)('nes'), 'nes');
        assert_1.default.strictEqual((0, urustparse_1.urustPlatformName)('c64'), 'c64');
        assert_1.default.strictEqual((0, urustparse_1.urustPlatformName)('atari8-800xl'), 'atari8');
        assert_1.default.strictEqual((0, urustparse_1.urustPlatformName)('vcs'), 'vcs');
        assert_1.default.strictEqual((0, urustparse_1.urustPlatformName)('apple2'), 'apple2');
        assert_1.default.strictEqual((0, urustparse_1.urustPlatformName)('vic20'), 'vic20');
        // the Z80 backend names the whole computer, not the CPU
        assert_1.default.strictEqual((0, urustparse_1.urustPlatformName)('zx'), 'zx-spectrum');
        assert_1.default.strictEqual((0, urustparse_1.urustPlatformName)('coleco'), 'colecovision');
        // urust targets the MSX and Game Boy too
        assert_1.default.strictEqual((0, urustparse_1.urustPlatformName)('msx'), 'msx');
        assert_1.default.strictEqual((0, urustparse_1.urustPlatformName)('gb'), 'gb');
        assert_1.default.strictEqual((0, urustparse_1.urustPlatformName)('atari7800'), 'atari7800');
        // .rs selects urust on every Z80 platform, but not every one is a target
        assert_1.default.strictEqual((0, urustparse_1.urustPlatformName)('cpc'), undefined);
        assert_1.default.strictEqual((0, urustparse_1.urustPlatformName)('verilog'), undefined);
    });
    (0, mocha_1.it)('parses JSON diagnostics; end column only on a single line', function () {
        const json = JSON.stringify([
            { level: 'error', message: 'bad type', file: 'main.rs', line: 2, col: 5, endLine: 2, endCol: 9 },
            { level: 'error', message: 'spans lines', file: 'main.rs', line: 4, col: 1, endLine: 6, endCol: 2 },
            { level: 'warning', message: 'in `f`: big', file: null, line: 0, col: 0, endLine: 0, endCol: 0 },
            { level: 'error', message: 'struct `P` must derive Clone and Copy', file: 'main.rs', line: 8, col: 1,
                endLine: 8, endCol: 5, help: ['add `#[derive(Clone, Copy)]` to `P`'], topic: 'no-clone' },
        ]);
        const { errors, warnings } = (0, urustparse_1.parseUrustDiagnostics)(json + '\nurust: unknown option `-x`\n', 'main.rs');
        assert_1.default.deepStrictEqual(errors[0], { line: 2, path: 'main.rs', msg: 'bad type', start: 4, end: 8 });
        assert_1.default.deepStrictEqual(errors[1], { line: 4, path: 'main.rs', msg: 'spans lines', start: 0 });
        assert_1.default.deepStrictEqual(errors[2], {
            line: 8, path: 'main.rs', msg: 'struct `P` must derive Clone and Copy', start: 0, end: 4,
            help: ['add `#[derive(Clone, Copy)]` to `P`'], topic: 'no-clone'
        });
        assert_1.default.deepStrictEqual(errors[3], { line: 0, path: 'main.rs', msg: 'unknown option `-x`' });
        assert_1.default.deepStrictEqual(warnings, [{ line: 0, path: 'main.rs', msg: 'in `f`: big', severity: 'warning' }]);
    });
    (0, mocha_1.it)('maps error topics to the published help docs', function () {
        assert_1.default.strictEqual((0, toolmeta_1.urustErrorDocURL)('no-clone'), 'https://8bitworkshop.com/docs/urust/reference/errors.html#no-clone');
        assert_1.default.strictEqual((0, toolmeta_1.urustErrorDocURL)('no-64-bit-int'), 'https://8bitworkshop.com/docs/urust/reference/errors.html#no-64-bit-int');
        assert_1.default.strictEqual((0, toolmeta_1.urustErrorDocURL)(null), undefined);
        assert_1.default.strictEqual((0, toolmeta_1.urustErrorDocURL)(''), undefined);
        assert_1.default.strictEqual((0, toolmeta_1.urustErrorDocURL)('bad slug/../x'), undefined);
    });
    const dbg = {
        files: ['main.rs'],
        symbols: [
            { name: 'main', addr: 0x8000, size: 20, kind: 'code', bank: null, ram: false },
            { name: 'score', addr: 0x10, size: 2, kind: 'data', bank: null, ram: true },
            { name: 'NMI', addr: 0x8100, size: 0, kind: 'code', bank: null, ram: false },
        ],
        lines: [
            { addr: 0x8000, size: 3, bank: null, file: 'main.rs', line: 3, col: 5, endLine: 3, endCol: 12, func: 'main' },
            { addr: 0x8003, size: 2, bank: null, file: 'main.rs', line: 3, col: 5, endLine: 4, endCol: 2, func: null },
        ],
        segments: [
            { name: 'ROM', start: 0x8000, size: 20, bank: null, type: 'rom' },
            { name: 'RAM', start: 0, size: 0x800, bank: null, type: 'ram' },
        ],
        variables: [
            { name: 'score', type: 'u16', size: 2, function: 'main', addr: 0x10, range: [0x8000, 0x8014], codeBank: null, file: 'main.rs', line: 1, col: 1 },
        ],
        globalVariables: [
            { name: 'hiscore', type: 'u16', size: 2, addr: 0x20, ram: true, mutable: true, bank: null, bankName: null, file: 'main.rs', line: 8, col: 1, expandable: false },
        ],
    };
    (0, mocha_1.it)('converts debug info for the debugger and memory map', function () {
        const r = (0, urustparse_1.urustDebugToResult)(dbg, ['main.rs']);
        assert_1.default.deepStrictEqual(r.listings['main.rs'].lines[0], { line: 3, offset: 0x8000, path: 'main.rs', start: 4, end: 11, iscode: true, func: 'main' });
        assert_1.default.strictEqual('end' in r.listings['main.rs'].lines[1], false);
        assert_1.default.deepStrictEqual(r.symbolmap, { main: 0x8000, score: 0x10, NMI: 0x8100 });
        assert_1.default.deepStrictEqual(r.symbolsizes, { main: 20, score: 2 });
        assert_1.default.strictEqual(r.segments[1].type, 'ram');
        assert_1.default.strictEqual(r.banked, false);
        assert_1.default.deepStrictEqual(r.variables, dbg.variables);
        assert_1.default.deepStrictEqual(r.debuginfo.sourceVariables, dbg.variables);
        assert_1.default.deepStrictEqual(r.debuginfo.globalVariables, dbg.globalVariables);
    });
    (0, mocha_1.it)('accepts debug output from a build without globals', function () {
        const old = Object.assign({}, dbg);
        delete old.globalVariables;
        const r = (0, urustparse_1.urustDebugToResult)(old, ['main.rs']);
        assert_1.default.deepStrictEqual(r.debuginfo.globalVariables, []);
    });
    (0, mocha_1.it)('flags banked output', function () {
        const banked = Object.assign(Object.assign({}, dbg), { lines: [Object.assign(Object.assign({}, dbg.lines[0]), { bank: 2 })] });
        assert_1.default.strictEqual((0, urustparse_1.urustDebugToResult)(banked, ['main.rs']).banked, true);
    });
});
//# sourceMappingURL=testurust.js.map