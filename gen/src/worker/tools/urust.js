"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileUrust = compileUrust;
const wasishim_1 = require("../../common/wasi/wasishim");
const toolmeta_1 = require("../../common/toolmeta");
const builder_1 = require("../builder");
const wasiutils_1 = require("../wasiutils");
const wasmutils_1 = require("../wasmutils");
const urustparse_1 = require("./urustparse");
let wasiModule = null;
// one run yields the ROM (-o) and the debug JSON (--debug-out); errors and
// warnings come back as a JSON array on stderr (--error-format json)
function compileUrust(step) {
    var _a, _b;
    (0, builder_1.gatherFiles)(step, { mainFilePath: "main.rs" });
    const binpath = step.prefix + ".bin";
    const dbgpath = step.prefix + ".json";
    if (!(0, builder_1.staleFiles)(step, [binpath]))
        return;
    const platform = (0, urustparse_1.urustPlatformName)(step.platform);
    (0, builder_1.fixParamsWithDefines)(step.path, step.params); // //#flag, //#symbol, //#tooldef
    if (!wasiModule) {
        wasiModule = new WebAssembly.Module((0, wasmutils_1.loadWASMBinary)("urust"));
    }
    const wasi = new wasishim_1.WASIRunner();
    wasi.initSync(wasiModule);
    (0, wasiutils_1.populateWASIFiles)(wasi, step);
    let args = ['urust', 'build', step.path, '--emit', 'bin', '-o', binpath,
        '-O1',
        '--trap', 'call',
        //'-fno-bounds-checks',
        '-Wall',
        '--no-rustc-compat',
        '--auto-mod',
        '--debug-out', dbgpath, '--error-format', 'json'];
    args.push.apply(args, (0, toolmeta_1.extraArgsFor)('urust', step.params && step.params.buildArgs));
    // TODO: put board in toolmeta?
    if (!args.includes('--board') && !args.includes('--platform')) {
        args.push.apply(args, ['--platform', platform]);
    }
    wasi.setArgs(args);
    const trapped = [];
    (0, wasiutils_1.runWASI)(wasi, trapped);
    const { errors, warnings } = (0, urustparse_1.parseUrustDiagnostics)(wasi.fds[2].getBytesAsString(), step.path);
    errors.push(...trapped);
    const output = (_a = wasi.fs.getFile("./" + binpath)) === null || _a === void 0 ? void 0 : _a.getBytes();
    const debugtext = (_b = wasi.fs.getFile("./" + dbgpath)) === null || _b === void 0 ? void 0 : _b.getBytesAsString();
    if (!errors.length && (!output || !debugtext)) {
        errors.push({ line: 0, path: step.path, msg: "urust did not produce " + binpath });
    }
    if (errors.length) {
        return { errors: errors.concat(warnings) };
    }
    const dbg = (0, urustparse_1.urustDebugToResult)(JSON.parse(debugtext), step.files);
    if (dbg.banked) {
        warnings.push({
            line: 0, path: step.path, severity: 'warning',
            msg: "this mapper has switchable ROM banks; source lines and symbols in banked code " +
                "are shown by address only, so the debugger may pick the wrong bank's line",
        });
    }
    (0, builder_1.putWorkFile)(binpath, output);
    (0, builder_1.putWorkFile)(dbgpath, debugtext);
    return {
        output,
        errors: [],
        warnings,
        listings: dbg.listings,
        symbolmap: dbg.symbolmap,
        symbolsizes: dbg.symbolsizes,
        segments: dbg.segments,
        debuginfo: dbg.debuginfo,
    };
}
//# sourceMappingURL=urust.js.map