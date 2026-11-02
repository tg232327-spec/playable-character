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
const STEP = 1 / 60;

export function createRagdolls({ height, colliders, floor = height }) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }); world.timestep = STEP;
  const map = new Map(); let acc = 0;
  const UP = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), pq = new THREE.Quaternion();

  function groundAround(x, z) {
    const N = 24, S = 1, ox = x - N * S / 2, oz = z - N * S / 2, verts = [], idx = [];
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) { const px = ox + i * S, pz = oz + j * S; verts.push(px, floor(px, pz), pz); }
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const a = i * (N + 1) + j, b = a + N + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    const out = [world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(verts), new Uint32Array(idx)).setFriction(.9))];
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
    for (const [name, bn, cn, r, parent] of PARTS) {
      const B = model.getObjectByName(bn); if (!B) continue;
      const P = parent ? rec.parts.find(p => p.name === parent) : null; if (parent && !P) continue;
      const a = B.getWorldPosition(new THREE.Vector3());
      const C = cn ? model.getObjectByName(cn) : null;
      const b = C ? C.getWorldPosition(new THREE.Vector3()) : a.clone().add(a.clone().sub(P.a).normalize().multiplyScalar(.24));
      const dir = b.clone().sub(a); let len = dir.length(); if (len < .06) { dir.set(0, 1, 0); len = .06; } dir.normalize();
      const bq = new THREE.Quaternion().setFromUnitVectors(UP, dir), mid = a.clone().add(b).multiplyScalar(.5);
      const spin = (Math.random() - .5) * 3;
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(mid.x, mid.y, mid.z).setRotation(bq)
        .setLinvel(vel.x, vel.y, vel.z).setAngvel({ x: spin, y: spin * .5, z: -spin }).setLinearDamping(.12).setAngularDamping(1.4).setCcdEnabled(true));
      world.createCollider(RAPIER.ColliderDesc.capsule(Math.max(.01, len / 2 - r * .6), r).setDensity(950).setFriction(.85).setRestitution(.05).setCollisionGroups(GROUP_PART), body);
      const inv = bq.clone().invert();
      const part = { name, bone: B, body, a, offset: inv.clone().multiply(B.getWorldQuaternion(new THREE.Quaternion())), local: a.clone().sub(mid).applyQuaternion(inv) };
      if (P) {
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

  function update(dt) {
    if (!map.size) { acc = 0; return; }
    acc += Math.min(dt, .1); let n = 0; while (acc >= STEP && n < 4) { world.step(); acc -= STEP; n++; }
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
