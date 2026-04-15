import { TILE, MAP, BIOME } from '../constants.js';

const COLS = MAP.COLS;  // 160
const ROWS = MAP.ROWS;  // 120

// Biome boundaries
const FOREST_X_MAX = 79;
const BIOME_Y_SPLIT = 60; // rows 0-59 = top half (forest/desert), 60-119 = city

export function generateBiomeMap() {
    // tileData: 2D array of tile IDs
    const tileData = Array.from({ length: ROWS }, () => Array(COLS).fill(TILE.EMPTY));
    // biomeData: parallel array mapping each cell to a biome key
    const biomeData = Array.from({ length: ROWS }, (_, r) =>
        Array.from({ length: COLS }, (_, c) => getBiome(c, r))
    );

    // Fill base ground tiles per biome
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const biome = biomeData[r][c];
            if (biome === BIOME.FOREST) tileData[r][c] = TILE.GRASS;
            else if (biome === BIOME.DESERT) tileData[r][c] = TILE.SAND;
            else if (biome === BIOME.CITY) {
                // Roads grid: vertical every 20 cols, horizontal every 16 rows (within city)
                const cityRow = r - BIOME_Y_SPLIT;
                if (c % 20 === 0 || cityRow % 16 === 0) {
                    tileData[r][c] = TILE.ROAD;
                } else {
                    tileData[r][c] = TILE.PAVEMENT;
                }
            }
        }
    }

    // --- Forest buildings (cabins, top-left) ---
    const forestCabins = [
        { x: 5,  y: 4,  w: 7, h: 6,  door: 'south' },
        { x: 18, y: 3,  w: 6, h: 5,  door: 'east'  },
        { x: 32, y: 6,  w: 8, h: 7,  door: 'south' },
        { x: 8,  y: 18, w: 6, h: 6,  door: 'north' },
        { x: 22, y: 20, w: 7, h: 5,  door: 'east'  },
        { x: 40, y: 15, w: 6, h: 7,  door: 'south' },
        { x: 55, y: 5,  w: 8, h: 6,  door: 'west'  },
        { x: 60, y: 22, w: 7, h: 7,  door: 'north' },
    ];
    for (const b of forestCabins) {
        placeBuilding(tileData, b.x, b.y, b.w, b.h, TILE.FOREST_WALL, TILE.FOREST_FLOOR, b.door);
    }

    // Tree clusters (2x2 wall blocks in forest)
    const trees = [
        [12, 8], [14, 8], [28, 12], [46, 4], [48, 4],
        [52, 18], [35, 24], [65, 10], [68, 28], [72, 18],
        [16, 32], [38, 36], [62, 35], [74, 42], [8, 44],
    ];
    for (const [tx, ty] of trees) {
        if (ty < BIOME_Y_SPLIT - 1 && tx <= FOREST_X_MAX - 1) {
            safeFill(tileData, biomeData, tx, ty, 2, 2, TILE.FOREST_WALL, BIOME.FOREST);
        }
    }

    // --- Desert ruins (top-right) ---
    const desertRuins = [
        { x: 85,  y: 4,  w: 10, h: 12, door: 'south' },
        { x: 103, y: 3,  w: 12, h: 9,  door: 'west'  },
        { x: 120, y: 8,  w: 9,  h: 11, door: 'south' },
        { x: 88,  y: 22, w: 11, h: 10, door: 'east'  },
        { x: 108, y: 20, w: 10, h: 12, door: 'north' },
        { x: 140, y: 5,  w: 12, h: 10, door: 'west'  },
    ];
    for (const b of desertRuins) {
        placeBuilding(tileData, b.x, b.y, b.w, b.h, TILE.DESERT_WALL, TILE.DESERT_FLOOR, b.door);
        // Remove ~20% of wall tiles for "ruin" effect
        crumbleWalls(tileData, b.x, b.y, b.w, b.h, TILE.DESERT_WALL, TILE.SAND, 0.22);
    }

    // Desert rock formations
    const rocks = [
        [95, 15], [97, 15], [96, 14],
        [115, 18], [116, 19],
        [130, 12], [131, 12],
        [145, 20], [146, 20], [145, 21],
        [100, 35], [101, 35],
        [125, 40], [126, 40], [127, 40],
        [150, 35], [151, 36],
    ];
    for (const [rx, ry] of rocks) {
        if (ry < BIOME_Y_SPLIT && rx > FOREST_X_MAX) {
            if (tileData[ry][rx] === TILE.SAND) tileData[ry][rx] = TILE.DESERT_WALL;
        }
    }

    // --- City buildings (bottom half, rows 60-119) ---
    // City is divided into blocks by roads every 20 cols and every 16 rows (within city rows)
    // Block structure: road at col 0,20,40,60,80,100,120,140 and row 60,76,92,108
    // Place buildings inside each block with a 2-tile margin from roads
    const cityBlocks = [
        // [blockCol, blockRow, buildW, buildH] — blockCol/Row is top-left of block (after road)
        [1,  61, 14, 10, 'south'], [21, 62, 12, 9,  'east' ], [41, 61, 13, 11, 'south'],
        [61, 63, 11, 8,  'west' ], [81, 61, 14, 10, 'south'], [101,62, 12, 9,  'east' ],
        [121,61, 13, 11, 'north'], [141,62, 14, 8,  'west' ],

        [1,  77, 13, 9,  'north'], [21, 78, 11, 10, 'south'], [41, 77, 14, 9,  'east' ],
        [61, 78, 12, 8,  'north'], [81, 77, 11, 10, 'south'], [101,78, 13, 9,  'west' ],
        [121,77, 14, 10, 'north'], [141,78, 12, 8,  'east' ],

        [1,  93, 14, 10, 'south'], [21, 94, 12, 9,  'north'], [41, 93, 11, 11, 'east' ],
        [61, 94, 13, 8,  'south'], [81, 93, 14, 10, 'west' ], [101,94, 11, 9,  'south'],
        [121,93, 12, 11, 'north'], [141,94, 14, 10, 'east' ],

        // Larger landmark buildings
        [25, 64, 13, 10, 'south'], [85, 79, 12, 9, 'north'],
    ];
    for (const [bx, by, bw, bh, door] of cityBlocks) {
        if (by + bh < ROWS && bx + bw < COLS) {
            placeBuilding(tileData, bx, by, bw, bh, TILE.CITY_WALL, TILE.CITY_FLOOR, door);
        }
    }

    return { tileData, biomeData };
}

function getBiome(col, row) {
    if (row >= BIOME_Y_SPLIT) return BIOME.CITY;
    if (col <= FOREST_X_MAX) return BIOME.FOREST;
    return BIOME.DESERT;
}

// Hollow building: wall border + floor interior + door gap(s)
function placeBuilding(tileData, x, y, w, h, wallTile, floorTile, doorSide) {
    // Clamp to map
    if (x < 0 || y < 0 || x + w > COLS || y + h > ROWS) return;

    // Wall border
    for (let r = y; r < y + h; r++) {
        for (let c = x; c < x + w; c++) {
            tileData[r][c] = wallTile;
        }
    }
    // Interior floor
    for (let r = y + 1; r < y + h - 1; r++) {
        for (let c = x + 1; c < x + w - 1; c++) {
            tileData[r][c] = floorTile;
        }
    }
    // Door (2 tiles wide for easy entry)
    const midX = x + Math.floor(w / 2);
    const midY = y + Math.floor(h / 2);
    if (doorSide === 'south' && y + h - 1 < ROWS) {
        tileData[y + h - 1][midX] = TILE.DOOR;
        if (midX + 1 < x + w) tileData[y + h - 1][midX + 1] = TILE.DOOR;
    } else if (doorSide === 'north' && y >= 0) {
        tileData[y][midX] = TILE.DOOR;
        if (midX + 1 < x + w) tileData[y][midX + 1] = TILE.DOOR;
    } else if (doorSide === 'east' && x + w - 1 < COLS) {
        tileData[midY][x + w - 1] = TILE.DOOR;
        if (midY + 1 < y + h) tileData[midY + 1][x + w - 1] = TILE.DOOR;
    } else if (doorSide === 'west' && x >= 0) {
        tileData[midY][x] = TILE.DOOR;
        if (midY + 1 < y + h) tileData[midY + 1][x] = TILE.DOOR;
    }
}

// Randomly crumble some wall tiles of a building back to ground
function crumbleWalls(tileData, x, y, w, h, wallTile, groundTile, chance) {
    for (let r = y; r < y + h; r++) {
        for (let c = x; c < x + w; c++) {
            if (tileData[r][c] === wallTile && Math.random() < chance) {
                tileData[r][c] = groundTile;
            }
        }
    }
}

// Fill rectangle only within a given biome
function safeFill(tileData, biomeData, x, y, w, h, tile, biome) {
    for (let r = y; r < y + h && r < ROWS; r++) {
        for (let c = x; c < x + w && c < COLS; c++) {
            if (biomeData[r][c] === biome) {
                tileData[r][c] = tile;
            }
        }
    }
}

// Returns a list of good spawn positions for loot/crates per biome
export function getLootSpawnPoints() {
    const points = [];

    // Forest: inside/near cabin interiors
    points.push(
        { x: 7,  y: 6  }, { x: 20, y: 5  }, { x: 35, y: 8  },
        { x: 10, y: 21 }, { x: 24, y: 22 }, { x: 42, y: 18 },
        { x: 57, y: 7  }, { x: 62, y: 25 },
        { x: 15, y: 35 }, { x: 45, y: 30 }, { x: 70, y: 15 },
    );
    // Desert: inside ruins
    points.push(
        { x: 88,  y: 8  }, { x: 106, y: 6  }, { x: 123, y: 12 },
        { x: 92,  y: 26 }, { x: 112, y: 24 }, { x: 144, y: 8  },
        { x: 100, y: 40 }, { x: 130, y: 35 }, { x: 150, y: 45 },
    );
    // City: inside buildings and plazas
    points.push(
        { x: 5,  y: 65 }, { x: 25, y: 67 }, { x: 45, y: 65 },
        { x: 65, y: 66 }, { x: 85, y: 65 }, { x: 105, y: 66 },
        { x: 125, y: 65 }, { x: 145, y: 66 },
        { x: 5,  y: 80 }, { x: 45, y: 82 }, { x: 85, y: 80 },
        { x: 125, y: 80 }, { x: 10, y: 96 }, { x: 50, y: 95 },
    );

    return points;
}

// Tree positions — centers of the 2×2 FOREST_WALL tree clusters, in world pixels
export function getTreePositions() {
    const TS = MAP.TILE_SIZE;
    return [
        [12, 8], [14, 8], [28, 12], [46, 4], [48, 4],
        [52, 18], [35, 24], [65, 10], [68, 28], [72, 18],
        [16, 32], [38, 36], [62, 35], [74, 42], [8, 44],
    ].map(([col, row]) => ({ x: col * TS + TS, y: row * TS + TS }));
}

// Bush positions — scattered on GRASS tiles in forest (no collision needed)
export function getBushPositions() {
    const TS = MAP.TILE_SIZE;
    return [
        [3, 12], [10, 5], [20, 10], [30, 18], [42, 8],
        [50, 22], [60, 14], [66, 32], [72, 28], [78, 40],
        [25, 28], [38, 10], [48, 28], [55, 30], [15, 45],
        [3, 28], [60, 50], [75, 22], [42, 50], [20, 42],
    ].map(([col, row]) => ({ x: col * TS + 8, y: row * TS + 8 }));
}

// Rock cluster sprite positions — on top of desert rock tiles
export function getRockPositions() {
    const TS = MAP.TILE_SIZE;
    return [
        [95, 14], [115, 18], [130, 12],
        [145, 20], [100, 35], [125, 40], [150, 35],
        [88, 42], [110, 45], [140, 38],
    ].map(([col, row]) => ({ x: col * TS, y: row * TS }));
}

// Crate positions — inside buildings, harder to reach
export function getCratePositions() {
    return [
        { x: 8,   y: 7  }, { x: 34, y: 9  }, { x: 62, y: 24 },
        { x: 23,  y: 21 }, { x: 55, y: 6  }, { x: 12, y: 20 },
        { x: 90,  y: 7  }, { x: 107, y: 5 }, { x: 124, y: 10 },
        { x: 93,  y: 25 }, { x: 143, y: 7  },
        { x: 8,   y: 66 }, { x: 28, y: 66 }, { x: 48, y: 66 },
        { x: 68,  y: 67 }, { x: 88, y: 66 }, { x: 108, y: 67 },
        { x: 128, y: 66 }, { x: 148, y: 67 },
        { x: 8,   y: 81 }, { x: 88, y: 81 },
    ];
}
