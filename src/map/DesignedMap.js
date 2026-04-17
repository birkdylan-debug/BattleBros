import { TILE, MAP } from '../constants.js';

const COLS = MAP.COLS; // 500
const ROWS = MAP.ROWS; // 380

// Seeded LCG RNG for deterministic transitions (same map every game)
function makeLCG(seed) {
    let s = seed >>> 0;
    return () => {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

// ─── Biome classification ────────────────────────────────────────────────────
function getBiome(col, row) {
    // City core
    if (col >= 165 && col <= 335 && row >= 115 && row <= 265) return 'city';
    // Military north (full width, but jungle/snow push in from sides below row 70)
    if (row < 130 && col >= 60 && col <= 440) return 'military';
    // Jungle west
    if (col < 190 && row >= 70) return 'jungle';
    // Snow east
    if (col > 310 && row >= 70) return 'snow';
    // Rural south
    if (row >= 255) return 'rural';
    // Far edges of north = also military ground
    if (row < 70) return 'military';
    return 'transition';
}

function getBaseTile(biome) {
    switch (biome) {
        case 'city':     return TILE.PAVEMENT;
        case 'military': return TILE.MIL_GROUND;
        case 'jungle':   return TILE.JUNGLE_GROUND;
        case 'snow':     return TILE.SNOW;
        case 'rural':    return TILE.RURAL_GRASS;
        default:         return TILE.MIL_GROUND;
    }
}

// ─── Main map generator ──────────────────────────────────────────────────────
export function generateDesignedMap() {
    const tileData = Array.from({ length: ROWS }, () => Array(COLS).fill(TILE.EMPTY));
    const rng = makeLCG(0xDEADBEEF);

    // 1. Fill base ground
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const biome = getBiome(c, r);
            tileData[r][c] = getBaseTile(biome);
        }
    }

    // 2. City road grid
    for (let r = 115; r <= 265; r++) {
        for (let c = 165; c <= 335; c++) {
            const cityRow = r - 115;
            if (c % 20 === 0 || cityRow % 16 === 0) {
                tileData[r][c] = TILE.ROAD;
            } else {
                tileData[r][c] = TILE.PAVEMENT;
            }
        }
    }

    // 3. Transition blending (10-tile bands at biome borders)
    const transRng = makeLCG(0xCAFEBABE);
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const biome = getBiome(c, r);
            if (biome !== 'transition') continue;

            // Determine nearest biome and pick a blend tile
            const dJungle  = c < 190 ? 190 - c : 9999;
            const dSnow    = c > 310 ? c - 310 : 9999;
            const dMil     = r < 130 ? 130 - r : 9999;
            const dRural   = r > 255 ? r - 255 : 9999;

            let tile = TILE.MIL_GROUND;
            const minD = Math.min(dJungle, dSnow, dMil, dRural);
            if (minD === dJungle) tile = transRng() < 0.5 ? TILE.JUNGLE_EDGE : TILE.MIL_EDGE;
            else if (minD === dSnow) tile = transRng() < 0.5 ? TILE.SNOW_EDGE : TILE.MIL_EDGE;
            else if (minD === dMil) tile = TILE.MIL_EDGE;
            else tile = transRng() < 0.5 ? TILE.RURAL_GRASS : TILE.MIL_EDGE;

            tileData[r][c] = tile;
        }
    }

    // 4. River through jungle (cols 60-72, rows 80-380)
    for (let r = 80; r < ROWS; r++) {
        for (let c = 57; c <= 75; c++) {
            if (c >= 60 && c <= 72) {
                tileData[r][c] = TILE.WATER;
            } else if (c === 59 || c === 73) {
                tileData[r][c] = TILE.WATER_EDGE;
            } else if (c === 57 || c === 58) {
                tileData[r][c] = TILE.WATER_EDGE;
            } else {
                tileData[r][c] = TILE.WATER_EDGE;
            }
        }
    }
    // Bridge over river at rows 168-177
    for (let r = 168; r <= 177; r++) {
        for (let c = 60; c <= 72; c++) {
            tileData[r][c] = TILE.JUNGLE_FLOOR;
        }
    }

    // 5. Frozen lake in snow (oval patch cols 420-460, rows 185-225)
    for (let r = 185; r <= 225; r++) {
        for (let c = 420; c <= 460; c++) {
            const dx = (c - 440) / 20;
            const dy = (r - 205) / 20;
            if (dx * dx + dy * dy < 1.0) {
                tileData[r][c] = TILE.ICE;
            }
        }
    }

    // ─── BUILDINGS ──────────────────────────────────────────────────────────

    // Military Buildings
    placeBuilding(tileData, 210, 8,  30, 20, TILE.MIL_WALL, TILE.MIL_FLOOR, 'south'); // Command Center
    placeBuilding(tileData, 135, 10, 32, 10, TILE.MIL_WALL, TILE.MIL_FLOOR, 'south'); // Barracks A
    placeBuilding(tileData, 295, 10, 32, 10, TILE.MIL_WALL, TILE.MIL_FLOOR, 'south'); // Barracks B
    placeBuilding(tileData, 340, 28, 14, 14, TILE.MIL_WALL, TILE.MIL_FLOOR, 'west');  // Armory
    placeBuilding(tileData, 120, 42, 24, 16, TILE.MIL_WALL, TILE.MIL_FLOOR, 'east');  // Motor Pool
    placeBuilding(tileData, 160, 42, 14, 12, TILE.MIL_WALL, TILE.MIL_FLOOR, 'south'); // Motor Pool Annex
    placeBuilding(tileData, 378, 48, 16, 12, TILE.MIL_WALL, TILE.MIL_FLOOR, 'north'); // Fuel Depot
    placeBuilding(tileData, 68,  12, 5,  5,  TILE.MIL_WALL, TILE.MIL_FLOOR, 'south'); // Guard Post NW
    placeBuilding(tileData, 425, 12, 5,  5,  TILE.MIL_WALL, TILE.MIL_FLOOR, 'south'); // Guard Post NE
    placeBuilding(tileData, 350, 68, 6,  6,  TILE.MIL_WALL, TILE.MIL_FLOOR, 'south'); // Watchtower
    placeBuilding(tileData, 378, 72, 26, 20, TILE.MIL_WALL, TILE.MIL_FLOOR, 'south'); // Hangar

    // Military Trenches at rows 88 and 100 (horizontal walls with gaps every 8 tiles)
    for (let c = 90; c <= 410; c++) {
        if (c % 8 !== 4 && c % 8 !== 5) { // gaps every 8
            tileData[88][c] = TILE.MIL_WALL;
            tileData[89][c] = TILE.MIL_WALL;
            tileData[100][c] = TILE.MIL_WALL;
            tileData[101][c] = TILE.MIL_WALL;
        }
    }

    // Jungle Buildings
    placeBuilding(tileData, 45,  110, 22, 20, TILE.JUNGLE_WALL, TILE.JUNGLE_FLOOR, 'east');  // Ancient Temple
    placeBuilding(tileData, 65,  116, 10, 8,  TILE.JUNGLE_WALL, TILE.JUNGLE_FLOOR, 'west');  // Temple Annex
    placeBuilding(tileData, 110, 82,  12, 10, TILE.JUNGLE_WALL, TILE.JUNGLE_FLOOR, 'south'); // Ruin Outpost
    placeBuilding(tileData, 38,  250, 10, 8,  TILE.JUNGLE_WALL, TILE.JUNGLE_FLOOR, 'east');  // Hidden Camp
    placeBuilding(tileData, 130, 310, 8,  8,  TILE.JUNGLE_WALL, TILE.JUNGLE_FLOOR, 'north'); // Jungle Shrine
    placeBuilding(tileData, 75,  172, 8,  6,  TILE.JUNGLE_WALL, TILE.JUNGLE_FLOOR, 'east');  // Dock Shack
    // Crumble jungle walls for ruin effect
    crumbleWalls(tileData, 45,  110, 22, 20, TILE.JUNGLE_WALL, TILE.JUNGLE_GROUND, rng, 0.12);
    crumbleWalls(tileData, 110, 82,  12, 10, TILE.JUNGLE_WALL, TILE.JUNGLE_GROUND, rng, 0.18);

    // Snow Buildings
    placeBuilding(tileData, 358, 82,  28, 20, TILE.SNOW_WALL, TILE.SNOW_FLOOR, 'west');  // Ski Lodge
    placeBuilding(tileData, 382, 96,  10, 8,  TILE.SNOW_WALL, TILE.SNOW_FLOOR, 'north'); // Lodge Annex
    placeBuilding(tileData, 400, 140, 10, 8,  TILE.SNOW_WALL, TILE.SNOW_FLOOR, 'south'); // Cabin A
    placeBuilding(tileData, 415, 138, 8,  7,  TILE.SNOW_WALL, TILE.SNOW_FLOOR, 'south'); // Cabin B
    placeBuilding(tileData, 430, 142, 9,  8,  TILE.SNOW_WALL, TILE.SNOW_FLOOR, 'west');  // Cabin C
    placeBuilding(tileData, 450, 295, 14, 10, TILE.SNOW_WALL, TILE.SNOW_FLOOR, 'north'); // Supply Cache
    placeBuilding(tileData, 438, 228, 6,  5,  TILE.SNOW_WALL, TILE.SNOW_FLOOR, 'south'); // Ice Shack
    placeBuilding(tileData, 465, 160, 6,  6,  TILE.SNOW_WALL, TILE.SNOW_FLOOR, 'south'); // Watch Outpost
    placeBuilding(tileData, 340, 150, 16, 12, TILE.SNOW_WALL, TILE.SNOW_FLOOR, 'east');  // Eastern Outpost
    placeBuilding(tileData, 320, 260, 18, 14, TILE.SNOW_WALL, TILE.SNOW_FLOOR, 'west');  // Southern Lodge

    // City Buildings — Landmarks
    placeBuilding(tileData, 182, 131, 14, 10, TILE.CITY_WALL, TILE.CITY_FLOOR, 'south'); // Gas Station
    placeBuilding(tileData, 222, 132, 34, 8,  TILE.CITY_WALL, TILE.CITY_FLOOR, 'south'); // Motel Strip
    placeBuilding(tileData, 168, 162, 22, 16, TILE.CITY_WALL, TILE.CITY_FLOOR, 'east');  // Warehouse A
    placeBuilding(tileData, 168, 182, 22, 14, TILE.CITY_WALL, TILE.CITY_FLOOR, 'east');  // Warehouse B
    // Central Plaza — open courtyard with low walls on 2 sides
    placeWallRow(tileData, 228, 182, 18, TILE.CITY_WALL);
    placeWallRow(tileData, 228, 195, 18, TILE.CITY_WALL);
    placeWallCol(tileData, 228, 182, 14, TILE.CITY_WALL);
    placeWallCol(tileData, 245, 182, 14, TILE.CITY_WALL);
    placeBuilding(tileData, 262, 133, 16, 10, TILE.CITY_WALL, TILE.CITY_FLOOR, 'south'); // Diner
    placeBuilding(tileData, 282, 148, 18, 14, TILE.CITY_WALL, TILE.CITY_FLOOR, 'south'); // Police Station
    placeBuilding(tileData, 204, 194, 28, 8,  TILE.CITY_WALL, TILE.CITY_FLOOR, 'south'); // Shop Row
    placeBuilding(tileData, 302, 168, 20, 20, TILE.CITY_WALL, TILE.CITY_FLOOR, 'west');  // Apartment Block
    placeBuilding(tileData, 242, 215, 16, 12, TILE.CITY_WALL, TILE.CITY_FLOOR, 'north'); // Parking Garage
    placeBuilding(tileData, 168, 210, 20, 14, TILE.CITY_WALL, TILE.CITY_FLOOR, 'south'); // South Mall A
    placeBuilding(tileData, 192, 230, 22, 14, TILE.CITY_WALL, TILE.CITY_FLOOR, 'north'); // South Mall B
    placeBuilding(tileData, 270, 200, 18, 14, TILE.CITY_WALL, TILE.CITY_FLOOR, 'west');  // Hotel
    placeBuilding(tileData, 300, 220, 16, 12, TILE.CITY_WALL, TILE.CITY_FLOOR, 'north'); // Bank
    placeBuilding(tileData, 260, 246, 22, 12, TILE.CITY_WALL, TILE.CITY_FLOOR, 'north'); // Hospital

    // Generic city fill blocks
    const cityFill = [
        [168, 130, 10, 8, 'south'], [318, 132, 14, 10, 'south'],
        [166, 148, 14, 10, 'east'], [310, 148, 12, 10, 'west'],
        [200, 162, 14, 12, 'south'], [258, 162, 20, 14, 'south'],
        [220, 215, 18, 12, 'south'], [168, 246, 16, 14, 'north'],
        [320, 246, 14, 12, 'west'],
    ];
    for (const [bx, by, bw, bh, door] of cityFill) {
        if (by + bh < 265 && bx + bw < 335) {
            placeBuilding(tileData, bx, by, bw, bh, TILE.CITY_WALL, TILE.CITY_FLOOR, door);
        }
    }

    // Rural Buildings
    placeBuilding(tileData, 168, 298, 14, 10, TILE.WOOD_WALL, TILE.WOOD_FLOOR, 'north'); // Farmhouse A
    placeBuilding(tileData, 184, 310, 22, 14, TILE.WOOD_WALL, TILE.WOOD_FLOOR, 'north'); // Barn A
    placeBuilding(tileData, 342, 300, 14, 10, TILE.WOOD_WALL, TILE.WOOD_FLOOR, 'north'); // Farmhouse B
    placeBuilding(tileData, 358, 312, 20, 13, TILE.WOOD_WALL, TILE.WOOD_FLOOR, 'north'); // Barn B
    placeBuilding(tileData, 240, 310, 12, 10, TILE.WOOD_WALL, TILE.WOOD_FLOOR, 'east');  // Farmhouse C
    placeBuilding(tileData, 255, 320, 18, 12, TILE.WOOD_WALL, TILE.WOOD_FLOOR, 'north'); // Barn C
    // Silos (small square buildings, no door)
    placeSolid(tileData, 292, 304, 5, 5, TILE.WOOD_WALL);
    placeSolid(tileData, 300, 304, 5, 5, TILE.WOOD_WALL);
    placeSolid(tileData, 308, 304, 5, 5, TILE.WOOD_WALL);
    // Water tower
    placeSolid(tileData, 258, 294, 6, 6, TILE.WOOD_WALL);

    // Rural fence lines
    for (let c = 155; c <= 230; c++) {
        if ((c - 155) % 12 !== 0) tileData[295][c] = TILE.WOOD_WALL;
    }
    for (let c = 230; c <= 345; c++) {
        if ((c - 230) % 12 !== 0) tileData[295][c] = TILE.WOOD_WALL;
    }
    for (let r = 295; r <= 360; r++) {
        if ((r - 295) % 10 !== 0) tileData[r][155] = TILE.WOOD_WALL;
        if ((r - 295) % 10 !== 0) tileData[r][345] = TILE.WOOD_WALL;
    }

    return { tileData };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function placeBuilding(tileData, x, y, w, h, wallTile, floorTile, doorSide) {
    if (x < 0 || y < 0 || x + w > COLS || y + h > ROWS) return;
    // Fill walls
    for (let r = y; r < y + h; r++)
        for (let c = x; c < x + w; c++)
            tileData[r][c] = wallTile;
    // Fill interior
    for (let r = y + 1; r < y + h - 1; r++)
        for (let c = x + 1; c < x + w - 1; c++)
            tileData[r][c] = floorTile;
    // Door (3 tiles wide)
    const midX = x + Math.floor(w / 2);
    const midY = y + Math.floor(h / 2);
    if (doorSide === 'south' && y + h - 1 < ROWS) {
        for (let dc = -1; dc <= 1; dc++) {
            const cc = midX + dc;
            if (cc > x && cc < x + w - 1) tileData[y + h - 1][cc] = TILE.DOOR;
        }
    } else if (doorSide === 'north' && y >= 0) {
        for (let dc = -1; dc <= 1; dc++) {
            const cc = midX + dc;
            if (cc > x && cc < x + w - 1) tileData[y][cc] = TILE.DOOR;
        }
    } else if (doorSide === 'east' && x + w - 1 < COLS) {
        for (let dr = -1; dr <= 1; dr++) {
            const rr = midY + dr;
            if (rr > y && rr < y + h - 1) tileData[rr][x + w - 1] = TILE.DOOR;
        }
    } else if (doorSide === 'west' && x >= 0) {
        for (let dr = -1; dr <= 1; dr++) {
            const rr = midY + dr;
            if (rr > y && rr < y + h - 1) tileData[rr][x] = TILE.DOOR;
        }
    }
}

function placeSolid(tileData, x, y, w, h, wallTile) {
    if (x < 0 || y < 0 || x + w > COLS || y + h > ROWS) return;
    for (let r = y; r < y + h; r++)
        for (let c = x; c < x + w; c++)
            tileData[r][c] = wallTile;
}

function placeWallRow(tileData, x, y, w, tile) {
    for (let c = x; c < x + w && c < COLS; c++) tileData[y][c] = tile;
}

function placeWallCol(tileData, x, y, h, tile) {
    for (let r = y; r < y + h && r < ROWS; r++) tileData[r][x] = tile;
}

function crumbleWalls(tileData, x, y, w, h, wallTile, groundTile, rng, chance) {
    for (let r = y; r < y + h && r < ROWS; r++)
        for (let c = x; c < x + w && c < COLS; c++)
            if (tileData[r][c] === wallTile && rng() < chance)
                tileData[r][c] = groundTile;
}

// ─── Decorative & Loot Position Exports ─────────────────────────────────────

const TS = MAP.TILE_SIZE;

export function getTreePositions() {
    // Forest-style trees (legacy, kept for initial spawn area)
    const forestTrees = [
        [12, 88], [18, 92], [28, 84], [8, 96], [35, 90], [22, 100],
    ].map(([c, r]) => ({ x: c * TS + TS, y: r * TS + TS, type: 'tree' }));

    // Palm trees throughout jungle
    const palmTrees = [
        [15, 80],  [25, 88],  [35, 100], [10, 110], [20, 120],
        [30, 135], [40, 145], [8, 155],  [18, 165], [28, 178],
        [15, 200], [38, 210], [12, 230], [25, 245], [40, 260],
        [10, 280], [32, 295], [20, 315], [38, 330], [14, 348],
        [42, 360], [8, 370],  [50, 200], [55, 230], [48, 260],
        [52, 290], [45, 320], [56, 350], [85, 220], [90, 260],
        [100, 300],[105, 340],[120, 280],[115, 200],[130, 240],
    ].map(([c, r]) => ({ x: c * TS + TS, y: r * TS + TS, type: 'palm_tree' }));

    // Snow pines in snow biome
    const snowPines = [
        [320, 80], [335, 95], [348, 110], [330, 125], [360, 130],
        [375, 145], [390, 160], [320, 165], [345, 175], [365, 190],
        [330, 205], [350, 220], [325, 240], [345, 260], [368, 275],
        [380, 290], [360, 310], [320, 320], [340, 340], [380, 355],
        [400, 320], [420, 300], [440, 280], [460, 260], [480, 240],
        [470, 310], [490, 280], [450, 340], [415, 360], [440, 375],
    ].map(([c, r]) => ({ x: c * TS + TS, y: r * TS + TS, type: 'snow_pine' }));

    return [...forestTrees, ...palmTrees, ...snowPines];
}

export function getBushPositions() {
    // Jungle dense bushes
    const jungleBushes = [
        [12, 85],  [22, 95],  [32, 105], [42, 120], [8, 130],
        [18, 142], [28, 155], [38, 168], [10, 180], [20, 195],
        [35, 208], [15, 222], [30, 238], [45, 252], [8, 268],
        [22, 285], [40, 298], [12, 312], [35, 328], [18, 342],
        [50, 175], [55, 195], [48, 215], [52, 235], [45, 255],
        [80, 200], [88, 240], [95, 180], [102, 260], [110, 220],
    ].map(([c, r]) => ({ x: c * TS + 8, y: r * TS + 8, type: 'jungle_bush' }));

    // City park/edge bushes
    const cityBushes = [
        [170, 160], [185, 205], [195, 250], [250, 268], [280, 130],
        [310, 190], [325, 240], [165, 230], [228, 180], [298, 160],
    ].map(([c, r]) => ({ x: c * TS + 8, y: r * TS + 8, type: 'bush' }));

    // Rural tall grass
    const ruralBushes = [
        [160, 295], [175, 308], [210, 295], [225, 325], [285, 298],
        [318, 295], [338, 322], [370, 295], [390, 310], [165, 345],
        [280, 355], [305, 340], [350, 365], [200, 365], [240, 350],
        [265, 330], [320, 360], [380, 340], [170, 370], [410, 350],
    ].map(([c, r]) => ({ x: c * TS + 8, y: r * TS + 8, type: 'jungle_bush' }));

    // Snow bushes in snow biome
    const snowBushes = [
        [318, 155], [340, 170], [362, 200], [325, 225], [355, 250],
        [375, 270], [320, 290], [345, 305], [388, 285],
    ].map(([c, r]) => ({ x: c * TS + 8, y: r * TS + 8, type: 'snow_bush' }));

    // Military perimeter sparse bushes
    const milBushes = [
        [65, 88], [78, 80], [88, 70], [100, 95], [115, 72],
        [400, 85], [415, 72], [430, 92], [440, 78], [408, 102],
    ].map(([c, r]) => ({ x: c * TS + 8, y: r * TS + 8, type: 'bush' }));

    return [...jungleBushes, ...cityBushes, ...ruralBushes, ...snowBushes, ...milBushes];
}

export function getRockPositions() {
    // Desert-style rocks (repurposed around military perimeter)
    return [
        [82, 50], [95, 38], [108, 60], [125, 42], [145, 55],
        [160, 35], [178, 58], [330, 38], [350, 52], [370, 30],
        [395, 45], [412, 62], [428, 35], [448, 55], [462, 40],
    ].map(([c, r]) => ({ x: c * TS, y: r * TS }));
}

export function getLootSpawnPoints() {
    return [
        // Military – inside buildings
        { x: 220, y: 12 }, { x: 225, y: 16 }, // Command Center
        { x: 148, y: 14 }, { x: 310, y: 14 }, // Barracks A/B
        { x: 345, y: 32 }, { x: 350, y: 38 }, // Armory
        { x: 132, y: 48 }, { x: 385, y: 52 }, // Motor Pool / Fuel Depot
        { x: 382, y: 80 }, { x: 390, y: 85 }, // Hangar

        // Jungle – inside ruins
        { x: 52,  y: 118 }, { x: 58,  y: 122 }, // Ancient Temple
        { x: 68,  y: 118 }, { x: 72,  y: 120 }, // Temple Annex
        { x: 115, y: 86  }, { x: 118, y: 89  }, // Ruin Outpost
        { x: 42,  y: 254 }, { x: 130, y: 315 }, // Hidden Camp / Shrine
        { x: 78,  y: 175 },                       // Dock Shack

        // Snow – inside lodges/cabins
        { x: 368, y: 90 }, { x: 375, y: 95 },   // Ski Lodge
        { x: 403, y: 145 }, { x: 418, y: 143 }, // Cabin cluster
        { x: 454, y: 300 }, { x: 442, y: 231 }, // Supply Cache / Ice Shack

        // City – inside buildings
        { x: 188, y: 135 }, { x: 235, y: 135 }, { x: 270, y: 137 }, // Gas Stn/Motel/Diner
        { x: 175, y: 170 }, { x: 175, y: 188 }, // Warehouses
        { x: 288, y: 155 }, { x: 310, y: 175 }, // Police / Apartment
        { x: 215, y: 198 }, { x: 275, y: 208 }, // Shop Row / Hotel
        { x: 248, y: 220 }, { x: 305, y: 228 }, // Garage / Bank
        { x: 270, y: 252 },                       // Hospital

        // Rural – inside barns/houses
        { x: 174, y: 303 }, { x: 192, y: 316 }, // Farmhouse A / Barn A
        { x: 348, y: 305 }, { x: 365, y: 318 }, // Farmhouse B / Barn B
        { x: 246, y: 315 }, { x: 262, y: 326 }, // Farmhouse C / Barn C
    ];
}

export function getCratePositions() {
    return [
        // Military
        { x: 215, y: 14 }, { x: 310, y: 15 }, { x: 344, y: 33 },
        { x: 126, y: 50 }, { x: 380, y: 78 }, { x: 70,  y: 14  },

        // Jungle
        { x: 55,  y: 116 }, { x: 69,  y: 119 }, { x: 115, y: 88  },
        { x: 44,  y: 252 }, { x: 132, y: 312 }, { x: 80,  y: 174 },

        // Snow
        { x: 370, y: 88  }, { x: 404, y: 144 }, { x: 432, y: 144 },
        { x: 452, y: 298 }, { x: 440, y: 232 }, { x: 467, y: 163 },

        // City
        { x: 190, y: 134 }, { x: 240, y: 136 }, { x: 285, y: 152 },
        { x: 178, y: 168 }, { x: 315, y: 172 }, { x: 250, y: 218 },
        { x: 218, y: 198 }, { x: 305, y: 226 }, { x: 272, y: 250 },

        // Rural
        { x: 176, y: 302 }, { x: 195, y: 314 }, { x: 350, y: 304 },
        { x: 368, y: 316 }, { x: 248, y: 314 }, { x: 264, y: 325 },
    ];
}

export function getCoverObjectPositions() {
    const T = MAP.TILE_SIZE;
    return {
        sandbags: [
            // Military trench lines
            { x: 90*T+8,  y: 87*T  }, { x: 100*T+8, y: 87*T  }, { x: 120*T+8, y: 87*T  },
            { x: 140*T+8, y: 87*T  }, { x: 160*T+8, y: 87*T  }, { x: 200*T+8, y: 87*T  },
            { x: 240*T+8, y: 99*T  }, { x: 280*T+8, y: 99*T  }, { x: 320*T+8, y: 99*T  },
            { x: 360*T+8, y: 99*T  },
            // City edges
            { x: 168*T,   y: 115*T }, { x: 335*T,   y: 118*T },
            { x: 168*T,   y: 265*T }, { x: 330*T,   y: 265*T },
            // Military base entrances
            { x: 208*T,   y: 28*T  }, { x: 242*T,   y: 28*T  },
            { x: 133*T,   y: 20*T  }, { x: 325*T,   y: 20*T  },
            { x: 118*T,   y: 58*T  }, { x: 395*T,   y: 60*T  },
        ],
        containers: [
            // Warehouse area
            { x: 192*T, y: 165*T }, { x: 192*T, y: 170*T }, { x: 192*T, y: 185*T },
            { x: 192*T, y: 190*T },
            // Docks / jungle river area
            { x: 84*T,  y: 178*T }, { x: 84*T,  y: 185*T },
            // Military motor pool
            { x: 144*T, y: 45*T  }, { x: 144*T, y: 50*T  },
            // City industrial south
            { x: 192*T, y: 262*T }, { x: 198*T, y: 262*T },
            // Rural farm machinery
            { x: 218*T, y: 312*T }, { x: 230*T, y: 312*T },
            // Hangar interior
            { x: 382*T, y: 78*T  }, { x: 388*T, y: 78*T  },
            { x: 394*T, y: 78*T  },
        ],
        cars: [
            // City roads
            { x: 180*T, y: 128*T }, { x: 200*T, y: 128*T }, { x: 220*T, y: 128*T },
            { x: 240*T, y: 178*T }, { x: 260*T, y: 178*T }, { x: 280*T, y: 178*T },
            { x: 200*T, y: 210*T }, { x: 220*T, y: 210*T }, { x: 240*T, y: 210*T },
            { x: 260*T, y: 226*T }, { x: 300*T, y: 194*T }, { x: 320*T, y: 194*T },
            // Rural roads
            { x: 180*T, y: 293*T }, { x: 250*T, y: 293*T }, { x: 320*T, y: 293*T },
            { x: 200*T, y: 355*T }, { x: 280*T, y: 355*T },
            // Military vehicles
            { x: 155*T, y: 52*T  }, { x: 162*T, y: 52*T  },
        ],
        barrels: [
            // Near buildings in all biomes
            { x: 230*T, y: 26*T  }, { x: 235*T, y: 26*T  }, // Command Center
            { x: 348*T, y: 40*T  }, { x: 353*T, y: 40*T  }, // Armory
            { x: 392*T, y: 56*T  }, { x: 397*T, y: 56*T  }, // Fuel Depot
            { x: 48*T,  y: 125*T }, { x: 53*T,  y: 125*T }, // Temple
            { x: 362*T, y: 92*T  }, { x: 367*T, y: 92*T  }, // Ski Lodge
            { x: 188*T, y: 140*T }, { x: 193*T, y: 140*T }, // Gas Station
            { x: 268*T, y: 140*T }, { x: 273*T, y: 140*T }, // Diner
            { x: 286*T, y: 155*T }, { x: 291*T, y: 155*T }, // Police
            { x: 188*T, y: 302*T }, { x: 193*T, y: 302*T }, // Farmhouse A
            { x: 348*T, y: 308*T }, { x: 353*T, y: 308*T }, // Farmhouse B
            { x: 294*T, y: 306*T }, { x: 299*T, y: 306*T }, // Silos
            { x: 175*T, y: 170*T }, { x: 175*T, y: 188*T }, // Warehouses
            { x: 246*T, y: 222*T },                           // Garage
        ],
        dumpsters: [
            // City alleys
            { x: 198*T, y: 144*T }, { x: 218*T, y: 144*T }, { x: 258*T, y: 144*T },
            { x: 180*T, y: 178*T }, { x: 300*T, y: 178*T },
            { x: 198*T, y: 194*T }, { x: 228*T, y: 194*T },
            { x: 270*T, y: 226*T }, { x: 248*T, y: 246*T },
            { x: 300*T, y: 246*T }, { x: 320*T, y: 226*T },
            { x: 168*T, y: 248*T },
        ],
        fences: [
            // Rural field borders
            { x: 158*T, y: 296*T, angle: 0 }, { x: 190*T, y: 296*T, angle: 0 },
            { x: 222*T, y: 296*T, angle: 0 }, { x: 254*T, y: 296*T, angle: 0 },
            { x: 286*T, y: 296*T, angle: 0 }, { x: 318*T, y: 296*T, angle: 0 },
            { x: 158*T, y: 330*T, angle: 0 }, { x: 190*T, y: 330*T, angle: 0 },
            { x: 222*T, y: 330*T, angle: 0 }, { x: 254*T, y: 330*T, angle: 0 },
            { x: 286*T, y: 330*T, angle: 0 }, { x: 318*T, y: 330*T, angle: 0 },
            { x: 158*T, y: 364*T, angle: 0 }, { x: 254*T, y: 364*T, angle: 0 },
            { x: 350*T, y: 296*T, angle: 0 }, { x: 382*T, y: 296*T, angle: 0 },
            { x: 350*T, y: 330*T, angle: 0 }, { x: 382*T, y: 330*T, angle: 0 },
            // Military perimeter fence suggestions
            { x: 90*T,  y: 105*T, angle: 0 }, { x: 122*T, y: 105*T, angle: 0 },
            { x: 154*T, y: 105*T, angle: 0 }, { x: 186*T, y: 105*T, angle: 0 },
            { x: 250*T, y: 105*T, angle: 0 }, { x: 282*T, y: 105*T, angle: 0 },
            { x: 314*T, y: 105*T, angle: 0 }, { x: 346*T, y: 105*T, angle: 0 },
            { x: 378*T, y: 105*T, angle: 0 }, { x: 410*T, y: 105*T, angle: 0 },
        ],
    };
}
