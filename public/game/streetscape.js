// Zebra crossings, drain grates and walk-in stormwater tunnels.
// (V11: raised footpaths, kerbs and nature strips removed at user request — the
// road now just runs out to a simple grass verge.)
import * as THREE from 'three';
export function createStreetscape({ scene, height, housePlots, colliders, servoSites, inHomeArea, rand }) {
  let seed = 4242; const rr = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const JUNCTIONS = [28, -125, -240, 125], Z0 = -935, Z1 = 885;
  // ---------------- helpers ----------------
  const dummy = new THREE.Object3D();
  function instanced(geo, mat, list, tint) {
    if (!list.length) return null;
    const m = new THREE.InstancedMesh(geo, mat, list.length); m.receiveShadow = true; m.castShadow = false;
    list.forEach((e, i) => { dummy.position.set(e.x, e.y, e.z); dummy.rotation.set(e.rx || 0, e.ry || 0, e.rz || 0); dummy.scale.set(e.sx || 1, e.sy || 1, e.sz || 1); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); if (tint) m.setColorAt(i, new THREE.Color(e.c ?? '#ffffff')); });
    m.instanceMatrix.needsUpdate = true; scene.add(m); return m;
  }
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: .92, ...o });
  const slabGeo = new THREE.BoxGeometry(1, 1, 1);
  const driveZ = [];
  for (const p of housePlots) if (Math.abs(p.end[0]) < 14) driveZ.push({ side: Math.sign(p.end[0]) || 1, z: p.end[1] });
  const blockedAt = (side, z, pad) => {
    if (JUNCTIONS.some(c => Math.abs(z - c) < 6.4 + pad)) return true;
    if (JUNCTIONS.some(c => Math.abs(z - (c - 10.5)) < 2.3 + pad)) return true;           // zebra ramps
    if (driveZ.some(d => d.side === side && Math.abs(d.z - z) < 2.3 + pad)) return true;
    if (servoSites.some(s => Math.sign(s.x) === side && Math.abs(s.z - z) < 15 + pad)) return true;
    if (inHomeArea && inHomeArea(side * 8, z)) return true;
    return false;
  };
  // footpaths are gone — API kept for compatibility
  const pathAt = () => null;
  // ---------------- drain grates along the gutter ----------------
  const grates = [];
  for (const side of [-1, 1])
    for (let z = Z0 + 20; z < Z1; z += 41) {
      if (blockedAt(side, z, 2.2)) continue;
      const x = side * 5.0, h = height(x, z); grates.push({ x, y: h + .03, z, sx: .62, sy: .03, sz: 1.1 });
    }
  instanced(slabGeo, std({ color: '#2b2c2c', roughness: .5, metalness: .4 }), grates);
  // zebra stripes on the road
  const stripes = [];
  for (const c of JUNCTIONS) for (let x = -4.4; x <= 4.4; x += 1.1) stripes.push({ x, y: height(x, c - 10.5) + .125, z: c - 10.5, sx: .55, sy: .012, sz: 3.2 });
  instanced(slabGeo, std({ color: '#ece6d2', roughness: .8 }), stripes);
  // ---------------- walk-in stormwater tunnels ----------------
  const concreteMat = std({ color: '#8f8c82', roughness: .95 }), darkMat = std({ color: '#2a2b2a', roughness: 1 });
  const tunnels = [];
  function box(mat, x, y, z, w, h, d) { const m = new THREE.Mesh(slabGeo, mat); m.position.set(x, y, z); m.scale.set(w, h, d); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m; }
  for (const c of JUNCTIONS) {
    const tz = c + 19, x0 = 44, x1 = 64, h = height(54, tz), gy = h + .05;
    const inner = 3.0, wall = .5, hh = 2.7;
    box(darkMat, (x0 + x1) / 2, gy, tz, x1 - x0, .1, inner);                      // floor
    box(concreteMat, (x0 + x1) / 2, gy + hh + wall / 2, tz, x1 - x0 + .6, wall, inner + wall * 2);   // roof
    for (const s of [-1, 1]) {
      box(concreteMat, (x0 + x1) / 2, gy + hh / 2, tz + s * (inner / 2 + wall / 2), x1 - x0, hh, wall);
      colliders.push({ x: (x0 + x1) / 2, z: tz + s * (inner / 2 + wall / 2), w: (x1 - x0) / 2, d: wall / 2, h: hh, kind: 'tunnel wall' });
    }
    colliders.push({ x: x0 - .3, z: tz, w: .3, d: inner / 2 + wall, h: hh, kind: 'tunnel end' });
    box(darkMat, x0 - .05, gy + hh / 2, tz, .1, hh, inner);
    // headwall + wing walls at the beach end
    box(concreteMat, x1 + .3, gy + hh + .8, tz, .6, 1.6, inner + 2.4);
    for (const s of [-1, 1]) box(concreteMat, x1 + .3, gy + hh / 2, tz + s * (inner / 2 + .5 + .45), .6, hh, .9);
    box(std({ color: '#c9bf9a' }), x1 + .62, gy + hh + .9, tz, .06, .5, 2.2);        // painted tag plate
    // channel apron and a bit of water trickle
    const apron = box(std({ color: '#2f4448', roughness: .15, metalness: .2 }), x1 + 3, gy + .02, tz, 6, .04, inner * .6);
    // hanging bulkhead lights (emissive + a faint point light)
    for (let x = x0 + 4; x < x1; x += 7) {
      const lamp = box(std({ color: '#ffd9a0', emissive: '#ffb860', emissiveIntensity: 2.2 }), x, gy + hh - .15, tz, .5, .14, .3);
    }
    const L = new THREE.PointLight('#ffb870', 6, 14, 1.6); L.position.set((x0 + x1) / 2, gy + hh - .5, tz); scene.add(L);
    // earth mound over the tunnel
    const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), std({ color: '#7e8f5a' }));
    mound.position.set(x0 + 5, gy + hh + wall - .2, tz); mound.scale.set(8.5, 1.3, 4.2); mound.receiveShadow = true; scene.add(mound);
    tunnels.push({ x: (x0 + x1) / 2, z: tz });
  }
  return { tunnels, pathAt, count: { slabs: 0, kerbs: 0 } };
}
