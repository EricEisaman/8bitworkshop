"use strict";
// Adapter for urust's machine-readable output: `--error-format json` on
// stderr and the `--debug-out` file. Shared shape with the browser/WASI tool
// (src/worker/tools/urust.ts); kept free of worker imports so tests can use it.
Object.defineProperty(exports, "__esModule", { value: true });
exports.urustPlatformName = void 0;
exports.parseUrustDiagnostics = parseUrustDiagnostics;
exports.urustDebugToResult = urustDebugToResult;
const toolmeta_1 = require("../../common/toolmeta");
Object.defineProperty(exports, "urustPlatformName", { enumerable: true, get: function () { return toolmeta_1.urustPlatformName; } });
/**
 * Parse stderr from `urust --error-format json`. The JSON array is on one
 * line; anything else (`urust: ...` usage/IO failures, panics) becomes a
 * location-less error so nothing is dropped silently.
 */
function parseUrustDiagnostics(stderr, defaultPath) {
    var _a;
    const errors = [];
    const warnings = [];
    for (const text of stderr.split(/\r?\n/)) {
        if (!text.trim())
            continue;
        let diags = null;
        if (text.startsWith('[')) {
            try {
                diags = JSON.parse(text);
            }
            catch (e) { /* fall through */ }
        }
        if (!diags) {
            errors.push({ line: 0, path: defaultPath, msg: text.replace(/^urust: /, '') });
            continue;
        }
        for (const d of diags) {
            const e = { line: d.line, path: (_a = d.file) !== null && _a !== void 0 ? _a : defaultPath, msg: d.message };
            // Older urust builds have neither field; leave them off then so the
            // WorkerError shape stays as small as the diagnostic needs.
            if (d.help && d.help.length)
                e.help = d.help;
            if (d.topic)
                e.topic = d.topic;
            if (d.line > 0) {
                e.start = d.col - 1;
                if (d.endLine === d.line)
                    e.end = d.endCol - 1;
            }
            if (d.level === 'warning') {
                e.severity = 'warning';
                warnings.push(e);
            }
            else {
                errors.push(e);
            }
        }
    }
    return { errors, warnings };
}
/**
 * Convert the debug document to what the debugger and memory map consume.
 * `start`/`end` are 0-based columns; `end` is only set when the range ends on
 * the line it starts on (SourceLine has no end line).
 */
function urustDebugToResult(dbg, paths) {
    const listings = {};
    for (const path of paths)
        listings[path] = { lines: [] };
    let banked = false;
    for (const l of dbg.lines) {
        const listing = listings[l.file] || (listings[l.file] = { lines: [] });
        const sl = { line: l.line, offset: l.addr, path: l.file, start: l.col - 1, iscode: true };
        if (l.endLine === l.line)
            sl.end = l.endCol - 1;
        if (l.func)
            sl.func = l.func;
        if (l.bank != null)
            banked = true;
        listing.lines.push(sl);
    }
    const symbolmap = {};
    const symbolsizes = {};
    for (const s of dbg.symbols) {
        symbolmap[s.name] = s.addr;
        if (s.size > 0)
            symbolsizes[s.name] = s.size;
        if (s.bank != null)
            banked = true;
    }
    const segments = dbg.segments.map(g => ({
        name: g.name,
        start: g.start,
        size: g.size,
        type: g.type,
        source: 'native',
    }));
    if (dbg.segments.some(g => g.bank != null))
        banked = true;
    const variables = dbg.variables || [];
    const globalVariables = dbg.globalVariables || [];
    return {
        listings, symbolmap, symbolsizes, segments, variables, banked,
        debuginfo: { sourceVariables: variables, globalVariables },
    };
}
//# sourceMappingURL=urustparse.js.map