"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.disassemblyTheme = void 0;
const view_1 = require("@codemirror/view");
exports.disassemblyTheme = view_1.EditorView.theme({
    "&": {
        maxHeight: "100%"
    },
    // source lines interleaved into the disassembly (see disasmsource.ts)
    ".cm-disasm-source": {
        color: "#9fd3b4",
    },
});
//# sourceMappingURL=disassemblyTheme.js.map