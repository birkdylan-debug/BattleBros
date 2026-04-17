import * as THREE from 'three';

export class InputManager {
    constructor() {
        this.keys   = {};
        this.mouseWorld = { x: 0, z: 0 };
        this.leftClick = false;
        this._leftHeld = false;
        this._mouseScreen = { x: 0, y: 0 };

        // Cached raycaster + ground plane — correct for OrthographicCamera
        this._raycaster   = new THREE.Raycaster();
        this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        this._hitTarget   = new THREE.Vector3();

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
    // Uses THREE.Raycaster which correctly handles OrthographicCamera
    updateMouseWorld(camera, renderer) {
        const rect = renderer.domElement.getBoundingClientRect();
        const nx = ((this._mouseScreen.x - rect.left) / rect.width)  * 2 - 1;
        const ny = -((this._mouseScreen.y - rect.top)  / rect.height) * 2 + 1;

        this._raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
        const hit = this._raycaster.ray.intersectPlane(this._groundPlane, this._hitTarget);
        if (hit) {
            this.mouseWorld.x = this._hitTarget.x;
            this.mouseWorld.z = this._hitTarget.z;
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
