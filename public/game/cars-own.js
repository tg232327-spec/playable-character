// Original procedural cars (no third-party models): hatch, wagon-SUV and van bodies built from
// extruded cross-section shells, plus a shared interior (seats, dash, wheel, console, headliner).
import * as THREE from 'three';
import { mergeGeometries } from './addons/utils/BufferGeometryUtils.js';

const box = new THREE.BoxGeometry(1, 1, 1);
const cyl = new THREE.CylinderGeometry(1, 1, 1, 12);
const M = {
  fabric: new THREE.MeshStandardMaterial({ color: '#4a4036', roughness: .95 }),
  fabric2: new THREE.MeshStandardMaterial({ color: '#2f3438', roughness: .95 }),
  dash: new THREE.MeshStandardMaterial({ color: '#25282b', roughness: .7 }),
  liner: new THREE.MeshStandardMaterial({ color: '#a8a496', roughness: .95 }),
  carpet: new THREE.MeshStandardMaterial({ color: '#1b1d1f', roughness: 1 }),
  dark: new THREE.MeshStandardMaterial({ color: '#131d22', roughness: .73 }),
  chrome: new THREE.MeshStandardMaterial({ color: '#b9c2c5', metalness: .95, roughness: .2 }),
  rubber: new THREE.MeshStandardMaterial({ color: '#23272a', roughness: .98 }),
  glass: new THREE.MeshStandardMaterial({ color: '#34505b', roughness: .08, metalness: .25, transparent: true, opacity: .62 }),
  lamp: new THREE.MeshStandardMaterial({ color: '#fff2ca', emissive: '#ffe9b7', emissiveIntensity: .15, roughness: .15 }),
  tail: new THREE.MeshStandardMaterial({ color: '#a70d13', emissive: '#c91c13', emissiveIntensity: .18, roughness: .25 }),
  amber: new THREE.MeshStandardMaterial({ color: '#e8a437', roughness: .23 }),
  rim: new THREE.MeshStandardMaterial({ color: '#8d969a', metalness: .8, roughness: .3 }),
  plate: new THREE.MeshStandardMaterial({ color: '#eee8d3', roughness: .55 }),
  skin: new THREE.MeshStandardMaterial({ color: '#c58f6b', roughness: .8 }),
};
export const CAR_MATS = M;

/** Interior parts shared by every car. add(geo,mat,x,y,z,sx,sy,sz,rx,ry,rz). */
export function buildInterior(add, o) {
  const { zS, zD, rear = [], roof = 1, dx = 1, width = .8, sideCards = true, driver = false } = o;
  const sx = width * .5; // seat half-spacing
  for (const x of [-sx, sx]) {
    add(box, M.fabric, x, .5, zS, .56, .16, .56);               // cushion
    add(box, M.fabric, x, .76, zS - .27, .56, .52, .14, -.12);   // backrest
    add(box, M.fabric2, x, 1.0, zS - .3, .3, .16, .1, -.12);     // headrest
    add(box, M.fabric2, x, .6, zS - .02, .05, .1, .5);           // bolster
  }
  for (const zr of rear) {
    add(box, M.fabric, 0, .5, zr, width * 2 - .1, .16, .56);
    add(box, M.fabric, 0, .75, zr - .27, width * 2 - .1, .5, .14, -.1);
    for (const x of [-sx, sx]) add(box, M.fabric2, x, .99, zr - .3, .28, .14, .08);
  }
  // Dashboard with instrument hood, vents and a glovebox line.
  add(box, M.dash, 0, .5, zD, width * 2 + .5, .22, .4);
  add(box, M.dash, 0, .64, zD - .05, width * 2 + .4, .08, .34, .25);
  add(box, M.dash, dx * width * .56, .72, zD - .1, .46, .14, .22);
  add(box, M.chrome, 0, .6, zD - .21, .5, .045, .02);
  for (const x of [-.25, .1, .38]) add(box, M.carpet, x, .56, zD - .21, .12, .04, .02);
  // Steering wheel and column.
  add(new THREE.TorusGeometry(.17, .022, 8, 20), M.dash, dx * width * .5, .74, zD - .38, 1, 1, 1, -.95);
  add(cyl, M.dash, dx * width * .5, .64, zD - .26, .02, .22, .02, -.95 + Math.PI / 2 * 0 - 0.6);
  // Centre console, gear lever and handbrake.
  add(box, M.dash, 0, .56, zS - .05, .24, .2, .9);
  add(cyl, M.chrome, 0, .72, zS + .12, .012, .22, .012);
  add(new THREE.SphereGeometry(.035, 8, 6), M.dash, 0, .83, zS + .12);
  add(box, M.dash, 0, .66, zS - .32, .08, .06, .26);
  // Floor, headliner, door cards.
  add(box, M.carpet, 0, .395, zS - .1, width * 2 + .45, .02, 2.2);
  add(box, M.liner, 0, roof - .045, zS - .1, width * 2 + .3, .03, 1.9);
  if (sideCards) for (const s of [-1, 1]) add(box, M.dash, s * (width + .03), .52, zS - .1, .04, .16, 1.9);
  // Rear-view mirror.
  add(box, M.dash, 0, roof - .15, zD + .35, .24, .07, .03);
  if (driver) {
    const x = dx * width * .5;
    add(new THREE.SphereGeometry(.095, 10, 8), M.skin, x, .87, zS - .16);
    add(box, new THREE.MeshStandardMaterial({ color: '#d9d2c0', roughness: .9 }), x, .64, zS - .2, .34, .36, .16);
    add(box, M.dash, x, .92, zS - .1, .02, .02, .02);
  }
}

const STYLES = {
  hatch: {
    L: 1.98, roof: .98, zS: -.28, zD: .56, rear: [-.98], width: .76,
    lower: [[-1.98, .82, .27, -.24], [-1.8, .9, .4, -.28], [-1.2, .93, .42, -.28], [.2, .94, .4, -.28], [1.2, .93, .36, -.27], [1.85, .88, .24, -.22], [1.98, .8, .16, -.2]],
    green: [[-1.78, .8, .5, .37], [-1.5, .84, .97, .37], [-.3, .84, .99, .37], [.45, .84, .97, .37], [1.12, .9, .42, .37]],
    rf: [-1.5, .45, .45], pillars: [[-.5, .96], [-1.4, .94]], wheelZ: 1.28, rimR: .27,
  },
  suv: {
    L: 2.3, roof: 1.27, zS: -.2, zD: .56, rear: [-.95], width: .8,
    lower: [[-2.3, .9, .62, -.3], [-2.2, .97, .7, -.3], [-1.2, .99, .7, -.3], [.9, .99, .62, -.3], [2.0, .95, .5, -.28], [2.3, .88, .38, -.25]],
    green: [[-2.18, .88, .9, .62], [-2.1, .9, 1.27, .66], [-.2, .9, 1.29, .66], [.62, .9, 1.25, .66], [1.18, .96, .66, .62]],
    rf: [-2.1, .62, .62], pillars: [[-.25, 1.26], [-1.55, 1.26]], wheelZ: 1.5, rimR: .29,
  },
  van: {
    L: 2.45, roof: 1.58, zS: .0, zD: .78, rear: [-1.0], width: .8,
    lower: [[-2.45, .92, .62, -.3], [-2.35, .99, .7, -.3], [1.3, 1.0, .72, -.3], [2.1, .95, .5, -.28], [2.45, .9, .34, -.25]],
    green: [[-2.38, .92, 1.52, .68], [-2.3, .94, 1.6, .68], [.9, .94, 1.62, .68], [1.55, .97, .86, .68]],
    rf: [-2.3, 1.0, .9], pillars: [[.3, 1.6], [-.8, 1.6]], wheelZ: 1.5, rimR: .27, panelVan: true,
  },
};
export const STYLE_NAMES = Object.keys(STYLES);

function shell(stations, material) {
  const vertices = [], indices = [];
  for (const [z, width, top, bottom] of stations) {
    const cross = [[-width + .08, bottom], [-width, bottom + .07], [-width, top - .09], [-width + .12, top], [width - .12, top], [width, top - .09], [width, bottom + .07], [width - .08, bottom]];
    for (const [x, y] of cross) vertices.push(x, y, z);
  }
  for (let j = 0; j < stations.length - 1; j++) for (let k = 0; k < 8; k++) { const a = j * 8 + k, b = j * 8 + (k + 1) % 8, c = a + 8, d = b + 8; indices.push(a, c, b, b, c, d); }
  for (const end of [0, stations.length - 1]) for (let k = 1; k < 7; k++) { const a = end * 8; indices.push(a, a + k + (end === 0 ? 1 : 0), a + k + (end === 0 ? 0 : 1)); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); g.setIndex(indices); g.computeVertexNormals();
  return new THREE.Mesh(g, material);
}

const paintCache = new Map();
function paintMat(color) {
  if (!paintCache.has(color)) paintCache.set(color, new THREE.MeshPhysicalMaterial({ color, metalness: .4, roughness: .32, clearcoat: .7, clearcoatRoughness: .2 }));
  return paintCache.get(color);
}

function mergeGroup(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const by = new Map();
  group.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    const ng = g.index ? g.toNonIndexed() : g;
    for (const k of Object.keys(ng.attributes)) if (!['position', 'normal', 'uv'].includes(k)) ng.deleteAttribute(k);
    if (!ng.attributes.uv) ng.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(ng.attributes.position.count * 2), 2));
    if (!ng.attributes.normal) ng.computeVertexNormals();
    if (!by.has(o.material)) by.set(o.material, []);
    by.get(o.material).push(ng);
  });
  group.clear();
  for (const [mat, geos] of by) { const m = new THREE.Mesh(mergeGeometries(geos), mat); m.castShadow = true; m.receiveShadow = true; group.add(m); }
}

/** Build the (unmerged until finished) body of a car; returns {root, wheels}. */
function body(style, color, low) {
  const S = STYLES[style], paint = paintMat(color), root = new THREE.Group(), b = new THREE.Group(); root.add(b);
  const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); b.add(m); return m; };
  const p = (mat, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => add(box, mat, x, y, z, sx, sy, sz, rx, ry, rz);
  b.add(shell(S.lower, paint));
  const gr = shell(S.green, M.glass); b.add(gr);
  const { roof, L } = S, gz = S.green, zr0 = gz[0][0], zr1 = gz[gz.length - 2][0];
  // Roof skin and pillars.
  const rz0 = S.rf[0] + .1, rz1 = S.rf[2];
  p(paint, 0, roof + .02, (rz0 + rz1) / 2 - .05, S.green[1][1] * 2 - .14, .06, rz1 - rz0 + .1);
  for (const s of [-1, 1]) {
    for (const [pz, py] of S.pillars) p(paint, s * (S.green[2][1] - .02), (.39 + py) / 2, pz, .07, py - .39, .12);
    { const gl = S.green[S.green.length - 1][0], dz = gl - S.rf[2] , dy = roof - .42, len = Math.hypot(dz, dy);
      p(paint, s * (S.green[2][1] - .02), (roof + .42) / 2, (S.rf[2] + gl) / 2, .07, len, .08, Math.atan2(-dz, dy) * -1 * -1 * 1); }
    p(paint, s * (S.green[2][1] - .02), .4, 0, .06, .05, 2.4);
    // Doors: seam lines, handles and mirrors.
    const dz = S.panelVan ? [.2, -.9] : [.2, -.8];
    for (const z of dz) { p(M.dark, s * (S.lower[2][1] + .008), .08, z, .012, .66, .016); p(M.chrome, s * (S.lower[2][1] + .02), .32, z - .2, .02, .03, .16); }
    p(M.dark, s * (S.lower[2][1] + .008), .08, dz[0] + .75, .012, .66, .016);
    p(M.dark, s * 1.04, .56, S.zD + .14, .12, .1, .14, 0, 0, s * .15); p(paint, s * 1.1, .56, S.zD + .14, .04, .08, .12);
    // Wheel arches.
    for (const zz of [-S.wheelZ, S.wheelZ]) add(new THREE.TorusGeometry(.5, .035, 5, 18, Math.PI), paint, s * (S.lower[2][1] + .008), -.26, zz, 1, 1, 1, 0, Math.PI / 2, 0);
    // Headlamps, indicators, tail lamps.
    p(M.lamp, s * .68, S.lower[0][2] > .5 ? .5 : .18, L + .005, .46, .18, .08, 0, 0, 0);
    p(M.amber, s * .92, S.lower[0][2] > .5 ? .46 : .15, L - .03, .12, .14, .08);
    p(M.tail, s * .72, S.lower[0][2] > .5 ? .5 : .2, -L - .005, .22, .3, .06);
  }
  // Bumpers, grille, plates.
  p(M.dark, 0, -.12, L + .02, 1.9, .2, .14); p(M.dark, 0, -.12, -L - .02, 1.9, .2, .14);
  p(M.dark, 0, S.lower[0][2] > .5 ? .34 : .06, L + .02, 1.05, .2, .06); p(M.chrome, 0, S.lower[0][2] > .5 ? .34 : .06, L + .05, .9, .03, .02);
  p(M.plate, 0, -.1, L + .1, .52, .13, .02); p(M.plate, 0, -.08, -L - .1, .52, .13, .02);
  if (S.panelVan) { p(paint, 0, 1.1, -L + .02, 1.6, .02, .02); p(M.dark, 0, .05, 1.3, 1.9, .02, .02); }
  // Interior.
  buildInterior(add, { zS: S.zS, zD: S.zD, rear: S.rear, roof, dx: -1, width: S.width, driver: !low });
  // Wheels
  const wheels = [];
  for (const [x, z] of [[-1.08, S.wheelZ], [1.08, S.wheelZ], [-1.08, -S.wheelZ], [1.08, -S.wheelZ]]) {
    const steer = new THREE.Group(), spin = new THREE.Group(); steer.position.set(x, -.34, z); steer.add(spin); root.add(steer);
    const r = .43, tire = new THREE.Mesh(new THREE.CylinderGeometry(r, r, .3, low ? 14 : 26), M.rubber); tire.rotation.z = Math.PI / 2; spin.add(tire);
    for (const s of [-1, 1]) {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, .02, low ? 12 : 20), M.rim); d.rotation.z = Math.PI / 2; d.position.x = s * .152; spin.add(d);
      if (!low) for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2, sp = new THREE.Mesh(box, M.chrome); sp.position.set(s * .16, Math.cos(a) * .14, Math.sin(a) * .14); sp.scale.set(.025, .26, .05); sp.rotation.x = a; spin.add(sp); }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, .02, 8), M.dark); hub.rotation.z = Math.PI / 2; hub.position.x = s * .165; spin.add(hub);
    }
    if (!low) mergeGroup(spin);
    steer.userData.spin = spin; wheels.push(steer);
  }
  return { root, b, wheels };
}

export function makeTrafficCar(scene, style, color) {
  const { root, b, wheels } = body(style, color, false);
  mergeGroup(b);
  root.userData = { wheels, struts: [], isUte: false, wheelLift: 0, body: b, style };
  if (scene) scene.add(root);
  return root;
}

/** Bake a bunch of parked cars into one mesh per material. entries: [{style,color,x,y,z,yaw}] */
export function bakeParkedOwn(scene, entries) {
  const by = new Map();
  for (const e of entries) {
    const { root } = body(e.style, e.color, true);
    root.position.set(e.x, e.y + .77, e.z); root.rotation.y = e.yaw; root.updateMatrixWorld(true);
    root.traverse(o => {
      if (!o.isMesh) return;
      const g = o.geometry.clone().applyMatrix4(o.matrixWorld), ng = g.index ? g.toNonIndexed() : g;
      for (const k of Object.keys(ng.attributes)) if (!['position', 'normal', 'uv'].includes(k)) ng.deleteAttribute(k);
      if (!ng.attributes.uv) ng.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(ng.attributes.position.count * 2), 2));
      if (!ng.attributes.normal) ng.computeVertexNormals();
      if (!by.has(o.material)) by.set(o.material, []);
      by.get(o.material).push(ng);
    });
  }
  const out = [];
  for (const [mat, geos] of by) { const m = new THREE.Mesh(mergeGeometries(geos), mat); m.castShadow = true; m.receiveShadow = true; scene.add(m); out.push(m); }
  return out;
}
