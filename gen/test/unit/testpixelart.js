"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const pixeleditor_1 = require("../../src/ide/pixeleditor");
// A Viewer with a stand-in canvas context: updateImage() only needs image data.
function artViewer(width, height, gapX, gapBits) {
    var v = new pixeleditor_1.Viewer();
    v.width = width;
    v.height = height;
    v.gapX = gapX;
    v.gapBits = gapBits;
    v.rgbdata = new Uint32Array(width * height);
    v.displayRgbData = new Uint32Array(v.displayWidth * height);
    v.ctx = { putImageData() { } };
    v.peerviewers = [v];
    return v;
}
(0, mocha_1.describe)('Pixel editor artifact color', function () {
    (0, mocha_1.it)('should locate the artifact bit (bit 7) for both bit orders', function () {
        assert_1.default.equal((0, pixeleditor_1.getArtBit)({ w: 8, h: 8 }), null);
        assert_1.default.equal((0, pixeleditor_1.getArtBit)({ w: 8, h: 8, art: 1 }), 7); // LSB first: bit 7 is last
        assert_1.default.equal((0, pixeleditor_1.getArtBit)({ w: 8, h: 8, art: 1, brev: true }), 0); // MSB first: bit 7 is first
        assert_1.default.equal((0, pixeleditor_1.getArtBit)({ w: 16, h: 1, art: 1, bpw: 16 }), 7);
        assert_1.default.equal((0, pixeleditor_1.getArtBit)({ w: 16, h: 1, art: 1, bpw: 16, brev: true }), 8);
    });
    (0, mocha_1.it)('should count one artifact column per word in a row', function () {
        assert_1.default.equal((0, pixeleditor_1.countArtColumns)(8, 7, 8), 1);
        assert_1.default.equal((0, pixeleditor_1.countArtColumns)(16, 7, 8), 2);
        assert_1.default.equal((0, pixeleditor_1.countArtColumns)(17, 7, 8), 2); // partial third word has no bit 7
        assert_1.default.equal((0, pixeleditor_1.countArtColumns)(8, 0, 8), 1);
        assert_1.default.equal((0, pixeleditor_1.countArtColumns)(7, 7, 8), 0); // w:7 leaves no room for the artifact bit
        assert_1.default.equal((0, pixeleditor_1.countArtColumns)(9, 15, 16), 0);
        assert_1.default.equal((0, pixeleditor_1.countArtColumns)(20, 15, 16), 1);
    });
    (0, mocha_1.it)('should identify artifact columns', function () {
        var art = (x) => (0, pixeleditor_1.isArtColumn)(x, 16, 7, 8);
        assert_1.default.deepEqual([0, 1, 6, 7, 8, 14, 15].map(art), [false, false, false, true, false, false, true]);
        assert_1.default.ok(!(0, pixeleditor_1.isArtColumn)(7, 7, 7, 8)); // outside the image
        assert_1.default.ok((0, pixeleditor_1.isArtColumn)(8, 16, 8, 16));
    });
    (0, mocha_1.it)('should draw the artifact column half-transparent, in place', function () {
        // alpha is the top byte of the RGBA word
        var faded = (c) => ((c & 0x00ffffff) | 0x80000000) >>> 0;
        var onebyte = artViewer(8, 1, 7, 8);
        onebyte.updateImage(new Uint32Array([0xff000010, 0xff000011, 0xff000012, 0xff000013,
            0xff000014, 0xff000015, 0xff000016, 0xff000017]));
        assert_1.default.equal(onebyte.displayWidth, 8); // no separator column
        assert_1.default.deepEqual(Array.from(onebyte.displayRgbData), [0xff000010, 0xff000011, 0xff000012,
            0xff000013, 0xff000014, 0xff000015, 0xff000016, faded(0xff000017)]);
        assert_1.default.equal(onebyte.rgbdata[7], 0xff000017); // the real color is untouched
        // two bytes per row: every word's bit 7 is faded
        var twobytes = artViewer(16, 1, 7, 8);
        var data = new Uint32Array(16).fill(0xff0000aa);
        twobytes.updateImage(data);
        var faded16 = Array.from(twobytes.displayRgbData).map((c, x) => c == faded(0xff0000aa) ? x : -1)
            .filter(x => x >= 0);
        assert_1.default.deepEqual(faded16, [7, 15]);
        // w:7 leaves no room for the artifact bit, so nothing is faded
        var nofit = artViewer(7, 1, 7, 8);
        nofit.updateImage(new Uint32Array(7).fill(0xff0000aa));
        assert_1.default.equal(nofit.displayWidth, 7);
        assert_1.default.ok(Array.from(nofit.displayRgbData).every(c => c == 0xff0000aa));
    });
    (0, mocha_1.it)('should write a toggled artifact bit back to the words', function () {
        // LSB first: the artifact bit is the last column of each 8-pixel group
        var mapper = new pixeleditor_1.Mapper({ w: 8, h: 1, bpp: 1, art: 1 });
        mapper.left = { words: [0x41] };
        mapper.updateRight();
        assert_1.default.deepEqual(Array.from(mapper.images[0]), [1, 0, 0, 0, 0, 0, 1, 0]);
        mapper.images[0][7] = 1;
        mapper.right = { images: mapper.images };
        mapper.updateLeft();
        assert_1.default.deepEqual(Array.from(mapper.words), [0xc1]);
        // MSB first: the artifact bit is the first column of the group
        var brev = new pixeleditor_1.Mapper({ w: 8, h: 1, bpp: 1, art: 1, brev: true });
        brev.left = { words: [0x41] };
        brev.updateRight();
        assert_1.default.deepEqual(Array.from(brev.images[0]), [0, 1, 0, 0, 0, 0, 0, 1]);
        brev.images[0][0] = 1;
        brev.right = { images: brev.images };
        brev.updateLeft();
        assert_1.default.deepEqual(Array.from(brev.words), [0xc1]);
    });
    (0, mocha_1.it)('should reject art:1 when w has no room for the artifact column', function () {
        assert_1.default.ok(/artifact column/.test((0, pixeleditor_1.validateAssetData)('0x00,0x01,0x02,0x03,0x04,0x05,0x06', { w: 7, h: 1, art: 1 })));
        assert_1.default.equal((0, pixeleditor_1.validateAssetData)('0x00,0x01,0x02,0x03,0x04,0x05,0x06,0x08', { w: 8, h: 8, art: 1 }), null);
        assert_1.default.ok(/artifact column/.test((0, pixeleditor_1.validateAssetByteLength)(7, { w: 7, h: 1, art: 1 })));
        assert_1.default.equal((0, pixeleditor_1.validateAssetByteLength)(8, { w: 8, h: 8, art: 1 }), null);
    });
});
//# sourceMappingURL=testpixelart.js.map