"use strict";
// What a source view needs to take part in debugging: the gutter fields, the
// current-line (PC) marker and the breakpoint markers. Shared by SourceEditor
// and HeaderView (urust rs8 modules), so the two can't drift apart.
Object.defineProperty(exports, "__esModule", { value: true });
exports.debugGutterExtensions = exports.inlineValuesField = void 0;
exports.showDebugLine = showDebugLine;
exports.clearDebugLine = clearDebugLine;
exports.syncBreakpointMarkers = syncBreakpointMarkers;
exports.showInlineValues = showInlineValues;
const state_1 = require("@codemirror/state");
const view_1 = require("@codemirror/view");
const breakpoints_1 = require("../breakpoints");
const gutter_1 = require("./gutter");
const visuals_1 = require("./visuals");
// Variable values drawn at the end of the source lines that name them, while
// the program is stopped. Replaced wholesale on every stop; cleared on run.
const setInlineValues = state_1.StateEffect.define();
class InlineValueWidget extends view_1.WidgetType {
    constructor(text) {
        super();
        this.text = text;
    }
    eq(o) { return o.text === this.text; }
    toDOM() {
        const el = document.createElement("span");
        el.className = "cm-inline-value";
        el.textContent = this.text;
        return el;
    }
    ignoreEvent() { return true; }
}
exports.inlineValuesField = state_1.StateField.define({
    create() { return view_1.Decoration.none; },
    update(deco, tr) {
        deco = deco.map(tr.changes);
        for (const e of tr.effects) {
            if (!e.is(setInlineValues))
                continue;
            const doc = tr.state.doc;
            const ranges = [];
            for (const [line, text] of [...e.value].sort((a, b) => a[0] - b[0])) {
                if (line < 1 || line > doc.lines)
                    continue;
                ranges.push(view_1.Decoration.widget({ widget: new InlineValueWidget(text), side: 1 }).range(doc.line(line).to));
            }
            deco = view_1.Decoration.set(ranges);
        }
        return deco;
    },
    provide: f => view_1.EditorView.decorations.from(f),
});
/** Fields and gutters for breakpoints and the current PC line. The status
 *  gutter reads the error field too, so it comes along even in views that
 *  never show errors. Gutter order is the order here: put it after the
 *  offset gutter. */
exports.debugGutterExtensions = [
    visuals_1.currentPc.field,
    gutter_1.breakpointMarkers.field,
    gutter_1.errorMarkers.field,
    gutter_1.statusMarkers.gutter,
    gutter_1.currentPcMarker.field,
    gutter_1.currentPcMarker.gutter,
    exports.inlineValuesField,
    view_1.EditorView.baseTheme({
        ".cm-inline-value": {
            marginLeft: "2em", padding: "0 0.4em", borderRadius: "3px",
            color: "#8ec6a0", background: "rgba(142, 198, 160, 0.12)",
            fontStyle: "italic", fontSize: "90%", pointerEvents: "none", userSelect: "none",
        },
    }),
];
/** Mark `line` (which must be inside the document) as where the CPU is.
 *  With `moveCursor` (stepping, a breakpoint hit) also follow it: highlight
 *  the line, put the cursor on it and scroll it to the center. A passive halt
 *  only shows the gutter arrow, so the user's cursor isn't taken away. */
function showDebugLine(view, line, moveCursor) {
    const pos = view.state.doc.line(line.line).from + (line.start || 0);
    view.dispatch({
        selection: moveCursor ? { anchor: pos, head: pos } : undefined,
        effects: [
            gutter_1.currentPcMarker.set.of(line.line),
            visuals_1.currentPc.effect.of(moveCursor ? line.line : null),
            ...(moveCursor ? [view_1.EditorView.scrollIntoView(pos, { y: "center" })] : []),
        ],
    });
}
function clearDebugLine(view) {
    view.dispatch({ effects: [gutter_1.currentPcMarker.set.of(null), visuals_1.currentPc.effect.of(null)] });
}
/** Push the breakpoint store's breakpoints for `path` into the gutter markers. */
function syncBreakpointMarkers(view, path) {
    const markers = breakpoints_1.bpStore.getSourceBreakpointsForFile(path)
        .map(bp => ({ line: bp.line, enabled: bp.enabled }));
    view.dispatch({ effects: gutter_1.breakpointMarkers.setAll.of(markers) });
}
/** Show `values` (line number to `name = value` text) at the end of their
 *  lines; an empty map removes them. */
function showInlineValues(view, values) {
    view.dispatch({ effects: setInlineValues.of(values) });
}
//# sourceMappingURL=debugline.js.map