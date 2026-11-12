"use strict";
// The Project Selector's filter menu (ide/ui.ts).
// It narrows the preset drop-down to one example category, or to the local
// files and imported repositories the platform has.
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRESET_FILTER_REPOSITORIES = exports.PRESET_FILTER_LOCAL_FILES = exports.PRESET_FILTER_ALL = void 0;
exports.getPresetCategories = getPresetCategories;
exports.getPresetFilters = getPresetFilters;
exports.resolvePresetFilter = resolvePresetFilter;
exports.getPresetFilterLabel = getPresetFilterLabel;
exports.PRESET_FILTER_ALL = "__all__";
exports.PRESET_FILTER_LOCAL_FILES = "__local_files__";
exports.PRESET_FILTER_REPOSITORIES = "__repositories__";
/** Categories in the order the platform's preset array lists them. */
function getPresetCategories(presets) {
    const categories = [];
    for (const preset of presets) {
        if (preset.category && !categories.includes(preset.category))
            categories.push(preset.category);
    }
    return categories;
}
/** Menu order: All, the platform's categories, then local files/repositories. */
function getPresetFilters(presets, hasLocalFiles, hasRepositories) {
    const filters = [{ key: exports.PRESET_FILTER_ALL, label: "All" }];
    for (const category of getPresetCategories(presets))
        filters.push({ key: category, label: category });
    if (hasLocalFiles)
        filters.push({ key: exports.PRESET_FILTER_LOCAL_FILES, label: "Local Files" });
    if (hasRepositories)
        filters.push({ key: exports.PRESET_FILTER_REPOSITORIES, label: "Repositories" });
    return filters;
}
/** The selected filter if it is still in the menu, otherwise All. */
function resolvePresetFilter(filters, selected) {
    return filters.some(filter => filter.key == selected) ? selected : exports.PRESET_FILTER_ALL;
}
function getPresetFilterLabel(filters, key) {
    const filter = filters.find(filter => filter.key == key);
    return filter ? filter.label : "All";
}
//# sourceMappingURL=presetfilter.js.map