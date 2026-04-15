import * as THREE from 'three';
import { ZONE_STAGES, ZONE_INITIAL_RADIUS, ZONE_CENTER_X, ZONE_CENTER_Y, MAP } from '../constants.js';

const TS = MAP.TILE_SIZE;

export class ZoneSystem3D {
    constructor(scene) {
        this.scene = scene;

        // State (pixel space)
        this.centerX = ZONE_CENTER_X;
        this.centerY = ZONE_CENTER_Y;
        this.currentRadius = ZONE_INITIAL_RADIUS;
        this.startRadius   = ZONE_INITIAL_RADIUS;

        this.stageIndex = 0;
        this.phase   = 'waiting';
        this.elapsed = 0;
        this.damageAccumulator = 0;
        this._timerText  = 'Zone closing soon...';
        this._isWarning  = false;
        this.nextPhaseTime = 10000;
        this._totalElapsed = 0;

        // 3D ring — circle of line segments on the ground plane
        this._ring    = this._buildRing();
        this._outerRing = this._buildOuterRing();
        scene.add(this._ring);
        scene.add(this._outerRing);

        // Ground fog overlay (screen-space tint is done in HUD)
    }

    _buildRing() {
        const segments = 128;
        const points = [];
        for (let i = 0; i <= segments; i++) {
            const a = (i / segments) * Math.PI * 2;
            points.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({ color: 0x44aaff, linewidth: 2, transparent: true, opacity: 0.9 });
        const ring = new THREE.LineLoop(geo, mat);
        ring.position.set(this.centerX / TS, 0.05, this.centerY / TS);
        return ring;
    }

    _buildOuterRing() {
        const segments = 128;
        const points = [];
        for (let i = 0; i <= segments; i++) {
            const a = (i / segments) * Math.PI * 2;
            points.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({ color: 0x2266cc, linewidth: 1, transparent: true, opacity: 0.4 });
        const ring = new THREE.LineLoop(geo, mat);
        ring.position.set(this.centerX / TS, 0.04, this.centerY / TS);
        return ring;
    }

    update(delta, player) {
        this._totalElapsed += delta;
        const stage = ZONE_STAGES[this.stageIndex];

        if (!stage) {
            this._timerText = 'Zone closed!';
            this._isWarning = true;
            this._updateRing();
            if (player) this._tickDamage(delta, 80, player);
            return;
        }

        this.elapsed += delta;

        if (this.phase === 'waiting') {
            const timeUntil = this.nextPhaseTime - this._totalElapsed;
            if (timeUntil <= 0) {
                this.phase = 'warning';
                this.elapsed = 0;
            } else {
                this._timerText = `Zone closes in ${Math.ceil(timeUntil / 1000)}s`;
                this._isWarning = false;
            }
        }

        if (this.phase === 'warning') {
            if (this.elapsed >= stage.warningDuration) {
                this.phase = 'shrinking';
                this.elapsed = 0;
                this.startRadius = this.currentRadius;
            } else {
                this._timerText = `⚠ Zone shrinking in ${Math.ceil((stage.warningDuration - this.elapsed) / 1000)}s`;
                this._isWarning = true;
            }
        }

        if (this.phase === 'shrinking') {
            const t = Math.min(this.elapsed / stage.shrinkDuration, 1);
            this.currentRadius = this.startRadius + (stage.endRadius - this.startRadius) * t;
            this._timerText = 'Zone shrinking!';
            this._isWarning = true;
            if (t >= 1) {
                this.currentRadius = stage.endRadius;
                this.stageIndex++;
                this.phase = 'waiting';
                this.elapsed = 0;
                this.nextPhaseTime = this._totalElapsed + 5000;
            }
        }

        this._updateRing();
        if (player) this._tickDamage(delta, stage.damagePerSecond, player);
    }

    _updateRing() {
        const r = this.currentRadius / TS;
        this._ring.scale.setScalar(r);
        this._outerRing.scale.setScalar(r * 1.02);

        // Pulse the ring color when warning
        if (this._isWarning) {
            const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 300);
            this._ring.material.color.setRGB(pulse, pulse * 0.4, 0.1);
            this._ring.material.opacity = 0.9;
        } else {
            this._ring.material.color.set(0x44aaff);
            this._ring.material.opacity = 0.7;
        }
    }

    _tickDamage(delta, dps, player) {
        if (this.isPlayerOutside(player.px, player.py)) {
            this.damageAccumulator += delta;
            if (this.damageAccumulator >= 1000) {
                this.damageAccumulator -= 1000;
                player.takeDamage(dps);
            }
        } else {
            this.damageAccumulator = 0;
        }
    }

    isPlayerOutside(px, py) {
        const dx = px - this.centerX;
        const dy = py - this.centerY;
        return Math.sqrt(dx * dx + dy * dy) > this.currentRadius;
    }

    getTimerText() { return this._timerText; }
    isWarning()    { return this._isWarning; }

    destroy() {
        this.scene.remove(this._ring);
        this.scene.remove(this._outerRing);
        this._ring.geometry.dispose();
        this._outerRing.geometry.dispose();
    }
}
