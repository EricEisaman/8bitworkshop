"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const presetfilter_1 = require("../../src/ide/presetfilter");
const PRESETS = [
    { id: 'hello.c', name: 'Hello World' },
    { id: 'hello-sdcc.c', name: 'Hello World (SDCC)', category: 'SDCC' },
    { id: 'sprites.c', name: 'Sprites' },
    { id: 'hello.rs', name: 'Hello (urust)', category: 'urust' },
    { id: 'hello2-sdcc.c', name: 'Hello Again (SDCC)', category: 'SDCC' },
];
(0, mocha_1.describe)('preset filter menu', function () {
    (0, mocha_1.it)('lists categories once, in preset order', function () {
        assert_1.default.deepEqual((0, presetfilter_1.getPresetCategories)(PRESETS), ['SDCC', 'urust']);
        assert_1.default.deepEqual((0, presetfilter_1.getPresetCategories)([PRESETS[0], PRESETS[2]]), []);
    });
    (0, mocha_1.it)('starts with All, then categories and special groups', function () {
        assert_1.default.deepEqual((0, presetfilter_1.getPresetFilters)(PRESETS, false, false).map(f => f.label), ['All', 'SDCC', 'urust']);
        assert_1.default.deepEqual((0, presetfilter_1.getPresetFilters)(PRESETS, true, true).map(f => f.key), [presetfilter_1.PRESET_FILTER_ALL, 'SDCC', 'urust', presetfilter_1.PRESET_FILTER_LOCAL_FILES, presetfilter_1.PRESET_FILTER_REPOSITORIES]);
    });
    (0, mocha_1.it)('falls back to All when the selected filter is gone', function () {
        const filters = (0, presetfilter_1.getPresetFilters)(PRESETS, false, false);
        assert_1.default.equal((0, presetfilter_1.resolvePresetFilter)(filters, 'SDCC'), 'SDCC');
        assert_1.default.equal((0, presetfilter_1.resolvePresetFilter)(filters, presetfilter_1.PRESET_FILTER_LOCAL_FILES), presetfilter_1.PRESET_FILTER_ALL);
        assert_1.default.equal((0, presetfilter_1.resolvePresetFilter)(filters, null), presetfilter_1.PRESET_FILTER_ALL);
    });
    (0, mocha_1.it)('labels the selected filter', function () {
        const filters = (0, presetfilter_1.getPresetFilters)(PRESETS, true, false);
        assert_1.default.equal((0, presetfilter_1.getPresetFilterLabel)(filters, presetfilter_1.PRESET_FILTER_LOCAL_FILES), 'Local Files');
        assert_1.default.equal((0, presetfilter_1.getPresetFilterLabel)(filters, 'SDCC'), 'SDCC');
        assert_1.default.equal((0, presetfilter_1.getPresetFilterLabel)(filters, 'nope'), 'All');
    });
});
//# sourceMappingURL=testpresetfilter.js.map