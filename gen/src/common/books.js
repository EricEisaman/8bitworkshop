"use strict";
// books - the 8bitworkshop books, and which one covers a platform.
// The IDE's Books menu and the VS Code extension's platform picker use it.
Object.defineProperty(exports, "__esModule", { value: true });
exports.BOOK_DEMOS = exports.BOOKS = void 0;
exports.bookFor = bookFor;
exports.pickRandomBookDemo = pickRandomBookDemo;
exports.firstVisitDemo = firstVisitDemo;
const util_1 = require("./util");
exports.BOOKS = [
    { id: 'vcs', title: 'Making Games For The Atari 2600', url: 'https://www.amazon.com/dp/1541021304', image: 'book_a2600.png',
        platforms: ['vcs'] },
    { id: 'arcade', title: 'Making 8-bit Arcade Games in C', url: 'https://www.amazon.com/dp/1545484759', image: 'book_arcade.png',
        platforms: ['mw8080bw', 'vicdual', 'galaxian', 'galaxian-scramble', 'vector-z80color', 'williams-z80'] },
    { id: 'verilog', title: 'Designing Video Game Hardware in Verilog', url: 'https://www.amazon.com/dp/1728619440', image: 'book_verilog.png',
        platforms: ['verilog'] },
    { id: 'nes', title: 'Making Games for the NES', url: 'https://www.amazon.com/dp/1075952727', image: 'book_nes.png',
        platforms: ['nes'] },
    { id: 'c64', title: 'Making Games for the C-64', url: 'https://www.amazon.com/dp/B0DMKH8NGL', image: 'book_c64.png',
        platforms: ['c64'] },
];
/** The book that covers a platform, if one does. */
function bookFor(platform) {
    var base = (0, util_1.getBasePlatform)(platform);
    var root = (0, util_1.getRootBasePlatform)(platform);
    return exports.BOOKS.find(b => b.platforms.includes(base))
        || exports.BOOKS.find(b => b.platforms.includes(root));
}
// The demos a first-time visitor can land on instead of Hello World.
// Each is a book's finished game, so the IDE opens on something that runs.
exports.BOOK_DEMOS = [
    { book: 'vcs', platform: 'vcs', file: 'examples/brickgame.a' },
    { book: 'arcade', platform: 'galaxian-scramble', file: 'shoot2.c' },
    { book: 'verilog', platform: 'verilog', file: 'racing_game_cpu.v' },
    { book: 'nes', platform: 'nes', file: 'climber.c' },
    { book: 'c64', platform: 'c64', file: 'side_scroller.c' },
];
/** A random book demo; rand is injectable so tests are deterministic. */
function pickRandomBookDemo(rand = Math.random) {
    return exports.BOOK_DEMOS[Math.floor(rand() * exports.BOOK_DEMOS.length) % exports.BOOK_DEMOS.length];
}
/**
 * The demo to open on a first launch, or null to keep the default platform.
 * A query that names its own platform, file, repo or upload keeps the old
 * behavior (the platform's first preset on vcs).
 */
function firstVisitDemo(query, firstVisit, rand) {
    if (!firstVisit)
        return null;
    if (query.platform || query.file || query.repo || query.importURL || query.file0_name)
        return null;
    return pickRandomBookDemo(rand);
}
//# sourceMappingURL=books.js.map