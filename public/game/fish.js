// V11 sea life: Quaternius Animated Fish Pack (CC0) — dolphins that hunt in threes and
// porpoise through the surface, a cruising whale, a gliding mantaray, a patrolling
// shark, schooling reef fish and coral on the shallows. Better swimming means there
// is finally something down there worth looking at.
import * as THREE from 'three';

const MODELS = {
  dolphin: { file: 'models/fish/dolphin.json', scale: .24, bend: .22, freq: 4.2, len: 9.3, head: -4.2 },
  whale: { file: 'models/fish/whale.json', scale: .55, bend: .3, freq: 1.1, len: 10.2, head: -3.5 },
  mantaray: { file: 'models/fish/mantaray.json', scale: .22, bend: .35, freq: 1.6, len: 11.7, head: -2.6 },
  shark: { file: 'models/fish/shark.json', scale: .3, bend: .16, freq: 2.6, len: 9.9, head: -4.7 },
  fish1: { file: 'models/fish/fish1.json', scale: .1, bend: .3, freq: 7, len: 8, head: -3 },
  fish2: { file: 'models/fish/fish2.json', scale: .1, bend: .3, freq: 6.2, len: 9.9, head: -3.3 },
  fish3: { file: 'models/fish/fish3.json', scale: .1, bend: .3, freq: 7.6, len: 7.9, head: -3.1 },
};

async function loadFish(name) {
  const spec = MODELS[name];
  const data = await (await fetch(spec.file)).json();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
  if (data.colors) g.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
  g.setIndex(data.indices);
  g.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .55, metalness: .05, side: THREE.DoubleSide });
  // tail wag: a travelling wave down the spine, phase seeded by world position so a school never wag in sync.
  mat.userData.uTime = { value: 0 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = mat.userData.uTime;
    sh.vertexShader = `
      uniform float uTime;
      float wagPhase(vec3 wp){ return wp.x*.37 + wp.z*.29; }
    ` + sh.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vec4 wpos = modelMatrix * vec4(transformed, 1.0);
      float along = clamp((position.y - (${spec.head.toFixed(2)})) / ${spec.len.toFixed(2)}, 0.0, 1.0);
      transformed.x += sin(uTime * ${spec.freq.toFixed(2)} + position.y * 1.1 + wagPhase(wpos)) * ${spec.bend.toFixed(2)} * along * along;
    `);
  };
  return { geo: g, mat, spec, name };
}

function makeCreature(loaded, x, z, y) {
  const mesh = new THREE.Mesh(loaded.geo, loaded.mat);
  mesh.scale.setScalar(loaded.spec.scale);
  mesh.rotation.x = -Math.PI / 2; // model +y (spine) -> -z forward, model +z -> up
  const group = new THREE.Group();
  group.add(mesh);
  group.position.set(x, y, z);
  group.rotation.order = 'YXZ';
  return { group, mesh };
}

// simple looping wander: a centre, a radius, a speed — with a gentle vertical bob.
function wanderStep(c, t, dt) {
  const a = c.phase + t * c.speed;
  const x = c.cx + Math.cos(a) * c.rx + Math.sin(a * .61 + c.phase) * c.rx * .3;
  const z = c.cz + Math.sin(a) * c.rz;
  return { x, z, a };
}

export async function createSeaLife({ scene, ocean, height, rand }) {
  const entries = [];
  for (const name in MODELS) entries.push(await loadFish(name));
  const by = Object.fromEntries(entries.map(e => [e.name, e]));

  const creatures = [];

  // Three dolphins hunt together on a big loop through the bay — Lez, Sassy and Clarence would approve.
  const dolphinPod = [];
  for (let i = 0; i < 3; i++) {
    const c = makeCreature(by.dolphin, 200 + i * 8, -100 + i * 30, -3);
    scene.add(c.group);
    dolphinPod.push({ ...c, phase: i * 2.1, prevY: -3, prevAbove: false });
  }
  // whale far out, mantaray over the shallows, shark on patrol
  const whale = makeCreature(by.whale, 420, 300, -6); scene.add(whale.group);
  const ray = makeCreature(by.mantaray, 170, 250, -2.2); scene.add(ray.group);
  const shark = makeCreature(by.shark, 300, -350, -5); scene.add(shark.group);

  // schooling fish: five loose schools over the reef shallows
  const schools = [];
  for (let s = 0; s < 5; s++) {
    const sp = by['fish' + (1 + (s % 3))];
    const cx = 125 + rand() * 120, cz = -350 + rand() * 600;
    const members = [];
    for (let i = 0; i < 10; i++) {
      const m = makeCreature(sp, cx, cz, -1.2);
      scene.add(m.group);
      members.push({ ...m, ox: (rand() - .5) * 6, oz: (rand() - .5) * 6, phase: rand() * 6.28 });
    }
    schools.push({ cx, cz, members, drift: rand() * 6.28, sp });
  }

  // coral and rocks on the shallows — fans, brains and bommies in reef colours.
  const coralGroup = new THREE.Group(); scene.add(coralGroup);
  const coralMats = [0xe08d7a, 0xd9a05b, 0xb07bc4, 0x6fb3a8, 0xc46a5a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .9 }));
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6b675c, roughness: 1 });
  const coralGeo = new THREE.CylinderGeometry(.04, .16, 1, 5);
  const rockGeo = new THREE.IcosahedronGeometry(.5, 1);
  let placed = 0, tries = 0;
  while (placed < 46 && tries++ < 900) {
    const x = 108 + rand() * 170, z = -560 + rand() * 1050;
    const bed = height(x, z), surf = ocean.height(x, z);
    if (bed < -4 || surf - bed > 3.4 || surf - bed < .5) continue;
    if (rand() < .3) {
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(x, bed + .15, z);
      rock.scale.set(.6 + rand() * 1.6, .4 + rand() * .9, .6 + rand() * 1.6);
      rock.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      coralGroup.add(rock);
    } else {
      const coral = new THREE.Group();
      const n = 3 + Math.floor(rand() * 4);
      for (let i = 0; i < n; i++) {
        const branch = new THREE.Mesh(coralGeo, coralMats[Math.floor(rand() * coralMats.length)]);
        const a = rand() * 6.28, r = rand() * .3;
        branch.position.set(Math.cos(a) * r, .45, Math.sin(a) * r);
        branch.scale.set(.7, .8 + rand() * 1.1, .7);
        branch.rotation.set((rand() - .5) * .9, rand() * 6.28, (rand() - .5) * .9);
        coral.add(branch);
      }
      coral.position.set(x, bed, z);
      coral.scale.setScalar(.8 + rand() * 1.3);
      coralGroup.add(coral);
    }
    placed++;
  }

  function update(dt, t, px, pz) {
    for (const e of entries) e.mat.userData.uTime.value = t;
    const vis = (x, z, r = 160) => Math.hypot(x - px, z - pz) < r;

    // dolphin pod: a shared wandering loop, staggered; each porpoises on its own clock.
    for (const d of dolphinPod) {
      const w = wanderStep({ cx: 240, cz: -60, rx: 150, rz: 220, speed: .045, phase: d.phase }, t, dt);
      const porp = Math.sin(t * .55 + d.phase * 3);
      const target = porp > .45 ? ocean.height(w.x, w.z) + (porp - .45) * 6.5 : Math.max(-6, height(w.x, w.z) + 1.2);
      d.group.position.x = w.x; d.group.position.z = w.z;
      d.group.position.y += (target - d.group.position.y) * Math.min(1, dt * 2.2);
      // heading and pitch from motion
      const dx = w.x - (d.px !== undefined ? d.px : w.x), dz = w.z - (d.pz !== undefined ? d.pz : w.z);
      const dy = d.group.position.y - (d.py !== undefined ? d.py : d.group.position.y);
      d.px = w.x; d.pz = w.z; d.py = d.group.position.y;
      if (Math.hypot(dx, dz) > 1e-4) d.group.rotation.y = Math.atan2(-dx, -dz);
      d.group.rotation.x = THREE.MathUtils.clamp(-Math.atan2(dy, Math.hypot(dx, dz) + .01) * .8, -.9, .9);
      d.group.visible = vis(w.x, w.z, 220);
      // splash on breaching and diving back under
      const surf = ocean.height(w.x, w.z), above = d.group.position.y > surf - .35;
      if (above !== d.prevAbove) ocean.splash(w.x, w.z, 1.2);
      d.prevAbove = above;
    }

    // whale: slow lap far out
    {
      const w = wanderStep({ cx: 430, cz: 150, rx: 120, rz: 200, speed: .018, phase: 1.7 }, t, dt);
      whale.group.position.set(w.x, Math.max(-8, height(w.x, w.z) + 2.5), w.z);
      const dx = w.x - whale.px, dz = w.z - whale.pz; whale.px = w.x; whale.pz = w.z;
      if (Math.hypot(dx, dz) > 1e-4) whale.group.rotation.y = Math.atan2(-dx, -dz);
      whale.group.visible = vis(w.x, w.z, 500);
    }
    // mantaray: gliding figure-eights over the shallows
    {
      const a = t * .05;
      const x = 175 + Math.sin(a) * 60, z = 260 + Math.sin(a * 2) * 90;
      ray.group.position.set(x, Math.max(-3.5, height(x, z) + 1), z);
      const dx = Math.cos(a) * 60, dz = Math.cos(a * 2) * 180;
      ray.group.rotation.y = Math.atan2(-dx, -dz);
      ray.group.visible = vis(x, z, 220);
    }
    // shark: patrol lap, deeper
    {
      const w = wanderStep({ cx: 300, cz: -300, rx: 110, rz: 260, speed: .03, phase: 4 }, t, dt);
      shark.group.position.set(w.x, Math.max(-6.5, height(w.x, w.z) + 1.5), w.z);
      const dx = w.x - shark.px, dz = w.z - shark.pz; shark.px = w.x; shark.pz = w.z;
      if (Math.hypot(dx, dz) > 1e-4) shark.group.rotation.y = Math.atan2(-dx, -dz);
      shark.group.visible = vis(w.x, w.z, 260);
    }
    // schools: drift around a moving centre, each member offset with its own bob
    for (const s of schools) {
      s.drift += dt * .1;
      const cx = s.cx + Math.sin(s.drift) * 25, cz = s.cz + Math.cos(s.drift * .8) * 35;
      for (const m of s.members) {
        const bx = cx + m.ox + Math.sin(t * 1.3 + m.phase) * 1.5;
        const bz = cz + m.oz + Math.cos(t * 1.1 + m.phase) * 1.5;
        const bed = height(bx, bz), surf = ocean.height(bx, bz);
        const target = Math.max(bed + .8, Math.min(surf - .8, -1.4 + Math.sin(t * .8 + m.phase) * .8));
        m.group.position.x = bx; m.group.position.z = bz;
        m.group.position.y += (target - m.group.position.y) * Math.min(1, dt * 3);
        const dx = Math.sin(t * 1.3 + m.phase), dz = Math.cos(t * 1.1 + m.phase);
        m.group.rotation.y = Math.atan2(-dx, -dz);
        m.group.visible = vis(bx, bz, 130);
      }
    }
  }
  return { update };
}
