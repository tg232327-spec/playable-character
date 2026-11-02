import * as THREE from 'three';

// Your place: a weatherboard cottage on the east side of the coast road, with a furnished interior,
// a front-yard driveway for the cars and a scooter leaning by the path.
// Local frame: u runs from the front wall (road side) towards the back, v runs along the street (world z).
export const HOME = { cx: 23.5, cz: 106.5, hx: 5.5, hz: 8, wallH: 2.9 };

export async function createHome({ scene, height, colliders }) {
  const { cx, cz, hx, hz, wallH: H } = HOME;
  const group = new THREE.Group(); group.name = 'home'; scene.add(group);
  const ceilingGroup = new THREE.Group(), roofGroup = new THREE.Group();
  const walls = { front: new THREE.Group(), back: new THREE.Group(), north: new THREE.Group(), south: new THREE.Group() };
  group.add(ceilingGroup, roofGroup, ...Object.values(walls));

  // Floor height: highest ground under the footprint, so the slab never sinks into the lawn.
  let base = -Infinity;
  for (let x = cx - hx - 3; x <= cx + hx + 1; x += 1.5) for (let z = cz - hz - 1; z <= cz + hz + 1; z += 1.5) base = Math.max(base, height(x, z));
  const fl = base + 0.06;

  const mats = new Map();
  const mat = (color, o = {}) => {
    const k = color + JSON.stringify(o);
    if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0, ...o }));
    return mats.get(k);
  };
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  // x/z are world centres, y0 is the bottom measured from the floor surface.
  function B(parent, color, x, y0, z, sx, sh, sz, o = {}) {
    const { cast, ...mo } = o;
    const m = new THREE.Mesh(boxGeo, typeof color === 'string' ? mat(color, mo) : color);
    m.position.set(x, fl + y0 + sh / 2, z); m.scale.set(sx, sh, sz);
    m.castShadow = cast !== false; m.receiveShadow = true; parent.add(m); return m;
  }
  const X = u => cx - hx + u, Z = v => cz + v;
  const solid = (x, z, w, d, h = 1) => colliders.push({ x, z, w, d, h: Math.max(h, 0.6), kind: 'home' });

  // ------------------------------------------------------------------ Slab, floors
  B(group, '#9b9482', cx, -1.3, cz, hx * 2 + 0.5, 1.3, hz * 2 + 0.5);
  B(group, '#8a6a49', X(5.5), 0, Z(-2.5), hx * 2 - 0.3, 0.025, 11 - 0.3, { roughness: 0.55 });            // living/kitchen boards
  B(group, '#7b5c3f', X(7.3), 0, Z(5.5), 7.4, 0.025, 4.8, { roughness: 0.55 });                          // bedroom boards
  B(group, '#c7cfcb', X(1.75), 0, Z(5.5), 3.1, 0.03, 4.8, { roughness: 0.3 });                           // bathroom tiles
  B(group, '#bdb7a4', X(9.2), 0.0, Z(0.6), 3.4, 0.032, 4.4, { roughness: 0.4 });                         // kitchen lino
  // Porch, two steps and a path to the driveway.
  B(group, '#a8a290', X(-1.6), -1.0, Z(-4.5), 3.2, 1.0, 5.2);
  B(group, '#b8b29f', X(-3.4), -1.0, Z(-4.5), 0.5, 0.52, 3.2);
  B(group, '#b8b29f', X(-3.9), -1.0, Z(-4.5), 0.5, 0.26, 3.0);

  // ------------------------------------------------------------------ Walls
  const WALL = '#dcd2b4', TRIM = '#f1e9d3', INNER = '#e9e0cc';
  const glassMat = new THREE.MeshStandardMaterial({ color: '#9cc3cf', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
  const T = 0.2;
  // axis 'z': wall runs along world z at x = fixed; axis 'x': runs along x at z = fixed.
  function wall(parent, axis, fixed, a0, a1, openings, { color = WALL, thick = T, exterior = true, collide = true } = {}) {
    const put = (s0, s1, y0, y1, isWindow) => {
      if (s1 - s0 < 0.01) return;
      const m = (s0 + s1) / 2, len = s1 - s0, hh = y1 - y0;
      if (axis === 'z') B(parent, color, fixed, y0, m, thick, hh, len); else B(parent, color, m, y0, fixed, len, hh, thick);
    };
    let cur = a0;
    for (const o of [...openings].sort((p, q) => p.c - q.c)) {
      const s0 = o.c - o.w / 2, s1 = o.c + o.w / 2;
      put(cur, s0, 0, H); cur = s1;
      if (o.sill > 0) {
        put(s0, s1, 0, o.sill);
        const gm = new THREE.Mesh(boxGeo, glassMat), mid = (s0 + s1) / 2, gy = fl + (o.sill + o.head) / 2;
        gm.scale.set(axis === 'z' ? 0.04 : s1 - s0, o.head - o.sill, axis === 'z' ? s1 - s0 : 0.04);
        gm.position.set(axis === 'z' ? fixed : mid, gy, axis === 'z' ? mid : fixed); parent.add(gm);
        // Frame and a mullion.
        const fr = TRIM, ft = 0.07, fd = thick + 0.06;
        const F = (cc, y0, w, h) => axis === 'z' ? B(parent, fr, fixed, y0, cc, fd, h, w, { cast: false }) : B(parent, fr, cc, y0, fixed, w, h, fd, { cast: false });
        F(mid, o.sill, s1 - s0 + 0.1, ft); F(mid, o.head - ft, s1 - s0 + 0.1, ft); F(s0, o.sill, ft, o.head - o.sill); F(s1, o.sill, ft, o.head - o.sill); F(mid, o.sill, ft * 0.7, o.head - o.sill);
        if (collide) { if (axis === 'z') solid(fixed, mid, thick / 2, (s1 - s0) / 2, H); else solid(mid, fixed, (s1 - s0) / 2, thick / 2, H); }
      }
      if (o.head < H) put(s0, s1, o.head, H);
    }
    put(cur, a1, 0, H);
    // Colliders for the solid runs between openings.
    if (collide) {
      let c2 = a0;
      for (const o of [...openings].sort((p, q) => p.c - q.c)) {
        const s0 = o.c - o.w / 2; const L = s0 - c2;
        if (L > 0.02) (axis === 'z' ? solid(fixed, (c2 + s0) / 2, thick / 2, L / 2, H) : solid((c2 + s0) / 2, fixed, L / 2, thick / 2, H));
        c2 = o.c + o.w / 2;
      }
      const L = a1 - c2; if (L > 0.02) (axis === 'z' ? solid(fixed, (c2 + a1) / 2, thick / 2, L / 2, H) : solid((c2 + a1) / 2, fixed, L / 2, thick / 2, H));
    }
  }
  const win = (c, w = 1.8, sill = 0.95, head = 2.15) => ({ c, w, sill, head });
  const doorway = (c, w = 1.1) => ({ c, w, sill: 0, head: 2.1 });
  // Exterior shell (each side is its own group so the camera-facing ones can be cut away).
  wall(walls.front, 'z', cx - hx, cz - hz, cz + hz, [doorway(Z(-4.5), 1.9), win(Z(-0.2)), win(Z(5.2), 1.3), win(Z(-7.6), 1.1, 0.95, 2.1)]);
  wall(walls.back, 'z', cx + hx, cz - hz, cz + hz, [win(Z(-4.5), 2.2), win(Z(0.2), 1.2, 1.1, 2.0), win(Z(5.8), 1.6)]);
  wall(walls.north, 'x', cz - hz, cx - hx, cx + hx, [win(X(4.2), 1.8), win(X(8.6), 1.4)]);
  wall(walls.south, 'x', cz + hz, cx - hx, cx + hx, [win(X(7.4), 1.8), win(X(1.8), 0.7, 1.3, 2.0)]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(group, TRIM, cx + sx * (hx + 0.1), 0, cz + sz * (hz + 0.1), 0.26, H, 0.26);
  B(group, TRIM, cx, H, cz, hx * 2 + 0.7, 0.16, hz * 2 + 0.7);                    // fascia / top plate
  B(group, '#5b5a4f', cx, -0.25, cz, hx * 2 + 0.6, 0.3, hz * 2 + 0.6);             // dark stumps line

  // Interior partitions.
  const PART = '#efe7d3';
  wall(group, 'x', cz + 3, cx - hx, cx + hx, [doorway(X(1.7), 1.0), doorway(X(7.0), 1.1)], { color: PART, thick: 0.14 });
  wall(group, 'z', X(3.5), cz + 3, cz + hz, [], { color: PART, thick: 0.14 });
  // Skirting along the long interior walls.
  B(group, TRIM, cx + hx - 0.12, 0, Z(-2.6), 0.04, 0.12, 10, { cast: false });
  B(group, TRIM, cx - hx + 0.12, 0, Z(-2.6), 0.04, 0.12, 10, { cast: false });

  // Front door: open leaf swung flat against the inside wall, brass number plate beside it.
  B(group, '#4a6a60', X(0.35), 0, Z(-3.6), 0.04, 2.05, 0.9);
  B(group, '#c9a24a', X(-0.05), 1.05, Z(-6.0), 0.02, 0.12, 0.22, { metalness: 0.8, roughness: 0.3 });

  // ------------------------------------------------------------------ Ceiling and roof
  const ceil = new THREE.Mesh(boxGeo, mat('#f2ecdc')); ceil.scale.set(hx * 2, 0.1, hz * 2); ceil.position.set(cx, fl + H + 0.04, cz); ceil.receiveShadow = true; ceilingGroup.add(ceil);
  {
    const w = hx * 2 + 2.4, d = hz * 2 + 1.0, rh = 2.35, y = fl + H + 0.1;
    // Gable roof, ridge along z.
    const p = [
      -w / 2, 0, -d / 2, w / 2, 0, -d / 2, 0, rh, -d / 2,
      -w / 2, 0, d / 2, 0, rh, d / 2, w / 2, 0, d / 2,
      -w / 2, 0, -d / 2, 0, rh, -d / 2, -w / 2, 0, d / 2,
      -w / 2, 0, d / 2, 0, rh, -d / 2, 0, rh, d / 2,
      w / 2, 0, -d / 2, w / 2, 0, d / 2, 0, rh, -d / 2,
      w / 2, 0, d / 2, 0, rh, d / 2, 0, rh, -d / 2,
      -w / 2, 0, -d / 2, -w / 2, 0, d / 2, w / 2, 0, -d / 2,
      w / 2, 0, -d / 2, -w / 2, 0, d / 2, w / 2, 0, d / 2
    ];
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geo.computeVertexNormals();
    const roof = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#8d6854', roughness: 0.78, side: THREE.DoubleSide, flatShading: true }));
    roof.position.set(cx, y, cz); roof.castShadow = true; roofGroup.add(roof);
    // Ridge cap and a chimney.
    B(roofGroup, '#6e4f40', cx, H + 0.1 + rh - 0.02, cz, 0.25, 0.14, d + 0.1);
    B(roofGroup, '#9a5a45', cx + 2.2, H + 0.1, cz - 3, 0.9, 2.9, 0.9);
    B(roofGroup, '#4a4a46', cx + 2.2, H + 3.0, cz - 3, 1.1, 0.12, 1.1);
  }
  // Porch awning (always visible) with posts.
  B(group, '#6f8a82', X(-1.9), H - 0.18, Z(-4.5), 3.4, 0.12, 5.6);
  for (const v of [-7.1, -1.9]) { B(group, TRIM, X(-3.35), 0, Z(v), 0.16, H - 0.15, 0.16); solid(X(-3.35), Z(v), 0.1, 0.1, H); }

  // ------------------------------------------------------------------ Furniture
  // V11: the interior is now kitted out with models from the Quaternius Ultimate House
  // Interior Pack (CC0) — couch, bed, kitchen, bathroom, the lot — plus a bong on the
  // coffee table. Seats are registered so the player can sit on them (press E).
  const F = group;
  const WOOD = '#6b4a30', DARK = '#2a2a2c';
  const seats = [], interactables = [];
  const propCache = {};
  async function loadProp(file) {
    if (propCache[file]) return propCache[file];
    const data = await (await fetch('models/' + file)).json();
    const g = new THREE.Group();
    for (const part of data.parts) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(part.positions, 3));
      if (part.normals) geo.setAttribute('normal', new THREE.Float32BufferAttribute(part.normals, 3));
      else geo.computeVertexNormals();
      geo.setIndex(part.indices);
      const material = new THREE.MeshStandardMaterial({ roughness: .85, metalness: 0 });
      material.color.setRGB(part.color[0], part.color[1], part.color[2]);
      if (part.texture) {
        await new Promise((res, rej) => new THREE.TextureLoader().load(part.texture, t => { t.colorSpace = THREE.SRGBColorSpace; material.map = t; material.color.set('#ffffff'); res(); }, undefined, rej));
      }
      const mesh = new THREE.Mesh(geo, material);
      mesh.castShadow = true; mesh.receiveShadow = true;
      g.add(mesh);
    }
    propCache[file] = g;
    return g;
  }
  async function place(file, u, v, yaw, s = 0.5, opts = {}) {
    const proto = await loadProp(file);
    const m = proto.clone();
    m.position.set(X(u), fl + (opts.dy || 0), Z(v));
    m.rotation.y = yaw;
    m.scale.setScalar(s);
    F.add(m);
    if (opts.solid) solid(X(u), Z(v), opts.solid[0], opts.solid[1], opts.solid[2] ?? 1);
    if (opts.seat) seats.push({ x: X(u), z: Z(v), y: fl + opts.seat.y, yaw: yaw + (opts.seat.dyaw || 0), kind: opts.seat.kind });
    if (opts.interact) interactables.push({ x: X(u), z: Z(v), y: fl, type: opts.interact, label: opts.label });
    return m;
  }
  // Living room: couch facing the TV, coffee table (with the bong), armchair, rug, bookcase, lamp, plant.
  await place('interior/carpet_round.json', 8.2, -4.4, 0, 0.55);
  await place('interior/couch_large2.json', 5.9, -4.4, Math.PI / 2, 0.52, { solid: [0.55, 1.2, 1.1], seat: { y: 0.44, kind: 'couch', dyaw: 0 } });
  await place('interior/table_roundsmall2.json', 8.3, -4.4, 0, 0.5, { solid: [0.45, 0.7, 0.6] });
  await place('interior/chair_2.json', 7.6, -6.9, Math.PI / 2, 0.5, { solid: [0.5, 0.5, 0.9], seat: { y: 0.46, kind: 'armchair', dyaw: 0 } });
  await place('interior/bookshelf.json', 5.5, -7.6, 0, 0.55, { solid: [1.1, 0.25, 2] });
  await place('interior/light_floor1.json', 10.3, -7.2, 0, 0.5);
  await place('interior/houseplant_3.json', 10.3, -1.7, 0, 0.55, { solid: [0.3, 0.3, 1] });
  // TV unit + TV stay procedural (no TV model in the pack).
  B(F, WOOD, X(10.55), 0.0, Z(-4.4), 0.7, 0.55, 2.2); solid(X(10.55), Z(-4.4), 0.4, 1.1, 0.6);
  B(F, DARK, X(10.6), 0.7, Z(-4.4), 0.1, 0.72, 1.35, { roughness: 0.2 });
  const tv = B(F, '#10242c', X(10.5), 0.74, Z(-4.4), 0.03, 0.62, 1.2, { emissive: '#2a6f86', emissiveIntensity: 1.1, roughness: 0.1, cast: false });
  // The bong, front and centre on the coffee table.
  await place('props/bong.json', 8.3, -4.4, 0.6, 0.5, { interact: 'bong', label: 'BONG', dy: 0.42 });
  // Hallway: shoe rack stays.
  B(F, WOOD, X(0.55), 0, Z(-6.3), 0.4, 0.5, 1.0); solid(X(0.55), Z(-6.3), 0.25, 0.55, 0.5);
  // Kitchen along the back wall: drawers, oven, sink, fridge (full of cold beer) + island with stools.
  await place('interior/kitchen_3drawers.json', 10.35, -0.3, -Math.PI / 2, 0.5, { solid: [0.4, 0.55, 0.95] });
  await place('interior/kitchen_oven.json', 10.35, 1.0, -Math.PI / 2, 0.5, { solid: [0.4, 0.4, 0.95] });
  await place('interior/kitchen_sink.json', 10.35, 2.0, -Math.PI / 2, 0.5, { solid: [0.4, 0.4, 0.95] });
  await place('interior/kitchen_fridge.json', 10.35, 3.1, -Math.PI / 2, 0.5, { solid: [0.4, 0.4, 1.9], interact: 'beer', label: 'ESKY-COLD BEER' });
  await place('interior/stool.json', 8.7, 0.2, 0, 0.5, { seat: { y: 0.66, kind: 'stool' } });
  await place('interior/stool.json', 8.7, 1.7, 0, 0.5, { seat: { y: 0.66, kind: 'stool' } });
  B(F, '#e9e6de', X(9.3), 0, Z(0.9), 0.8, 0.92, 2.2); B(F, '#a98a5a', X(9.3), 0.92, Z(0.9), 0.9, 0.05, 2.3); solid(X(9.3), Z(0.9), 0.5, 1.15, 1); // island
  // Dining table with four chairs near the window.
  await place('interior/table_roundlarge.json', 5.0, 0.9, 0, 0.55, { solid: [0.55, 0.9, 0.8] });
  for (const [du, dv, dyaw] of [[0, -1.35, 0], [0, 1.35, Math.PI], [-1.5, 0, Math.PI / 2], [1.5, 0, -Math.PI / 2]])
    await place('interior/chair_3.json', 5.0 + du, 0.9 + dv, dyaw, 0.5, { seat: { y: 0.46, kind: 'dining' } });
  // Bedroom: king bed, nightstands, dresser.
  await place('interior/bed_king.json', 7.5, 6.1, 0, 0.5, { solid: [0.95, 1.15, 0.9], seat: { y: 0.58, kind: 'bed', dyaw: Math.PI } });
  for (const sx of [-1, 1]) await place('interior/nightstand_1.json', 7.5 + sx * 1.45, 7.0, 0, 0.5, { solid: [0.3, 0.3, 0.6] });
  await place('interior/drawer_2.json', 10.4, 5.8, -Math.PI / 2, 0.5, { solid: [0.35, 1.0, 1.1] });
  // Bathroom: toilet, vanity, shower.
  await place('interior/bathroom_toilet.json', 0.55, 6.0, Math.PI / 2, 0.5, { solid: [0.3, 0.3, 0.7], seat: { y: 0.4, kind: 'toilet' } });
  await place('interior/bathroom_sink.json', 1.5, 7.5, Math.PI, 0.5, { solid: [0.55, 0.3, 0.9] });
  B(F, '#b8cfd6', X(1.5), 1.2, Z(7.72), 0.8, 0.8, 0.03, { metalness: 0.9, roughness: 0.08 });
  await place('interior/bathroom_shower1.json', 2.5, 4.2, Math.PI, 0.5, { solid: [0.2, 0.8, 1.6] });
  B(F, glassMat, X(2.9), 0, Z(4.6), 1.6, 2.0, 0.04);

  // Interior light. Warm point lights per room; kept always on so shader programs never change.
  const lights = [];
  for (const [x, y, z, i, d, c] of [[X(6.5), 2.5, Z(-3.6), 26, 11, '#ffd9a6'], [X(8.5), 2.5, Z(0.8), 18, 9, '#fff0d6'], [X(7.5), 2.4, Z(5.8), 14, 8, '#ffc98a'], [X(1.8), 2.4, Z(5.5), 8, 5, '#fff4e0']]) {
    const l = new THREE.PointLight(c, i, d, 1.6); l.position.set(x, fl + y, z); group.add(l); lights.push(l);
  }
  // Warm porch lamp and a mailbox on the street side.
  B(group, '#2a2a2c', X(-0.15), 2.2, Z(-6.3), 0.12, 0.2, 0.12); B(group, '#ffe0a0', X(-0.18), 2.15, Z(-6.3), 0.08, 0.1, 0.08, { emissive: '#ffd080', emissiveIntensity: 2, cast: false });
  const porchLight = new THREE.PointLight('#ffd8a0', 5, 7, 1.8); porchLight.position.set(X(-1.2), fl + 2.4, Z(-6.0)); group.add(porchLight);
  B(group, '#4a4a46', 5.9, 0, 97.6, 0.1, 1.0, 0.1); B(group, '#b13c2b', 5.9, 1.0, 97.6, 0.34, 0.26, 0.5);

  // ------------------------------------------------------------------ Driveway pad in front of the house
  const padTop = Math.max(height(6, 100), height(14, 100), height(6, 108), height(14, 108)) + 0.05;
  const pad = new THREE.Mesh(boxGeo, mat('#9a968a', { roughness: 0.95 })); pad.scale.set(9.2, 0.3, 9.6); pad.position.set(10.4, padTop - 0.15, 103.9); pad.receiveShadow = true; group.add(pad);
  // Stepping path from the pad to the porch.
  B(group, '#b9b3a0', X(-5.8), -1.0, Z(-4.5), 4.8, 1.04, 1.4);
  group.userData.padTop = padTop;

  // Walls are also hidden by camera side while the player is indoors.
  const bounds = { front: cx - hx, back: cx + hx, north: cz - hz, south: cz + hz };
  const home = {
    group, fl, padTop, lights, bounds, seats, interactables,
    slots: { player: { x: 9.1, z: 101.2, angle: -Math.PI / 2 }, other: { x: 9.1, z: 105.2, angle: -Math.PI / 2 }, scooter: { x: 13.6, z: 108.6, yaw: 0.9 } },
    // Walkable surface inside the cottage and on the porch (null elsewhere).
    floorAt(x, z) {
      if (x > cx - hx - 3.2 && x < cx + hx && z > cz - hz && z < cz + hz) {
        if (x > cx - hx - 0.1 || (z > cz - 7.1 && z < cz - 1.9 && x > cx - hx - 3.2)) return fl;
      }
      return null;
    },
    inside(x, z) { return x > cx - hx + 0.12 && x < cx + hx - 0.12 && z > cz - hz + 0.12 && z < cz + hz - 0.12; },
    near(x, z, r = 90) { return Math.abs(x - cx) < r && Math.abs(z - cz) < r; },
    // Roof and ceiling come off while you are indoors; walls between the camera and you drop away.
    update(px, pz, camX, camZ, indoors) {
      ceilingGroup.visible = !indoors; roofGroup.visible = !indoors;
      walls.front.visible = !(indoors && camX < bounds.front + 0.15);
      walls.back.visible = !(indoors && camX > bounds.back - 0.15);
      walls.north.visible = !(indoors && camZ < bounds.north + 0.15);
      walls.south.visible = !(indoors && camZ > bounds.south - 0.15);
      tv.material.emissiveIntensity = 0.9 + Math.sin(performance.now() * 0.004) * 0.15 + Math.sin(performance.now() * 0.0013) * 0.1;
    }
  };
  return home;
}
