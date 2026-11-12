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
// .gitmodules lives at the repo root, which is the cwd for `npm test`.
const GITMODULES = '.gitmodules';
function parseGitmodules(text) {
    var out = [];
    var cur = null;
    for (var line of text.split('\n')) {
        var m;
        if ((m = line.match(/^\s*\[\s*submodule\s+"([^"]+)"\s*\]/))) {
            cur = { name: m[1] };
            out.push(cur);
        }
        else if (cur && (m = line.match(/^\s*(\w+)\s*=\s*(.*?)\s*$/))) {
            cur[m[1]] = m[2];
        }
    }
    return out;
}
// git resolves a relative URL ("./chips") against the superproject's remote,
// so "./chips" in a repo hosted at github.com/org/repo becomes
// github.com/org/repo/chips -- a 404 that breaks every CI clone.
function isRelativeURL(url) {
    return url.startsWith('./') || url.startsWith('../') || !/^[a-z][a-z0-9+.-]*:\/\/|^[^@\/]+@[^:\/]+:./i.test(url);
}
(0, mocha_1.describe)('submodules', () => {
    (0, mocha_1.it)('.gitmodules exists and lists submodules', function () {
        if (!fs.existsSync(GITMODULES))
            this.skip();
        var subs = parseGitmodules(fs.readFileSync(GITMODULES, 'utf8'));
        assert_1.default.ok(subs.length > 0, 'no submodules parsed from .gitmodules');
    });
    (0, mocha_1.it)('uses absolute URLs that do not depend on the superproject remote', function () {
        if (!fs.existsSync(GITMODULES))
            this.skip();
        var subs = parseGitmodules(fs.readFileSync(GITMODULES, 'utf8'));
        for (var sub of subs) {
            assert_1.default.ok(sub.path, `${sub.name}: missing path`);
            assert_1.default.ok(sub.url, `${sub.name}: missing url`);
            assert_1.default.ok(!isRelativeURL(sub.url), `${sub.name}: relative url "${sub.url}" resolves against the superproject remote and breaks CI; use e.g. https://github.com/8bitworkshop/${sub.name}`);
        }
    });
});
//# sourceMappingURL=testsubmodules.js.map