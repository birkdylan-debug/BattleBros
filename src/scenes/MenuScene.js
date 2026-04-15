import * as Phaser from 'phaser';
import { SKINS } from '../config/SkinConfig.js';

const W = 800;
const H = 600;

// Particle palette (forest greens, desert yellows, city grays, blues)
const PARTICLE_COLORS = [
    0x3a7d44, 0x5dc45d, 0xc8a850, 0xe8d48a,
    0x909090, 0x4488ff, 0xcc2222, 0x44cc44,
];

export class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
        this.selectedSkinId = 0;
        this._particles = [];
        this._settingsOverlay = null;
    }

    create() {
        // Restore previously selected skin
        const savedSkin = this.registry.get('skinId');
        if (savedSkin !== undefined) this.selectedSkinId = savedSkin;

        this._createParticles();
        this._createTitle();
        this._createSkinSelector();
        this._createButtons();
    }

    update(delta) {
        this._updateParticles(delta);
    }

    _createParticles() {
        this._particles = [];
        for (let i = 0; i < 50; i++) {
            const circle = this.add.arc(
                Phaser.Math.Between(0, W),
                Phaser.Math.Between(0, H),
                Phaser.Math.Between(2, 7),
                0, 360,
                false,
                Phaser.Utils.Array.GetRandom(PARTICLE_COLORS),
                Phaser.Math.FloatBetween(0.2, 0.6)
            );
            this._particles.push({
                obj: circle,
                vx: Phaser.Math.FloatBetween(-25, 25),
                vy: Phaser.Math.FloatBetween(-20, 20),
            });
        }
    }

    _updateParticles(delta) {
        const dt = delta / 1000;
        for (const p of this._particles) {
            p.obj.x += p.vx * dt;
            p.obj.y += p.vy * dt;
            if (p.obj.x < -10) p.obj.x = W + 10;
            if (p.obj.x > W + 10) p.obj.x = -10;
            if (p.obj.y < -10) p.obj.y = H + 10;
            if (p.obj.y > H + 10) p.obj.y = -10;
        }
    }

    _createTitle() {
        // Dark background
        this.add.rectangle(W / 2, H / 2, W, H, 0x0a0a1a, 0.85);

        this.add.text(W / 2, 80, 'BATTLE ZONE', {
            fontSize: '52px',
            fontFamily: 'monospace',
            color: '#ffffff',
            stroke: '#ff4400',
            strokeThickness: 6,
            shadow: { blur: 15, color: '#ff4400', fill: true },
        }).setOrigin(0.5);

        this.add.text(W / 2, 130, 'Top-Down Battle Royale', {
            fontSize: '16px',
            fontFamily: 'monospace',
            color: '#aaaacc',
        }).setOrigin(0.5);
    }

    _createSkinSelector() {
        const startY = 220;
        const labelY = startY - 20;
        const skinW = 54;
        const totalW = skinW * SKINS.length;
        const startX = W / 2 - totalW / 2;

        this.add.text(W / 2, labelY, 'SELECT SKIN', {
            fontSize: '13px',
            fontFamily: 'monospace',
            color: '#888899',
        }).setOrigin(0.5);

        this._skinGraphics = [];

        for (const skin of SKINS) {
            const sx = startX + skin.id * skinW + 20;
            const sy = startY + 30;

            // Mini player preview
            const g = this.add.graphics();
            this._drawMiniPlayer(g, sx, sy, skin);
            this._skinGraphics.push(g);

            // Skin name below
            this.add.text(sx, sy + 28, skin.name.split(' ')[0], {
                fontSize: '8px',
                fontFamily: 'monospace',
                color: '#888899',
            }).setOrigin(0.5);

            // Make clickable
            const hitzone = this.add.rectangle(sx, sy, 40, 50, 0x000000, 0)
                .setInteractive({ useHandCursor: true });
            hitzone.on('pointerup', () => {
                this.selectedSkinId = skin.id;
                this._refreshSkinHighlights();
            });
        }

        // Selection highlight container (Graphics layer drawn last)
        this._selectionHighlight = this.add.graphics();
        this._refreshSkinHighlights();
    }

    _drawMiniPlayer(g, cx, cy, skin) {
        const s = 18;
        g.clear();
        g.fillStyle(skin.bodyColor);
        g.fillRect(cx - s / 2, cy - s / 2, s, s);
        g.fillStyle(skin.accentColor);
        g.fillRect(cx - s / 2, cy, s, s / 2 - 1);
        g.fillStyle(skin.detailColor);
        g.fillTriangle(
            cx + s / 2, cy,
            cx + 1, cy - 5,
            cx + 1, cy + 5
        );
    }

    _refreshSkinHighlights() {
        const g = this._selectionHighlight;
        g.clear();
        const skinW = 54;
        const totalW = skinW * SKINS.length;
        const startX = W / 2 - totalW / 2;
        const sy = 250;

        const sx = startX + this.selectedSkinId * skinW + 20;
        g.lineStyle(2, 0xffffff, 1);
        g.strokeRect(sx - 22, sy - 12, 44, 52);

        // Skin name display
        if (this._skinNameText) this._skinNameText.destroy();
        this._skinNameText = this.add.text(W / 2, 315, SKINS[this.selectedSkinId].name, {
            fontSize: '14px',
            fontFamily: 'monospace',
            color: '#ffffff',
        }).setOrigin(0.5);
    }

    _createButtons() {
        const btnStyle = (color) => ({
            fontSize: '22px',
            fontFamily: 'monospace',
            color,
            backgroundColor: '#11112299',
            padding: { x: 28, y: 12 },
            stroke: color,
            strokeThickness: 1,
        });

        // PLAY button
        const playBtn = this.add.text(W / 2, 390, '▶  PLAY', btnStyle('#44ff44'))
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        playBtn.on('pointerover', () => playBtn.setStyle({ color: '#aaffaa' }));
        playBtn.on('pointerout', () => playBtn.setStyle({ color: '#44ff44' }));
        playBtn.on('pointerup', () => {
            this.registry.set('skinId', this.selectedSkinId);
            this.scene.start('GameScene', { skinId: this.selectedSkinId });
        });

        // SETTINGS button
        const settBtn = this.add.text(W / 2, 455, '⚙  SETTINGS', btnStyle('#8888cc'))
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        settBtn.on('pointerover', () => settBtn.setStyle({ color: '#bbbbff' }));
        settBtn.on('pointerout', () => settBtn.setStyle({ color: '#8888cc' }));
        settBtn.on('pointerup', () => this._showSettings());

        // Controls hint
        this.add.text(W / 2, 560, 'WASD Move  |  Mouse Aim  |  Click Shoot  |  F Pick up gun', {
            fontSize: '11px',
            fontFamily: 'monospace',
            color: '#555566',
        }).setOrigin(0.5);
    }

    _showSettings() {
        if (this._settingsOverlay) return;

        const overlay = this.add.container(0, 0);
        const bg = this.add.rectangle(W / 2, H / 2, 400, 300, 0x111122, 0.97)
            .setStrokeStyle(2, 0x4444aa);
        const title = this.add.text(W / 2, H / 2 - 110, 'SETTINGS', {
            fontSize: '20px', fontFamily: 'monospace', color: '#ffffff',
        }).setOrigin(0.5);
        const body = this.add.text(W / 2, H / 2 - 20,
            'Controls:\nWASD — Move\nMouse — Aim\nLeft Click — Shoot\nF — Pick up gun\n\nMore settings coming soon.',
            { fontSize: '13px', fontFamily: 'monospace', color: '#aaaacc', align: 'center' }
        ).setOrigin(0.5);
        const closeBtn = this.add.text(W / 2, H / 2 + 110, '[ CLOSE ]', {
            fontSize: '15px', fontFamily: 'monospace', color: '#ff8888',
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        closeBtn.on('pointerup', () => {
            overlay.destroy();
            this._settingsOverlay = null;
        });

        overlay.add([bg, title, body, closeBtn]);
        this._settingsOverlay = overlay;
    }
}
