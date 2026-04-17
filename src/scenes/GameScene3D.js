import { MAP, WALKABLE_TILES, PLAYER_SPEED, ZONE_CENTER_X, ZONE_CENTER_Y } from '../constants.js';
import { GUN_CONFIG, AMMO_PACK_AMOUNTS } from '../config/GunConfig.js';
import { getLootSpawnPoints, getCratePositions } from '../map/DesignedMap.js';
import { MapMesh } from '../world/MapMesh.js';
import { Player3D } from '../entities/Player3D.js';
import { BulletPool } from '../entities/BulletPool.js';
import { Pickup3D, AmmoPack3D, Crate3D } from '../entities/Pickup3D.js';
import { ZoneSystem3D } from '../systems/ZoneSystem3D.js';
import { InputManager } from '../systems/InputManager.js';
import { HUD } from '../ui/HUD.js';

// Expose GUN_CONFIG globally so HUD can reference it
window.__gunConfig = { GUN_CONFIG };

const TS   = MAP.TILE_SIZE;
const COLS = MAP.COLS;
const ROWS = MAP.ROWS;

// Spawn in tile coords (col 250, row 190)
const SPAWN_PX = 250 * TS;
const SPAWN_PY = 190 * TS;

export class GameScene3D {
    constructor(game) {
        this.game   = game;
        this.scene  = game.scene;
        this._dead  = false;
        this._startTime = performance.now();
        this._lastFireTime = {};

        // Systems
        this.input  = new InputManager();
        this.map    = new MapMesh(this.scene);
        this.player = new Player3D(this.scene, SPAWN_PX, SPAWN_PY);
        this.bullets = new BulletPool(this.scene);
        this.zone   = new ZoneSystem3D(this.scene);
        this.hud    = new HUD();

        // Pickups, ammo, crates
        this.pickups  = [];
        this.ammoPacks = [];
        this.crates   = [];
        this._spawnPickups();
        this._spawnAmmoPacks();
        this._spawnCrates();

        // Focus camera on spawn
        game.followTarget(SPAWN_PX / TS, SPAWN_PY / TS);
    }

    _spawnPickups() {
        const guns   = ['ar','ar','shotgun','sniper','ar','minigun','rocket',
                        'ar','shotgun','ar','sniper','shotgun','minigun','ar','rocket','ar','sniper'];
        const points = getLootSpawnPoints();
        for (let i = 0; i < Math.min(guns.length, points.length); i++) {
            const { x, y } = points[i];
            this.pickups.push(new Pickup3D(this.scene, x * TS + 8, y * TS + 8, guns[i]));
        }
        // AR near spawn
        this.pickups.push(new Pickup3D(this.scene, SPAWN_PX + 40, SPAWN_PY, 'ar'));
    }

    _spawnAmmoPacks() {
        const types  = ['rifle','rifle','shells','sniper','rockets','rifle',
                        'rifle','shells','sniper','rockets','rifle','shells'];
        const points = getLootSpawnPoints().slice(20);
        for (let i = 0; i < types.length && i < points.length; i++) {
            const { x, y } = points[i];
            this.ammoPacks.push(new AmmoPack3D(this.scene, x * TS + 4, y * TS + 4, types[i]));
        }
    }

    _spawnCrates() {
        for (const { x, y } of getCratePositions()) {
            this.crates.push(new Crate3D(this.scene, x * TS + 8, y * TS + 8));
        }
    }

    update(delta) {
        if (this._dead) return;

        this.input.updateMouseWorld(this.game.camera, this.game.renderer);

        this._handleMovement(delta);
        this._handleFiring();
        this._updatePickups(delta);
        this._updateBullets(delta);
        this.zone.update(delta, this.player);
        this.hud.update(this.player, this.zone);

        // Keep HUD ammo display current
        if (this.player.currentGun) {
            const cfg = GUN_CONFIG[this.player.currentGun];
            const displayName = cfg?.displayName ?? this.player.currentGun.toUpperCase();
            const ammo = this.player.ammo[cfg?.ammoType] ?? 0;
            this.hud.setGunAmmo(displayName, ammo);
        } else {
            this.hud.setGunAmmo(null, null);
        }

        // Update camera to follow player
        this.game.followTarget(this.player.tileX, this.player.tileZ);

        // Hide roof of building player is inside
        this.map.updateRoofVisibility(this.player.tileX, this.player.tileZ);

        // Pulse entrance glow indicators
        this.map.updateGlows(performance.now());
        this.map.updateAnimations(performance.now());

        // Bush fade: not needed without bush detection in 3D, player always visible
        // (bushes are 3D objects that you see through due to camera angle)

        // Check death
        if (this.player.isDead()) {
            this._dead = true;
            const timeSurvived = performance.now() - this._startTime;
            setTimeout(() => {
                this.game.showGameOver({
                    timeSurvived,
                    damageDealt: this.player.damageDealt,
                });
            }, 1000);
        }
    }

    _handleMovement(delta) {
        const p = this.player;
        let vx = 0, vy = 0;

        if (this.input.isMoveLeft())  vx -= 1;
        if (this.input.isMoveRight()) vx += 1;
        if (this.input.isMoveUp())    vy -= 1;
        if (this.input.isMoveDown())  vy += 1;

        // Normalize diagonal
        if (vx !== 0 && vy !== 0) { vx *= Math.SQRT1_2; vy *= Math.SQRT1_2; }

        const spd   = PLAYER_SPEED;
        const newPx = p.px + vx * spd * (delta / 1000);
        const newPy = p.py + vy * spd * (delta / 1000);
        const R     = 0.45; // player radius in tiles

        // X axis — only move if new position is clear
        if (vx !== 0) {
            const checkX = newPx / TS + Math.sign(vx) * R;
            if (!this.map.isWallAt(checkX, p.py / TS)) p.px = newPx;
        }
        // Z axis
        if (vy !== 0) {
            const checkZ = newPy / TS + Math.sign(vy) * R;
            if (!this.map.isWallAt(p.px / TS, checkZ)) p.py = newPy;
        }

        // Aim rotation
        p.updateTransform(this.input.mouseWorld.x, this.input.mouseWorld.z);
    }

    _handleFiring() {
        const p   = this.player;
        const gun = p.currentGun;
        if (!gun) return;

        const cfg = GUN_CONFIG[gun];
        if (!cfg) return;

        const isAutoFire  = (gun === 'ar' || gun === 'minigun');
        const shouldFire  = isAutoFire ? this.input.isFiring() : this.input.consumeClick();

        if (!shouldFire) return;
        if ((p.ammo[cfg.ammoType] ?? 0) <= 0) return;

        const now  = performance.now();
        const last = this._lastFireTime[gun] ?? 0;
        if (now - last < cfg.fireRate) return;
        this._lastFireTime[gun] = now;

        // Deduct ammo
        p.ammo[cfg.ammoType] -= cfg.pellets;
        if (p.ammo[cfg.ammoType] < 0) p.ammo[cfg.ammoType] = 0;

        const muzzle = p.getMuzzlePosition();
        const aimAngle = p.getAimAngle();

        if (cfg.isRocket) {
            this.bullets.fire(
                muzzle.x * TS, muzzle.z * TS,
                aimAngle, cfg.bulletSpeed, cfg.damage,
                cfg.bulletLifetime, true, cfg.aoeRadius, cfg.aoeDamage
            );
        } else {
            for (let i = 0; i < cfg.pellets; i++) {
                const spread = (Math.random() - 0.5) * 2 * cfg.spread;
                this.bullets.fire(
                    muzzle.x * TS, muzzle.z * TS,
                    aimAngle + spread, cfg.bulletSpeed,
                    cfg.damage, cfg.bulletLifetime
                );
            }
        }
    }

    _updatePickups(delta) {
        const p   = this.player;
        const R   = 1.0; // pickup radius in tiles
        const pTx = p.tileX, pTz = p.tileZ;

        // Gun pickups
        for (const pk of this.pickups) {
            if (!pk.active) continue;
            pk.update(delta);

            const dx = pTx - pk.tileX;
            const dz = pTz - pk.tileZ;
            if (dx * dx + dz * dz < R * R) {
                const canPickup = !p.currentGun || this.input.isInteract();
                if (canPickup) {
                    if (p.currentGun) {
                        // Drop current gun
                        this.pickups.push(new Pickup3D(this.scene, p.px + 20, p.py, p.currentGun));
                        p.ammo[GUN_CONFIG[p.currentGun].ammoType] = 0;
                    }
                    p.currentGun = pk.gunKey;
                    p.ammo[GUN_CONFIG[pk.gunKey].ammoType] += pk.ammoCount;
                    pk.destroy();
                }
            }
        }
        this.pickups = this.pickups.filter(pk => pk.active);

        // Ammo packs
        for (const ap of this.ammoPacks) {
            if (!ap.active) continue;
            ap.update(delta);
            const dx = pTx - ap.tileX;
            const dz = pTz - ap.tileZ;
            if (dx * dx + dz * dz < R * R) {
                const amount = AMMO_PACK_AMOUNTS[ap.ammoType] ?? 10;
                p.ammo[ap.ammoType] = (p.ammo[ap.ammoType] ?? 0) + amount;
                ap.destroy();
            }
        }
        this.ammoPacks = this.ammoPacks.filter(ap => ap.active);

        // Crates
        for (const cr of this.crates) {
            if (!cr.active || cr.opened) continue;
            const dx = pTx - cr.tileX;
            const dz = pTz - cr.tileZ;
            if (dx * dx + dz * dz < R * R) {
                if (cr.open()) {
                    // Spawn a random gun at crate position
                    const guns = ['ar','shotgun','sniper'];
                    const gk   = guns[Math.floor(Math.random() * guns.length)];
                    this.pickups.push(new Pickup3D(this.scene, cr.px + 16, cr.py, gk));
                }
            }
        }
    }

    _updateBullets(delta) {
        // Update bullet positions, get wall-hit list
        const wallHits = this.bullets.update(delta, this.map);
        // Wall hits don't damage the player directly, just stop

        // Check if any bullet hits the player
        const hit = this.bullets.checkHit(this.player.tileX, this.player.tileZ, 0.45);
        if (hit) {
            this.player.takeDamage(hit.damage);
        }
    }

    destroy() {
        this.input.destroy();
        this.map.destroy();
        this.player.destroy();
        this.bullets.destroy();
        this.zone.destroy();
        this.hud.destroy();
        for (const pk of this.pickups)   pk.destroy();
        for (const ap of this.ammoPacks) ap.destroy();
        for (const cr of this.crates)    cr.destroy();
    }
}
