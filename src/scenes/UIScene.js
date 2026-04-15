import * as Phaser from 'phaser';
import { MAP_PIXEL_W, MAP_PIXEL_H } from '../constants.js';
import { GUN_CONFIG } from '../config/GunConfig.js';

const W = 800;
const H = 600;
const MINIMAP_W = 140;
const MINIMAP_H = 105;
const MINIMAP_X = W - MINIMAP_W - 10;
const MINIMAP_Y = 10;
const MAP_SCALE_X = MINIMAP_W / MAP_PIXEL_W;
const MAP_SCALE_Y = MINIMAP_H / MAP_PIXEL_H;

export class UIScene extends Phaser.Scene {
    constructor() {
        super('UIScene');
    }

    create() {
        this.gameScene = this.scene.get('GameScene');

        // Listen for gun/ammo changes
        this.gameScene.events.on('gun-changed', (gunKey) => this._onGunChanged(gunKey), this);
        this.gameScene.events.on('ammo-changed', () => this._onAmmoChanged(), this);

        // --- HP / Shield bars ---
        this._barsBg = this.add.graphics();
        this._bars = this.add.graphics();

        // --- Gun display ---
        this._gunIcon = this.add.image(60, H - 60, 'gun_ar').setVisible(false).setScale(1.6).setDepth(5);
        this._gunName = this.add.text(110, H - 75, '', {
            fontSize: '12px', fontFamily: 'monospace', color: '#ffffff',
        }).setDepth(5);
        this._ammoText = this.add.text(110, H - 58, '', {
            fontSize: '14px', fontFamily: 'monospace', color: '#ffdd44',
        }).setDepth(5);
        this._noGunText = this.add.text(20, H - 65, 'No weapon\nWalk over a gun to pick it up\nor press F near a gun', {
            fontSize: '11px', fontFamily: 'monospace', color: '#888899',
        }).setDepth(5);

        // --- Zone timer ---
        this._zoneText = this.add.text(W / 2, 14, '', {
            fontSize: '14px', fontFamily: 'monospace', color: '#ffffff',
            stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5, 0).setDepth(5);

        // --- Minimap ---
        this._minimapBg = this.add.graphics();
        this._minimapBg.fillStyle(0x000000, 0.7);
        this._minimapBg.fillRect(MINIMAP_X - 2, MINIMAP_Y - 2, MINIMAP_W + 4, MINIMAP_H + 4);
        this._minimapBg.lineStyle(1, 0x555566);
        this._minimapBg.strokeRect(MINIMAP_X - 2, MINIMAP_Y - 2, MINIMAP_W + 4, MINIMAP_H + 4);
        this._minimap = this.add.graphics().setDepth(6);

        // --- Static bar backgrounds ---
        this._barsBg.fillStyle(0x000000, 0.65);
        this._barsBg.fillRect(W / 2 - 102, H - 58, 204, 50);

        // Refresh gun display on start
        this._onGunChanged(this.gameScene.player?.currentGun ?? null);
    }

    update() {
        const gs = this.gameScene;
        if (!gs?.player) return;

        this._drawBars(gs.player);
        this._drawMinimap(gs);
        this._updateZoneText(gs);
    }

    shutdown() {
        if (this.gameScene) {
            this.gameScene.events.off('gun-changed', null, this);
            this.gameScene.events.off('ammo-changed', null, this);
        }
    }

    _drawBars(player) {
        const g = this._bars;
        g.clear();

        const bx = W / 2 - 100;
        const shieldY = H - 52;
        const hpY = H - 36;
        const bw = 200;

        // Shield bar bg
        g.fillStyle(0x222244);
        g.fillRect(bx, shieldY, bw, 12);
        // Shield bar fill
        const shieldPct = Math.max(0, player.shield / player.maxShield);
        g.fillStyle(0x44aaff);
        g.fillRect(bx, shieldY, bw * shieldPct, 12);
        // Shield label
        g.lineStyle(1, 0x4466aa);
        g.strokeRect(bx, shieldY, bw, 12);

        // HP bar bg
        g.fillStyle(0x442222);
        g.fillRect(bx, hpY, bw, 16);
        // HP bar fill — green → yellow → red
        const hpPct = Math.max(0, player.hp / player.maxHp);
        const hpColor = hpPct > 0.5 ? 0x44dd44 : hpPct > 0.25 ? 0xdddd44 : 0xdd4444;
        g.fillStyle(hpColor);
        g.fillRect(bx, hpY, bw * hpPct, 16);
        g.lineStyle(1, 0x884444);
        g.strokeRect(bx, hpY, bw, 16);

        // Labels
        if (!this._hpLabel) {
            this._hpLabel = this.add.text(bx - 28, hpY + 2, 'HP', {
                fontSize: '11px', fontFamily: 'monospace', color: '#ff8888',
            });
            this._shieldLabel = this.add.text(bx - 38, shieldY + 1, 'SHLD', {
                fontSize: '9px', fontFamily: 'monospace', color: '#88aaff',
            });
        }
    }

    _drawMinimap(gs) {
        const g = this._minimap;
        g.clear();

        // Background
        g.fillStyle(0x111122, 0.9);
        g.fillRect(MINIMAP_X, MINIMAP_Y, MINIMAP_W, MINIMAP_H);

        // Zone circle
        if (gs.zoneSystem) {
            const zs = gs.zoneSystem;
            const cx = MINIMAP_X + zs.centerX * MAP_SCALE_X;
            const cy = MINIMAP_Y + zs.centerY * MAP_SCALE_Y;
            const r = zs.currentRadius * MAP_SCALE_X;
            g.lineStyle(1, 0xffffff, 0.8);
            g.strokeCircle(cx, cy, r);
            // Danger zone tint
            g.fillStyle(0xff0000, 0.08);
            g.fillRect(MINIMAP_X, MINIMAP_Y, MINIMAP_W, MINIMAP_H);
            // Re-clear inside safe zone
            g.fillStyle(0x111122, 0.0);
            // (we just overlay — good enough at minimap scale)
        }

        // Player dot
        if (gs.player) {
            const px = MINIMAP_X + gs.player.x * MAP_SCALE_X;
            const py = MINIMAP_Y + gs.player.y * MAP_SCALE_Y;
            g.fillStyle(0xffffff);
            g.fillCircle(px, py, 3);
        }

        // Minimap border
        g.lineStyle(1, 0x444466);
        g.strokeRect(MINIMAP_X, MINIMAP_Y, MINIMAP_W, MINIMAP_H);
    }

    _updateZoneText(gs) {
        if (!gs.zoneSystem) return;
        const text = gs.zoneSystem.getTimerText();
        const warning = gs.zoneSystem.isWarning();
        this._zoneText.setText(text);
        this._zoneText.setColor(warning ? '#ff8844' : '#ffffff');
    }

    _onGunChanged(gunKey) {
        if (!gunKey) {
            this._gunIcon.setVisible(false);
            this._gunName.setText('');
            this._ammoText.setText('');
            this._noGunText.setVisible(true);
            return;
        }
        this._noGunText.setVisible(false);
        this._gunIcon.setTexture('gun_' + gunKey).setVisible(true);
        const cfg = GUN_CONFIG[gunKey];
        this._gunName.setText(cfg.displayName);
        this._onAmmoChanged();
    }

    _onAmmoChanged() {
        const gs = this.gameScene;
        if (!gs?.player?.currentGun) return;
        const gunKey = gs.player.currentGun;
        const cfg = GUN_CONFIG[gunKey];
        const ammo = gs.player.ammo[cfg.ammoType] ?? 0;
        this._ammoText.setText(`${ammo} / ${cfg.magazineSize}`);
    }
}
