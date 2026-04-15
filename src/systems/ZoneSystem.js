import { ZONE_STAGES, ZONE_INITIAL_RADIUS, ZONE_CENTER_X, ZONE_CENTER_Y } from '../constants.js';


export class ZoneSystem {
    constructor(scene, zoneOverlay, zoneBorder) {
        this.scene = scene;
        this.zoneOverlay = zoneOverlay;
        this.zoneBorder  = zoneBorder;

        this.centerX = ZONE_CENTER_X;
        this.centerY = ZONE_CENTER_Y;
        this.currentRadius = ZONE_INITIAL_RADIUS;
        this.startRadius   = ZONE_INITIAL_RADIUS;

        this.stageIndex = 0;
        this.phase = 'waiting';
        this.elapsed = 0;
        this.damageAccumulator = 0;
        this._timerText = 'Zone closing soon...';
        this._isWarning = false;

        this.nextPhaseTime = 10000;
        this.sceneStartTime = scene.time.now;
    }

    update(delta) {
        const now = this.scene.time.now;
        const stage = ZONE_STAGES[this.stageIndex];

        if (!stage) {
            this._timerText = 'Zone closed!';
            this._isWarning = true;
            this._drawZone();
            this._tickDamage(delta, 80);
            return;
        }

        this.elapsed += delta;

        if (this.phase === 'waiting') {
            const timeUntil = this.nextPhaseTime - now;
            if (timeUntil <= 0) {
                this.phase = 'warning';
                this.elapsed = 0;
            } else {
                const secs = Math.ceil(timeUntil / 1000);
                this._timerText = `Zone closes in ${secs}s`;
                this._isWarning = false;
            }
        }

        if (this.phase === 'warning') {
            if (this.elapsed >= stage.warningDuration) {
                this.phase = 'shrinking';
                this.elapsed = 0;
                this.startRadius = this.currentRadius;
            } else {
                const secs = Math.ceil((stage.warningDuration - this.elapsed) / 1000);
                this._timerText = `⚠ Zone shrinking in ${secs}s`;
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
                this.nextPhaseTime = now + 5000;
            }
        }

        this._drawZone();
        this._tickDamage(delta, stage.damagePerSecond);
    }

    _drawZone() {
        // Zone border — drawn in world space, scrolls with camera
        this.zoneBorder.clear();
        // Outer glow
        this.zoneBorder.lineStyle(14, 0x2255cc, 0.2);
        this.zoneBorder.strokeCircle(this.centerX, this.centerY, this.currentRadius);
        // Main ring
        this.zoneBorder.lineStyle(3, 0x66aaff, 0.95);
        this.zoneBorder.strokeCircle(this.centerX, this.centerY, this.currentRadius);

        // Red screen flash — only when player is outside the zone
        this.zoneOverlay.clear();
        const player = this.scene.player;
        if (player && this.isPlayerOutside(player.x, player.y)) {
            const pulse = 0.18 + 0.08 * Math.sin(Date.now() / 280);
            this.zoneOverlay.fillStyle(0xff2200, pulse);
            const W = this.scene.scale.width;
            const H = this.scene.scale.height;
            this.zoneOverlay.fillRect(0, 0, W, H);
        }
    }

    _tickDamage(delta, damagePerSecond) {
        if (!this.scene.player) return;
        if (!this.isPlayerOutside(this.scene.player.x, this.scene.player.y)) {
            this.damageAccumulator = 0;
            return;
        }
        this.damageAccumulator += delta;
        if (this.damageAccumulator >= 1000) {
            this.damageAccumulator -= 1000;
            this.scene.player.takeDamage(damagePerSecond);
        }
    }

    isPlayerOutside(x, y) {
        const dx = x - this.centerX;
        const dy = y - this.centerY;
        return Math.sqrt(dx * dx + dy * dy) > this.currentRadius;
    }

    getTimerText() { return this._timerText; }
    isWarning()    { return this._isWarning; }
}
