"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeaderView = exports.ListingView = exports.DisassemblerView = exports.SourceEditor = exports.textMapFunctions = exports.PC_LINE_LOOKAHEAD = void 0;
exports.setUppercaseOnly = setUppercaseOnly;
exports.resolveIncludeFile = resolveIncludeFile;
exports.getLanguageForFilename = getLanguageForFilename;
exports.lookupSharedFileText = lookupSharedFileText;
const commands_1 = require("@codemirror/commands");
const language_1 = require("@codemirror/language");
const search_1 = require("@codemirror/search");
const state_1 = require("@codemirror/state");
const view_1 = require("@codemirror/view");
const probe_1 = require("../../common/probe");
const util_1 = require("../../common/util");
const toolmeta_1 = require("../../common/toolmeta");
const registry_1 = require("../../parser/registry");
const cobalt_1 = require("../../themes/cobalt");
const disassemblyTheme_1 = require("../../themes/disassemblyTheme");
const editorTheme_1 = require("../../themes/editorTheme");
const mbo_1 = require("../../themes/mbo");
const settings_1 = require("../settings");
const tabs_1 = require("./tabs");
const ui_1 = require("../ui");
const breakpoints_1 = require("../breakpoints");
const keys_1 = require("../keys");
// Free the mod+shift+<letter> keys the IDE binds (see IDE_RESERVED_KEYS) so its
// debug shortcuts work while an editor is focused. CodeMirror claims two of
// them today: deleteLine ("Shift-Mod-k") and selectSelectionMatches
// ("Mod-Shift-l"); deleteLine keeps a home on Mod-Shift-Backspace.
const ideDefaultKeymap = [...(0, keys_1.stripCMKeymap)(commands_1.defaultKeymap, keys_1.IDE_RESERVED_KEYS), { key: "Mod-Shift-Backspace", run: commands_1.deleteLine }];
const ideSearchKeymap = (0, keys_1.stripCMKeymap)(search_1.searchKeymap, keys_1.IDE_RESERVED_KEYS);
const assetdecorations_1 = require("./assetdecorations");
const includedecorations_1 = require("./includedecorations");
const baseviews_1 = require("./baseviews");
const filters_1 = require("./filters");
const debugline_1 = require("./debugline");
const gutter_1 = require("./gutter");
const visuals_1 = require("./visuals");
const traceheat_1 = require("./traceheat");
const disasmsource_1 = require("./disasmsource");
const sourcevars_1 = require("../../common/sourcevars");
// look ahead this many bytes when finding source lines for a PC
exports.PC_LINE_LOOKAHEAD = 64;
// Asset range tracking. Positions are automatically remapped through
// document changes (edits, undo, redo) by CodeMirror's transaction system.
const setAssetRangesEffect = state_1.StateEffect.define();
const clearAssetRangesEffect = state_1.StateEffect.define();
const assetRangesField = state_1.StateField.define({
    create() { return new Map(); },
    update(ranges, tr) {
        let result = ranges;
        for (let e of tr.effects) {
            if (e.is(clearAssetRangesEffect)) {
                result = new Map();
            }
            else if (e.is(setAssetRangesEffect)) {
                if (result === ranges)
                    result = new Map(ranges);
                for (let r of e.value) {
                    result.set(r.id, { from: r.from, to: r.to });
                }
            }
        }
        if (!tr.changes.empty) {
            const mapped = new Map();
            for (const [id, r] of result) {
                mapped.set(id, {
                    from: tr.changes.mapPos(r.from, -1),
                    to: tr.changes.mapPos(r.to, 1)
                });
            }
            return mapped;
        }
        return result;
    }
});
const MAX_ERRORS = 200;
const MODEDEFS = {
    default: { theme: mbo_1.mbo }, // NOTE: Not merged w/ other modes
    '6502': { isAsm: true },
    z80: { isAsm: true },
    jsasm: { isAsm: true },
    gas: { isAsm: true },
    vasm: { isAsm: true },
    inform6: { theme: cobalt_1.cobalt },
    dialog: { theme: cobalt_1.cobalt, lineWrap: true },
    markdown: { lineWrap: true },
    fastbasic: { noGutters: true },
    basic: { noGutters: true, lineBased: true },
    ecs: { theme: mbo_1.mbo }, // TODO: is actually mixed-mode, as is verilog
};
exports.textMapFunctions = {
    input: null
};
function setUppercaseOnly(uppercaseOnly) {
    exports.textMapFunctions.input = uppercaseOnly ? (s) => s.toUpperCase() : null;
}
/** Return the current selection text from a CodeMirror view ('' if none). */
function getEditorSelectionText(view) {
    if (!view)
        return '';
    const range = view.state.selection.main;
    if (range.empty)
        return '';
    return view.state.sliceDoc(range.from, range.to);
}
/** Executable line offsets for the gutter, keyed by source line. */
function sourceLineOffsetMap(sourcefile) {
    const offsets = new Map();
    for (var info of (sourcefile && sourcefile.lines) || []) {
        if (info.offset >= 0)
            offsets.set(info.line, (0, util_1.hex)(info.offset & 0xffff, 4));
    }
    return offsets;
}
/**
 * Draw the stopped function's variable values at the ends of the lines that
 * name them, in the source view `view` showing `sourcefile`. Only a halted
 * program has values worth showing. `stopLine` steers which line wins a
 * variable (see inlineSourceValues).
 */
function drawInlineValues(view, sourcefile, stopLine) {
    const p = ui_1.platform;
    if (!sourcefile || typeof p.getInlineSourceValues !== "function" || ui_1.platform.isRunning())
        return;
    const doc = view.state.doc;
    const values = p.getInlineSourceValues(sourcefile.lines, (n) => (n >= 1 && n <= doc.lines ? doc.line(n).text : null), stopLine);
    (0, debugline_1.showInlineValues)(view, values);
}
class SourceEditor {
    constructor(path, mode) {
        this.updateTimer = null;
        this.indentUnitCompartment = new state_1.Compartment();
        this.isAsm = false;
        this.dirtylisting = true;
        this.refreshDelayMsec = 300;
        this.probe = null;
        // Cumulative executed-line counts for this tracing session. Only lines
        // executed in the last update are shown, but their color (hot/cold) comes
        // from these totals so it stays stable from tick to tick.
        this.tracedLineCounts = new Map();
        this.path = path;
        this.mode = mode;
    }
    createDiv(parent) {
        var div = document.createElement('div');
        div.setAttribute("class", "editor");
        parent.appendChild(div);
        var text = ui_1.current_project.getFile(this.path);
        var asmOverride = text && this.mode == 'verilog' && /__asm\b([\s\S]+?)\b__endasm\b/.test(text);
        this.newEditor(div, text, asmOverride);
        this.editor.dispatch({
            effects: (0, filters_1.createTextTransformFilterEffect)(exports.textMapFunctions),
        });
        this.syncBreakpoints(); // render breakpoints from the shared store
        if (ui_1.current_project.getToolForFilename(this.path).startsWith("remote:")) {
            this.refreshDelayMsec = 1000; // remote URLs get slower refresh
        }
        return div;
    }
    setVisible(showing) {
        if (showing) {
            this.editor.focus(); // so that keyboard works when moving between files
            if (SourceEditor.tracingEnabled)
                this.startTracing();
        }
        else {
            this.stopTracing();
        }
    }
    // a few of the CodeMirror bindings available while editing;
    // chips are clickable and run the command on this editor
    getShortcuts() {
        if (!this.editor)
            return [];
        var ed = this.editor;
        var mk = (key, label, cmd) => ({
            key, label, fn: () => { cmd(ed); ed.focus(); }
        });
        return [
            mk('mod+f', 'Find', search_1.openSearchPanel),
            mk('mod+g', 'Find Next', search_1.findNext),
            mk('mod+d', 'Next Occurrence', search_1.selectNextOccurrence),
            //mk('mod+shift+backspace', 'Delete Line', deleteLine),
            //mk('mod+/', 'Toggle Comment', toggleComment),
            mk('mod+z', 'Undo', commands_1.undo),
            mk('mod+shift+z', 'Redo', commands_1.redo),
        ];
    }
    startTracing() {
        if (!this.probe && ui_1.platform.startProbing) {
            this.probe = ui_1.platform.startProbing();
            this.probe.singleFrame = false; // accumulate between our polls, we clear it ourselves
            this.probe.clear();
            this.tracedLineCounts.clear();
        }
    }
    stopTracing() {
        if (this.probe) {
            ui_1.platform.stopProbing();
            this.probe = null;
        }
        this.tracedLineCounts.clear();
        this.editor.dispatch({ effects: visuals_1.tracedLines.effect.of([]) });
    }
    setTracingEnabled(enabled) {
        SourceEditor.tracingEnabled = enabled;
        if (enabled)
            this.startTracing();
        else
            this.stopTracing();
    }
    newEditor(parent, text, isAsmOverride) {
        var modedef = MODEDEFS[this.mode] || MODEDEFS.default;
        var isAsm = isAsmOverride || modedef.isAsm;
        var lineWrap = !!modedef.lineWrap;
        var theme = modedef.theme || MODEDEFS.default.theme;
        var lineNums = modedef.useLineNumbers && !baseviews_1.isMobileDevice;
        if (ui_1.qs['embed']) {
            lineNums = false; // no line numbers while embedded
            isAsm = false; // no opcode bytes either
        }
        this.isAsm = isAsm;
        const minimalGutters = modedef.noGutters || baseviews_1.isMobileDevice;
        var parser;
        const registryEntry = registry_1.parserRegistry[this.mode];
        if (registryEntry) {
            parser = registryEntry.language;
        }
        else {
            console.warn("Unknown mode: " + this.mode);
            parser = null;
        }
        this.editor = new view_1.EditorView({
            parent: parent,
            doc: text,
            extensions: [
                // Non-asm: indent unit detected from the file (placed before settings so it takes precedence over tabSize-based indentUnit)
                this.indentUnitCompartment.of(this.indentUnitFor(text)),
                // Asm: copy previous line's indentation since asm parsers lack proper indent rules
                isAsm ? language_1.indentService.of((context, pos) => {
                    let lineNum = context.state.doc.lineAt(pos).number;
                    if (lineNum >= 0) {
                        let prevLine = context.state.doc.line(lineNum);
                        if (prevLine.text.trim()) {
                            return context.lineIndent(prevLine.from);
                        }
                    }
                    return 0;
                }) : [],
                // Asm files: tab/backspace work on inferred tab stops when
                // "insert spaces when pressing tab" is enabled. Placed before the
                // settings keymap so it takes precedence over indentMore/insertTab.
                ...(isAsm ? [view_1.keymap.of((0, tabs_1.asmSpacesKeymap)(() => (0, settings_1.loadSettings)().tabsToSpaces))] : []),
                // Line-numbered BASIC: Enter doesn't auto-indent. Must precede the default keymap.
                modedef.lineBased ? view_1.keymap.of(tabs_1.lineBasedEnterKeymap) : [],
                // Keybindings from settings must appear before default keymap.
                ...(0, settings_1.settingsExtensions)((0, settings_1.loadSettings)()),
                // https://codemirror.net/docs/ref/#commands.defaultKeymap includes
                // https://codemirror.net/docs/ref/#commands.standardKeymap
                view_1.keymap.of(ideDefaultKeymap),
                lineNums ? (0, view_1.lineNumbers)() : [],
                // Undo history.
                (0, commands_1.history)(),
                view_1.keymap.of(commands_1.historyKeymap),
                // Code fold gutter.
                (0, language_1.foldGutter)(),
                (0, view_1.dropCursor)(),
                state_1.EditorState.allowMultipleSelections.of(true),
                (0, view_1.drawSelection)(),
                (0, language_1.indentOnInput)(),
                (0, language_1.bracketMatching)(),
                // Rectangular selection and crosshair cursor.
                (0, view_1.rectangularSelection)(),
                (0, view_1.crosshairCursor)(),
                (0, view_1.highlightActiveLine)(),
                (0, view_1.highlightActiveLineGutter)(),
                (0, search_1.highlightSelectionMatches)(),
                (0, search_1.search)({ top: true }),
                view_1.keymap.of(ideSearchKeymap),
                // lintGutter(),
                // autocompletion(),
                parser || [],
                theme,
                editorTheme_1.editorTheme,
                lineWrap ? view_1.EditorView.lineWrapping : [],
                !minimalGutters ? [
                    gutter_1.offset.field,
                    gutter_1.offset.gutter,
                ] : [],
                isAsm && !minimalGutters ? [
                    gutter_1.bytes.field,
                    gutter_1.bytes.gutter,
                    gutter_1.clock.field,
                    gutter_1.clock.gutter,
                ] : [],
                debugline_1.debugGutterExtensions,
                view_1.EditorView.updateListener.of(update => {
                    for (let effect of update.transactions.flatMap(tr => tr.effects)) {
                        if (effect.is(gutter_1.breakpointMarkers.requestToggle)) {
                            // the store notifies listeners, which syncs markers and re-arms
                            breakpoints_1.bpStore.toggleSourceLine(this.path, effect.value);
                        }
                        if (effect.is(gutter_1.currentPcMarker.runToLine)) {
                            const lineNum = effect.value;
                            if (this.sourcefile && this.sourcefile.line2offset) {
                                const pc = this.sourcefile.line2offset.get(lineNum);
                                if (pc >= 0) {
                                    (0, ui_1.runToPC)([pc]);
                                }
                            }
                        }
                    }
                }),
                visuals_1.errorMessages.field,
                visuals_1.errorSpans.field,
                visuals_1.highlightLines.field,
                visuals_1.tracedLines.field,
                assetRangesField,
                (0, assetdecorations_1.createAssetHeaderPlugin)((lineNumber) => {
                    window.location.hash = 'asseteditor/' + encodeURIComponent(this.path) + '/' + lineNumber;
                }),
                // badges on include lines (#include, .include, ...) -> read-only view
                ui_1.qs['embed'] ? [] : (0, includedecorations_1.createIncludeLinkPlugin)(() => {
                    var tool = ui_1.current_project && ui_1.current_project.getToolForFilename(this.path);
                    var platform_id = ui_1.current_project && ui_1.current_project.platform_id;
                    return [...(0, toolmeta_1.getIncludePatterns)(tool, platform_id),
                        ...(0, toolmeta_1.getLinkPatterns)(tool, platform_id),
                        ...(0, toolmeta_1.getSystemIncludePatterns)(tool)];
                }, (filename, system) => {
                    // quoted includes: project files (presets/local) link to their own
                    // editor window; fall through to the read-only viewer otherwise
                    if (!system) {
                        var path = resolveIncludeFile(filename);
                        if (path) {
                            window.location.hash = '#' + encodeURIComponent(path);
                            return;
                        }
                    }
                    // system headers (<foo.h>) and unresolved files: toolchain
                    // filesystem via the read-only viewer
                    (0, ui_1.openHeaderFile)(filename);
                }, 
                // one directive can offer several candidates (`mod foo;` -> foo.rs
                // or foo/mod.rs); link to whichever file exists
                (filename) => resolveIncludeFile(filename) != null),
                filters_1.textTransformFilterCompartment.of([]),
                // update file in project (and recompile) when edits made
                view_1.EditorView.updateListener.of(update => {
                    if (update.docChanged) {
                        this.editorChanged();
                    }
                }),
                // inspect symbol when it's highlighted (double-click)
                visuals_1.showValue.field,
                view_1.EditorView.updateListener.of(update => {
                    if (update.selectionSet) {
                        this.inspectUnderCursor(update);
                    }
                }),
            ],
        });
        // TODO: unregister when editor is destroyed
        (0, settings_1.registerEditor)(this.editor);
    }
    editorChanged() {
        clearTimeout(this.updateTimer);
        this.updateTimer = setTimeout(() => {
            ui_1.current_project.updateFile(this.path, this.editor.state.doc.toString());
        }, this.refreshDelayMsec);
    }
    flushChanges() {
        if (this.updateTimer) {
            clearTimeout(this.updateTimer);
            this.updateTimer = null;
            ui_1.current_project.updateFile(this.path, this.editor.state.doc.toString());
        }
    }
    inspectUnderCursor(update) {
        // TODO: handle multi-select
        const range = update.state.selection.main;
        const selectedText = update.state.sliceDoc(range.from, range.to).trim();
        var result;
        if (ui_1.platform.inspect) {
            result = ui_1.platform.inspect(selectedText);
        }
        if (!range.empty && result && result.length < 80) {
            update.view.dispatch({
                effects: visuals_1.showValue.effect.of({ range: range, val: result })
            });
        }
        else {
            update.view.dispatch({
                effects: visuals_1.showValue.effect.of(null)
            });
        }
    }
    indentUnitFor(text) {
        return this.isAsm ? [] : language_1.indentUnit.of((0, tabs_1.detectIndentUnit)(text));
    }
    setText(text) {
        var oldtext = this.editor.state.doc.toString();
        if (oldtext != text) {
            this.editor.dispatch({
                changes: { from: 0, to: this.editor.state.doc.length, insert: text },
                annotations: commands_1.isolateHistory.of("full"),
                effects: this.indentUnitCompartment.reconfigure(this.indentUnitFor(text)),
            });
        }
    }
    replaceTextRange(from, to, text) {
        const lineStart = this.editor.state.doc.lineAt(from).from;
        this.editor.dispatch({
            changes: { from, to, insert: text },
            annotations: commands_1.isolateHistory.of("full"),
            selection: { anchor: from + text.length, head: from },
            effects: [
                view_1.EditorView.scrollIntoView(lineStart, { y: "start", yMargin: 100 /*pixels*/ }),
            ]
        });
    }
    setAssetRange(id, from, to) {
        this.editor.dispatch({
            effects: setAssetRangesEffect.of([{ id, from, to }])
        });
    }
    getAssetText(id) {
        var range = this.editor.state.field(assetRangesField).get(id);
        if (!range)
            return null;
        return this.editor.state.doc.sliceString(range.from, range.to);
    }
    replaceAssetText(id, text) {
        var range = this.editor.state.field(assetRangesField).get(id);
        if (!range)
            return;
        this.replaceTextRange(range.from, range.to, text);
    }
    clearAssetRanges() {
        this.editor.dispatch({
            effects: clearAssetRangesEffect.of(undefined)
        });
    }
    insertLinesBefore(text) {
        const pos = this.editor.state.selection.main.from;
        const lineNum = this.editor.state.doc.lineAt(pos).number;
        const lineFrom = this.editor.state.doc.lineAt(pos).from;
        const insertedLineCount = text.split("\n").length - 1;
        this.editor.dispatch({
            changes: { from: lineFrom, insert: text },
        });
        this.highlightLines(lineNum - 1, lineNum + insertedLineCount - 2);
    }
    highlightLines(start, end) {
        const startLine = this.editor.state.doc.line(start + 1);
        this.editor.dispatch({
            effects: [
                visuals_1.highlightLines.effect.of({ start: start + 1, end: end + 1 }),
                view_1.EditorView.scrollIntoView(startLine.from, { y: "start", yMargin: 100 /*pixels*/ }),
            ]
        });
    }
    navigateToLine(line) {
        if (line < 1 || line > this.editor.state.doc.lines)
            return;
        const targetLine = this.editor.state.doc.line(line);
        this.editor.dispatch({
            selection: { anchor: targetLine.from },
            effects: [
                visuals_1.highlightLines.effect.of({ start: line, end: line }),
                view_1.EditorView.scrollIntoView(targetLine.from, { y: "center" }),
            ],
        });
        this.editor.focus();
    }
    getValue() {
        return this.editor.state.doc.toString();
    }
    getSelectionText() {
        return getEditorSelectionText(this.editor);
    }
    getPath() { return this.path; }
    markErrors(errors) {
        // TODO: move cursor to error line if offscreen?
        this.clearErrors();
        errors = errors.slice(0, MAX_ERRORS);
        const newErrors = new Map();
        const spans = [];
        for (var info of errors) {
            // only mark errors with this filename, or without any filename
            if (!info.path || this.path.endsWith(info.path)) {
                var numLines = this.editor.state.doc.lines;
                var line = info.line;
                if (isNaN(line) || line < 1 || line > numLines)
                    line = 1;
                // an error on the line wins over a warning
                if (!(info.severity === 'warning' && newErrors.has(line))) {
                    newErrors.set(line, {
                        msg: info.msg, warning: info.severity === 'warning', help: info.help, topic: info.topic
                    });
                }
                // collect column-level spans
                if (info.start != null && info.end != null && info.end > info.start) {
                    spans.push({ line, start: info.start, end: info.end, warning: info.severity === 'warning' });
                }
            }
        }
        this.editor.dispatch({
            effects: [
                gutter_1.errorMarkers.set.of(newErrors),
                visuals_1.errorSpans.effect.of(spans.length > 0 ? spans : null),
            ],
        });
    }
    clearErrors() {
        this.dirtylisting = true;
        this.editor.dispatch({
            effects: [
                gutter_1.errorMarkers.set.of(new Map()),
                gutter_1.errorMarkers.showMessage.of(null),
                visuals_1.errorSpans.effect.of(null),
            ],
        });
    }
    getSourceFile() { return this.sourcefile; }
    updateListing() {
        // update editor annotations
        // TODO: recreate editor if gutter-bytes is used (verilog)
        this.clearErrors();
        var lstlines = this.sourcefile.lines || [];
        const newOffsets = sourceLineOffsetMap(this.sourcefile);
        const newBytes = new Map();
        const newClocks = new Map();
        for (var info of lstlines) {
            //if (info.path && info.path != this.path) continue;
            if (info.insns) {
                var insnstr = info.insns.length > 9 ? ("...") : info.insns;
                newBytes.set(info.line, insnstr);
                if (info.iscode) {
                    // TODO: labels trick this part?
                    if (info.cycles) {
                        newClocks.set(info.line, info.cycles + "");
                    }
                    else if (ui_1.platform.getOpcodeMetadata) {
                        var opcode = parseInt(info.insns.split(" ")[0], 16);
                        var meta = ui_1.platform.getOpcodeMetadata(opcode, info.offset);
                        if (meta && meta.minCycles) {
                            var clockstr = meta.minCycles + "";
                            newClocks.set(info.line, clockstr);
                        }
                    }
                }
            }
        }
        this.editor.dispatch({
            effects: [
                gutter_1.offset.set.of(newOffsets),
                gutter_1.bytes.set.of(newBytes),
                gutter_1.clock.set.of(newClocks),
            ],
        });
    }
    setTimingResult(result) {
        if (this.sourcefile == null)
            return;
        var newBytes = new Map();
        for (const [line, pc] of this.sourcefile.line2offset) {
            let clocks = result.pc2clockrange[pc];
            var minclocks = clocks && clocks.minclocks;
            var maxclocks = clocks && clocks.maxclocks;
            if (minclocks >= 0 && maxclocks >= 0) {
                var s;
                if (maxclocks == minclocks)
                    s = minclocks + "";
                else
                    s = minclocks + "-" + maxclocks;
                if (maxclocks == result.MAX_CLOCKS)
                    s += "+";
                newBytes.set(line, s);
            }
        }
        this.editor.dispatch({
            effects: [
                gutter_1.bytes.set.of(newBytes),
            ],
        });
    }
    setCurrentLine(line, moveCursor) {
        this.clearCurrentLine(moveCursor);
        if (line) {
            // Validate line number is within document range (TODO: open disassembler)
            if (line.line < 1 || line.line > this.editor.state.doc.lines) {
                return;
            }
            (0, debugline_1.showDebugLine)(this.editor, line, moveCursor);
            this.currentDebugLine = line;
            this.refreshInlineValues();
        }
    }
    /** Draw the stopped function's variable values (see drawInlineValues). */
    refreshInlineValues() {
        drawInlineValues(this.editor, this.sourcefile, this.currentDebugLine && this.currentDebugLine.line);
    }
    clearCurrentLine(moveCursor) {
        if (this.currentDebugLine) {
            if (moveCursor) {
                const pos = this.editor.state.selection.main.head;
                this.editor.dispatch({ selection: { anchor: pos, head: pos } });
            }
            this.currentDebugLine = null;
        }
        (0, debugline_1.clearDebugLine)(this.editor);
        (0, debugline_1.showInlineValues)(this.editor, new Map());
    }
    getActiveLine() {
        if (this.sourcefile) {
            var cpustate = ui_1.lastDebugState && ui_1.lastDebugState.c;
            if (!cpustate && ui_1.platform.getCPUState && !ui_1.platform.isRunning())
                cpustate = ui_1.platform.getCPUState();
            if (cpustate) {
                var EPC = (cpustate && (cpustate.EPC || cpustate.PC));
                var res = this.sourcefile.findLineForOffset(EPC, exports.PC_LINE_LOOKAHEAD);
                return res;
            }
        }
    }
    refreshDebugState(moveCursor) {
        var line = this.getActiveLine();
        if (!moveCursor && (line === this.currentDebugLine || (!line && !this.currentDebugLine))) {
            return;
        }
        this.setCurrentLine(line, moveCursor);
    }
    refreshListing() {
        // lookup corresponding sourcefile for this file, using listing
        var lst = ui_1.current_project.getListingForFile(this.path);
        if (lst && lst.sourcefile && lst.sourcefile !== this.sourcefile) {
            this.sourcefile = lst.sourcefile;
            this.dirtylisting = true;
        }
        if (!this.sourcefile || !this.dirtylisting)
            return;
        this.updateListing();
        this.dirtylisting = false;
    }
    refresh(moveCursor) {
        this.refreshListing();
        this.refreshDebugState(moveCursor);
    }
    tick() {
        this.refreshDebugState(false);
        this.updateTracedLines();
    }
    updateTracedLines() {
        const p = this.probe;
        if (!p || !p.idx || !this.sourcefile)
            return;
        // Accumulate per-line counts since tracing started, and remember which
        // lines ran in this update (those are the only ones we'll highlight).
        const activeLines = new Set();
        for (let i = 0; i < p.idx; i++) {
            const word = p.buf[i];
            if ((word & 0xff000000) === probe_1.ProbeFlags.EXECUTE) {
                const loc = this.sourcefile.findLineForOffset(word & 0xffff, exports.PC_LINE_LOOKAHEAD);
                if (loc) {
                    this.tracedLineCounts.set(loc.line, (this.tracedLineCounts.get(loc.line) || 0) + 1);
                    activeLines.add(loc.line);
                }
            }
        }
        p.clear();
        this.editor.dispatch({
            effects: visuals_1.tracedLines.effect.of((0, traceheat_1.computeHeatLevels)(this.tracedLineCounts, activeLines)),
        });
    }
    getLine(line) {
        return this.editor.state.doc.line(line).text;
    }
    getCurrentLine() {
        const pos = this.editor.state.selection.main.head;
        return this.editor.state.doc.lineAt(pos).number;
    }
    getCursorPC() {
        var line = this.getCurrentLine();
        while (this.sourcefile && line >= 0) {
            var pc = this.sourcefile.line2offset.get(line);
            if (pc >= 0)
                return pc;
            line--;
        }
        return -1;
    }
    undoStep() {
        (0, commands_1.undo)(this.editor);
    }
    redoStep() {
        (0, commands_1.redo)(this.editor);
    }
    // push the store's breakpoints for this file into the gutter markers
    syncBreakpoints() {
        (0, debugline_1.syncBreakpointMarkers)(this.editor, this.path);
    }
}
exports.SourceEditor = SourceEditor;
// Whether to highlight recently-executed lines from live trace data.
// Off by default (probing has a runtime cost); toggled via toolbar button.
SourceEditor.tracingEnabled = false;
///
const disasmWindow = 1024; // disassemble this many bytes around cursor
// Assembly sources are already what the disassembly shows; interleaving them
// would repeat every instruction. Compiled and interpreted sources (C, BASIC,
// Rust, ...) are the ones whose lines are useful next to the disassembly.
function isAssemblerSource(path) {
    const meta = (0, toolmeta_1.getToolMeta)(ui_1.current_project.getToolForFilename(path));
    return meta != null && meta.kind === 'assembler';
}
// Give the source lines interleaved into the disassembly their own color.
// They are the only lines that start with "; file.c:12:", so a listing's or
// instruction's comments on the same line stay the normal color.
const disasmSourceDecoration = view_1.Decoration.line({ attributes: { class: "cm-disasm-source" } });
function highlightDisasmSourceLines() {
    function build(view) {
        const ranges = [];
        for (const { from, to } of view.visibleRanges) {
            let pos = from;
            while (pos <= to) {
                const line = view.state.doc.lineAt(pos);
                if ((0, disasmsource_1.isSourceComment)(line.text))
                    ranges.push(disasmSourceDecoration.range(line.from));
                pos = line.to + 1;
            }
        }
        return view_1.Decoration.set(ranges, true);
    }
    return view_1.ViewPlugin.fromClass(class {
        constructor(view) {
            this.decorations = build(view);
        }
        update(update) {
            if (update.docChanged || update.viewportChanged)
                this.decorations = build(update.view);
        }
    }, {
        decorations: v => v.decorations,
    });
}
// Read source lines for the disassembly view. Source paths from a listing are
// relative to the build (e.g. "main.c"), so resolve them against the project
// files first. Caches both path lookups and file contents: one disassembly
// refresh asks for the same file many times.
function makeSourceLineReader() {
    const pathCache = new Map();
    const textCache = new Map();
    const resolvePath = (path) => {
        if (pathCache.has(path))
            return pathCache.get(path);
        const candidates = [
            path,
            ui_1.current_project.filename2path && ui_1.current_project.filename2path[path],
            ui_1.current_project.stripLocalPath(path),
        ];
        let found = null;
        for (const candidate of candidates) {
            if (candidate && typeof ui_1.current_project.getFile(candidate) === 'string') {
                found = candidate;
                break;
            }
        }
        if (!found) {
            // the compiler may name the file without its folder (e.g. "main.c");
            // fall back to a project file with the same name
            const want = (0, util_1.getFilenameForPath)(path);
            ui_1.current_project.iterateFiles((fn, data) => {
                if (found || typeof data !== 'string')
                    return;
                if ((0, util_1.getFilenameForPath)(fn) === want)
                    found = fn;
            });
        }
        pathCache.set(path, found);
        return found;
    };
    return (path, line) => {
        const resolved = resolvePath(path);
        if (!resolved)
            return null;
        let lines = textCache.get(resolved);
        if (lines === undefined) {
            const text = ui_1.current_project.getFile(resolved);
            lines = typeof text === 'string' ? text.split(/\r?\n/) : null;
            textCache.set(resolved, lines);
        }
        return lines && line >= 1 && line <= lines.length ? lines[line - 1] : null;
    };
}
class DisassemblerView {
    getSelectionText() {
        return getEditorSelectionText(this.disasmview);
    }
    createDiv(parent) {
        var div = document.createElement('div');
        div.setAttribute("class", "editor");
        parent.appendChild(div);
        this.newEditor(div);
        return div;
    }
    newEditor(parent) {
        this.disasmview = new view_1.EditorView({
            parent: parent,
            extensions: [
                (0, view_1.rectangularSelection)(),
                (0, view_1.crosshairCursor)(),
                state_1.EditorState.allowMultipleSelections.of(true),
                (0, view_1.drawSelection)(),
                (0, view_1.highlightActiveLine)(),
                (0, search_1.highlightSelectionMatches)(),
                disassemblyTheme_1.disassemblyTheme,
                cobalt_1.cobalt,
                highlightDisasmSourceLines(),
                visuals_1.currentPc.field,
                state_1.EditorState.tabSize.of(8),
                state_1.EditorState.readOnly.of(true),
            ],
            // mode: 'z80', // TODO: pick correct one
        });
    }
    // TODO: too many globals
    refresh(moveCursor, centerAddr) {
        let state = ui_1.lastDebugState || ui_1.platform.saveState(); // TODO?
        let pc = centerAddr !== undefined ? centerAddr : (state.c ? state.c.PC : 0);
        let curline = 0;
        let selline = 0;
        let lastSource = '';
        let addr2symbol = (ui_1.platform.debugSymbols && ui_1.platform.debugSymbols.addr2symbol) || {};
        const dbg = ui_1.platform.debugSymbols;
        const sourcelines = ui_1.current_project
            ? (0, disasmsource_1.buildSourceLineMap)(ui_1.current_project.getListings(), makeSourceLineReader(), path => !isAssemblerSource(path))
            : null;
        // TODO: not perfect disassembler
        let disassemble = (start, len) => {
            // TODO: use pc2visits
            let s = "";
            let ofs = 0;
            while (ofs < len) {
                let a = (start + ofs) | 0;
                let disasm = ui_1.platform.disassemble(a, ui_1.platform.readAddress.bind(ui_1.platform));
                if (sourcelines) {
                    const srcline = sourcelines.get(a);
                    if (srcline) {
                        const sourcekey = srcline.path + '\0' + srcline.line;
                        if (sourcekey !== lastSource) {
                            s += (0, disasmsource_1.formatSourceComment)(srcline) + "\n";
                            curline++;
                            lastSource = sourcekey;
                        }
                    }
                }
                let bytes = "";
                let comment = "";
                for (let i = 0; i < disasm.nbytes; i++)
                    bytes += (0, util_1.hex)(ui_1.platform.readAddress(a + i));
                while (bytes.length < 14)
                    bytes += ' ';
                let dstr = disasm.line;
                if (disasm.isaddr)
                    dstr = (0, sourcevars_1.symbolizeOperand)(dstr, a, dbg);
                if (addr2symbol) {
                    let sym = addr2symbol[a];
                    if (sym) {
                        comment = "; " + sym;
                    }
                }
                let dline = (0, util_1.hex)(a, 4) + "\t" + (0, util_1.rpad)(bytes, 14) + "\t" + (0, util_1.rpad)(dstr, 30) + comment + "\n";
                s += dline;
                if (a == pc)
                    selline = curline;
                curline++;
                ofs += disasm.nbytes || 1;
            }
            return s;
        };
        var startpc = pc < 0 ? pc - disasmWindow : Math.max(0, pc - disasmWindow); // for 32-bit PCs w/ hi bit set
        let text = disassemble(startpc, pc - startpc) + disassemble(pc, disasmWindow);
        this.disasmview.dispatch({
            changes: { from: 0, to: this.disasmview.state.doc.length, insert: text }
        });
        if (moveCursor) {
            const line = this.disasmview.state.doc.line(selline + 1);
            this.disasmview.dispatch({
                selection: { anchor: line.from, head: line.from },
                effects: view_1.EditorView.scrollIntoView(line.from, { y: "center" }),
            });
        }
    }
    // jump to an address (or symbol), via the Go To Address prompt
    goToAddress(addr) {
        addr |= 0;
        if (!this.findAndSelectAddress(addr)) {
            // re-center the disassembly window on this address
            this.refresh(false, addr);
            this.findAndSelectAddress(addr);
        }
        this.disasmview.focus();
    }
    findAndSelectAddress(addr) {
        const h = (0, util_1.hex)(addr, 4); // every line starts with the address + tab
        const doc = this.disasmview.state.doc;
        for (let i = 1; i <= doc.lines; i++) {
            const line = doc.line(i);
            if (line.text.startsWith(h + "\t")) {
                // select the address so the line stays highlighted; scrollIntoView
                // centers it in the viewport
                this.disasmview.dispatch({
                    selection: { anchor: line.from, head: line.from + h.length },
                    effects: view_1.EditorView.scrollIntoView(line.from, { y: "center" }),
                });
                return true;
            }
        }
        return false;
    }
    getCursorPC() {
        const pos = this.disasmview.state.selection.main.head;
        const lineNum = this.disasmview.state.doc.lineAt(pos).number;
        if (lineNum >= 0) {
            const lineText = this.disasmview.state.doc.line(lineNum).text;
            const toks = lineText.trim().split(/\s+/);
            if (toks && toks.length >= 1) {
                const pc = parseInt(toks[0], 16);
                console.log("getCursorPC", pc);
                if (pc >= 0)
                    return pc;
            }
        }
        return -1;
    }
}
exports.DisassemblerView = DisassemblerView;
///
class ListingView extends DisassemblerView {
    constructor(lstfn) {
        super();
        this.path = lstfn;
    }
    refreshListing() {
        // lookup corresponding assemblyfile for this file, using listing
        var lst = ui_1.current_project.getListingForFile(this.path);
        // TODO?
        this.assemblyfile = lst && (lst.assemblyfile || lst.sourcefile);
    }
    refresh(moveCursor) {
        this.refreshListing();
        // load listing text into editor
        if (!this.assemblyfile)
            return;
        var asmtext = this.assemblyfile.text;
        // TODO: sometimes it picks one without a text file
        this.disasmview.dispatch({
            changes: { from: 0, to: this.disasmview.state.doc.length, insert: asmtext }
        });
        // go to PC
        if (!ui_1.platform.saveState)
            return;
        var state = ui_1.lastDebugState || ui_1.platform.saveState();
        var pc = state.c ? (state.c.EPC || state.c.PC) : 0;
        if (pc >= 0 && this.assemblyfile) {
            var res = this.assemblyfile.findLineForOffset(pc, exports.PC_LINE_LOOKAHEAD);
            if (res) {
                // set cursor while debugging
                if (moveCursor) {
                    const line = this.disasmview.state.doc.line(res.line);
                    this.disasmview.dispatch({
                        selection: { anchor: line.from, head: line.from },
                        effects: view_1.EditorView.scrollIntoView(line.from, { y: "center" }),
                    });
                }
            }
        }
    }
    // jump to an arbitrary address in this listing. Overrides the
    // DisassemblerView version, which looks for lines starting with a plain
    // "XXXX\t" hex address -- that's the synthetic disassembly text format,
    // not this raw compiler-generated listing, so it never matches here.
    goToAddress(addr) {
        this.refreshListing();
        const res = this.assemblyfile && this.assemblyfile.findLineForOffset(addr, exports.PC_LINE_LOOKAHEAD);
        if (res) {
            const line = this.disasmview.state.doc.line(res.line);
            this.disasmview.dispatch({
                selection: { anchor: line.from, head: line.from },
                effects: view_1.EditorView.scrollIntoView(line.from, { y: "center" }),
            });
        }
        this.disasmview.focus();
    }
}
exports.ListingView = ListingView;
///
// Resolve an include filename (e.g. from `#include "foo.h"`) against the files
// loaded in the current project. Tries the bare filename, then relative to the
// main file's folder (same logic as CodeProject.pushAllFiles).
function resolveIncludeFile(fn) {
    let candidates = [fn];
    try {
        var dir = (0, util_1.getFolderForPath)(ui_1.current_project.mainPath);
        if (dir.length > 0 && dir != 'local')
            candidates.push(dir + '/' + fn);
    }
    catch (e) {
        // no main path yet; bare filename only
    }
    for (var c of candidates) {
        var data = ui_1.current_project && ui_1.current_project.getFile(c);
        if (typeof data === 'string')
            return c;
    }
    return null;
}
// Pick a syntax highlighting language for a read-only file view based on its
// filename. Uses whichever registered tool claims the file's extension
// (e.g. .inc -> ca65 -> 6502 asm, .h -> cc65 -> C). Returns null if no
// tool/language matches.
function getLanguageForFilename(fn) {
    for (var meta of (0, toolmeta_1.getToolMetaForFilename)(fn)) {
        if (!meta.editorStyle)
            continue;
        var lang = (0, registry_1.getLanguageSupportForStyle)(meta.editorStyle);
        if (lang)
            return lang;
    }
    return null;
}
// Look up an include file the build gets from outside the project, via the
// worker: first the platform's library (src/worker/lib, e.g. neslib.h or
// gb/gb.h), then the toolchain's preload filesystem (e.g. /include/nes.h
// inside the cc65 package). Results are cached per source+filename.
const sharedFileCache = new Map();
async function queryWorkerText(msg) {
    var result = await ui_1.current_project.queryWorker(msg);
    var output = result && result.output;
    return output instanceof Uint8Array && output.length > 0 ? new TextDecoder().decode(output) : null;
}
function lookupLibraryFileText(fn) {
    const platform = ui_1.current_project.platform_id;
    const key = 'lib:' + platform + ':' + fn;
    if (!sharedFileCache.has(key)) {
        sharedFileCache.set(key, queryWorkerText({ platform, readlib: fn, updates: [], buildsteps: [] }));
    }
    return sharedFileCache.get(key);
}
function lookupToolchainFileText(fn) {
    const tool = ui_1.current_project.getToolForFilename(ui_1.current_project.mainPath);
    const fsName = (0, toolmeta_1.getSharedFileSystemName)(tool, ui_1.current_project.platform_id);
    const dirs = (0, toolmeta_1.getIncludeDirs)(tool, ui_1.current_project.platform_id);
    if (!fsName || !dirs.length)
        return Promise.resolve(null);
    const key = fsName + ':' + fn;
    if (!sharedFileCache.has(key)) {
        sharedFileCache.set(key, (async () => {
            // try the include under each known dir (e.g. /headers/vcs.h for "vcs.h"),
            // then the filename as-is (some includes already carry the dir,
            // e.g. "headers/vcs.h")
            var candidates = [...dirs.map(dir => dir + '/' + fn), fn];
            for (var path of candidates) {
                var text = await queryWorkerText({ preload_fs: fsName, readshared: path, updates: [], buildsteps: [] });
                if (text != null)
                    return text;
            }
            return null;
        })());
    }
    return sharedFileCache.get(key);
}
async function lookupSharedFileText(fn) {
    var _a;
    return (_a = (await lookupLibraryFileText(fn))) !== null && _a !== void 0 ? _a : lookupToolchainFileText(fn);
}
// Read-only viewer for include files from outside the project (the platform
// library in src/worker/lib, or the tool's preload filesystem), opened by
// clicking the badge next to an #include line.
// Project files are linked to their own editor windows instead.
// Each opened header gets its own window, id '#headerview/<filename>'.
class HeaderView {
    getSelectionText() {
        return getEditorSelectionText(this.view);
    }
    constructor(fn) {
        this.fn = fn;
        this.languageCompartment = new state_1.Compartment();
        this.dirtylisting = true;
        // The text arrives asynchronously, and replacing it resets the scroll, so a
        // request to reveal the PC line made before it arrives is kept until then.
        this.textLoaded = false;
        this.pendingReveal = false;
    }
    createDiv(parent) {
        var div = document.createElement('div');
        div.setAttribute("class", "editor");
        parent.appendChild(div);
        // language based on filename when known; reconfigured in setHeaderText
        var lang = getLanguageForFilename(this.fn || this.currentPath || '') || (0, registry_1.getDefaultLanguageParser)();
        this.view = new view_1.EditorView({
            parent: div,
            extensions: [
                (0, view_1.rectangularSelection)(),
                (0, view_1.crosshairCursor)(),
                state_1.EditorState.allowMultipleSelections.of(true),
                (0, view_1.drawSelection)(),
                (0, view_1.highlightActiveLine)(),
                (0, view_1.highlightActiveLineGutter)(),
                (0, search_1.highlightSelectionMatches)(),
                // line numbers follow the user setting, like SourceEditor; the
                // offset gutter below is the default view of code in headers
                ...(0, settings_1.settingsExtensions)((0, settings_1.loadSettings)()),
                (0, language_1.foldGutter)(),
                (0, search_1.search)({ top: true }),
                view_1.keymap.of(ideSearchKeymap),
                this.languageCompartment.of(lang),
                mbo_1.mbo,
                editorTheme_1.editorTheme,
                // offsets for the lines that the build actually compiled
                gutter_1.offset.field,
                gutter_1.offset.gutter,
                // breakpoints and the debugger's current line, as in SourceEditor
                // (a urust rs8 module is code the user steps into)
                debugline_1.debugGutterExtensions,
                state_1.EditorState.readOnly.of(true),
                view_1.EditorView.updateListener.of(update => {
                    for (let effect of update.transactions.flatMap(tr => tr.effects)) {
                        if (effect.is(gutter_1.breakpointMarkers.requestToggle) && this.currentPath) {
                            breakpoints_1.bpStore.toggleSourceLine(this.currentPath, effect.value);
                        }
                        if (effect.is(gutter_1.currentPcMarker.runToLine)) {
                            const pc = this.sourcefile && this.sourcefile.line2offset.get(effect.value);
                            if (pc >= 0)
                                (0, ui_1.runToPC)([pc]);
                        }
                    }
                }),
            ],
        });
        (0, settings_1.registerEditor)(this.view);
        this.refresh(false);
        return div;
    }
    setVisible(showing) {
        if (showing)
            this.refresh(false);
    }
    setHeaderText(text) {
        // (re)configure highlighting now that we know the actual path
        var lang = getLanguageForFilename(this.currentPath || this.fn || '') || (0, registry_1.getDefaultLanguageParser)();
        // refresh() reloads the file every time; leave an identical document alone
        // so its scroll position and markers survive
        if (this.textLoaded && text === this.view.state.doc.toString()) {
            this.refreshListing();
            this.syncBreakpoints();
            this.refreshDebugState(false);
            return;
        }
        this.view.dispatch({
            effects: this.languageCompartment.reconfigure(lang),
            changes: { from: 0, to: this.view.state.doc.length, insert: text }
        });
        this.textLoaded = true;
        // replacing the whole document drops the gutter markers, so they have to
        // be applied again even if the listing itself is unchanged
        this.dirtylisting = true;
        this.refreshListing();
        this.syncBreakpoints();
        this.currentDebugLine = null; // the new document has no marker yet
        this.refreshDebugState(this.pendingReveal);
        this.pendingReveal = false;
    }
    // show the listing's code offsets for this header, when the build produced
    // any (a declarations-only header has none)
    refreshListing() {
        if (!this.view || !this.currentPath)
            return;
        var lst = ui_1.current_project.getListingForFile(this.currentPath);
        var sourcefile = (lst && lst.sourcefile) || null;
        if (sourcefile !== this.sourcefile) {
            this.sourcefile = sourcefile;
            this.dirtylisting = true;
        }
        if (!this.dirtylisting)
            return;
        this.view.dispatch({ effects: gutter_1.offset.set.of(sourceLineOffsetMap(sourcefile)) });
        this.dirtylisting = false;
    }
    // push the store's breakpoints for this file into the gutter markers
    syncBreakpoints() {
        if (!this.view || !this.currentPath)
            return;
        (0, debugline_1.syncBreakpointMarkers)(this.view, this.currentPath);
    }
    // mark the line the CPU is stopped at (yellow arrow, purple bar), if it is
    // in this file; same rules as SourceEditor.refreshDebugState
    refreshDebugState(moveCursor) {
        if (!this.view)
            return;
        if (!this.textLoaded) {
            this.pendingReveal = this.pendingReveal || moveCursor;
            return;
        }
        var line = null;
        var cpustate = ui_1.lastDebugState && ui_1.lastDebugState.c;
        if (!cpustate && ui_1.platform.getCPUState && !ui_1.platform.isRunning())
            cpustate = ui_1.platform.getCPUState();
        if (this.sourcefile && cpustate) {
            line = this.sourcefile.findLineForOffset(cpustate.EPC || cpustate.PC, exports.PC_LINE_LOOKAHEAD);
        }
        if (line && (line.line < 1 || line.line > this.view.state.doc.lines))
            line = null;
        // values change with every step, even when the line does not, so draw
        // them before the unchanged-line early return below
        if (line)
            drawInlineValues(this.view, this.sourcefile, line.line);
        else if (this.currentDebugLine)
            (0, debugline_1.showInlineValues)(this.view, new Map()); // left the file
        if (!moveCursor && (line === this.currentDebugLine || (!line && !this.currentDebugLine)))
            return;
        this.currentDebugLine = line;
        if (line)
            (0, debugline_1.showDebugLine)(this.view, line, moveCursor);
        else
            (0, debugline_1.clearDebugLine)(this.view);
    }
    tick() {
        this.refreshDebugState(false);
    }
    refresh(moveCursor) {
        var fn = this.fn;
        if (!fn) {
            // direct hash navigation: get filename from #headerview/<filename>
            var hash = window.location.hash;
            if (!hash || !hash.startsWith('#headerview/'))
                return;
            fn = this.fn = decodeURIComponent(hash.substring('#headerview/'.length));
        }
        this.loadIncludeFile(fn);
        this.refreshListing();
        this.refreshDebugState(moveCursor);
    }
    async loadIncludeFile(fn) {
        this.requestedFn = fn;
        // 1) project files (local storage / presets)
        var path = resolveIncludeFile(fn);
        if (path) {
            this.currentPath = path;
            this.setHeaderText(ui_1.current_project.getFile(path));
            return;
        }
        // 2) platform library, then toolchain preload filesystem (via worker)
        var text = await lookupSharedFileText(fn);
        if (this.requestedFn !== fn)
            return; // a newer request superseded us
        if (text != null) {
            this.currentPath = fn;
            this.setHeaderText(text);
            return;
        }
        // not found
        this.currentPath = fn;
        this.setHeaderText('// ' + fn + ' was not found.\n'
            + '// Project include files are loaded during a build -- try building first.\n'
            + '// Library and toolchain headers are only available when the platform or tool bundles them.');
    }
    /** Jump to a line in the header (after content loads). */
    navigateToLine(line) {
        if (!this.view || line < 1)
            return;
        if (line <= this.view.state.doc.lines) {
            const target = this.view.state.doc.line(line);
            this.view.dispatch({
                selection: { anchor: target.from },
                effects: [view_1.EditorView.scrollIntoView(target.from, { y: "center" })],
            });
            this.view.focus();
        }
    }
}
exports.HeaderView = HeaderView;
//# sourceMappingURL=editors.js.map