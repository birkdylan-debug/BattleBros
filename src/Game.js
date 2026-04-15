import * as THREE from 'three';
import { GameScene3D } from './scenes/GameScene3D.js';

export class Game {
    constructor() {
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.body.style.cssText = 'margin:0;overflow:hidden;background:#000';
        document.body.appendChild(this.renderer.domElement);

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a2810);
        this.scene.fog = new THREE.FogExp2(0x1a2810, 0.012);

        // Camera — OrthographicCamera at Battlelands angle
        this._setupCamera();

        // Lights
        this._setupLights();

        // State
        this._state = 'menu';
        this._gameScene = null;
        this._prevTime = performance.now();

        window.addEventListener('resize', () => this._onResize());
    }

    _setupCamera() {
        const HALF_W = 18;
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.OrthographicCamera(
            -HALF_W, HALF_W,
            HALF_W / aspect, -HALF_W / aspect,
            0.1, 400
        );
        // Angled from top-left, ~55° from horizontal (Battlelands feel)
        this._camOffset = new THREE.Vector3(0, 22, 16);
        this.camera.position.set(0, 22, 16);
        this.camera.lookAt(0, 0, 0);
    }

    _setupLights() {
        // Warm ambient
        this.scene.add(new THREE.AmbientLight(0x9bb8cc, 0.55));

        // Main sun — top-left-forward, creates the characteristic side shadows
        this.sun = new THREE.DirectionalLight(0xfff5d0, 1.5);
        this.sun.position.set(-10, 28, 12);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.width  = 2048;
        this.sun.shadow.mapSize.height = 2048;
        this.sun.shadow.camera.near   = 0.5;
        this.sun.shadow.camera.far    = 200;
        const sc = 36;
        this.sun.shadow.camera.left   = -sc;
        this.sun.shadow.camera.right  =  sc;
        this.sun.shadow.camera.top    =  sc;
        this.sun.shadow.camera.bottom = -sc;
        this.sun.shadow.bias = -0.001;
        this.scene.add(this.sun);
        this.scene.add(this.sun.target);
    }

    _onResize() {
        const HALF_W = 18;
        const aspect = window.innerWidth / window.innerHeight;
        this.camera.left   = -HALF_W;
        this.camera.right  =  HALF_W;
        this.camera.top    =  HALF_W / aspect;
        this.camera.bottom = -HALF_W / aspect;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // Move camera to follow a world position (in tile units)
    followTarget(tx, tz) {
        this.camera.position.set(tx + this._camOffset.x, this._camOffset.y, tz + this._camOffset.z);
        this.camera.lookAt(tx, 0, tz);
        this.sun.position.set(tx - 10, 28, tz + 12);
        this.sun.target.position.set(tx, 0, tz);
        this.sun.target.updateMatrixWorld();
    }

    start() {
        this._showMenu();
        this._loop();
    }

    _showMenu() {
        const el = document.createElement('div');
        el.id = 'menu';
        el.style.cssText = `
            position:fixed;inset:0;background:rgba(8,18,4,0.92);
            display:flex;flex-direction:column;align-items:center;justify-content:center;
            font-family:'Arial Black',Arial,sans-serif;z-index:200;
        `;
        el.innerHTML = `
            <div style="font-size:72px;font-weight:900;color:#88ff00;
                text-shadow:0 0 40px rgba(136,255,0,0.6),0 4px 0 #224400;
                letter-spacing:-2px;margin-bottom:8px;">BATTLEZONE</div>
            <div style="font-size:16px;color:#aabb88;letter-spacing:4px;
                margin-bottom:48px;text-transform:uppercase;">Low-Poly Battle Royale</div>
            <button id="playBtn" style="
                background:linear-gradient(180deg,#aaff00,#66cc00);
                color:#0a1a02;border:none;padding:18px 64px;
                font-size:26px;font-weight:900;border-radius:10px;cursor:pointer;
                box-shadow:0 6px 0 #335500,0 8px 24px rgba(100,200,0,0.4);
                letter-spacing:2px;text-transform:uppercase;
                transition:transform 0.1s,box-shadow 0.1s;
            ">PLAY</button>
        `;
        document.body.appendChild(el);
        const btn = el.querySelector('#playBtn');
        btn.addEventListener('mouseenter', () => btn.style.transform = 'translateY(-2px)');
        btn.addEventListener('mouseleave', () => btn.style.transform = '');
        btn.addEventListener('click', () => {
            el.remove();
            this._startGame();
        });
    }

    _startGame() {
        if (this._gameScene) {
            this._gameScene.destroy();
            this._gameScene = null;
        }
        this._state = 'playing';
        this._gameScene = new GameScene3D(this);
    }

    showGameOver(data) {
        this._state = 'gameover';
        const mins = Math.floor(data.timeSurvived / 60000);
        const secs = Math.floor((data.timeSurvived % 60000) / 1000);
        const el = document.createElement('div');
        el.id = 'gameover';
        el.style.cssText = `
            position:fixed;inset:0;background:rgba(8,0,0,0.88);
            display:flex;flex-direction:column;align-items:center;justify-content:center;
            font-family:'Arial Black',Arial,sans-serif;z-index:200;
        `;
        el.innerHTML = `
            <div style="font-size:64px;font-weight:900;color:#ff3300;
                text-shadow:0 0 30px rgba(255,50,0,0.5);margin-bottom:16px;">ELIMINATED</div>
            <div style="color:#ccaa88;font-size:18px;margin-bottom:8px;">
                Survived: ${mins}m ${secs}s
            </div>
            <div style="color:#ccaa88;font-size:18px;margin-bottom:40px;">
                Damage dealt: ${data.damageDealt}
            </div>
            <button id="retryBtn" style="
                background:linear-gradient(180deg,#ff6600,#cc4400);
                color:white;border:none;padding:16px 56px;
                font-size:22px;font-weight:900;border-radius:10px;cursor:pointer;
                box-shadow:0 5px 0 #661100,0 7px 20px rgba(200,50,0,0.4);
                letter-spacing:2px;text-transform:uppercase;
            ">PLAY AGAIN</button>
        `;
        document.body.appendChild(el);
        el.querySelector('#retryBtn').addEventListener('click', () => {
            el.remove();
            this._startGame();
        });
    }

    _loop() {
        requestAnimationFrame(() => this._loop());
        const now = performance.now();
        const delta = Math.min(now - this._prevTime, 50); // cap at 50ms
        this._prevTime = now;

        if (this._state === 'playing' && this._gameScene) {
            this._gameScene.update(delta);
        }
        this.renderer.render(this.scene, this.camera);
    }
}
