import * as Phaser from 'phaser';
import { GUN_CONFIG } from '../config/GunConfig.js';

export class Pickup extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, gunKey, ammoCount) {
        super(scene, x, y, 'gun_' + gunKey);
        this.gunKey = gunKey;
        this.ammoCount = ammoCount ?? GUN_CONFIG[gunKey].magazineSize;

        scene.add.existing(this);
        scene.physics.add.existing(this, true); // true = static body

        this.setDepth(3);
        this.setScale(1.4);

        // Glowing tint cycle to make it visible
        scene.tweens.add({
            targets: this,
            alpha: 0.6,
            duration: 600,
            yoyo: true,
            repeat: -1,
        });
    }
}
