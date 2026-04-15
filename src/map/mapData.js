import { TILE, MAP } from '../constants.js';

export function generateMap(cols = MAP.COLS, rows = MAP.ROWS) {
    // Fill everything with grass
    const data = Array.from({ length: rows }, () => Array(cols).fill(TILE.EMPTY));

    function fillRect(x, y, w, h, tile) {
        for (let row = y; row < y + h && row < rows; row++) {
            for (let col = x; col < x + w && col < cols; col++) {
                data[row][col] = tile;
            }
        }
    }

    // Draws a hollow building: wall border, floor interior, one door gap
    function addBuilding(x, y, w, h, doorSide = 'south') {
        fillRect(x, y, w, h, TILE.WALL);
        fillRect(x + 1, y + 1, w - 2, h - 2, TILE.FLOOR);

        const midX = x + Math.floor(w / 2);
        const midY = y + Math.floor(h / 2);

        // Door is a 2-wide gap so the player can easily enter
        if (doorSide === 'south') {
            data[y + h - 1][midX] = TILE.DOOR;
            data[y + h - 1][midX + 1] = TILE.DOOR;
        } else if (doorSide === 'north') {
            data[y][midX] = TILE.DOOR;
            data[y][midX + 1] = TILE.DOOR;
        } else if (doorSide === 'east') {
            data[midY][x + w - 1] = TILE.DOOR;
            data[midY + 1][x + w - 1] = TILE.DOOR;
        } else if (doorSide === 'west') {
            data[midY][x] = TILE.DOOR;
            data[midY + 1][x] = TILE.DOOR;
        }
    }

    // Adds an interior wall dividing a room, with a doorway gap
    function addInteriorWall(x, y, w, h, gapPos, horizontal = true) {
        if (horizontal) {
            for (let col = x; col < x + w; col++) {
                data[y][col] = (col === gapPos || col === gapPos + 1) ? TILE.FLOOR : TILE.WALL;
            }
        } else {
            for (let row = y; row < y + h; row++) {
                data[row][x] = (row === gapPos || row === gapPos + 1) ? TILE.FLOOR : TILE.WALL;
            }
        }
    }

    function addHPath(x, y, len) { fillRect(x, y, len, 3, TILE.PATH); }
    function addVPath(x, y, len) { fillRect(x, y, 3, len, TILE.PATH); }

    // --- Buildings ---

    // Building A: top-left area, single big room
    addBuilding(4, 4, 16, 13, 'south');

    // Building B: top-right area, divided into two rooms
    addBuilding(50, 6, 20, 16, 'west');
    addInteriorWall(51, 14, 18, 1, 59, true); // horizontal interior wall

    // Building C: bottom-left, large with three rooms
    addBuilding(8, 36, 22, 18, 'north');
    addInteriorWall(9, 44, 20, 1, 17, true);   // splits into top/bottom
    addInteriorWall(18, 45, 1, 8, 49, false);  // splits bottom into left/right

    // Building D: bottom-right, small room
    addBuilding(54, 38, 14, 12, 'north');

    // Building E: center-top, medium room
    addBuilding(28, 5, 16, 10, 'south');

    // --- Paths connecting buildings ---
    addHPath(19, 16, 32);    // connects A south door across to B
    addVPath(31, 14, 23);    // vertical spine down toward C
    addHPath(31, 36, 24);    // connects spine to D area
    addVPath(56, 18, 21);    // connects B to D
    addHPath(8, 26, 4);      // short spur from C north
    addVPath(22, 14, 3);     // connects A south to main H path

    // Add some scattered rocks / obstacles in the outdoor area (use WALL tile)
    const rocks = [
        [35, 28], [36, 28], [37, 27],
        [45, 32], [45, 33],
        [15, 28], [16, 29],
        [62, 28], [63, 28],
        [42, 45], [43, 45], [42, 46],
    ];
    for (const [rx, ry] of rocks) {
        if (data[ry][rx] === TILE.EMPTY) data[ry][rx] = TILE.WALL;
    }

    return data;
}
