import * as Phaser from 'phaser';
import { MAP, MAP_PIXEL_W, MAP_PIXEL_H, BULLET_POOL_SIZE, ROCKET_POOL_SIZE } from '../constants.js';
import { buildMap } from '../map/MapBuilder.js';
import { getLootSpawnPoints, getCratePositions, getTreePositions, getBushPositions, getRockPositions, getCoverObjectPositions } from '../map/DesignedMap.js';
import { Player } from '../entities/Player.js';
import { Bullet } from '../entities/Bullet.js';
import { Rocket } from '../entities/Rocket.js';
import { Pickup } from '../entities/Pickup.js';
import { Crate } from '../entities/Crate.js';
import { ZoneSystem } from '../systems/ZoneSystem.js';
import { BushSystem } from '../systems/BushSystem.js';
import { GUN_CONFIG, AMMO_PACK_AMOUNTS } from '../config/GunConfig.js';

const TILE_SIZE = MAP.TILE_SIZE;
// Spawn at map center (col 250, row 190)
const SPAWN_X = 250 * TILE_SIZE;
const SPAWN_Y = 190 * TILE_SIZE;

export class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    init(data) {
        this.skinId = data?.skinId ?? 0;
        this._startTime = 0;
        this._damageDealt = 0;
        this._lastFireTime = {};
    }

    create() {
        this._startTime = this.time.now;

        // --- Map ---
        const { map, layer } = buildMap(this);
        this._layer = layer;

        // --- Player ---
        this.player = new Player(this, SPAWN_X, SPAWN_Y, this.skinId);

        // --- Bullet pools ---
        this.bullets = this.physics.add.group({
            classType: Bullet,
            maxSize: BULLET_POOL_SIZE,
            runChildUpdate: false,
        });
        this.rockets = this.physics.add.group({
            classType: Rocket,
            maxSize: ROCKET_POOL_SIZE,
            runChildUpdate: false,
        });

        // --- Loot ---
        this.pickups = this.add.group();
        this.crateGroup = this.add.group();
        this.ammoPacks = this.add.group();

        this._spawnLoot();
        this._spawnCrates();
        this._spawnAmmoPacks();

        // --- Cover objects (static physics bodies) ---
        this.coverGroup = this.physics.add.staticGroup();
        this._spawnCoverObjects();

        // --- Decorative objects + bush group ---
        this.bushGroup = this.add.group();
        this._spawnDecorativeObjects();

        // --- Bush stealth system ---
        this.bushSystem = new BushSystem(this, this.bushGroup);

        // --- Physics colliders ---
        this.physics.add.collider(this.player, layer);
        this.physics.add.collider(this.bullets, layer, (bullet) => bullet.deactivate());
        this.physics.add.collider(this.rockets, layer, (rocket) => rocket.explode());
        this.physics.add.collider(this.player, this.coverGroup);
        this.physics.add.collider(this.bullets, this.coverGroup, (bullet) => bullet.deactivate());
        this.physics.add.collider(this.rockets, this.coverGroup, (rocket) => rocket.explode());

        // --- Pickup overlaps ---
        this.physics.add.overlap(this.player, this.pickups, (player, pickup) => {
            this._tryPickupGun(pickup);
        });
        this.physics.add.overlap(this.player, this.crateGroup, (player, crate) => {
            crate.open(player, (x, y, gunKey) => this._spawnPickup(x, y, gunKey));
        });
        this.physics.add.overlap(this.player, this.ammoPacks, (player, pack) => {
            this._pickupAmmo(pack);
        });

        // --- Camera ---
        this.cameras.main.setBounds(0, 0, MAP_PIXEL_W, MAP_PIXEL_H);
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

        // --- Screen vignette (dark corners / edges) ---
        this._buildVignette();

        // --- Animated water tile list ---
        this._waterTiles = [];
        this._layer.forEachTile(tile => {
            if (tile.index === 16) this._waterTiles.push(tile); // TILE.WATER = 16
        });

        // --- Zone overlay ---
        this.zoneOverlay = this.add.graphics().setDepth(10).setScrollFactor(0);
        this.zoneBorder  = this.add.graphics().setDepth(11);

        this.zoneSystem = new ZoneSystem(this, this.zoneOverlay, this.zoneBorder);

        // --- Input ---
        this.cursors = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.UP,
            down: Phaser.Input.Keyboard.KeyCodes.DOWN,
            left: Phaser.Input.Keyboard.KeyCodes.LEFT,
            right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
            w: Phaser.Input.Keyboard.KeyCodes.W,
            a: Phaser.Input.Keyboard.KeyCodes.A,
            s: Phaser.Input.Keyboard.KeyCodes.S,
            d: Phaser.Input.Keyboard.KeyCodes.D,
            f: Phaser.Input.Keyboard.KeyCodes.F,
        });

        this.input.on('pointerdown', (pointer) => {
            if (pointer.leftButtonDown()) {
                this._shootCurrentGun(pointer.worldX, pointer.worldY);
            }
        });

        // Hold to fire
        this._fireHeld = false;
        this.input.on('pointerdown', () => { this._fireHeld = true; });
        this.input.on('pointerup', () => { this._fireHeld = false; });

        // --- Player death ---
        this.events.on('player-dead', () => this._onPlayerDead());

        // --- Launch HUD ---
        this.scene.launch('UIScene');
    }

    update(time, delta) {
        if (this.player.isDead()) return;

        this.player.update(this.cursors, this.input.activePointer);

        // Hold-fire for minigun / AR
        if (this._fireHeld && this.player.currentGun) {
            const cfg = GUN_CONFIG[this.player.currentGun];
            if (cfg && (this.player.currentGun === 'ar' || this.player.currentGun === 'minigun')) {
                this._shootCurrentGun(
                    this.input.activePointer.worldX,
                    this.input.activePointer.worldY
                );
            }
        }

        this.bushSystem.update();
        this.zoneSystem.update(delta);
        this._animateWater(time);
    }

    _spawnDecorativeObjects() {
        for (const { x, y, type } of getTreePositions()) {
            const key = type || 'tree';
            const depth = key === 'palm_tree' ? 25 : (key === 'snow_pine' ? 25 : 25);
            this.add.image(x, y, key).setDepth(depth).setOrigin(0.5, 0.75);
        }

        for (const { x, y, type } of getBushPositions()) {
            const key = type || 'bush';
            const bush = this.add.image(x, y, key).setDepth(25).setOrigin(0.5, 0.8);
            this.bushGroup.add(bush);
        }

        for (const { x, y } of getRockPositions()) {
            this.add.image(x + 15, y + 10, 'rock').setDepth(6).setOrigin(0.5, 0.7);
        }
    }

    _spawnCoverObjects() {
        const positions = getCoverObjectPositions();
        const spawn = (key, list, depth = 8) => {
            for (const { x, y } of list) {
                this.coverGroup.create(x, y, key).setDepth(depth).refreshBody();
            }
        };
        spawn('sandbag',   positions.sandbags);
        spawn('container', positions.containers);
        spawn('car_wreck', positions.cars);
        spawn('barrel',    positions.barrels);
        spawn('dumpster',  positions.dumpsters);
        spawn('fence_h',   positions.fences, 7);
    }

    _shootCurrentGun(targetX, targetY) {
        const gun = this.player.currentGun;
        if (!gun) return;

        const cfg = GUN_CONFIG[gun];
        const ammoType = cfg.ammoType;
        if (this.player.ammo[ammoType] <= 0) return;

        // Fire rate gate
        const now = this.time.now;
        const lastFire = this._lastFireTime[gun] ?? 0;
        if (now - lastFire < cfg.fireRate) return;
        this._lastFireTime[gun] = now;

        this.player.ammo[ammoType] -= cfg.pellets;
        if (this.player.ammo[ammoType] < 0) this.player.ammo[ammoType] = 0;

        const baseAngle = Phaser.Math.Angle.Between(
            this.player.x, this.player.y, targetX, targetY
        );
        const muzzleX = this.player.x + Math.cos(baseAngle) * 14;
        const muzzleY = this.player.y + Math.sin(baseAngle) * 14;

        if (cfg.isRocket) {
            const rocket = this.rockets.get();
            if (rocket) rocket.fire(muzzleX, muzzleY, baseAngle, cfg);
        } else {
            for (let i = 0; i < cfg.pellets; i++) {
                const angle = baseAngle + (Math.random() - 0.5) * 2 * cfg.spread;
                const bullet = this.bullets.get();
                if (bullet) {
                    bullet.fire(muzzleX, muzzleY, angle, cfg.bulletSpeed, cfg.damage, cfg.bulletLifetime);
                }
            }
        }

        this.events.emit('ammo-changed');
    }

    _spawnLoot() {
        const guns = ['ar', 'ar', 'shotgun', 'sniper', 'ar', 'minigun', 'rocket', 'ar', 'shotgun',
                      'ar', 'sniper', 'shotgun', 'minigun', 'ar', 'rocket', 'ar', 'sniper'];
        const points = getLootSpawnPoints();

        for (let i = 0; i < Math.min(guns.length, points.length); i++) {
            const { x, y } = points[i];
            this._spawnPickup(x * TILE_SIZE + 8, y * TILE_SIZE + 8, guns[i]);
        }

        // Always start with an AR near spawn
        this._spawnPickup(SPAWN_X + 40, SPAWN_Y, 'ar');
    }

    _spawnPickup(worldX, worldY, gunKey) {
        const pickup = new Pickup(this, worldX, worldY, gunKey);
        this.pickups.add(pickup);
    }

    _spawnCrates() {
        const positions = getCratePositions();
        for (const { x, y } of positions) {
            const crate = new Crate(this, x * TILE_SIZE + 10, y * TILE_SIZE + 10);
            this.crateGroup.add(crate);
        }
    }

    _spawnAmmoPacks() {
        const ammoTypes = ['rifle', 'rifle', 'shells', 'sniper', 'rockets', 'rifle',
                           'rifle', 'shells', 'sniper', 'rockets', 'rifle', 'shells'];
        const points = getLootSpawnPoints().slice(20);
        for (let i = 0; i < ammoTypes.length && i < points.length; i++) {
            const { x, y } = points[i];
            const pack = this.add.sprite(
                x * TILE_SIZE + 4, y * TILE_SIZE + 4,
                'ammo_pack'
            );
            pack.setDepth(3);
            pack.ammoType = ammoTypes[i];
            this.physics.add.existing(pack, true);
            this.ammoPacks.add(pack);
        }
    }

    _tryPickupGun(pickup) {
        if (!this.player.currentGun || this.cursors.f.isDown) {
            const oldGun = this.player.currentGun;

            if (oldGun) {
                this._spawnPickup(this.player.x + 20, this.player.y, oldGun);
                this.player.ammo[GUN_CONFIG[oldGun].ammoType] = 0;
            }

            this.player.currentGun = pickup.gunKey;
            this.player.ammo[GUN_CONFIG[pickup.gunKey].ammoType] += pickup.ammoCount;
            pickup.destroy();

            this.events.emit('gun-changed', this.player.currentGun);
            this.events.emit('ammo-changed');
        }
    }

    _pickupAmmo(pack) {
        const amount = AMMO_PACK_AMOUNTS[pack.ammoType] ?? 10;
        this.player.ammo[pack.ammoType] = (this.player.ammo[pack.ammoType] ?? 0) + amount;
        pack.destroy();
        this.events.emit('ammo-changed');
    }

    _buildVignette() {
        const W = this.scale.width;
        const H = this.scale.height;
        const g = this.add.graphics().setDepth(18).setScrollFactor(0);

        const steps = 32;
        const size  = 110;
        for (let i = 0; i < steps; i++) {
            const alpha = 0.55 * Math.pow((steps - i) / steps, 2);
            const t     = Math.round(i * size / steps);
            g.fillStyle(0x000000, alpha);
            g.fillRect(0,     t,     W, 1);
            g.fillRect(0,     H-t-1, W, 1);
            g.fillRect(t,     0,     1, H);
            g.fillRect(W-t-1, 0,     1, H);
        }
    }

    _animateWater(time) {
        if (!this._waterTiles || this._waterTiles.length === 0) return;
        // Cycle between deep blue shades with a ripple pattern
        const t = time / 1200;
        for (let i = 0; i < this._waterTiles.length; i++) {
            const tile   = this._waterTiles[i];
            const wave   = Math.sin(t + tile.x * 0.18 + tile.y * 0.12);
            const bright = Math.floor(0x10 + 0x18 * (wave * 0.5 + 0.5));
            const r      = 0x10;
            const g2     = Math.floor(0x30 + 0x18 * (wave * 0.5 + 0.5));
            const b      = Math.floor(0x60 + 0x28 * (wave * 0.5 + 0.5));
            tile.tint    = (r << 16) | (g2 << 8) | b;
        }
    }

    _onPlayerDead() {
        this.scene.stop('UIScene');
        const timeSurvived = this.time.now - this._startTime;
        this.time.delayedCall(800, () => {
            this.scene.start('GameOverScene', {
                kills: 0,
                damageDealt: this._damageDealt,
                timeSurvived,
            });
        });
    }
}
