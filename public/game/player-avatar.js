import * as THREE from 'three';
import { GLTFLoader } from './addons/loaders/GLTFLoader.js';

// Swaps the visible player for the user-supplied rigged GLB. The original Quaternius rig keeps
// running every animation (and owns hand_r for guns) but is hidden; each frame its pose is
// retargeted onto the GLB skeleton: trunk bones copy rotation deltas, limbs copy bone directions
// (the two rigs have different rest poses, so direction matching keeps arms out of the body).
const URL_GLB = 'models/player/hero.glb';

// target bone -> [source bone, mode, target child used for direction, source child]
const MAP = [
  ['_rootJoint', 'pelvis', 'delta'],
  ['Bone_01', 'spine_02', 'delta'],
  ['Bone003_00', 'spine_03', 'delta'],
  ['Bone004_010', 'neck_01', 'delta'],
  ['Bone019_011', 'Head', 'delta'],
  // side A chain (x < 0 at rest) and side B chain (x > 0)
  ['Bone014_04', 'upperarm_A', 'dir', 'Bone015_05', 'lowerarm_A'],
  ['Bone015_05', 'lowerarm_A', 'dir', 'Bone015_end_034', 'hand_A'],
  ['Bone017_08', 'upperarm_B', 'dir', 'Bone018_09', 'lowerarm_B'],
  ['Bone018_09', 'lowerarm_B', 'dir', 'Bone018_end_035', 'hand_B'],
  ['Bone008_023', 'thigh_A', 'dir', 'Bone009_024', 'calf_A'],
  ['Bone009_024', 'calf_A', 'dir', 'Bone009_end_044', 'foot_A'],
  ['Bone011_028', 'thigh_B', 'dir', 'Bone012_029', 'calf_B'],
  ['Bone012_029', 'calf_B', 'dir', 'Bone012_end_046', 'foot_B'],
];

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

export async function attachPlayerAvatar(group, srcRoot) {
  const gltf = await new GLTFLoader().loadAsync(URL_GLB);
  const tgtRoot = gltf.scene;
  tgtRoot.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });

  // hide the original body (meshes only; bones and hand-held props stay live)
  srcRoot.traverse(o => { if (o.isMesh && !o.userData.keepVisible) o.visible = false; });

  // the GLB faces the opposite way to the game's rig: turn it round (its x<0 chain then sits at x>0)
  tgtRoot.rotation.y = Math.PI;
  group.add(tgtRoot);
  group.updateMatrixWorld(true);

  // which source side sits at negative x in the rest pose
  const sx = n => srcRoot.getObjectByName(n).getWorldPosition(_v).applyMatrix4(_inv(group)).x;
  const negIsL = sx('upperarm_l') > sx('upperarm_r'); // flipped: target is rotated 180°
  const side = (n) => n.replace(/_A$/, negIsL ? '_l' : '_r').replace(/_B$/, negIsL ? '_r' : '_l');

  // scale so the head sits at the same height as the hidden rig's head
  const gInv = _inv(group);
  const srcHeadY = srcRoot.getObjectByName('Head').getWorldPosition(new THREE.Vector3()).applyMatrix4(gInv).y;
  const tgtHeadY = tgtRoot.getObjectByName('Bone019_011').getWorldPosition(new THREE.Vector3()).applyMatrix4(gInv).y;
  tgtRoot.scale.setScalar(srcHeadY / tgtHeadY);
  group.updateMatrixWorld(true);

  const groupQ = group.getWorldQuaternion(new THREE.Quaternion());
  const gQinv = groupQ.clone().invert();
  const links = MAP.map(([t, s, mode, tc, sc]) => {
    const T = tgtRoot.getObjectByName(t), S = srcRoot.getObjectByName(side(s));
    if (!T || !S) return null;
    const l = { T, S, mode };
    // the pelvis also carries translation (hip bob, and ragdolls flinging the body around)
    if (t === '_rootJoint') { const gi = _inv(group); l.sPos = S.getWorldPosition(new THREE.Vector3()).applyMatrix4(gi); l.tPos = T.getWorldPosition(new THREE.Vector3()).applyMatrix4(gi); }
    // rest orientations expressed in group space
    l.tRest = gQinv.clone().multiply(T.getWorldQuaternion(new THREE.Quaternion()));
    l.sRest = gQinv.clone().multiply(S.getWorldQuaternion(new THREE.Quaternion()));
    if (mode === 'dir') {
      l.TC = tgtRoot.getObjectByName(tc); l.SC = srcRoot.getObjectByName(side(sc));
      if (!l.TC || !l.SC) return null;
      l.tDir = l.TC.getWorldPosition(new THREE.Vector3()).sub(T.getWorldPosition(new THREE.Vector3())).applyQuaternion(gQinv).normalize();
    }
    return l;
  }).filter(Boolean);

  const retarget = () => {
    group.getWorldQuaternion(_q2);
    for (const l of links) {
      const desired = new THREE.Quaternion();
      if (l.mode === 'delta') {
        // delta (group space) = S_now * S_rest^-1
        _q.copy(_q2).invert().multiply(l.S.getWorldQuaternion(desired)).multiply(_q.clone().copy(l.sRest).invert());
        desired.copy(_q2).multiply(_q).multiply(l.tRest);
      } else {
        const d = l.SC.getWorldPosition(_v).sub(l.S.getWorldPosition(_v2)).normalize();
        const rest = l.tDir.clone().applyQuaternion(_q2);
        _q.setFromUnitVectors(rest, d);
        desired.copy(_q).multiply(_q2).multiply(l.tRest);
      }
      const parentQ = l.T.parent.getWorldQuaternion(new THREE.Quaternion());
      l.T.quaternion.copy(parentQ.invert().multiply(desired));
      if (l.sPos) {
        const gi = _inv(group), d = l.S.getWorldPosition(_v).applyMatrix4(gi).sub(l.sPos);
        const w = l.tPos.clone().add(d).applyMatrix4(group.matrixWorld);
        l.T.parent.updateWorldMatrix(true, false); l.T.position.copy(l.T.parent.worldToLocal(w));
      }
      l.T.updateMatrixWorld(true);
    }
  };

  // run after the scene graph (and therefore the animated source rig) is updated each frame
  const base = group.updateMatrixWorld.bind(group);
  group.updateMatrixWorld = function (force) { base(force); if (group.visible) retarget(); };
  return tgtRoot;
}

function _inv(o) { return new THREE.Matrix4().copy(o.matrixWorld).invert(); }
