// Rideables for Bogan Bay: parked e-scooters around the houses and a jet ski
// hire jetty on the beach. Jet skis float on the shared wave model; scooters
// follow the terrain. Everything is original procedural geometry.
import * as THREE from 'three';
import { mergeGeometries } from './addons/utils/BufferGeometryUtils.js';
import { poseTradie } from './tradie-actions.js';

const clamp = THREE.MathUtils.clamp, damp = THREE.MathUtils.damp;
const smooth = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const G = 9.81;

function tableLerp(table, t) {
  for (let i = 1; i < table.length; i++) if (t <= table[i][0]) {
    const [t0, v0] = table[i - 1], [t1, v1] = table[i], u = (t - t0) / (t1 - t0 || 1); return v0 + (v1 - v0) * (u * u * (3 - 2 * u));
  }
  return table[table.length - 1][1];
}
function colorGeo(geo, color) {
  const c = new THREE.Color(color), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo;
}
function part(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  const g = geo.index ? geo.toNonIndexed() : geo.clone(); g.applyMatrix4(m); return g;
}
const stripUV = g => { g.deleteAttribute('uv'); return g; };
const merge = list => { const clean = list.map(g => { const c = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(c.attributes)) if (!['position', 'normal', 'color'].includes(k)) c.deleteAttribute(k); return c; }); return mergeGeometries(clean); };

// ---------------------------------------------------------------- Jet ski ----
const HULL_LEN = 3.4, HULL_Z0 = -1.65;
const hullWidth = t => t < 0.12 ? 0.40 + 0.18 * (t / 0.12) : t < 0.5 ? 0.58 : Math.max(0.02, 0.58 * (1 - Math.pow((t - 0.5) / 0.5, 1.8)));
const deckY = t => tableLerp([[0, 0.44], [0.2, 0.50], [0.4, 0.54], [0.6, 0.57], [0.8, 0.56], [0.93, 0.50], [1, 0.40]], t);
const keelY = t => tableLerp([[0, -0.02], [0.15, -0.12], [0.4, -0.14], [0.6, -0.12], [0.8, -0.02], [0.93, 0.18], [1, 0.38]], t);

function loftShell(upper, accent, main, lowerColor) {
  const S = 34, C = 14, pos = [], col = [], idx = [];
  const cMain = new THREE.Color(main), cAcc = new THREE.Color(accent), cLow = new THREE.Color(lowerColor), tmp = new THREE.Color();
  for (let s = 0; s <= S; s++) {
    const t = s / S, z = HULL_Z0 + t * HULL_LEN, hw = hullWidth(t), yt = deckY(t), yb = keelY(t), yg = yt - 0.11;
    for (let c = 0; c <= C; c++) {
      const u = c / C; let x, y;
      if (upper) { const xx = (u * 2 - 1); x = xx * hw; y = yg + (yt - yg) * (1 - xx * xx); }
      else { const phi = u * Math.PI; x = Math.cos(phi) * hw; y = yb + (yg - yb) * (1 - Math.pow(Math.sin(phi), 0.62)); }
      pos.push(x, y, z);
      if (upper) {
        const edge = Math.abs(x) / Math.max(hw, 0.001);
        tmp.copy(cMain);
        if (edge > 0.8 && edge < 0.93) tmp.copy(cAcc);
        if (t > 0.9) tmp.copy(cAcc);
        if (t < 0.06) tmp.copy(cLow);
        // subtle shading band along the centre line to read as moulded plastic
        tmp.multiplyScalar(0.92 + 0.08 * (1 - Math.abs(x) / Math.max(hw, 0.001)));
      } else { tmp.copy(cLow); if (Math.abs(Math.cos(u * Math.PI)) > 0.93) tmp.lerp(cAcc, 0.7); }
      col.push(tmp.r, tmp.g, tmp.b);
    }
  }
  for (let s = 0; s < S; s++) for (let c = 0; c < C; c++) {
    const a = s * (C + 1) + c, b = a + 1, d = a + C + 1, e = d + 1; idx.push(a, d, b, b, d, e);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  // Orient outward: upper shells face up, lower hulls face down.
  const n = g.attributes.normal, mid = Math.floor(S * 0.4) * (C + 1) + C / 2;
  if ((upper && n.getY(mid) < 0) || (!upper && n.getY(mid) > 0)) { idx.reverse(); g.setIndex(idx); g.computeVertexNormals(); }
  return g;
}

export function buildJetski({ main = '#e8602c', accent = '#f3ead5', lower = '#1d2528' } = {}) {
  const root = new THREE.Group(), bars = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.05, side: THREE.DoubleSide });
  const dark = new THREE.MeshStandardMaterial({ color: '#15191b', roughness: 0.7 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#0d0f10', roughness: 0.9 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#b9c2c0', roughness: 0.25, metalness: 0.85 });
  const glass = new THREE.MeshStandardMaterial({ color: '#9fb9c4', roughness: 0.1, transparent: true, opacity: 0.38, side: THREE.DoubleSide });
  const lamp = new THREE.MeshStandardMaterial({ color: '#fff0c0', emissive: '#ffcf70', emissiveIntensity: 0.9 });
  const body = new THREE.Mesh(merge([loftShell(true, accent, main, lower), loftShell(false, accent, main, lower)]), hullMat);
  body.castShadow = true; body.receiveShadow = true; root.add(body);

  const seatBase = deckY(0.3) + 0.01, black = [];
  black.push(part(new THREE.CapsuleGeometry(0.17, 0.78, 6, 14), 0, seatBase + 0.08, -0.58, Math.PI / 2, 0, 0, 1, 0.52, 1));
  black.push(part(new THREE.BoxGeometry(0.36, 0.06, 0.18), 0, seatBase + 0.15, -1.08)); // seat back lip
  for (const sx of [-1, 1]) {
    black.push(part(new THREE.BoxGeometry(0.11, 0.03, 1.2), sx * 0.47, deckY(0.35) - 0.07, -0.3)); // footwells
    black.push(part(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 8), sx * 0.545, deckY(0.45) - 0.12, 0.1, Math.PI / 2, 0, 0)); // rub rail
  }
  black.push(part(new THREE.BoxGeometry(0.72, 0.035, 0.42), 0, deckY(0.02) + 0.02, -1.42)); // boarding platform
  black.push(part(new THREE.CylinderGeometry(0.1, 0.125, 0.22, 14), 0, 0.2, -1.74, Math.PI / 2, 0, 0)); // jet nozzle
  black.push(part(new THREE.BoxGeometry(0.5, 0.12, 0.3), 0, deckY(0.55) + 0.05, 0.28)); // console base
  const blackMesh = new THREE.Mesh(merge(black.map(g => colorGeo(g, '#15191b'))), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 }));
  blackMesh.castShadow = true; root.add(blackMesh);

  // Steering column and bars pivot at the console.
  const pivot = new THREE.Vector3(0, deckY(0.55) + 0.1, 0.34);
  bars.position.copy(pivot);
  const barsGeo = [];
  barsGeo.push(part(new THREE.CylinderGeometry(0.03, 0.04, 0.34, 10), 0, 0.17, 0.0, -0.25, 0, 0));
  barsGeo.push(part(new THREE.CylinderGeometry(0.018, 0.018, 0.62, 10), 0, 0.37, -0.07, 0, 0, Math.PI / 2));
  for (const sx of [-1, 1]) { barsGeo.push(part(new THREE.CylinderGeometry(0.024, 0.024, 0.13, 10), sx * 0.3, 0.37, -0.07, 0, 0, Math.PI / 2)); }
  barsGeo.push(part(new THREE.BoxGeometry(0.18, 0.06, 0.09), 0, 0.33, 0.02, -0.4, 0, 0));
  const barMesh = new THREE.Mesh(merge(barsGeo.map(g => colorGeo(g, '#202628'))), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.3 }));
  barMesh.castShadow = true; bars.add(barMesh);
  const shield = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.26), glass); shield.position.set(0, 0.36, 0.33); shield.rotation.x = -0.95; bars.add(shield);
  const light = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.06), lamp); light.position.set(0, deckY(0.93) + 0.01, 1.15); root.add(light);
  root.add(bars);
  const mirror = [];
  for (const sx of [-1, 1]) mirror.push(part(new THREE.BoxGeometry(0.1, 0.07, 0.03), sx * 0.34, 0.44, 0.1, 0, sx * 0.4, 0));
  const mirrors = new THREE.Mesh(merge(mirror.map(g => colorGeo(g, accent))), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 })); bars.add(mirrors);
  root.userData = { bars, pivot, seat: new THREE.Vector3(0, seatBase + 0.12, -0.62), grips: [new THREE.Vector3(-0.30, 0.37, -0.07), new THREE.Vector3(0.30, 0.37, -0.07)], hullMat };
  root.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  return root;
}

// -------------------------------------------------------------- E-scooter ----
const SCOOTER_COLOURS = ['#14a39a', '#e6703a', '#e9e5d6', '#c93d3a', '#3d7bd1', '#9bb534'];
const STEER_TILT = -0.2, STEER_BASE = new THREE.Vector3(0, 0.21, 0.47);
const sbox = (w, h, d) => new THREE.BoxGeometry(w, h, d), scyl = (r1, r2, h, n = 12) => new THREE.CylinderGeometry(r1, r2, h, n);
// Chassis: deck, grip tape, rear mudguard + brake light, rear wheel, battery shroud, kickstand.
function scooterChassis() {
  const out = { frame: [], dark: [], tire: [], lamp: [], tail: [], metal: [] };
  const P = (key, geo, x, y, z, rx = 0, ry = 0, rz = 0) => out[key].push(part(geo, x, y, z, rx, ry, rz));
  P('frame', sbox(0.19, 0.05, 0.72), 0, 0.15, -0.02);
  P('dark', sbox(0.16, 0.012, 0.58), 0, 0.18, -0.06);
  P('frame', sbox(0.14, 0.02, 0.3), 0, 0.31, -0.43, 0.28, 0, 0);
  P('frame', sbox(0.12, 0.2, 0.2), 0, 0.28, 0.36);
  P('tail', sbox(0.07, 0.03, 0.025), 0, 0.28, -0.56);
  P('tire', scyl(0.125, 0.125, 0.055, 20), 0, 0.125, -0.46, 0, 0, Math.PI / 2);
  P('metal', scyl(0.07, 0.07, 0.062, 12), 0, 0.125, -0.46, 0, 0, Math.PI / 2);
  P('metal', scyl(0.012, 0.012, 0.12, 6), 0.075, 0.09, -0.25, 0, 0, -0.5);
  return out;
}
// Front assembly in its own tilted steering frame (origin at the column base, y up the column).
function scooterFront() {
  const out = { frame: [], dark: [], tire: [], lamp: [], tail: [], metal: [] };
  const P = (key, geo, x, y, z, rx = 0, ry = 0, rz = 0) => out[key].push(part(geo, x, y, z, rx, ry, rz));
  P('metal', scyl(0.018, 0.02, 0.86, 10), 0, 0.43, 0);
  P('tire', scyl(0.125, 0.125, 0.055, 20), 0, -0.085, 0, 0, 0, Math.PI / 2);
  P('metal', scyl(0.07, 0.07, 0.062, 12), 0, -0.085, 0, 0, 0, Math.PI / 2);
  for (const sx of [-1, 1]) P('metal', sbox(0.014, 0.22, 0.02), sx * 0.04, -0.01, 0);
  P('frame', sbox(0.1, 0.014, 0.22), 0, 0.07, 0);
  P('metal', scyl(0.014, 0.014, 0.54, 8), 0, 0.88, 0, 0, 0, Math.PI / 2);
  for (const sx of [-1, 1]) P('dark', scyl(0.019, 0.019, 0.11, 8), sx * 0.28, 0.88, 0, 0, 0, Math.PI / 2);
  P('dark', sbox(0.1, 0.035, 0.06), 0, 0.92, 0.03);
  P('lamp', sbox(0.07, 0.05, 0.03), 0, 0.72, 0.035);
  P('frame', sbox(0.045, 0.2, 0.05), 0, 0.2, 0.03);
  return out;
}
const SCOOTER_MATERIALS = {
  frame: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.42, metalness: 0.2 }),
  dark: new THREE.MeshStandardMaterial({ color: '#17191a', roughness: 0.8 }),
  tire: new THREE.MeshStandardMaterial({ color: '#0b0c0d', roughness: 0.95 }),
  lamp: new THREE.MeshStandardMaterial({ color: '#fff4cf', emissive: '#ffd37a', emissiveIntensity: 1.2 }),
  tail: new THREE.MeshStandardMaterial({ color: '#7a0f0f', emissive: '#ff2a1a', emissiveIntensity: 1.4 }),
  metal: new THREE.MeshStandardMaterial({ color: '#aeb6b3', roughness: 0.32, metalness: 0.85 })
};
const frontMatrix = () => new THREE.Matrix4().makeTranslation(STEER_BASE.x, STEER_BASE.y, STEER_BASE.z).multiply(new THREE.Matrix4().makeRotationX(STEER_TILT));
// Whole scooter with the bars straight, for instancing the parked ones.
function scooterStatic() {
  const chassis = scooterChassis(), front = scooterFront(), fm = frontMatrix();
  for (const key of Object.keys(front)) for (const g of front[key]) { g.applyMatrix4(fm); chassis[key].push(g); }
  return chassis;
}
function mergedMeshes(parts, materials, group) {
  for (const key of Object.keys(parts)) if (parts[key].length) {
    const mesh = new THREE.Mesh(merge(parts[key].map(g => colorGeo(g, '#ffffff'))), materials[key]); mesh.castShadow = true; group.add(mesh);
  }
  return group;
}

export function createRides({ padAt = () => null, scene, height, extraSites = [], blocked, ocean, surfaceAt, housePlots, colliders, npcs, character, person, state, toast, impact, onGround = () => {} }) {
  const JETTY = { x0: 83.5, x1: 104.5, z: -48, half: 1.15, y: 0.72 };
  // Ground height including the jetty deck (walkers, scooters, props).
  function platformAt(x, z) {
    return x > JETTY.x0 && x < JETTY.x1 && Math.abs(z - JETTY.z) < JETTY.half - 0.05 ? JETTY.y : null;
  }
  const groundY = (x, z) => { const p = platformAt(x, z), q = padAt(x, z); let y = height(x, z); if (p != null) y = Math.max(y, p); if (q != null && q - y < 0.4) y = Math.max(y, q); return y; };
  const rides = { active: null, scooters: [], jetskis: [], camYaw: 0, audio: null };
  const up = new THREE.Vector3(0, 1, 0), Q = new THREE.Quaternion(), E = new THREE.Euler(0, 0, 0, 'YXZ');

  // ---------- Instanced parked scooters + one articulated ridden scooter ----------
  const staticParts = scooterStatic(), staticMeshes = {};
  const sites = [];
  const addSite = (x, z, yaw, why) => {
    if (blocked(x, z, 0.55)) return false;
    const h = Math.min(groundY(x, z), groundY(x + 0.4, z), groundY(x - 0.4, z), groundY(x, z + 0.4), groundY(x, z - 0.4));
    if (h < 0.1 || x > 82) return false;
    sites.push({ x, z, yaw, why }); return true;
  };
  // Houses: leaned beside the driveway on the lawn.
  housePlots.forEach((p, i) => {
    if (i % 6 !== 2) return;
    const fx = Math.sin(p.angle), fz = Math.cos(p.angle), sx = Math.cos(p.angle), sz = -Math.sin(p.angle);
    for (const [along, off, yawAdd] of [[0.38, 1.9, 1.35], [0.52, -1.9, -1.2], [0.25, 2.6, 0.4], [0.7, 1.4, 1.5]]) {
      const x = p.start[0] + (p.end[0] - p.start[0]) * along + sx * off, z = p.start[1] + (p.end[1] - p.start[1]) * along + sz * off;
      if (addSite(x, z, p.angle + yawAdd, 'house')) break;
    }
  });
  for (const e of extraSites) sites.push({ x: e.x, z: e.z, yaw: e.yaw, why: 'home' });
  // Landmarks, shelters and beach car park.
  for (const [x, z, yaw] of [[-8, 24, 1.2], [-13, 30, 0.6], [-30, -112, 0.9], [-22, -128, 2.3], [70, -135, 1.3], [66, -112, 0.4], [60, -142, 2.1], [-92, -250, 0.7], [-96, -242, 1.5], [-170, 428, 1.1], [-168, 454, 2.6], [-462, 90, 0.5], [-40, -150, 0.3], [75, -52, 1.6], [72, -40, 1.9], [30, 52, 0.8], [6, 50, 2.0], [-9, -37, 1.4]]) addSite(x, z, yaw, 'landmark');
  const scooterMeshes = [];
  for (const key of Object.keys(staticParts)) {
    const g = merge(staticParts[key].map(gg => { const c = gg.clone(); return colorGeo(c, '#ffffff'); }));
    const mesh = new THREE.InstancedMesh(g, key === 'frame' ? SCOOTER_MATERIALS.frame.clone() : SCOOTER_MATERIALS[key], Math.max(1, sites.length));
    mesh.castShadow = true; mesh.frustumCulled = false; mesh.count = sites.length; staticMeshes[key] = mesh; scene.add(mesh); scooterMeshes.push(mesh);
  }
  const m4 = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  function writeScooter(sc) {
    const y = groundY(sc.x, sc.z);
    const front = groundY(sc.x + Math.sin(sc.yaw) * 0.45, sc.z + Math.cos(sc.yaw) * 0.45), rear = groundY(sc.x - Math.sin(sc.yaw) * 0.45, sc.z - Math.cos(sc.yaw) * 0.45);
    sc.pitch = Math.atan2(front - rear, 0.9);
    E.set(-sc.pitch, sc.yaw, sc.parkedLean ?? 0.16, 'YXZ'); Q.setFromEuler(E);
    m4.compose(new THREE.Vector3(sc.x, (front + rear) / 2, sc.z), Q, new THREE.Vector3(1, 1, 1));
    for (const mesh of scooterMeshes) mesh.setMatrixAt(sc.index, sc.ridden ? zero : m4);
    for (const mesh of scooterMeshes) mesh.instanceMatrix.needsUpdate = true;
    sc.y = y;
  }
  sites.forEach((s, i) => {
    const sc = { kind: 'scooter', index: i, x: s.x, z: s.z, yaw: s.yaw, speed: 0, steer: 0, parkedLean: 0.16, colour: SCOOTER_COLOURS[i % SCOOTER_COLOURS.length], why: s.why, hop: 0, vy: 0 };
    rides.scooters.push(sc);
    for (const mesh of [staticMeshes.frame]) mesh.setColorAt(i, new THREE.Color(sc.colour));
    writeScooter(sc);
  });
  if (staticMeshes.frame.instanceColor) staticMeshes.frame.instanceColor.needsUpdate = true;

  // Ridden scooter: the front assembly steers on its own tilted pivot.
  const riddenMat = { frame: SCOOTER_MATERIALS.frame.clone(), dark: SCOOTER_MATERIALS.dark, tire: SCOOTER_MATERIALS.tire, lamp: SCOOTER_MATERIALS.lamp, tail: SCOOTER_MATERIALS.tail, metal: SCOOTER_MATERIALS.metal };
  const riddenGroup = new THREE.Group(), steerPivot = new THREE.Group(), steerTurn = new THREE.Group();
  // The deck sits in a pivot on the steering column so a tail whip can spin it round the bars.
  const deckSpin = new THREE.Group(), deckInner = new THREE.Group();
  deckSpin.position.set(0, 0, STEER_BASE.z); deckInner.position.set(0, 0, -STEER_BASE.z); deckSpin.add(deckInner); riddenGroup.add(deckSpin);
  mergedMeshes(scooterChassis(), riddenMat, deckInner);
  steerPivot.position.copy(STEER_BASE); steerPivot.rotation.x = STEER_TILT; steerPivot.add(steerTurn); riddenGroup.add(steerPivot);
  mergedMeshes(scooterFront(), riddenMat, steerTurn);
  riddenGroup.visible = false; scene.add(riddenGroup);
  let riddenSteer = 0;
  const riderQuat = new THREE.Quaternion(), REAR_PIVOT = new THREE.Vector3(0, 0.125, -0.46);
  const Q0 = new THREE.Quaternion(), Q1 = new THREE.Quaternion(), pv0 = new THREE.Vector3(), pv1 = new THREE.Vector3();

  // ------------------------- Jet ski hire jetty + floating props -------------------------
  const jettyGroup = new THREE.Group();
  {
    const wood = new THREE.MeshStandardMaterial({ color: '#8d7350', roughness: 0.92 }), dark = new THREE.MeshStandardMaterial({ color: '#4d3d2a', roughness: 0.95 });
    const planks = [], posts = [];
    for (let x = JETTY.x0; x < JETTY.x1; x += 0.62) planks.push(colorGeo(part(new THREE.BoxGeometry(0.56, 0.09, JETTY.half * 2), x + 0.28, JETTY.y - 0.045, JETTY.z), x % 1.24 < 0.62 ? '#9a8058' : '#85694a'));
    for (let x = JETTY.x0 + 1; x < JETTY.x1; x += 4.2) for (const s of [-1, 1]) {
      const baseY = height(x, JETTY.z + s * JETTY.half), top = JETTY.y + 0.55;
      posts.push(colorGeo(part(new THREE.CylinderGeometry(0.1, 0.12, top - Math.min(baseY, -2) , 8), x, (top + Math.min(baseY, -2)) / 2, JETTY.z + s * JETTY.half), '#55422d'));
      posts.push(colorGeo(part(new THREE.BoxGeometry(0.22, 0.05, 0.22), x, top, JETTY.z + s * JETTY.half), '#6a5238'));
    }
    for (const s of [-1, 1]) planks.push(colorGeo(part(new THREE.BoxGeometry(JETTY.x1 - JETTY.x0, 0.16, 0.12), (JETTY.x0 + JETTY.x1) / 2, JETTY.y - 0.12, JETTY.z + s * (JETTY.half - 0.05)), '#6b5539'));
    // Bollards for the mooring lines.
    for (const x of [92, 98, 103]) for (const s of [-1, 1]) posts.push(colorGeo(part(new THREE.CylinderGeometry(0.07, 0.09, 0.28, 8), x, JETTY.y + 0.13, JETTY.z + s * (JETTY.half - 0.18)), '#2b2f31'));
    const m1 = new THREE.Mesh(merge(planks), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 })); m1.castShadow = m1.receiveShadow = true; jettyGroup.add(m1);
    const m2 = new THREE.Mesh(merge(posts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })); m2.castShadow = true; jettyGroup.add(m2);
    // Hire sign at the shore end.
    const c = document.createElement('canvas'); c.width = 512; c.height = 160; const cx = c.getContext('2d');
    cx.fillStyle = '#17353a'; cx.fillRect(0, 0, 512, 160); cx.fillStyle = '#f1d787'; cx.fillRect(0, 0, 512, 14); cx.fillRect(0, 146, 512, 14);
    cx.fillStyle = '#f6efd8'; cx.font = 'bold 66px "Barlow Condensed", sans-serif'; cx.textAlign = 'center'; cx.fillText('JET SKI HIRE', 256, 84);
    cx.font = '28px sans-serif'; cx.fillStyle = '#f1d787'; cx.fillText('E TO BOARD  ·  NO WORRIES', 256, 124);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.06), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, side: THREE.DoubleSide }));
    sign.position.set(JETTY.x0 + 2, JETTY.y + 2.4, JETTY.z); sign.rotation.y = Math.PI / 2; jettyGroup.add(sign);
    for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 8), dark); post.position.set(JETTY.x0 + 2, JETTY.y + 1.2, JETTY.z + s * 1.5); jettyGroup.add(post); }
    scene.add(jettyGroup);
  }
  // ---------- Jet skis ----------
  const JET_COLOURS = [
    { main: '#e8602c', accent: '#f3ead5' }, { main: '#1f9c9a', accent: '#f1d787' }, { main: '#e9e0c6', accent: '#c4422f' },
    { main: '#c23b3b', accent: '#f3ead5' }, { main: '#35618f', accent: '#f1d787' }, { main: '#a6b832', accent: '#1d2528' }
  ];
  function newJet(x, z, yaw, colourIndex, mooring = null) {
    const model = buildJetski(JET_COLOURS[colourIndex % JET_COLOURS.length]); scene.add(model);
    const j = { kind: 'jetski', model, x, z, yaw, y: ocean.height(x, z) - 0.12, vx: 0, vz: 0, vy: 0, wy: 0, pitch: 0, roll: 0, thr: 0, steer: 0, steerVis: 0, contact: true, grounded: false, airborne: 0, mooring, home: mooring ? { x, z, yaw } : null, speed: 0, rope: null, idleTime: 0 };
    if (mooring) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 8), 3));
      j.rope = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#d9d2b6' })); j.rope.frustumCulled = false; scene.add(j.rope);
    }
    rides.jetskis.push(j); return j;
  }
  // Moored along both sides of the jetty.
  [[94.5, -50.9, Math.PI / 2 + 0.06, 0], [99.5, -50.9, Math.PI / 2 - 0.05, 1], [95.5, -45.1, Math.PI / 2 - 0.05, 2], [100.5, -45.1, Math.PI / 2 + 0.05, 3]]
    .forEach(([x, z, yaw, c]) => newJet(x, z, yaw, c, { x: x, z: z, bollard: { x: x + 0.6, z: z + (z < JETTY.z ? 1.05 : -1.05), y: JETTY.y + 0.25 } }));
  // Extra jet skis on other stretches of coast where open water exists.
  for (const z of [-790, 440]) {
    for (let x = 90; x < 220; x += 2) {
      let deep = true; for (let dx = 0; dx <= 14 && deep; dx += 3) for (let dz = -6; dz <= 6; dz += 6) if (height(x + dx, z + dz) > -1.05) deep = false;
      if (deep) { const j = newJet(x + 6, z, Math.PI / 2, z < 0 ? 4 : 5, { x: x + 6, z, bollard: null }); break; }
    }
  }

  // Floating things: swim-lane buoys joined by a rope, beach balls and a lilo.
  const floaterLines = [];
  {
    const buoyMat = [new THREE.MeshStandardMaterial({ color: '#e0562d', roughness: 0.5 }), new THREE.MeshStandardMaterial({ color: '#f2ecda', roughness: 0.5 })];
    const lane = [];
    for (let i = 0; i < 9; i++) {
      const bx = 128, bz = -92 + i * 11.5;
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10), buoyMat[i % 2]); m.castShadow = true; scene.add(m);
      const fl = ocean.addFloater({ mesh: m, x: bx, z: bz, radius: 0.5, lift: 0.1, anchor: { x: bx, z: bz, slack: 2.2 }, tether: 0.7, drift: 0.02, drag: 1.4, tilt: 0.3, minX: 100 });
      lane.push(fl);
    }
    const ropeGeo = new THREE.BufferGeometry(); ropeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 9 * 6), 3));
    const rope = new THREE.LineSegments(ropeGeo, new THREE.LineBasicMaterial({ color: '#d9d2b6' })); rope.frustumCulled = false; scene.add(rope);
    floaterLines.push({ lane, rope });
    const ballTex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d'); const cols = ['#e0562d', '#f2ecda', '#2f93a2', '#f2c14e', '#e0562d', '#f2ecda']; cols.forEach((col, i) => { x.fillStyle = col; x.fillRect(i * 128 / 6, 0, 128 / 6 + 1, 64) }); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t })();
    for (const [x, z] of [[108, -22], [112, -66], [118, -38]]) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.45 })); m.castShadow = true; scene.add(m);
      ocean.addFloater({ mesh: m, x, z, radius: 0.4, lift: 0.22, drift: 0.12, drag: 0.55, tilt: 0.1, bobSpin: 0.4, minX: 94 });
    }
    const lilo = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.16, 1.8, 1, 1, 1), new THREE.MeshStandardMaterial({ color: '#33b7c0', roughness: 0.4 })); lilo.castShadow = true; scene.add(lilo);
    ocean.addFloater({ mesh: lilo, x: 106, z: -76, radius: 0.9, lift: 0.12, drift: 0.08, drag: 0.7, tilt: 0.8, bobSpin: 0.12, minX: 96 });
  }
  function updateFloaterLines() {
    for (const { lane, rope } of floaterLines) {
      const a = rope.geometry.attributes.position.array; let k = 0;
      for (let i = 0; i < lane.length - 1; i++) {
        const p = lane[i], q = lane[i + 1];
        for (let s = 0; s < 3; s++) {
          const t0 = s / 3, t1 = (s + 1) / 3, sag = t => -Math.sin(t * Math.PI) * 0.12;
          a[k++] = p.x + (q.x - p.x) * t0; a[k++] = ocean.height(p.x + (q.x - p.x) * t0, p.z + (q.z - p.z) * t0) + 0.08 + sag(t0); a[k++] = p.z + (q.z - p.z) * t0;
          a[k++] = p.x + (q.x - p.x) * t1; a[k++] = ocean.height(p.x + (q.x - p.x) * t1, p.z + (q.z - p.z) * t1) + 0.08 + sag(t1); a[k++] = p.z + (q.z - p.z) * t1;
        }
      }
      rope.geometry.attributes.position.needsUpdate = true; rope.geometry.setDrawRange(0, k / 3);
    }
  }

  // ----------------------------------------------------------------- Audio ----
  const sfx = { engine: null, scooter: null };
  function ensureAudio(audio) {
    if (!audio || sfx.ctx === audio.ctx) return;
    const c = audio.ctx, master = audio.master;
    const mk = (type, freq, gain, cutoff) => { const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(); o.type = type; o.frequency.value = freq; f.type = 'lowpass'; f.frequency.value = cutoff; g.gain.value = 0; o.connect(f).connect(g).connect(master); o.start(); return { o, g, f, base: gain }; };
    sfx.ctx = c; sfx.master = master; sfx.noise = audio.noiseBuffer;
    sfx.jet = mk('sawtooth', 70, 0.1, 500); sfx.jet2 = mk('square', 35, 0.06, 300);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = audio.noiseBuffer; s.loop = true; f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.4; g.gain.value = 0; s.connect(f).connect(g).connect(master); s.start();
    sfx.hiss = { g, f };
    sfx.scooter = mk('sawtooth', 380, 0.03, 1600);
    sfx.rider = true;
  }
  function audioUpdate(audio, dt) {
    if (!audio) return; ensureAudio(audio);
    const t = sfx.ctx.currentTime, set = (p, v) => p.setTargetAtTime(v, t, 0.07), a = rides.active;
    let jetSpeed = 0, jetThr = 0, wet = 0, scooterV = 0;
    if (a?.kind === 'jetski') { jetSpeed = Math.abs(a.speed); jetThr = Math.abs(a.thr); wet = a.contact ? 1 : 0.2; }
    // Nearby unridden skis idle quietly.
    set(sfx.jet.o.frequency, 52 + jetSpeed * 3.2 + jetThr * 45); set(sfx.jet.g.gain, a?.kind === 'jetski' ? 0.05 + jetThr * 0.11 : 0);
    set(sfx.jet.f.frequency, 380 + jetThr * 1300 + jetSpeed * 20);
    set(sfx.jet2.o.frequency, 26 + jetSpeed * 1.5 + jetThr * 20); set(sfx.jet2.g.gain, a?.kind === 'jetski' ? 0.05 + jetThr * 0.08 : 0);
    set(sfx.hiss.g.gain, a?.kind === 'jetski' ? Math.min(0.2, jetSpeed * 0.009) * wet : 0); set(sfx.hiss.f.frequency, 900 + jetSpeed * 55);
    if (a?.kind === 'scooter') scooterV = Math.abs(a.speed);
    set(sfx.scooter.o.frequency, 260 + scooterV * 42); set(sfx.scooter.g.gain, a?.kind === 'scooter' ? Math.min(0.045, 0.006 + scooterV * 0.0045) : 0);
  }
  function bangSfx(audio, kind) {
    if (!audio) return; ensureAudio(audio);
    const c = audio.ctx, t = c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = audio.noiseBuffer; f.type = 'lowpass'; f.frequency.value = kind === 'splash' ? 1800 : 700; g.gain.setValueAtTime(kind === 'splash' ? 0.35 : 0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'splash' ? 0.6 : 0.25));
    s.connect(f).connect(g).connect(audio.master); s.start(t); s.stop(t + 0.7);
  }
  rides.bangSfx = bangSfx;

  // ------------------------------------------------------------ Simulation ----
  const tmpV = new THREE.Vector3();
  function jetFrame(j) { return { fx: Math.sin(j.yaw), fz: Math.cos(j.yaw), rx: Math.cos(j.yaw), rz: -Math.sin(j.yaw) }; }
  function sampleSea(j, lx, lz) {
    const { fx, fz, rx, rz } = jetFrame(j); return ocean.height(j.x + rx * lx + fx * lz, j.z + rz * lx + fz * lz);
  }
  function stepJet(j, dt, inp, time, audio) {
    const { fx, fz, rx, rz } = jetFrame(j);
    const hB = sampleSea(j, 0, 1.3), hS = sampleSea(j, 0, -1.2), hL = sampleSea(j, 0.5, 0), hR = sampleSea(j, -0.5, 0), hC = ocean.height(j.x, j.z);
    const surf = (hB + hS + hL + hR + hC * 2) / 6;
    let vf = j.vx * fx + j.vz * fz, vr = j.vx * rx + j.vz * rz;
    const ground = Math.max(groundY(j.x, j.z), groundY(j.x + fx * 1.2, j.z + fz * 1.2) - 0.1, groundY(j.x - fx * 1.0, j.z - fz * 1.0) - 0.1);
    const keel = j.y - 0.12, depth = surf - keel;
    const wasContact = j.contact;
    j.contact = depth > -0.02;
    const planing = clamp(vf / 15, 0, 1);
    j.grounded = keel <= ground + 0.02;
    // Throttle & thrust.
    j.thr += (inp.throttle - j.thr) * Math.min(1, dt * 3.2);
    const wf = j.grounded ? 0.15 : j.contact ? 1 : 0.12;
    const vmax = inp.boost ? 31 : 24;
    let thrust = 0;
    if (j.thr > 0.02) thrust = vf < vmax ? 9.4 * j.thr * (inp.boost ? 1.45 : 1) * (1 - 0.35 * smooth(vf, 16, vmax)) : 0;
    else if (j.thr < -0.02) thrust = vf > 0.4 ? -8.5 * -j.thr : -3.8 * -j.thr * (vf > -4 ? 1 : 0);
    const drag = (0.1 * vf + 0.0165 * vf * Math.abs(vf)) * (j.contact ? 1 : 0.15);
    vf += (thrust * wf - drag) * dt;
    vr *= Math.exp(-dt * (j.contact ? 3.4 : 0.1) * (j.grounded ? 3 : 1));
    // Steering needs thrust to bite; the hull carves while planing.
    const authority = clamp(0.28 + Math.abs(j.thr) * 0.72, 0, 1) * Math.min(1, (Math.abs(vf) + 2.6) / 6) / (1 + Math.abs(vf) / 20);
    const yawTarget = inp.steer * 1.85 * authority * (vf < -0.5 ? -1 : 1) * (j.contact && !j.grounded ? 1 : 0.1);
    j.wy += (yawTarget - j.wy) * Math.min(1, dt * 4.5);
    j.yaw += j.wy * dt;
    // Wave slope and mooring.
    const gx = (hL - hR) * 0 , grad = ocean.seaGradient(j.x, j.z, time, [0, 0]);
    let ax = 0, az = 0;
    if (j.contact && !j.grounded) { ax = -grad[0] * G * 0.28; az = -grad[1] * G * 0.28; }
    if (j.mooring && !j.ridden) {
      const dx = j.mooring.x - j.x, dz = j.mooring.z - j.z, d = Math.hypot(dx, dz);
      if (d > 0.25) { ax += dx * 3.2; az += dz * 3.2; }
      j.yaw += Math.atan2(Math.sin(j.home.yaw - j.yaw), Math.cos(j.home.yaw - j.yaw)) * dt * 1.2;
      vf *= Math.exp(-dt * 1.2);
    }
    // Rebuild world velocity.
    const fx2 = Math.sin(j.yaw), fz2 = Math.cos(j.yaw), rx2 = Math.cos(j.yaw), rz2 = -Math.sin(j.yaw);
    j.vx = fx2 * vf + rx2 * vr + ax * dt; j.vz = fz2 * vf + rz2 * vr + az * dt;
    // Grounding on sand: scrub speed.
    if (j.grounded) {
      const dry = ground > ocean.level + 0.35 ? 2.2 : 1;
      const k = Math.exp(-dt * 2.8 * dry); j.vx *= k; j.vz *= k;
    }
    let nx = j.x + j.vx * dt, nz = j.z + j.vz * dt;
    // Jetty and land obstructions.
    if (nx > JETTY.x0 - 0.8 && nx < JETTY.x1 + 0.8 && Math.abs(nz - JETTY.z) < JETTY.half + 0.75 && j.y < JETTY.y + 0.3) {
      const dz = nz - JETTY.z, side = Math.sign(dz) || 1;
      if (rides.active === j && Math.hypot(j.vx, j.vz) > 10) rides.crash = { kind: 'jetski', speed: Math.hypot(j.vx, j.vz), vx: j.vx, vz: j.vz };
      nz = JETTY.z + side * (JETTY.half + 0.75); if (Math.abs(vr) > 1) bangSfx(audio, 'bump'); j.vz = Math.abs(j.vz) * 0.2 * side; vf *= 0.6;
    }
    if (ground > ocean.level + 0.35 && blocked(nx, nz, 1.0)) { if (rides.active === j && Math.hypot(j.vx, j.vz) > 8) rides.crash = { kind: 'jetski', speed: Math.hypot(j.vx, j.vz), vx: j.vx, vz: j.vz }; nx = j.x; nz = j.z; j.vx = j.vz = 0; vf = 0; }
    j.x = clamp(nx, 40, 2380); j.z = clamp(nz, -1700, 1700);
    // Vertical dynamics: buoyancy, planing lift, free flight.
    const depth2 = surf - (j.y - 0.12);
    if (depth2 > -0.02) {
      j.vy += (-G * (1 - 0.5 * planing) + clamp(depth2, 0, 1.3) * 44 - j.vy * 5.2) * dt;
    } else j.vy -= G * dt;
    j.y += j.vy * dt;
    if (j.y - 0.12 < ground + 0.02) { j.y = ground + 0.14; if (j.vy < 0) j.vy = 0; }
    // Landing splash & wave-crest take-off spray.
    if (!wasContact && j.contact && j.vy < -2.2) {
      const power = clamp(-j.vy / 3.2, 0.6, 3); ocean.splash(j.x, j.z, power * 1.4, j.vx, j.vz); bangSfx(audio, 'splash'); j.vy *= 0.35;
      if (rides.active === j && -j.vy > 0) toast(power > 1.8 ? 'Huge air. Tidy landing.' : 'Nice landing.');
    }
    j.airborne = j.contact ? 0 : j.airborne + dt;
    // Attitude from the surface under the hull, trimmed by speed and steering.
    const speed = Math.hypot(j.vx, j.vz);
    j.speed = vf; j.groundSpeed = speed;
    const pitchWave = Math.atan2(hB - hS, 2.5), rollWave = Math.atan2(hL - hR, 1.0);
    const pitchTarget = j.contact ? pitchWave * 0.9 + 0.06 * planing + 0.05 * Math.max(0, j.thr) - 0.06 * Math.max(0, -j.thr) : -Math.atan2(j.vy, Math.max(vf, 4)) * 0.7;
    const rollTarget = clamp((j.contact ? rollWave * 0.12 : j.roll * 0.98) - inp.steer * clamp(Math.abs(vf) / 18, 0, 1) * 0.07 * Math.sign(vf || 1), -0.09, 0.09);
    j.pitch += (pitchTarget - j.pitch) * Math.min(1, dt * (j.contact ? 7 : 1.8));
    j.roll += (rollTarget - j.roll) * Math.min(1, dt * (j.contact ? 6 : 1.6));
    j.steer += (inp.steer - j.steer) * Math.min(1, dt * 8);
    if (j.grounded && ground > ocean.level) {
      const gF = groundY(j.x + fx2 * 1.2, j.z + fz2 * 1.2), gB = groundY(j.x - fx2 * 1.0, j.z - fz2 * 1.0);
      j.pitch += (Math.atan2(gF - gB, 2.2) - j.pitch) * Math.min(1, dt * 5);
    }
    // Effects.
    const sternX = j.x - fx2 * 1.5, sternZ = j.z - fz2 * 1.5, bowX = j.x + fx2 * 1.4, bowZ = j.z + fz2 * 1.4;
    if (j.contact && !j.grounded && Math.abs(vf) > 0.6) {
      ocean.wake(sternX, sternZ, j.vx, j.vz, 0.9 + Math.min(vf, 20) * 0.03, 1);
      ocean.ripples.disturb(bowX, bowZ, 1.0, 0.035 * clamp(vf / 10, 0, 1.5));
      ocean.ripples.disturb(j.x + rx2 * 0.55, j.z + rz2 * 0.55, 0.7, -0.025 * clamp(vf / 10, 0, 1)); ocean.ripples.disturb(j.x - rx2 * 0.55, j.z - rz2 * 0.55, 0.7, -0.025 * clamp(vf / 10, 0, 1));
      ocean.push(j.x, j.z, j.vx, j.vz, 1.1);
    }
    j.sprayAcc = (j.sprayAcc ?? 0);
    if (j.contact && Math.abs(j.thr) > 0.1 && vf > 1.5 && !j.grounded) {
      j.sprayAcc += dt * (14 + vf * 2.4) * Math.abs(j.thr);
      while (j.sprayAcc >= 1) {
        j.sprayAcc -= 1;
        const back = 1.2 + Math.random() * 2.5 + vf * 0.12, lift = 3.2 + Math.random() * 2.4 + vf * 0.11;
        ocean.spray.emit(sternX + (Math.random() - 0.5) * 0.4, j.y + 0.3, sternZ + (Math.random() - 0.5) * 0.4, -fx2 * back + (Math.random() - 0.5) * 1.4 + j.vx * 0.55, lift, -fz2 * back + (Math.random() - 0.5) * 1.4 + j.vz * 0.55, 0.7 + Math.random() * 0.5, 0.22, 0.65 + Math.random() * 0.3, 0.82);
      }
    }
    if (j.contact && vf > 5 && !j.grounded && Math.abs(j.wy) > 0.3 || (j.contact && vf > 9)) {
      const side = j.wy > 0 ? 1 : -1;
      if (Math.random() < dt * (6 + vf * 0.8)) for (const sd of Math.abs(j.wy) > 0.3 ? [side] : [-1, 1])
        ocean.spray.emit(bowX + rx2 * 0.4 * sd, j.y + 0.2, bowZ + rz2 * 0.4 * sd, rx2 * sd * (2.5 + Math.random() * 2) + j.vx * 0.3, 1.4 + Math.random() * 1.8, rz2 * sd * (2.5 + Math.random() * 2) + j.vz * 0.3, 0.55 + Math.random() * 0.4, 0.16, 0.5, 0.75);
    }
    if (j.grounded && ground > ocean.level && speed > 2 && Math.random() < dt * 14) onGround(j.x, j.z);
    // Visual transform.
    E.set(-j.pitch, j.yaw, j.roll, 'YXZ'); j.model.quaternion.setFromEuler(E);
    j.model.position.set(j.x, j.y, j.z);
    j.model.userData.bars.rotation.y = j.steer * 0.42;
    if (j.rope) updateRope(j);
  }
  function updateRope(j) {
    const a = j.rope.geometry.attributes.position.array, mo = j.mooring?.bollard;
    if (!mo || j.ridden) { j.rope.visible = false; return; }
    j.rope.visible = true;
    const bow = tmpV.set(0, 0.5, 1.35).applyQuaternion(j.model.quaternion).add(j.model.position);
    for (let i = 0; i < 8; i++) { const t = i / 7; a[i * 3] = bow.x + (mo.x - bow.x) * t; a[i * 3 + 1] = bow.y + (mo.y - bow.y) * t - Math.sin(t * Math.PI) * 0.18; a[i * 3 + 2] = bow.z + (mo.z - bow.z) * t; }
    j.rope.geometry.attributes.position.needsUpdate = true;
  }

  const SURF_SPEED = { asphalt: 8.4, gravel: 6.4, grass: 6.6, dirt: 6.4, sand: 4.4 };
  function stepScooter(sc, dt, inp, audio) {
    const jetty = platformAt(sc.x, sc.z) != null;
    const surface = jetty ? 'asphalt' : surfaceAt(sc.x, sc.z), vmax = (SURF_SPEED[surface] ?? 6) * (inp.boost ? 1.25 : 1);
    // --- Tricks: hold W+S to load, let go of S to pop a wheelie; double-tap Space for a tail whip.
    const both = !!(inp.fwd && inp.back), grounded = sc.hop <= 0.04;
    if (sc.prevBoth && !both && inp.fwd && grounded && (sc.charge ?? 0) > 0.25 && sc.wheelieT <= 0) {
      sc.wheelieT = 4.2; sc.speed = Math.max(sc.speed, 0) + 1.2 + sc.charge * 2.2; if (rides.active === sc) toast('Wheelie. Hold W to hold it.');
    }
    sc.prevBoth = both;
    sc.charge = both ? Math.min(1, (sc.charge ?? 0) + dt * 2.2) : Math.max(0, (sc.charge ?? 0) - dt * 4);
    if (sc.wheelieT > 0) {
      if (!inp.fwd || inp.back || !grounded) sc.wheelieT = 0; else sc.wheelieT -= dt;
    }
    const wheelieTarget = sc.wheelieT > 0 ? 0.6 + Math.sin(state.time * 5) * 0.04 : 0;
    sc.wheelie = damp(sc.wheelie ?? 0, wheelieTarget, sc.wheelieT > 0 ? 6 : 4, dt);
    sc.sinceTap = (sc.sinceTap ?? 9) + dt;
    for (let i = 0; i < (inp.jumpPress ?? 0); i++) {
      if (sc.hop <= 0.01 && sc.vy === 0) { sc.vy = 3.4; sc.sinceTap = 0; }
      else if (sc.hop > 0.02 && sc.sinceTap < 0.55 && !(sc.whipT > 0)) { sc.whipT = 0.0001; sc.vy = Math.max(sc.vy, 0) + 2.1; if (rides.active === sc) toast('Tail whip.'); }
      else sc.sinceTap = 0;
    }
    if (sc.whipT > 0) {
      sc.whipT += dt; const k = clamp(sc.whipT / 0.62, 0, 1);
      sc.whipAng = (k * k * (3 - 2 * k)) * Math.PI * 2;
      if (k >= 1) { sc.whipT = 0; sc.whipAng = 0; }
    }
    const throttle = both ? 0 : inp.throttle;
    let a = 0;
    if (throttle > 0) a = (sc.speed < vmax ? 4.8 * (1 - Math.max(0, sc.speed) / vmax * 0.8) : -3);
    else if (throttle < 0) a = sc.speed > 0.3 ? -9 : -2.6 * (sc.speed > -1.8 ? 1 : 0);
    else a = -sc.speed * 0.35 - Math.sign(sc.speed) * 0.25;
    if (surface === 'sand') a -= sc.speed * 0.7; else if (surface === 'grass') a -= sc.speed * 0.2;
    if ((inp.brake || both) && sc.speed > 0) a -= 8;
    sc.speed += a * dt; if (Math.abs(sc.speed) < 0.04 && throttle === 0) sc.speed = 0;
    sc.steer += (inp.steer - sc.steer) * Math.min(1, dt * 9);
    const turn = sc.steer * (sc.wheelieT > 0 ? 0.65 : 1) * clamp(3.4 / (0.75 + Math.abs(sc.speed) * 0.5), 0.6, 3.6) * clamp(Math.abs(sc.speed) / 1.2, 0, 1);
    sc.yaw += turn * dt * Math.sign(sc.speed || 1);
    let nx = sc.x + Math.sin(sc.yaw) * sc.speed * dt, nz = sc.z + Math.cos(sc.yaw) * sc.speed * dt;
    // Water & scenery obstruction: slide along obstacles, bleed speed on impact.
    const waterAt = (x, z) => !platformAt(x, z) && height(x, z) < -0.55;
    let hit = false;
    if (blocked(nx, sc.z, 0.5) || waterAt(nx, sc.z)) { nx = sc.x; hit = true; }
    if (blocked(nx, nz, 0.5) || waterAt(nx, nz)) { nz = sc.z; hit = true; }
    if (hit && Math.abs(sc.speed) > 7.5 && rides.active === sc) { bangSfx(audio, 'bump'); impact?.(); rides.crash = { kind: 'scooter', speed: Math.abs(sc.speed), vx: Math.sin(sc.yaw) * sc.speed, vz: Math.cos(sc.yaw) * sc.speed }; }
    else if (hit && Math.abs(sc.speed) > 1) { if (Math.abs(sc.speed) > 4.5 && rides.active === sc) { bangSfx(audio, 'bump'); impact?.(); toast('Whoa. Mind the fence.'); } sc.speed *= 0.25; }
    sc.x = nx; sc.z = nz;
    for (const n of npcs) {
      if (n.down > 0) continue; const dx = n.root.position.x - sc.x, dz = n.root.position.z - sc.z;
      if (dx * dx + dz * dz < 1.1 && Math.abs(sc.speed) > 3.2 && rides.active === sc) {
        n.hitV = { x: Math.sin(sc.yaw) * sc.speed * 1.2, y: 2.4, z: Math.cos(sc.yaw) * sc.speed * 1.2 }; n.down = 6; n.health = 0; n.aggro = false; sc.speed *= 0.4; impact?.(); bangSfx(audio, 'bump'); toast('Cleaned up a local. Keep it to the footpath.');
      }
    }
    const fy = groundY(sc.x + Math.sin(sc.yaw) * 0.5, sc.z + Math.cos(sc.yaw) * 0.5), ry = groundY(sc.x - Math.sin(sc.yaw) * 0.45, sc.z - Math.cos(sc.yaw) * 0.45);
    const terrain = (fy + ry) / 2;
    sc.vy -= G * dt; sc.hop += sc.vy * dt; if (sc.hop < 0) { sc.hop = 0; sc.vy = 0; }
    sc.y = terrain + sc.hop; sc.pitch = damp(sc.pitch ?? 0, Math.atan2(fy - ry, 0.95) - sc.vy * 0.04, 12, dt);
    sc.roll = damp(sc.roll ?? 0, -sc.steer * clamp(Math.abs(sc.speed) / 6, 0, 1) * 0.025, 8, dt);
    sc.tuck = damp(sc.tuck ?? 0, sc.hop > 0.03 ? 1 : 0, 10, dt);
    // Body orientation without the wheelie, then pitched about the rear axle so the back wheel stays planted.
    E.set(-sc.pitch, sc.yaw, sc.roll, 'YXZ'); Q0.setFromEuler(E);
    E.set(-(sc.pitch + sc.wheelie), sc.yaw, sc.roll, 'YXZ'); Q1.setFromEuler(E);
    pv0.copy(REAR_PIVOT).applyQuaternion(Q0); pv1.copy(REAR_PIVOT).applyQuaternion(Q1);
    riddenGroup.quaternion.copy(Q1); riddenGroup.position.set(sc.x + pv0.x - pv1.x, sc.y + pv0.y - pv1.y, sc.z + pv0.z - pv1.z);
    E.set(-(sc.pitch + sc.wheelie), sc.yaw, 0, 'YXZ'); riderQuat.setFromEuler(E);
    deckSpin.rotation.y = sc.whipAng ?? 0;
    riddenSteer = sc.steer * 0.45; steerTurn.rotation.y = riddenSteer;
  }

  // ---------------------------------------------------------- Mount / rider ----
  function nearest(px, pz, maxScooter = 2.6, maxJet = 3.6) {
    let best = null, bd = Infinity;
    for (const sc of rides.scooters) { if (sc.ridden) continue; const d = Math.hypot(sc.x - px, sc.z - pz); if (d < maxScooter && d < bd) { bd = d; best = sc; } }
    for (const j of rides.jetskis) { if (j.ridden) continue; const d = Math.hypot(j.x - px, j.z - pz); if (d < maxJet && d < bd) { bd = d; best = j; } }
    return best ? { obj: best, dist: bd } : null;
  }
  function mount(obj) {
    obj.ridden = true; rides.active = obj; rides.mount = { t: 0, from: new THREE.Vector3(state.walkX, state.walkY, state.walkZ), fromYaw: person.rotation.y };
    state.swimming = false; state.walkVX = state.walkVZ = 0; person.visible = true;
    if (obj.kind === 'scooter') { riddenGroup.visible = true; obj.speed = 0; obj.hop = 0; obj.vy = 0; obj.steer = 0; obj.roll = 0; obj.pitch = obj.pitch ?? 0; obj.charge = 0; obj.wheelie = 0; obj.wheelieT = 0; obj.whipT = 0; obj.whipAng = 0; obj.sinceTap = 9; obj.tuck = 0; deckSpin.rotation.y = 0; const c = new THREE.Color(obj.colour); riddenMat.frame.color.copy(c); writeScooter(obj); }
    else { obj.mooring = obj.mooring ? { ...obj.mooring } : null; obj.thr = 0; if (obj.rope) obj.rope.visible = false; ocean.splash(obj.x, obj.z, 0.8, 0, 0); }
    rides.camYaw = 0; state.orbit = obj.yaw;
  }
  function dismount(opts = {}) {
    const obj = rides.active; if (!obj) return;
    const side = obj.kind === 'scooter' ? 1.0 : 1.35, sx = Math.cos(obj.yaw) * side, sz = -Math.sin(obj.yaw) * side;
    let wx = obj.x + sx, wz = obj.z + sz;
    if (obj.kind === 'scooter') {
      if (blocked(wx, wz, 0.4)) { wx = obj.x - sx; wz = obj.z - sz; }
      obj.ridden = false; obj.speed = 0; obj.parkedLean = 0.16; riddenGroup.visible = false; writeScooter(obj);
    } else {
      obj.ridden = false; if (obj.mooring) { obj.home = { x: obj.x, z: obj.z, yaw: obj.yaw }; }
      if (platformAt(wx, wz) == null && blocked(wx, wz, 0.4)) { wx = obj.x - sx; wz = obj.z - sz; }
    }
    state.walkX = wx; state.walkZ = wz; state.walkY = (platformAt(wx, wz) ?? Math.max(height(wx, wz), ocean.height(wx, wz) - 0.95)) + 0.13; state.walkVX = state.walkVZ = 0; state.walkVY = 0;
    person.quaternion.identity(); person.rotation.set(0, obj.yaw, 0); person.position.set(wx, state.walkY, wz); state.orbit = obj.yaw;
    rides.active = null; rides.mount = null; if (obj.kind === 'jetski') { obj.idleTime = 0; ocean.splash(wx, wz, 0.5, 0, 0); }
    if (!opts.silent) toast(obj.kind === 'scooter' ? 'Parked the scooter. Kickstand down.' : 'Off the jet ski. She will drift if you leave her.');
  }

  const RIDER = { scooter: new THREE.Vector3(0, 0.205, -0.08), jetski: null };
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  function poseRider(dt, inp) {
    const a = rides.active; if (!a) return;
    let basePos, quat, lean = 0;
    if (a.kind === 'scooter') { quat = riddenGroup.quaternion; basePos = tmpA.copy(RIDER.scooter).applyQuaternion(quat).add(riddenGroup.position); }
    else { const seat = a.model.userData.seat; quat = a.model.quaternion; basePos = tmpA.set(seat.x, seat.y - 0.82, seat.z - 0.04).applyQuaternion(quat).add(a.model.position); }
    // Mount: ease from the bank or water onto the machine.
    let k = 1; if (rides.mount) { rides.mount.t += dt; k = smooth(rides.mount.t, 0, a.kind === 'jetski' ? 0.75 : 0.35); if (rides.mount.t > (a.kind === 'jetski' ? 0.85 : 0.4)) rides.mount = null; }
    const from = rides.mount?.from;
    if (rides.mount && from) { basePos = tmpB.copy(from).lerp(basePos, k); basePos.y += Math.sin(k * Math.PI) * 0.45; }
    person.position.copy(basePos); person.quaternion.copy(quat);
    // Make sure an idle base pose is under the procedural limbs.
    character.update(dt, 0, a.yaw);
    person.quaternion.copy(quat);
    const rot = new THREE.Euler(0, a.kind === 'jetski' ? a.model.userData.bars.rotation.y : 0, 0);
    const grips = a.kind === 'jetski' ? a.model.userData.grips.map(v => v.clone().applyEuler(rot).add(a.model.userData.pivot)) : null;
    let gl, gr;
    if (a.kind === 'scooter') {
      const m = frontMatrix().multiply(new THREE.Matrix4().makeRotationY(riddenSteer));
      gl = new THREE.Vector3(0.28, 0.88, 0).applyMatrix4(m); gr = new THREE.Vector3(-0.28, 0.88, 0).applyMatrix4(m);
      gl.sub(RIDER.scooter); gr.sub(RIDER.scooter);
      poseTradie(character.model, person, 'scooter', { lean: a.speed, steer: a.steer, speed: a.speed, gl, gr, tuck: a.tuck ?? 0, wheelie: a.wheelie ?? 0, whip: a.whipT > 0 ? clamp(a.whipT / 0.62, 0, 1) : 0 });
    } else {
      const seat = a.model.userData.seat, p = new THREE.Vector3(seat.x, seat.y - 0.82, seat.z - 0.04);
      gl = grips[1].clone().sub(p); gr = grips[0].clone().sub(p);
      poseTradie(character.model, person, 'jetski', { lean: clamp(a.speed / 22, 0, 1), steer: a.steer, thr: a.thr, gl, gr, t: state.time });
    }
  }

  // ----------------------------------------------------------------- Update ----
  let engineT = 0;
  rides.update = (dt, input, audio) => {
    if (dt <= 0) return;
    const t = state.time, activeJet = rides.active?.kind === 'jetski' ? rides.active : null;
    const px = state.walkX, pz = state.walkZ;
    // Simulate jet skis near the player (all ridden/moored/drifting ones within range).
    for (const j of rides.jetskis) {
      if (Math.hypot(j.x - px, j.z - pz) > 420 && !j.ridden) {
        // Far away: tow quietly back to the hire jetty after a while so nothing is lost.
        if (j.home && Math.hypot(j.x - j.home.x, j.z - j.home.z) > 6) { j.x = j.home.x; j.z = j.home.z; j.yaw = j.home.yaw; j.vx = j.vz = j.vy = 0; j.model.position.set(j.x, ocean.height(j.x, j.z) - 0.12, j.z); j.y = j.model.position.y; if (j.mooring) j.mooring = { ...j.mooring, x: j.home.x, z: j.home.z }; }
        continue;
      }
      const inp = j === rides.active ? input : { throttle: 0, steer: 0, boost: false };
      const sub = dt > 0.025 ? 2 : 1; for (let i = 0; i < sub; i++) stepJet(j, dt / sub, inp, t, audio);
      if (!j.ridden && j.home && !j.mooring.bollard && false) j.idleTime += dt;
    }
    if (rides.active?.kind === 'scooter' && !rides.mount) stepScooter(rides.active, dt, input, audio);
    else if (rides.active?.kind === 'scooter') { const sc = rides.active; riddenGroup.position.set(sc.x, groundY(sc.x, sc.z), sc.z); }
    if (rides.active) {
      const a = rides.active;
      poseRider(dt, input);
      state.walkX = a.x; state.walkZ = a.z; state.walkY = a.kind === 'jetski' ? a.y : a.y; state.swimming = false; state.walkVX = state.walkVZ = 0;
      // Camera yaw eases behind the machine; dragging offsets it temporarily.
      rides.camYaw = damp(rides.camYaw, 0, 1.4, dt);
      const target = a.yaw + rides.camYaw, diff = Math.atan2(Math.sin(target - state.orbit), Math.cos(target - state.orbit));
      state.orbit += diff * (1 - Math.exp(-dt * (a.kind === 'jetski' ? 2.8 : 3.4)));
      a.hudSpeed = Math.abs(a.kind === 'jetski' ? a.speed : a.speed);
    }
    updateFloaterLines();
    audioUpdate(audio, dt);
  };
  rides.platformAt = platformAt;
  rides.nearest = nearest; rides.mountObj = mount; rides.dismount = dismount; rides.setScooterVisible = () => {};
  rides.forceDismount = () => { if (rides.active) dismount({ silent: true }); };
  rides.jetty = JETTY;
  rides.reset = () => {
    rides.forceDismount();
    for (const j of rides.jetskis) if (j.home) { j.x = j.home.x; j.z = j.home.z; j.yaw = j.home.yaw; j.vx = j.vz = j.vy = 0; j.mooring = { ...j.mooring, x: j.home.x, z: j.home.z }; }
  };
  rides.status = () => ({
    scooters: rides.scooters.length, jetskis: rides.jetskis.length,
    active: rides.active ? { kind: rides.active.kind, x: +rides.active.x.toFixed(1), z: +rides.active.z.toFixed(1), y: +rides.active.y.toFixed(2), speed_kmh: +(Math.abs(rides.active.speed) * 3.6).toFixed(1), pitch: +(rides.active.pitch ?? 0).toFixed(2), roll: +(rides.active.roll ?? 0).toFixed(2), airborne: rides.active.airborne ?? 0 } : null
  });
  return rides;
}
