export class HUD {
    constructor() {
        this._el = document.createElement('div');
        this._el.style.cssText = `
            position:fixed;inset:0;pointer-events:none;
            font-family:'Arial Black',Arial,sans-serif;
            z-index:100;
        `;
        document.body.appendChild(this._el);

        // Zone overlay (red tint when outside zone)
        this._zoneOverlay = document.createElement('div');
        this._zoneOverlay.style.cssText = `
            position:absolute;inset:0;background:rgba(255,30,0,0);
            transition:background 0.1s;pointer-events:none;
        `;
        this._el.appendChild(this._zoneOverlay);

        // Bottom bar
        const bar = document.createElement('div');
        bar.style.cssText = `
            position:absolute;bottom:0;left:0;right:0;
            display:flex;align-items:flex-end;justify-content:space-between;
            padding:0 24px 24px;gap:16px;
        `;
        this._el.appendChild(bar);

        // Health + shield panel
        const hpPanel = document.createElement('div');
        hpPanel.style.cssText = `
            display:flex;flex-direction:column;gap:6px;min-width:220px;
        `;
        this._hpBar  = this._makeBar(hpPanel, '#ff4422', 'HP');
        this._sBar   = this._makeBar(hpPanel, '#44aaff', 'SHIELD');
        bar.appendChild(hpPanel);

        // Zone timer (center bottom)
        this._zoneText = document.createElement('div');
        this._zoneText.style.cssText = `
            flex:1;text-align:center;
            font-size:15px;font-weight:900;letter-spacing:1px;
            color:#aaffaa;text-shadow:0 1px 6px rgba(0,200,0,0.5);
            text-transform:uppercase;padding-bottom:4px;
        `;
        bar.appendChild(this._zoneText);

        // Ammo + gun panel
        this._ammoPanel = document.createElement('div');
        this._ammoPanel.style.cssText = `
            text-align:right;min-width:180px;
        `;
        this._gunName = document.createElement('div');
        this._gunName.style.cssText = `
            font-size:13px;font-weight:900;color:#ccddaa;
            letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;
        `;
        this._ammoText = document.createElement('div');
        this._ammoText.style.cssText = `
            font-size:28px;font-weight:900;color:#ffffaa;
            text-shadow:0 2px 8px rgba(255,220,0,0.4);
        `;
        this._ammoPanel.appendChild(this._gunName);
        this._ammoPanel.appendChild(this._ammoText);
        bar.appendChild(this._ammoPanel);

        // Crosshair
        this._crosshair = document.createElement('div');
        this._crosshair.style.cssText = `
            position:absolute;top:50%;left:50%;
            transform:translate(-50%,-50%);
            width:20px;height:20px;
        `;
        this._crosshair.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="1.5" fill="white" opacity="0.9"/>
                <line x1="10" y1="1" x2="10" y2="6" stroke="white" stroke-width="1.5" opacity="0.8"/>
                <line x1="10" y1="14" x2="10" y2="19" stroke="white" stroke-width="1.5" opacity="0.8"/>
                <line x1="1" y1="10" x2="6" y2="10" stroke="white" stroke-width="1.5" opacity="0.8"/>
                <line x1="14" y1="10" x2="19" y2="10" stroke="white" stroke-width="1.5" opacity="0.8"/>
            </svg>
        `;
        this._el.appendChild(this._crosshair);
    }

    _makeBar(parent, color, label) {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;align-items:center;gap:8px;';

        const lbl = document.createElement('div');
        lbl.style.cssText = `font-size:10px;font-weight:900;color:${color};
            letter-spacing:1px;min-width:44px;text-align:right;opacity:0.8;`;
        lbl.textContent = label;

        const track = document.createElement('div');
        track.style.cssText = `flex:1;height:10px;background:rgba(0,0,0,0.5);
            border-radius:5px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);`;

        const fill = document.createElement('div');
        fill.style.cssText = `height:100%;background:${color};
            border-radius:5px;width:100%;transition:width 0.1s;`;

        track.appendChild(fill);
        wrap.appendChild(lbl);
        wrap.appendChild(track);
        parent.appendChild(wrap);
        return fill;
    }

    update(player, zone) {
        if (!player) return;

        // HP bar
        const hpPct = Math.max(0, player.hp / player.maxHp) * 100;
        this._hpBar.style.width = hpPct + '%';

        // Shield bar
        const sPct = Math.max(0, player.shield / player.maxShield) * 100;
        this._sBar.style.width = sPct + '%';

        // Gun + ammo (caller sets via setGunAmmo)
        if (!player.currentGun) {
            this._gunName.textContent  = 'NO GUN';
            this._ammoText.textContent = '--';
        }

        // Zone text
        if (zone) {
            this._zoneText.textContent = zone.getTimerText();
            this._zoneText.style.color = zone.isWarning() ? '#ff6644' : '#aaffaa';

            // Red overlay when outside zone
            const outside = zone.isPlayerOutside(player.px, player.py);
            const pulse = outside ? 0.10 + 0.06 * Math.sin(Date.now() / 280) : 0;
            this._zoneOverlay.style.background = `rgba(255,30,0,${pulse})`;
        }
    }

    setGunAmmo(gunName, ammo) {
        this._gunName.textContent  = gunName ? gunName.toUpperCase() : 'NO GUN';
        this._ammoText.textContent = ammo !== undefined ? ammo : '--';
    }

    destroy() {
        document.body.removeChild(this._el);
    }
}
