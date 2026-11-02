import * as THREE from 'three';

// Servos (service stations): pump forecourt under a canopy plus a walk-in shop with a proper interior.
// dir = +1 puts the shop east of the coast road (road to the west); dir = -1 mirrors it for the west side.
export const SERVO_SITES = [
  { name: 'OZ FUEL SERVO', x: 26.5, z: 206, dir: 1, brand: '#d63a2f', accent: '#f4c430' },
  { name: 'COASTAL SERVO', x: -26.5, z: -300, dir: -1, brand: '#1f6fa8', accent: '#f4f1e6' },
];

export function createServo({ scene, height, colliders, site }) {
  const { x: frontX, z: cz, dir, brand, accent } = site;
  const H = 3.3, DEPTH = 12, HALF = 7; // shop depth along u, half width along v
  const group = new THREE.Group(); group.name = 'servo'; scene.add(group);
  const roofGroup = new THREE.Group(), walls = { xmin: new THREE.Group(), xmax: new THREE.Group(), zmin: new THREE.Group(), zmax: new THREE.Group() };
  group.add(roofGroup, ...Object.values(walls));
  const wx = u => frontX + dir * u, wz = v => cz + v;
  let base = -Infinity;
  for (let u = -20; u <= DEPTH + 1; u += 2) for (let v = -HALF - 7; v <= HALF + 7; v += 2) base = Math.max(base, height(wx(u), wz(v)));
  const fl = base + 0.07;

  const mats = new Map();
  const mat = (color, o = {}) => { const k = color + JSON.stringify(o); if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o })); return mats.get(k); };
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  // Box by local frame: u range [u0,u1], v range [v0,v1], height from y0 to y1 above floor.
  function P(parent, color, u0, u1, v0, v1, y0, y1, o = {}) {
    const { cast, ...mo } = o;
    const m = new THREE.Mesh(boxGeo, typeof color === 'string' ? mat(color, mo) : color);
    const ux = wx((u0 + u1) / 2), uz = wz((v0 + v1) / 2);
    m.position.set(ux, fl + (y0 + y1) / 2, uz); m.scale.set(Math.abs(u1 - u0), y1 - y0, Math.abs(v1 - v0));
    m.castShadow = cast !== false; m.receiveShadow = true; parent.add(m); return m;
  }
  const solid = (u0, u1, v0, v1, h = 1.2) => {
    const a = wx(u0), b = wx(u1), c = wz(v0), d = wz(v1);
    colliders.push({ x: (a + b) / 2, z: (c + d) / 2, w: Math.abs(a - b) / 2, d: Math.abs(c - d) / 2, h, kind: 'servo' });
  };
  const emissive = (c, i = 1.2) => ({ emissive: c, emissiveIntensity: i, cast: false });

  // ---- Forecourt slab, kerbs and garden strips
  P(group, '#9b9a92', -19, DEPTH + 0.6, -HALF - 7, HALF + 7, -1.2, 0.0, { roughness: 0.95 });
  P(group, '#8d8c85', -19, -0.1, -HALF - 7.4, -HALF - 7, -0.1, 0.18); P(group, '#8d8c85', -19, -0.1, HALF + 7, HALF + 7.4, -0.1, 0.18);
  for (const v of [-9.5, 0, 9.5]) P(group, accent, -17, -13.5, v - 0.08, v + 0.08, 0.002, 0.012, { cast: false });
  P(group, '#5d7b4d', -19, -17.8, -HALF - 6.6, HALF + 6.6, 0, 0.35); // planter along the road
  for (let v = -HALF - 5.5; v <= HALF + 5.5; v += 2.4) P(group, ['#4f6a46', '#6b8657', '#7a9461'][Math.abs(Math.round(v)) % 3], -18.9, -17.9, v - 0.5, v + 0.5, 0.3, 0.75);

  // ---- Pump canopy
  const CU0 = -15, CU1 = -5, CV = 8.6;
  P(roofGroup, '#d8d6cb', CU0, CU1, -CV, CV, 5.0, 5.45);
  P(roofGroup, brand, CU0 - 0.05, CU1 + 0.05, -CV - 0.05, CV + 0.05, 5.45, 5.9);
  P(roofGroup, accent, CU0 - 0.06, CU1 + 0.06, -CV - 0.06, CV + 0.06, 5.2, 5.32, { cast: false });
  for (const u of [CU0 + 0.9, CU1 - 0.9]) for (const v of [-CV + 1.0, CV - 1.0]) {
    P(group, '#d8d6cb', u - 0.22, u + 0.22, v - 0.22, v + 0.22, 0, 5.0); P(group, brand, u - 0.26, u + 0.26, v - 0.26, v + 0.26, 0, 0.9);
    solid(u - 0.3, u + 0.3, v - 0.3, v + 0.3, 5);
  }
  for (let i = 0; i < 6; i++) {
    const u = CU0 + 1.2 + i * 1.5; P(roofGroup, '#fff6dd', u - 0.5, u + 0.5, -2, 2, 4.93, 5.0, emissive('#fff3cf', 1.3));
  }
  const canopyLight = new THREE.PointLight('#fff1cf', 12, 16, 1.6); canopyLight.position.set(wx((CU0 + CU1) / 2), fl + 4.6, wz(0)); group.add(canopyLight);
  const canopyLight2 = new THREE.PointLight('#fff1cf', 7, 12, 1.6); canopyLight2.position.set(wx((CU0 + CU1) / 2), fl + 4.6, wz(6.5)); group.add(canopyLight2);

  // ---- Pump islands
  const pumps = [];
  for (const v of [-3.4, 3.4]) {
    P(group, '#b8b6ab', CU0 + 1.0, CU1 - 1.0, v - 0.55, v + 0.55, 0, 0.22);
    solid(CU0 + 1.0, CU1 - 1.0, v - 0.55, v + 0.55, 0.3);
    for (const u of [-12.2, -7.8]) {
      P(group, brand, u - 0.3, u + 0.3, v - 0.28, v + 0.28, 0.22, 1.5);
      P(group, '#f1efe6', u - 0.31, u + 0.31, v - 0.29, v + 0.29, 1.5, 1.8);
      P(group, '#111418', u - 0.32 * -1, u + 0.0, v - 0.2, v + 0.2, 1.0, 1.42, emissive('#7fe0a0', 0.5)); // price display
      P(group, '#2a2a2c', u - 0.12, u + 0.12, v + (v < 0 ? 0.28 : -0.28), v + (v < 0 ? 0.36 : -0.36), 0.55, 1.2); // hose
      P(group, accent, u - 0.3, u + 0.3, v - 0.285, v + 0.285, 1.42, 1.5, { cast: false });
      solid(u - 0.35, u + 0.35, v - 0.35, v + 0.35, 1.8);
      pumps.push({ u, v });
    }
  }

  // ---- Price sign pole
  const sc = document.createElement('canvas'); sc.width = 256; sc.height = 384; { const c = sc.getContext('2d');
    c.fillStyle = brand; c.fillRect(0, 0, 256, 384); c.fillStyle = accent; c.fillRect(0, 0, 256, 18); c.fillRect(0, 366, 256, 18);
    c.fillStyle = '#fff'; c.font = 'bold 40px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    const words = site.name.split(' '); c.fillText(words[0], 128, 62); c.font = 'bold 34px sans-serif'; c.fillText(words.slice(1).join(' '), 128, 108);
    c.fillStyle = '#10161a'; c.fillRect(20, 140, 216, 210); c.font = 'bold 30px monospace'; c.textAlign = 'left';
    [['ULP', '189.9', '#7fe0a0'], ['E10', '183.9', '#7fe0a0'], ['PUL', '203.9', '#f4c430'], ['DSL', '199.9', '#f4f1e6']].forEach(([a, b, col], i) => { c.fillStyle = col; c.fillText(a, 34, 175 + i * 50); c.fillText(b, 118, 175 + i * 50); });
  }
  const signTex = new THREE.CanvasTexture(sc); signTex.colorSpace = THREE.SRGBColorSpace;
  P(group, '#3b3d3f', -17.3, -17.0, -HALF - 5.2, -HALF - 4.9, 0, 7.6);
  const signMat = new THREE.MeshStandardMaterial({ map: signTex, emissiveMap: signTex, emissive: '#ffffff', emissiveIntensity: 0.6, roughness: 0.6 });
  const signBox = new THREE.Mesh(boxGeo, signMat); signBox.position.set(wx(-17.15), fl + 6.2, wz(-HALF - 5.05)); signBox.scale.set(0.3, 3.0, 2.0); group.add(signBox);
  // Sign faces road: texture is on the +/-x faces of the box.
  solid(-17.5, -16.8, -HALF - 5.4, -HALF - 4.7, 7);

  // ---- Shop shell
  const WALL = '#e6e1d2', TRIM = '#f4f1e6', INNER = '#efebdd';
  const glassMat = new THREE.MeshStandardMaterial({ color: '#a8d0da', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false });
  const T = 0.22;
  // Wall along u (axis 'u', at fixed v) or along v (axis 'v', at fixed u).
  function wall(parent, axis, fixed, a0, a1, openings, { color = WALL } = {}) {
    const put = (s0, s1, y0, y1) => { if (s1 - s0 < 0.01) return; if (axis === 'v') P(parent, color, fixed - T / 2, fixed + T / 2, s0, s1, y0, y1); else P(parent, color, s0, s1, fixed - T / 2, fixed + T / 2, y0, y1); };
    const col = (s0, s1) => { if (s1 - s0 < 0.02) return; if (axis === 'v') solid(fixed - T / 2, fixed + T / 2, s0, s1, H); else solid(s0, s1, fixed - T / 2, fixed + T / 2, H); };
    let cur = a0;
    for (const o of [...openings].sort((p, q) => p.c - q.c)) {
      const s0 = o.c - o.w / 2, s1 = o.c + o.w / 2;
      put(cur, s0, 0, H); col(cur, s0); cur = s1;
      if (o.sill > 0) {
        put(s0, s1, 0, o.sill);
        const gm = new THREE.Mesh(boxGeo, glassMat), mid = (s0 + s1) / 2;
        if (axis === 'v') { gm.position.set(wx(fixed), fl + (o.sill + o.head) / 2, wz(mid)); gm.scale.set(0.04, o.head - o.sill, s1 - s0); }
        else { gm.position.set(wx(mid), fl + (o.sill + o.head) / 2, wz(fixed)); gm.scale.set(s1 - s0, o.head - o.sill, 0.04); }
        parent.add(gm);
        const ft = 0.08, FB = (a, b, y0, y1) => axis === 'v' ? P(parent, TRIM, fixed - T / 2 - 0.03, fixed + T / 2 + 0.03, a, b, y0, y1, { cast: false }) : P(parent, TRIM, a, b, fixed - T / 2 - 0.03, fixed + T / 2 + 0.03, y0, y1, { cast: false });
        FB(s0 - 0.04, s1 + 0.04, o.sill, o.sill + ft); FB(s0 - 0.04, s1 + 0.04, o.head - ft, o.head); FB(s0 - 0.04, s0 + ft, o.sill, o.head); FB(s1 - ft, s1 + 0.04, o.sill, o.head); FB(mid - 0.03, mid + 0.03, o.sill, o.head);
        col(s0, s1);
      }
      if (o.head < H) put(s0, s1, o.head, H);
    }
    put(cur, a1, 0, H); col(cur, a1);
  }
  const win = (c, w, sill = 0.35, head = 2.55) => ({ c, w, sill, head }), doorway = (c, w) => ({ c, w, sill: 0, head: 2.4 });
  // Front (road side, u=0): wide glazing and the doorway.
  const frontGroup = dir > 0 ? walls.xmin : walls.xmax, backGroup = dir > 0 ? walls.xmax : walls.xmin;
  wall(frontGroup, 'v', 0, -HALF, HALF, [doorway(0, 2.0), win(-3.6, 4.2), win(3.9, 4.6)]);
  wall(backGroup, 'v', DEPTH, -HALF, HALF, []);
  wall(walls.zmin, 'u', -HALF, 0, DEPTH, [win(4.5, 2.4, 1.0, 2.3), win(8.8, 2.4, 1.0, 2.3)]);
  wall(walls.zmax, 'u', HALF, 0, DEPTH, [win(5.5, 3.0, 0.9, 2.3)]);
  // Brand band, roof and flat awning.
  for (const [g, a, b, c, d] of [[frontGroup, -0.12, 0.12, -HALF - 0.12, HALF + 0.12], [backGroup, DEPTH - 0.12, DEPTH + 0.12, -HALF - 0.12, HALF + 0.12]]) P(g, brand, a, b, c, d, H - 0.55, H, { cast: false });
  P(roofGroup, '#6c716f', -0.8, DEPTH + 0.3, -HALF - 0.3, HALF + 0.3, H, H + 0.3);
  P(roofGroup, brand, -0.85, -0.45, -HALF - 0.35, HALF + 0.35, H - 0.1, H + 0.45);
  P(roofGroup, accent, -0.5, -0.4, -HALF - 0.3, HALF + 0.3, H + 0.05, H + 0.15, { cast: false });
  P(roofGroup, '#7a7d79', 1, DEPTH - 1, -HALF + 1, HALF - 1, H + 0.3, H + 0.55);
  P(group, '#888b86', 0.05, 2.3, -2.4, 2.4, 0, 0.0); // doorstep
  // Name sign on the shop front.
  const nc = document.createElement('canvas'); nc.width = 512; nc.height = 96; { const c = nc.getContext('2d'); c.fillStyle = brand; c.fillRect(0, 0, 512, 96); c.fillStyle = accent; c.fillRect(0, 0, 512, 8); c.fillStyle = '#fff'; c.font = 'bold 58px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(site.name, 256, 52); }
  const nameTex = new THREE.CanvasTexture(nc); nameTex.colorSpace = THREE.SRGBColorSpace;
  const nameMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.05), new THREE.MeshStandardMaterial({ map: nameTex, emissiveMap: nameTex, emissive: '#ffffff', emissiveIntensity: 0.55 }));
  nameMesh.position.set(wx(-0.9), fl + H + 0.1, wz(0)); nameMesh.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2; roofGroup.add(nameMesh);

  // ---- Interior
  const fc = document.createElement('canvas'); fc.width = fc.height = 128; { const c = fc.getContext('2d'); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { c.fillStyle = (i + j) % 2 ? '#d9d8cf' : '#c4c9c6'; c.fillRect(i * 32, j * 32, 32, 32); } }
  const ftex = new THREE.CanvasTexture(fc); ftex.wrapS = ftex.wrapT = THREE.RepeatWrapping; ftex.repeat.set(DEPTH / 1.2, HALF * 2 / 1.2); ftex.colorSpace = THREE.SRGBColorSpace;
  const floor = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ map: ftex, roughness: 0.35 }));
  floor.position.set(wx(DEPTH / 2), fl + 0.012, wz(0)); floor.scale.set(DEPTH - 0.3, 0.025, HALF * 2 - 0.3); floor.receiveShadow = true; group.add(floor);
  P(group, '#b6b9b4', 0.05, DEPTH - 0.1, -HALF + 0.12, -HALF + 0.2, 0, 0.12, { cast: false }); // skirting hint
  // Counter with till, coffee machine and pie warmer.
  P(group, '#2f4a63', 1.4, 2.8, 2.0, 6.5, 0, 1.05); solid(1.4, 2.8, 2.0, 6.5, 1.1);
  P(group, '#dedcd2', 1.3, 2.9, 1.9, 6.6, 1.05, 1.1);
  P(group, '#1b1d20', 1.9, 2.4, 3.0, 3.6, 1.1, 1.35, emissive('#7fe0a0', 0.4)); // till
  P(group, '#2b2c2f', 1.6, 2.4, 5.2, 5.9, 1.1, 1.65); P(group, '#cf3f3a', 1.6, 1.62, 5.35, 5.75, 1.25, 1.45, emissive('#ff7a5a', 0.8)); // coffee machine
  P(group, '#bfe0e8', 1.6, 2.4, 4.0, 4.9, 1.1, 1.45, { transparent: true, opacity: 0.45 }); P(group, '#c58a3e', 1.8, 2.2, 4.2, 4.7, 1.12, 1.25); // pie warmer
  // Smokes wall behind the counter.
  P(group, '#272a2d', 3.4, 3.9, 2.0, 6.7, 0, 2.2); solid(3.4, 3.9, 2.0, 6.7, 2.2);
  for (let j = 0; j < 14; j++) for (let k = 0; k < 4; k++) P(group, ['#c8372e', '#e8e3d0', '#2e6aa3', '#d6a933', '#4d8f55'][(j + k * 2) % 5], 3.3, 3.4, 2.1 + j * 0.33, 2.38 + j * 0.33, 1.0 + k * 0.28, 1.2 + k * 0.28, { cast: false });
  // Aisle shelves with packets.
  for (const u of [5.2, 7.4]) {
    P(group, '#dcdad0', u - 0.4, u + 0.4, -5.7, 0.4, 0, 1.7); solid(u - 0.4, u + 0.4, -5.7, 0.4, 1.7);
    for (const side of [-1, 1]) for (let row = 0; row < 4; row++) for (let j = 0; j < 12; j++) {
      const col = ['#d6402f', '#2f73b3', '#e2b83a', '#4d9a58', '#d9d4c4', '#8d5aa8', '#e07c2b'][(j * 3 + row * 5 + (u > 6 ? 2 : 0)) % 7];
      P(group, col, u + side * 0.42 - 0.03, u + side * 0.42 + 0.03, -5.6 + j * 0.5, -5.2 + j * 0.5, 0.25 + row * 0.38, 0.5 + row * 0.38, { cast: false });
    }
    P(group, brand, u - 0.42, u + 0.42, -5.7, 0.4, 1.7, 1.78, { cast: false });
  }
  // Drinks fridges along the back wall.
  P(group, '#d9dcdc', DEPTH - 1.0, DEPTH - 0.1, -6.4, 6.4, 0, 2.3); solid(DEPTH - 1.0, DEPTH - 0.1, -6.4, 6.4, 2.3);
  for (let j = 0; j < 7; j++) {
    const v = -5.6 + j * 1.85;
    P(group, '#bfe6f0', DEPTH - 1.02, DEPTH - 1.0, v - 0.8, v + 0.8, 0.15, 2.15, emissive('#cdeeff', 0.9));
    for (let r = 0; r < 5; r++) for (let k = 0; k < 6; k++) P(group, ['#d6402f', '#2f73b3', '#e2b83a', '#4d9a58', '#f0ece0', '#8d5aa8'][(k + r + j) % 6], DEPTH - 1.04, DEPTH - 1.0, v - 0.7 + k * 0.26, v - 0.5 + k * 0.26, 0.3 + r * 0.36, 0.55 + r * 0.36, { cast: false });
  }
  // Ice-cream chest and a chip stand by the door, ATM and bin.
  P(group, '#f2f2ee', 1.0, 2.6, -6.5, -3.4, 0, 0.9); P(group, '#9dd0de', 1.1, 2.5, -6.4, -3.5, 0.9, 0.93, { transparent: true, opacity: 0.5 }); solid(1.0, 2.6, -6.5, -3.4, 0.95);
  P(group, '#e2b83a', 3.2, 4.0, -6.5, -5.6, 0, 1.7); solid(3.2, 4.0, -6.5, -5.6, 1.7);
  for (let r = 0; r < 4; r++) P(group, ['#d6402f', '#2f73b3', '#4d9a58', '#8d5aa8'][r], 3.0, 3.22, -6.4, -5.7, 0.3 + r * 0.38, 0.62 + r * 0.38, { cast: false });
  P(group, '#2a2e33', 0.3, 0.9, 6.2, 6.8, 0, 1.6); P(group, '#6fd0ff', 0.3, 0.32, 6.35, 6.65, 1.1, 1.4, emissive('#6fd0ff', 1.0)); solid(0.3, 0.9, 6.2, 6.8, 1.6);
  P(group, '#41474c', 0.3, 0.9, -1.8, -1.2, 0, 0.8); solid(0.3, 0.9, -1.8, -1.2, 0.8);
  // Ceiling light strips (on the roof group so they vanish with the lid) and real lights.
  for (const u of [3, 6.2, 9.4]) for (const v of [-3.4, 3.4]) P(roofGroup, '#fffbe8', u - 0.1, u + 0.1, v - 1.5, v + 1.5, H - 0.06, H - 0.02, emissive('#fffbe8', 1.5));
  const lights = [];
  for (const [u, v, i, d] of [[3.0, -2.5, 20, 9], [7.0, 3.0, 20, 9], [9.5, -3.0, 18, 8], [4.5, 4.5, 14, 7]]) {
    const l = new THREE.PointLight('#fff4de', i, d, 1.5); l.position.set(wx(u), fl + 2.7, wz(v)); group.add(l); lights.push(l);
  }
  // Front-of-shop glow so it reads as open at night.
  const glow = new THREE.PointLight('#fff1cf', 7, 10, 1.7); glow.position.set(wx(-1.5), fl + 2.4, wz(0)); group.add(glow);

  const minX = Math.min(wx(0), wx(DEPTH)), maxX = Math.max(wx(0), wx(DEPTH)), minZ = cz - HALF, maxZ = cz + HALF;
  const bounds = { minX, maxX, minZ, maxZ };
  return {
    group, fl, bounds, name: site.name, x: wx(5), z: cz, site, lights,
    floorAt(x, z) { return x > Math.min(wx(-19), maxX) && x < Math.max(wx(-19), minX === wx(0) ? maxX : maxX) && Math.abs(z - cz) < 14 && (dir > 0 ? x > wx(-19) && x < maxX : x < wx(-19) && x > minX) ? fl : null; },
    inside(x, z) { return x > minX + 0.12 && x < maxX - 0.12 && z > minZ + 0.12 && z < maxZ - 0.12; },
    near(x, z, r = 90) { return Math.abs(x - wx(5)) < r && Math.abs(z - cz) < r; },
    update(px, pz, camX, camZ, indoors) {
      roofGroup.visible = !indoors;
      walls.xmin.visible = !(indoors && camX < minX + 0.15);
      walls.xmax.visible = !(indoors && camX > maxX - 0.15);
      walls.zmin.visible = !(indoors && camZ < minZ + 0.15);
      walls.zmax.visible = !(indoors && camZ > maxZ - 0.15);
    },
  };
}
