import { TILE, MAP, WALKABLE_TILES } from '../constants.js';
import { generateDesignedMap } from './DesignedMap.js';

// All tints set to white — tile textures carry their own colors
// (Battlelands-style: bright flat cartoon colors baked into each tile)
const TILE_TINTS = {
    [TILE.EMPTY]:         0xffffff,
    [TILE.WALL]:          0xffffff,
    [TILE.GRASS]:         0xffffff,
    [TILE.FOREST_WALL]:   0xffffff,
    [TILE.FOREST_FLOOR]:  0xffffff,
    [TILE.SAND]:          0xffffff,
    [TILE.DESERT_WALL]:   0xffffff,
    [TILE.DESERT_FLOOR]:  0xffffff,
    [TILE.PAVEMENT]:      0xffffff,
    [TILE.CITY_WALL]:     0xffffff,
    [TILE.CITY_FLOOR]:    0xffffff,
    [TILE.ROAD]:          0xffffff,
    [TILE.DOOR]:          0xffffff,
    [TILE.JUNGLE_GROUND]: 0xffffff,
    [TILE.JUNGLE_WALL]:   0xffffff,
    [TILE.JUNGLE_FLOOR]:  0xffffff,
    [TILE.WATER]:         0xffffff,
    [TILE.MIL_GROUND]:    0xffffff,
    [TILE.MIL_WALL]:      0xffffff,
    [TILE.MIL_FLOOR]:     0xffffff,
    [TILE.SNOW]:          0xffffff,
    [TILE.ICE]:           0xffffff,
    [TILE.SNOW_WALL]:     0xffffff,
    [TILE.SNOW_FLOOR]:    0xffffff,
    [TILE.RURAL_GRASS]:   0xffffff,
    [TILE.WOOD_WALL]:     0xffffff,
    [TILE.WOOD_FLOOR]:    0xffffff,
    [TILE.JUNGLE_EDGE]:   0xffffff,
    [TILE.SNOW_EDGE]:     0xffffff,
    [TILE.MIL_EDGE]:      0xffffff,
    [TILE.WATER_EDGE]:    0xffffff,
};

const WALL_TILES = new Set([
    TILE.EMPTY, TILE.WALL,
    TILE.FOREST_WALL, TILE.DESERT_WALL,
    TILE.CITY_WALL, TILE.JUNGLE_WALL,
    TILE.MIL_WALL, TILE.SNOW_WALL, TILE.WOOD_WALL,
    TILE.WATER,
]);

export function buildMap(scene) {
    const { tileData } = generateDesignedMap();

    const map = scene.make.tilemap({
        data: tileData,
        tileWidth: MAP.TILE_SIZE,
        tileHeight: MAP.TILE_SIZE,
    });

    const tileset = map.addTilesetImage('tiles', 'tiles', MAP.TILE_SIZE, MAP.TILE_SIZE, 0, 0);
    const layer = map.createLayer(0, tileset, 0, 0);

    // Everything NOT in the walkable list is solid
    layer.setCollisionByExclusion(WALKABLE_TILES);

    // Shadow pass — draws south-face and east-face shadows on exposed wall edges
    // This makes every wall look like a raised 3D block
    _addWallShadows(scene, layer);

    return { map, layer };
}

function _addWallShadows(scene, layer) {
    const sz = MAP.TILE_SIZE;
    const gfx = scene.add.graphics().setDepth(1);

    layer.forEachTile(tile => {
        if (tile.index === -1) return;
        if (!WALL_TILES.has(tile.index)) return;

        const tx = tile.pixelX;
        const ty = tile.pixelY;

        // South drop shadow — deep angled shadow (primary, casts south-east)
        const below = layer.getTileAt(tile.x, tile.y + 1);
        if (below && WALKABLE_TILES.includes(below.index)) {
            // Core shadow (full width, hugs the base of the wall)
            gfx.fillStyle(0x000000, 0.78);
            gfx.fillRect(tx,     ty + sz,      sz,     8);
            // Mid shadow (slightly offset east to start the diagonal feel)
            gfx.fillStyle(0x000000, 0.50);
            gfx.fillRect(tx + 2, ty + sz +  8, sz,     7);
            // Soft penumbra
            gfx.fillStyle(0x000000, 0.28);
            gfx.fillRect(tx + 4, ty + sz + 15, sz,     6);
            // Fade tail
            gfx.fillStyle(0x000000, 0.12);
            gfx.fillRect(tx + 6, ty + sz + 21, sz,     4);
        }

        // East drop shadow — tall to reinforce the angled-view height
        const right = layer.getTileAt(tile.x + 1, tile.y);
        if (right && WALKABLE_TILES.includes(right.index)) {
            gfx.fillStyle(0x000000, 0.58);
            gfx.fillRect(tx + sz,      ty + 2, 8, sz - 2);
            gfx.fillStyle(0x000000, 0.32);
            gfx.fillRect(tx + sz +  8, ty + 3, 6, sz - 3);
            gfx.fillStyle(0x000000, 0.15);
            gfx.fillRect(tx + sz + 14, ty + 4, 4, sz - 4);
        }
    });
}
