import * as Phaser from 'phaser';
import { PLAYER_SPEED, PLAYER_MAX_HP, PLAYER_MAX_SHIELD } from '../constants.js';

export class Player extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, skinId = 0) {
        super(scene, x, y, 'player_skin_' + skinId);

        scene.add.existing(this);
        scene.physics.add.existing(this);

        this.body.setSize(18, 18);
        this.setDepth(20);
        this.setOrigin(0.5, 0.5);

        // Stats
        this.hp = PLAYER_MAX_HP;
        this.maxHp = PLAYER_MAX_HP;
        this.shield = PLAYER_MAX_SHIELD;
        this.maxShield = PLAYER_MAX_SHIELD;

        // Gun state
        this.currentGun = null;
        this.ammo = {
            rifle: 0,
            sniper: 0,
            shells: 0,
            rockets: 0,
        };

        this._dead = false;
        this.damageDealt = 0;
    }

    takeDamage(amount) {
        if (this._dead) return;

        let remaining = amount;
        if (this.shield > 0) {
            const absorbed = Math.min(this.shield, remaining);
            this.shield -= absorbed;
            remaining -= absorbed;
        }
        if (remaining > 0) {
            this.hp -= remaining;
        }

        if (this.hp <= 0) {
            this.hp = 0;
            this._dead = true;
            this.scene.events.emit('player-dead');
        }

        this.scene.events.emit('player-damaged');
    }

    isDead() { return this._dead; }

    update(cursors, pointer) {
        if (this._dead) {
            this.setVelocity(0, 0);
            return;
        }
        this._handleMovement(cursors);
        this._handleAim(pointer);
    }

    _handleMovement(cursors) {
        let vx = 0;
        let vy = 0;

        if (cursors.left.isDown || cursors.a.isDown) vx -= 1;
        if (cursors.right.isDown || cursors.d.isDown) vx += 1;
        if (cursors.up.isDown || cursors.w.isDown) vy -= 1;
        if (cursors.down.isDown || cursors.s.isDown) vy += 1;

        if (vx !== 0 && vy !== 0) {
            vx *= Math.SQRT1_2;
            vy *= Math.SQRT1_2;
        }

        this.setVelocity(vx * PLAYER_SPEED, vy * PLAYER_SPEED);
    }

    _handleAim(pointer) {
        this.rotation = Phaser.Math.Angle.Between(
            this.x, this.y,
            pointer.worldX, pointer.worldY
        );
    }
}
