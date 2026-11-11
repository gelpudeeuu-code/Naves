'use strict';
/* NAVES — Asalto Estelar. Motor del juego. */

// ====================================================================== render
const canvas = $('game');
let renderer;
try {
  renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  $('nowebgl').classList.remove('hidden');
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;

const scene = new T.Scene();
scene.background = new T.Color(THEMES[0].bg);
scene.fog = new T.Fog(THEMES[0].bg, 60, 100);
const camera = new T.PerspectiveCamera(52, 1, 0.5, 800);

(function makeEnvironment() {
  const pm = new T.PMREMGenerator(renderer);
  const s = new T.Scene();
  const geo = new T.SphereGeometry(50, 32, 16);
  const p = geo.attributes.position, col = [];
  const top = new T.Color(0x9fc4ff), mid = new T.Color(0x18203a), bot = new T.Color(0x3a1c5a), c = new T.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 50;
    c.copy(mid).lerp(y > 0 ? top : bot, Math.abs(y));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  s.add(new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
  const panel = (x, y, z, k) => {
    const m = new T.Mesh(new T.BoxGeometry(16, 16, 16), new T.MeshBasicMaterial({ color: new T.Color(k, k, k) }));
    m.position.set(x, y, z); s.add(m);
  };
  panel(-20, 36, 10, 6); panel(30, 20, -25, 3); panel(0, -40, 0, 0.6);
  scene.environment = pm.fromScene(s, 0.03).texture;
  pm.dispose();
})();

const sun = new T.DirectionalLight(0xffffff, 2.3);
sun.position.set(-8, 16, 10);
const rim = new T.DirectionalLight(THEMES[0].rim, 1.8);
rim.position.set(6, 5, -14);
scene.add(sun, rim, new T.AmbientLight(0x8090b0, 0.45));

// ====================================================================== puntos luminosos
class Glow {
  constructor(max, order) {
    this.max = max; this.n = 0;
    this.p = new Float32Array(max * 3); this.c = new Float32Array(max * 3); this.s = new Float32Array(max * 2);
    const g = (this.geo = new T.BufferGeometry());
    const attr = (arr, n) => { const a = new T.BufferAttribute(arr, n); a.setUsage(T.DynamicDrawUsage); return a; };
    g.setAttribute('position', attr(this.p, 3));
    g.setAttribute('aColor', attr(this.c, 3));
    g.setAttribute('aSA', attr(this.s, 2));
    this.mat = new T.ShaderMaterial({
      uniforms: { uScale: { value: 500 } },
      vertexShader: `
        attribute vec3 aColor; attribute vec2 aSA; uniform float uScale;
        varying vec3 vColor; varying float vAlpha;
        void main() {
          vColor = aColor; vAlpha = aSA.y;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = min(aSA.x * uScale / -mv.z, 400.0);
        }`,
      fragmentShader: `
        varying vec3 vColor; varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          if (d > 1.0) discard;
          float halo = pow(1.0 - d, 2.2);
          float core = smoothstep(0.42, 0.08, d);
          gl_FragColor = vec4((vColor * halo * 1.5 + vec3(core) * 0.85) * vAlpha, 1.0);
        }`,
      blending: T.AdditiveBlending, depthWrite: false, transparent: true,
    });
    this.obj = new T.Points(g, this.mat);
    this.obj.frustumCulled = false;
    this.obj.renderOrder = order;
    scene.add(this.obj);
  }
  add(x, y, z, size, r, g, b, a) {
    if (this.n >= this.max) return;
    const i = this.n++, i3 = i * 3, i2 = i * 2;
    this.p[i3] = x; this.p[i3 + 1] = y; this.p[i3 + 2] = z;
    this.c[i3] = r; this.c[i3 + 1] = g; this.c[i3 + 2] = b;
    this.s[i2] = size; this.s[i2 + 1] = a;
  }
  flush() {
    this.geo.setDrawRange(0, this.n);
    const at = this.geo.attributes;
    at.position.needsUpdate = at.aColor.needsUpdate = at.aSA.needsUpdate = true;
  }
}
const starGlow = new Glow(1100, -5);
const glow = new Glow(4000, 10);

// ====================================================================== encuadre
const view = { W: 14, zMin: -12, zMax: 5, spawnZ: -50, d: 30 };
const ELEV = 48 * Math.PI / 180;
const camPos = new T.Vector3(0, 4, 10), camLook = new T.Vector3(), desPos = new T.Vector3(), desLook = new T.Vector3();
const tmpV = new T.Vector3(), tmpV2 = new T.Vector3();

function gamePose(px, outPos, outLook) {
  outLook.set(px * 0.12, 0, -6);
  outPos.set(px * 0.2, Math.sin(ELEV) * view.d, -6 + Math.cos(ELEV) * view.d);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.clearViewOffset();
  camera.updateProjectionMatrix();
  view.W = clamp(6 + 6 * camera.aspect, 8, 16);
  for (let d = 22; d <= 90; d += 1) {
    view.d = d;
    gamePose(view.W, tmpV, tmpV2);
    camera.position.copy(tmpV); camera.lookAt(tmpV2); camera.updateMatrixWorld();
    tmpV.set(view.W + 1.8, 0, view.zMax).project(camera);
    const okX = Math.abs(tmpV.x) < 0.98;
    tmpV.set(view.W * 0.2, 0, view.zMax + 1.8).project(camera);
    if (okX && tmpV.y > -0.8) break;
  }
  gamePose(0, tmpV, tmpV2);
  camera.position.copy(tmpV); camera.lookAt(tmpV2); camera.updateMatrixWorld();
  tmpV.set(0, 0.97, 0.5).unproject(camera).sub(camera.position).normalize();
  const zTop = tmpV.y < -0.01 ? camera.position.z + tmpV.z * (-camera.position.y / tmpV.y) : -80;
  view.spawnZ = clamp(zTop - 7, -85, -44);
  const cz = camera.position.z, cy = camera.position.y;
  scene.fog.near = Math.hypot(cy, cz - (view.spawnZ + 13));
  scene.fog.far = Math.hypot(cy, cz - view.spawnZ) + 3;
  const sc = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
  glow.mat.uniforms.uScale.value = sc;
  starGlow.mat.uniforms.uScale.value = sc;
  if (bg.planet) setTheme(bg.theme || 0);
}

// ====================================================================== fondo
const bg = { speed: 14, warp: 0, stars: [], nebulas: [], planet: null, atmo: null, texCache: {} };
(function buildBackground() {
  for (let i = 0; i < 900; i++) {
    const tint = Math.random();
    bg.stars.push({
      x: rand(-170, 170), y: rand(-130, -8), z: rand(-280, 40), s: rand(0.5, 1.7), sp: rand(0.5, 1.5),
      r: 0.7 + 0.3 * tint, g: 0.8, b: 1 - 0.25 * tint, a: rand(0.35, 1),
    });
  }
  for (let i = 0; i < 110; i++) {
    bg.stars.push({ x: rand(-40, 40), y: rand(-5, -1), z: rand(-90, 30), s: 0.22, sp: 4, r: 0.7, g: 0.85, b: 1, a: 0.5, dust: true });
  }
  const tex = nebulaTexture();
  const geo = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  for (let i = 0; i < 7; i++) {
    const m = new T.Mesh(geo, new T.MeshBasicMaterial({
      map: tex, transparent: true, opacity: rand(0.35, 0.6), blending: T.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false,
    }));
    const s = rand(130, 230);
    m.scale.set(s, 1, s);
    m.position.set(rand(-110, 110), rand(-125, -70), rand(-300, 20));
    m.rotation.y = rand(TAU);
    m.renderOrder = -8;
    scene.add(m); bg.nebulas.push(m);
  }
  bg.planet = new T.Mesh(new T.SphereGeometry(44, 48, 32), new T.MeshStandardMaterial({ color: 0x5a6472, roughness: 1, metalness: 0, fog: false, envMapIntensity: 0.05 }));
  bg.planet.rotation.z = 0.35;
  bg.atmo = new T.Mesh(new T.SphereGeometry(45.6, 48, 32), new T.ShaderMaterial({
    uniforms: { uColor: { value: new T.Color() } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 2.6); gl_FragColor = vec4(uColor * f * 1.6, 1.0); }`,
    blending: T.AdditiveBlending, transparent: true, depthWrite: false,
  }));
  bg.planet.renderOrder = -7; bg.atmo.renderOrder = -6;
  scene.add(bg.planet, bg.atmo);
})();

function setTheme(i) {
  const th = THEMES[i % THEMES.length];
  scene.background.set(th.bg);
  scene.fog.color.set(th.bg);
  rim.color.set(th.rim);
  bg.nebulas.forEach((m, k) => m.material.color.set(th.neb[k % th.neb.length]));
  if (!bg.texCache[i]) bg.texCache[i] = planetTexture(th.planet, th.bands);
  bg.planet.material.map = bg.texCache[i];
  bg.planet.material.needsUpdate = true;
  bg.theme = i;
  bg.planet.position.set(th.ppos[0] * clamp(camera.aspect / 1.78, 0.35, 1.15), th.ppos[1], th.ppos[2]);
  bg.atmo.position.copy(bg.planet.position);
  bg.atmo.material.uniforms.uColor.value.set(th.atmo);
}

function updBackground(dt) {
  const target = 14 + bg.warp * 190;
  bg.speed += (target - bg.speed) * Math.min(1, dt * 3);
  const v = bg.speed * dt;
  starGlow.n = 0;
  const stretch = 1 + bg.warp * 1.5;
  for (const s of bg.stars) {
    s.z += v * s.sp;
    if (s.z > 40) { s.z -= s.dust ? 120 : 320; s.x = s.dust ? rand(-40, 40) : rand(-170, 170); }
    starGlow.add(s.x, s.y, s.z, s.s * stretch, s.r, s.g, s.b, s.a);
  }
  starGlow.flush();
  for (const m of bg.nebulas) {
    m.position.z += v * 0.45;
    if (m.position.z > 110) { m.position.z -= 420; m.position.x = rand(-110, 110); }
  }
  bg.planet.rotation.y += dt * 0.02;
}

// ====================================================================== estado
const state = { mode: 'menu', sel: +Store.get('naves_ship', 0) || 0, time: 0, shake: 0, shift: 0.1, hi: +Store.get('naves_hi', 0) || 0 };
if (!(state.sel >= 0 && state.sel < SHIPS.length)) state.sel = 0;
const run = { sector: 0, loop: 0, score: 0, mult: 1, chain: 0, chainT: 0, phase: 'waves', pt: 0, st: 0, queue: [], dropMeter: 0.5, hpMul: 1, bs: 1, fr: 1 };
const player = {
  ship: SHIPS[0], mesh: null, x: 0, z: 2, vx: 0, vz: 0, hp: 5, maxHp: 5, lives: 2, wlvl: 1, fireT: 0, inv: 0, alive: true,
  specials: 2, overdrive: 0, respawnT: 0, intro: false, missiles: 0, missT: 0, r: 0.45,
};
let boss = null;
let enemies = [];
const ebullets = [], pbullets = [], pickups = [], parts = [], beams = [], rings = [];

buildEnemyProtos();
const shipMeshes = SHIPS.map((s) => { const m = buildShip(s.id); m.visible = false; scene.add(m); return m; });
const pickupProto = { P: buildPickup('P'), H: buildPickup('H'), S: buildPickup('S') };
const whiteMat = new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });

// ---- balas del jugador (instanciadas)
const PB_MAX = 420;
const pbMesh = new T.InstancedMesh(
  new T.CylinderGeometry(0.5, 0.5, 1, 6).rotateX(Math.PI / 2),
  new T.MeshBasicMaterial({ color: 0xffffff, blending: T.AdditiveBlending, depthWrite: false, transparent: true, fog: false, toneMapped: false }),
  PB_MAX,
);
pbMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
pbMesh.frustumCulled = false;
pbMesh.renderOrder = 8;
for (let i = 0; i < PB_MAX; i++) pbMesh.setColorAt(i, new T.Color(1, 1, 1));
pbMesh.count = 0;
scene.add(pbMesh);

// ---- escombros (instanciados)
const DEB_MAX = 90;
const debMesh = new T.InstancedMesh(new T.TetrahedronGeometry(0.34), std(0x59606e, 0.7, 0.5), DEB_MAX);
debMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
debMesh.frustumCulled = false;
debMesh.count = 0;
scene.add(debMesh);
const debris = [];
const dummy = new T.Object3D();
const tmpC = new T.Color();

// ====================================================================== efectos
const EX = {
  fire: [1, 0.55, 0.15], red: [1, 0.3, 0.25], purple: [0.8, 0.4, 1], teal: [0.3, 1, 0.8], rock: [0.8, 0.65, 0.5],
  blue: [0.3, 0.75, 1], green: [0.55, 1, 0.35], magenta: [1, 0.3, 0.95], white: [1, 1, 1],
};
const EB_COL = [[1, 0.22, 0.42], [1, 0.58, 0.12], [0.4, 1, 0.5], [0.8, 0.42, 1]];

function spark(x, y, z, vx, vy, vz, life, size, r, g, b, drag = 2) {
  if (parts.length > 1700) return;
  parts.push({ x, y, z, vx, vy, vz, life, max: life, size, r, g, b, drag });
}
function addDebris(x, z, n, size) {
  for (let i = 0; i < n && debris.length < DEB_MAX; i++) {
    const a = rand(TAU), sp = rand(3, 10) * Math.sqrt(size);
    debris.push({
      x, y: 0.3, z, vx: Math.cos(a) * sp, vy: rand(2, 9), vz: Math.sin(a) * sp + 4,
      rx: rand(TAU), ry: rand(TAU), wx: rand(-9, 9), wy: rand(-9, 9), life: rand(0.7, 1.4), s: rand(0.6, 1.5) * Math.sqrt(size),
    });
  }
}
const ringGeo = new T.RingGeometry(0.91, 1, 64).rotateX(-Math.PI / 2);
function addRing(x, z, r0, r1, dur, col) {
  let r = rings.find((q) => !q.on);
  if (!r) {
    if (rings.length >= 16) return;
    const mesh = new T.Mesh(ringGeo, new T.MeshBasicMaterial({
      transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false, side: T.DoubleSide, toneMapped: false,
    }));
    mesh.renderOrder = 9;
    scene.add(mesh);
    r = { mesh, on: false };
    rings.push(r);
  }
  r.on = true; r.t = 0; r.dur = dur; r.r0 = r0; r.r1 = r1;
  r.mesh.visible = true;
  r.mesh.position.set(x, 0.25, z);
  r.mesh.material.color.setRGB(col[0], col[1], col[2]);
}
function explode(x, z, size = 1, col = EX.fire, quiet = false) {
  const n = Math.round(12 * size + 6), q = Math.sqrt(size);
  for (let i = 0; i < n; i++) {
    const a = rand(TAU), sp = rand(3, 13) * q;
    spark(x, 0.3, z, Math.cos(a) * sp, rand(-1, 6), Math.sin(a) * sp, rand(0.35, 0.85), rand(0.8, 1.9) * q, col[0], col[1], col[2], 2.6);
  }
  spark(x, 0.6, z, 0, 0, 0, 0.2, 7.5 * size, 1, 0.9, 0.75, 0);
  spark(x, 0.6, z, 0, 0, 0, 0.5, 4.5 * size, col[0], col[1], col[2], 0);
  addRing(x, z, 0.5 * size, 4.5 * size, 0.36, col);
  addDebris(x, z, Math.round(2.5 * size + 1), size);
  state.shake = Math.min(1.8, state.shake + 0.2 * size);
  if (!quiet) Sound.boom(size);
}
function hitSpark(x, z, col) {
  for (let i = 0; i < 3; i++) {
    const a = rand(TAU), sp = rand(4, 10);
    spark(x, 0.4, z, Math.cos(a) * sp, rand(0, 4), Math.sin(a) * sp, 0.22, 0.9, col[0], col[1], col[2], 3);
  }
}
function updEffects(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
    const k = Math.exp(-p.drag * dt);
    p.vx *= k; p.vy *= k; p.vz *= k;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
  }
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i];
    d.life -= dt;
    if (d.life <= 0) { debris[i] = debris[debris.length - 1]; debris.pop(); continue; }
    d.vy -= 14 * dt;
    d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
    d.rx += d.wx * dt; d.ry += d.wy * dt;
  }
  for (const r of rings) {
    if (!r.on) continue;
    r.t += dt;
    const k = r.t / r.dur;
    if (k >= 1) { r.on = false; r.mesh.visible = false; continue; }
    const e = 1 - (1 - k) * (1 - k);
    const s = lerp(r.r0, r.r1, e);
    r.mesh.scale.set(s, 1, s);
    r.mesh.material.opacity = 1 - k;
  }
}
function flashScreen(color, a, ms = 500) {
  const el = $('flash');
  el.style.transition = 'none';
  el.style.background = color;
  el.style.opacity = a;
  void el.offsetWidth;
  el.style.transition = 'opacity ' + ms + 'ms ease-out';
  el.style.opacity = 0;
}

// ====================================================================== disparos
function pshot(x, z, ang, dmg, o) {
  if (pbullets.length >= PB_MAX) return;
  const spd = (o && o.spd) || 48;
  pbullets.push(Object.assign({
    x, z, vx: Math.sin(ang) * spd, vz: -Math.cos(ang) * spd, dmg, r: 0.3, w: 0.17, len: 1.6, life: 1.7,
    col: player.ship.color, pierce: false, hit: null, homing: false, dead: false,
  }, o));
}
function eShot(x, z, ang, spd, c = 0, size = 1) {
  if (ebullets.length > 900) return;
  ebullets.push({ x, z, vx: Math.sin(ang) * spd, vz: Math.cos(ang) * spd, r: 0.32 * size, s: size, c });
}
const aimAng = (x, z) => Math.atan2(player.x - x, player.z - z);
function fan(x, z, ang, n, spread, spd, c, size) {
  for (let i = 0; i < n; i++) eShot(x, z, ang + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread), spd, c, size);
}
function ringShot(x, z, n, spd, off, c, size) {
  for (let i = 0; i < n; i++) eShot(x, z, off + (i / n) * TAU, spd, c, size);
}
function clearEnemyBullets(score) {
  for (const b of ebullets) {
    const c = EB_COL[b.c];
    spark(b.x, 0.2, b.z, 0, 3, 0, 0.35, 1.4, c[0], c[1], c[2], 1);
  }
  if (score) addScore(ebullets.length * 10);
  ebullets.length = 0;
}

const beamTex = beamTexture();
const beamGeo = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
function addBeam(o) {
  const mesh = new T.Mesh(beamGeo, new T.MeshBasicMaterial({
    map: beamTex, color: o.color || 0xff5a9a, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false, side: T.DoubleSide,
  }));
  mesh.renderOrder = 9;
  scene.add(mesh);
  const b = Object.assign({ x: 0, off: 0, oz: 2, w: 2.4, warn: 1.1, dur: 1.6, t: 0, mesh, fired: false }, o);
  beams.push(b);
  Sound.charge();
  return b;
}
function updBeams(dt) {
  for (let i = beams.length - 1; i >= 0; i--) {
    const b = beams[i];
    b.t += dt;
    if (b.follow) { b.x = b.follow.x + b.off * b.follow.sc; b.z0 = b.follow.z + b.oz * b.follow.sc; }
    const len = view.zMax + 16 - b.z0;
    b.mesh.position.set(b.x, 0.15, b.z0 + len / 2);
    if (b.t < b.warn) {
      b.mesh.scale.set(0.35 + 0.15 * Math.sin(b.t * 40), 1, len);
      b.mesh.material.opacity = 0.35 + 0.3 * Math.abs(Math.sin(b.t * 14));
    } else if (b.t < b.warn + b.dur) {
      if (!b.fired) { b.fired = true; Sound.laser(); state.shake += 0.4; }
      const k = Math.min(1, (b.t - b.warn) / 0.12, (b.warn + b.dur - b.t) / 0.2);
      b.mesh.scale.set(b.w * 2.2 * k * (1 + 0.08 * Math.sin(b.t * 60)), 1, len);
      b.mesh.material.opacity = 1;
      for (let j = 0; j < 2; j++) {
        spark(b.x + rand(-b.w, b.w) * 0.5, 0.2, rand(b.z0, b.z0 + len), rand(-3, 3), rand(0, 3), rand(4, 12), 0.3, 1.2, 1, 0.5, 0.75, 1);
      }
      if (k > 0.6 && Math.abs(player.x - b.x) < b.w * 0.5 + player.r * 0.7 && player.z > b.z0) hurtPlayer();
    } else {
      scene.remove(b.mesh); b.mesh.material.dispose();
      beams.splice(i, 1);
    }
  }
}
function clearBeams() {
  for (const b of beams) { scene.remove(b.mesh); b.mesh.material.dispose(); }
  beams.length = 0;
}

// ====================================================================== jugador
function fire() {
  const p = player, s = p.ship, L = p.wlvl, x = p.x, z = p.z - 1.3, d = s.dmg;
  if (s.pattern === 'twin') {
    pshot(x - 0.5, z, 0, d); pshot(x + 0.5, z, 0, d);
    const side = { w: 0.13, len: 1.3 };
    if (L >= 2) { pshot(x - 1.2, z + 0.9, -0.13, d * 0.45, side); pshot(x + 1.2, z + 0.9, 0.13, d * 0.45, side); }
    if (L >= 3) { pshot(x - 2.0, z + 1.4, 0, d * 0.45, side); pshot(x + 2.0, z + 1.4, 0, d * 0.45, side); }
    if (L >= 4) { pshot(x - 1.0, z + 0.6, -0.36, d * 0.45, side); pshot(x + 1.0, z + 0.6, 0.36, d * 0.45, side); }
  } else if (s.pattern === 'spread') {
    const n = L === 1 ? 3 : L <= 3 ? 5 : 7, dd = L >= 3 ? d * 1.15 : d;
    for (let i = 0; i < n; i++) pshot(x, z, (i - (n - 1) / 2) * 0.13, dd, { w: 0.14, len: 1.3, spd: 52 });
  } else {
    const big = { r: 0.6, w: 0.46, len: 2.4, pierce: true, hit: [], spd: 42 };
    const dd = L >= 2 ? d * 1.25 : d;
    if (L >= 4) { pshot(x - 0.5, z - 0.6, 0, dd * 0.7, { ...big, hit: [] }); pshot(x + 0.5, z - 0.6, 0, dd * 0.7, { ...big, hit: [] }); }
    else pshot(x, z - 0.6, 0, dd, big);
    if (L >= 3) { pshot(x - 1.75, z + 0.3, L >= 4 ? -0.1 : 0, 1); pshot(x + 1.75, z + 0.3, L >= 4 ? 0.1 : 0, 1); }
  }
  Sound.shoot(s.pattern);
}

function useSpecial() {
  const p = player;
  if (state.mode !== 'play' || !p.alive || p.intro || p.specials <= 0) return;
  if (run.phase === 'clear' || run.phase === 'warp') return;
  p.specials--;
  Sound.special();
  if (p.ship.id === 'halcon') {
    p.missiles = 12; p.missT = 0;
  } else if (p.ship.id === 'centella') {
    p.overdrive = 6;
    addRing(p.x, p.z, 1, 9, 0.5, EX.fire);
  } else {
    addRing(p.x, p.z, 1, 70, 0.8, EX.red);
    addRing(p.x, p.z, 1, 45, 0.9, EX.white);
    flashScreen('#ffd0c0', 0.5, 600);
    state.shake = 1.8;
    clearEnemyBullets(true);
    for (const e of enemies) if (!e.dead && e.z > view.spawnZ + 6) hurtEnemy(e, 32, e.x, e.z);
    if (boss) hurtBoss(120, boss.x, boss.z);
  }
}

function hurtPlayer() {
  const p = player;
  if (!p.alive || p.inv > 0 || p.overdrive > 0 || p.intro || run.phase === 'clear' || run.phase === 'warp') return;
  p.hp--;
  p.inv = 1.7;
  run.chain = 0; run.mult = 1;
  state.shake = 1.4;
  Sound.hurt();
  flashScreen('#ff2040', 0.35, 450);
  hitSpark(p.x, p.z, EX.white);
  if (p.hp <= 0) {
    p.alive = false;
    p.mesh.visible = false;
    explode(p.x, p.z, 2.4, EX.blue);
    Sound.bigBoom();
    if (p.lives > 0) { p.lives--; p.respawnT = 1.8; } else { run.phase = 'dead'; run.pt = 0; }
  }
}
function respawn() {
  const p = player;
  p.alive = true; p.hp = p.maxHp; p.inv = 3; p.wlvl = Math.max(1, p.wlvl - 1);
  p.x = 0; p.z = view.zMax + 9; p.vx = p.vz = 0; p.intro = true;
  p.mesh.visible = true;
  touch.active = false;
}

const keys = {};
const touch = { active: false, id: null, sx: 0, sy: 0, px: 0, pz: 0, tx: 0, tz: 0 };

function updPlayer(dt) {
  const p = player, sp = p.ship.speed;
  if (!p.alive) {
    if (p.respawnT > 0 && (p.respawnT -= dt) <= 0) respawn();
    return;
  }
  if (p.intro) {
    p.z += (2 - p.z) * Math.min(1, dt * 2.6);
    p.vz = -6; p.vx *= 0.9;
    if (p.z < 2.4) { p.intro = false; p.vz = 0; }
  } else {
    let tvx, tvz;
    if (touch.active) {
      tvx = clamp((touch.tx - p.x) * 14, -sp * 1.5, sp * 1.5);
      tvz = clamp((touch.tz - p.z) * 14, -sp * 1.5, sp * 1.5);
    } else {
      const ix = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
      const iz = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
      const l = Math.hypot(ix, iz) || 1;
      tvx = (ix / l) * sp; tvz = (iz / l) * sp;
    }
    const k = 1 - Math.exp(-dt * 14);
    p.vx += (tvx - p.vx) * k; p.vz += (tvz - p.vz) * k;
    p.x = clamp(p.x + p.vx * dt, -view.W, view.W);
    p.z = clamp(p.z + p.vz * dt, view.zMin, view.zMax);
    const canFire = run.phase === 'waves' || run.phase === 'warn' || run.phase === 'boss';
    p.fireT -= dt;
    if (canFire && p.fireT <= 0) {
      fire();
      p.fireT = p.ship.fireRate * (p.wlvl >= 4 ? 0.85 : 1) * (p.overdrive > 0 ? 0.5 : 1);
    }
    if (p.missiles > 0 && (p.missT -= dt) <= 0) {
      p.missT = 0.06;
      const side = p.missiles % 2 ? 1 : -1;
      pshot(p.x + side * 0.8, p.z, side * rand(0.5, 1.3), 10, { homing: true, spd: 30, r: 0.55, w: 0.26, len: 1.1, life: 3.2, col: 0xffa040 });
      p.missiles--;
      Sound.missile();
    }
  }
  if (p.inv > 0) p.inv -= dt;
  if (p.overdrive > 0) {
    p.overdrive -= dt;
    const a = rand(TAU);
    spark(p.x + Math.cos(a) * 1.6, 0.2, p.z + Math.sin(a) * 1.6, 0, 2, 8, 0.3, 1.3, 1, 0.8, 0.2, 1);
  }
  const m = p.mesh;
  m.position.set(p.x, Math.sin(state.time * 2.2) * 0.08, p.z);
  m.rotation.set(clamp(p.vz / sp, -1, 1) * 0.12, 0, clamp(-p.vx / sp, -1, 1) * 0.7);
  m.visible = p.inv > 0 && p.overdrive <= 0 ? Math.floor(state.time * 18) % 2 === 0 : true;
}

// ====================================================================== enemigos
const ETYPES = {
  drone: { hp: 3, r: 1.0, score: 100, drop: 0.045, col: EX.red },
  fighter: { hp: 7, r: 1.15, score: 250, drop: 0.08, col: EX.purple },
  kamikaze: { hp: 3, r: 0.9, score: 150, drop: 0.04, col: EX.fire },
  gunship: { hp: 42, r: 2.1, score: 1000, drop: 0.5, col: EX.teal },
  mine: { hp: 5, r: 0.95, score: 120, drop: 0.05, col: EX.fire },
  asteroid: { hp: 15, r: 2.1, score: 200, drop: 0.06, col: EX.rock },
  rock: { hp: 4, r: 1.05, score: 60, drop: 0.03, col: EX.rock },
};

function spawnEnemy(kind, x, z, o) {
  const def = ETYPES[kind], proto = EnemyProto[kind];
  const mesh = (Array.isArray(proto) ? pick(proto) : proto).clone();
  const e = {
    kind, mesh, x, z, x0: x, t: 0, hp: def.hp * run.hpMul, r: def.r, score: def.score, drop: def.drop, col: def.col,
    flash: 0, flashAt: 0, dead: false, st: 0, fireT: rand(0.8, 2.4), parts: [],
  };
  mesh.traverse((m) => { if (m.isMesh) e.parts.push(m, m.material); });
  const W = view.W;
  if (kind === 'drone') { e.spd = 9; e.amp = 0.16 * W; e.ph = 0; }
  else if (kind === 'fighter') { e.tz = rand(-23, -13); e.dir = x > 0 ? -1 : 1; e.stay = rand(5, 7.5); e.burst = 0; e.bt = 0; e.v2 = 4; }
  else if (kind === 'kamikaze') { e.vx = 0; e.vz = 9; e.spd = 9; }
  else if (kind === 'gunship') { e.tz = rand(-25, -18); e.stay = 11; e.fireT = 1.2; }
  else if (kind === 'mine') { e.spd = 5.5; e.arm = -1; }
  else {
    e.vx = rand(-2.2, 2.2); e.vz = rand(7, 11);
    e.axis = new T.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(); e.rv = rand(0.6, 2);
    const s = rand(0.85, 1.2); mesh.scale.setScalar(s); e.r *= s; e.hp *= s;
  }
  if (o) Object.assign(e, o);
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  enemies.push(e);
  return e;
}

const canShoot = (e) => player.alive && e.z > view.spawnZ + 9 && e.z < player.z - 4;

function updEnemy(e, dt) {
  e.t += dt;
  const W = view.W, m = e.mesh;
  switch (e.kind) {
    case 'drone': {
      e.z += e.spd * dt;
      const a = e.t * 1.7 + e.ph;
      e.x = clamp(e.x0 + Math.sin(a) * e.amp, -W - 2, W + 2);
      m.rotation.z = Math.cos(a) * 0.5;
      if (canShoot(e) && (e.fireT -= dt) <= 0) {
        e.fireT = rand(2.6, 4.4) / run.fr;
        eShot(e.x, e.z + 1, aimAng(e.x, e.z), 12 * run.bs, 0);
      }
      break;
    }
    case 'fighter': {
      if (e.st === 0) {
        e.z += Math.max(7, (e.tz - e.z) * 2.4) * dt;
        if (e.z >= e.tz - 0.3) { e.st = 1; e.t = 0; }
      } else if (e.st === 1) {
        e.x += e.dir * 7.5 * dt;
        if (e.x > W * 0.9) e.dir = -1; else if (e.x < -W * 0.9) e.dir = 1;
        m.rotation.z += (e.dir * 0.45 - m.rotation.z) * Math.min(1, dt * 5);
        if (canShoot(e) && (e.fireT -= dt) <= 0) { e.fireT = rand(1.6, 2.5) / run.fr; e.burst = 2; e.bt = 0; }
        if (e.burst > 0 && (e.bt -= dt) <= 0) {
          e.burst--; e.bt = 0.17;
          eShot(e.x, e.z + 1.2, aimAng(e.x, e.z), 14.5 * run.bs, 3);
          Sound.eshoot();
        }
        if (e.t > e.stay) e.st = 2;
      } else {
        e.v2 = Math.min(26, e.v2 + 24 * dt);
        e.z += e.v2 * dt;
        e.x += clamp(player.x - e.x, -1, 1) * 5 * dt;
      }
      break;
    }
    case 'kamikaze': {
      let ang = Math.atan2(e.vx, e.vz);
      if (player.alive && e.z < player.z - 2) {
        let d = aimAng(e.x, e.z) - ang;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        ang += clamp(d, -1.7 * dt, 1.7 * dt);
      }
      e.spd = Math.min(24, e.spd + 13 * dt);
      e.vx = Math.sin(ang) * e.spd; e.vz = Math.cos(ang) * e.spd;
      e.x += e.vx * dt; e.z += e.vz * dt;
      m.rotation.y = ang;
      m.children[0].rotation.z += 9 * dt;
      if (Math.random() < dt * 30) spark(e.x - e.vx * 0.05, 0, e.z - e.vz * 0.05, rand(-1, 1), rand(0, 1), rand(-1, 1), 0.3, 1.1, 1, 0.5, 0.15, 1);
      break;
    }
    case 'gunship': {
      if (e.st === 0) {
        e.z += 8 * dt;
        if (e.z >= e.tz) { e.st = 1; e.t = 0; }
      } else {
        e.x = e.x0 + Math.sin(e.t * 0.6) * W * 0.14;
        if (e.st === 2) e.z += 5 * dt; else if (e.t > e.stay) e.st = 2;
        if (canShoot(e) && (e.fireT -= dt) <= 0) {
          e.fireT = 2.1 / run.fr;
          fan(e.x, e.z + 2, clamp(aimAng(e.x, e.z), -0.5, 0.5), run.sector % 3 >= 1 ? 5 : 3, run.sector % 3 >= 1 ? 0.9 : 0.6, 11 * run.bs, 2);
          Sound.eshoot();
        }
      }
      break;
    }
    case 'mine': {
      e.z += e.spd * dt;
      m.rotation.y += dt * 1.5; m.rotation.x += dt * 0.8;
      if (e.arm < 0) {
        if (player.alive && Math.hypot(player.x - e.x, player.z - e.z) < 8.5) e.arm = 0.75;
      } else {
        e.arm -= dt;
        m.scale.setScalar(1 + 0.3 * Math.abs(Math.sin(e.arm * 22)));
        if (e.arm <= 0) {
          ringShot(e.x, e.z, 10, 10 * run.bs, rand(TAU), 1);
          killEnemy(e, false);
        }
      }
      break;
    }
    default: {
      e.x += e.vx * dt; e.z += e.vz * dt;
      m.rotateOnAxis(e.axis, e.rv * dt);
    }
  }
  if (e.flash > 0 && (e.flash -= dt) <= 0) for (let i = 0; i < e.parts.length; i += 2) e.parts[i].material = e.parts[i + 1];
  m.position.x = e.x; m.position.z = e.z;
  if (e.z > view.zMax + 12 || Math.abs(e.x) > W * 2 + 16) e.dead = true;
}

function flashParts(o) {
  if (o.flash > 0 || state.time < o.flashAt) return;
  o.flash = 0.05;
  o.flashAt = state.time + (o.def ? 0.5 : 0.14);
  for (let i = 0; i < o.parts.length; i += 2) o.parts[i].material = whiteMat;
}

function hurtEnemy(e, dmg, x, z) {
  if (e.dead) return;
  e.hp -= dmg;
  if (e.hp <= 0) killEnemy(e, true);
  else { flashParts(e); hitSpark(x, z, e.col); Sound.hit(); }
}

function killEnemy(e, byPlayer) {
  if (e.dead) return;
  e.dead = true;
  const big = e.kind === 'gunship' || e.kind === 'asteroid';
  explode(e.x, e.z, big ? 1.9 : 0.9, e.col);
  if (e.kind === 'asteroid') {
    const n = 2 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) spawnEnemy('rock', e.x + rand(-1, 1), e.z + rand(-1, 1), { vx: rand(-6, 6), vz: e.vz + rand(-1, 4) });
  }
  if (byPlayer) {
    addScore(e.score);
    run.chain++; run.chainT = 3.2;
    run.mult = Math.min(8, 1 + Math.floor(run.chain / 6));
    run.dropMeter += e.drop;
    if (run.dropMeter >= 1) { run.dropMeter -= 1; spawnPickup(e.x, e.z); }
  }
}

function addScore(n) { run.score += Math.round(n * run.mult); }

// ====================================================================== objetos
function spawnPickup(x, z, type) {
  if (!type) {
    const p = player;
    const w = { P: p.wlvl < 4 ? 4 : 0.6, H: p.hp < p.maxHp ? 3.5 : 0.4, S: p.specials < 5 ? 1.8 : 0.2 };
    let r = Math.random() * (w.P + w.H + w.S);
    type = (r -= w.P) < 0 ? 'P' : (r -= w.H) < 0 ? 'H' : 'S';
  }
  const mesh = pickupProto[type].clone();
  mesh.position.set(x, 0.3, z);
  scene.add(mesh);
  pickups.push({ type, x: clamp(x, -view.W, view.W), z, mesh, t: 0 });
}
const PK_COL = { P: [1, 0.8, 0.2], H: [0.3, 1, 0.5], S: [0.8, 0.4, 1] };
function updPickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const k = pickups[i], p = player;
    k.t += dt;
    k.z += 5 * dt;
    if (p.alive) {
      const dx = p.x - k.x, dz = p.z - k.z, d = Math.hypot(dx, dz);
      const pull = run.phase === 'clear' ? 26 : d < 6 ? 12 : 0;
      if (pull && d > 0.01) { k.x += (dx / d) * pull * dt; k.z += (dz / d) * pull * dt; }
      if (d < 1.7) {
        collect(k.type);
        for (let j = 0; j < 10; j++) { const a = rand(TAU); spark(k.x, 0.3, k.z, Math.cos(a) * 7, 3, Math.sin(a) * 7, 0.4, 1.3, ...PK_COL[k.type], 2); }
        scene.remove(k.mesh); pickups.splice(i, 1);
        continue;
      }
    }
    k.mesh.position.set(k.x, 0.3 + Math.sin(k.t * 3) * 0.2, k.z);
    k.mesh.rotation.y += dt * 2.4; k.mesh.rotation.x = Math.sin(k.t * 1.3) * 0.3;
    if (k.z > view.zMax + 10) { scene.remove(k.mesh); pickups.splice(i, 1); }
  }
}
function collect(type) {
  const p = player;
  if (type === 'P') {
    if (p.wlvl < 4) { p.wlvl++; toast('ARMA NIVEL ' + p.wlvl); Sound.powerup(); }
    else { addScore(2000); toast('+2000'); Sound.pickup(); }
  } else if (type === 'H') {
    if (p.hp < p.maxHp) { p.hp = Math.min(p.maxHp, p.hp + 2); toast('BLINDAJE REPARADO'); }
    else { addScore(1000); toast('+1000'); }
    Sound.pickup();
  } else {
    if (p.specials < 5) { p.specials++; toast('+1 ' + p.ship.special); } else { addScore(1500); toast('+1500'); }
    Sound.powerup();
  }
}

// ====================================================================== jefes
const BOSS_DEFS = [
  { name: 'CENTINELA', sub: 'Acorazado de frontera', k: 1.2, hp: 700, build: buildCentinela, ai: aiCentinela, score: 15000, phases: [0.5], col: EX.red,
    hit: [[0, 0.5, 3.3], [-4.8, -1.8, 2.3], [4.8, -1.8, 2.3], [0, 3.6, 1.5]] },
  { name: 'HIDRA', sub: 'Colmena de tres cabezas', hp: 1150, build: buildHidra, ai: aiHidra, score: 25000, phases: [0.66, 0.33], col: EX.green,
    hit: [[0, 0, 3.1]] },
  { name: 'LEVIATÁN', sub: 'Núcleo de la flota oscura', hp: 1700, build: buildLeviatan, ai: aiLeviatan, score: 50000, phases: [0.66, 0.33], col: EX.magenta,
    hit: [[0, 0, 3.5], [-8, -0.3, 2.2], [8, -0.3, 2.2]] },
];
const bossMeshes = [];
const ARM_R = 6.6;

function spawnBoss(i) {
  const def = BOSS_DEFS[i];
  if (!bossMeshes[i]) bossMeshes[i] = def.build();
  const mesh = bossMeshes[i];
  const sc = clamp(view.W / 14, 0.62, 1) * (def.k || 1);
  boss = {
    def, i, mesh, sc, x: 0, z: view.spawnZ - 8, homeZ: -20, hp: def.hp * run.hpMul, maxHp: def.hp * run.hpMul,
    t: 0, mt: 0, phase: 0, state: 'enter', wait: 0, ai: null, hit: [], flash: 0, flashAt: 0, parts: [], armA: 0, spin: 0.6, dieT: 0, boomT: 0, hold: 0,
  };
  mesh.traverse((m) => { if (m.isMesh) boss.parts.push(m, m.material); });
  mesh.scale.setScalar(sc);
  mesh.rotation.set(0, 0, 0);
  mesh.position.set(0, 0, boss.z);
  scene.add(mesh);
  $('bossname').textContent = def.name;
  $('bossbar').classList.remove('hidden');
  hud.boss = -1;
}

function bossHits(b) {
  b.hit.length = 0;
  for (const h of b.def.hit) b.hit.push([b.x + h[0] * b.sc, b.z + h[1] * b.sc, h[2] * b.sc]);
  if (b.i === 1) for (let k = 0; k < 3; k++) {
    const a = b.armA + k * TAU / 3;
    b.hit.push([b.x + Math.sin(a) * ARM_R * b.sc, b.z + Math.cos(a) * ARM_R * b.sc, 1.5 * b.sc]);
  }
}
const armTip = (b, k) => {
  const a = b.armA + k * TAU / 3;
  return [b.x + Math.sin(a) * ARM_R * b.sc, b.z + Math.cos(a) * ARM_R * b.sc, a];
};

function* aiCentinela(b) {
  const tur = (s) => [b.x + s * 4.8 * b.sc, b.z + 0.4];
  yield 0.6;
  while (true) {
    for (let i = 0; i < 3 + b.phase; i++) {
      for (const s of [-1, 1]) { const [x, z] = tur(s); fan(x, z, aimAng(x, z), 2 + b.phase, 0.16 + 0.1 * b.phase, 14 * run.bs, 0); }
      Sound.eshoot();
      yield 0.55 / run.fr;
    }
    yield 0.8;
    for (let i = 0; i < 3 + b.phase; i++) {
      fan(b.x, b.z + 4 * b.sc, i % 2 ? 0.1 : -0.1, 9 + b.phase * 2, 1.5, 10.5 * run.bs, 1);
      Sound.eshoot();
      yield 0.75;
    }
    yield 0.8;
    if (b.phase >= 1) {
      for (const s of [-1, 0, 1]) spawnEnemy('kamikaze', b.x + s * 5 * b.sc, b.z + 2);
      yield 1.0;
      for (let i = 0; i < 14; i++) {
        eShot(b.x + rand(-6, 6) * b.sc, b.z + 2, rand(-0.3, 0.3), rand(9, 13) * run.bs, 3);
        yield 0.11;
      }
      yield 0.9;
    }
  }
}

function* aiHidra(b) {
  yield 0.6;
  while (true) {
    b.spin = 1.25 + 0.4 * b.phase;
    for (let t = 0; t < 4.4; t += 0.13) {
      for (let k = 0; k < 3; k++) {
        const [x, z, a] = armTip(b, k);
        eShot(x, z, a, 10.5 * run.bs, 2);
        if (b.phase >= 1) eShot(x, z, a + 0.7, 8.5 * run.bs, 1);
      }
      yield 0.13;
    }
    b.spin = 0.5;
    yield 0.9;
    for (let i = 0; i < 3 + b.phase; i++) {
      ringShot(b.x, b.z, 14 + 4 * b.phase, 9.5 * run.bs, i * 0.22, 1);
      Sound.eshoot();
      yield 0.8;
    }
    yield 0.5;
    for (let i = 0; i < 4; i++) {
      for (let k = 0; k < 3; k++) { const [x, z] = armTip(b, k); fan(x, z, aimAng(x, z), b.phase >= 2 ? 3 : 2, 0.22, 14.5 * run.bs, 0); }
      Sound.eshoot();
      yield 0.55 / run.fr;
    }
    yield 0.7;
    if (b.phase >= 1) {
      for (const s of [-1, 1]) spawnEnemy('mine', clamp(b.x + s * view.W * 0.5, -view.W, view.W), b.z + 3);
      yield 0.8;
    }
    if (b.phase >= 2) {
      b.hold = 3;
      addBeam({ follow: b, off: 0, oz: 2, w: 3.4, warn: 1.2, dur: 1.5, color: 0x9dff6a });
      yield 1.3;
      for (let i = 0; i < 3; i++) { ringShot(b.x, b.z, 12, 9 * run.bs, i * 0.3, 2); yield 0.5; }
      yield 0.6;
    }
  }
}

function* aiLeviatan(b) {
  const pod = (s) => [b.x + s * 8 * b.sc, b.z + 2.2 * b.sc];
  let turn = 0;
  yield 0.6;
  while (true) {
    turn++;
    for (let i = 0; i < 4 + b.phase; i++) {
      for (const s of [-1, 1]) { const [x, z] = pod(s); fan(x, z, aimAng(x, z), 3 + (b.phase > 1 ? 1 : 0), 0.3, 15 * run.bs, 0); }
      Sound.eshoot();
      yield 0.48 / run.fr;
    }
    yield 0.6;
    {
      const arms = 3 + b.phase, dir = turn % 2 ? 1 : -1;
      let a = rand(TAU);
      for (let i = 0; i < 26 + 8 * b.phase; i++) {
        for (let j = 0; j < arms; j++) eShot(b.x, b.z + 1, a + (j * TAU) / arms, 10 * run.bs, 3);
        a += 0.19 * dir;
        yield 0.1;
      }
    }
    yield 0.6;
    if (b.phase >= 1) {
      b.hold = 3.6;
      for (const s of [-1, 1]) addBeam({ follow: b, off: s * 8, oz: 2.4, w: 2.4, warn: 1.2, dur: 2.2, color: 0x6aeaff });
      yield 1.3;
      for (let i = 0; i < 3; i++) { ringShot(b.x, b.z, 12 + 3 * b.phase, 9 * run.bs, i * 0.3, 1); Sound.eshoot(); yield 0.7; }
      yield 0.5;
    } else {
      for (let i = 0; i < 3; i++) { ringShot(b.x, b.z, 18, 9.5 * run.bs, i * 0.18, 1); Sound.eshoot(); yield 0.8; }
    }
    if (b.phase >= 2) {
      b.hold = 3.6;
      addBeam({ follow: b, off: 0, oz: 2, w: 4.6, warn: 1.3, dur: 2, color: 0xff5ae0 });
      for (const s of [-1, 1]) spawnEnemy('kamikaze', b.x + s * 6 * b.sc, b.z + 2);
      yield 1.4;
      for (let i = 0; i < 4; i++) {
        for (const s of [-1, 1]) { const [x, z] = pod(s); fan(x, z, 0, 5, 1.1, 11 * run.bs, 2); }
        yield 0.5;
      }
      yield 0.5;
    }
    yield 0.5;
  }
}

function hurtBoss(dmg, x, z) {
  const b = boss;
  if (!b || b.state !== 'fight') return;
  b.hp -= dmg;
  flashParts(b);
  hitSpark(x, z, b.def.col);
  if (b.hp <= 0) {
    b.hp = 0; b.state = 'dying'; b.dieT = 0;
    clearEnemyBullets(true);
    clearBeams();
    for (const e of enemies) killEnemy(e, false);
    Sound.music('play');
    return;
  }
  const f = b.hp / b.maxHp;
  let ph = 0;
  for (const th of b.def.phases) if (f <= th) ph++;
  if (ph > b.phase) {
    b.phase = ph;
    explode(b.x, b.z, 3, b.def.col);
    clearEnemyBullets(false);
    clearBeams();
    b.ai = b.def.ai(b);
    b.wait = 1.3; b.hold = 0;
    state.shake = 1.6;
    toast('¡' + b.def.name + ' SE ENFURECE!');
    spawnPickup(b.x, b.z + 3);
  }
}

function updBoss(dt) {
  const b = boss, m = b.mesh, u = m.userData, W = view.W;
  b.t += dt;
  if (b.state === 'enter') {
    b.z += (b.homeZ - b.z) * Math.min(1, dt * 1.4);
    if (Math.abs(b.z - b.homeZ) < 0.4) { b.state = 'fight'; b.ai = b.def.ai(b); b.wait = 0.5; run.phase = 'boss'; }
  } else if (b.state === 'fight') {
    if (b.hold > 0) b.hold -= dt; else b.mt += dt * (0.5 + 0.18 * b.phase);
    const tx = Math.sin(b.mt) * W * 0.55;
    const px = b.x;
    b.x += (tx - b.x) * Math.min(1, dt * 2);
    b.z = b.homeZ + Math.sin(b.t * 0.7) * 1.5;
    m.rotation.z = clamp((b.x - px) / Math.max(dt, 0.001) * -0.03, -0.25, 0.25);
    b.wait -= dt;
    let guard = 0;
    while (b.wait <= 0 && guard++ < 20) b.wait += b.ai.next().value || 0.02;
    for (const h of b.hit) {
      const dx = player.x - h[0], dz = player.z - h[1], rr = h[2] + player.r;
      if (dx * dx + dz * dz < rr * rr) hurtPlayer();
    }
  } else {
    b.dieT += dt;
    b.boomT -= dt;
    if (b.boomT <= 0) {
      b.boomT = 0.11;
      explode(b.x + rand(-6, 6) * b.sc, b.z + rand(-4, 4) * b.sc, rand(0.8, 1.8), Math.random() < 0.5 ? b.def.col : EX.fire);
    }
    m.rotation.z = Math.sin(b.dieT * 30) * 0.06 + b.dieT * 0.06;
    m.position.y = -b.dieT * 0.5;
    b.z += dt * 1.2;
    if (b.dieT > 2.6) { bossDead(); return; }
  }
  if (b.i === 0) {
    for (const t of u.turrets) t.rotation.y = clamp(-Math.atan2(player.x - b.x, player.z - b.z), -0.6, 0.6);
  } else if (b.i === 1) {
    b.armA += b.spin * dt;
    u.arms.rotation.y = b.armA;
    u.ring.rotation.z -= dt * 0.9;
    u.eye.scale.setScalar(1 + 0.08 * Math.sin(b.t * 5));
    u.eye.scale.y *= 0.55;
  } else {
    u.ring1.rotation.x += dt * (0.9 + b.phase * 0.5);
    u.ring1.rotation.y += dt * 0.3;
    u.ring2.rotation.y += dt * (0.7 + b.phase * 0.4);
    u.ring2.rotation.x = Math.sin(b.t * 0.5) * 0.5;
    u.cage.rotation.y -= dt * 1.2; u.cage.rotation.x += dt * 0.5;
    u.core.scale.setScalar(1 + 0.07 * Math.sin(b.t * 6));
  }
  if (b.flash > 0 && (b.flash -= dt) <= 0) for (let i = 0; i < b.parts.length; i += 2) b.parts[i].material = b.parts[i + 1];
  m.position.x = b.x; m.position.z = b.z;
  bossHits(b);
}

function bossDead() {
  const b = boss;
  for (let i = 0; i < b.parts.length; i += 2) b.parts[i].material = b.parts[i + 1];
  for (let i = 0; i < 7; i++) explode(b.x + rand(-5, 5) * b.sc, b.z + rand(-3, 3) * b.sc, rand(2, 3.4), i % 2 ? b.def.col : EX.fire, true);
  addRing(b.x, b.z, 2, 60, 1.0, EX.white);
  Sound.bigBoom();
  flashScreen('#ffffff', 0.9, 900);
  state.shake = 2.6;
  addScore(b.def.score);
  spawnPickup(b.x - 2, b.z, 'P'); spawnPickup(b.x + 2, b.z, 'H');
  scene.remove(b.mesh);
  b.mesh.position.y = 0;
  boss = null;
  $('bossbar').classList.add('hidden');
  run.phase = 'clear'; run.pt = 0;
  banner('SECTOR ' + (run.sector + 1) + ' DESPEJADO', b.def.name + ' destruido · +' + b.def.score.toLocaleString('es-ES'), 3);
  Sound.fanfare();
}

// ====================================================================== oleadas
function buildSector(i) {
  const q = [];
  let t = 2.6;
  const at = (dt) => { t += dt; };
  const add = (time, kind, xf, o) => q.push({ t: time, kind, xf, o });
  const line = (kind, n, xf, gap = 0.5, o) => { for (let k = 0; k < n; k++) add(t + k * gap, kind, xf, o); };
  const row = (kind, n, span = 0.8, o) => { for (let k = 0; k < n; k++) add(t, kind, n === 1 ? 0 : -span + (2 * span * k) / (n - 1), o); };
  const vee = (kind, n, xf = 0, o) => { for (let k = 0; k < n; k++) { const s = k - (n - 1) / 2; add(t + Math.abs(s) * 0.35, kind, xf + s * 0.17, o); } };
  const scatter = (kind, from, to, gapA, gapB) => { for (let tt = from; tt < to; tt += rand(gapA, gapB)) add(tt, kind, rand(-1, 1)); };

  if (i === 0) {
    line('drone', 5, -0.5); at(3.2);
    line('drone', 5, 0.5); at(3.2);
    vee('drone', 5); at(3.6);
    row('fighter', 2, 0.5); at(3.2);
    line('drone', 6, 0, 0.42, { amp: 0.45 * view.W }); at(2.2);
    row('kamikaze', 2, 0.7); at(3.6);
    row('gunship', 1); line('drone', 4, -0.7); at(1.6);
    line('drone', 4, 0.7); at(5);
    vee('fighter', 3); at(3.2);
    row('kamikaze', 4, 0.8); at(3.4);
    row('gunship', 2, 0.5); at(2.6);
    vee('drone', 7); at(4.2);
    row('fighter', 4, 0.75); at(5.5);
  } else if (i === 1) {
    scatter('asteroid', 2, 62, 1.5, 2.8);
    vee('fighter', 3); at(3.4);
    line('drone', 6, -0.6, 0.4); line('drone', 6, 0.6, 0.4, { ph: Math.PI }); at(4);
    row('kamikaze', 5, 0.85); at(3);
    row('mine', 3, 0.6); at(2.6);
    row('gunship', 2, 0.55); at(3.2);
    vee('drone', 7, -0.3); at(2.4);
    vee('drone', 7, 0.3); at(4);
    row('fighter', 4, 0.8); row('mine', 2, 0.3); at(4.4);
    line('kamikaze', 6, 0, 0.5); at(3.4);
    row('gunship', 1); row('fighter', 2, 0.8); at(4.4);
    row('mine', 5, 0.85); at(2.2);
    line('drone', 8, 0, 0.36, { amp: 0.6 * view.W }); at(4.2);
    row('gunship', 3, 0.7); at(3.5);
    row('kamikaze', 6, 0.9); at(5.5);
  } else {
    row('fighter', 4, 0.8); at(2.8);
    line('drone', 7, -0.7, 0.34, { amp: 0.25 * view.W }); line('drone', 7, 0.7, 0.34, { amp: 0.25 * view.W, ph: Math.PI }); at(3.6);
    row('mine', 5, 0.85); row('kamikaze', 3, 0.5); at(3.4);
    row('gunship', 2, 0.6); vee('fighter', 3); at(4.6);
    row('kamikaze', 7, 0.9); at(2.8);
    vee('drone', 9); at(2.6);
    row('gunship', 3, 0.75); at(2.4);
    scatter('asteroid', t, t + 9, 1.2, 2);
    line('kamikaze', 6, -0.4, 0.45); line('kamikaze', 6, 0.4, 0.45); at(4.2);
    row('fighter', 5, 0.85); row('mine', 4, 0.6); at(4.6);
    line('drone', 10, 0, 0.3, { amp: 0.7 * view.W }); at(2.6);
    row('gunship', 2, 0.8); row('kamikaze', 4, 0.4); at(4);
    vee('fighter', 5); row('mine', 6, 0.9); at(4.2);
    row('gunship', 4, 0.8); at(3);
    row('kamikaze', 8, 0.9); at(6);
  }
  q.sort((a, b) => a.t - b.t);
  return q;
}

function startSector(n) {
  run.sector = n;
  run.loop = Math.floor(n / 3);
  const i = n % 3;
  run.hpMul = 1 + 0.2 * i + 0.45 * run.loop;
  run.bs = 1 + 0.06 * i + 0.16 * run.loop;
  run.fr = 1 + 0.12 * i + 0.25 * run.loop;
  setTheme(i);
  run.queue = buildSector(i);
  run.phase = 'waves'; run.st = 0; run.pt = 0;
  bg.warp = 0;
  banner('SECTOR ' + (n + 1), THEMES[i].name + (run.loop ? ' · CICLO ' + (run.loop + 1) : ''), 2.6);
  Sound.music('play', THEMES[i].root);
}

function updFlow(dt) {
  run.pt += dt;
  if (run.chainT > 0 && (run.chainT -= dt) <= 0) { run.chain = 0; run.mult = 1; }
  switch (run.phase) {
    case 'waves': {
      run.st += dt;
      const q = run.queue;
      while (q.length && q[0].t <= run.st) {
        const s = q.shift();
        spawnEnemy(s.kind, s.xf * view.W * 0.92, view.spawnZ, s.o);
      }
      if (!q.length && (enemies.length === 0 || run.st > 200) && player.alive) {
        run.phase = 'warn'; run.pt = 0;
        const def = BOSS_DEFS[run.sector % 3];
        banner('¡ALERTA!', 'Se aproxima ' + def.name + ' · ' + def.sub, 3, 'warn');
        Sound.alarm();
        Sound.music('boss');
      }
      break;
    }
    case 'warn':
      if (run.pt > 3.1 && !boss) spawnBoss(run.sector % 3);
      break;
    case 'clear':
      if (run.pt > 3.4) {
        if (run.sector % 3 === 2) { showVictory(); }
        else { run.phase = 'warp'; run.pt = 0; bg.warp = 1; banner('SALTO AL SIGUIENTE SECTOR', '', 1.6); }
      }
      break;
    case 'warp':
      if (run.pt > 1.9) {
        flashScreen('#ffffff', 0.85, 800);
        player.hp = Math.min(player.maxHp, player.hp + 2);
        startSector(run.sector + 1);
      }
      break;
    case 'dead':
      if (run.pt > 1.8) showGameOver();
      break;
  }
}

// ====================================================================== simulación
function simulate(dt) {
  updFlow(dt);
  updPlayer(dt);
  const p = player;

  for (const e of enemies) if (!e.dead) updEnemy(e, dt);
  if (boss) updBoss(dt);
  updBeams(dt);

  // balas del jugador
  for (let i = pbullets.length - 1; i >= 0; i--) {
    const b = pbullets[i];
    if (b.homing) {
      let best = null, bd = 1e9;
      for (const e of enemies) {
        if (e.dead || e.z < view.spawnZ + 6) continue;
        const d = (e.x - b.x) ** 2 + (e.z - b.z) ** 2;
        if (d < bd) { bd = d; best = e; }
      }
      if (!best && boss && boss.state === 'fight') best = boss;
      if (best) {
        const cur = Math.atan2(b.vx, b.vz);
        let d = Math.atan2(best.x - b.x, best.z - b.z) - cur;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        const na = cur + clamp(d, -7 * dt, 7 * dt), sp = Math.hypot(b.vx, b.vz);
        b.vx = Math.sin(na) * sp; b.vz = Math.cos(na) * sp;
      }
      spark(b.x, 0.2, b.z, rand(-1, 1), rand(0, 1), rand(-1, 1), 0.28, 1.0, 1, 0.6, 0.25, 1);
    }
    b.x += b.vx * dt; b.z += b.vz * dt; b.life -= dt;
    if (b.dead || b.life <= 0 || b.z < view.spawnZ + 3 || b.z > view.zMax + 14 || Math.abs(b.x) > view.W * 2.4 + 8) {
      pbullets[i] = pbullets[pbullets.length - 1]; pbullets.pop();
    }
  }
  // impactos
  for (const b of pbullets) {
    if (b.dead) continue;
    for (let j = 0; j < enemies.length; j++) {
      const e = enemies[j];
      if (e.dead) continue;
      const dx = e.x - b.x, dz = e.z - b.z, rr = e.r + b.r;
      if (dx * dx + dz * dz > rr * rr) continue;
      if (b.pierce) { if (b.hit.includes(e)) continue; b.hit.push(e); } else b.dead = true;
      hurtEnemy(e, b.dmg, b.x, b.z);
      if (b.homing) explode(b.x, b.z, 0.6, EX.fire, true);
      if (b.dead) break;
    }
    if (!b.dead && boss && boss.state === 'fight') {
      for (const h of boss.hit) {
        const dx = h[0] - b.x, dz = h[1] - b.z, rr = h[2] + b.r;
        if (dx * dx + dz * dz < rr * rr) {
          b.dead = true;
          hurtBoss(b.dmg, b.x, b.z);
          if (b.homing) explode(b.x, b.z, 0.6, EX.fire, true);
          break;
        }
      }
    }
  }
  // balas enemigas
  const lim = view.W * 2.2 + 10;
  for (let i = ebullets.length - 1; i >= 0; i--) {
    const b = ebullets[i];
    b.x += b.vx * dt; b.z += b.vz * dt;
    let gone = b.z > view.zMax + 9 || b.z < view.spawnZ - 4 || Math.abs(b.x) > lim;
    if (!gone && p.alive) {
      const dx = p.x - b.x, dz = p.z - b.z, rr = b.r + p.r;
      if (dx * dx + dz * dz < rr * rr) { gone = true; hurtPlayer(); }
    }
    if (gone) { ebullets[i] = ebullets[ebullets.length - 1]; ebullets.pop(); }
  }
  // choques con enemigos
  if (p.alive) {
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = p.x - e.x, dz = p.z - e.z, rr = e.r * 0.8 + 0.75;
      if (dx * dx + dz * dz < rr * rr) {
        if (p.overdrive > 0) { hurtEnemy(e, 40, e.x, e.z); continue; }
        if (p.inv <= 0 && !p.intro) { hurtPlayer(); hurtEnemy(e, 12, e.x, e.z); }
      }
    }
  }
  updPickups(dt);
  // limpieza
  let any = false;
  for (const e of enemies) if (e.dead) { scene.remove(e.mesh); any = true; }
  if (any) enemies = enemies.filter((e) => !e.dead);
}

// ====================================================================== dibujo de partículas y balas
function drawDynamic() {
  glow.n = 0;
  for (const p of parts) {
    const a = p.life / p.max;
    glow.add(p.x, p.y, p.z, p.size * (0.35 + 0.65 * a), p.r, p.g, p.b, a);
  }
  for (const b of ebullets) {
    const c = EB_COL[b.c];
    glow.add(b.x, 0.25, b.z, 2.7 * b.s, c[0], c[1], c[2], 1);
  }
  // motores
  const pm = state.mode === 'menu' ? shipMeshes[state.sel] : player.mesh;
  if (pm && pm.visible) {
    pm.updateMatrixWorld();
    const ship = SHIPS[shipMeshes.indexOf(pm)];
    tmpC.set(ship.color);
    const fl = 0.75 + Math.random() * 0.5;
    const boost = state.mode === 'menu' ? 1 : clamp(1 - player.vz / ship.speed * 0.5, 0.6, 1.6);
    for (const en of ship.engines) {
      tmpV.set(en[0], 0, en[1] + 0.25); pm.localToWorld(tmpV);
      glow.add(tmpV.x, tmpV.y, tmpV.z, 1.9 * fl * boost, tmpC.r, tmpC.g, tmpC.b, 1);
      tmpV.set(en[0], 0, en[1] + 0.9 * boost); pm.localToWorld(tmpV);
      glow.add(tmpV.x, tmpV.y, tmpV.z, 1.3 * fl, tmpC.r, tmpC.g, tmpC.b, 0.7);
      tmpV.set(en[0], 0, en[1] + 1.6 * boost); pm.localToWorld(tmpV);
      glow.add(tmpV.x, tmpV.y, tmpV.z, 0.8 * fl, tmpC.r, tmpC.g, tmpC.b, 0.45);
    }
    if (state.mode !== 'menu' && player.overdrive > 0) glow.add(player.x, 0.2, player.z, 9, 1, 0.75, 0.2, 0.35);
  }
  for (const k of pickups) { const c = PK_COL[k.type]; glow.add(k.x, 0.3, k.z, 4.2, c[0], c[1], c[2], 0.55); }
  if (boss && boss.i === 2 && boss.state !== 'dying') glow.add(boss.x, 0.5, boss.z, 13 * boss.sc, 1, 0.25, 0.9, 0.45);

  let n = 0;
  for (const b of pbullets) {
    if (n >= PB_MAX) break;
    dummy.position.set(b.x, 0.1, b.z);
    dummy.rotation.set(0, Math.atan2(b.vx, b.vz), 0);
    dummy.scale.set(b.w, b.w, b.len);
    dummy.updateMatrix();
    pbMesh.setMatrixAt(n, dummy.matrix);
    pbMesh.setColorAt(n, tmpC.set(b.col));
    glow.add(b.x, 0.1, b.z, b.w * 9, tmpC.r, tmpC.g, tmpC.b, 0.5);
    n++;
  }
  pbMesh.count = n;
  pbMesh.instanceMatrix.needsUpdate = true;
  if (pbMesh.instanceColor) pbMesh.instanceColor.needsUpdate = true;

  n = 0;
  for (const d of debris) {
    dummy.position.set(d.x, d.y, d.z);
    dummy.rotation.set(d.rx, d.ry, 0);
    dummy.scale.setScalar(d.s * Math.min(1, d.life * 3));
    dummy.updateMatrix();
    debMesh.setMatrixAt(n++, dummy.matrix);
  }
  debMesh.count = n;
  debMesh.instanceMatrix.needsUpdate = true;
  glow.flush();
}

// ====================================================================== HUD e interfaz
const hud = {};
function hudSet(id, v) { if (hud[id] !== v) { hud[id] = v; $(id).textContent = v; } }
function updHud() {
  const p = player;
  hudSet('score', String(run.score).padStart(7, '0'));
  hudSet('mult', run.mult > 1 ? '×' + run.mult : '');
  hudSet('sector', 'SECTOR ' + (run.sector + 1));
  if (run.score > state.hi) state.hi = run.score;
  hudSet('hi', 'RÉCORD ' + state.hi);
  const hk = p.hp + '/' + p.maxHp;
  if (hud.hull !== hk) {
    hud.hull = hk;
    let h = '';
    for (let i = 0; i < p.maxHp; i++) h += '<i class="' + (i < p.hp ? 'on' : '') + '"></i>';
    $('hull').innerHTML = h;
    $('hull').classList.toggle('low', p.hp <= 1);
  }
  if (hud.lives !== p.lives) { hud.lives = p.lives; $('lives').textContent = '▲'.repeat(Math.max(0, p.lives)) || '—'; }
  if (hud.wlvl !== p.wlvl) {
    hud.wlvl = p.wlvl;
    let h = '';
    for (let i = 1; i <= 4; i++) h += '<i class="' + (i <= p.wlvl ? 'on' : '') + '"></i>';
    $('weapon').innerHTML = h;
  }
  if (hud.sp !== p.specials) {
    hud.sp = p.specials;
    $('specialCount').textContent = p.specials > 0 ? '✦'.repeat(p.specials) : '—';
    $('specialBtn').classList.toggle('empty', p.specials <= 0);
  }
  if (boss) {
    const f = Math.round((boss.hp / boss.maxHp) * 200);
    if (hud.boss !== f) { hud.boss = f; $('bossfill').style.width = f / 2 + '%'; }
  }
}

let bannerT = 0, toastT = 0;
function banner(title, sub = '', dur = 2.4, cls = '') {
  const el = $('banner');
  el.innerHTML = '';
  const h = document.createElement('h2'); h.textContent = title; el.appendChild(h);
  if (sub) { const s = document.createElement('p'); s.textContent = sub; el.appendChild(s); }
  el.className = 'show ' + cls;
  bannerT = dur;
}
function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  toastT = 1.4;
}

function show(id, on) { $(id).classList.toggle('hidden', !on); }

function selectShip(i, silent) {
  state.sel = (i + SHIPS.length) % SHIPS.length;
  Store.set('naves_ship', state.sel);
  shipMeshes.forEach((m, k) => { m.visible = state.mode === 'menu' && k === state.sel; });
  document.querySelectorAll('.card').forEach((c, k) => c.classList.toggle('sel', k === state.sel));
  const s = SHIPS[state.sel];
  document.documentElement.style.setProperty('--accent', s.css);
  if (!silent) Sound.select();
}

function resetWorld() {
  for (const e of enemies) scene.remove(e.mesh);
  enemies = [];
  for (const k of pickups) scene.remove(k.mesh);
  pickups.length = 0; ebullets.length = 0; pbullets.length = 0; parts.length = 0; debris.length = 0;
  clearBeams();
  if (boss) { scene.remove(boss.mesh); boss.mesh.position.y = 0; for (let i = 0; i < boss.parts.length; i += 2) boss.parts[i].material = boss.parts[i + 1]; boss = null; }
  show('bossbar', false);
  bg.warp = 0;
}

function startGame() {
  Sound.init();
  Sound.start();
  resetWorld();
  const p = player, s = SHIPS[state.sel];
  shipMeshes.forEach((m) => { m.visible = false; });
  Object.assign(p, {
    ship: s, mesh: shipMeshes[state.sel], x: 0, z: view.zMax + 10, vx: 0, vz: 0, hp: s.hp, maxHp: s.hp, lives: 2, wlvl: 1,
    fireT: 0.4, inv: 2, alive: true, specials: 2, overdrive: 0, respawnT: 0, intro: true, missiles: 0,
  });
  p.mesh.visible = true;
  p.mesh.rotation.set(0, 0, 0);
  Object.assign(run, { score: 0, mult: 1, chain: 0, chainT: 0, dropMeter: 0.6 });
  for (const k in hud) delete hud[k];
  $('specialName').textContent = s.special;
  state.mode = 'play';
  touch.active = false;
  show('menu', false); show('gameover', false); show('victory', false); show('pause', false); show('hud', true);
  startSector(0);
}

function toMenu() {
  saveHi();
  resetWorld();
  state.mode = 'menu';
  show('menu', true); show('gameover', false); show('victory', false); show('pause', false); show('hud', false);
  $('banner').className = '';
  setTheme(0);
  selectShip(state.sel, true);
  const m = shipMeshes[state.sel];
  m.position.set(0, 0, 0);
  $('menuHi').textContent = state.hi > 0 ? 'RÉCORD  ' + state.hi.toLocaleString('es-ES') : '';
  Sound.music('menu', 45);
}

function saveHi() {
  if (run.score > state.hi) state.hi = run.score;
  Store.set('naves_hi', state.hi);
}
function showGameOver() {
  saveHi();
  state.mode = 'over';
  run.phase = 'idle';
  $('goScore').textContent = run.score.toLocaleString('es-ES');
  $('goInfo').textContent = 'Sector ' + (run.sector + 1) + (run.score >= state.hi && run.score > 0 ? ' · ¡Nuevo récord!' : '');
  show('gameover', true); show('hud', false);
  Sound.stopMusic(); Sound.gameOver();
}
function showVictory() {
  saveHi();
  state.mode = 'victory';
  run.phase = 'idle';
  $('viScore').textContent = run.score.toLocaleString('es-ES');
  $('viInfo').textContent = 'Has destruido al LEVIATÁN' + (run.loop ? ' (ciclo ' + (run.loop + 1) + ')' : '') + '. La galaxia respira… por ahora.';
  show('victory', true); show('hud', false);
  Sound.fanfare();
}
function nextLoop() {
  show('victory', false); show('hud', true);
  state.mode = 'play';
  run.phase = 'warp'; run.pt = 0; bg.warp = 1;
  banner('CICLO ' + (run.loop + 2), 'El enemigo regresa más fuerte', 1.8);
}
function setPause(on) {
  if (on && state.mode === 'play') { state.mode = 'pause'; show('pause', true); }
  else if (!on && state.mode === 'pause') { state.mode = 'play'; show('pause', false); last = performance.now(); }
}
function toggleMute() {
  const m = Sound.toggleMute();
  document.querySelectorAll('.muteBtn').forEach((b) => b.classList.toggle('off', m));
}

// ---- construir tarjetas de naves
(function buildMenu() {
  const wrap = $('cards');
  SHIPS.forEach((s, i) => {
    const c = document.createElement('button');
    c.className = 'card';
    c.style.setProperty('--c', s.css);
    let bars = '';
    for (const k in s.stats) {
      let pips = '';
      for (let j = 1; j <= 5; j++) pips += '<i class="' + (j <= s.stats[k] ? 'on' : '') + '"></i>';
      bars += '<div class="stat"><span>' + k + '</span><div class="pips">' + pips + '</div></div>';
    }
    c.innerHTML = '<div class="cname">' + s.name + '</div><div class="crole">' + s.role + '</div><div class="cdesc">' + s.desc + '</div>' +
      bars + '<div class="cspec"><b>✦ ' + s.special + '</b> ' + s.specialDesc + '</div>';
    c.addEventListener('click', () => { Sound.init(); if (state.sel === i && state.mode === 'menu') return; selectShip(i); });
    wrap.appendChild(c);
  });
  $('startBtn').addEventListener('click', startGame);
  $('retryBtn').addEventListener('click', startGame);
  $('goMenuBtn').addEventListener('click', toMenu);
  $('viMenuBtn').addEventListener('click', toMenu);
  $('viNextBtn').addEventListener('click', nextLoop);
  $('resumeBtn').addEventListener('click', () => setPause(false));
  $('paMenuBtn').addEventListener('click', toMenu);
  $('pauseBtn').addEventListener('click', () => setPause(true));
  $('specialBtn').addEventListener('click', useSpecial);
  document.querySelectorAll('.muteBtn').forEach((b) => { b.addEventListener('click', toggleMute); b.classList.toggle('off', Sound.muted); });
  $('prevShip').addEventListener('click', () => { Sound.init(); selectShip(state.sel - 1); });
  $('nextShip').addEventListener('click', () => { Sound.init(); selectShip(state.sel + 1); });
})();

// ====================================================================== entrada
window.addEventListener('keydown', (e) => {
  const c = e.code;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(c)) e.preventDefault();
  if (e.repeat) return;
  keys[c] = true;
  Sound.init();
  if (c === 'KeyM') toggleMute();
  const enter = c === 'Enter' || c === 'NumpadEnter';
  if (state.mode === 'menu') {
    if (c === 'ArrowLeft' || c === 'KeyA') selectShip(state.sel - 1);
    else if (c === 'ArrowRight' || c === 'KeyD') selectShip(state.sel + 1);
    else if (c === 'Digit1' || c === 'Digit2' || c === 'Digit3') selectShip(+c.slice(5) - 1);
    else if (enter || c === 'Space') startGame();
  } else if (state.mode === 'play') {
    if (c === 'KeyX' || c === 'KeyE' || c === 'ShiftLeft' || c === 'ShiftRight') useSpecial();
    else if (c === 'KeyP' || c === 'Escape') setPause(true);
  } else if (state.mode === 'pause') {
    if (c === 'KeyP' || c === 'Escape' || enter) setPause(false);
  } else if (state.mode === 'over') {
    if (enter) startGame();
  } else if (state.mode === 'victory') {
    if (enter) nextLoop();
  }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden) setPause(true); });

canvas.addEventListener('pointerdown', (e) => {
  Sound.init();
  if (state.mode !== 'play') return;
  touch.active = true; touch.id = e.pointerId;
  touch.sx = e.clientX; touch.sy = e.clientY;
  touch.px = touch.tx = player.x; touch.pz = touch.tz = player.z;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
});
canvas.addEventListener('pointermove', (e) => {
  if (!touch.active || e.pointerId !== touch.id) return;
  const s = (2 * view.W * 1.25) / window.innerWidth;
  touch.tx = clamp(touch.px + (e.clientX - touch.sx) * s, -view.W, view.W);
  touch.tz = clamp(touch.pz + (e.clientY - touch.sy) * s * 1.5, view.zMin, view.zMax);
});
const endTouch = (e) => { if (e.pointerId === touch.id) touch.active = false; };
canvas.addEventListener('pointerup', endTouch);
canvas.addEventListener('pointercancel', endTouch);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('resize', resize);

// ====================================================================== bucle
function updCamera(dt) {
  const w = window.innerWidth, h = window.innerHeight;
  let shiftT = 0;
  if (state.mode === 'menu') {
    const d = clamp(6.6 / camera.aspect, 8.5, 20);
    desPos.set(0, d * 0.36, d);
    desLook.set(0, 0, 0);
    shiftT = camera.aspect < 0.9 ? 0.15 : 0.14;
  } else {
    gamePose(player.x, desPos, desLook);
  }
  const k = 1 - Math.exp(-dt * 3.4);
  camPos.lerp(desPos, k); camLook.lerp(desLook, k);
  state.shift += (shiftT - state.shift) * k;
  camera.position.copy(camPos);
  if (state.shake > 0.01) {
    const s = state.shake * 0.35;
    camera.position.x += rand(-s, s); camera.position.y += rand(-s, s); camera.position.z += rand(-s, s) * 0.5;
    state.shake *= Math.exp(-dt * 6);
  }
  camera.lookAt(camLook);
  if (state.shift > 0.003) camera.setViewOffset(w, h, 0, state.shift * h, w, h);
  else if (camera.view && camera.view.enabled) camera.clearViewOffset();
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const real = Math.min(0.1, (now - last) / 1000);
  last = now;
  const dt = Math.min(real, 1 / 30);
  if (state.mode !== 'pause') {
    state.time += dt;
    updBackground(dt);
    if (state.mode === 'menu') {
      const m = shipMeshes[state.sel];
      m.position.set(0, Math.sin(state.time * 1.4) * 0.15, 0);
      m.rotation.set(Math.sin(state.time * 0.9) * 0.08, state.time * 0.7, Math.sin(state.time * 0.7) * 0.18);
    } else {
      simulate(dt);
      if (state.mode === 'play') updHud();
    }
    updEffects(dt);
    drawDynamic();
    if (bannerT > 0 && (bannerT -= dt) <= 0) $('banner').className = '';
    if (toastT > 0 && (toastT -= dt) <= 0) $('toast').classList.remove('show');
  }
  updCamera(real);
  renderer.render(scene, camera);
}

resize();
toMenu();
camPos.set(0, 6, 20);
requestAnimationFrame(frame);

if (/[?&]debug/.test(location.search)) {
  window.NAVES = {
    state, run, player, view,
    get boss() { return boss; },
    get enemies() { return enemies; },
    start: startGame,
    skipToBoss() { run.queue.length = 0; for (const e of enemies) e.dead = true; },
    sector(n) { resetWorld(); startSector(n); },
    god() { player.inv = 1e9; },
    weapon(n) { player.wlvl = n; },
    special: useSpecial,
    hurtBoss(n) { if (boss) hurtBoss(n, boss.x, boss.z); },
    pickup(t) { spawnPickup(player.x, player.z - 10, t); },
    kill() { player.inv = 0; player.intro = false; player.hp = 1; hurtPlayer(); },
  };
}
