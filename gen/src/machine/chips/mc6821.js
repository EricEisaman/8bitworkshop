"use strict";
// Motorola MC6821 Peripheral Interface Adapter (PIA).
//
// Two 8-bit ports (A and B), each with a data-direction register, a control
// register and two control lines (C1 = input only, C2 = input or output).
// Register select (RS1:RS0):
//   0: port A data (CRA bit 2 = 1) or DDRA (CRA bit 2 = 0)
//   1: control register A
//   2: port B data (CRB bit 2 = 1) or DDRB (CRB bit 2 = 0)
//   3: control register B
//
// Control register bits:
//   7   IRQ1 flag (C1 active edge seen)      read-only, cleared by reading data
//   6   IRQ2 flag (C2 active edge, input)    read-only, cleared by reading data
//   5   C2 direction (1 = output)
//   4:3 C2 mode. Input: bit 4 = edge (1 = rising), bit 3 = IRQ enable.
//       Output: bits 5:4 = 11 is "manual": bit 3 is the level driven on C2.
//   2   data register select (1 = data, 0 = DDR)
//   1   C1 edge (1 = rising)
//   0   C1 IRQ enable
//
// The chip knows nothing about what is wired to it: the owner supplies the
// levels on the peripheral pins through the readInA/readInB callbacks, and
// is told about output writes through onWriteA/onWriteB.
Object.defineProperty(exports, "__esModule", { value: true });
exports.MC6821 = void 0;
class MC6821 {
    constructor() {
        this.ora = 0;
        this.ddra = 0;
        this.cra = 0;
        this.orb = 0;
        this.ddrb = 0;
        this.crb = 0;
        // input levels on the control lines (needed to detect edges)
        this.ca1 = false;
        this.ca2 = false;
        this.cb1 = false;
        this.cb2 = false;
        // levels on the peripheral data pins (driven by the outside world)
        this.readInA = () => 0xff;
        this.readInB = () => 0xff;
        // called when the CPU writes the output register of a port
        this.onWriteA = null;
        this.onWriteB = null;
    }
    reset() {
        this.ora = this.ddra = this.cra = 0;
        this.orb = this.ddrb = this.crb = 0;
    }
    /** What the CPU would read from the A pins: outputs read back, inputs are the peripheral. */
    get portA() { return (this.readInA() & ~this.ddra) | (this.ora & this.ddra); }
    get portB() { return (this.readInB() & ~this.ddrb) | (this.orb & this.ddrb); }
    /** Levels the PIA drives onto the pins: output bits only, the rest float high. */
    get outA() { return (this.ora & this.ddra) | (~this.ddra & 0xff); }
    get outB() { return (this.orb & this.ddrb) | (~this.ddrb & 0xff); }
    /** Level the PIA drives on C2 when it is configured as a manual output. */
    get c2a() { return (this.cra & 0x30) == 0x30 ? !!(this.cra & 0x08) : true; }
    get c2b() { return (this.crb & 0x30) == 0x30 ? !!(this.crb & 0x08) : true; }
    read(rs) {
        switch (rs & 3) {
            case 0:
                if (!(this.cra & 4))
                    return this.ddra;
                this.cra &= 0x3f; // reading the data register clears both flags
                return this.portA;
            case 1: return this.cra;
            case 2:
                if (!(this.crb & 4))
                    return this.ddrb;
                this.crb &= 0x3f;
                return this.portB;
            default: return this.crb;
        }
    }
    /** Read without side effects (debugger). */
    peek(rs) {
        switch (rs & 3) {
            case 0: return (this.cra & 4) ? this.portA : this.ddra;
            case 1: return this.cra;
            case 2: return (this.crb & 4) ? this.portB : this.ddrb;
            default: return this.crb;
        }
    }
    write(rs, v) {
        v &= 0xff;
        switch (rs & 3) {
            case 0:
                if (this.cra & 4) {
                    this.ora = v;
                    this.onWriteA && this.onWriteA(v);
                }
                else
                    this.ddra = v;
                break;
            case 1:
                this.cra = (this.cra & 0xc0) | (v & 0x3f);
                break;
            case 2:
                if (this.crb & 4) {
                    this.orb = v;
                    this.onWriteB && this.onWriteB(v);
                }
                else
                    this.ddrb = v;
                break;
            case 3:
                this.crb = (this.crb & 0xc0) | (v & 0x3f);
                break;
        }
    }
    // Drive the control input lines; an active edge sets the IRQ flag.
    setCA1(level) {
        if (level != this.ca1) {
            if (level == !!(this.cra & 2))
                this.cra |= 0x80;
            this.ca1 = level;
        }
    }
    setCB1(level) {
        if (level != this.cb1) {
            if (level == !!(this.crb & 2))
                this.crb |= 0x80;
            this.cb1 = level;
        }
    }
    setCA2(level) {
        if (level != this.ca2) {
            if (!(this.cra & 0x20) && level == !!(this.cra & 0x10))
                this.cra |= 0x40;
            this.ca2 = level;
        }
    }
    setCB2(level) {
        if (level != this.cb2) {
            if (!(this.crb & 0x20) && level == !!(this.crb & 0x10))
                this.crb |= 0x40;
            this.cb2 = level;
        }
    }
    /** IRQA output (active = true): C1 flag and enable, or C2 (input mode) flag and enable. */
    get irqA() {
        return ((this.cra & 0x81) == 0x81) || ((this.cra & 0x68) == 0x48);
    }
    get irqB() {
        return ((this.crb & 0x81) == 0x81) || ((this.crb & 0x68) == 0x48);
    }
    saveState() {
        return {
            ora: this.ora, ddra: this.ddra, cra: this.cra, ca1: this.ca1, ca2: this.ca2,
            orb: this.orb, ddrb: this.ddrb, crb: this.crb, cb1: this.cb1, cb2: this.cb2,
        };
    }
    loadState(s) {
        Object.assign(this, s);
    }
}
exports.MC6821 = MC6821;
//# sourceMappingURL=mc6821.js.map