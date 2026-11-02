// V11 nature: downloaded Australian models replace the procedural bush.
// Bloodwood (Corymbia, Poly by Google via poly.pizza, CC-BY 3.0) and Acacia
// (wattle) instanced across the map. No more procedural shrubs or gum trees.
import * as THREE from 'three';

export function collectNature({ rand }) {
  const spots = [];
  return {
    addTree(x, z, s = 1) { spots.push({ x, z, s: s * (.9 + rand() * .2), r: rand() * Math.PI * 2, species: rand() < .68 ? 0 : 1 }); },
    spots
  };
}

function buildGeometry(part) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(part.positions, 3));
  if (part.normals) g.setAttribute('normal', new THREE.Float32BufferAttribute(part.normals, 3));
  else g.computeVertexNormals();
  if (part.uvs) g.setAttribute('uv', new THREE.Float32BufferAttribute(part.uvs, 2));
  g.setIndex(part.indices);
  return g;
}

function loadTexture(dataUrl) {
  return new Promise((res, rej) => {
    new THREE.TextureLoader().load(dataUrl, t => {
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; res(t);
    }, undefined, rej);
  });
}

export async function spawnNature(scene, spots, { height, colliders, onPlaced }) {
  const files = ['models/props/bloodwood.json', 'models/props/acacia.json'];
  const species = await Promise.all(files.map(async f => {
    const data = await (await fetch(f)).json();
    const group = { meshes: [] };
    for (const part of data.parts) {
      const geo = buildGeometry(part);
      const mat = new THREE.MeshStandardMaterial({ roughness: .95, metalness: 0 });
      if (part.texture) { mat.map = await loadTexture(part.texture); }
      else { mat.color.setRGB(part.color[0], part.color[1], part.color[2]); }
      group.meshes.push({ geo, mat });
    }
    // bake the parts into one merged array of meshes; all parts share instance transforms
    return group;
  }));
  const dummy = new THREE.Object3D();
  for (let si = 0; si < 2; si++) {
    const list = spots.filter(s => s.species === si);
    if (!list.length || !species[si]) continue;
    for (const { geo, mat } of species[si].meshes) {
      const inst = new THREE.InstancedMesh(geo, mat, list.length);
      inst.castShadow = true; inst.receiveShadow = true;
      list.forEach((s, i) => {
        dummy.position.set(s.x, height(s.x, s.z) - .1, s.z);
        dummy.rotation.set(0, s.r, 0);
        const k = s.s;
        dummy.scale.set(k, k * (0.92 + (i % 7) * .03), k);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      });
      inst.instanceMatrix.needsUpdate = true;
      scene.add(inst);
    }
    list.forEach(s => {
      const r = .45 * s.s;
      colliders.push({ x: s.x, z: s.z, w: r, d: r, h: 5 * s.s, kind: 'tree trunk' });
    });
    if (onPlaced) onPlaced(list.length);
  }
}
