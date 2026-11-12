"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ColecoVision = void 0;
const vdp_z80_1 = require("./vdp_z80");
const emu_1 = require("../common/emu");
const util_1 = require("../common/util");
const audio_1 = require("../common/audio");
// http://www.colecovision.eu/ColecoVision/development/tutorial1.shtml
// http://www.colecovision.eu/ColecoVision/development/libcv.shtml
// http://www.kernelcrash.com/blog/recreating-the-colecovision/2016/01/27/
// http://www.atarihq.com/danb/files/CV-Tech.txt
// http://www.atarihq.com/danb/files/CV-Sound.txt
// http://www.colecoboxart.com/faq/FAQ05.htm
// http://www.theadamresource.com/manuals/technical/Jeffcoleco.html
// http://bifi.msxnet.org/msxnet//tech/tms9918a.txt
// http://www.colecovision.dk/tools.htm?refreshed
// http://www.theadamresource.com/manuals/technical/ColecoVision%20Coding%20Guide.pdf
// http://www.unige.ch/medecine/nouspikel/ti99/tms9918a.htm
// http://map.grauw.nl/articles/vdp_tut.php
// http://www.msxcomputermagazine.nl/mccw/91/msx1demos1/en.html
// http://www.segordon.com/colecovision.php
// http://samdal.com/svvideo.htm
// https://github.com/tursilion/convert9918
// http://www.harmlesslion.com/cgi-bin/showprog.cgi?ColecoVision
var COLECOVISION_KEYCODE_MAP = (0, emu_1.makeKeycodeMap)([
    [emu_1.Keys.UP, 0, 0x1],
    [emu_1.Keys.DOWN, 0, 0x4],
    [emu_1.Keys.LEFT, 0, 0x8],
    [emu_1.Keys.RIGHT, 0, 0x2],
    [emu_1.Keys.A, 0, 0x40],
    [emu_1.Keys.B, 1, 0x40],
    [emu_1.Keys.GP_A, 0, 0x40],
    [emu_1.Keys.GP_B, 1, 0x40],
    [emu_1.Keys.P2_UP, 2, 0x1],
    [emu_1.Keys.P2_DOWN, 2, 0x4],
    [emu_1.Keys.P2_LEFT, 2, 0x8],
    [emu_1.Keys.P2_RIGHT, 2, 0x2],
    [emu_1.Keys.P2_A, 2, 0x40],
    [emu_1.Keys.P2_B, 3, 0x40],
]);
class ColecoVision extends vdp_z80_1.BaseZ80VDPBasedMachine {
    constructor() {
        super();
        this.defaultROMSize = 0x8000;
        this.ram = new Uint8Array(0x400);
        this.read = (0, emu_1.newAddressDecoder)([
            [0x0000, 0x1fff, 0x1fff, (a) => { return this.bios ? this.bios[a] : 0; }],
            [0x6000, 0x7fff, 0x03ff, (a) => { return this.ram[a]; }],
            [0x8000, 0xffff, 0x7fff, (a) => { return this.rom ? this.rom[a] : 0; }],
        ]);
        this.write = (0, emu_1.newAddressDecoder)([
            [0x6000, 0x7fff, 0x03ff, (a, v) => { this.ram[a] = v; }],
        ]);
        this.init(this, this.newIOBus(), new audio_1.SN76489_Audio(new audio_1.MasterAudio()));
        this.bios = new util_1.lzgmini().decode((0, util_1.stringToByteArray)(atob(COLECO_BIOS_LZG)));
    }
    getKeyboardMap() { return COLECOVISION_KEYCODE_MAP; }
    vdpInterrupt() {
        this.probe.logInterrupt(0);
        this.cpu.NMI();
    }
    newIOBus() {
        return {
            read: (addr) => {
                addr &= 0xff;
                //console.log('IO read', hex(addr,4));
                switch (addr) {
                    case 0xfc: return this.inputs[this.keypadMode ? 1 : 0] ^ 0xff;
                    case 0xff: return this.inputs[this.keypadMode ? 3 : 2] ^ 0xff;
                }
                if (addr >= 0xa0 && addr <= 0xbf) {
                    if (addr & 1)
                        return this.vdp.readStatus();
                    else
                        return this.vdp.readData();
                }
                return 0;
            },
            write: (addr, val) => {
                addr &= 0xff;
                val &= 0xff;
                //console.log('IO write', hex(addr,4), hex(val,2));
                switch (addr >> 4) {
                    case 0x8:
                    case 0x9:
                        this.keypadMode = true;
                        break;
                    case 0xc:
                    case 0xd:
                        this.keypadMode = false;
                        break;
                    case 0xa:
                    case 0xb:
                        if (addr & 1)
                            return this.vdp.writeAddress(val);
                        else
                            return this.vdp.writeData(val);
                    case 0xf:
                        this.psg.setData(val);
                        break;
                }
            }
        };
    }
    loadState(state) {
        super.loadState(state);
        this.keypadMode = state['kpm'];
    }
    saveState() {
        var state = super.saveState();
        state['kpm'] = this.keypadMode;
        return state;
    }
    reset() {
        super.reset();
        this.keypadMode = false;
    }
}
exports.ColecoVision = ColecoVision;
var COLECO_BIOS_LZG = `
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
Bh8GHgYdAAA=`;
//# sourceMappingURL=coleco.js.map