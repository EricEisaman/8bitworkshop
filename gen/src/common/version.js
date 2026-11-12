"use strict";
/**
 * The IDE's own version.
 *
 * scripts/build.mjs reads `version` from package.json and defines
 * __APP_VERSION__ for esbuild; unit tests and unbundled code see it unset.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAppVersion = getAppVersion;
exports.getAppVersionLabel = getAppVersionLabel;
/** The version this build was made from, or '' if it wasn't injected. */
function getAppVersion() {
    return typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '';
}
/** A display label for a version, e.g. 'v4.0.0'; '' when there is no version. */
function getAppVersionLabel(version = getAppVersion()) {
    var v = (version || '').trim();
    if (!v)
        return '';
    return /^v/i.test(v) ? v : 'v' + v;
}
//# sourceMappingURL=version.js.map