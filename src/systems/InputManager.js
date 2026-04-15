import * as THREE from 'three';

export class InputManager {
    constructor() {
        this.keys   = {};
        this.mouseWorld = { x: 0, z: 0 };
        this.leftClick = false;
        this._leftHeld = false;
        this._mouseScreen = { x: 0, y: 0 };

        this._onKeyDown  = e => { this.keys[e.code] = true;  };
        this._onKeyUp    = e => { this.keys[e.code] = false; };
        this._onMouseDown = e => {
            if (e.button === 0) { this.leftClick = true; this._leftHeld = true; }
        };
        this._onMouseUp = e => {
            if (e.button === 0) this._leftHeld = false;
        };
        this._onMouseMove = e => {
            this._mouseScreen.x = e.clientX;
            this._mouseScreen.y = e.clientY;
        };

        window.addEventListener('keydown',   this._onKeyDown);
        window.addEventListener('keyup',     this._onKeyUp);
        window.addEventListener('mousedown', this._onMouseDown);
        window.addEventListener('mouseup',   this._onMouseUp);
        window.addEventListener('mousemove', this._onMouseMove);
    }

    isMoveLeft()  { return !!this.keys['KeyA'] || !!this.keys['ArrowLeft'];  }
    isMoveRight() { return !!this.keys['KeyD'] || !!this.keys['ArrowRight']; }
    isMoveUp()    { return !!this.keys['KeyW'] || !!this.keys['ArrowUp'];    }
    isMoveDown()  { return !!this.keys['KeyS'] || !!this.keys['ArrowDown'];  }
    isInteract()  { return !!this.keys['KeyF']; }
    isFiring()    { return this._leftHeld; }

    consumeClick() {
        const v = this.leftClick;
        this.leftClick = false;
        return v;
    }

    // Raycast mouse onto the ground plane (y=0)
    updateMouseWorld(camera, renderer) {
        const rect = renderer.domElement.getBoundingClientRect();
        const nx = ((this._mouseScreen.x - rect.left) / rect.width)  * 2 - 1;
        const ny = -((this._mouseScreen.y - rect.top) / rect.height) * 2 + 1;

        const ndcPos = new THREE.Vector3(nx, ny, -1).unproject(camera);
        const dir = ndcPos.sub(camera.position).normalize();

        if (Math.abs(dir.y) > 0.0001) {
            const t = -camera.position.y / dir.y;
            if (t > 0) {
                this.mouseWorld.x = camera.position.x + dir.x * t;
                this.mouseWorld.z = camera.position.z + dir.z * t;
            }
        }
    }

    destroy() {
        window.removeEventListener('keydown',   this._onKeyDown);
        window.removeEventListener('keyup',     this._onKeyUp);
        window.removeEventListener('mousedown', this._onMouseDown);
        window.removeEventListener('mouseup',   this._onMouseUp);
        window.removeEventListener('mousemove', this._onMouseMove);
    }
}
