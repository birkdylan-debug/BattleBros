import * as Phaser from 'phaser';

const W = 800;
const H = 600;

export class GameOverScene extends Phaser.Scene {
    constructor() {
        super('GameOverScene');
    }

    init(data) {
        this.kills = data?.kills ?? 0;
        this.damageDealt = Math.floor(data?.damageDealt ?? 0);
        this.timeSurvived = data?.timeSurvived ?? 0;
    }

    create() {
        // Dark overlay
        this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.88);

        // Title
        this.add.text(W / 2, 130, 'ELIMINATED', {
            fontSize: '52px',
            fontFamily: 'monospace',
            color: '#ff3333',
            stroke: '#880000',
            strokeThickness: 6,
        }).setOrigin(0.5);

        // Stats
        const mins = Math.floor(this.timeSurvived / 60000);
        const secs = Math.floor((this.timeSurvived % 60000) / 1000);
        const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

        const stats = [
            ['Kills',          String(this.kills)],
            ['Damage Dealt',   String(this.damageDealt)],
            ['Time Survived',  timeStr],
        ];

        const tableX = W / 2 - 100;
        let tableY = 240;
        for (const [label, value] of stats) {
            this.add.text(tableX, tableY, label, {
                fontSize: '16px', fontFamily: 'monospace', color: '#888899',
            });
            this.add.text(tableX + 200, tableY, value, {
                fontSize: '16px', fontFamily: 'monospace', color: '#ffffff',
            }).setOrigin(1, 0);
            tableY += 34;
        }

        // Divider
        this.add.graphics().lineStyle(1, 0x444466).lineBetween(W / 2 - 120, 230, W / 2 + 120, 230);
        this.add.graphics().lineStyle(1, 0x444466).lineBetween(W / 2 - 120, tableY + 6, W / 2 + 120, tableY + 6);

        // Buttons
        const btnStyle = (color) => ({
            fontSize: '20px',
            fontFamily: 'monospace',
            color,
            backgroundColor: '#11112299',
            padding: { x: 24, y: 10 },
            stroke: color,
            strokeThickness: 1,
        });

        const playAgainBtn = this.add.text(W / 2 - 110, 420, '▶ PLAY AGAIN', btnStyle('#44ff44'))
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });
        playAgainBtn.on('pointerover', () => playAgainBtn.setStyle({ color: '#aaffaa' }));
        playAgainBtn.on('pointerout', () => playAgainBtn.setStyle({ color: '#44ff44' }));
        playAgainBtn.on('pointerup', () => {
            const skinId = this.registry.get('skinId') ?? 0;
            this.scene.start('GameScene', { skinId });
        });

        const menuBtn = this.add.text(W / 2 + 110, 420, '⌂ MENU', btnStyle('#8888cc'))
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });
        menuBtn.on('pointerover', () => menuBtn.setStyle({ color: '#bbbbff' }));
        menuBtn.on('pointerout', () => menuBtn.setStyle({ color: '#8888cc' }));
        menuBtn.on('pointerup', () => this.scene.start('MenuScene'));
    }
}
