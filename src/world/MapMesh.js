import * as THREE from 'three';
import { MAP, TILE, WALKABLE_TILES } from '../constants.js';
import { generateDesignedMap, getTreePositions, getBushPositions, getRockPositions, getCoverObjectPositions } from '../map/DesignedMap.js';

const COLS = MAP.COLS;
const ROWS = MAP.ROWS;
const TS   = MAP.TILE_SIZE;
const WALL_H = 1.4;

const INTERIOR_FLOORS = new Set([4, 7, 10, 12, 15, 19, 23, 26]);

const ROOF_COLOR = {
    4:  0xa06830, 7:  0xd0a840, 10: 0x6878a0, 12: 0x707080,
    15: 0x406030, 19: 0x5a7048, 23: 0x8090a8, 26: 0x885522,
};

const GROUND_COLOR = {
    0:0x111111, 2:0x58d014, 4:0xb88820, 5:0xf4c832, 7:0xeedd50,
    8:0xa4b0ac, 10:0xccd4e8, 11:0x383838, 12:0xe07018, 13:0x20a80e,
    15:0x585030, 16:0x0880e8, 17:0xc0980e, 19:0x9ca080, 20:0xeaf2ff,
    21:0x78d4f4, 23:0xbc8838, 24:0x68d020, 26:0x784c14,
    27:0x44bc14, 28:0xa0c898, 29:0x8cac30, 30:0x386a24,
};

const WALL_COLOR = {
    0:0x222222, 1:0x8890a0, 3:0xb07838, 6:0xd8b858, 9:0x8890c0,
    14:0x487838, 18:0x7c9060, 22:0x8ca4bc, 25:0xbc7830,
};

function hexToRgb(hex) {
    return [((hex>>16)&0xff)/255, ((hex>>8)&0xff)/255, (hex&0xff)/255];
}
function isWall(id) { return !WALKABLE_TILES.includes(id); }

function seededRng(seed) {
    let s = (seed ^ 0xdeadbeef) >>> 0;
    return () => {
        s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
        s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
        s = (s ^ (s >>> 16)) >>> 0;
        return s / 0xffffffff;
    };
}

export class MapMesh {
    constructor(scene) {
        this.scene    = scene;
        this.wallGrid = null;
        this._meshes      = [];
        this._buildings   = [];
        this._animMeshes  = [];
        this._doorGlows   = [];
        this._build();
    }

    _build() {
        const { tileData } = generateDesignedMap();
        this._tileData = tileData;
        this.wallGrid  = Array.from({ length: ROWS }, (_, r) =>
            Array.from({ length: COLS }, (_, c) => isWall(tileData[r][c]))
        );
        const { list: buildings, wallKeys } = this._detectBuildings(tileData);

        // Make building bounding-box perimeters fully solid so visuals match collision
        for (const bldg of buildings) {
            const ox = bldg.cx - bldg.w / 2, oz = bldg.cz - bldg.d / 2;
            for (let c = ox; c < ox + bldg.w; c++) {
                for (let r = oz; r < oz + bldg.d; r++) {
                    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue;
                    const isPerim = c===ox || c===ox+bldg.w-1 || r===oz || r===oz+bldg.d-1;
                    if (isPerim && tileData[r][c] !== TILE.DOOR) this.wallGrid[r][c] = true;
                }
            }
        }

        this._buildGround(tileData);
        this._buildWalls(tileData, wallKeys);
        this._buildCustomBuildings(buildings);
        this._buildRoofs(tileData, buildings);
        this._buildEntranceGlows(tileData);
        this._buildProps();
    }

    // ── Building detection ───────────────────────────────────────────────────
    _detectBuildings(tileData) {
        const visited  = new Uint8Array(COLS * ROWS);
        const list     = [];
        const wallKeys = new Set();

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const idx = r * COLS + c;
                if (visited[idx] || !INTERIOR_FLOORS.has(tileData[r][c])) continue;
                const floorTiles = [];
                const queue = [{ c, r }];
                visited[idx] = 1;
                let head = 0;
                while (head < queue.length) {
                    const { c: cc, r: rr } = queue[head++];
                    floorTiles.push({ c: cc, r: rr });
                    for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
                        const nc = cc+dc, nr = rr+dr;
                        if (nc<0||nc>=COLS||nr<0||nr>=ROWS) continue;
                        const ni = nr*COLS+nc;
                        if (visited[ni] || !INTERIOR_FLOORS.has(tileData[nr][nc])) continue;
                        visited[ni] = 1;
                        queue.push({ c: nc, r: nr });
                    }
                }
                if (floorTiles.length < 2) continue;

                let minC=Infinity,maxC=-Infinity,minR=Infinity,maxR=-Infinity;
                for (const { c: fc, r: fr } of floorTiles) {
                    if (fc<minC) minC=fc; if (fc>maxC) maxC=fc;
                    if (fr<minR) minR=fr; if (fr>maxR) maxR=fr;
                }
                const ox = minC-1, oz = minR-1;
                const ow = maxC-ox+2, od = maxR-oz+2;

                for (let rr=oz; rr<oz+od; rr++) for (let cc=ox; cc<ox+ow; cc++) {
                    if (rr<0||rr>=ROWS||cc<0||cc>=COLS) continue;
                    if (isWall(tileData[rr][cc]) && tileData[rr][cc]!==TILE.WATER)
                        wallKeys.add(`${cc},${rr}`);
                }

                const counts = {};
                for (const { c: fc, r: fr } of floorTiles) {
                    const t = tileData[fr][fc];
                    if (t !== TILE.DOOR) counts[t] = (counts[t]||0)+1;
                }
                let floorType = TILE.CITY_FLOOR, best = 0;
                for (const [t, n] of Object.entries(counts))
                    if (n > best) { best = n; floorType = +t; }

                const tileSet = new Set(floorTiles.map(t => `${t.c},${t.r}`));
                list.push({ floorTiles, floorType, tileSet,
                    cx: ox+ow/2, cz: oz+od/2, w: ow, d: od,
                    seed: ox*997+oz*31, extGroup: null, roofMesh: null });
            }
        }
        return { list, wallKeys };
    }

    // ── Ground ───────────────────────────────────────────────────────────────
    _buildGround(tileData) {
        const canvas = document.createElement('canvas');
        canvas.width = COLS; canvas.height = ROWS;
        const ctx = canvas.getContext('2d');
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
            const hex = GROUND_COLOR[tileData[r][c]] ?? 0x111111;
            ctx.fillStyle = `#${hex.toString(16).padStart(6,'0')}`;
            ctx.fillRect(c, r, 1, 1);
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.magFilter = tex.minFilter = THREE.NearestFilter;
        tex.flipY = false;
        const geo = new THREE.PlaneGeometry(COLS, ROWS);
        geo.rotateX(-Math.PI/2);
        const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex }));
        mesh.position.set(COLS/2, 0, ROWS/2);
        mesh.receiveShadow = true;
        this.scene.add(mesh); this._meshes.push(mesh);
    }

    // ── Walls (non-building) ──────────────────────────────────────────────────
    _buildWalls(tileData, skipKeys) {
        const groups = new Map();
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
            const id = tileData[r][c];
            if (!isWall(id) || id===TILE.WATER || skipKeys.has(`${c},${r}`)) continue;
            if (!groups.has(id)) groups.set(id, []);
            groups.get(id).push({ c, r });
        }
        const dummy = new THREE.Object3D();
        const boxGeo = new THREE.BoxGeometry(1, WALL_H, 1);
        for (const [id, tiles] of groups) {
            const mat  = new THREE.MeshLambertMaterial({ color: WALL_COLOR[id]??0x888888, flatShading:true });
            const mesh = new THREE.InstancedMesh(boxGeo, mat, tiles.length);
            mesh.castShadow = mesh.receiveShadow = true;
            tiles.forEach((t,i) => { dummy.position.set(t.c+.5,WALL_H/2,t.r+.5); dummy.updateMatrix(); mesh.setMatrixAt(i,dummy.matrix); });
            mesh.instanceMatrix.needsUpdate = true;
            this.scene.add(mesh); this._meshes.push(mesh);
        }
        const waterTiles = [];
        for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) if (tileData[r][c]===TILE.WATER) waterTiles.push({c,r});
        if (waterTiles.length) {
            const wMat  = new THREE.MeshPhongMaterial({ color:0x0880e8, specular:0x88ccff, shininess:80 });
            const wMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1,.05,1), wMat, waterTiles.length);
            waterTiles.forEach((t,i) => { dummy.position.set(t.c+.5,.02,t.r+.5); dummy.updateMatrix(); wMesh.setMatrixAt(i,dummy.matrix); });
            wMesh.instanceMatrix.needsUpdate = true;
            this.scene.add(wMesh); this._meshes.push(wMesh);
        }
    }

    // ── Custom buildings ──────────────────────────────────────────────────────
    _buildCustomBuildings(buildings) {
        this._animMeshes = [];
        this._winDark = new THREE.MeshBasicMaterial({ color:0x1a2838 });
        this._winLit  = new THREE.MeshBasicMaterial({ color:0xffd890 });
        this._winDim  = new THREE.MeshBasicMaterial({ color:0x3a5060 });

        for (const bldg of buildings) {
            const rng   = seededRng(bldg.seed);
            const group = new THREE.Group();
            switch (bldg.floorType) {
                case TILE.CITY_FLOOR:   this._makeCityBuilding(group,   bldg.w, bldg.d, bldg.cx, bldg.cz, rng); break;
                case TILE.MIL_FLOOR:    this._makeMilBuilding(group,    bldg.w, bldg.d, bldg.cx, bldg.cz, rng); break;
                case TILE.JUNGLE_FLOOR: this._makeJungleBuilding(group, bldg.w, bldg.d, bldg.cx, bldg.cz, rng); break;
                case TILE.SNOW_FLOOR:   this._makeSnowBuilding(group,   bldg.w, bldg.d, bldg.cx, bldg.cz, rng); break;
                case TILE.WOOD_FLOOR:   this._makeRuralBuilding(group,  bldg.w, bldg.d, bldg.cx, bldg.cz, rng); break;
                default:                this._makeGenericBuilding(group, bldg.w, bldg.d, bldg.cx, bldg.cz, rng); break;
            }
            bldg.extGroup = group;
            this.scene.add(group);
            this._meshes.push(group);
        }
    }

    // ── CITY ─────────────────────────────────────────────────────────────────
    _makeCityBuilding(group, w, d, cx, cz, rng) {
        const area = w * d;
        if (area < 26 || (area < 38 && rng() < 0.5))  this._cityShop(group, w, d, cx, cz, rng);
        else if (area > 58 && rng() < 0.55)            this._cityTower(group, w, d, cx, cz, rng);
        else                                            this._cityApartment(group, w, d, cx, cz, rng);
    }

    _cityShop(group, w, d, cx, cz, rng) {
        const h = 1.4 + rng() * 0.45;
        const cols = [0xe8c8a0,0xa8c8a8,0xc8a8a8,0xa8b8d8,0xd8cfa0,0xd0b898,0xb8c8d0];
        const bc   = cols[Math.floor(rng()*cols.length)];
        const trim = 0x383028;
        group.add(this._box(w,h,d, cx,h/2,cz, bc, true));
        // facade band + sign
        group.add(this._box(w+.1,.38,.11, cx,h-.19, cz-d/2-.06, trim));
        const sw=w*.68, sh=.34;
        const sc=[0xcc4422,0x2244aa,0x226633,0x884422,0x554488];
        group.add(this._box(sw+.14,sh+.14,.07, cx,h+sh/2, cz-d/2-.07, 0x252520));
        group.add(this._box(sw,sh,.1, cx,h+sh/2, cz-d/2-.1, sc[Math.floor(rng()*sc.length)]));
        // large storefront windows
        const nw=Math.max(1,Math.floor(w/2.2));
        const wW=w/nw*.7, wH=h*.6;
        const glMat=new THREE.MeshBasicMaterial({color:0x88aabb});
        for (let i=0;i<nw;i++) {
            const wx=cx-w/2+(i+.5)*(w/nw);
            const win=new THREE.Mesh(new THREE.BoxGeometry(wW,wH,.08),glMat);
            win.position.set(wx,h*.42,cz-d/2-.04); group.add(win);
            group.add(this._box(wW+.1,wH+.1,.05, wx,h*.42,cz-d/2-.02, trim));
        }
        group.add(this._box(.78,h*.84,.1, cx,h*.42,cz-d/2-.05, 0x443322));
        // awning
        const awMat=new THREE.MeshLambertMaterial({color:rng()<.5?0xcc3322:0x336699,flatShading:true});
        const aw=new THREE.Mesh(new THREE.BoxGeometry(w+.3,.08,.85),awMat);
        aw.rotation.x=.2; aw.position.set(cx,h*.79,cz-d/2-.48); group.add(aw);
        for (let i=0;i<=Math.floor(w/1.5);i++) {
            const sx=cx-w/2+i*(w/Math.max(1,Math.floor(w/1.5)));
            group.add(this._cyl(.02,.02,.5,sx,h*.79-.23,cz-d/2-.78,0x333333));
        }
        this._addParapet(group,cx,cz,w,d,h,.2,.13,trim);
        if (rng()<.65) group.add(this._box(.55,.35,.38,cx+(rng()-.5)*(w*.5),h+.18,cz+(rng()-.5)*(d*.4),0x909090));
        // flower boxes
        for (let i=0;i<nw;i++) {
            const wx=cx-w/2+(i+.5)*(w/nw);
            group.add(this._box(wW*.8,.15,.2, wx,h*.42-wH/2-.08,cz-d/2-.05, 0x884422));
            group.add(this._box(wW*.6,.13,.13, wx,h*.42-wH/2+.02,cz-d/2-.05,
                [0xff6644,0xff44aa,0xffcc00,0x88ff44][Math.floor(rng()*4)]));
        }
    }

    _cityApartment(group, w, d, cx, cz, rng) {
        const nF=2+Math.floor(rng()*2), sH=2.0, height=nF*sH;
        const bricks=[0xb87050,0xa86040,0xc88060,0x907060,0xb8a090,0x909090,0x808898];
        const bc=bricks[Math.floor(rng()*bricks.length)], trim=0x605848;
        group.add(this._box(w,height,d, cx,height/2,cz, bc, true));
        for (let fl=1;fl<nF;fl++) group.add(this._box(w+.2,.22,d+.2, cx,fl*sH,cz, trim));
        group.add(this._box(w+.25,.28,d+.25, cx,.14,cz, trim));
        this._addWindows(group,cx,cz,w,d,nF,sH,.44,.5,rng,'normal');
        // balconies on upper floors
        for (let fl=1;fl<nF;fl++) {
            const by=fl*sH+sH*.42, nb=Math.max(1,Math.floor(w/2.8));
            for (let bi=0;bi<nb;bi++) {
                if (rng()<.3) continue;
                const bx=cx-w/2+(bi+.5)*(w/nb), bw2=(w/nb)*.72, bD=.65;
                group.add(this._box(bw2,.09,bD, bx,by,cz-d/2-bD/2));
                const np=Math.floor(bw2/.38);
                for (let pi=0;pi<=np;pi++) {
                    const px2=bx-bw2/2+pi*(bw2/np);
                    group.add(this._box(.05,.45,.05, px2,by+.23,cz-d/2-bD+.05, trim));
                }
                group.add(this._box(bw2,.06,.06, bx,by+.46,cz-d/2-bD+.05, trim));
            }
        }
        // entry portico
        const pW=Math.min(2.2,w*.44), pH=sH*.82, pD=.58;
        group.add(this._box(pW,pH,pD, cx,pH/2,cz-d/2-pD/2, 0xd8d0c0));
        for (const px2 of [cx-pW/2+.12,cx+pW/2-.12])
            group.add(this._cyl(.11,.11,pH, px2,pH/2,cz-d/2-pD/2, 0xe0d8c8));
        group.add(this._box(pW+.28,.18,pD+.28, cx,pH,cz-d/2-pD/2, trim));
        this._addParapet(group,cx,cz,w,d,height,.26,.17,trim);
        if (rng()<.5&&w>4) this._addWaterTower(group,cx+(rng()-.5)*(w-2),height,cz+(rng()-.5)*(d-2));
        if (rng()<.38) { const sw=1.5+rng()*.5,sh=.9+rng()*.4,sd=1.3;
            group.add(this._box(sw,sh,sd, cx+(rng()-.5)*(w-sw-.4),height+sh/2,cz+(rng()-.5)*(d-sd-.4),bc)); }
    }

    _cityTower(group, w, d, cx, cz, rng) {
        const sH=2.2, nF=3+Math.floor(rng()*3), height=nF*sH;
        const sbF=1+Math.floor(rng()*2), mainF=nF-sbF, mainH=mainF*sH;
        const sW=w*(0.55+rng()*.2), sD=d*(0.55+rng()*.2);
        const palettes=[[0xc8c4b8,0x787880],[0xd0dce8,0x5070a0],[0xe0d8c8,0x805040],[0xc8d0c0,0x607060]];
        const [bc,trim]=palettes[Math.floor(rng()*palettes.length)];
        group.add(this._box(w,mainH,d, cx,mainH/2,cz, bc, true));
        group.add(this._box(sW,sbF*sH,sD, cx,mainH+(sbF*sH)/2,cz, bc, true));
        for (let fl=1;fl<nF;fl++) {
            const bw2=fl<mainF?w:sW, bd=fl<mainF?d:sD;
            group.add(this._box(bw2+.18,.18,bd+.18, cx,fl*sH,cz, trim));
        }
        group.add(this._box(w+.28,.32,d+.28, cx,.16,cz, trim));
        this._addWindows(group,cx,cz,w,d,mainF,sH,.48,.56,rng,'normal');
        this._addWindows(group,cx,cz,sW,sD,sbF,sH,.44,.52,rng,'normal');
        // lobby canopy
        const cW=Math.min(3.0,w*.5), cH2=sH*.55, cD=.78;
        group.add(this._box(cW,.14,cD, cx,cH2,cz-d/2-cD/2, trim));
        for (const px2 of [cx-cW/2+.1,cx+cW/2-.1])
            group.add(this._cyl(.09,.09,cH2, px2,cH2/2,cz-d/2-cD+.1, 0xd0d0d0));
        this._addParapet(group,cx,cz,sW,sD,height,.28,.19,trim);
        group.add(this._box(sW*.5,.55,sD*.5, cx,height+.28,cz, 0x909090));
        const nA=1+Math.floor(rng()*3);
        for (let i=0;i<nA;i++) {
            const ah=1.2+rng()*1.4;
            const ant=this._cyl(.025,.04,ah, cx+(rng()-.5)*(sW*.3),height+.55+ah/2,cz+(rng()-.5)*(sD*.3),0x686878);
            group.add(ant);
            this._animMeshes.push({mesh:ant,type:'sway',phase:rng()*Math.PI*2,amp:.015,speed:1.2});
        }
        const pilMat=new THREE.MeshLambertMaterial({color:trim});
        for (const [px2,pz2] of [[cx-w/2,cz-d/2],[cx+w/2,cz-d/2],[cx-w/2,cz+d/2],[cx+w/2,cz+d/2]]) {
            const pil=new THREE.Mesh(new THREE.BoxGeometry(.2,mainH+.05,.2),pilMat);
            pil.position.set(px2,mainH/2,pz2); group.add(pil);
        }
    }

    // ── MILITARY ──────────────────────────────────────────────────────────────
    _makeMilBuilding(group, w, d, cx, cz, rng) {
        const area=w*d;
        if (Math.min(w,d)<5 && area<20)    this._milWatchtower(group,w,d,cx,cz,rng);
        else if (area>42 && rng()<0.55)     this._milBarracks(group,w,d,cx,cz,rng);
        else                                this._milBunker(group,w,d,cx,cz,rng);
    }

    _milWatchtower(group, w, d, cx, cz, rng) {
        const baseW=Math.min(w,d)*.6+.4, towerH=3.5+rng()*1.5;
        const concrete=0x8a8878, dark=0x5a5848;
        // base pedestal
        group.add(this._box(baseW+.6,.8,baseW+.6, cx,.4,cz, dark, true));
        // shaft
        group.add(this._box(baseW,towerH,baseW, cx,towerH/2+.8,cz, concrete, true));
        // platform overhang
        const platW=baseW+1.4, platH=.28;
        group.add(this._box(platW,platH,platW, cx,towerH+.8+platH/2,cz, dark));
        // railing
        for (const [rx,rz,rw2,rd2] of [
            [cx,cz-platW/2+.06,platW,.12],[cx,cz+platW/2-.06,platW,.12],
            [cx-platW/2+.06,cz,.12,platW],[cx+platW/2-.06,cz,.12,platW]]) {
            group.add(this._box(rw2,.55,rd2, rx,towerH+.8+platH+.28,rz, 0x707060));
        }
        // slit windows on shaft
        const sW2=.55, sH=.2;
        const slitMat=new THREE.MeshBasicMaterial({color:0x1a1a14});
        for (const ang of [0,Math.PI/2,Math.PI,Math.PI*3/2]) {
            const sx=cx+Math.sin(ang)*(baseW/2+.01), sz=cz+Math.cos(ang)*(baseW/2+.01);
            const sl=new THREE.Mesh(new THREE.BoxGeometry(sW2,sH,.08),slitMat);
            sl.position.set(sx,towerH*.55,sz); sl.rotation.y=ang; group.add(sl);
            const sl2=new THREE.Mesh(new THREE.BoxGeometry(sW2,sH,.08),slitMat);
            sl2.position.set(sx,towerH*.28,sz); sl2.rotation.y=ang; group.add(sl2);
        }
        // searchlight
        group.add(this._box(.5,.35,.35, cx+(rng()-.5)*platW*.3, towerH+.8+platH+.72, cz+(rng()-.5)*platW*.3, 0xc0c0b0));
        // ladder rungs
        const rungMat=new THREE.MeshLambertMaterial({color:0x707060});
        for (let y=1.2;y<towerH+.6;y+=.45) {
            const rung=new THREE.Mesh(new THREE.BoxGeometry(.44,.06,.06),rungMat);
            rung.position.set(cx,y,cz+baseW/2+.04); group.add(rung);
        }
    }

    _milBarracks(group, w, d, cx, cz, rng) {
        const h=1.8+rng()*.4;
        const palette=[0x7a8a6a,0x8a9070,0x6e7e60,0x9a9480];
        const bc=palette[Math.floor(rng()*palette.length)], trim2=0x5a6050;
        group.add(this._box(w,h,d, cx,h/2,cz, bc, true));
        // divide facade into bays with vertical strips
        const nBays=Math.max(2,Math.floor(w/3.5));
        const bayMat=new THREE.MeshLambertMaterial({color:trim2});
        for (let i=0;i<=nBays;i++) {
            const bx=cx-w/2+i*(w/nBays);
            for (const zo of [cz-d/2-.04,cz+d/2+.04]) {
                const strip=new THREE.Mesh(new THREE.BoxGeometry(.18,h,.08),bayMat);
                strip.position.set(bx,h/2,zo); group.add(strip);
            }
        }
        // flat roof slab with thick edge
        group.add(this._box(w+.4,.32,d+.4, cx,h+.16,cz, 0x6a7460));
        group.add(this._box(w+.55,.14,d+.55, cx,h+.38,cz, trim2));
        // slit windows per bay
        this._addWindows(group,cx,cz,w,d,1,h,.55,.2,rng,'slit');
        // covered entrance
        const entW=2.4, entH=h*.8, entD=.9;
        group.add(this._box(entW,.15,entD, cx,entH,cz-d/2-entD/2, trim2));
        for (const ex of [cx-entW/2+.12,cx+entW/2-.12])
            group.add(this._cyl(.1,.1,entH, ex,entH/2,cz-d/2-entD/2, 0xb0b0a0));
        // fuel drums cluster
        const drumMat=new THREE.MeshLambertMaterial({color:0x505840,flatShading:true});
        const side=rng()<.5?1:-1;
        for (let i=0;i<3+Math.floor(rng()*3);i++) {
            const dr=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.55,7),drumMat);
            dr.position.set(cx+side*(w/2+.5+Math.floor(i/2)*.52),(i%2)*.28+.28,cz+(rng()-.5)*d*.5);
            dr.rotation.z=rng()*.15; group.add(dr);
        }
        // sandbag rows in front
        const sbMat=new THREE.MeshLambertMaterial({color:0xc8a860,flatShading:true});
        const nSb=Math.floor(w*.9);
        for (let i=0;i<nSb;i++) {
            const sb=new THREE.Mesh(new THREE.BoxGeometry(.5,.32,.3),sbMat);
            sb.position.set(cx-w/2+(i+.5)*(w/nSb), .16, cz-d/2-.38);
            sb.rotation.y=rng()*.25; group.add(sb);
        }
        // antenna
        if (rng()<.6) {
            const ah=1.8+rng()*1.2;
            const ant=this._cyl(.03,.05,ah, cx+(rng()-.5)*(w*.35),h+.32+ah/2,cz+(rng()-.5)*(d*.35),0x404840);
            group.add(ant);
            group.add(this._box(.85,.04,.04,ant.position.x,ant.position.y+ah*.32,ant.position.z,0x404840));
            this._animMeshes.push({mesh:ant,type:'sway',phase:rng()*Math.PI*2,amp:.012,speed:.6});
        }
    }

    _milBunker(group, w, d, cx, cz, rng) {
        const height  = 1.6+rng()*.9;
        const palette = [0x7a8a6a,0x8a9070,0x6e7e60,0x9a9480,0x8a8070];
        const body    = palette[Math.floor(rng()*palette.length)];
        const reinf   = 0x5a6250;
        group.add(this._box(w,height,d, cx,height/2,cz, body, true));
        const reinMat = new THREE.MeshLambertMaterial({ color:reinf });
        const sc = Math.floor(w/2.5);
        for (let i=0;i<sc;i++) {
            const sx = cx-w/2+(i+.5)*(w/sc);
            for (const zo of [cz-d/2-.05,cz+d/2+.05]) {
                const s = new THREE.Mesh(new THREE.BoxGeometry(.2,height,.1),reinMat);
                s.position.set(sx,height/2,zo); group.add(s);
            }
        }
        this._addWindows(group, cx,cz, w,d, 1,height, .7,.18, rng, 'slit');
        group.add(this._box(w+.3,.3,d+.3, cx,height+.15,cz, 0x6a7460));
        const sbMat = new THREE.MeshLambertMaterial({ color:0xc8a860, flatShading:true });
        const sbGeo = new THREE.BoxGeometry(.55,.38,.35);
        for (let i=0; i<Math.floor(w/.7); i++) {
            const sx = cx-w/2+(i+.5)*(w/Math.floor(w/.7));
            for (const zo of [cz-d/2+.2,cz+d/2-.2]) {
                if (rng()<.82) { const sb=new THREE.Mesh(sbGeo,sbMat); sb.position.set(sx,height+.34+rng()*.05,zo); sb.rotation.y=rng()*.3; group.add(sb); }
            }
        }
        for (let i=0; i<Math.floor(d/.7); i++) {
            const sz = cz-d/2+(i+.5)*(d/Math.floor(d/.7));
            for (const xo of [cx-w/2+.2,cx+w/2-.2]) {
                if (rng()<.82) { const sb=new THREE.Mesh(new THREE.BoxGeometry(.35,.38,.55),sbMat); sb.position.set(xo,height+.34+rng()*.05,sz); group.add(sb); }
            }
        }
        if (rng()<.55) {
            const ah=1.5+rng()*1.1;
            const ant = this._cyl(.03,.05,ah, cx+(rng()-.5)*(w*.35),height+ah/2+.3,cz+(rng()-.5)*(d*.35),0x404840);
            group.add(ant);
            group.add(this._box(.8,.04,.04, ant.position.x,ant.position.y+ah*.3,ant.position.z,0x404840));
            this._animMeshes.push({ mesh:ant, type:'sway', phase:rng()*Math.PI*2, amp:.012, speed:.6 });
        }
        if (w>5 && rng()<.4) {
            const net = new THREE.Mesh(new THREE.PlaneGeometry(w*.6,d*.6),
                new THREE.MeshBasicMaterial({ color:0x4a6030, transparent:true, opacity:.5, side:THREE.DoubleSide }));
            net.rotation.x=-Math.PI/2; net.position.set(cx+(rng()-.5)*(w*.2),height+.35,cz+(rng()-.5)*(d*.2));
            group.add(net);
        }
        if (rng()<.5) {
            const bw=w*.6+rng()*w*.3, bh=.8+rng()*.4, bd=.6;
            const side = rng()<.5 ? cz-d/2-bd*.6 : cz+d/2+bd*.6;
            group.add(this._box(bw,bh,bd, cx+(rng()-.5)*(w-bw),bh/2,side,0x8a7850,true));
        }
    }

    // ── JUNGLE / RUINS ────────────────────────────────────────────────────────
    _makeJungleBuilding(group, w, d, cx, cz, rng) {
        const area=w*d;
        if (area<22)        this._jungleShrine(group,w,d,cx,cz,rng);
        else if (area>50)   this._jungleTemple(group,w,d,cx,cz,rng);
        else                this._jungleRuins(group,w,d,cx,cz,rng);
    }

    _jungleShrine(group, w, d, cx, cz, rng) {
        const h=1.4+rng()*.6;
        const stones=[0x4e5e44,0x3e5038,0x566050,0x486040];
        const sc=stones[Math.floor(rng()*stones.length)], dark=0x2e3828;
        // platform base
        group.add(this._box(w+.5,.35,d+.5, cx,.18,cz, dark, true));
        // main structure
        group.add(this._box(w,h,d, cx,h/2+.35,cz, sc, true));
        // stone courses
        const cMat=new THREE.MeshLambertMaterial({color:dark});
        for (let y=.35+.6;y<h+.35;y+=.6) { const cm=new THREE.Mesh(new THREE.BoxGeometry(w+.04,.06,d+.04),cMat); cm.position.set(cx,y,cz); group.add(cm); }
        // two stone columns in front
        const colH=h+.35+.5, colR=.18;
        for (const cx2 of [cx-w*.28,cx+w*.28]) {
            group.add(this._cyl(colR,colR*1.1,colH, cx2,colH/2,cz-d/2-.02, sc));
            group.add(this._box(colR*3,.18,colR*3, cx2,colH,cz-d/2-.02, dark));
        }
        // lintel over columns
        group.add(this._box(w*.75,.22,.22, cx,colH+.11,cz-d/2-.02, dark));
        // carved opening (dark recess)
        group.add(this._box(w*.4,h*.65,.1, cx,h*.45+.35,cz-d/2-.05, 0x1a2018));
        // crumbling top
        const crMat=new THREE.MeshLambertMaterial({color:dark,flatShading:true});
        for (let i=0;i<4+Math.floor(rng()*4);i++) {
            const cr=new THREE.Mesh(new THREE.BoxGeometry(.3+rng()*.5,.18+rng()*.35,.3+rng()*.5),crMat);
            cr.position.set(cx+(rng()-.5)*w, h+.35+.09, cz+(rng()-.5)*d);
            cr.rotation.y=rng()*Math.PI; group.add(cr);
        }
        // vines + overgrowth
        const vineMat=new THREE.MeshLambertMaterial({color:0x38622a,flatShading:true,side:THREE.DoubleSide});
        for (let i=0;i<4+Math.floor(rng()*5);i++) {
            const vh=.5+rng()*1.0;
            const vGeo=new THREE.BoxGeometry(.08,vh,.06); vGeo.translate(0,-vh/2,0);
            const vine=new THREE.Mesh(vGeo,vineMat);
            const edge=Math.floor(rng()*4),t=rng();
            if (edge===0)      vine.position.set(cx-w/2+t*w,h+.38,cz-d/2);
            else if (edge===1) vine.position.set(cx-w/2+t*w,h+.38,cz+d/2);
            else if (edge===2) vine.position.set(cx-w/2,h+.38,cz-d/2+t*d);
            else               vine.position.set(cx+w/2,h+.38,cz-d/2+t*d);
            group.add(vine);
            this._animMeshes.push({mesh:vine,type:'vine',phase:rng()*Math.PI*2,amp:.12,speed:.6+rng()*.4});
        }
        group.add(this._box(w+.3,.32,d+.3, cx,.16,cz, 0x2a5020, true));
    }

    _jungleTemple(group, w, d, cx, cz, rng) {
        const stones=[0x4e5e44,0x3e5038,0x566050,0x486040,0x405848];
        const sc=stones[Math.floor(rng()*stones.length)], dark=0x2e3828, accent=0x8a7040;
        // 4-tier stepped pyramid
        const tiers=[{s:1.0,h:.7},{s:.8,h:.75},{s:.62,h:.7},{s:.45,h:.8}];
        let yb=0;
        for (const tier of tiers) {
            group.add(this._box(w*tier.s,tier.h,d*tier.s, cx,yb+tier.h/2,cz, sc, true));
            // stone courses on this tier
            const cMat=new THREE.MeshLambertMaterial({color:dark});
            for (let y=yb+.3;y<yb+tier.h;y+=.32) {
                const cm=new THREE.Mesh(new THREE.BoxGeometry(w*tier.s+.04,.06,d*tier.s+.04),cMat);
                cm.position.set(cx,y,cz); group.add(cm);
            }
            yb+=tier.h;
        }
        // top altar
        group.add(this._box(w*.35,.55,d*.35, cx,yb+.28,cz, accent, true));
        group.add(this._box(w*.45,.12,d*.45, cx,yb+.55+.06,cz, dark));
        // staircase up front face (center)
        const stairW=w*.25, nSteps=Math.floor(yb/.35)+1;
        for (let si=0;si<nSteps;si++) {
            const sy=(si/(nSteps-1))*yb, sz=cz-d/2+(si/(nSteps-1))*d*.48;
            group.add(this._box(stairW,.08,.28, cx,sy+.04,sz-d*.02, dark));
        }
        // decorative columns at base corners
        const baseH=tiers[0].h;
        for (const [ax,az] of [[cx-w*.38,cz-d*.38],[cx+w*.38,cz-d*.38],[cx-w*.38,cz+d*.38],[cx+w*.38,cz+d*.38]]) {
            group.add(this._cyl(.14,.18,baseH+.1, ax,baseH/2,az, dark));
        }
        // crumbling blocks scattered
        const crMat=new THREE.MeshLambertMaterial({color:dark,flatShading:true});
        for (let i=0;i<6+Math.floor(rng()*6);i++) {
            const cr=new THREE.Mesh(new THREE.BoxGeometry(.4+rng()*.7,.2+rng()*.5,.4+rng()*.7),crMat);
            const ang2=rng()*Math.PI*2, rad=(0.5+rng()*.4)*Math.min(w,d)*.5;
            cr.position.set(cx+Math.cos(ang2)*rad,.1+rng()*.3,cz+Math.sin(ang2)*rad);
            cr.rotation.y=rng()*Math.PI; group.add(cr);
        }
        // vines
        const vineMat=new THREE.MeshLambertMaterial({color:0x38622a,flatShading:true,side:THREE.DoubleSide});
        for (let i=0;i<8+Math.floor(rng()*8);i++) {
            const vh=.7+rng()*1.8; const vGeo=new THREE.BoxGeometry(.09,vh,.07); vGeo.translate(0,-vh/2,0);
            const vine=new THREE.Mesh(vGeo,vineMat);
            const edge=Math.floor(rng()*4),t=rng();
            if (edge===0)      vine.position.set(cx-w/2+t*w,yb+.08,cz-d/2);
            else if (edge===1) vine.position.set(cx-w/2+t*w,yb+.08,cz+d/2);
            else if (edge===2) vine.position.set(cx-w/2,yb+.08,cz-d/2+t*d);
            else               vine.position.set(cx+w/2,yb+.08,cz-d/2+t*d);
            group.add(vine);
            this._animMeshes.push({mesh:vine,type:'vine',phase:rng()*Math.PI*2,amp:.13,speed:.6+rng()*.5});
        }
        group.add(this._box(w+.4,.38,d+.4, cx,.19,cz, 0x2a5020, true));
    }

    _jungleRuins(group, w, d, cx, cz, rng) {
        const height  = 2.0+rng()*1.3;
        const stones  = [0x4e5e44,0x3e5038,0x566050,0x486040,0x405848];
        const sc      = stones[Math.floor(rng()*stones.length)];
        const dark    = 0x2e3828;
        const tiers=[{s:1.0,h:height*.45},{s:.82,h:height*.35},{s:.66,h:height*.2}];
        let yb=0;
        for (const tier of tiers) { group.add(this._box(w*tier.s,tier.h,d*tier.s, cx,yb+tier.h/2,cz,sc,true)); yb+=tier.h; }
        const cMat = new THREE.MeshLambertMaterial({ color:dark });
        for (let i=1;i<Math.floor(height/.65);i++) { const y=i*.65; const cm=new THREE.Mesh(new THREE.BoxGeometry(w+.05,.06,d+.05),cMat); cm.position.set(cx,y,cz); group.add(cm); }
        const crMat = new THREE.MeshLambertMaterial({ color:dark, flatShading:true });
        for (let i=0;i<5+Math.floor(rng()*6);i++) {
            const cw=.4+rng()*.8,ch=.2+rng()*.55,cd=.4+rng()*.8;
            const cr = new THREE.Mesh(new THREE.BoxGeometry(cw,ch,cd),crMat);
            const ang=rng()*Math.PI*2, rad=(rng()*.4+.1)*Math.min(w,d)*.5;
            cr.position.set(cx+Math.cos(ang)*rad, height+ch/2-.1, cz+Math.sin(ang)*rad);
            cr.rotation.y=rng()*Math.PI; group.add(cr);
        }
        this._addWindows(group, cx,cz, w,d, 1,height, .38,.65, rng,'arch');
        const vineMat = new THREE.MeshLambertMaterial({ color:0x38622a, flatShading:true, side:THREE.DoubleSide });
        for (let i=0;i<5+Math.floor(rng()*8);i++) {
            const vh=.6+rng()*1.5; const vGeo = new THREE.BoxGeometry(.09,vh,.07); vGeo.translate(0,-vh/2,0);
            const vine = new THREE.Mesh(vGeo, vineMat);
            const edge=Math.floor(rng()*4), t=rng();
            let vx,vz;
            if (edge===0)      { vx=cx-w/2+t*w; vz=cz-d/2; }
            else if (edge===1) { vx=cx-w/2+t*w; vz=cz+d/2; }
            else if (edge===2) { vx=cx-w/2;     vz=cz-d/2+t*d; }
            else               { vx=cx+w/2;     vz=cz-d/2+t*d; }
            vine.position.set(vx+(rng()-.5)*.25, height+.04, vz+(rng()-.5)*.25);
            group.add(vine);
            this._animMeshes.push({ mesh:vine, type:'vine', phase:rng()*Math.PI*2, amp:.13, speed:.65+rng()*.5 });
        }
        const mossMat = new THREE.MeshBasicMaterial({ color:0x38622a, transparent:true, opacity:.55, side:THREE.DoubleSide });
        for (let i=0;i<3+Math.floor(rng()*5);i++) {
            const mw=.4+rng()*.9, mh=.3+rng()*.65;
            const moss=new THREE.Mesh(new THREE.PlaneGeometry(mw,mh),mossMat);
            const edge=Math.floor(rng()*4), t=rng(), y=rng()*height*.8;
            if (edge===0)      { moss.position.set(cx-w/2+t*w,y,cz-d/2-.02); moss.rotation.y=Math.PI; }
            else if (edge===1) { moss.position.set(cx-w/2+t*w,y,cz+d/2+.02); }
            else if (edge===2) { moss.position.set(cx-w/2-.02,y,cz-d/2+t*d); moss.rotation.y=Math.PI/2; }
            else               { moss.position.set(cx+w/2+.02,y,cz-d/2+t*d); moss.rotation.y=-Math.PI/2; }
            group.add(moss);
        }
        group.add(this._box(w+.3,.35,d+.3, cx,.18,cz, 0x2a5020, true));
    }

    // ── SNOW / CABIN ──────────────────────────────────────────────────────────
    _makeSnowBuilding(group, w, d, cx, cz, rng) {
        if (w*d > 38 || (d > 6 && rng() < 0.6))  this._snowLodge(group, w, d, cx, cz, rng);
        else                                        this._snowCabin(group, w, d, cx, cz, rng);
    }

    _snowCabin(group, w, d, cx, cz, rng) {
        const height  = 1.8+rng()*.65;
        const palette = [0xa07840,0x906830,0xb88840,0x7a5828,0xc09050];
        const bc      = palette[Math.floor(rng()*palette.length)];
        const logC    = 0x6a4820;
        const snowC   = 0xe8f4ff;
        group.add(this._box(w,height,d, cx,height/2,cz,bc,true));
        const lMat = new THREE.MeshLambertMaterial({ color:logC });
        for (let i=0;i<=Math.floor(height/.44);i++) { const plank=new THREE.Mesh(new THREE.BoxGeometry(w+.12,.09,d+.12),lMat); plank.position.set(cx,i*.44+.04,cz); group.add(plank); }
        const oh=.55;
        group.add(this._box(w+oh*2,.24,d+oh*2, cx,height+.12,cz,logC));
        group.add(this._box(w+oh*2+.12,.2,d+oh*2+.12, cx,height+.33,cz,snowC));
        this._addWindows(group,cx,cz,w,d,1,height,.38,.42,rng,'normal');
        const chX=cx+(rng()-.5)*(w*.4), chZ=cz+(rng()-.5)*(d*.4), chH=.9+rng()*.65;
        group.add(this._box(.56,chH,.56, chX,height+.22+chH/2,chZ,0x7a5040,true));
        group.add(this._box(.72,.13,.72, chX,height+.22+chH+.07,chZ,0x5a3828));
        for (let i=0;i<3;i++) {
            const sz=.12+i*.06;
            const smoke=new THREE.Mesh(new THREE.SphereGeometry(sz,5,4), new THREE.MeshBasicMaterial({color:0xddddc8,transparent:true,opacity:.65-i*.18}));
            smoke.position.set(chX+rng()*.08, height+.22+chH+.18+i*.38, chZ+rng()*.08);
            group.add(smoke);
            this._animMeshes.push({mesh:smoke,type:'smoke',phase:(i/3)*Math.PI*2,amp:.12,speed:.5+rng()*.2,baseY:smoke.position.y});
        }
        const iMat=new THREE.MeshBasicMaterial({color:0xd0eeff,transparent:true,opacity:.78});
        const ic=Math.floor(w*1.6);
        for (let i=0;i<ic;i++) { const il=.12+rng()*.22; const ice=new THREE.Mesh(new THREE.CylinderGeometry(0,.05,il,4),iMat); ice.position.set(cx-w/2+(i+.5)*(w/ic),height+.33-il/2,cz-d/2-oh-.02); group.add(ice); }
        const shMat=new THREE.MeshLambertMaterial({color:logC});
        for (let i=0;i<Math.max(1,Math.floor(w/2.5));i++) {
            const wx=cx-w/2+(i+.5)*(w/Math.max(1,Math.floor(w/2.5))), wy=height*.55;
            for (const sx of [-.28,.28]) { const sh=new THREE.Mesh(new THREE.BoxGeometry(.12,.44,.06),shMat); sh.position.set(wx+sx,wy,cz-d/2-.04); group.add(sh); }
        }
    }

    _snowLodge(group, w, d, cx, cz, rng) {
        const wallH=1.9+rng()*.4;
        const logC=0x7a4a20, bc=0xa07840, snowC=0xe8f4ff, trimC=0x5a3818;
        // main body
        group.add(this._box(w,wallH,d, cx,wallH/2,cz, bc, true));
        // exposed log beams on facade
        const lMat=new THREE.MeshLambertMaterial({color:logC});
        const nBeams=Math.max(2,Math.floor(w/2.2));
        for (let i=0;i<=nBeams;i++) {
            const bx=cx-w/2+i*(w/nBeams);
            const beam=new THREE.Mesh(new THREE.BoxGeometry(.2,wallH,.15),lMat);
            beam.position.set(bx,wallH/2,cz-d/2-.07); group.add(beam);
            const beam2=new THREE.Mesh(new THREE.BoxGeometry(.2,wallH,.15),lMat);
            beam2.position.set(bx,wallH/2,cz+d/2+.07); group.add(beam2);
        }
        // A-frame steep roof
        const peakH=d*.75;
        const rMat=new THREE.MeshLambertMaterial({color:trimC,flatShading:true});
        const slopeLen=Math.sqrt((d/2)*(d/2)+peakH*peakH);
        const ang=Math.atan2(peakH,d/2);
        const rGeo=new THREE.BoxGeometry(w+.5,.22,slopeLen+.3);
        const rL=new THREE.Mesh(rGeo,rMat); rL.position.set(cx,wallH+peakH/2,cz-d/4); rL.rotation.x=ang; rL.castShadow=true; group.add(rL);
        const rR=new THREE.Mesh(rGeo.clone(),rMat); rR.position.set(cx,wallH+peakH/2,cz+d/4); rR.rotation.x=-ang; rR.castShadow=true; group.add(rR);
        // heavy snow on roof
        const snowGeo=new THREE.BoxGeometry(w+.6,.16,slopeLen+.4);
        const snowMat=new THREE.MeshLambertMaterial({color:snowC});
        const sL=new THREE.Mesh(snowGeo,snowMat); sL.position.set(cx,wallH+peakH/2+.1,cz-d/4); sL.rotation.x=ang; group.add(sL);
        const sR=new THREE.Mesh(snowGeo.clone(),snowMat); sR.position.set(cx,wallH+peakH/2+.1,cz+d/4); sR.rotation.x=-ang; group.add(sR);
        // ridge beam
        group.add(this._box(w+.55,.24,.24, cx,wallH+peakH,cz, logC));
        // gable end triangles
        for (const gz of [cz-d/2-.02,cz+d/2+.02]) {
            const verts=new Float32Array([cx-w/2,wallH,gz, cx+w/2,wallH,gz, cx,wallH+peakH,gz]);
            const gGeo=new THREE.BufferGeometry(); gGeo.setAttribute('position',new THREE.BufferAttribute(verts,3));
            gGeo.setIndex([0,1,2]); gGeo.computeVertexNormals();
            group.add(new THREE.Mesh(gGeo,new THREE.MeshLambertMaterial({color:bc,side:THREE.DoubleSide})));
        }
        // large gable window at front
        const gwW=w*.45, gwH=Math.min(peakH*.55,1.4);
        group.add(new THREE.Mesh(new THREE.BoxGeometry(gwW,gwH,.1), this._winLit));
        const gw=group.children[group.children.length-1]; gw.position.set(cx,wallH+peakH*.32,cz-d/2-.05);
        group.add(this._box(gwW+.18,gwH+.18,.07, cx,wallH+peakH*.32,cz-d/2-.02, logC));
        // wide front porch
        const porchD=1.1, porchH2=wallH*.65;
        group.add(this._box(w,.1,porchD, cx,porchH2,cz-d/2-porchD/2, logC));
        const nPosts=Math.max(2,Math.floor(w/1.8));
        for (let i=0;i<nPosts;i++) {
            const px2=cx-w/2+(i+.5)*(w/nPosts);
            group.add(this._cyl(.1,.12,porchH2, px2,porchH2/2,cz-d/2-porchD+.12, logC));
        }
        // double chimneys
        for (const cx2 of [cx-w*.22,cx+w*.22]) {
            const chH=1.0+rng()*.5;
            group.add(this._box(.52,chH,.52, cx2,wallH+peakH*.65+chH/2,cz+(rng()-.5)*(d*.2),0x7a5040,true));
            group.add(this._box(.68,.12,.68, cx2,wallH+peakH*.65+chH+.06,cz,0x5a3828));
        }
        // windows
        this._addWindows(group,cx,cz,w,d,1,wallH,.42,.44,rng,'normal');
        // icicles all round
        const iMat=new THREE.MeshBasicMaterial({color:0xd0eeff,transparent:true,opacity:.8});
        for (const [side,rotY] of [[cz-d/2,0],[cz+d/2,Math.PI],[cx-w/2,Math.PI/2],[cx+w/2,-Math.PI/2]]) {
            const isZ=rotY===0||rotY===Math.PI, len=isZ?w:d, pos=side;
            const ic=Math.floor(len*1.8);
            for (let i=0;i<ic;i++) {
                const il=.14+rng()*.26;
                const ice=new THREE.Mesh(new THREE.CylinderGeometry(0,.055,il,4),iMat);
                const t=(i+.5)/ic;
                ice.position.set(isZ?cx-len/2+t*len:pos, wallH+peakH*.28-il/2, isZ?pos:cz-len/2+t*len);
                group.add(ice);
            }
        }
    }

    // ── RURAL / BARN ──────────────────────────────────────────────────────────
    _makeRuralBuilding(group, w, d, cx, cz, rng) {
        if (w*d < 24 || rng() < 0.35)  this._ruralCottage(group, w, d, cx, cz, rng);
        else                            this._ruralBarn(group, w, d, cx, cz, rng);
    }

    _ruralCottage(group, w, d, cx, cz, rng) {
        const wallH=1.65+rng()*.35;
        const palette=[0xf0ece0,0xe8dfc8,0xdfd8c0,0xe0d0b8,0xd8e0d0];
        const bc=palette[Math.floor(rng()*palette.length)], trimC=0x5a3820, roofC=0x706050;
        // main body
        group.add(this._box(w,wallH,d, cx,wallH/2,cz, bc, true));
        // window trim all round
        group.add(this._box(w+.16,.2,d+.16, cx,.1,cz, trimC));
        group.add(this._box(w+.16,.2,d+.16, cx,wallH,cz, trimC));
        // moderately steep peaked roof
        const peakH=d*.38+rng()*.15;
        const rMat=new THREE.MeshLambertMaterial({color:roofC,flatShading:true});
        const slopeLen=Math.sqrt((d/2)*(d/2)+peakH*peakH);
        const ang=Math.atan2(peakH,d/2);
        const rGeo=new THREE.BoxGeometry(w+.4,.18,slopeLen+.25);
        const rL=new THREE.Mesh(rGeo,rMat); rL.position.set(cx,wallH+peakH/2,cz-d/4); rL.rotation.x=ang; rL.castShadow=true; group.add(rL);
        const rR=new THREE.Mesh(rGeo.clone(),rMat); rR.position.set(cx,wallH+peakH/2,cz+d/4); rR.rotation.x=-ang; rR.castShadow=true; group.add(rR);
        group.add(this._box(w+.45,.18,.18, cx,wallH+peakH,cz, trimC));
        // gable ends
        for (const gz of [cz-d/2-.02,cz+d/2+.02]) {
            const verts=new Float32Array([cx-w/2,wallH,gz, cx+w/2,wallH,gz, cx,wallH+peakH,gz]);
            const gGeo=new THREE.BufferGeometry(); gGeo.setAttribute('position',new THREE.BufferAttribute(verts,3));
            gGeo.setIndex([0,1,2]); gGeo.computeVertexNormals();
            group.add(new THREE.Mesh(gGeo,new THREE.MeshLambertMaterial({color:bc,side:THREE.DoubleSide})));
        }
        // front door (centered, smaller)
        const dH=wallH*.8, dW=.72;
        group.add(this._box(dW,dH,.1, cx,dH/2,cz-d/2-.05, trimC));
        group.add(this._box(dW+.22,dH+.14,.07, cx,dH/2,cz-d/2-.02, 0x3a2810));
        // front porch with 2 posts
        const pW=dW+1.2, pD=.7;
        group.add(this._box(pW,.1,pD, cx,dH*.9,cz-d/2-pD/2, trimC));
        for (const px2 of [cx-pW/2+.1,cx+pW/2-.1])
            group.add(this._cyl(.08,.08,dH*.9, px2,dH*.45,cz-d/2-pD+.1, bc));
        group.add(this._box(pW+.2,.12,pD+.2, cx,dH*.9+.06,cz-d/2-pD/2, trimC));
        // windows with shutters
        this._addWindows(group,cx,cz,w,d,1,wallH,.44,.46,rng,'normal');
        const shMat=new THREE.MeshLambertMaterial({color:rng()<.5?0x336644:0x334466});
        const nW=Math.max(1,Math.floor(w/2.2));
        for (let i=0;i<nW;i++) {
            const wx=cx-w/2+(i+.5)*(w/nW);
            for (const sx of [-.3,.3]) { const sh=new THREE.Mesh(new THREE.BoxGeometry(.14,.46,.07),shMat); sh.position.set(wx+sx,wallH*.6,cz-d/2-.04); group.add(sh); }
        }
        // chimney
        const chH=.85+rng()*.5;
        group.add(this._box(.46,chH,.46, cx+(rng()-.5)*(w*.35),wallH+peakH*.55+chH/2,cz+(rng()-.5)*(d*.3),0x8a6050,true));
        // garden flower patches at base
        const gMat=new THREE.MeshLambertMaterial({color:0x2a5018,flatShading:true});
        for (let i=0;i<2+Math.floor(rng()*3);i++) {
            const gx=cx-w*.35+i*(w*.35), gw2=.8+rng()*.6;
            group.add(this._box(gw2,.18,d*.12, gx,0.09,cz-d/2-.14, 0x2a5018));
            const fc=[0xff6644,0xff44aa,0xffcc00,0x88ff44,0xff8844];
            group.add(this._box(gw2*.8,.14,d*.08, gx,.2,cz-d/2-.14, fc[Math.floor(rng()*fc.length)]));
        }
        // weather vane
        if (rng()<.6) {
            const post=this._cyl(.022,.022,.5, cx+(rng()-.5)*w*.3,wallH+peakH+.25,cz,0x888870);
            group.add(post);
            const arrow=new THREE.Mesh(new THREE.BoxGeometry(.72,.07,.07),new THREE.MeshLambertMaterial({color:0xc0a030}));
            arrow.position.set(post.position.x,wallH+peakH+.5+.04,post.position.z);
            group.add(arrow);
            this._animMeshes.push({mesh:arrow,type:'weathervane',phase:rng()*Math.PI*2,speed:.14+rng()*.25});
        }
    }

    _ruralBarn(group, w, d, cx, cz, rng) {
        const height  = 1.9+rng()*.55;
        const isLarge = w*d>25;
        const palette = [0x882820,0x7a2018,0x9a3022,0x6a1e10,0xc4c0b0];
        const bc      = palette[Math.floor(rng()*palette.length)];
        const trim    = 0xd8d0b8;
        const roofC   = 0x404840;
        group.add(this._box(w,height,d, cx,height/2,cz,bc,true));
        const pMat=new THREE.MeshLambertMaterial({ color:0x5a1810 });
        const pc=Math.floor(w/.62);
        for (let i=0;i<=pc;i++) {
            const px=cx-w/2+i*(w/pc);
            for (const pz of [cz-d/2-.02,cz+d/2+.02]) {
                const pk=new THREE.Mesh(new THREE.BoxGeometry(.07,height,.06),pMat);
                pk.position.set(px,height/2,pz); group.add(pk);
            }
        }
        const peakH = d*.45;
        const rMat  = new THREE.MeshLambertMaterial({ color:roofC, flatShading:true });
        const slopeLen = Math.sqrt((d/2)*(d/2)+peakH*peakH);
        const rGeo = new THREE.BoxGeometry(w+.45,.2,slopeLen+.3);
        const ang  = Math.atan2(peakH,d/2);
        const rL   = new THREE.Mesh(rGeo,rMat); rL.position.set(cx,height+peakH/2,cz-d/4); rL.rotation.x=ang; rL.castShadow=true; group.add(rL);
        const rR   = new THREE.Mesh(rGeo.clone(),rMat); rR.position.set(cx,height+peakH/2,cz+d/4); rR.rotation.x=-ang; rR.castShadow=true; group.add(rR);
        group.add(this._box(w+.5,.2,.2, cx,height+peakH,cz,0x3a2810));
        for (const gz of [cz-d/2-.02,cz+d/2+.02]) {
            const verts=new Float32Array([cx-w/2,height,gz, cx+w/2,height,gz, cx,height+peakH,gz]);
            const gGeo=new THREE.BufferGeometry(); gGeo.setAttribute('position',new THREE.BufferAttribute(verts,3));
            gGeo.setIndex([0,1,2]); gGeo.computeVertexNormals();
            group.add(new THREE.Mesh(gGeo,new THREE.MeshLambertMaterial({color:bc,side:THREE.DoubleSide})));
        }
        const dw=Math.min(w*.44,3.4), dh=height*.76;
        group.add(this._box(dw,dh,.1, cx,dh/2,cz-d/2-.05,0x4a1a10));
        group.add(this._box(dw+.25,.13,.12, cx,dh+.07,cz-d/2-.05,trim));
        const xMat=new THREE.MeshLambertMaterial({color:0x3a1208});
        for (const [x1,z1,x2,z2] of [[-dw/2,-dh/2,dw/2,dh/2],[-dw/2,dh/2,dw/2,-dh/2]]) {
            const len=Math.sqrt((x2-x1)**2+(z2-z1)**2);
            const xb=new THREE.Mesh(new THREE.BoxGeometry(len,.08,.08),xMat);
            xb.position.set(cx+(x1+x2)/2,(dh/2)+(z1+z2)/2,cz-d/2-.06);
            xb.rotation.z=Math.atan2(z2-z1,x2-x1); group.add(xb);
        }
        const lw=new THREE.Mesh(new THREE.BoxGeometry(.85,.58,.09),this._winDark);
        lw.position.set(cx,height*.82,cz-d/2-.05); group.add(lw);
        this._addWindows(group,cx,cz,w,d,1,height*.75,.48,.44,rng,'normal');
        if (rng()<.72) {
            const post=this._cyl(.025,.025,.58, cx+(rng()-.5)*w*.3,height+peakH+.29,cz,0x888870);
            group.add(post);
            const arrow=new THREE.Mesh(new THREE.BoxGeometry(.82,.07,.07),new THREE.MeshLambertMaterial({color:0xc0a030}));
            arrow.position.set(post.position.x, height+peakH+.58+.04, post.position.z);
            group.add(arrow);
            this._animMeshes.push({ mesh:arrow, type:'weathervane', phase:rng()*Math.PI*2, speed:.14+rng()*.25 });
        }
        if (isLarge) {
            const sr=.8+rng()*.35, sh=3.0+rng()*1.2;
            const sx=cx+w/2+sr+.35, sz=cz+(rng()-.5)*d*.3;
            const silo=new THREE.Mesh(new THREE.CylinderGeometry(sr,sr,sh,8),new THREE.MeshLambertMaterial({color:0xd8d0a8,flatShading:true}));
            silo.position.set(sx,sh/2,sz); silo.castShadow=true; group.add(silo);
            const dome=new THREE.Mesh(new THREE.SphereGeometry(sr,8,6,0,Math.PI*2,0,Math.PI/2),new THREE.MeshLambertMaterial({color:0xb0a888}));
            dome.position.set(sx,sh,sz); group.add(dome);
        }
    }

    // ── Generic ───────────────────────────────────────────────────────────────
    _makeGenericBuilding(group, w, d, cx, cz, rng) {
        const h=1.6+rng()*.8;
        group.add(this._box(w,h,d, cx,h/2,cz, 0x9a9880+Math.floor(rng()*5)*0x10000, true));
        this._addWindows(group,cx,cz,w,d,1,h,.4,.45,rng,'normal');
        this._addParapet(group,cx,cz,w,d,h,.25,.18,0x787868);
    }

    // ── Shared building helpers ───────────────────────────────────────────────
    _addWindows(group, cx,cz, w,d, numFloors,storyH, winW,winH, rng, style) {
        const faces=[
            { len:w, getPos:(off,y)=>[cx+off,y,cz-d/2-.05], rotY:Math.PI  },
            { len:w, getPos:(off,y)=>[cx+off,y,cz+d/2+.05], rotY:0        },
            { len:d, getPos:(off,y)=>[cx-w/2-.05,y,cz+off], rotY:Math.PI/2 },
            { len:d, getPos:(off,y)=>[cx+w/2+.05,y,cz+off], rotY:-Math.PI/2 },
        ];
        const fMat=new THREE.MeshLambertMaterial({ color:0xd0c8b8 });
        for (const face of faces) {
            const cnt=Math.max(1,Math.floor(face.len/(winW*2.3)));
            const sp=face.len/cnt;
            for (let fl=0;fl<numFloors;fl++) {
                const yw=(fl+.58)*storyH;
                for (let wi=0;wi<cnt;wi++) {
                    if (rng()<.12) continue;
                    const off=-face.len/2+(wi+.5)*sp;
                    const isLit=rng()<.32;
                    const mat=isLit?this._winLit:(rng()<.38?this._winDim:this._winDark);
                    const win=new THREE.Mesh(new THREE.BoxGeometry(winW,winH,.07),mat);
                    win.rotation.y=face.rotY;
                    win.position.set(...face.getPos(off,yw));
                    group.add(win);
                    if (style!=='slit') {
                        const fr=new THREE.Mesh(new THREE.BoxGeometry(winW+.14,winH+.14,.04),fMat);
                        fr.rotation.y=face.rotY;
                        fr.position.set(...face.getPos(off,yw));
                        group.add(fr);
                    }
                }
            }
        }
    }

    _addParapet(group,cx,cz,w,d,height,pH,pW,color) {
        const mat=new THREE.MeshLambertMaterial({color});
        for (const [pw,pd,px,pz] of [
            [w+pW*2,pW,cx,cz-d/2-pW/2],[w+pW*2,pW,cx,cz+d/2+pW/2],
            [pW,d,cx-w/2-pW/2,cz],[pW,d,cx+w/2+pW/2,cz],
        ]) {
            const m=new THREE.Mesh(new THREE.BoxGeometry(pw,pH,pd),mat);
            m.position.set(px,height+pH/2,pz); group.add(m);
        }
    }

    _addWaterTower(group,x,baseY,z) {
        const lMat=new THREE.MeshLambertMaterial({color:0x707060});
        const lH=.9;
        for (let i=0;i<4;i++) {
            const a=i*Math.PI/2+Math.PI/4;
            const leg=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,lH,4),lMat);
            leg.position.set(x+Math.cos(a)*.4,baseY+lH/2,z+Math.sin(a)*.4); group.add(leg);
        }
        const tank=new THREE.Mesh(new THREE.CylinderGeometry(.44,.5,.82,7),new THREE.MeshLambertMaterial({color:0x7a6040,flatShading:true}));
        tank.position.set(x,baseY+lH+.41,z); group.add(tank);
        const lid=new THREE.Mesh(new THREE.CylinderGeometry(.53,.53,.1,7),new THREE.MeshLambertMaterial({color:0x5a4830}));
        lid.position.set(x,baseY+lH+.87,z); group.add(lid);
    }

    // ── Tiny geometry helpers ──────────────────────────────────────────────────
    _box(w,h,d, x,y,z, color, castShadow=false) {
        const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshLambertMaterial({color,flatShading:true}));
        m.position.set(x,y,z); if (castShadow) { m.castShadow=true; m.receiveShadow=true; } return m;
    }
    _cyl(rt,rb,h, x,y,z, color) {
        const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,6),new THREE.MeshLambertMaterial({color}));
        m.position.set(x,y,z); return m;
    }

    // ── Roofs ──────────────────────────────────────────────────────────────────
    _buildRoofs(tileData, buildings) {
        this._buildings = [];
        for (const bldg of buildings) {
            const { floorTiles, tileSet } = bldg;
            const verts  = new Float32Array(floorTiles.length*6*3);
            const colors = new Float32Array(floorTiles.length*6*3);
            let vi=0,ci=0;
            const Y=WALL_H+.01;
            for (const {c:tc,r:tr} of floorTiles) {
                const hex=ROOF_COLOR[tileData[tr][tc]]??0x888888;
                const [rl,gl,bl]=hexToRgb(hex);
                const px=[tc,tc+1,tc+1,tc,tc,tc+1];
                const pz=[tr,tr+1,tr,tr,tr+1,tr+1];
                for (let i=0;i<6;i++) { verts[vi++]=px[i];verts[vi++]=Y;verts[vi++]=pz[i]; colors[ci++]=rl;colors[ci++]=gl;colors[ci++]=bl; }
            }
            const geo=new THREE.BufferGeometry();
            geo.setAttribute('position',new THREE.BufferAttribute(verts,3));
            geo.setAttribute('color',   new THREE.BufferAttribute(colors,3));
            geo.computeVertexNormals();
            const mesh=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({vertexColors:true}));
            mesh.receiveShadow=mesh.castShadow=true;
            this.scene.add(mesh); this._meshes.push(mesh);
            bldg.roofMesh=mesh;
            this._buildings.push(bldg);
        }
    }

    updateRoofVisibility(playerTileX, playerTileZ) {
        const key = `${Math.floor(playerTileX)},${Math.floor(playerTileZ)}`;
        for (const b of this._buildings) {
            const inside = b.tileSet.has(key);
            if (b.roofMesh) b.roofMesh.visible = !inside;
            if (b.extGroup) b.extGroup.visible  = !inside;
        }
    }

    // ── Entrance glows ─────────────────────────────────────────────────────────
    _buildEntranceGlows(tileData) {
        const doorTiles=[]; const doorSet=new Set();
        for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++)
            if (tileData[r][c]===TILE.DOOR) { doorTiles.push({c,r}); doorSet.add(`${c},${r}`); }
        const visited=new Set(); const groups=[];
        for (const {c,r} of doorTiles) {
            const key=`${c},${r}`; if (visited.has(key)) continue;
            let maxC=c; while(doorSet.has(`${maxC+1},${r}`)) maxC++;
            if (maxC>c) { for(let cc=c;cc<=maxC;cc++) visited.add(`${cc},${r}`); groups.push({cx:(c+maxC+1)/2,cz:r+.5,w:maxC-c+1+.5,d:1.5}); }
            else { let maxR=r; while(doorSet.has(`${c},${maxR+1}`)) maxR++; for(let rr=r;rr<=maxR;rr++) visited.add(`${c},${rr}`); groups.push({cx:c+.5,cz:(r+maxR+1)/2,w:1.5,d:maxR-r+1+.5}); }
        }
        this._doorGlows=[];
        for (const g of groups) {
            const phase=Math.random()*Math.PI*2;
            const oGeo=new THREE.PlaneGeometry(g.w+.8,g.d+.8); oGeo.rotateX(-Math.PI/2);
            const oMat=new THREE.MeshBasicMaterial({color:0xffdd00,transparent:true,opacity:.18,depthWrite:false});
            const oM=new THREE.Mesh(oGeo,oMat); oM.position.set(g.cx,.03,g.cz); this.scene.add(oM);
            this._doorGlows.push({mat:oMat,phase,base:.18,amp:.08});
            const iGeo=new THREE.PlaneGeometry(g.w,g.d); iGeo.rotateX(-Math.PI/2);
            const iMat=new THREE.MeshBasicMaterial({color:0xffe840,transparent:true,opacity:.55,depthWrite:false});
            const iM=new THREE.Mesh(iGeo,iMat); iM.position.set(g.cx,.05,g.cz); this.scene.add(iM);
            this._doorGlows.push({mat:iMat,phase,base:.55,amp:.2});
        }
    }

    updateGlows(time) {
        const t=time*.0025;
        for (const g of this._doorGlows) g.mat.opacity=g.base+g.amp*Math.sin(t+g.phase);
    }

    // ── Animations ─────────────────────────────────────────────────────────────
    updateAnimations(time) {
        const t=time*.001;
        for (const a of this._animMeshes) {
            switch(a.type) {
                case 'vine':
                    a.mesh.rotation.z=Math.sin(t*a.speed+a.phase)*a.amp;
                    a.mesh.rotation.x=Math.sin(t*a.speed*.7+a.phase+1)*a.amp*.4;
                    break;
                case 'smoke': {
                    const cy=((t*a.speed+a.phase/(Math.PI*2))%1+1)%1;
                    a.mesh.position.y=a.baseY+cy*.55;
                    a.mesh.material.opacity=.62*(1-cy);
                    break;
                }
                case 'sway':
                    a.mesh.rotation.z=Math.sin(t*a.speed+a.phase)*a.amp;
                    break;
                case 'weathervane':
                    a.mesh.rotation.y=a.phase+Math.sin(t*a.speed)*.9+t*a.speed*.08;
                    break;
            }
        }
    }

    // ── Props ──────────────────────────────────────────────────────────────────
    _buildProps() {
        for (const { x, y, type } of getTreePositions()) {
            const tx=x/TS, tz=y/TS;
            if (type==='palm_tree') this._addPalmTree(tx,tz);
            else if (type==='snow_pine') this._addSnowPine(tx,tz);
            else this._addTree(tx,tz);
        }
        for (const { x, y, type } of getBushPositions()) this._addBush(x/TS, y/TS, type);
        for (const { x, y } of getRockPositions()) this._addRock(x/TS, y/TS);
        const covers=getCoverObjectPositions();
        const addCover=(list,w,h,d,color)=>{
            if (!list?.length) return;
            const geo=new THREE.BoxGeometry(w,h,d);
            const mat=new THREE.MeshLambertMaterial({color,flatShading:true});
            const mesh=new THREE.InstancedMesh(geo,mat,list.length);
            mesh.castShadow=true;
            const dummy=new THREE.Object3D();
            list.forEach(({x,y},i)=>{ dummy.position.set(x/TS,h/2,y/TS); dummy.updateMatrix(); mesh.setMatrixAt(i,dummy.matrix); });
            mesh.instanceMatrix.needsUpdate=true;
            this.scene.add(mesh); this._meshes.push(mesh);
        };
        addCover(covers.sandbags,  1.3,.6,.8,  0xd8a848);
        addCover(covers.containers,3.0,1.8,1.5,0x3a6030);
        addCover(covers.cars,      2.2,.9,1.2, 0xcc3030);
        addCover(covers.barrels,   .9,1.2,.9,  0x8a5830);
        addCover(covers.dumpsters, 1.5,1.1,1.0,0x18a028);
        addCover(covers.fences,    2.0,.6,.2,  0xa07838);
    }

    _addTree(tx,tz) {
        const g=new THREE.Group();
        const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.28,1.2,6),new THREE.MeshLambertMaterial({color:0x4a2406,flatShading:true}));
        trunk.position.set(0,.6,0); trunk.castShadow=true; g.add(trunk);
        for (const l of [{r:1.5,y:1.5,c:0x2aaa08},{r:1.8,y:1.9,c:0x38c010},{r:1.4,y:2.6,c:0x4ad020}]) {
            const m=new THREE.Mesh(new THREE.SphereGeometry(l.r,6,5),new THREE.MeshLambertMaterial({color:l.c,flatShading:true}));
            m.position.set(0,l.y,0); m.castShadow=true; g.add(m);
        }
        g.position.set(tx,0,tz); this.scene.add(g);
    }

    _addPalmTree(tx,tz) {
        const g=new THREE.Group();
        const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.12,.22,2.8,6),new THREE.MeshLambertMaterial({color:0x7a4a1a,flatShading:true}));
        trunk.position.set(.3,1.4,0); trunk.rotation.z=-.12; trunk.castShadow=true; g.add(trunk);
        const fMat=new THREE.MeshLambertMaterial({color:0x38a020,flatShading:true});
        for (const deg of [0,72,144,216,288]) {
            const fr=new THREE.Mesh(new THREE.BoxGeometry(1.6,.08,.3),fMat);
            fr.position.set(.3+Math.cos(deg*Math.PI/180)*.8,2.8,Math.sin(deg*Math.PI/180)*.8);
            fr.rotation.y=deg*Math.PI/180; fr.rotation.z=.3; fr.castShadow=true; g.add(fr);
        }
        const crown=new THREE.Mesh(new THREE.SphereGeometry(.3,5,4),new THREE.MeshLambertMaterial({color:0x6a4010,flatShading:true}));
        crown.position.set(.3,2.8,0); g.add(crown);
        g.position.set(tx,0,tz); this.scene.add(g);
    }

    _addSnowPine(tx,tz) {
        const g=new THREE.Group();
        const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.1,.2,1.0,5),new THREE.MeshLambertMaterial({color:0x3e1e08,flatShading:true}));
        trunk.position.set(0,.5,0); trunk.castShadow=true; g.add(trunk);
        for (const t of [{ry:.9,rb:1.3,h:.9,y:1.0,c:0x2a6020},{ry:.7,rb:1.0,h:.8,y:1.7,c:0x347828},{ry:.4,rb:.7,h:.7,y:2.3,c:0x3e8a30},{ry:.15,rb:.45,h:.6,y:2.8,c:0x48a038}]) {
            const cone=new THREE.Mesh(new THREE.ConeGeometry(t.rb,t.h,7),new THREE.MeshLambertMaterial({color:t.c,flatShading:true}));
            cone.position.set(0,t.y,0); cone.castShadow=true; g.add(cone);
            const cap=new THREE.Mesh(new THREE.ConeGeometry(t.rb*.7,t.h*.25,7),new THREE.MeshLambertMaterial({color:0xe8f4ff,flatShading:true}));
            cap.position.set(.12,t.y-t.h*.1,0); cap.rotation.z=.15; g.add(cap);
        }
        g.position.set(tx,0,tz); this.scene.add(g);
    }

    _addBush(tx,tz,type) {
        const g=new THREE.Group();
        const c1=type==='jungle_bush'?0x208018:type==='snow_bush'?0xd0e8ff:0x3aaa14;
        const c2=type==='jungle_bush'?0x48c030:type==='snow_bush'?0xffffff:0x60d030;
        for (const o of [{x:-.38,z:.1,r:.42},{x:.38,z:.1,r:.42},{x:0,z:-.2,r:.44},{x:0,z:.3,r:.34}]) {
            const m=new THREE.Mesh(new THREE.SphereGeometry(o.r,5,4),new THREE.MeshLambertMaterial({color:o.r>.4?c1:c2,flatShading:true}));
            m.position.set(o.x,o.r*.7,o.z); m.castShadow=true; g.add(m);
        }
        g.position.set(tx,0,tz); this.scene.add(g);
    }

    _addRock(tx,tz) {
        const g=new THREE.Group();
        for (const o of [{x:0,y:.28,z:0,r:.38,s:[1,.7,.9]},{x:.35,y:.22,z:.1,r:.28,s:[.9,.6,1.1]}]) {
            const m=new THREE.Mesh(new THREE.SphereGeometry(o.r,5,4),new THREE.MeshLambertMaterial({color:0x8c8878,flatShading:true}));
            m.position.set(o.x,o.y,o.z); m.scale.set(...o.s); m.castShadow=true; g.add(m);
        }
        g.position.set(tx,0,tz); this.scene.add(g);
    }

    isWallAt(col,row) {
        const c=Math.floor(col), r=Math.floor(row);
        if (c<0||c>=COLS||r<0||r>=ROWS) return true;
        return this.wallGrid[r][c];
    }

    destroy() {
        for (const m of this._meshes) {
            this.scene.remove(m);
            m.traverse?.(child => {
                child.geometry?.dispose();
                (Array.isArray(child.material)?child.material:[child.material]).forEach(x=>x?.dispose());
            });
        }
        this._meshes=[];
    }
}
