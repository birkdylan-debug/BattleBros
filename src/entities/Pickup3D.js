import * as THREE from 'three';
import { MAP } from '../constants.js';
import { GUN_CONFIG } from '../config/GunConfig.js';

const TS = MAP.TILE_SIZE;

const GUN_COLORS = {
    ar:      0x44aa44,
    sniper:  0x4488cc,
    shotgun: 0xcc8822,
    rocket:  0xcc4422,
    minigun: 0xcc2244,
};

const AMMO_COLORS = {
    rifle:   0x88cc44,
    sniper:  0x4488cc,
    shells:  0xcc8822,
    rockets: 0xcc4422,
};

export class Pickup3D {
    constructor(scene, pixelX, pixelY, gunKey) {
        this.scene    = scene;
        this.px       = pixelX;
        this.py       = pixelY;
        this.gunKey   = gunKey;
        this.active   = true;
        this._t       = 0;

        const cfg = GUN_CONFIG[gunKey];
        this.ammoCount = cfg ? cfg.magazineSize : 0;

        const color = GUN_COLORS[gunKey] ?? 0xffffff;
        const geo   = new THREE.BoxGeometry(0.5, 0.3, 0.5);
        const mat   = new THREE.MeshLambertMaterial({ color, flatShading: true, emissive: color, emissiveIntensity: 0.3 });
        this._mesh  = new THREE.Mesh(geo, mat);
        this._mesh.castShadow = true;

        const tx = pixelX / TS;
        const tz = pixelY / TS;
        this._mesh.position.set(tx, 0.4, tz);
        scene.add(this._mesh);
    }

    get tileX() { return this.px / TS; }
    get tileZ() { return this.py / TS; }

    update(delta) {
        if (!this.active) return;
        this._t += delta * 0.002;
        // Float up and down + spin
        this._mesh.position.y = 0.4 + Math.sin(this._t) * 0.15;
        this._mesh.rotation.y = this._t;
    }

    destroy() {
        this.active = false;
        this.scene.remove(this._mesh);
        this._mesh.geometry.dispose();
        this._mesh.material.dispose();
    }
}

export class AmmoPack3D {
    constructor(scene, pixelX, pixelY, ammoType) {
        this.scene    = scene;
        this.px       = pixelX;
        this.py       = pixelY;
        this.ammoType = ammoType;
        this.active   = true;
        this._t       = Math.random() * Math.PI * 2;

        const color = AMMO_COLORS[ammoType] ?? 0xffff44;
        const geo   = new THREE.BoxGeometry(0.4, 0.25, 0.3);
        const mat   = new THREE.MeshLambertMaterial({ color, flatShading: true, emissive: color, emissiveIntensity: 0.25 });
        this._mesh  = new THREE.Mesh(geo, mat);

        const tx = pixelX / TS;
        const tz = pixelY / TS;
        this._mesh.position.set(tx, 0.3, tz);
        scene.add(this._mesh);
    }

    get tileX() { return this.px / TS; }
    get tileZ() { return this.py / TS; }

    update(delta) {
        if (!this.active) return;
        this._t += delta * 0.0025;
        this._mesh.position.y = 0.3 + Math.sin(this._t) * 0.1;
        this._mesh.rotation.y = this._t * 0.8;
    }

    destroy() {
        this.active = false;
        this.scene.remove(this._mesh);
        this._mesh.geometry.dispose();
        this._mesh.material.dispose();
    }
}

export class Crate3D {
    constructor(scene, pixelX, pixelY) {
        this.scene   = scene;
        this.px      = pixelX;
        this.py      = pixelY;
        this.opened  = false;
        this.active  = true;

        const geo  = new THREE.BoxGeometry(0.7, 0.7, 0.7);
        const mat  = new THREE.MeshLambertMaterial({ color: 0xcc9040, flatShading: true });
        this._mesh = new THREE.Mesh(geo, mat);
        this._mesh.castShadow = true;

        const tx = pixelX / TS;
        const tz = pixelY / TS;
        this._mesh.position.set(tx, 0.35, tz);
        scene.add(this._mesh);
    }

    get tileX() { return this.px / TS; }
    get tileZ() { return this.py / TS; }

    open() {
        if (this.opened) return false;
        this.opened = true;
        this._mesh.material.color.set(0x5a3010);
        this._mesh.material.emissive.set(0xffcc00);
        this._mesh.material.emissiveIntensity = 0.5;
        // Tilt open
        this._mesh.rotation.z = 0.4;
        this._mesh.position.y = 0.2;
        return true;
    }

    destroy() {
        this.active = false;
        this.scene.remove(this._mesh);
        this._mesh.geometry.dispose();
        this._mesh.material.dispose();
    }
}
