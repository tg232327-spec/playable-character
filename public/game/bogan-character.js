import * as THREE from 'three';
import { GLTFLoader } from './addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from './addons/utils/SkeletonUtils.js';

// Quaternius "Universal Base Characters" male body (CC0) dressed as an Aussie bogan with a shader:
// the skin texture stays underneath, a singlet / tee, stubbies and thongs are painted on by body region,
// so the whole figure is one continuous skinned mesh and every joint stays connected.
const BASE = 'models/bogan/';
const TORSO = /^(pelvis|spine_0[123]|clavicle)$/, ARM = /^(upperarm|lowerarm|hand|thumb|index|middle|ring|pinky)/, LEG = /^(thigh|calf)/, FOOT = /^(foot|ball)/;

export const PALETTES = {
  player: { top: '#2b5ea8', topDark: '#1f4684', shorts: '#1f2a44', trim: '#c9a640', thong: '#e1b82d', tee: 0, hair: '#6a4a2a', beard: 1, hairStyle: 'hair_simpleparted' },
};
export const NPC_PALETTES = [
  { top: '#d9d3c3', shorts: '#3b4f6b', trim: '#c9c9c9', thong: '#4a90c2', tee: 1, hair: '#2d2218', beard: 0, hairStyle: 'hair_buzzed' },
  { top: '#c8512b', shorts: '#2d3a2e', trim: '#d8d2c0', thong: '#d9d9d9', tee: 1, hair: '#8a6a3a', beard: 1, hairStyle: 'hair_simpleparted' },
  { top: '#e3c43c', shorts: '#2b2f3a', trim: '#e9e6da', thong: '#222', tee: 0, hair: '#a58452', beard: 0, hairStyle: 'hair_buzzed' },
  { top: '#3f7a52', shorts: '#4e5c3c', trim: '#c9a640', thong: '#d9a62c', tee: 1, hair: '#1d1712', beard: 1, hairStyle: 'hair_long' },
  { top: '#7b3b87', shorts: '#2a2a33', trim: '#e9e6da', thong: '#b53a3a', tee: 0, hair: '#5a3f26', beard: 0, hairStyle: 'hair_simpleparted' },
  { top: '#b8242a', shorts: '#1d2a44', trim: '#e9e6da', thong: '#e1b82d', tee: 0, hair: '#3d2a1a', beard: 1, hairStyle: 'hair_buzzed' },
];

function dress(material, pal, H) {
  const col = n => new THREE.Color(n);
  const U = { uTop: { value: col(pal.top) }, uTopDark: { value: col(pal.topDark || pal.top) }, uShorts: { value: col(pal.shorts) }, uTrim: { value: col(pal.trim) }, uThong: { value: col(pal.thong) }, uTee: { value: pal.tee || 0 }, uH: { value: H } };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aReg;\nvarying vec4 vReg;\nvarying vec3 vBind;\nuniform float uH;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      vReg=aReg;vBind=position;
      // V11: baggy fit — the shirt and shorts billow off the skin instead of being vacuum-packed.
      {
        float yf0=position.y/uH;
        float bag=aReg.x*.045 + aReg.y*.03*step(.5,yf0) + aReg.z*.028*step(.33,yf0)*step(yf0,.6);
        bag*=step(.3,yf0)*step(yf0,.92);
        transformed+=objectNormal*bag;
      }`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vReg;\nvarying vec3 vBind;\nuniform vec3 uTop,uTopDark,uShorts,uTrim,uThong;uniform float uTee,uH;')
      .replace('#include <map_fragment>', `#include <map_fragment>
      {
        float yf=vBind.y/uH, ax=abs(vBind.x)/uH, zf=vBind.z/uH;
        float lum=dot(diffuseColor.rgb,vec3(.30,.59,.11));
        float torso=step(.5,vReg.x), arm=step(.5,vReg.y), leg=step(.5,vReg.z), foot=step(.5,vReg.w);
        // singlet: torso between the waistband and a scooped neckline, armholes cut in at the shoulders
        float edge=mix(mix(.105,.058,smoothstep(.68,.76,yf)),.215,uTee);
        float top=mix(.775,.845,smoothstep(.03,.052,ax));
        top=mix(top,.82,step(zf,-.012)*.0);
        top=mix(top,.83,uTee);
        float singlet=torso*step(.578,yf)*step(yf,top)*step(ax,edge);
        // tee sleeves
        float sleeve=arm*uTee*step(.66,yf)*step(ax,.205);
        float shirt=max(singlet,sleeve*step(.5,uTee));
        // boardies: waist to just above the knee, good and loose
        float shorts=max(step(yf,.60)*step(.33,yf)*torso, leg*step(.33,yf)*step(yf,.60))*(1.-shirt);
        float hem=step(abs(yf-.332),.006)*shorts;
        float band=step(.585,yf)*shorts;
        vec3 tone=vec3(.40+lum*1.25);
        vec3 shirtCol=mix(uTop,uTopDark,smoothstep(.69,.62,yf)*.0)*tone;
        float stripe=step(.5,fract(yf*26.))*step(.72,yf)*(1.-uTee)*.0;
        diffuseColor.rgb=mix(diffuseColor.rgb,shirtCol,shirt);
        diffuseColor.rgb=mix(diffuseColor.rgb,uShorts*(.5+lum*.9),shorts);
        diffuseColor.rgb=mix(diffuseColor.rgb,uTrim*(.6+lum*.6),max(hem,band*.0));
        // thongs: yellow sole under the foot, dark strap bar over the instep
        float sole=foot*step(vBind.y,.028*uH/1.8+.012);
        diffuseColor.rgb=mix(diffuseColor.rgb,uThong*(.7+lum*.5),sole);
      }`);
  };
  const _key = 'bogan-dress-' + [pal.top, pal.shorts, pal.trim, pal.thong, pal.tee].join('-'); material.customProgramCacheKey = () => _key;
  return material;
}

function regionAttr(mesh) {
  const g = mesh.geometry, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, names = mesh.skeleton.bones.map(b => b.name);
  const reg = new Float32Array(g.attributes.position.count * 4);
  for (let i = 0; i < g.attributes.position.count; i++) {
    let best = 0, bw = -1;
    for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
    const n = (names[best] || '').replace(/_[lr]$/, '');
    // vertices mostly weighted to the neck/head or clavicle stay skin; torso blends keep the singlet under the collar
    if (TORSO.test(n)) reg[i * 4] = 1; else if (ARM.test(n)) reg[i * 4 + 1] = 1; else if (LEG.test(n)) reg[i * 4 + 2] = 1; else if (FOOT.test(n)) reg[i * 4 + 3] = 1;
  }
  g.setAttribute('aReg', new THREE.BufferAttribute(reg, 4));
}

let cached = null;
export async function loadBogan() {
  if (cached) return cached;
  const loader = new GLTFLoader();
  const [body, anims, ...hairs] = await Promise.all([
    loader.loadAsync(BASE + 'body.gltf'),
    fetch(BASE + 'anims.json').then(r => r.json()),
    ...['hair_simpleparted', 'hair_buzzed', 'hair_long', 'hair_beard', 'eyebrows_regular'].map(n => loader.loadAsync(BASE + n + '.gltf').then(g => [n, g])),
  ]);
  const model = body.scene;
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const H = box.max.y - box.min.y;
  let skinned = null;
  model.traverse(o => { if (o.isSkinnedMesh && (!skinned || o.geometry.attributes.position.count > skinned.geometry.attributes.position.count)) skinned = o; });
  const hairParts = {};
  for (const [n, g] of hairs) { let m = null; g.scene.traverse(o => { if (o.isSkinnedMesh) m = o; }); hairParts[n] = m; }
  const clips = {};
  for (const [name, c] of Object.entries(anims)) {
    const tracks = c.tracks.map(t => t.p === 'rotation' ? new THREE.QuaternionKeyframeTrack(t.n + '.quaternion', t.t, t.v) : new THREE.VectorKeyframeTrack(t.n + '.position', t.t, t.v));
    clips[name] = new THREE.AnimationClip(name, c.duration, tracks);
  }
  cached = { model, H, box, skinned, hairParts, clips };
  return cached;
}

// Builds a dressed instance (own materials) from the loaded template.
export function buildBogan(asset, pal = PALETTES.player, opts = {}) {
  const root = cloneSkeleton(asset.model);
  let body = null, bodyArea = 0;
  root.traverse(o => {
    if (!o.isSkinnedMesh) return;
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    const n = o.geometry.attributes.position.count;
    if (n > bodyArea) { bodyArea = n; body = o; }
  });
  if (!body.geometry.attributes.aReg) regionAttr(body);
  body.material = dress(body.material.clone(), pal, asset.H);
  body.material.roughness = .85;
  root.traverse(o => {
    if (!o.isSkinnedMesh || o === body) return;
    // eyes / brows from the base mesh
    if (/brow/i.test(o.name)) { o.material = o.material.clone(); o.material.color = new THREE.Color(pal.hair).multiplyScalar(.7); }
  });
  // hair and beard meshes re-bound to this body's skeleton
  const addHair = (key, color) => {
    const src = asset.hairParts[key]; if (!src) return;
    const m = new THREE.SkinnedMesh(src.geometry, src.material.clone());
    m.material.color = new THREE.Color(color); m.material.side = THREE.DoubleSide; m.frustumCulled = false; m.castShadow = true;
    m.name = key; root.add(m); m.bind(body.skeleton, body.bindMatrix);
  };
  addHair(pal.hairStyle || 'hair_buzzed', pal.hair);
  if (pal.beard) addHair('hair_beard', new THREE.Color(pal.hair).multiplyScalar(.85));
  addHair('eyebrows_regular', new THREE.Color(pal.hair).multiplyScalar(.7));
  // V11: the player gets a proper mullet (business up front, party out back) and sunnies.
  if (opts.mullet) {
    const head = root.getObjectByName('Head');
    if (head) {
      root.updateMatrixWorld(true);
      const hairCol = new THREE.Color(pal.hair).multiplyScalar(.92);
      const mat = new THREE.MeshStandardMaterial({ color: hairCol, roughness: .95, side: THREE.DoubleSide });
      // nape curtain: narrow at the skull, flaring onto the shoulder blades
      const mullet = new THREE.Mesh(new THREE.CylinderGeometry(.045, .105, .3, 7, 1), mat);
      const hw = head.getWorldPosition(new THREE.Vector3());
      mullet.position.copy(head.worldToLocal(hw.clone().add(new THREE.Vector3(0, .035, -.095))));
      mullet.rotation.x = .22;
      mullet.castShadow = true;
      head.add(mullet);
    }
  }
  if (opts.sunnies) {
    const head = root.getObjectByName('Head');
    if (head) {
      root.updateMatrixWorld(true);
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0x101216, roughness: .12, metalness: .5 });
      const lensGeo = new THREE.BoxGeometry(.05, .032, .013);
      const L = new THREE.Mesh(lensGeo, mat); L.position.x = -.033;
      const R = new THREE.Mesh(lensGeo, mat); R.position.x = .033;
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(.018, .007, .01), mat);
      const armGeo = new THREE.BoxGeometry(.009, .007, .075);
      const a1 = new THREE.Mesh(armGeo, mat); a1.position.set(-.058, .008, -.038); a1.rotation.y = .5;
      const a2 = new THREE.Mesh(armGeo, mat); a2.position.set(.058, .008, -.038); a2.rotation.y = -.5;
      g.add(L, R, bridge, a1, a2);
      const hw = head.getWorldPosition(new THREE.Vector3());
      g.position.copy(head.worldToLocal(hw.clone().add(new THREE.Vector3(0, .075, .072))));
      head.add(g);
    }
  }
  return { root, body };
}
