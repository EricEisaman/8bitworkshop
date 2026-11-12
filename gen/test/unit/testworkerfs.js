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
const mocha_1 = require("mocha");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const testlib_1 = require("../../src/tools/testlib");
const toolroot_1 = require("../../src/tools/toolroot");
const wasmutils_1 = require("../../src/worker/wasmutils");
/** Every .ts file under a directory, recursively. */
function tsFiles(dir) {
    var files = [];
    for (var entry of fs.readdirSync(dir, { withFileTypes: true })) {
        var full = path.join(dir, entry.name);
        if (entry.isDirectory())
            files = files.concat(tsFiles(full));
        else if (entry.name.endsWith(".ts"))
            files.push(full);
    }
    return files;
}
/** Drop comments, so that only real code is scanned. */
function stripComments(text) {
    return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ');
}
(0, mocha_1.describe)('toolchain filesystem packages', function () {
    this.timeout(60000);
    (0, mocha_1.it)('loads a package and keeps its data intact', async function () {
        await (0, testlib_1.preload)('sdcc');
        var meta = wasmutils_1.fsMeta['sdcc'];
        assert_1.default.ok(meta, 'the sdcc filesystem package was not loaded');
        assert_1.default.ok(meta.files.length > 0, 'the sdcc package has no files');
        // the package data must be the file on disk, byte for byte
        var datafile = path.resolve((0, toolroot_1.toolRoot)(), 'src/worker/fs/fssdcc.data');
        assert_1.default.equal((0, wasmutils_1.getFilesystemSize)('sdcc'), fs.statSync(datafile).size);
    });
    (0, mocha_1.it)('wraps binary data in a blob without losing bytes', async function () {
        await (0, testlib_1.initialize)();
        var bytes = new Uint8Array([0, 1, 127, 128, 255]);
        var blob = (0, wasmutils_1.makeBlob)(bytes);
        assert_1.default.equal(blob.size, bytes.length);
        var read = blob.asArrayBuffer ? blob.asArrayBuffer() : new Uint8Array(await blob.arrayBuffer());
        assert_1.default.deepEqual(Array.from(read), Array.from(bytes));
    });
    (0, mocha_1.it)('never fetches a blob with a synchronous XHR', function () {
        // Firefox hangs on a synchronous XHR with responseType='blob' when the
        // response is 1MB or more, and every toolchain package is that big.
        // (Chrome is happy with it, so only Firefox shows the problem.)
        var dir = path.resolve((0, toolroot_1.toolRoot)(), 'src/worker');
        for (var file of tsFiles(dir)) {
            var text = stripComments(fs.readFileSync(file, 'utf-8'));
            assert_1.default.ok(!/responseType\s*=\s*['"]blob['"]/.test(text), path.relative((0, toolroot_1.toolRoot)(), file) + " uses responseType='blob'");
        }
    });
});
//# sourceMappingURL=testworkerfs.js.map