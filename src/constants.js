// --- Tile IDs ---
export const TILE = {
    // Legacy / shared
    EMPTY: 0,
    WALL: 1,
    // Forest biome (legacy, kept for compat)
    GRASS: 2,
    FOREST_WALL: 3,
    FOREST_FLOOR: 4,
    // Desert biome (legacy)
    SAND: 5,
    DESERT_WALL: 6,
    DESERT_FLOOR: 7,
    // City biome
    PAVEMENT: 8,
    CITY_WALL: 9,
    CITY_FLOOR: 10,
    ROAD: 11,
    // Shared door
    DOOR: 12,
    // Jungle biome
    JUNGLE_GROUND: 13,
    JUNGLE_WALL: 14,
    JUNGLE_FLOOR: 15,
    // Water
    WATER: 16,
    // Military biome
    MIL_GROUND: 17,
    MIL_WALL: 18,
    MIL_FLOOR: 19,
    // Snow biome
    SNOW: 20,
    ICE: 21,
    SNOW_WALL: 22,
    SNOW_FLOOR: 23,
    // Rural biome
    RURAL_GRASS: 24,
    WOOD_WALL: 25,
    WOOD_FLOOR: 26,
    // Transition tiles
    JUNGLE_EDGE: 27,
    SNOW_EDGE: 28,
    MIL_EDGE: 29,
    WATER_EDGE: 30,
};

// Tiles the player (and bullets) can walk through — everything else is solid
export const WALKABLE_TILES = [
    2,  // GRASS
    4,  // FOREST_FLOOR
    5,  // SAND
    7,  // DESERT_FLOOR
    8,  // PAVEMENT
    10, // CITY_FLOOR
    11, // ROAD
    12, // DOOR
    13, // JUNGLE_GROUND
    15, // JUNGLE_FLOOR
    17, // MIL_GROUND
    19, // MIL_FLOOR
    20, // SNOW
    21, // ICE
    23, // SNOW_FLOOR
    24, // RURAL_GRASS
    26, // WOOD_FLOOR
    27, // JUNGLE_EDGE
    28, // SNOW_EDGE
    29, // MIL_EDGE
    30, // WATER_EDGE
];

// --- Map ---
export const MAP = {
    COLS: 500,
    ROWS: 380,
    TILE_SIZE: 16,
};

export const MAP_PIXEL_W = MAP.COLS * MAP.TILE_SIZE; // 8000
export const MAP_PIXEL_H = MAP.ROWS * MAP.TILE_SIZE; // 6080

// --- Biomes ---
export const BIOME = {
    FOREST: 'forest',
    DESERT: 'desert',
    CITY: 'city',
    JUNGLE: 'jungle',
    MILITARY: 'military',
    SNOW: 'snow',
    RURAL: 'rural',
};

// --- Zone stages ---
export const ZONE_STAGES = [
    { endRadius: 2400, warningDuration: 20000, shrinkDuration: 45000, damagePerSecond: 5 },
    { endRadius: 1500, warningDuration: 15000, shrinkDuration: 35000, damagePerSecond: 10 },
    { endRadius: 800,  warningDuration: 12000, shrinkDuration: 28000, damagePerSecond: 20 },
    { endRadius: 250,  warningDuration: 10000, shrinkDuration: 20000, damagePerSecond: 40 },
];
export const ZONE_INITIAL_RADIUS = 3800;
export const ZONE_CENTER_X = MAP_PIXEL_W / 2;  // 4000
export const ZONE_CENTER_Y = MAP_PIXEL_H / 2;  // 3040

// --- Player ---
export const PLAYER_SPEED = 200;
export const PLAYER_MAX_HP = 100;
export const PLAYER_MAX_SHIELD = 50;

// --- Bullets ---
export const BULLET_POOL_SIZE = 60;
export const ROCKET_POOL_SIZE = 10;
