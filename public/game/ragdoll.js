import * as THREE from 'three';
import RAPIER from './rapier.es.js';
import './vehicle-physics.js'; // initialises the Rapier WASM once; never call RAPIER.init() twice.

// Rapier ragdolls for the shared Quaternius rig (player + NPCs). Runs in its own physics world so
// the floppy bodies never disturb car handling. Each ragdoll brings a small terrain patch and the
// nearby building boxes; bones are written in world space from the capsule bodies every frame.
// [part, bone, child bone (segment end), radius, parent part]
const PARTS = [
  ['pelvis', 'pelvis', 'spine_02', .14, null],
  ['chest', 'spine_03', 'neck_01', .16, 'pelvis'],
  ['head', 'Head', null, .12, 'chest'],
  ['uarmL', 'upperarm_l', 'lowerarm_l', .06, 'chest'], ['farmL', 'lowerarm_l', 'hand_l', .05, 'uarmL'],
  ['uarmR', 'upperarm_r', 'lowerarm_r', .06, 'chest'], ['farmR', 'lowerarm_r', 'hand_r', .05, 'uarmR'],
  ['thighL', 'thigh_l', 'calf_l', .08, 'pelvis'], ['calfL', 'calf_l', 'foot_l', .065, 'thighL'],
  ['thighR', 'thigh_r', 'calf_r', .08, 'pelvis'], ['calfR', 'calf_r', 'foot_r', .065, 'thighR'],
];
const GROUP_PART = (0x0002 << 16) | 0x0001; // parts hit the world only, never each other
const STEP = 1 / 120;
// Muscle tone: each joint is sprung back toward the pose the body had when it went limp,
// so people fold and tumble instead of collapsing into a heap.
const TONE = { k: 160, c: 14 }, LIFT = .09, RADIUS = 1.35;

export function createRagdolls({ height, colliders, floor = height }) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }); world.timestep = STEP; world.integrationParameters.numSolverIterations = 8;
  const map = new Map(); let acc = 0;
  const UP = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), pq = new THREE.Quaternion();

  function groundAround(x, z) {
    const N = 24, S = 1, ox = x - N * S / 2, oz = z - N * S / 2, verts = [], idx = [];
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) { const px = ox + i * S, pz = oz + j * S; verts.push(px, floor(px, pz) + LIFT, pz); }
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const a = i * (N + 1) + j, b = a + N + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    const out = [world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(verts), new Uint32Array(idx)).setFriction(.9))];
    // Backstop slabs per 4m cell, sitting just under the lowest corner, catch anything that slips through.
    for (let i = 0; i < N; i += 4) for (let j = 0; j < N; j += 4) {
      let lo = Infinity; for (let a = 0; a <= 4; a++) for (let b = 0; b <= 4; b++) lo = Math.min(lo, verts[((i + a) * (N + 1) + (j + b)) * 3 + 1]);
      out.push(world.createCollider(RAPIER.ColliderDesc.cuboid(2, 1, 2).setTranslation(ox + i + 2, lo - 1.02, oz + j + 2)));
    }
    for (const c of colliders) {
      if (Math.abs(c.x - x) > 14 || Math.abs(c.z - z) > 14) continue;
      const h = c.h ?? 4, y = height(c.x, c.z);
      out.push(world.createCollider(RAPIER.ColliderDesc.cuboid(c.w, h / 2, c.d).setTranslation(c.x, y + h / 2, c.z).setFriction(.7)));
    }
    return out;
  }

  function start(key, model, vel = { x: 0, y: 0, z: 0 }) {
    if (map.has(key)) { hit(key, vel); return true; }
    const pelvisBone = model.getObjectByName('pelvis'); if (!pelvisBone) return false;
    model.updateWorldMatrix(true, true);
    const c = pelvisBone.getWorldPosition(new THREE.Vector3());
    const rec = { model, parts: [], joints: [], ground: groundAround(c.x, c.z), restPelvis: pelvisBone.position.clone() };
    for (const [name, bn, cn, r0, parent] of PARTS) {
      const r = r0 * RADIUS;
      const B = model.getObjectByName(bn); if (!B) continue;
      const P = parent ? rec.parts.find(p => p.name === parent) : null; if (parent && !P) continue;
      const a = B.getWorldPosition(new THREE.Vector3());
      const C = cn ? model.getObjectByName(cn) : null;
      const b = C ? C.getWorldPosition(new THREE.Vector3()) : a.clone().add(a.clone().sub(P.a).normalize().multiplyScalar(.24));
      const dir = b.clone().sub(a); let len = dir.length(); if (len < .06) { dir.set(0, 1, 0); len = .06; } dir.normalize();
      const bq = new THREE.Quaternion().setFromUnitVectors(UP, dir), mid = a.clone().add(b).multiplyScalar(.5);
      const spin = (Math.random() - .5) * 3;
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(mid.x, mid.y, mid.z).setRotation(bq)
        .setLinvel(vel.x, vel.y, vel.z).setAngvel({ x: spin, y: spin * .5, z: -spin }).setLinearDamping(.08).setAngularDamping(.6).setCcdEnabled(true));
      world.createCollider(RAPIER.ColliderDesc.capsule(Math.max(.01, len / 2 - r * .6), r).setDensity(950).setFriction(.85).setRestitution(.05).setCollisionGroups(GROUP_PART), body);
      const inv = bq.clone().invert();
      const part = { name, bone: B, body, a, offset: inv.clone().multiply(B.getWorldQuaternion(new THREE.Quaternion())), local: a.clone().sub(mid).applyQuaternion(inv) };
      part.inertia = body.mass() * (len * len / 12 + r * r / 4) + .002;
      if (P) {
        const pr0 = P.body.rotation(); part.parent = P;
        part.rest = new THREE.Quaternion(pr0.x, pr0.y, pr0.z, pr0.w).invert().multiply(bq); // child relative to parent
        const pp = P.body.translation(), pr = P.body.rotation();
        const a1 = a.clone().sub(v.set(pp.x, pp.y, pp.z)).applyQuaternion(q.set(pr.x, pr.y, pr.z, pr.w).invert());
        rec.joints.push(world.createImpulseJoint(RAPIER.JointData.spherical({ x: a1.x, y: a1.y, z: a1.z }, { x: part.local.x, y: part.local.y, z: part.local.z }), P.body, body, true));
      }
      rec.parts.push(part);
    }
    map.set(key, rec); return true;
  }

  function hit(key, vel) {
    const rec = map.get(key); if (!rec) return;
    for (const p of rec.parts) { const l = p.body.linvel(); p.body.setLinvel({ x: l.x + vel.x, y: l.y + vel.y, z: l.z + vel.z }, true); }
  }
  function pos(key) { const rec = map.get(key); if (!rec) return null; const t = rec.parts[0].body.translation(); return { x: t.x, y: t.y, z: t.z }; }
  function release(key) {
    const rec = map.get(key); if (!rec) return null; const out = pos(key);
    for (const j of rec.joints) world.removeImpulseJoint(j, true);
    for (const p of rec.parts) world.removeRigidBody(p.body);
    for (const c of rec.ground) world.removeCollider(c, true);
    rec.parts[0].bone.position.copy(rec.restPelvis); map.delete(key); return out;
  }

  const mq = new THREE.Quaternion(), mq2 = new THREE.Quaternion(), mv = new THREE.Vector3();
  function muscles() {
    for (const rec of map.values()) for (const p of rec.parts) {
      if (!p.parent) continue;
      const a = p.parent.body.rotation(), b = p.body.rotation();
      mq.set(a.x, a.y, a.z, a.w).multiply(p.rest);             // desired child orientation
      mq2.set(b.x, b.y, b.z, b.w).invert(); mq.multiply(mq2);    // error = desired * current^-1
      if (mq.w < 0) { mq.x = -mq.x; mq.y = -mq.y; mq.z = -mq.z; mq.w = -mq.w; }
      const s = Math.sqrt(1 - Math.min(1, mq.w * mq.w)), ang = 2 * Math.acos(Math.min(1, mq.w));
      if (s > 1e-4) mv.set(mq.x / s * ang, mq.y / s * ang, mq.z / s * ang); else mv.set(0, 0, 0);
      const wa = p.parent.body.angvel(), wb = p.body.angvel();
      const I = Math.min(p.inertia, p.parent.inertia);
      const tx = (TONE.k * mv.x - TONE.c * (wb.x - wa.x)) * I * STEP, ty = (TONE.k * mv.y - TONE.c * (wb.y - wa.y)) * I * STEP, tz = (TONE.k * mv.z - TONE.c * (wb.z - wa.z)) * I * STEP;
      p.body.applyTorqueImpulse({ x: tx, y: ty, z: tz }, true);
      p.parent.body.applyTorqueImpulse({ x: -tx, y: -ty, z: -tz }, true);
    }
  }
  function update(dt) {
    if (!map.size) { acc = 0; return; }
    acc += Math.min(dt, .1); let n = 0; while (acc >= STEP && n < 8) { muscles(); world.step(); acc -= STEP; n++; }
    if (n === 8) acc = 0;
    for (const rec of map.values()) for (const p of rec.parts) {
      const t = p.body.translation(), r = p.body.rotation(); q.set(r.x, r.y, r.z, r.w);
      const wq = q2.copy(q).multiply(p.offset), parent = p.bone.parent;
      parent.getWorldQuaternion(pq);
      p.bone.quaternion.copy(pq.invert().multiply(wq));
      if (p.name === 'pelvis') { v.copy(p.local).applyQuaternion(q).add({ x: t.x, y: t.y, z: t.z }); p.bone.position.copy(parent.worldToLocal(v)); }
      p.bone.updateMatrixWorld(true);
    }
  }

  return { start, hit, pos, release, update, active: key => map.has(key), get count() { return map.size; } };
}
