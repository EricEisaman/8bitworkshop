"use strict";
/**
 * Source lines to interleave into the Disassembly window.
 *
 * The disassembly is generated from the emulated machine, but a build's
 * listings know which source line each address came from. This maps the
 * addresses where a source line starts to its file, line and text, so the
 * view can show the source next to the instructions it compiled to.
 *
 * Kept free of DOM / CodeMirror dependencies so it can be unit tested.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSourceLineMap = buildSourceLineMap;
exports.formatSourceComment = formatSourceComment;
exports.isSourceComment = isSourceComment;
const util_1 = require("../../common/util");
/** The source file a listing's lines came from, for listings that don't tag
 * each line with a path: SDCC's "hello.c.lst", for example, holds "hello.c". */
function sourcePathForListing(name) {
    return name.replace(/\.lst$/i, '');
}
/**
 * Map instruction addresses to the source lines that start there. The first
 * listing that supplies real source text for an address wins; lines without
 * source text (e.g. a routine from a library that isn't part of the project)
 * are skipped so the disassembly stays readable. `includePath` filters out
 * sources that shouldn't be interleaved (the caller uses it for assemblers,
 * whose instructions are the disassembly already).
 */
function buildSourceLineMap(listings, readLine, includePath) {
    const map = new Map();
    if (!listings)
        return map;
    for (const lstfn in listings) {
        const lst = listings[lstfn];
        // a mixed listing (oscar64) has one SourceFile per source path; using the
        // combined sourcefile as well would add every line twice
        const files = lst.sourcefiles
            ? Object.entries(lst.sourcefiles)
            : [[lstfn, lst.sourcefile]];
        for (const [key, sf] of files) {
            if (!sf)
                continue;
            for (const [addr, loc] of sf.offset2loc) {
                if (map.has(addr) || loc.line < 1)
                    continue;
                const path = loc.path || sourcePathForListing(key);
                if (includePath && !includePath(path))
                    continue;
                const text = readLine(path, loc.line);
                if (text == null)
                    continue;
                map.set(addr, { path, file: (0, util_1.getFilenameForPath)(path), line: loc.line, text });
            }
        }
    }
    return map;
}
/** A source line as a disassembly comment: "; file.c:12: int x = 1;" */
function formatSourceComment(line) {
    const text = line.text.replace(/\s+$/, '');
    return `; ${line.file}:${line.line}:${text.length ? ' ' + text : ''}`;
}
/** True for the source comments formatSourceComment() adds, so the view can
 * style them without mistaking a listing's own comment for one. */
function isSourceComment(text) {
    return /^; .+:\d+:/.test(text);
}
//# sourceMappingURL=disasmsource.js.map