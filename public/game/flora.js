import * as THREE from 'three';

// Low-poly Australian native plants, modelled on the real silhouettes:
// wattle (Acacia), coastal banksia, grass tree (Xanthorrhoea), bottlebrush (Callistemon),
// paperbark (Melaleuca), tree fern (Dicksonia), plus native shrubs, tussock and dune spinifex.
// Faceted, chunky shapes: not photoreal, not blobs either.
export function createFlora({ add, height, colliders, rand }) {
  const facet = g => { const n = g.index ? g.toNonIndexed() : g; n.computeVertexNormals(); return n; };
  const blob = facet(new THREE.IcosahedronGeometry(1, 1));
  const lump = facet(new THREE.IcosahedronGeometry(1, 0));
  const trunk = new THREE.CylinderGeometry(0.7, 1, 1, 6).translate(0, 0.5, 0);
  const blade = new THREE.ConeGeometry(0.5, 1, 4).translate(0, 0.5, 0);
  const frond = facet(new THREE.ConeGeometry(0.5, 1, 4).scale(1, 1, 0.22).translate(0, 0.5, 0));
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 6);
  const Y = new THREE.Vector3(0, 1, 0), tq = new THREE.Quaternion(), te = new THREE.Euler();
  // Euler for "tilt by `tilt` away from vertical, then yaw by `yaw`".
  const aim = (yaw, tilt) => {
    tq.setFromAxisAngle(Y, yaw).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), tilt));
    return te.setFromQuaternion(tq);
  };
  const pick = a => a[Math.floor(rand() * a.length)];
  const ground = (x, z) => height(x, z);

  function wattle(x, z, s) {
    const y = ground(x, z);
    for (let k = 0; k < 3; k++) {
      const yaw = k * 2.1 + rand(), tilt = 0.18 + rand() * 0.15, h = (2.4 + rand()) * s, e = aim(yaw, tilt);
      add(trunk, '#6a5a47', x, y, z, 0.1 * s, h, 0.1 * s, e.x, e.y, e.z);
    }
    for (let k = 0; k < 6; k++) {
      const a = k * 1.1 + rand(), r = (0.6 + rand() * 0.7) * s;
      const cx = x + Math.cos(a) * r, cz = z + Math.sin(a) * r, cy = y + (2.2 + rand() * 1.1) * s;
      add(blob, pick(['#7e9448', '#8a9d4e', '#70853f']), cx, cy, cz, 0.85 * s, 0.6 * s, 0.85 * s, 0, rand() * 6, 0);
      if (rand() > 0.3) add(lump, pick(['#e6c93a', '#efd24a', '#dcbc2f']), cx + (rand() - 0.5) * 0.6 * s, cy + 0.45 * s, cz + (rand() - 0.5) * 0.6 * s, 0.52 * s, 0.4 * s, 0.52 * s, 0, rand() * 6, 0);
    }
    colliders.push({ x, z, w: 0.25 * s, d: 0.25 * s, h: 2, kind: 'wattle' });
  }

  function banksia(x, z, s) {
    const y = ground(x, z), lean = (rand() - 0.5) * 0.35, h = (2.6 + rand() * 1.4) * s, e = aim(rand() * 6.28, Math.abs(lean));
    add(trunk, '#5d4c3d', x, y, z, 0.2 * s, h, 0.2 * s, e.x, e.y, e.z);
    const tx = x + Math.sin(e.y) * Math.sin(Math.abs(lean)) * h * 0.4, tz = z + Math.cos(e.y) * Math.sin(Math.abs(lean)) * h * 0.4;
    for (let k = 0; k < 5; k++) {
      const a = k * 1.26 + rand() * 0.5, r = (0.7 + rand() * 0.6) * s;
      const cx = tx + Math.cos(a) * r, cz = tz + Math.sin(a) * r, cy = y + h * (0.9 + rand() * 0.12);
      add(blob, pick(['#4d6a46', '#587550', '#445f40']), cx, cy, cz, 0.95 * s, 0.5 * s, 0.95 * s, 0, rand() * 6, 0);
      if (rand() > 0.35) add(cyl, pick(['#d9a528', '#e0b53a', '#c98e22']), cx, cy + 0.5 * s, cz, 0.13 * s, 0.5 * s, 0.13 * s);
    }
    add(blob, '#587550', tx, y + h * 1.1, tz, 0.9 * s, 0.55 * s, 0.9 * s);
    colliders.push({ x, z, w: 0.3 * s, d: 0.3 * s, h: 2, kind: 'banksia' });
  }

  function grassTree(x, z, s) {
    const y = ground(x, z), th = (0.5 + rand() * 1.4) * s;
    add(trunk, '#2c2723', x, y, z, 0.28 * s, th, 0.28 * s);
    const topY = y + th;
    for (let k = 0; k < 26; k++) {
      const yaw = k * 2.4 + rand() * 0.4, tilt = 0.5 + rand() * 0.9, e = aim(yaw, tilt);
      add(blade, pick(['#7b8a4c', '#8a9558', '#6f7f45', '#96a05f']), x, topY, z, 0.1 * s, (1.3 + rand() * 0.6) * s, 0.1 * s, e.x, e.y, e.z);
    }
    // Tall flower spike.
    const sh = (1.5 + rand() * 1.5) * s;
    add(cyl, '#4a3827', x, topY + sh * 0.5 + 0.35 * s, z, 0.025 * s, sh, 0.025 * s);
    add(cyl, '#7d5a35', x, topY + sh + 0.55 * s, z, 0.06 * s, 0.7 * s, 0.06 * s);
    colliders.push({ x, z, w: 0.3 * s, d: 0.3 * s, h: 1.2, kind: 'grass tree' });
  }

  function bottlebrush(x, z, s) {
    const y = ground(x, z), h = (2.2 + rand()) * s;
    add(trunk, '#6a5645', x, y, z, 0.14 * s, h, 0.14 * s, 0, 0, (rand() - 0.5) * 0.15);
    for (let k = 0; k < 6; k++) {
      const a = k * 1.05 + rand(), r = (0.5 + rand() * 0.55) * s;
      const cx = x + Math.cos(a) * r, cz = z + Math.sin(a) * r, cy = y + h * (0.75 + rand() * 0.35);
      add(blob, pick(['#5f7a47', '#6a8550', '#557043']), cx, cy, cz, 0.7 * s, 0.5 * s, 0.7 * s, 0, rand() * 6, 0);
      const e = aim(a, Math.PI / 2 * (0.8 + rand() * 0.3));
      add(cyl, pick(['#b8262b', '#c63a2e', '#a81f2d']), cx + Math.cos(a) * 0.4 * s, cy + 0.15 * s, cz + Math.sin(a) * 0.4 * s, 0.1 * s, 0.4 * s, 0.1 * s, e.x, e.y, e.z);
    }
    colliders.push({ x, z, w: 0.25 * s, d: 0.25 * s, h: 2, kind: 'bottlebrush' });
  }

  function paperbark(x, z, s) {
    const y = ground(x, z), h = (5 + rand() * 2.5) * s, e = aim(rand() * 6.28, 0.1 + rand() * 0.16);
    add(trunk, '#dcd1b8', x, y, z, 0.3 * s, h, 0.3 * s, e.x, e.y, e.z);
    add(trunk, '#9d8f78', x, y, z, 0.31 * s, h * 0.18, 0.31 * s, e.x, e.y, e.z);
    const tx = x + Math.sin(e.y) * Math.sin(0.2) * h * 0.5, tz = z + Math.cos(e.y) * Math.sin(0.2) * h * 0.5;
    for (let k = 0; k < 7; k++) {
      const a = k * 0.9 + rand(), r = (0.8 + rand() * 1.5) * s;
      add(blob, pick(['#7c8b5f', '#6f7f55', '#8a9769']), tx + Math.cos(a) * r, y + h * (0.72 + rand() * 0.3), tz + Math.sin(a) * r, 1.15 * s, 0.55 * s, 1.15 * s, 0, rand() * 6, 0);
    }
    colliders.push({ x, z, w: 0.38 * s, d: 0.38 * s, h: h * 0.6, kind: 'paperbark' });
  }

  function treeFern(x, z, s) {
    const y = ground(x, z), h = (1.4 + rand() * 1.4) * s;
    add(trunk, '#4a3b2d', x, y, z, 0.2 * s, h, 0.2 * s);
    for (let k = 0; k < 9; k++) {
      const yaw = k * 0.7 + rand() * 0.3, e = aim(yaw, 1.0 + rand() * 0.35);
      add(frond, pick(['#4d8a3e', '#5a9648', '#437a37']), x, y + h, z, 1.0 * s, 2.0 * s, 1.0 * s, e.x, e.y, e.z);
    }
    colliders.push({ x, z, w: 0.22 * s, d: 0.22 * s, h: 1.2, kind: 'tree fern' });
  }

  function shrub(x, z, s, flowers = true) {
    const y = ground(x, z), col = pick(['#5b7550', '#66805a', '#4f6b4b', '#728a5a']);
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + rand(), r = 0.35 * s;
      add(blob, col, x + Math.cos(a) * r, y + 0.3 * s, z + Math.sin(a) * r, 0.55 * s, 0.42 * s, 0.55 * s, 0, rand() * 6, 0);
    }
    if (flowers && rand() > 0.5) {
      const f = pick(['#c94f73', '#f0eadf', '#e4b83a', '#9c5ab0']);
      for (let k = 0; k < 4; k++) add(lump, f, x + (rand() - 0.5) * 0.9 * s, y + (0.45 + rand() * 0.2) * s, z + (rand() - 0.5) * 0.9 * s, 0.1 * s, 0.1 * s, 0.1 * s);
    }
  }

  function tussock(x, z, s, col) {
    const y = ground(x, z), c = col ?? pick(['#a2a158', '#8f9a52', '#b0a863']);
    for (let k = 0; k < 9; k++) {
      const e = aim(k * 2.4, 0.25 + rand() * 0.55);
      add(blade, c, x, y, z, 0.1 * s, (0.7 + rand() * 0.6) * s, 0.1 * s, e.x, e.y, e.z);
    }
  }

  const kinds = { wattle, banksia, grassTree, bottlebrush, paperbark, treeFern, shrub, tussock };
  const bush = [['wattle', 3], ['banksia', 3], ['grassTree', 3], ['bottlebrush', 1.5], ['paperbark', 1.5], ['treeFern', 1.2]];
  const total = bush.reduce((a, [, w]) => a + w, 0);
  function nativeTree(x, z, s = 1) {
    let r = rand() * total;
    for (const [k, w] of bush) { if ((r -= w) <= 0) return kinds[k](x, z, s * (k === 'paperbark' ? 1 : 0.9 + rand() * 0.3)); }
    wattle(x, z, s);
  }
  return { ...kinds, nativeTree };
}
