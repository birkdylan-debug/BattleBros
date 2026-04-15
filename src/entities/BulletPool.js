import * as THREE from 'three';
import { MAP } from '../constants.js';

const TS = MAP.TILE_SIZE;
const MAX_BULLETS = 80;

export class BulletPool {
    constructor(scene) {
        this.scene = scene;
        this._bullets = [];

        // Shared geometry + materials
        const geo    = new THREE.SphereGeometry(0.12, 4, 3);
        const mat    = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        const expMat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.8 });

        for (let i = 0; i < MAX_BULLETS; i++) {
            const mesh = new THREE.Mesh(geo, mat.clone());
            mesh.visible = false;
            scene.add(mesh);
            this._bullets.push({
                mesh,
                active: false,
                tx: 0, tz: 0,       // current tile position
                vx: 0, vz: 0,       // velocity in tile units per ms
                lifetime: 0,
                maxLife: 0,
                damage: 0,
                isRocket: false,
                aoeRadius: 0,
                aoeDamage: 0,
            });
        }
    }

    // Fire a bullet. px/py in pixel space, angle in radians, speed in px/ms
    fire(px, py, angle, speedPxPerSec, damage, lifetime, isRocket = false, aoeRadius = 0, aoeDamage = 0) {
        const b = this._bullets.find(b => !b.active);
        if (!b) return;

        const speedTilePerMs = (speedPxPerSec / TS) / 1000;
        b.tx       = px / TS;
        b.tz       = py / TS;
        b.vx       = Math.cos(angle) * speedTilePerMs;
        b.vz       = Math.sin(angle) * speedTilePerMs;
        b.lifetime = lifetime;
        b.maxLife  = lifetime;
        b.damage   = damage;
        b.isRocket = isRocket;
        b.aoeRadius = aoeRadius / TS;
        b.aoeDamage = aoeDamage;
        b.active   = true;

        if (isRocket) {
            b.mesh.material.color.set(0xff6600);
            b.mesh.scale.setScalar(1.8);
        } else {
            b.mesh.material.color.set(0xffaa00);
            b.mesh.scale.setScalar(1.0);
        }
        b.mesh.visible = true;
        b.mesh.position.set(b.tx, 0.5, b.tz);
    }

    // Returns array of {x, z, damage, aoeRadius, aoeDamage} for bullets that hit walls
    update(delta, mapMesh) {
        const hits = [];
        for (const b of this._bullets) {
            if (!b.active) continue;
            b.lifetime -= delta;
            if (b.lifetime <= 0) {
                this._deactivate(b);
                continue;
            }

            const nx = b.tx + b.vx * delta;
            const nz = b.tz + b.vz * delta;

            if (mapMesh.isWallAt(nx, nz)) {
                hits.push({ x: nx, z: nz, damage: b.damage, aoeRadius: b.aoeRadius, aoeDamage: b.aoeDamage, isRocket: b.isRocket });
                this._deactivate(b);
                continue;
            }

            b.tx = nx;
            b.tz = nz;
            b.mesh.position.set(b.tx, 0.5, b.tz);

            // Small rotation for visual spin
            b.mesh.rotation.y += 0.15;
        }
        return hits;
    }

    // Check if any bullet overlaps a point (tile coords), returns bullet data or null
    checkHit(tx, tz, radius = 0.5) {
        for (const b of this._bullets) {
            if (!b.active) continue;
            const dx = b.tx - tx;
            const dz = b.tz - tz;
            if (dx * dx + dz * dz < radius * radius) {
                const dmg = b.damage;
                this._deactivate(b);
                return { damage: dmg, aoeRadius: b.aoeRadius, aoeDamage: b.aoeDamage };
            }
        }
        return null;
    }

    _deactivate(b) {
        b.active = false;
        b.mesh.visible = false;
    }

    destroy() {
        for (const b of this._bullets) {
            this.scene.remove(b.mesh);
            b.mesh.geometry.dispose();
            b.mesh.material.dispose();
        }
    }
}
