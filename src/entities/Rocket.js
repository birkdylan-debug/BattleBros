import * as Phaser from 'phaser';

export class Rocket extends Phaser.Physics.Arcade.Image {
    constructor(scene, x, y) {
        super(scene, x, y, 'gun_rocket');
        this._lifeTimer = null;
        this.damage = 80;
        this.aoeRadius = 96;
        this.aoeDamage = 40;
        this._exploded = false;
    }

    fire(x, y, angle, config) {
        this.setActive(true);
        this.setVisible(true);
        this.setPosition(x, y);
        this.setRotation(angle);
        this.setScale(0.8);
        this._exploded = false;
        this.damage = config.damage;
        this.aoeRadius = config.aoeRadius;
        this.aoeDamage = config.aoeDamage;

        this.body.setVelocity(
            Math.cos(angle) * config.bulletSpeed,
            Math.sin(angle) * config.bulletSpeed
        );

        if (this._lifeTimer) this._lifeTimer.remove();
        this._lifeTimer = this.scene.time.delayedCall(config.bulletLifetime, () => {
            this.explode();
        });
    }

    explode() {
        if (this._exploded) return;
        this._exploded = true;

        const x = this.x;
        const y = this.y;

        // Draw AOE explosion ring
        const g = this.scene.add.graphics();
        g.setDepth(15);
        g.fillStyle(0xff6600, 0.55);
        g.fillCircle(x, y, this.aoeRadius);
        g.lineStyle(3, 0xffaa00, 0.9);
        g.strokeCircle(x, y, this.aoeRadius);

        // Fade out and destroy the graphic
        this.scene.tweens.add({
            targets: g,
            alpha: 0,
            duration: 350,
            onComplete: () => g.destroy(),
        });

        // Damage player if in AOE
        const player = this.scene.player;
        if (player) {
            const dist = Phaser.Math.Distance.Between(x, y, player.x, player.y);
            if (dist <= this.aoeRadius) {
                player.takeDamage(this.aoeDamage);
            }
        }

        this.deactivate();
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
