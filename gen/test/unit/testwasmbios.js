"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const wasmplatform_1 = require("../../src/common/wasmplatform");
// minimal machine: only the pieces loadBIOS touches
class StubMachine extends wasmplatform_1.BaseWASMMachine {
    getCPUState() { return null; }
    saveState() { return null; }
    loadState(s) { }
}
function makeStub() {
    var calls = [];
    var m = new StubMachine('stub');
    m.exports = {
        memory: new WebAssembly.Memory({ initial: 1 }),
        machine_init: (ptr) => { calls.push('init' + ptr); return 7; },
        machine_reset: (sys) => { calls.push('reset' + sys); },
        machine_get_pixel_buffer: () => 0,
    };
    m.biosptr = 16;
    m.biosarr = new Uint8Array(m.exports.memory.buffer, 16, 4);
    return { m, calls };
}
(0, mocha_1.describe)('BaseWASMMachine.loadBIOS', function () {
    (0, mocha_1.it)('only copies the BIOS before the machine exists', function () {
        var { m, calls } = makeStub();
        m.loadBIOS(new Uint8Array([1, 2, 3, 4]));
        assert_1.default.deepEqual(Array.from(m.biosarr), [1, 2, 3, 4]);
        assert_1.default.deepEqual(calls, []);
    });
    (0, mocha_1.it)('recreates the machine when loaded after init', function () {
        var { m, calls } = makeStub();
        m.sys = 3;
        m.loadBIOS(new Uint8Array([5, 6, 7, 8]));
        assert_1.default.deepEqual(Array.from(m.biosarr), [5, 6, 7, 8]);
        assert_1.default.equal(m.sys, 7);
        assert_1.default.deepEqual(calls, ['init16', 'reset7']);
    });
});
//# sourceMappingURL=testwasmbios.js.map