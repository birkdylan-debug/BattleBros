import * as THREE from 'three';
import { MAP, TILE, WALKABLE_TILES } from '../constants.js';
import { generateDesignedMap, getTreePositions, getBushPositions, getRockPositions, getCoverObjectPositions } from '../map/DesignedMap.js';

const COLS = MAP.COLS;
const ROWS = MAP.ROWS;
const TS   = MAP.TILE_SIZE;
const WALL_H = 1.4; // height of wall tiles in world units

// Ground colors per tile id
const GROUND_COLOR = {
    0:  0x111111, // EMPTY
    2:  0x58d014, // GRASS
    4:  0xb88820, // FOREST_FLOOR
    5:  0xf4c832, // SAND
    7:  0xeedd50, // DESERT_FLOOR
    8:  0xa4b0ac, // PAVEMENT
    10: 0xccd4e8, // CITY_FLOOR
    11: 0x383838, // ROAD
    12: 0xe07018, // DOOR
    13: 0x20a80e, // JUNGLE_GROUND
    15: 0x585030, // JUNGLE_FLOOR
    16: 0x0880e8, // WATER
    17: 0xc0980e, // MIL_GROUND
    19: 0x9ca080, // MIL_FLOOR
    20: 0xeaf2ff, // SNOW
    21: 0x78d4f4, // ICE
    23: 0xbc8838, // SNOW_FLOOR
    24: 0x68d020, // RURAL_GRASS
    26: 0x784c14, // WOOD_FLOOR
    27: 0x44bc14, // JUNGLE_EDGE
    28: 0xa0c898, // SNOW_EDGE
    29: 0x8cac30, // MIL_EDGE
    30: 0x386a24, // WATER_EDGE
};

// Wall top-face colors per tile id
const WALL_COLOR = {
    0:  0x222222, // EMPTY
    1:  0x8890a0, // WALL
    3:  0xb07838, // FOREST_WALL
    6:  0xd8b858, // DESERT_WALL
    9:  0x8890c0, // CITY_WALL
    14: 0x487838, // JUNGLE_WALL
    18: 0x7c9060, // MIL_WALL
    22: 0x8ca4bc, // SNOW_WALL
    25: 0xbc7830, // WOOD_WALL
};

function hexToRgb(hex) {
    return [((hex >> 16) & 0xff) / 255, ((hex >> 8) & 0xff) / 255, (hex & 0xff) / 255];
}

function isWall(tileId) {
    return !WALKABLE_TILES.includes(tileId);
}

export class MapMesh {
    constructor(scene) {
        this.scene = scene;
        this.wallGrid = null; // 2D boolean array, true = wall
        this._meshes = [];
        this._build();
    }

    _build() {
        const { tileData } = generateDesignedMap();
        this._tileData = tileData;

        // Build wall collision grid (in TILE coordinates)
        this.wallGrid = Array.from({ length: ROWS }, (_, r) =>
            Array.from({ length: COLS }, (_, c) => isWall(tileData[r][c]))
        );

        this._buildGround(tileData);
        this._buildWalls(tileData);
        this._buildProps();
    }

    _buildGround(tileData) {
        // Draw each tile as a colored pixel onto a canvas → texture the ground plane
        const canvas = document.createElement('canvas');
        canvas.width  = COLS;
        canvas.height = ROWS;
        const ctx = canvas.getContext('2d');

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const id   = tileData[r][c];
                const hex  = GROUND_COLOR[id] ?? 0x111111;
                const colr = (hex >> 16) & 0xff;
                const colg = (hex >>  8) & 0xff;
                const colb =  hex        & 0xff;
                ctx.fillStyle = `rgb(${colr},${colg},${colb})`;
                ctx.fillRect(c, r, 1, 1);
            }
        }

        const tex = new THREE.CanvasTexture(canvas);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;

        const geo = new THREE.PlaneGeometry(COLS, ROWS);
        geo.rotateX(-Math.PI / 2);
        const mat = new THREE.MeshLambertMaterial({ map: tex });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(COLS / 2, 0, ROWS / 2);
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        this._meshes.push(mesh);
    }

    _buildWalls(tileData) {
        // Group wall tiles by type for instanced rendering
        const groups = new Map();
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const id = tileData[r][c];
                if (!isWall(id)) continue;
                if (id === TILE.WATER) continue; // water is flat (handled in ground)
                if (!groups.has(id)) groups.set(id, []);
                groups.get(id).push({ c, r });
            }
        }

        const boxGeo = new THREE.BoxGeometry(1, WALL_H, 1);
        const dummy  = new THREE.Object3D();

        for (const [id, tiles] of groups) {
            const color = WALL_COLOR[id] ?? 0x888888;
            const mat   = new THREE.MeshLambertMaterial({ color, flatShading: true });
            const mesh  = new THREE.InstancedMesh(boxGeo, mat, tiles.length);
            mesh.castShadow    = true;
            mesh.receiveShadow = true;

            tiles.forEach((t, i) => {
                dummy.position.set(t.c + 0.5, WALL_H / 2, t.r + 0.5);
                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);
            });
            mesh.instanceMatrix.needsUpdate = true;
            this.scene.add(mesh);
            this._meshes.push(mesh);
        }

        // Water: flat plane at y=0.02 so it's slightly above ground
        const waterTiles = [];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (tileData[r][c] === TILE.WATER) waterTiles.push({ c, r });
            }
        }
        if (waterTiles.length) {
            const wGeo = new THREE.BoxGeometry(1, 0.05, 1);
            const wMat = new THREE.MeshPhongMaterial({ color: 0x0880e8, specular: 0x88ccff, shininess: 80 });
            const wMesh = new THREE.InstancedMesh(wGeo, wMat, waterTiles.length);
            waterTiles.forEach((t, i) => {
                dummy.position.set(t.c + 0.5, 0.02, t.r + 0.5);
                dummy.updateMatrix();
                wMesh.setMatrixAt(i, dummy.matrix);
            });
            wMesh.instanceMatrix.needsUpdate = true;
            this.scene.add(wMesh);
            this._meshes.push(wMesh);
        }
    }

    _buildProps() {
        const TS = MAP.TILE_SIZE;

        // Trees
        for (const { x, y, type } of getTreePositions()) {
            const tx = x / TS, tz = y / TS;
            if (type === 'palm_tree') {
                this._addPalmTree(tx, tz);
            } else if (type === 'snow_pine') {
                this._addSnowPine(tx, tz);
            } else {
                this._addTree(tx, tz);
            }
        }

        // Bushes
        for (const { x, y, type } of getBushPositions()) {
            const tx = x / TS, tz = y / TS;
            this._addBush(tx, tz, type);
        }

        // Rocks
        for (const { x, y } of getRockPositions()) {
            this._addRock(x / TS, y / TS);
        }

        // Cover objects
        const covers = getCoverObjectPositions();
        const addCover = (list, w, h, d, color) => {
            if (!list || !list.length) return;
            const geo  = new THREE.BoxGeometry(w, h, d);
            const mat  = new THREE.MeshLambertMaterial({ color, flatShading: true });
            const mesh = new THREE.InstancedMesh(geo, mat, list.length);
            mesh.castShadow = true;
            const dummy = new THREE.Object3D();
            list.forEach(({ x, y }, i) => {
                dummy.position.set(x / TS, h / 2, y / TS);
                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);
            });
            mesh.instanceMatrix.needsUpdate = true;
            this.scene.add(mesh);
            this._meshes.push(mesh);
        };
        addCover(covers.sandbags,   1.3, 0.6, 0.8, 0xd8a848);
        addCover(covers.containers, 3.0, 1.8, 1.5, 0x3a6030);
        addCover(covers.cars,       2.2, 0.9, 1.2, 0xcc3030);
        addCover(covers.barrels,    0.9, 1.2, 0.9, 0x8a5830);
        addCover(covers.dumpsters,  1.5, 1.1, 1.0, 0x18a028);
        addCover(covers.fences,     2.0, 0.6, 0.2, 0xa07838);
    }

    // ─── Tree meshes ──────────────────────────────────────────────────────────
    _addTree(tx, tz) {
        const group = new THREE.Group();

        // Trunk
        const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.2, 6);
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a2406, flatShading: true });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(0, 0.6, 0);
        trunk.castShadow = true;
        group.add(trunk);

        // Canopy — 3 stacked spheres for the low-poly fluffy look
        const layers = [
            { r: 1.5, y: 1.5, color: 0x2aaa08 },
            { r: 1.8, y: 1.9, color: 0x38c010 },
            { r: 1.4, y: 2.6, color: 0x4ad020 },
        ];
        for (const l of layers) {
            const geo  = new THREE.SphereGeometry(l.r, 6, 5);
            const mat  = new THREE.MeshLambertMaterial({ color: l.color, flatShading: true });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(0, l.y, 0);
            mesh.castShadow = true;
            group.add(mesh);
        }

        group.position.set(tx, 0, tz);
        this.scene.add(group);
    }

    _addPalmTree(tx, tz) {
        const group = new THREE.Group();

        // Curved trunk (lean slightly)
        const trunkGeo = new THREE.CylinderGeometry(0.12, 0.22, 2.8, 6);
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a4a1a, flatShading: true });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(0.3, 1.4, 0);
        trunk.rotation.z = -0.12;
        trunk.castShadow = true;
        group.add(trunk);

        // Fronds — flat boxes radiating from top
        const frondMat = new THREE.MeshLambertMaterial({ color: 0x38a020, flatShading: true });
        const frondAngles = [0, 72, 144, 216, 288];
        for (const deg of frondAngles) {
            const geo  = new THREE.BoxGeometry(1.6, 0.08, 0.3);
            const mesh = new THREE.Mesh(geo, frondMat);
            mesh.position.set(0.3 + Math.cos(deg * Math.PI / 180) * 0.8, 2.8, Math.sin(deg * Math.PI / 180) * 0.8);
            mesh.rotation.y  = deg * Math.PI / 180;
            mesh.rotation.z  = 0.3;
            mesh.castShadow = true;
            group.add(mesh);
        }

        // Crown
        const crownGeo = new THREE.SphereGeometry(0.3, 5, 4);
        const crownMat = new THREE.MeshLambertMaterial({ color: 0x6a4010, flatShading: true });
        const crown = new THREE.Mesh(crownGeo, crownMat);
        crown.position.set(0.3, 2.8, 0);
        group.add(crown);

        group.position.set(tx, 0, tz);
        this.scene.add(group);
    }

    _addSnowPine(tx, tz) {
        const group = new THREE.Group();

        // Trunk
        const trunkGeo = new THREE.CylinderGeometry(0.1, 0.2, 1.0, 5);
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x3e1e08, flatShading: true });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(0, 0.5, 0);
        trunk.castShadow = true;
        group.add(trunk);

        // Tiered cones
        const tiers = [
            { ry: 0.9, rb: 1.3, h: 0.9, y: 1.0, col: 0x2a6020 },
            { ry: 0.7, rb: 1.0, h: 0.8, y: 1.7, col: 0x347828 },
            { ry: 0.4, rb: 0.7, h: 0.7, y: 2.3, col: 0x3e8a30 },
            { ry: 0.15, rb:0.45, h:0.6, y: 2.8, col: 0x48a038 },
        ];
        for (const t of tiers) {
            const coneGeo = new THREE.ConeGeometry(t.rb, t.h, 7);
            const coneMat = new THREE.MeshLambertMaterial({ color: t.col, flatShading: true });
            const cone = new THREE.Mesh(coneGeo, coneMat);
            cone.position.set(0, t.y, 0);
            cone.castShadow = true;
            group.add(cone);

            // Snow cap on each tier
            const capGeo = new THREE.ConeGeometry(t.rb * 0.7, t.h * 0.25, 7);
            const capMat = new THREE.MeshLambertMaterial({ color: 0xe8f4ff, flatShading: true });
            const cap = new THREE.Mesh(capGeo, capMat);
            cap.position.set(0.12, t.y - t.h * 0.1, 0);
            cap.rotation.z = 0.15;
            group.add(cap);
        }

        group.position.set(tx, 0, tz);
        this.scene.add(group);
    }

    _addBush(tx, tz, type) {
        const group = new THREE.Group();
        const color  = type === 'jungle_bush' ? 0x208018
                     : type === 'snow_bush'   ? 0xd0e8ff
                     : 0x3aaa14;
        const color2 = type === 'jungle_bush' ? 0x48c030
                     : type === 'snow_bush'   ? 0xffffff
                     : 0x60d030;

        const offsets = [
            {x:-0.38, z: 0.1, r:0.42}, {x: 0.38, z: 0.1, r:0.42},
            {x: 0,    z:-0.2, r:0.44}, {x: 0,    z: 0.3, r:0.34},
        ];
        for (const o of offsets) {
            const geo  = new THREE.SphereGeometry(o.r, 5, 4);
            const mat  = new THREE.MeshLambertMaterial({ color: o.r > 0.4 ? color : color2, flatShading: true });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(o.x, o.r * 0.7, o.z);
            mesh.castShadow = true;
            group.add(mesh);
        }

        group.position.set(tx, 0, tz);
        this.scene.add(group);
    }

    _addRock(tx, tz) {
        const group = new THREE.Group();
        const offsets = [
            {x:0, y:0.28, z:0, r:0.38, s:[1,0.7,0.9]},
            {x:0.35, y:0.22, z:0.1, r:0.28, s:[0.9,0.6,1.1]},
        ];
        for (const o of offsets) {
            const geo  = new THREE.SphereGeometry(o.r, 5, 4);
            const mat  = new THREE.MeshLambertMaterial({ color: 0x8c8878, flatShading: true });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(o.x, o.y, o.z);
            mesh.scale.set(...o.s);
            mesh.castShadow = true;
            group.add(mesh);
        }
        group.position.set(tx, 0, tz);
        this.scene.add(group);
    }

    // Check if a tile coordinate is a wall
    isWallAt(col, row) {
        const c = Math.floor(col);
        const r = Math.floor(row);
        if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return true;
        return this.wallGrid[r][c];
    }

    destroy() {
        for (const m of this._meshes) {
            this.scene.remove(m);
            m.geometry?.dispose();
            if (Array.isArray(m.material)) m.material.forEach(m => m.dispose());
            else m.material?.dispose();
        }
        this._meshes = [];
    }
}
