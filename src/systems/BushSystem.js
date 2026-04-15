import * as Phaser from 'phaser';

export class BushSystem {
    constructor(scene, bushGroup) {
        this.scene = scene;
        this.bushGroup = bushGroup;
    }

    update() {
        const player = this.scene.player;
        if (!player || player.isDead()) return;

        let inBush = false;
        const playerBounds = player.getBounds();
        const children = this.bushGroup.getChildren();

        for (let i = 0; i < children.length; i++) {
            const bush = children[i];
            if (!bush || !bush.active) continue;
            if (Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, bush.getBounds())) {
                inBush = true;
                break;
            }
        }

        player.inBush = inBush;
        player.setAlpha(inBush ? 0.18 : 1.0);
    }
}
