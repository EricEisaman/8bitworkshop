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
const child_process_1 = require("child_process");
const mocha_1 = require("mocha");
const path = __importStar(require("path"));
(0, mocha_1.describe)('worker CommonJS require shim', function () {
    (0, mocha_1.it)('keeps require() working after loading a module', function () {
        // Run this in a child process: it needs the shim installed by the unbundled
        // (tsc) wasmutils.js, and no loader another test file may have installed.
        // Mocha's parallel mode can put this file in a worker that already ran such
        // a test; the bundle then reuses that shim too.
        var wasmutils = path.resolve('gen/worker/wasmutils.js');
        var script = `
      const nodeRequire = require;
      delete global.require; // a fresh global, like a CommonJS module sees
      const { emglobal } = nodeRequire(${JSON.stringify(wasmutils)});
      emglobal.path = { dirname: (p) => p };
      emglobal.importScripts = () => { emglobal.exports = { answer: 42 }; };
      delete emglobal.test_module;
      if (emglobal.require('test_module').answer !== 42) {
        throw new Error('did not return the loaded module\\'s exports');
      }
      // loading that module must not break the shim's own module binding
      if (emglobal.require('path') !== emglobal.path) {
        throw new Error('require(path) failed after loading a module');
      }
    `;
        assert_1.default.doesNotThrow(() => (0, child_process_1.execFileSync)(process.execPath, ['-e', script], { encoding: 'utf8' }));
    });
});
//# sourceMappingURL=testwasmutils.js.map