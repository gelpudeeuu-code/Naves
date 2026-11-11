'use strict';
/* Modelos 3D procedurales: naves del jugador, enemigos, jefes, objetos y texturas.
   Convención: los modelos se construyen mirando hacia -Z ("adelante").
   Los enemigos se giran 180° para que miren hacia el jugador (+Z). */

function std(color, metal = 0.55, rough = 0.42, emissive = 0x000000, ei = 1) {
  return new T.MeshStandardMaterial({ color, metalness: metal, roughness: rough, flatShading: true, emissive, emissiveIntensity: ei });
}
function lit(color) { return new T.MeshBasicMaterial({ color, toneMapped: false }); }

function P(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new T.Mesh(geo, mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz);
  return m;
}
// Pieza alargada sobre el eje Z (cilindro/cono cuyo extremo "superior" apunta adelante).
function Z(geo, mat, x = 0, y = 0, z = 0, sx = 1, sh = 1) {
  return P(geo, mat, x, y, z, -Math.PI / 2, 0, 0, sx, 1, sh);
}
// Placa plana a partir de un contorno visto desde arriba: [x, adelante].
function plate(pts, th = 0.12) {
  const s = new T.Shape();
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  const g = new T.ExtrudeGeometry(s, { depth: th, bevelEnabled: false });
  g.translate(0, 0, -th / 2);
  g.rotateX(-Math.PI / 2);
  return g;
}
const mir = (pts) => pts.map(([x, y]) => [-x, y]);
function both(group, pts, th, mat, y = 0) {
  group.add(P(plate(pts, th), mat, 0, y, 0), P(plate(mir(pts), th), mat, 0, y, 0));
}
function facingPlayer(inner) {
  const g = new T.Group();
  inner.rotation.y = Math.PI;
  g.add(inner);
  return g;
}

const G = {
  cyl: (a, b, h, n = 8) => new T.CylinderGeometry(a, b, h, n),
  cone: (r, h, n = 6) => new T.ConeGeometry(r, h, n),
  box: (x, y, z) => new T.BoxGeometry(x, y, z),
  sph: (r, w = 10, h = 8) => new T.SphereGeometry(r, w, h),
  octa: (r) => new T.OctahedronGeometry(r, 0),
  ico: (r, d = 0) => new T.IcosahedronGeometry(r, d),
  torus: (R, r, n = 24) => new T.TorusGeometry(R, r, 6, n),
};

// ------------------------------------------------------------------ naves del jugador
const SHIPS = [
  {
    id: 'halcon', name: 'HALCÓN', role: 'Equilibrada', color: 0x2fb4ff, css: '#2fb4ff',
    desc: 'Caza polivalente de doble cañón.',
    speed: 18, hp: 5, fireRate: 0.14, dmg: 1, pattern: 'twin',
    special: 'MISILES', specialDesc: 'Salva de misiles teledirigidos',
    stats: { Velocidad: 3, Fuego: 3, Blindaje: 3 },
    engines: [[-0.5, 1.85], [0.5, 1.85]],
  },
  {
    id: 'centella', name: 'CENTELLA', role: 'Veloz', color: 0xffc22e, css: '#ffc22e',
    desc: 'Interceptor ligero con disparo en abanico.',
    speed: 24, hp: 4, fireRate: 0.12, dmg: 0.68, pattern: 'spread',
    special: 'SOBRECARGA', specialDesc: 'Invulnerable y fuego doble 6 s',
    stats: { Velocidad: 5, Fuego: 3, Blindaje: 2 },
    engines: [[0, 2.15]],
  },
  {
    id: 'titan', name: 'TITÁN', role: 'Acorazada', color: 0xff4760, css: '#ff4760',
    desc: 'Fragata pesada con cañón perforante.',
    speed: 13.5, hp: 8, fireRate: 0.27, dmg: 4.2, pattern: 'heavy',
    special: 'ONDA', specialDesc: 'Onda de choque que arrasa la pantalla',
    stats: { Velocidad: 1, Fuego: 4, Blindaje: 5 },
    engines: [[0, 2.1], [-1.35, 1.9], [1.35, 1.9]],
  },
];

function buildShip(id) {
  const g = new T.Group();
  const dark = std(0x232838, 0.7, 0.45);
  const glass = std(0x0b1c36, 0.9, 0.08, 0x1c6cff, 0.7);
  if (id === 'halcon') {
    const hull = std(0xe4eaf5, 0.6, 0.32), acc = std(0x2fb4ff, 0.5, 0.35, 0x0a4a8a, 0.5), glow = lit(0x9fefff);
    g.add(Z(G.cone(0.42, 1.8), hull, 0, 0, -1.3, 1, 0.75));
    g.add(Z(G.cyl(0.42, 0.55, 1.6, 6), hull, 0, 0, 0.4, 1, 0.75));
    g.add(P(G.sph(0.3), glass, 0, 0.27, -0.5, 0, 0, 0, 0.8, 0.6, 2.2));
    both(g, [[0.35, 0.5], [2.0, -0.9], [2.0, -1.4], [0.35, -1.1]], 0.1, acc);
    both(g, [[0.4, 0.1], [1.2, -0.6], [1.2, -0.85], [0.4, -0.7]], 0.14, hull, 0.03);
    for (const s of [-1, 1]) {
      g.add(Z(G.cyl(0.06, 0.08, 1.2, 6), dark, s * 2.0, 0, 0.75));
      g.add(Z(G.cyl(0.24, 0.3, 0.9), dark, s * 0.5, 0, 1.3));
      g.add(Z(G.cyl(0.2, 0.2, 0.06), glow, s * 0.5, 0, 1.77));
      g.add(P(G.box(0.06, 0.6, 0.75), acc, s * 0.52, 0.38, 1.15, 0, 0, -s * 0.35));
    }
    g.add(P(G.box(0.16, 0.05, 1.0), acc, 0, 0.2, -1.5));
  } else if (id === 'centella') {
    const hull = std(0xf4f0e2, 0.6, 0.3), acc = std(0xffc22e, 0.5, 0.35, 0x7a4a00, 0.5), glow = lit(0xffe9a0);
    g.add(Z(G.cone(0.3, 2.6, 5), acc, 0, 0, -1.1, 1, 0.7));
    g.add(Z(G.cyl(0.3, 0.38, 1.4, 5), hull, 0, 0, 0.9, 1, 0.7));
    g.add(P(G.sph(0.26), glass, 0, 0.2, -0.3, 0, 0, 0, 0.75, 0.55, 2.4));
    both(g, [[0.25, 0.1], [1.45, 0.8], [1.6, 0.45], [0.25, -1.3]], 0.08, hull);
    both(g, [[0.3, -0.3], [1.3, 0.45], [1.42, 0.3], [0.3, -0.9]], 0.12, acc, 0.02);
    both(g, [[0.12, 1.6], [0.75, 1.25], [0.75, 1.1], [0.12, 1.2]], 0.06, hull);
    g.add(Z(G.cyl(0.3, 0.36, 0.7), dark, 0, 0, 1.75));
    g.add(Z(G.cyl(0.25, 0.25, 0.06), glow, 0, 0, 2.12));
    for (const s of [-1, 1]) g.add(P(G.box(0.05, 0.6, 0.8), acc, s * 0.3, 0.33, 1.25, 0, 0, -s * 0.55));
  } else {
    const hull = std(0x8f97a8, 0.7, 0.38), acc = std(0xff4760, 0.5, 0.4, 0x7a0a1a, 0.5), glow = lit(0xffb0a0);
    g.add(Z(G.cyl(0.75, 0.95, 2.6), hull, 0, 0, 0.2, 1, 0.6));
    g.add(Z(G.cyl(0.35, 0.75, 0.8), acc, 0, 0, -1.5, 1, 0.6));
    g.add(Z(G.cyl(0.15, 0.17, 1.6), dark, 0, 0, -2.1));
    g.add(Z(G.cyl(0.24, 0.24, 0.2), acc, 0, 0, -2.8));
    g.add(P(G.box(0.62, 0.34, 0.95), glass, 0, 0.5, -0.1));
    g.add(P(plate([[0, 0.9], [0.55, 0.3], [0.5, -1.2], [-0.5, -1.2], [-0.55, 0.3]], 0.1), acc, 0, 0.58, 0.9));
    for (const s of [-1, 1]) {
      g.add(P(G.box(0.72, 0.56, 2.2), acc, s * 1.35, 0, 0.3));
      g.add(Z(G.cone(0.4, 0.7, 4), hull, s * 1.35, 0, -1.1, 1, 0.7));
      g.add(P(G.box(0.95, 0.18, 1.0), dark, s * 0.8, 0, 0.3));
      g.add(Z(G.cyl(0.07, 0.07, 1.0, 6), dark, s * 1.75, 0, -0.9));
      g.add(Z(G.cyl(0.26, 0.3, 0.5), dark, s * 1.35, 0, 1.6));
      g.add(Z(G.cyl(0.22, 0.22, 0.06), glow, s * 1.35, 0, 1.87));
      g.add(P(G.box(0.5, 0.08, 1.4), hull, s * 1.35, 0.3, 0.3));
    }
    g.add(Z(G.cyl(0.3, 0.34, 0.6), dark, 0, 0, 1.75));
    g.add(Z(G.cyl(0.26, 0.26, 0.06), glow, 0, 0, 2.07));
  }
  return g;
}

// ------------------------------------------------------------------ enemigos
function rockGeo(r, seed) {
  const g = G.ico(r, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = Math.sin(x * 3.1 / r + seed) * Math.cos(y * 2.7 / r + seed * 1.3) + Math.sin(z * 3.7 / r + seed * 0.7) * 0.6;
    const k = 1 + 0.2 * n;
    p.setXYZ(i, x * k, y * k * 0.85, z * k);
  }
  g.computeVertexNormals();
  return g;
}

const EnemyProto = {};
function buildEnemyProtos() {
  const dark = std(0x20232e, 0.7, 0.45);
  {
    const g = new T.Group(), body = std(0xb3283c, 0.6, 0.4), eye = lit(0xff9a6a);
    g.add(P(G.octa(0.7), body, 0, 0, 0, 0, 0, 0, 1.1, 0.5, 1.5));
    both(g, [[0.4, 0.3], [1.2, 1.0], [1.35, 0.65], [0.55, -0.7]], 0.12, dark);
    g.add(P(G.sph(0.2), eye, 0, 0.16, -0.55));
    g.add(Z(G.cyl(0.16, 0.16, 0.06), lit(0xff5a3a), 0, 0, 1.0));
    EnemyProto.drone = facingPlayer(g);
  }
  {
    const g = new T.Group(), body = std(0x7a3fd0, 0.6, 0.38), eye = lit(0xff7af0);
    g.add(Z(G.cone(0.42, 2.4, 5), body, 0, 0, -0.3, 1, 0.7));
    both(g, [[0.2, 0.4], [1.6, -1.0], [1.6, -1.5], [0.2, -0.7]], 0.1, dark);
    both(g, [[0.25, 0.1], [0.9, -0.6], [0.9, -0.8], [0.25, -0.5]], 0.14, body, 0.03);
    g.add(P(G.sph(0.2), eye, 0, 0.2, -0.3, 0, 0, 0, 0.8, 0.6, 2));
    for (const s of [-1, 1]) g.add(Z(G.cyl(0.14, 0.14, 0.06), lit(0xc27aff), s * 0.25, 0, 0.92));
    EnemyProto.fighter = facingPlayer(g);
  }
  {
    const g = new T.Group(), body = std(0xe07a1c, 0.55, 0.4, 0x5a2000, 0.6);
    g.add(Z(G.cone(0.55, 1.9, 6), body, 0, 0, 0));
    for (let i = 0; i < 3; i++) {
      const fin = P(G.box(0.08, 1.0, 0.9), dark, 0, 0, 0.5);
      const h = new T.Group(); h.add(fin); fin.position.y = 0.55; h.rotation.z = i * TAU / 3;
      g.add(h);
    }
    g.add(P(G.sph(0.22), lit(0xffe08a), 0, 0, -0.95));
    g.add(Z(G.cyl(0.3, 0.3, 0.06), lit(0xff8a3a), 0, 0, 0.96));
    EnemyProto.kamikaze = facingPlayer(g);
  }
  {
    const g = new T.Group(), body = std(0x1f8f86, 0.65, 0.4), top = std(0x2b3a44, 0.7, 0.4), eye = lit(0x7affea);
    g.add(P(plate([[0, 2.1], [1.6, 1.1], [2.3, -0.9], [1.2, -2], [-1.2, -2], [-2.3, -0.9], [-1.6, 1.1]], 0.7), body));
    g.add(P(plate([[0, 1.3], [0.9, 0.6], [1.1, -1.3], [-1.1, -1.3], [-0.9, 0.6]], 0.4), top, 0, 0.5, 0));
    g.add(P(G.box(1.2, 0.1, 0.12), eye, 0, 0.3, -1.75));
    for (const s of [-1, 1]) {
      g.add(P(G.cyl(0.45, 0.55, 0.4), top, s * 1.45, 0.5, -0.1));
      g.add(Z(G.cyl(0.09, 0.09, 1.3, 6), dark, s * 1.45, 0.6, -0.8));
      g.add(Z(G.cyl(0.28, 0.28, 0.06), lit(0x5affd0), s * 0.6, 0, 2.02));
    }
    EnemyProto.gunship = facingPlayer(g);
  }
  {
    const g = new T.Group(), body = std(0x3a3f4c, 0.8, 0.35), core = lit(0xff5a2a);
    g.add(P(G.ico(0.62), body));
    const dirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    for (const d of dirs) {
      const c = new T.Mesh(G.cone(0.14, 0.6, 5), body);
      c.position.set(d[0] * 0.8, d[1] * 0.8, d[2] * 0.8);
      c.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(...d));
      g.add(c);
    }
    g.add(P(G.torus(0.72, 0.07, 16), core, 0, 0, 0, Math.PI / 2));
    g.add(P(G.sph(0.2), core, 0, 0.6, 0));
    EnemyProto.mine = g;
  }
  const rock = std(0x7a6658, 0.15, 0.95);
  EnemyProto.asteroid = [0, 1, 2].map((i) => new T.Mesh(rockGeo(2.1, i * 2.3 + 0.5), rock));
  EnemyProto.rock = [0, 1, 2].map((i) => new T.Mesh(rockGeo(1.05, i * 1.7 + 4), rock));
}

// ------------------------------------------------------------------ jefes
function buildCentinela() {
  const g = new T.Group();
  const hull = std(0x566074, 0.75, 0.36), dark = std(0x1d222e, 0.75, 0.45), acc = std(0xd23a3a, 0.5, 0.4, 0xa01010, 0.9);
  const red = lit(0xff5540), amber = lit(0xffb060);
  g.add(P(plate([[0, 5], [1.4, 3], [2.2, 0.8], [6.6, -1.2], [7, -2.8], [3.2, -3.4], [1.6, -4.4], [-1.6, -4.4], [-3.2, -3.4], [-7, -2.8], [-6.6, -1.2], [-2.2, 0.8], [-1.4, 3]], 1.0), hull));
  g.add(P(plate([[0, 3.8], [1, 2], [1.5, -1], [1.2, -3.6], [-1.2, -3.6], [-1.5, -1], [-1, 2]], 0.6), dark, 0, 0.75, 0));
  g.add(P(G.box(1.3, 0.8, 1.7), hull, 0, 1.4, 2.0));
  g.add(P(G.box(1.05, 0.14, 0.06), amber, 0, 1.55, 1.13));
  g.add(Z(G.cyl(0.3, 0.5, 1.6), dark, 0, 0.1, -4.6));
  g.add(P(G.sph(0.34), red, 0, 0.1, -5.45));
  both(g, [[2.4, 0.3], [6.3, -1.5], [6.4, -1.9], [2.6, -0.3]], 0.14, acc, 0.55);
  const turrets = [];
  for (const s of [-1, 1]) {
    const t = new T.Group();
    t.add(P(G.cyl(0.9, 1.15, 0.5), dark));
    t.add(P(G.sph(0.75, 10, 6), hull, 0, 0.2, 0, 0, 0, 0, 1, 0.7, 1));
    for (const k of [-1, 1]) t.add(Z(G.cyl(0.11, 0.13, 1.9, 6), dark, k * 0.28, 0.35, -1.2));
    t.add(P(G.box(0.5, 0.08, 0.08), red, 0, 0.62, -0.5));
    t.position.set(s * 4.8, 0.7, 1.9);
    g.add(t); turrets.push(t);
    g.add(Z(G.cyl(0.5, 0.62, 1.0), dark, s * 0.85, 0, 4.6));
    g.add(Z(G.cyl(0.42, 0.42, 0.06), amber, s * 0.85, 0, 5.12));
    g.add(Z(G.cyl(0.36, 0.45, 0.8), dark, s * 4.6, 0, 3.3));
    g.add(Z(G.cyl(0.3, 0.3, 0.06), amber, s * 4.6, 0, 3.72));
    g.add(P(G.box(0.12, 0.12, 2.6), red, s * 1.75, 0.56, -0.6, 0, s * 0.33, 0));
  }
  const root = facingPlayer(g);
  root.userData.turrets = turrets;
  return root;
}

function buildHidra() {
  const g = new T.Group();
  const shell = std(0x1c3a2c, 0.7, 0.4), bone = std(0xa9b394, 0.4, 0.55), dark = std(0x10201a, 0.7, 0.5);
  const tox = lit(0x8dff5a), tox2 = lit(0xd8ff9a);
  g.add(P(G.ico(2.3, 1), shell, 0, 0, 0, 0, 0, 0, 1, 0.8, 1));
  const eye = P(G.sph(1.15, 14, 8), tox, 0, 1.25, 0, 0, 0, 0, 1, 0.55, 1);
  g.add(eye);
  g.add(P(G.torus(1.35, 0.16, 18), bone, 0, 1.3, 0, Math.PI / 2));
  const ring = P(G.torus(3.3, 0.24, 28), bone, 0, 0, 0, Math.PI / 2);
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6;
    ring.add(P(G.cone(0.22, 0.9, 5), bone, Math.cos(a) * 3.3, Math.sin(a) * 3.3, -0.5, -Math.PI / 2));
  }
  g.add(ring);
  const arms = new T.Group();
  for (let i = 0; i < 3; i++) {
    const a = new T.Group();
    a.rotation.y = i * TAU / 3;
    a.add(P(G.box(0.95, 0.7, 1.7), shell, 0, 0, 3.2));
    a.add(P(G.box(0.7, 0.5, 1.6), dark, 0, 0, 4.7));
    a.add(P(G.sph(0.42), bone, 0, 0, 3.95));
    a.add(P(G.octa(1.0), shell, 0, 0, 6.2, 0, 0, 0, 1.05, 0.7, 1.35));
    a.add(P(G.sph(0.42), tox2, 0, 0.1, 7.05));
    for (const s of [-1, 1]) a.add(P(G.cone(0.16, 0.9, 5), bone, s * 0.6, 0, 7.0, Math.PI / 2, 0, -s * 0.35));
    a.add(P(G.box(0.2, 0.1, 1.2), tox, 0, 0.4, 3.2));
    arms.add(a);
  }
  g.add(arms);
  g.userData = { arms, ring, eye };
  return g;
}

function buildLeviatan() {
  const g = new T.Group();
  const hull = std(0x2a1f48, 0.8, 0.35), steel = std(0x6a5c9c, 0.75, 0.3), dark = std(0x120c22, 0.8, 0.45);
  const mag = lit(0xff4df0), cyan = lit(0x6aeaff);
  const core = P(G.sph(1.9, 18, 12), mag);
  g.add(core);
  const cage = new T.Mesh(G.octa(2.9), new T.MeshBasicMaterial({ color: 0xb9a8ff, wireframe: true, toneMapped: false }));
  g.add(cage);
  const ring1 = P(G.torus(4.3, 0.3, 36), steel);
  const ring2 = P(G.torus(5.3, 0.24, 40), hull);
  for (let i = 0; i < 4; i++) {
    const a = i * TAU / 4;
    ring1.add(P(G.box(0.7, 0.7, 0.7), mag, Math.cos(a) * 4.3, Math.sin(a) * 4.3, 0, 0, 0, a, 0.6, 0.6, 0.6));
    ring2.add(P(G.box(0.9, 0.5, 0.9), steel, Math.cos(a + 0.6) * 5.3, Math.sin(a + 0.6) * 5.3, 0));
  }
  g.add(ring1, ring2);
  both(g, [[2.6, 1.3], [8.6, 0.7], [9.8, -0.6], [8.8, -1.7], [2.6, -1.3]], 0.5, hull);
  both(g, [[3.2, 0.5], [8, 0.2], [8, -0.2], [3.2, -0.5]], 0.14, steel, 0.32);
  g.add(P(plate([[0, -2.6], [1.6, -3.4], [0.8, -6], [0, -6.6], [-0.8, -6], [-1.6, -3.4]], 0.6), hull));
  const pods = [];
  for (const s of [-1, 1]) {
    const p = new T.Group();
    p.add(Z(G.cyl(1.05, 1.3, 3.2), dark, 0, 0, 0, 1, 0.8));
    p.add(Z(G.cyl(0.6, 0.9, 0.9), steel, 0, 0, -1.9, 1, 0.8));
    p.add(P(G.sph(0.55), cyan, 0, 0, -2.35));
    p.add(P(G.box(0.2, 0.12, 2.4), cyan, 0, 0.9, 0));
    p.add(Z(G.cyl(0.7, 0.7, 0.06), mag, 0, 0, 1.63, 1, 0.8));
    p.position.set(s * 8, 0, 0.3);
    g.add(p); pods.push(p);
    g.add(P(G.cone(0.35, 2.6, 5), steel, s * 2.4, 0.3, 3.6, Math.PI / 2 + 0.25, 0, s * 0.35));
    g.add(P(plate([[0.6, -2.4], [2.4, -1.5], [2.0, -3.6], [0.9, -4.4]].map(([x, y]) => [x * s, -y]), 0.3), steel, 0, -0.1, 0));
  }
  g.add(P(G.cone(0.4, 3.0, 5), steel, 0, 0.7, 5.2, Math.PI / 2 + 0.3));
  const root = facingPlayer(g);
  root.userData = { core, cage, ring1, ring2, pods };
  return root;
}

// ------------------------------------------------------------------ objetos recogibles
function buildPickup(type) {
  const g = new T.Group();
  if (type === 'P') {
    g.add(P(G.octa(0.55), std(0xffd23a, 0.6, 0.25, 0xff9a00, 1.2)));
    g.add(P(G.torus(0.8, 0.07, 20), lit(0xfff0a0), 0, 0, 0, Math.PI / 2));
  } else if (type === 'H') {
    const m = std(0x3aff7a, 0.4, 0.3, 0x10c040, 1.2);
    g.add(P(G.box(1.0, 0.34, 0.34), m), P(G.box(0.34, 0.34, 1.0), m), P(G.box(0.34, 1.0, 0.34), m));
  } else {
    const m = std(0xc05aff, 0.5, 0.25, 0x8a20ff, 1.3);
    g.add(P(new T.TetrahedronGeometry(0.62), m), P(new T.TetrahedronGeometry(0.62), m, 0, 0, 0, Math.PI / 2, 0, Math.PI / 2));
    g.add(P(G.torus(0.85, 0.06, 20), lit(0xe6b0ff), 0, 0, 0, Math.PI / 2));
  }
  return g;
}

// ------------------------------------------------------------------ texturas de fondo
function planetTexture(cols, bands) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  cols.forEach((col, i) => grad.addColorStop(i / (cols.length - 1), col));
  g.fillStyle = grad; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 260; i++) {
    g.globalAlpha = rand(0.05, 0.2);
    g.fillStyle = pick(cols);
    const y = rand(256), w = rand(30, 220), h = bands ? rand(2, 9) : rand(8, 40), x = rand(512);
    for (const ox of [0, -512, 512]) { g.beginPath(); g.ellipse(x + ox, y, w, h, 0, 0, TAU); g.fill(); }
  }
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  tex.wrapS = T.RepeatWrapping;
  return tex;
}

function nebulaTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const x = rand(60, 196), y = rand(60, 196), r = rand(30, 90);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,' + rand(0.05, 0.16).toFixed(3) + ')');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  }
  const mask = g.createRadialGradient(128, 128, 40, 128, 128, 128);
  mask.addColorStop(0, 'rgba(0,0,0,0)'); mask.addColorStop(1, 'rgba(0,0,0,1)');
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = mask; g.fillRect(0, 0, 256, 256);
  return new T.CanvasTexture(c);
}

function beamTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 4;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 64, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(0.3, 'rgba(255,255,255,0.45)');
  gr.addColorStop(0.5, 'rgba(255,255,255,1)');
  gr.addColorStop(0.7, 'rgba(255,255,255,0.45)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 4);
  return new T.CanvasTexture(c);
}

const THEMES = [
  { name: 'FRONTERA AZUL', bg: 0x040918, neb: [0x1b4fff, 0x00a7ff, 0x5a2cff], rim: 0x3aa0ff, atmo: 0x58b8ff, root: 45,
    planet: ['#0b2a5a', '#1668b8', '#3fb6d8', '#e8f4ff', '#1a7a6a', '#0d3a70'], bands: false, ppos: [-150, -110, -215] },
  { name: 'CINTURÓN CARMESÍ', bg: 0x120508, neb: [0xff3b1f, 0xff8a00, 0x9b1b4a], rim: 0xff7a3a, atmo: 0xff8a4a, root: 43,
    planet: ['#3a0d08', '#a8320f', '#f08a2a', '#ffd08a', '#c0501a', '#7a1c10', '#2a0805'], bands: true, ppos: [155, -115, -225] },
  { name: 'NÚCLEO OSCURO', bg: 0x07041a, neb: [0x9b2cff, 0xff2ccf, 0x1fffb0], rim: 0xc04aff, atmo: 0xb060ff, root: 41,
    planet: ['#12062a', '#3a1670', '#7a2cc0', '#1fd8a0', '#240a4a', '#0a0418'], bands: false, ppos: [-145, -120, -235] },
];
