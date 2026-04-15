import * as Phaser from 'phaser';
import { MAP, TILE } from '../constants.js';
import { SKINS } from '../config/SkinConfig.js';

const TS = MAP.TILE_SIZE; // 16

export class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    create() {
        this._buildTileTexture();
        this._buildPlayerTextures();
        this._buildGunTextures();
        this._buildBulletTexture();
        this._buildCrateTextures();
        this._buildAmmoPackTexture();
        this._buildTreeTexture();
        this._buildBushTexture();
        this._buildRockTexture();
        this._buildPalmTreeTexture();
        this._buildSnowPineTexture();
        this._buildJungleBushTexture();
        this._buildSnowBushTexture();
        this._buildCoverObjectTextures();
        this.scene.start('MenuScene');
    }

    // ─── Tile Strip ──────────────────────────────────────────────────────────
    // Uses native Canvas 2D so Phaser 4 WebGL rendering quirks don't affect tiles.
    // A thin wrapper object mimics the Phaser Graphics API (fillStyle/fillRect/etc.)
    // so all _tile* functions work unchanged.
    _buildTileTexture() {
        const count = 31;

        const canvas = document.createElement('canvas');
        canvas.width  = TS * count;
        canvas.height = TS;
        const ctx = canvas.getContext('2d');

        // Factory: returns a Graphics-like object that draws into the canvas at offsetX
        const makeTile = (offsetX) => ({
            fillStyle: (hex, alpha = 1) => {
                const r = (hex >> 16) & 0xff;
                const g = (hex >>  8) & 0xff;
                const b =  hex        & 0xff;
                ctx.fillStyle = alpha < 1
                    ? `rgba(${r},${g},${b},${alpha})`
                    : `rgb(${r},${g},${b})`;
            },
            fillRect: (x, y, w, h) => ctx.fillRect(offsetX + x, y, w, h),
            fillCircle: (x, y, r) => {
                ctx.beginPath();
                ctx.arc(offsetX + x, y, r, 0, Math.PI * 2);
                ctx.fill();
            },
            fillEllipse: (x, y, w, h) => {
                ctx.beginPath();
                ctx.ellipse(offsetX + x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
                ctx.fill();
            },
            fillTriangle: (x1, y1, x2, y2, x3, y3) => {
                ctx.beginPath();
                ctx.moveTo(offsetX + x1, y1);
                ctx.lineTo(offsetX + x2, y2);
                ctx.lineTo(offsetX + x3, y3);
                ctx.closePath();
                ctx.fill();
            },
        });

        const drawFns = [
            (g) => this._tileEmpty(g),           // 0
            (g) => this._tileWall(g),             // 1
            (g) => this._tileGrass(g),            // 2
            (g) => this._tileForestWall(g),       // 3
            (g) => this._tileForestFloor(g),      // 4
            (g) => this._tileSand(g),             // 5
            (g) => this._tileDesertWall(g),       // 6
            (g) => this._tileDesertFloor(g),      // 7
            (g) => this._tilePavement(g),         // 8
            (g) => this._tileCityWall(g),         // 9
            (g) => this._tileCityFloor(g),        // 10
            (g) => this._tileRoad(g),             // 11
            (g) => this._tileDoor(g),             // 12
            (g) => this._tileJungleGround(g),     // 13
            (g) => this._tileJungleWall(g),       // 14
            (g) => this._tileJungleFloor(g),      // 15
            (g) => this._tileWater(g),            // 16
            (g) => this._tileMilGround(g),        // 17
            (g) => this._tileMilWall(g),          // 18
            (g) => this._tileMilFloor(g),         // 19
            (g) => this._tileSnow(g),             // 20
            (g) => this._tileIce(g),              // 21
            (g) => this._tileSnowWall(g),         // 22
            (g) => this._tileSnowFloor(g),        // 23
            (g) => this._tileRuralGrass(g),       // 24
            (g) => this._tileWoodWall(g),         // 25
            (g) => this._tileWoodFloor(g),        // 26
            (g) => this._tileJungleEdge(g),       // 27
            (g) => this._tileSnowEdge(g),         // 28
            (g) => this._tileMilEdge(g),          // 29
            (g) => this._tileWaterEdge(g),        // 30
        ];

        for (let i = 0; i < drawFns.length; i++) {
            drawFns[i](makeTile(i * TS));
        }

        this.textures.addCanvas('tiles', canvas);
    }

    // ─── 3D Wall Helper ───────────────────────────────────────────────────────
    // roofColor  = bright top face (what you see looking straight down)
    // faceColor  = darker south face (front wall visible at a slight angle)
    _wallBase(g, roofColor, faceColor, innerDetail) {
        // Roof — small strip (viewed almost edge-on at our angle), just 5px
        g.fillStyle(roofColor);      g.fillRect(0, 0, TS,  5);
        // Roof: bright top-left highlight
        g.fillStyle(0xffffff, 0.60); g.fillRect(0, 0, TS,  2);
        // Roof: left rim glow
        g.fillStyle(0xffffff, 0.28); g.fillRect(0, 2,  2,  3);
        // Roof: right edge shadow
        g.fillStyle(0x000000, 0.28); g.fillRect(TS-2, 0, 2, 5);

        // South/front wall face — dominant 11px (the "angle" — you see mostly wall)
        g.fillStyle(faceColor);      g.fillRect(0, 5, TS, 11);
        // Wall face top edge (just below roof overhang — slightly lighter)
        g.fillStyle(0xffffff, 0.12); g.fillRect(0, 5, TS,  2);
        // Wall face: mid darkening (depth gradient down the face)
        g.fillStyle(0x000000, 0.22); g.fillRect(0, 9, TS,  7);
        // Wall face: bottom shadow strip — where wall meets ground
        g.fillStyle(0x000000, 0.60); g.fillRect(0, 13, TS,  3);
        // Absolute bottom pixel — crisp ground contact line
        g.fillStyle(0x000000, 0.80); g.fillRect(0, 15, TS,  1);

        if (innerDetail) innerDetail(g);
    }

    // ─── Tile Drawing Functions ───────────────────────────────────────────────

    _tileEmpty(g) {
        g.fillStyle(0x1a1a1a); g.fillRect(0, 0, TS, TS);
    }

    _tileWall(g) {
        this._wallBase(g, 0x9898a8, 0x303038);
    }

    _tileGrass(g) {
        // Super vivid lime green
        g.fillStyle(0x50d818); g.fillRect(0, 0, TS, TS);
        g.fillStyle(0x68f028);
        g.fillRect(2,2,2,2); g.fillRect(9,5,2,2); g.fillRect(5,10,2,2);
        g.fillRect(12,8,2,2); g.fillRect(1,13,2,2); g.fillRect(14,1,1,2);
        g.fillStyle(0x38b010);
        g.fillRect(6,4,1,1); g.fillRect(13,11,1,1); g.fillRect(3,14,1,1);
        g.fillStyle(0x90ff48);
        g.fillRect(7,1,1,1); g.fillRect(14,10,1,1); g.fillRect(3,7,1,1);
    }

    _tileForestWall(g) {
        this._wallBase(g, 0xb87840, 0x3c1606, g2 => {
            // Roof: wood grain lines
            g2.fillStyle(0x000000, 0.14);
            g2.fillRect(0, 4, TS, 1); g2.fillRect(0, 8, TS, 1);
            g2.fillStyle(0xffffff, 0.10);
            g2.fillRect(0, 5, TS, 1); g2.fillRect(0, 9, TS, 1);
        });
    }

    _tileForestFloor(g) {
        g.fillStyle(0xc89848); g.fillRect(0, 0, TS, TS);
        g.fillStyle(0xa07828);
        g.fillRect(0, 5, TS, 1); g.fillRect(0, 10, TS, 1); g.fillRect(0, 15, TS, 1);
        g.fillStyle(0xe8b060);
        g.fillRect(0, 2, TS, 1); g.fillRect(0, 7, TS, 1); g.fillRect(0, 12, TS, 1);
        g.fillStyle(0x886020);
        g.fillRect(8, 0, 1, 5); g.fillRect(4, 5, 1, 5); g.fillRect(12, 10, 1, 5);
    }

    _tileSand(g) {
        // Vivid golden sand
        g.fillStyle(0xf8d038); g.fillRect(0, 0, TS, TS);
        g.fillStyle(0xffe858);
        g.fillRect(1,2,4,1); g.fillRect(8,6,4,1); g.fillRect(3,11,3,1); g.fillRect(11,13,4,1);
        g.fillStyle(0xd4a820);
        g.fillRect(5,4,1,1); g.fillRect(13,8,1,1); g.fillRect(7,14,1,1); g.fillRect(2,9,1,1);
        g.fillStyle(0xfff488);
        g.fillRect(6,1,1,1); g.fillRect(14,10,1,1);
    }

    _tileDesertWall(g) {
        this._wallBase(g, 0xe0c068, 0x5c3c10, g2 => {
            // Brick line
            g2.fillStyle(0x000000, 0.14);
            g2.fillRect(0, 6, TS, 1); g2.fillRect(8, 0, 1, 6);
        });
    }

    _tileDesertFloor(g) {
        g.fillStyle(0xf4e068); g.fillRect(0, 0, TS, TS);
        g.fillStyle(0xe0c850);
        g.fillRect(3,4,2,1); g.fillRect(11,2,2,1); g.fillRect(6,10,3,1); g.fillRect(13,12,2,1);
        g.fillStyle(0xfff898);
        g.fillRect(4,7,1,1); g.fillRect(10,13,1,1); g.fillRect(1,11,1,1);
    }

    _tilePavement(g) {
        g.fillStyle(0xb0bcbc); g.fillRect(0, 0, TS, TS);
        g.fillStyle(0x909c9c);
        g.fillRect(0, 8, TS, 1); g.fillRect(8, 0, 1, TS);
        g.fillStyle(0xc8d0d0);
        g.fillRect(1,1,6,6); g.fillRect(9,1,6,6);
        g.fillRect(1,9,6,6); g.fillRect(9,9,6,6);
        g.fillStyle(0xffffff, 0.4);
        g.fillRect(1,1,6,1); g.fillRect(9,1,6,1);
        g.fillRect(1,9,6,1); g.fillRect(9,9,6,1);
    }

    _tileCityWall(g) {
        this._wallBase(g, 0x9898c8, 0x202030, g2 => {
            // Mortar line
            g2.fillStyle(0x000000, 0.12);
            g2.fillRect(0, 7, TS, 1);
        });
    }

    _tileCityFloor(g) {
        g.fillStyle(0xe0e4f4); g.fillRect(0, 0, TS, TS);
        g.fillStyle(0xb8bcd8);
        g.fillRect(0, 8, TS, 1); g.fillRect(8, 0, 1, TS);
        g.fillStyle(0xeef0fc);
        g.fillRect(1,1,6,6); g.fillRect(9,1,6,6);
        g.fillRect(1,9,6,6); g.fillRect(9,9,6,6);
        g.fillStyle(0xffffff, 0.5);
        g.fillRect(1,1,3,1); g.fillRect(9,1,3,1);
        g.fillRect(1,9,3,1); g.fillRect(9,9,3,1);
    }

    _tileRoad(g) {
        g.fillStyle(0x484848); g.fillRect(0, 0, TS, TS);
        // Edge stripes
        g.fillStyle(0x606060);
        g.fillRect(0, 0, TS, 1); g.fillRect(0, TS-1, TS, 1);
        // Bright yellow dashes
        g.fillStyle(0xffdd00);
        g.fillRect(7, 0, 2, 6); g.fillRect(7, 10, 2, 6);
    }

    _tileDoor(g) {
        g.fillStyle(0xf09030); g.fillRect(0, 0, TS, TS);
        g.fillStyle(0xc07020);
        g.fillRect(4, 0, 1, TS); g.fillRect(9, 0, 1, TS); g.fillRect(13, 0, 1, TS);
        g.fillStyle(0xffc040);
        g.fillRect(2, 0, 1, TS); g.fillRect(7, 0, 1, TS); g.fillRect(11, 0, 1, TS);
        g.fillStyle(0xffe870); g.fillRect(0, 0, TS, 1);
        g.fillStyle(0xd0d0d0); g.fillRect(2, 5, 2, 5);
        g.fillStyle(0xffffff); g.fillRect(2, 5, 2, 1);
    }

    _tileJungleGround(g) {
        // Vivid deep jungle green
        g.fillStyle(0x28b018); g.fillRect(0, 0, TS, TS);
        g.fillStyle(0x38c828);
        g.fillRect(2,1,3,2); g.fillRect(10,4,2,3); g.fillRect(6,9,3,2);
        g.fillRect(13,11,2,3); g.fillRect(1,13,3,2);
        g.fillStyle(0x189008);
        g.fillRect(5,3,1,2); g.fillRect(12,7,1,2); g.fillRect(8,12,1,2);
        g.fillStyle(0x58e038);
        g.fillRect(4,6,1,1); g.fillRect(11,2,1,1); g.fillRect(14,14,1,1);
    }

    _tileJungleWall(g) {
        this._wallBase(g, 0x508040, 0x102808, g2 => {
            // Moss patches on roof
            g2.fillStyle(0xffffff, 0.10);
            g2.fillRect(3,3,4,2); g2.fillRect(10,7,3,2);
        });
    }

    _tileJungleFloor(g) {
        g.fillStyle(0x686848); g.fillRect(0, 0, TS, TS);
        g.fillStyle(0x505830);
        g.fillRect(0, 8, TS, 1); g.fillRect(8, 0, 1, TS);
        g.fillStyle(0x787858);
        g.fillRect(1,1,6,6); g.fillRect(9,1,6,6);
        g.fillRect(1,9,6,6); g.fillRect(9,9,6,6);
        g.fillStyle(0x487028);
        g.fillRect(3,3,1,1); g.fillRect(11,11,1,1); g.fillRect(6,13,1,1);
    }

    _tileWater(g) {
        // Vivid bright blue
        g.fillStyle(0x0898f8); g.fillRect(0, 0, TS, TS);
        g.fillStyle(0x20b0ff);
        g.fillRect(0,3,TS,1); g.fillRect(0,9,TS,1); g.fillRect(0,14,TS,1);
        g.fillStyle(0x70d8ff);
        g.fillRect(2,2,4,1); g.fillRect(10,7,3,1); g.fillRect(5,12,4,1);
        g.fillStyle(0xc0f0ff);
        g.fillRect(3,2,1,1); g.fillRect(12,7,1,1); g.fillRect(7,12,1,1);
        g.fillStyle(0x0060c8);
        g.fillRect(7,5,2,2); g.fillRect(13,10,2,2);
    }

    _tileMilGround(g) {
        // Vivid khaki/tan
        g.fillStyle(0xd4a828); g.fillRect(0, 0, TS, TS);
        g.fillStyle(0xe8bc38);
        g.fillRect(2,3,3,1); g.fillRect(9,1,4,1); g.fillRect(5,9,3,1);
        g.fillRect(12,11,3,1); g.fillRect(1,13,4,1);
        g.fillStyle(0xb08818);
        g.fillRect(6,5,1,1); g.fillRect(13,7,1,1); g.fillRect(3,11,1,1);
        g.fillStyle(0xffd058);
        g.fillRect(7,2,1,1); g.fillRect(14,9,1,1);
    }

    _tileMilWall(g) {
        this._wallBase(g, 0x8a9870, 0x282818, g2 => {
            // Concrete seam
            g2.fillStyle(0x000000, 0.18);
            g2.fillRect(0, 7, TS, 1); g2.fillRect(9, 0, 1, 7);
        });
    }

    _tileMilFloor(g) {
        g.fillStyle(0xb8b8a0); g.fillRect(0, 0, TS, TS);
        g.fillStyle(0x989880);
        g.fillRect(0, 8, TS, 1); g.fillRect(8, 0, 1, TS);
        g.fillStyle(0xc8c8b0);
        g.fillRect(1,1,6,6); g.fillRect(9,1,6,6);
        g.fillRect(1,9,6,6); g.fillRect(9,9,6,6);
        g.fillStyle(0x808870);
        g.fillRect(7,7,2,2);
    }

    _tileSnow(g) {
        // Crisp white-blue
        g.fillStyle(0xf0f6ff); g.fillRect(0, 0, TS, TS);
        g.fillStyle(0xd0e4f8);
        g.fillRect(1,4,4,1); g.fillRect(9,2,4,1); g.fillRect(3,10,3,1); g.fillRect(11,13,4,1);
        g.fillStyle(0xffffff);
        g.fillRect(5,3,1,1); g.fillRect(13,8,1,1); g.fillRect(7,14,1,1);
        g.fillStyle(0xa8c8e8);
        g.fillRect(7,6,2,1); g.fillRect(13,11,2,1);
    }

    _tileIce(g) {
        // Bright cyan ice
        g.fillStyle(0x88dcf8); g.fillRect(0, 0, TS, TS);
        g.fillStyle(0x60b8d8);
        g.fillRect(0,5,6,1); g.fillRect(4,5,1,5);
        g.fillRect(10,8,6,1); g.fillRect(12,2,1,8);
        g.fillStyle(0xc8f4ff);
        g.fillRect(2,1,5,2); g.fillRect(10,5,4,1);
        g.fillStyle(0xffffff);
        g.fillRect(2,1,2,1); g.fillRect(10,5,2,1);
    }

    _tileSnowWall(g) {
        this._wallBase(g, 0x9ab0c8, 0x202838, g2 => {
            // Snow cap — bright white over the top
            g2.fillStyle(0xffffff, 0.85); g2.fillRect(0, 0, TS, 3);
            g2.fillStyle(0xe8f0ff, 0.50); g2.fillRect(0, 3, TS, 2);
        });
    }

    _tileSnowFloor(g) {
        g.fillStyle(0xd4a850); g.fillRect(0, 0, TS, TS);
        g.fillStyle(0xb08830);
        g.fillRect(0, 5, TS, 1); g.fillRect(0, 10, TS, 1); g.fillRect(0, 15, TS, 1);
        g.fillStyle(0xecc060);
        g.fillRect(0, 2, TS, 1); g.fillRect(0, 7, TS, 1); g.fillRect(0, 12, TS, 1);
        g.fillStyle(0xa07828);
        g.fillRect(8, 0, 1, 5); g.fillRect(4, 5, 1, 5); g.fillRect(11, 10, 1, 5);
    }

    _tileRuralGrass(g) {
        // Vivid lime open field
        g.fillStyle(0x78e830); g.fillRect(0, 0, TS, TS);
        g.fillStyle(0x98ff48);
        g.fillRect(1,3,4,1); g.fillRect(9,1,4,1); g.fillRect(5,8,3,1);
        g.fillRect(13,10,2,1); g.fillRect(2,13,5,1);
        g.fillStyle(0x58c020);
        g.fillRect(6,5,1,2); g.fillRect(12,3,1,2); g.fillRect(3,10,1,2);
        g.fillStyle(0xc0ff80);
        g.fillRect(7,2,1,1); g.fillRect(11,9,1,1);
    }

    _tileWoodWall(g) {
        this._wallBase(g, 0xc08040, 0x3c1606, g2 => {
            // Plank lines
            g2.fillStyle(0x000000, 0.18);
            g2.fillRect(0, 4, TS, 1); g2.fillRect(0, 8, TS, 1);
            g2.fillStyle(0xffffff, 0.10);
            g2.fillRect(0, 5, TS, 1); g2.fillRect(0, 9, TS, 1);
            // Nail seams
            g2.fillStyle(0x000000, 0.14);
            g2.fillRect(4, 0, 1, 11); g2.fillRect(11, 0, 1, 11);
        });
    }

    _tileWoodFloor(g) {
        g.fillStyle(0x906828); g.fillRect(0, 0, TS, TS);
        g.fillStyle(0xa88038);
        g.fillRect(1,2,5,1); g.fillRect(9,5,4,1); g.fillRect(3,9,6,1); g.fillRect(11,13,4,1);
        g.fillStyle(0xc09848);
        g.fillRect(2,3,3,1); g.fillRect(10,4,3,1); g.fillRect(4,10,4,1);
        g.fillStyle(0x685018);
        g.fillRect(7,6,2,2); g.fillRect(1,11,2,2);
    }

    _tileJungleEdge(g) {
        g.fillStyle(0x50d818); g.fillRect(0, 0, TS, TS);
        g.fillStyle(0x28b018);
        g.fillRect(0,0,7,5); g.fillRect(10,3,6,4);
        g.fillRect(3,10,5,6); g.fillRect(12,11,4,5);
        g.fillStyle(0x38c828); g.fillRect(6,5,4,4);
        g.fillStyle(0x189008);
        g.fillRect(1,6,2,3); g.fillRect(11,8,2,3);
    }

    _tileSnowEdge(g) {
        g.fillStyle(0x78e830); g.fillRect(0, 0, TS, TS);
        g.fillStyle(0xf0f6ff);
        g.fillRect(0,0,7,5); g.fillRect(9,3,7,5);
        g.fillRect(2,9,5,7); g.fillRect(11,10,5,6);
        g.fillStyle(0xffffff);
        g.fillRect(1,1,3,2); g.fillRect(10,4,4,2);
    }

    _tileMilEdge(g) {
        g.fillStyle(0x78e830); g.fillRect(0, 0, TS, TS);
        g.fillStyle(0xd4a828);
        g.fillRect(0,0,8,6); g.fillRect(8,4,8,5);
        g.fillRect(4,9,5,7); g.fillRect(11,8,5,8);
        g.fillStyle(0xe8bc38);
        g.fillRect(2,2,4,2); g.fillRect(9,6,4,2);
    }

    _tileWaterEdge(g) {
        g.fillStyle(0x28b018); g.fillRect(0, 0, TS, TS);
        g.fillStyle(0x5a6818); g.fillRect(0, 8, TS, TS - 8);
        g.fillStyle(0x0898f8); g.fillRect(0, 14, TS, 2);
        g.fillStyle(0x70d8ff); g.fillRect(3, 14, 3, 1); g.fillRect(9, 15, 4, 1);
    }

    // ─── Player Textures — bold 3D cartoon character ─────────────────────────
    _buildPlayerTextures() {
        const S = 32;
        const g = this.add.graphics();
        const cx = S / 2;
        const cy = S / 2;

        for (const skin of SKINS) {
            g.clear();

            // Long directional drop shadow (southeast — matches tree/object lighting)
            g.fillStyle(0x000000, 0.40);
            g.fillEllipse(cx + 5, cy + 6, S + 4, S * 0.45);

            // Body: dark outline ring
            g.fillStyle(0x080808);
            g.fillCircle(cx, cy, S / 2 - 1);

            // Body: main color
            g.fillStyle(skin.bodyColor);
            g.fillCircle(cx, cy, S / 2 - 3);

            // Body: highlight arc (top-left)
            g.fillStyle(0xffffff, 0.22);
            g.fillCircle(cx - 3, cy - 3, S / 2 - 8);

            // Body: shadow crescent (bottom-right)
            g.fillStyle(0x000000, 0.28);
            g.fillCircle(cx + 3, cy + 3, S / 2 - 6);

            // Re-apply body center to clean up
            g.fillStyle(skin.bodyColor);
            g.fillCircle(cx, cy, S / 2 - 6);

            // Chest armor/vest accent
            g.fillStyle(skin.accentColor);
            g.fillEllipse(cx, cy + 3, S - 14, (S - 14) * 0.55);

            // Vest highlight
            g.fillStyle(0xffffff, 0.20);
            g.fillEllipse(cx - 2, cy + 1, S - 18, (S - 18) * 0.40);

            // Head: dark outline
            g.fillStyle(0x080808);
            g.fillCircle(cx + 5, cy - 4, 8);

            // Head: face
            g.fillStyle(skin.detailColor);
            g.fillCircle(cx + 5, cy - 4, 6);

            // Head: highlight
            g.fillStyle(0xffffff, 0.35);
            g.fillCircle(cx + 3, cy - 6, 3);

            // Helmet / hat brim
            g.fillStyle(skin.accentColor);
            g.fillRect(cx + 0, cy - 9, 11, 3);
            g.fillStyle(0x080808);
            g.fillRect(cx + 0, cy - 10, 11, 2);

            // Gun: dark outline
            g.fillStyle(0x080808);
            g.fillRect(cx + 3, cy - 4, 16, 8);

            // Gun: body
            g.fillStyle(0x282828);
            g.fillRect(cx + 4, cy - 3, 14, 6);

            // Gun: grip / handle
            g.fillStyle(0x404040);
            g.fillRect(cx + 5, cy - 3, 5, 6);

            // Gun: barrel highlight
            g.fillStyle(0x606060);
            g.fillRect(cx + 4, cy - 3, 14, 1);

            // Muzzle flash dot
            g.fillStyle(0xffffff);
            g.fillRect(cx + 16, cy - 2, 3, 4);
            g.fillStyle(0xffdd00);
            g.fillRect(cx + 17, cy - 1, 1, 2);

            g.generateTexture('player_skin_' + skin.id, S, S);
        }

        g.destroy();
    }

    // ─── Gun Textures ─────────────────────────────────────────────────────────
    _buildGunTextures() {
        const g = this.add.graphics();

        // AR
        g.clear();
        g.fillStyle(0x222222); g.fillRect(0, 3, 32, 6);
        g.fillStyle(0x606060); g.fillRect(2, 4, 9, 4);
        g.fillStyle(0x303030); g.fillRect(10, 2, 14, 8);
        g.fillStyle(0x505050); g.fillRect(10, 3, 14, 1);
        g.fillStyle(0x181818); g.fillRect(22, 3, 10, 6);
        g.fillStyle(0x404040); g.fillRect(22, 3, 10, 1);
        g.fillStyle(0x111111); g.fillRect(8, 5, 4, 4);
        g.fillStyle(0xff8800); g.fillRect(12, 6, 2, 2);
        g.generateTexture('gun_ar', 32, 12);

        // Sniper
        g.clear();
        g.fillStyle(0x1a1a28); g.fillRect(0, 2, 14, 4);
        g.fillStyle(0x282840); g.fillRect(12, 1, 16, 6);
        g.fillStyle(0x28a0a0); g.fillRect(16, 0, 8, 8);
        g.fillStyle(0x50d0d0); g.fillRect(17, 1, 6, 1);
        g.fillStyle(0x101020); g.fillRect(26, 3, 22, 2);
        g.fillStyle(0x303050); g.fillRect(26, 3, 22, 1);
        g.fillStyle(0x080810); g.fillRect(46, 3, 2, 2);
        g.generateTexture('gun_sniper', 48, 8);

        // Shotgun
        g.clear();
        g.fillStyle(0x8a4e1a); g.fillRect(0, 2, 12, 10);
        g.fillStyle(0xb06828); g.fillRect(0, 3, 12, 1);
        g.fillStyle(0x603010); g.fillRect(0, 8, 12, 1);
        g.fillStyle(0x404040); g.fillRect(10, 1, 14, 5);
        g.fillStyle(0x404040); g.fillRect(10, 8, 14, 5);
        g.fillStyle(0x686868); g.fillRect(10, 1, 14, 1);
        g.fillStyle(0x686868); g.fillRect(10, 8, 14, 1);
        g.fillStyle(0x202020); g.fillRect(22, 0, 6, 6);
        g.fillStyle(0x202020); g.fillRect(22, 8, 6, 6);
        g.generateTexture('gun_shotgun', 28, 14);

        // Rocket
        g.clear();
        g.fillStyle(0x4a6030); g.fillRect(0, 3, 36, 12);
        g.fillStyle(0x608040); g.fillRect(6, 4, 22, 10);
        g.fillStyle(0x304020); g.fillRect(0, 1, 8, 16);
        g.fillStyle(0x78a060); g.fillRect(28, 2, 8, 14);
        g.fillStyle(0x90c078); g.fillRect(30, 3, 4, 1);
        g.fillStyle(0x304020); g.fillRect(3, 0, 5, 3);
        g.fillStyle(0x304020); g.fillRect(3, 15, 5, 3);
        g.fillStyle(0xff7700); g.fillRect(1, 7, 3, 4);
        g.fillStyle(0xffaa00); g.fillRect(2, 8, 1, 2);
        g.generateTexture('gun_rocket', 36, 18);

        // Minigun
        g.clear();
        g.fillStyle(0x333333); g.fillRect(0, 3, 18, 16);
        g.fillStyle(0x484848); g.fillRect(2, 4, 14, 14);
        g.fillStyle(0x222222); g.fillRect(1, 2, 6, 18);
        g.fillStyle(0x555555); g.fillRect(7, 5, 10, 12);
        g.fillStyle(0x404040); g.fillRect(16, 2, 14, 4);
        g.fillStyle(0x404040); g.fillRect(16, 9, 14, 4);
        g.fillStyle(0x404040); g.fillRect(16, 16, 14, 4);
        g.fillStyle(0x606060); g.fillRect(16, 2, 14, 1);
        g.fillStyle(0x606060); g.fillRect(16, 9, 14, 1);
        g.fillStyle(0x606060); g.fillRect(16, 16, 14, 1);
        g.fillStyle(0xff4400); g.fillRect(15, 3, 1, 3);
        g.fillStyle(0xff4400); g.fillRect(15, 10, 1, 3);
        g.fillStyle(0xff4400); g.fillRect(15, 17, 1, 3);
        g.generateTexture('gun_minigun', 30, 22);

        g.destroy();
    }

    // ─── Bullet ───────────────────────────────────────────────────────────────
    _buildBulletTexture() {
        const g = this.add.graphics();
        g.fillStyle(0xffaa00); g.fillCircle(4, 4, 4);
        g.fillStyle(0xffee88); g.fillCircle(3, 3, 2);
        g.fillStyle(0xffffff); g.fillCircle(2, 2, 1);
        g.generateTexture('bullet', 8, 8);
        g.destroy();
    }

    // ─── Crates ───────────────────────────────────────────────────────────────
    _buildCrateTextures() {
        const g = this.add.graphics();
        const S = 22;

        // Closed crate
        g.clear();
        g.fillStyle(0x111111); g.fillRect(0, 0, S, S);
        g.fillStyle(0xcc9040); g.fillRect(1, 1, S-2, S-2);
        g.fillStyle(0xa07030);
        g.fillRect(1, 6, S-2, 1); g.fillRect(1, 11, S-2, 1); g.fillRect(1, 16, S-2, 1);
        g.fillStyle(0xeaaa50);
        g.fillRect(1, 3, S-2, 1); g.fillRect(1, 8, S-2, 1); g.fillRect(1, 13, S-2, 1);
        g.fillStyle(0xa0a0a0);
        g.fillRect(1, 1, S-2, 2); g.fillRect(1, S-3, S-2, 2);
        g.fillRect(1, 1, 2, S-2); g.fillRect(S-3, 1, 2, S-2);
        g.fillStyle(0xc0c0c0); g.fillRect(10, 1, 2, S-2);
        g.fillStyle(0xe0e0e0); g.fillRect(1, 1, S-2, 1);
        g.fillStyle(0xffee44);
        g.fillRect(10, 7, 2, 1); g.fillRect(9, 8, 1, 1); g.fillRect(12, 8, 1, 1);
        g.fillRect(11, 9, 1, 1); g.fillRect(10, 10, 2, 1); g.fillRect(10, 12, 2, 1);
        g.generateTexture('crate_closed', S, S);

        // Open crate
        g.clear();
        g.fillStyle(0x111111); g.fillRect(0, 0, S, S);
        g.fillStyle(0xcc9040); g.fillRect(1, S/2, S-2, S/2-1);
        g.fillStyle(0xa07030); g.fillRect(1, S/2+4, S-2, 1); g.fillRect(1, S/2+9, S-2, 1);
        g.fillStyle(0xa0a0a0);
        g.fillRect(1, S/2, S-2, 2); g.fillRect(1, S-3, S-2, 2);
        g.fillRect(1, S/2, 2, S/2); g.fillRect(S-3, S/2, 2, S/2);
        g.fillStyle(0x3a2010); g.fillRect(1, 1, S-2, S/2-1);
        g.fillStyle(0x5a3818); g.fillRect(1, 2, S-2, 1); g.fillRect(1, 6, S-2, 1);
        g.fillStyle(0xffcc00); g.fillCircle(S/2, S/2, 4);
        g.fillStyle(0xffee88); g.fillCircle(S/2, S/2, 2);
        g.fillStyle(0xffffff); g.fillCircle(S/2, S/2, 1);
        g.generateTexture('crate_open', S, S);

        g.destroy();
    }

    // ─── Ammo Pack ────────────────────────────────────────────────────────────
    _buildAmmoPackTexture() {
        const g = this.add.graphics();
        g.fillStyle(0x111111); g.fillRect(0, 0, 18, 13);
        g.fillStyle(0xcccc20); g.fillRect(1, 1, 16, 11);
        g.fillStyle(0xeeee40); g.fillRect(2, 2, 14, 2);
        g.fillStyle(0x333310);
        g.fillRect(3, 5, 2, 5); g.fillRect(3, 4, 2, 1);
        g.fillRect(8, 5, 2, 5); g.fillRect(8, 4, 2, 1);
        g.fillRect(13, 5, 2, 5); g.fillRect(13, 4, 2, 1);
        g.fillStyle(0xffff88);
        g.fillRect(3, 5, 2, 1); g.fillRect(8, 5, 2, 1); g.fillRect(13, 5, 2, 1);
        g.generateTexture('ammo_pack', 18, 13);
        g.destroy();
    }

    // ─── Tree — pseudo-3D sphere canopy with visible trunk ───────────────────
    _buildTreeTexture() {
        const g = this.add.graphics();
        const S = 64;
        const cx = 28, cy = 20;

        // Long directional shadow (southeast, as if lit from top-left)
        g.fillStyle(0x000000, 0.38);
        g.fillEllipse(cx + 14, cy + 30, 54, 20);

        // Trunk — drawn BEFORE canopy so canopy overlaps top of trunk
        g.fillStyle(0x2e1406);
        g.fillRect(cx - 5, cy + 14, 11, 22);
        // Trunk highlight (left-face lit side)
        g.fillStyle(0x5a3010);
        g.fillRect(cx - 4, cy + 14, 3, 22);
        // Trunk dark right edge
        g.fillStyle(0x180800);
        g.fillRect(cx + 3, cy + 14, 2, 22);
        // Trunk root flare
        g.fillStyle(0x241008);
        g.fillRect(cx - 7, cy + 30, 15, 6);
        g.fillStyle(0x4a2a10);
        g.fillRect(cx - 6, cy + 30, 4, 4);

        // Shadow zone leaf bumps (bottom-right perimeter — darkest)
        g.fillStyle(0x185008);
        g.fillCircle(cx + 18, cy + 5,  9);
        g.fillCircle(cx + 14, cy + 16, 9);
        g.fillCircle(cx - 13, cy + 14, 8);

        // Dark outline ring
        g.fillStyle(0x071d02);
        g.fillCircle(cx, cy, 23);

        // Lit side leaf bumps (top-left perimeter — medium green)
        g.fillStyle(0x28a010);
        g.fillCircle(cx - 18, cy - 4,  9);
        g.fillCircle(cx - 13, cy - 16, 9);
        g.fillCircle(cx + 2,  cy - 22, 9);
        g.fillCircle(cx + 16, cy - 10, 8);

        // Main canopy sphere — vivid base green
        g.fillStyle(0x32b80e);
        g.fillCircle(cx, cy, 21);

        // Shadow arc on bottom-right (makes sphere pop)
        g.fillStyle(0x1d6e08);
        g.fillCircle(cx + 7, cy + 8, 15);

        // Re-apply main green to blend shadow edge
        g.fillStyle(0x3ac412);
        g.fillCircle(cx - 1, cy - 1, 17);

        // Mid-highlight (upper-left shift for directional light)
        g.fillStyle(0x5ce020);
        g.fillCircle(cx - 4, cy - 5, 12);

        // Inner bright highlight
        g.fillStyle(0x88f040);
        g.fillCircle(cx - 7, cy - 8,  7);

        // Sunlit peak
        g.fillStyle(0xb8ff78);
        g.fillCircle(cx - 10, cy - 11, 3);

        // Specular sparkle
        g.fillStyle(0xe0ffcc);
        g.fillCircle(cx - 11, cy - 13, 1);

        // Edge bump accents (bright side)
        g.fillStyle(0x4cd818);
        g.fillCircle(cx - 16, cy - 6,  6);
        g.fillCircle(cx + 1,  cy - 22, 6);
        g.fillCircle(cx + 14, cy - 11, 6);

        g.generateTexture('tree', S, S);
        g.destroy();
    }

    // ─── Bush — 3D dome clusters with directional shading ────────────────────
    _buildBushTexture() {
        const g = this.add.graphics();
        const S = 34;

        // Drop shadow (southeast)
        g.fillStyle(0x000000, 0.35);
        g.fillEllipse(18, 27, 30, 10);

        // Dark base outlines (give each cluster a bottom visible edge = depth)
        g.fillStyle(0x071d02);
        g.fillCircle(10, 18, 11); g.fillCircle(24, 18, 11);
        g.fillCircle(17, 13, 11); g.fillCircle(17, 20, 8);

        // Main cluster bodies — vivid green
        g.fillStyle(0x38b018);
        g.fillCircle(10, 17, 9); g.fillCircle(24, 17, 9);
        g.fillCircle(17, 12, 9); g.fillCircle(17, 19, 7);

        // Shadow zones (bottom-right of each cluster)
        g.fillStyle(0x1e6a0a);
        g.fillCircle(12, 20, 6); g.fillCircle(26, 20, 6);
        g.fillCircle(19, 16, 6);

        // Re-apply mid green to blend
        g.fillStyle(0x48c820);
        g.fillCircle(9,  15, 7); g.fillCircle(23, 15, 7);
        g.fillCircle(16, 10, 7);

        // Bright lit tops (upper-left of each cluster)
        g.fillStyle(0x70e838);
        g.fillCircle(8,  12, 5); g.fillCircle(22, 12, 5);
        g.fillCircle(15,  8, 5);

        // Highlight peaks
        g.fillStyle(0xaaf060);
        g.fillCircle(7,  10, 3); g.fillCircle(21, 10, 3);
        g.fillCircle(14,  6, 3);

        g.generateTexture('bush', S, S);
        g.destroy();
    }

    // ─── Rock — 3D rounded boulders ──────────────────────────────────────────
    _buildRockTexture() {
        const g = this.add.graphics();
        const S = 36;

        // Southeast drop shadow
        g.fillStyle(0x000000, 0.35);
        g.fillEllipse(20, 29, 32, 12);

        // Dark outlines
        g.fillStyle(0x1a1a18);
        g.fillCircle(12, 16, 13); g.fillCircle(24, 18, 11); g.fillCircle(18, 11, 8);

        // Main rock bodies (warm gray)
        g.fillStyle(0x8c8878);
        g.fillCircle(12, 16, 11);
        g.fillStyle(0x807868); g.fillCircle(24, 18, 9);
        g.fillStyle(0x8a8070); g.fillCircle(18, 11, 6);

        // Shadow zones (bottom-right — each rock gets a dark crescent)
        g.fillStyle(0x4c4840);
        g.fillCircle(14, 20, 7); g.fillCircle(26, 21, 6);

        // Lit faces (upper-left)
        g.fillStyle(0xb4b0a0); g.fillCircle(10, 13, 8);
        g.fillStyle(0xa89c8c); g.fillCircle(22, 15, 7);
        g.fillStyle(0xb0a898); g.fillCircle(16,  9, 5);

        // Highlight
        g.fillStyle(0xd8d0c4); g.fillCircle(8, 11, 5);
        g.fillStyle(0xe8e0d4); g.fillCircle(6,  9, 2);
        g.fillStyle(0xd0c8bc); g.fillCircle(20, 13, 4);
        g.fillStyle(0xe0d8cc); g.fillCircle(19, 12, 2);

        // Specular
        g.fillStyle(0xf8f4ec); g.fillCircle(7, 9, 1);
        g.fillStyle(0xf0ece4); g.fillCircle(20, 12, 1);

        g.generateTexture('rock', S, S);
        g.destroy();
    }

    // ─── Palm Tree — tall curved trunk, fanned fronds ────────────────────────
    _buildPalmTreeTexture() {
        const g = this.add.graphics();
        const S = 60;
        const cx = 30, cy = 26;

        // Extended drop shadow
        g.fillStyle(0x000000, 0.38);
        g.fillEllipse(cx + 12, cy + 22, 44, 16);

        // Curved trunk (leaning right slightly = classic palm)
        g.fillStyle(0x2a1208);
        g.fillRect(cx - 3, cy,     7, 24);
        g.fillRect(cx - 2, cy + 4, 7, 18);  // lean
        // Trunk lit left face
        g.fillStyle(0x7a4a1a);
        g.fillRect(cx - 3, cy,     3, 24);
        // Trunk dark right face
        g.fillStyle(0x3a1e06);
        g.fillRect(cx + 3, cy + 4, 2, 18);
        // Trunk ring details
        g.fillStyle(0x5a3210);
        g.fillRect(cx - 3, cy + 5,  1, 2);
        g.fillRect(cx + 3, cy + 10, 1, 2);
        g.fillRect(cx - 2, cy + 16, 1, 2);
        g.fillStyle(0xb07030);
        g.fillRect(cx - 2, cy, 2, 1);

        // Frond colors
        const fD = 0x0e3008, fM = 0x2e8818, fT = 0x58d030, fH = 0x90f060;

        // Frond — lower left
        g.fillStyle(fD); g.fillRect(cx - 27, cy - 4, 27, 6);
        g.fillStyle(fM);  g.fillRect(cx - 25, cy - 3, 25, 4);
        g.fillStyle(fT);  g.fillRect(cx - 25, cy - 3, 8, 2);
        g.fillStyle(fH);  g.fillRect(cx - 25, cy - 3, 4, 1);

        // Frond — upper left
        g.fillStyle(fD); g.fillRect(cx - 20, cy - 16, 20, 6);
        g.fillStyle(fM);  g.fillRect(cx - 18, cy - 15, 18, 4);
        g.fillStyle(fT);  g.fillRect(cx - 18, cy - 15, 7, 2);
        g.fillStyle(fH);  g.fillRect(cx - 18, cy - 15, 3, 1);

        // Frond — up
        g.fillStyle(fD); g.fillRect(cx - 4, cy - 26, 6, 26);
        g.fillStyle(fM);  g.fillRect(cx - 3, cy - 24, 4, 24);
        g.fillStyle(fT);  g.fillRect(cx - 3, cy - 24, 3, 7);
        g.fillStyle(fH);  g.fillRect(cx - 3, cy - 24, 2, 3);

        // Frond — lower right
        g.fillStyle(fD); g.fillRect(cx + 2, cy - 4, 26, 6);
        g.fillStyle(fM);  g.fillRect(cx + 2, cy - 3, 24, 4);
        g.fillStyle(fT);  g.fillRect(cx + 18, cy - 3, 8, 2);
        g.fillStyle(fH);  g.fillRect(cx + 21, cy - 3, 3, 1);

        // Frond — upper right
        g.fillStyle(fD); g.fillRect(cx + 2, cy - 16, 18, 6);
        g.fillStyle(fM);  g.fillRect(cx + 2, cy - 15, 16, 4);
        g.fillStyle(fT);  g.fillRect(cx + 12, cy - 15, 6, 2);
        g.fillStyle(fH);  g.fillRect(cx + 14, cy - 15, 2, 1);

        // Crown hub
        g.fillStyle(0x111111); g.fillCircle(cx, cy - 1, 5);
        g.fillStyle(0x7a4818); g.fillCircle(cx - 1, cy - 2, 4);
        g.fillStyle(0xa06228); g.fillCircle(cx - 2, cy - 3, 2);
        g.fillStyle(0xc88040); g.fillCircle(cx - 2, cy - 3, 1);

        g.generateTexture('palm_tree', S, S);
        g.destroy();
    }

    // ─── Snow Pine — layered tiers with heavy snow caps ───────────────────────
    _buildSnowPineTexture() {
        const g = this.add.graphics();
        const S = 56;
        const cx = 28, cy = 24;

        // Drop shadow
        g.fillStyle(0x000000, 0.30);
        g.fillEllipse(cx + 4, cy + 24, 32, 12);

        // Trunk
        g.fillStyle(0x3e1e08);
        g.fillRect(cx - 3, cy + 12, 6, 18);
        g.fillStyle(0x7a4820);
        g.fillRect(cx - 2, cy + 12, 2, 18);
        g.fillStyle(0x221004);
        g.fillRect(cx + 2, cy + 12, 1, 18);

        // Tier outlines (darkest — give each tier a south face feel)
        g.fillStyle(0x081808);
        g.fillTriangle(cx, cy - 20, cx - 16, cy + 4,  cx + 16, cy + 4);
        g.fillTriangle(cx, cy - 12, cx - 18, cy + 10, cx + 18, cy + 10);

        // Dark tier bodies
        g.fillStyle(0x1a5818);
        g.fillTriangle(cx, cy - 18, cx - 14, cy + 2,  cx + 14, cy + 2);
        g.fillTriangle(cx, cy - 10, cx - 16, cy + 8,  cx + 16, cy + 8);

        // Mid green (main fill)
        g.fillStyle(0x338828);
        g.fillTriangle(cx, cy - 16, cx - 12, cy,     cx + 12, cy);
        g.fillTriangle(cx, cy - 8,  cx - 14, cy + 6, cx + 14, cy + 6);

        // Bright center highlight
        g.fillStyle(0x50b038);
        g.fillTriangle(cx, cy - 14, cx - 8, cy - 2, cx + 8, cy - 2);
        g.fillTriangle(cx, cy - 6,  cx - 10, cy + 4, cx + 10, cy + 4);

        // Snow cap layers
        g.fillStyle(0xd8e8f8);
        g.fillRect(cx - 11, cy - 2,  9, 4); g.fillRect(cx + 2,  cy - 2,  9, 4);
        g.fillRect(cx - 13, cy + 4,  8, 4); g.fillRect(cx + 5,  cy + 4,  8, 4);
        g.fillRect(cx - 5,  cy - 19, 9, 4);

        // Snow highlights
        g.fillStyle(0xffffff);
        g.fillRect(cx - 10, cy - 2, 5, 1); g.fillRect(cx + 5,  cy - 2, 4, 1);
        g.fillRect(cx - 12, cy + 4, 5, 1); g.fillRect(cx + 6,  cy + 4, 4, 1);
        g.fillRect(cx - 4,  cy - 19, 5, 1);

        // Snow shadow edge (underside of snow cap — slight blue shadow)
        g.fillStyle(0x98b8d8);
        g.fillRect(cx - 11, cy + 1, 9, 1); g.fillRect(cx + 2,  cy + 1, 9, 1);
        g.fillRect(cx - 13, cy + 7, 8, 1); g.fillRect(cx + 5,  cy + 7, 8, 1);

        g.generateTexture('snow_pine', S, S);
        g.destroy();
    }

    // ─── Jungle Bush — lush 3D dome clusters ────────────────────────────────
    _buildJungleBushTexture() {
        const g = this.add.graphics();
        const S = 40;

        // Southeast drop shadow
        g.fillStyle(0x000000, 0.38);
        g.fillEllipse(22, 32, 36, 12);

        // Dark outlines
        g.fillStyle(0x041004);
        g.fillCircle(12, 22, 13); g.fillCircle(28, 22, 13);
        g.fillCircle(20, 16, 13); g.fillCircle(20, 24, 10);

        // Main bodies — deep jungle green
        g.fillStyle(0x168010);
        g.fillCircle(12, 21, 11); g.fillCircle(28, 21, 11);
        g.fillCircle(20, 15, 11); g.fillCircle(20, 23, 9);

        // Shadow zones (bottom-right crescent)
        g.fillStyle(0x0a4808);
        g.fillCircle(14, 25, 8); g.fillCircle(30, 25, 8);
        g.fillCircle(22, 19, 8);

        // Re-apply main to blend
        g.fillStyle(0x24a01a);
        g.fillCircle(11, 19, 9); g.fillCircle(27, 19, 9);
        g.fillCircle(19, 13, 9);

        // Bright highlight clusters (upper-left)
        g.fillStyle(0x48c030);
        g.fillCircle(9, 16, 6); g.fillCircle(25, 16, 6);
        g.fillCircle(17, 10, 6);

        // Top highlights
        g.fillStyle(0x78e858);
        g.fillCircle(8, 13, 4); g.fillCircle(24, 13, 4);
        g.fillCircle(16,  8, 4);

        // Specular peaks
        g.fillStyle(0xb0ff90);
        g.fillCircle(7, 11, 2); g.fillCircle(23, 11, 2);
        g.fillCircle(15,  6, 2);

        g.generateTexture('jungle_bush', S, S);
        g.destroy();
    }

    // ─── Snow Bush — snow-capped dome clusters ────────────────────────────────
    _buildSnowBushTexture() {
        const g = this.add.graphics();
        const S = 34;

        // Drop shadow
        g.fillStyle(0x000000, 0.25);
        g.fillEllipse(18, 26, 28, 9);

        // Dark base outlines
        g.fillStyle(0x181c18);
        g.fillCircle(10, 18, 10); g.fillCircle(24, 18, 10); g.fillCircle(17, 14, 10);

        // Snow-covered body (bluish-white)
        g.fillStyle(0xb0c4e0);
        g.fillCircle(10, 17, 8); g.fillCircle(24, 17, 8); g.fillCircle(17, 13, 8);

        // Shadow zone (bottom-right — pale blue-gray for cold shadow)
        g.fillStyle(0x7090b8);
        g.fillCircle(12, 21, 6); g.fillCircle(26, 21, 6); g.fillCircle(19, 17, 6);

        // Main snow-white body
        g.fillStyle(0xdceeff);
        g.fillCircle(9, 15, 7); g.fillCircle(23, 15, 7); g.fillCircle(16, 11, 7);

        // Highlight (brilliant white top-left)
        g.fillStyle(0xeef6ff);
        g.fillCircle(8, 13, 5); g.fillCircle(22, 13, 5); g.fillCircle(15,  9, 5);

        g.fillStyle(0xffffff);
        g.fillCircle(7, 11, 3); g.fillCircle(21, 11, 3); g.fillCircle(14,  7, 3);

        // Specular
        g.fillStyle(0xffffff);
        g.fillCircle(6, 10, 1); g.fillCircle(20, 10, 1); g.fillCircle(13, 6, 1);

        g.generateTexture('snow_bush', S, S);
        g.destroy();
    }

    // ─── Cover Object Textures ────────────────────────────────────────────────
    _buildCoverObjectTextures() {
        const g = this.add.graphics();

        // Sandbag — 3D stacked bags with south face
        g.clear();
        // Drop shadow
        g.fillStyle(0x000000, 0.32); g.fillRect(3, 16, 20, 4);
        // South face (darkest — "front wall" visible at angle)
        g.fillStyle(0x5a3a10); g.fillRect(0, 11, 22, 9);
        g.fillStyle(0x000000, 0.45); g.fillRect(0, 15, 22, 5);
        // Top outline
        g.fillStyle(0x111111); g.fillRect(0, 0, 22, 12);
        // Top face
        g.fillStyle(0xd8a848); g.fillRect(1, 1, 20, 10);
        // Bag divisions
        g.fillStyle(0xecc060);
        g.fillRect(2, 1, 8, 4); g.fillRect(12, 1, 8, 4);
        g.fillRect(2, 6, 8, 4); g.fillRect(12, 6, 8, 4);
        // Bag seams
        g.fillStyle(0x886630);
        g.fillRect(11, 1, 1, 10); g.fillRect(1, 5, 20, 1);
        // Highlights
        g.fillStyle(0xffd070);
        g.fillRect(2, 1, 8, 1); g.fillRect(12, 1, 8, 1);
        g.fillRect(2, 6, 8, 1); g.fillRect(12, 6, 8, 1);
        g.generateTexture('sandbag', 22, 20);

        // Container — full 3D with roof + south face
        g.clear();
        // Drop shadow
        g.fillStyle(0x000000, 0.32); g.fillRect(4, 30, 48, 6);
        // South face (tall dark front wall)
        g.fillStyle(0x1e3818); g.fillRect(0, 20, 50, 14);
        g.fillStyle(0x000000, 0.50); g.fillRect(0, 28, 50, 6);
        // Roof outline
        g.fillStyle(0x111111); g.fillRect(0, 0, 50, 22);
        // Roof
        g.fillStyle(0x3a6030); g.fillRect(1, 1, 48, 20);
        g.fillStyle(0x508048); g.fillRect(2, 2, 46, 18);
        // Corrugated ribs
        g.fillStyle(0x2a4a22);
        for (let x = 8; x < 50; x += 8) g.fillRect(x, 1, 2, 20);
        // Roof highlight
        g.fillStyle(0x78b868); g.fillRect(1, 1, 48, 2);
        // Rust spots
        g.fillStyle(0xa85820);
        g.fillRect(7, 9, 3, 3); g.fillRect(34, 15, 4, 3); g.fillRect(22, 6, 2, 4);
        // Door handle
        g.fillStyle(0xb0b0b0);
        g.fillRect(24, 9, 4, 6); g.fillRect(25, 8, 2, 8);
        // South face details (doors show on face)
        g.fillStyle(0x2e5028); g.fillRect(4, 22, 42, 6);
        g.fillStyle(0x486040); g.fillRect(5, 22, 20, 4); g.fillRect(27, 22, 18, 4);
        g.generateTexture('container', 50, 36);

        // Car wreck — 3D with visible side/south face
        g.clear();
        // Drop shadow
        g.fillStyle(0x000000, 0.35); g.fillRect(4, 26, 36, 6);
        // South face (car body side wall visible at angle)
        g.fillStyle(0x8a1818); g.fillRect(0, 18, 38, 14);
        g.fillStyle(0x000000, 0.50); g.fillRect(0, 26, 38, 6);
        // Top outline
        g.fillStyle(0x111111); g.fillRect(0, 0, 38, 20);
        // Body top
        g.fillStyle(0xdd3030); g.fillRect(2, 3, 34, 15);
        // Windshield / roof
        g.fillStyle(0x441010); g.fillRect(9, 4, 20, 7);
        g.fillStyle(0x222240); g.fillRect(10, 5, 8, 4); g.fillRect(21, 5, 8, 4);
        // Body highlight
        g.fillStyle(0xff5050); g.fillRect(2, 3, 34, 1);
        // Wheels (dark circles at corners)
        g.fillStyle(0x181818);
        g.fillRect(0, 1, 7, 8); g.fillRect(31, 1, 7, 8);
        g.fillRect(0, 11, 7, 8); g.fillRect(31, 11, 7, 8);
        g.fillStyle(0x505050);
        g.fillCircle(3, 5, 3); g.fillCircle(34, 5, 3);
        g.fillCircle(3, 15, 3); g.fillCircle(34, 15, 3);
        g.fillStyle(0x808080);
        g.fillCircle(3, 5, 1); g.fillCircle(34, 5, 1);
        g.fillCircle(3, 15, 1); g.fillCircle(34, 15, 1);
        // Rust/damage
        g.fillStyle(0x882020);
        g.fillRect(11, 13, 5, 3); g.fillRect(26, 4, 3, 3);
        // Headlights
        g.fillStyle(0xffee00);
        g.fillRect(31, 4, 4, 3); g.fillRect(31, 13, 4, 3);
        g.fillStyle(0xffffff); g.fillRect(32, 4, 2, 1);
        g.generateTexture('car_wreck', 38, 32);

        // Barrel — 3D cylinder with top + south face
        g.clear();
        // Shadow
        g.fillStyle(0x000000, 0.32); g.fillRect(3, 26, 16, 5);
        // South face (curved front of cylinder)
        g.fillStyle(0x5c3018); g.fillRect(0, 14, 17, 14);
        g.fillStyle(0x000000, 0.55); g.fillRect(0, 22, 17, 6);
        // Top outline
        g.fillStyle(0x111111); g.fillRect(0, 0, 17, 16);
        // Top body
        g.fillStyle(0x8a5830); g.fillRect(1, 1, 15, 13);
        g.fillStyle(0xbb7840); g.fillRect(2, 2, 13, 11);
        // Metal bands
        g.fillStyle(0x505050);
        g.fillRect(1, 5, 15, 2); g.fillRect(1, 10, 15, 2);
        g.fillStyle(0x909090);
        g.fillRect(1, 5, 15, 1); g.fillRect(1, 10, 15, 1);
        // Lit side
        g.fillStyle(0xdd9050); g.fillRect(2, 2, 3, 11);
        // Labels/rust
        g.fillStyle(0xcc4010); g.fillRect(7, 4, 4, 5);
        g.fillStyle(0x707070); g.fillRect(2, 1, 13, 3);
        g.fillStyle(0x909090); g.fillRect(2, 1, 13, 1);
        // South face band detail
        g.fillStyle(0x404040); g.fillRect(1, 16, 15, 2); g.fillRect(1, 21, 15, 1);
        g.generateTexture('barrel', 17, 28);

        // Dumpster — 3D box with lid top + tall south face
        g.clear();
        // Shadow
        g.fillStyle(0x000000, 0.32); g.fillRect(4, 26, 24, 5);
        // South face
        g.fillStyle(0x0a5a14); g.fillRect(0, 14, 26, 14);
        g.fillStyle(0x000000, 0.55); g.fillRect(0, 22, 26, 6);
        // Face ribs
        g.fillStyle(0x0e7820); g.fillRect(2, 15, 22, 4); g.fillRect(2, 21, 22, 2);
        // Top outline
        g.fillStyle(0x111111); g.fillRect(0, 0, 26, 16);
        // Lid top
        g.fillStyle(0x18a028); g.fillRect(1, 1, 24, 13);
        g.fillStyle(0x30cc40); g.fillRect(2, 2, 22, 11);
        g.fillStyle(0x0c6018); g.fillRect(2, 1, 22, 4);
        g.fillStyle(0x50e060); g.fillRect(2, 1, 22, 1);
        g.fillStyle(0x108020);
        g.fillRect(9, 5, 1, 9); g.fillRect(17, 5, 1, 9);
        g.fillStyle(0xc0c0c0);
        g.fillRect(3, 6, 5, 2); g.fillRect(18, 6, 5, 2);
        g.fillStyle(0xff6010);
        g.fillRect(11, 7, 5, 4);
        g.generateTexture('dumpster', 26, 28);

        // Fence
        g.clear();
        g.fillStyle(0x111111); g.fillRect(0, 0, 32, 8);
        g.fillStyle(0xa07838); g.fillRect(1, 1, 30, 6);
        g.fillStyle(0x6a4818);
        g.fillRect(1, 1, 4, 6); g.fillRect(14, 1, 4, 6); g.fillRect(27, 1, 4, 6);
        g.fillStyle(0xd09848);
        g.fillRect(5, 2, 9, 2); g.fillRect(18, 2, 9, 2);
        g.fillRect(5, 5, 9, 2); g.fillRect(18, 5, 9, 2);
        g.fillStyle(0xf0bb58);
        g.fillRect(5, 2, 9, 1); g.fillRect(18, 2, 9, 1);
        g.fillRect(5, 5, 9, 1); g.fillRect(18, 5, 9, 1);
        g.fillStyle(0x8a5828);
        g.fillRect(1, 1, 4, 1); g.fillRect(14, 1, 4, 1); g.fillRect(27, 1, 4, 1);
        g.generateTexture('fence_h', 32, 8);

        g.destroy();
    }
}
