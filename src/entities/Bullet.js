import * as Phaser from 'phaser';

export class Bullet extends Phaser.Physics.Arcade.Image {
    constructor(scene, x, y) {
        super(scene, x, y, 'bullet');
        this._lifeTimer = null;
        this.damage = 10;
    }

    fire(x, y, angle, speed, damage, lifetime) {
        this.setActive(true);
        this.setVisible(true);
        this.setPosition(x, y);
        this.setRotation(angle);
        this.damage = damage;

        this.body.setVelocity(
            Math.cos(angle) * speed,
            Math.sin(angle) * speed
        );

        if (this._lifeTimer) this._lifeTimer.remove();
        this._lifeTimer = this.scene.time.delayedCall(lifetime, () => {
            this.deactivate();
        });
    }

    deactivate() {
        this.setActive(false);
        this.setVisible(false);
        if (this.body) this.body.stop();
        if (this._lifeTimer) {
            this._lifeTimer.remove();
            this._lifeTimer = null;
        }
    }
}
