import * as Phaser from 'phaser';

const LOOT_TABLE = ['ar', 'ar', 'shotgun', 'ar', 'sniper', 'rocket', 'minigun'];

export class Crate extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'crate_closed');
        scene.add.existing(this);
        scene.physics.add.existing(this, true); // static

        this.setDepth(4);
        this.opened = false;
    }

    open(player, onSpawnPickup) {
        if (this.opened) return;
        this.opened = true;
        this.setTexture('crate_open');
        this.body.enable = false;

        // Slight delay before dropping loot
        this.scene.time.delayedCall(150, () => {
            const gunKey = Phaser.Math.RND.pick(LOOT_TABLE);
            onSpawnPickup(this.x, this.y, gunKey);
        });
    }
}
