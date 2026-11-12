"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cvbasicTarget = cvbasicTarget;
exports.mapAsmLinesToBasic = mapAsmLinesToBasic;
exports.parseGasm80ListingLine = parseGasm80ListingLine;
exports.findProgramEndLine = findProgramEndLine;
exports.parseCVBasicListing = parseCVBasicListing;
exports.parseCVBasicDiagnostics = parseCVBasicDiagnostics;
exports.parseGasm80Diagnostics = parseGasm80Diagnostics;
exports.parseGasm80Symbols = parseGasm80Symbols;
exports.compileCVBasic = compileCVBasic;
// CVBasic (BASIC cross-compiler) + gasm80 (Z80/6502 assembler), both WASI.
//
//   cvbasic [--nes|--msx|--sms|--sg1000] main.bas main.asm [library_path]
//   gasm80 main.asm -o main.rom -l main.lst -s main.sym [-sms]
//
// CVBasic reads its prologue/epilogue files from the library path at runtime;
// cvbasic-fs.zip ships them at share/cvbasic, so it never needs an absolute
// path. gasm80 opens INCLUDE/INCBIN files relative to the cwd.
//
// The compiler copies each BASIC source line into the generated assembly as a
// `\t; \t<line>` comment, so the gasm80 listing (which maps assembly lines to
// addresses) can be turned back into BASIC source line -> address info for the
// debugger.
const wasishim_1 = require("../../common/wasi/wasishim");
const util_1 = require("../../common/util");
const toolmeta_1 = require("../../common/toolmeta");
const builder_1 = require("../builder");
const listingutils_1 = require("../listingutils");
const wasmutils_1 = require("../wasmutils");
const wasiutils_1 = require("../wasiutils");
const CVBASIC_LIB = 'share/cvbasic';
const wasiModules = {};
function getModule(tool) {
    if (!wasiModules[tool])
        wasiModules[tool] = new WebAssembly.Module((0, wasmutils_1.loadWASMBinary)(tool));
    return wasiModules[tool];
}
/** CVBasic console flag, gasm80 flags and ROM extension for an IDE platform. */
function cvbasicTarget(platform) {
    if (platform.startsWith('sms-sg1000'))
        return { console: ['--sg1000'], romExt: '.sg', sms: false };
    const root = (0, util_1.getRootBasePlatform)(platform);
    switch (root) {
        case 'msx':
            return { console: ['--msx'], romExt: '.rom', sms: false };
        case 'sms':
            return { console: ['--sms'], romExt: '.sms', sms: true };
        case 'nes':
            return { console: ['--nes'], romExt: '.nes', sms: false };
        case 'coleco':
            return { console: [], romExt: '.rom', sms: false };
        default:
            return null;
    }
}
/**
 * Map assembly line numbers (1-based) to BASIC source lines (1-based). CVBasic
 * emits the BASIC text as a `\t; \t` comment before each statement; the lines
 * are matched in order against the source, so repeated statements still land
 * on the right line.
 */
function mapAsmLinesToBasic(asm, source) {
    const src = source.split(listingutils_1.re_crlf);
    const map = new Map();
    const lines = asm.split(listingutils_1.re_crlf);
    let srcidx = 0;
    for (let i = 0; i < lines.length; i++) {
        // not every target has the "CVBasic program start." marker, and the
        // prologue has no `; \t` comments, so just match source lines in order
        const m = /^\t; \t(.*)$/.exec(lines[i]);
        if (!m)
            continue;
        const text = m[1].trim();
        if (!text)
            continue;
        for (let j = srcidx; j < src.length; j++) {
            if (src[j].trim() === text) {
                map.set(i + 1, j + 1);
                srcidx = j + 1;
                break;
            }
        }
    }
    return map;
}
// gasm80's listing columns are fixed (an 8-byte machine-code field):
//   "%04X  " + 16 chars of hex/padding + "  %05d %s"
function parseGasm80ListingLine(s) {
    if (s.length < 30)
        return null;
    const addr = s.substring(0, 4);
    const lnum = s.substring(24, 29);
    if (!/^[0-9A-Fa-f]{4}$/.test(addr))
        return null;
    if (!/^[0-9]{5}$/.test(lnum))
        return null;
    const insns = s.substring(6, 22).trim();
    if (insns && !/^([0-9A-Fa-f]{2})+$/.test(insns))
        return null;
    return { address: parseInt(addr, 16), insns, line: parseInt(lnum, 10) };
}
/**
 * Line number of the epilogue's `rom_end:` label, after which the listing is
 * variable allocation in RAM (low addresses), not program code.
 */
function findProgramEndLine(asm) {
    const lines = asm.split(listingutils_1.re_crlf);
    for (let i = 0; i < lines.length; i++)
        if (/^\s*rom_end:/.test(lines[i]))
            return i + 1;
    return Infinity;
}
/** Build the BASIC source listing from a gasm80 listing + asm->BASIC map. */
function parseCVBasicListing(lsttext, asmToBasic, endline = Infinity) {
    const lines = [];
    let curline = 0;
    let lastoff = -1;
    for (const raw of lsttext.split(listingutils_1.re_crlf)) {
        const lst = parseGasm80ListingLine(raw);
        if (!lst)
            continue;
        if (lst.line >= endline)
            break;
        const basline = asmToBasic.get(lst.line);
        if (basline != null)
            curline = basline;
        if (!curline)
            continue;
        // one entry per source line and address; the prologue has no source
        if (lst.address === lastoff && lines.length && lines[lines.length - 1].line === curline) {
            if (lst.insns) {
                const prev = lines[lines.length - 1];
                prev.insns = prev.insns ? prev.insns + ' ' + lst.insns : lst.insns;
                prev.iscode = true;
            }
            continue;
        }
        lines.push({ line: curline, offset: lst.address, insns: lst.insns || undefined, iscode: !!lst.insns });
        lastoff = lst.address;
    }
    return lines;
}
// "ERROR: <msg> at line <n> (<file>)" / "Warning: ..."
const re_cvbasic_diag = /^(ERROR|Warning|INFO):\s*(.+?) at line (\d+)(?: \((.+)\))?\s*$/;
// gasm80: "Error: <msg> at line <n>" / "Warning: ..."
const re_gasm80_diag = /^(Error|Warning):\s*(.+?) at line (\d+)\s*$/;
/** Parse CVBasic's stderr into errors and warnings. INFO lines are progress. */
function parseCVBasicDiagnostics(stderr, path, errors) {
    for (const line of stderr.split(listingutils_1.re_crlf)) {
        const m = re_cvbasic_diag.exec(line.trim());
        if (m) {
            if (m[1] === 'INFO')
                continue;
            const err = { line: parseInt(m[3], 10), path: m[4] || path, msg: m[2] };
            if (m[1] === 'Warning')
                err.severity = 'warning';
            errors.push(err);
        }
        else if (/^Error:/.test(line)) {
            errors.push({ line: 0, path, msg: line.replace(/^Error:\s*/, '') });
        }
    }
}
/** Parse gasm80's stderr, mapping assembly lines back to BASIC lines. */
function parseGasm80Diagnostics(stderr, asmToBasic, path, errors) {
    for (const line of stderr.split(listingutils_1.re_crlf)) {
        const m = re_gasm80_diag.exec(line.trim());
        if (m) {
            const err = {
                line: asmToBasic.get(parseInt(m[3], 10)) || 0,
                path,
                msg: m[2]
            };
            if (m[1] === 'Warning')
                err.severity = 'warning';
            errors.push(err);
        }
        else if (/^Error:/.test(line)) {
            errors.push({ line: 0, path, msg: line.replace(/^Error:\s*/, '') });
        }
    }
}
/** gasm80's -s file: "NAME: equ 0000ABCDh" */
function parseGasm80Symbols(symtext) {
    const symbols = {};
    for (const line of symtext.split(listingutils_1.re_crlf)) {
        const m = /^\s*([^\s:]+):\s*equ\s+([0-9A-Fa-f]+)h\s*$/i.exec(line);
        if (m)
            symbols[m[1]] = parseInt(m[2], 16);
    }
    return symbols;
}
async function compileCVBasic(step) {
    (0, builder_1.gatherFiles)(step, { mainFilePath: 'main.bas' });
    const target = cvbasicTarget(step.platform);
    if (!target) {
        return { errors: [{ line: 0, path: step.path, msg: `CVBasic does not support platform ${step.platform}` }] };
    }
    const asmpath = step.prefix + '.asm';
    const binpath = step.prefix + target.romExt;
    const lstpath = step.prefix + '.lst';
    const sympath = step.prefix + '.sym';
    if (!(0, builder_1.staleFiles)(step, [binpath]))
        return;
    const errors = [];
    const params = step.params;
    // 1. CVBasic: BASIC -> gasm80 assembly
    const fs = await (0, wasmutils_1.ensureWasiFilesystem)('cvbasic-fs.zip');
    if (!fs)
        throw new Error('Could not load cvbasic-fs.zip');
    const cvbasic = new wasishim_1.WASIRunner();
    cvbasic.initSync(getModule('cvbasic'));
    cvbasic.fs.setParent(fs);
    (0, wasiutils_1.populateWASIFiles)(cvbasic, step);
    const cvargs = ['cvbasic'].concat(target.console);
    cvargs.push.apply(cvargs, (0, toolmeta_1.defineArgs)('cvbasic', params && params.symbols && params.symbols.compiler));
    cvargs.push.apply(cvargs, (0, toolmeta_1.extraArgsFor)('cvbasic', params && params.buildArgs));
    cvargs.push(step.path, asmpath, CVBASIC_LIB);
    cvbasic.setArgs(cvargs);
    (0, wasiutils_1.runWASI)(cvbasic, errors);
    const cvstderr = cvbasic.fds[2].getBytesAsString();
    parseCVBasicDiagnostics(cvstderr, step.path, errors);
    if (cvbasic.errno && !errors.length)
        errors.push({ line: 0, path: step.path, msg: `CVBasic exited with code ${cvbasic.errno}` });
    if (errors.some(e => !e.severity))
        return { errors };
    const asmfile = cvbasic.fs.getFile('./' + asmpath);
    if (!asmfile) {
        errors.push({ line: 0, path: step.path, msg: 'CVBasic produced no output' });
        return { errors };
    }
    const asmtext = asmfile.getBytesAsString();
    // 2. gasm80: assembly -> ROM (+ listing and symbols)
    const asmrunner = new wasishim_1.WASIRunner();
    asmrunner.initSync(getModule('gasm80'));
    (0, wasiutils_1.populateWASIFiles)(asmrunner, step);
    asmrunner.fs.putFile('./' + asmpath, asmtext);
    const asmargs = ['gasm80', asmpath, '-o', binpath, '-l', lstpath, '-s', sympath];
    if (target.sms)
        asmargs.push('-sms');
    asmrunner.setArgs(asmargs);
    (0, wasiutils_1.runWASI)(asmrunner, errors);
    const asmToBasic = mapAsmLinesToBasic(asmtext, (0, builder_1.getWorkFileAsString)(step.path));
    const asmstderr = asmrunner.fds[2].getBytesAsString();
    parseGasm80Diagnostics(asmstderr, asmToBasic, step.path, errors);
    if (asmrunner.errno && !errors.length)
        errors.push({ line: 0, path: step.path, msg: `gasm80 exited with code ${asmrunner.errno}` });
    if (errors.some(e => !e.severity))
        return { errors };
    const output = (0, wasiutils_1.readWASIOutput)(asmrunner, './' + binpath);
    const lsttext = (0, wasiutils_1.readWASIOutputString)(asmrunner, './' + lstpath);
    const symtext = (0, wasiutils_1.readWASIOutputString)(asmrunner, './' + sympath);
    (0, builder_1.putWorkFile)(asmpath, asmtext);
    (0, builder_1.putWorkFile)(binpath, output);
    (0, builder_1.putWorkFile)(lstpath, lsttext);
    (0, builder_1.putWorkFile)(sympath, symtext);
    const listings = {};
    listings[step.path] = { lines: parseCVBasicListing(lsttext, asmToBasic, findProgramEndLine(asmtext)) };
    return {
        output,
        errors: [],
        warnings: errors,
        listings,
        symbolmap: parseGasm80Symbols(symtext),
    };
}
//# sourceMappingURL=cvbasic.js.map