import * as THREE from 'three';
import { MAP, PLAYER_SPEED, PLAYER_MAX_HP, PLAYER_MAX_SHIELD } from '../constants.js';

const TS = MAP.TILE_SIZE;

export class Player3D {
    constructor(scene, pixelX, pixelY) {
        this.scene = scene;

        // Game state (in pixel space, same scale as before)
        this.px = pixelX;   // pixel X
        this.py = pixelY;   // pixel Y
        this.hp = PLAYER_MAX_HP;
        this.maxHp = PLAYER_MAX_HP;
        this.shield = PLAYER_MAX_SHIELD;
        this.maxShield = PLAYER_MAX_SHIELD;
        this.currentGun = null;
        this.ammo = { rifle: 0, sniper: 0, shells: 0, rockets: 0 };
        this.inBush = false;
        this._dead = false;
        this.damageDealt = 0;

        this._aimAngle = 0; // radians
        this._mesh = this._buildMesh();
        scene.add(this._mesh);
    }

    _buildMesh() {
        const group = new THREE.Group();

        // Body — flattened cylinder (low-poly capsule feel)
        const bodyGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.7, 8);
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2266cc, flatShading: true });
        this._bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        this._bodyMesh.position.set(0, 0.35, 0);
        this._bodyMesh.castShadow = true;
        group.add(this._bodyMesh);

        // Vest accent
        const vestGeo = new THREE.CylinderGeometry(0.40, 0.40, 0.3, 8);
        const vestMat = new THREE.MeshLambertMaterial({ color: 0x1144aa, flatShading: true });
        const vest = new THREE.Mesh(vestGeo, vestMat);
        vest.position.set(0, 0.28, 0);
        group.add(vest);

        // Head — sphere
        const headGeo = new THREE.SphereGeometry(0.28, 7, 5);
        const headMat = new THREE.MeshLambertMaterial({ color: 0xf8c880, flatShading: true });
        this._headMesh = new THREE.Mesh(headGeo, headMat);
        this._headMesh.position.set(0, 0.9, 0);
        this._headMesh.castShadow = true;
        group.add(this._headMesh);

        // Helmet
        const helmetGeo = new THREE.SphereGeometry(0.30, 7, 4);
        const helmetMat = new THREE.MeshLambertMaterial({ color: 0x224488, flatShading: true });
        const helmet = new THREE.Mesh(helmetGeo, helmetMat);
        helmet.position.set(0, 0.98, 0);
        helmet.scale.y = 0.55;
        group.add(helmet);

        // Gun holder (pivots with aim direction)
        this._gunPivot = new THREE.Group();
        this._gunPivot.position.set(0, 0.55, 0);

        // Gun body
        const gunGeo = new THREE.BoxGeometry(0.7, 0.12, 0.12);
        const gunMat = new THREE.MeshLambertMaterial({ color: 0x222222, flatShading: true });
        const gun = new THREE.Mesh(gunGeo, gunMat);
        gun.position.set(0.55, 0, 0);
        this._gunPivot.add(gun);

        // Gun barrel
        const barrelGeo = new THREE.BoxGeometry(0.5, 0.07, 0.07);
        const barrelMat = new THREE.MeshLambertMaterial({ color: 0x444444, flatShading: true });
        const barrel = new THREE.Mesh(barrelGeo, barrelMat);
        barrel.position.set(0.85, 0, 0);
        this._gunPivot.add(barrel);

        group.add(this._gunPivot);

        // Shadow disc on ground
        const shadowGeo = new THREE.CircleGeometry(0.4, 8);
        const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 });
        const shadow = new THREE.Mesh(shadowGeo, shadowMat);
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.01;
        group.add(shadow);

        return group;
    }

    setColor(bodyColor) {
        if (this._bodyMesh) {
            this._bodyMesh.material.color.set(bodyColor);
        }
    }

    // pixelX/Y in pixel space, aimX/Z in tile space
    updateTransform(aimTileX, aimTileZ) {
        const tx = this.px / TS;
        const tz = this.py / TS;
        this._mesh.position.set(tx, 0, tz);

        // Aim rotation (around Y axis)
        const dx = aimTileX - tx;
        const dz = aimTileZ - tz;
        this._aimAngle = Math.atan2(dx, dz); // note: three.js Y rotation maps differently
        this._gunPivot.rotation.y = -Math.atan2(dz, dx);

        // Face player toward aim
        this._bodyMesh.rotation.y = -Math.atan2(dz, dx);
        this._headMesh.rotation.y = -Math.atan2(dz, dx);
    }

    get tileX() { return this.px / TS; }
    get tileZ() { return this.py / TS; }

    takeDamage(amount) {
        if (this._dead) return;
        let rem = amount;
        if (this.shield > 0) {
            const absorbed = Math.min(this.shield, rem);
            this.shield -= absorbed;
            rem -= absorbed;
        }
        if (rem > 0) this.hp -= rem;
        if (this.hp <= 0) {
            this.hp = 0;
            this._dead = true;
        }
    }

    isDead() { return this._dead; }

    setAlpha(a) {
        this._mesh.traverse(obj => {
            if (obj.isMesh && obj.material) {
                obj.material.transparent = true;
                obj.material.opacity = a;
            }
        });
    }

    destroy() {
        this.scene.remove(this._mesh);
        this._mesh.traverse(obj => {
            if (obj.isMesh) {
                obj.geometry.dispose();
                obj.material.dispose();
            }
        });
    }

    getMuzzlePosition() {
        // Returns muzzle world position (tile coords)
        const tx = this.px / TS;
        const tz = this.py / TS;
        const angle = -this._gunPivot.rotation.y;
        return {
            x: tx + Math.cos(angle) * 0.9,
            z: tz + Math.sin(angle) * 0.9,
        };
    }

    getAimAngle() {
        return -this._gunPivot.rotation.y;
    }
}
