// Bogan Bay ocean: one shared wave model on CPU and GPU, a live ripple/foam
// simulation around the player, spray particles and buoyant floating objects.
import * as THREE from 'three';

const G = 9.81;
export const SEA_LEVEL = -0.05;
const clamp = THREE.MathUtils.clamp;
const smooth = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Four swell trains travelling toward the beach (-x). Wavelengths are kept long
// enough for the 7.5 m sea mesh to resolve them; the small chop is shaded only.
// lo/hi describe how quickly the swell builds with distance offshore.
const WAVE_DEFS = [
  { L: 95, dir: Math.PI + 0.10, A: 0.34, lo: 95, hi: 260 },
  { L: 60, dir: 1.40, A: 0.16, lo: 95, hi: 260 },
  { L: 42, dir: Math.PI + 0.85, A: 0.055, lo: 95, hi: 260 },
  { L: 150, dir: Math.PI - 0.15, A: 0.42, lo: 170, hi: 520 }
];
const waves = WAVE_DEFS.map(d => {
  const k = 2 * Math.PI / d.L;
  return { k, w: Math.sqrt(G * k), dx: Math.cos(d.dir), dz: Math.sin(d.dir), A: d.A, lo: d.lo, hi: d.hi };
});
const env = (w, x) => 0.4 + 0.6 * smooth(x, w.lo, w.hi);

export function seaHeight(x, z, t) {
  let h = SEA_LEVEL;
  for (const w of waves) h += env(w, x) * w.A * Math.sin(w.k * (w.dx * x + w.dz * z) - w.w * t);
  return h;
}
// Surface gradient (dh/dx, dh/dz), ignoring the slowly varying envelope.
export function seaGradient(x, z, t, out = [0, 0]) {
  let gx = 0, gz = 0;
  for (const w of waves) {
    const c = env(w, x) * w.A * w.k * Math.cos(w.k * (w.dx * x + w.dz * z) - w.w * t);
    gx += c * w.dx; gz += c * w.dz;
  }
  out[0] = gx; out[1] = gz; return out;
}

const f = n => (Number.isInteger(n) ? n.toFixed(1) : String(+n.toFixed(6)));
const GLSL_WAVES = `
float seaH(vec2 p,float t){float h=${f(SEA_LEVEL)};
${waves.map(w => `h+=(.4+.6*smoothstep(${f(w.lo)},${f(w.hi)},p.x))*${f(w.A)}*sin(${f(w.k)}*(${f(w.dx)}*p.x+${f(w.dz)}*p.y)-${f(w.w)}*t);`).join('\n')}
return h;}
vec2 seaG(vec2 p,float t){vec2 g=vec2(0.);
${waves.map(w => `g+=(.4+.6*smoothstep(${f(w.lo)},${f(w.hi)},p.x))*${f(w.A * w.k)}*cos(${f(w.k)}*(${f(w.dx)}*p.x+${f(w.dz)}*p.y)-${f(w.w)}*t)*vec2(${f(w.dx)},${f(w.dz)});`).join('\n')}
return g;}
`;

// --- Ripple + foam simulation (2D wave equation on a toroidal grid) ---------
class Ripples {
  constructor(N = 128, cell = 0.6) {
    this.N = N; this.cell = cell; this.mask = N - 1;
    this.h = new Float32Array(N * N); this.v = new Float32Array(N * N); this.f = new Float32Array(N * N);
    this.data = new Float32Array(N * N * 2);
    this.tex = new THREE.DataTexture(this.data, N, N, THREE.RGFormat, THREE.FloatType);
    this.tex.wrapS = this.tex.wrapT = THREE.RepeatWrapping;
    this.tex.minFilter = this.tex.magFilter = THREE.NearestFilter;
    this.tex.needsUpdate = true;
    this.ci = 0; this.cj = 0; this.acc = 0;
    this.edge = new Float32Array(N);
    this.cols = new Float32Array(N); this.rows = new Float32Array(N);
  }
  clearColumn(i) { const { N } = this; for (let j = 0; j < N; j++) { const c = j * N + i; this.h[c] = this.v[c] = this.f[c] = 0; } }
  clearRow(j) { const { N } = this; for (let i = 0; i < N; i++) { const c = j * N + i; this.h[c] = this.v[c] = this.f[c] = 0; } }
  clearAll() { this.h.fill(0); this.v.fill(0); this.f.fill(0); }
  recenter(x, z) {
    const { N, mask } = this, ci = Math.floor(x / this.cell), cj = Math.floor(z / this.cell);
    const di = ci - this.ci, dj = cj - this.cj;
    if (Math.abs(di) >= N || Math.abs(dj) >= N) this.clearAll();
    else {
      for (let s = 0; s < Math.abs(di); s++) this.clearColumn((di > 0 ? this.ci + N / 2 + s : this.ci - N / 2 - 1 - s) & mask);
      for (let s = 0; s < Math.abs(dj); s++) this.clearRow((dj > 0 ? this.cj + N / 2 + s : this.cj - N / 2 - 1 - s) & mask);
    }
    this.ci = ci; this.cj = cj;
  }
  idx(x, z) { const { N, mask } = this; return (((Math.floor(z / this.cell)) & mask) * N) + ((Math.floor(x / this.cell)) & mask); }
  inside(x, z, margin = 4) {
    const half = this.N / 2 - margin, ci = Math.floor(x / this.cell), cj = Math.floor(z / this.cell);
    return Math.abs(ci - this.ci) < half && Math.abs(cj - this.cj) < half;
  }
  stamp(x, z, r, amount, target) {
    if (!this.inside(x, z, 2)) return;
    const { N, mask, cell } = this, rc = Math.ceil(r / cell) + 1, ci = Math.floor(x / cell), cj = Math.floor(z / cell);
    for (let dj = -rc; dj <= rc; dj++) for (let di = -rc; di <= rc; di++) {
      const px = (ci + di + 0.5) * cell - x, pz = (cj + dj + 0.5) * cell - z, d2 = (px * px + pz * pz) / (r * r);
      if (d2 > 1) continue;
      const fall = (1 - d2) * (1 - d2), c = ((cj + dj) & mask) * N + ((ci + di) & mask);
      target[c] += amount * fall;
    }
  }
  disturb(x, z, r, amount) { this.stamp(x, z, r, amount, this.h); }
  foam(x, z, r, amount) { this.stamp(x, z, r, amount, this.f); }
  sample(x, z) {
    if (!this.inside(x, z, 3)) return 0;
    const { N, mask, cell } = this, gx = x / cell - 0.5, gz = z / cell - 0.5, i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
    const a = this.h[(j & mask) * N + (i & mask)], b = this.h[(j & mask) * N + ((i + 1) & mask)];
    const c = this.h[((j + 1) & mask) * N + (i & mask)], d = this.h[((j + 1) & mask) * N + ((i + 1) & mask)];
    return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
  }
  step() {
    const { N, mask, h, v, f, data } = this, C2 = 0.13;
    // Soft sponge at the window edge so waves fade instead of wrapping.
    const half = N / 2;
    for (let i = 0; i < N; i++) {
      const rel = Math.abs((((i - this.ci + half) % N) + N) % N - half), rel2 = Math.abs((((i - this.cj + half) % N) + N) % N - half);
      this.cols[i] = 1 - 0.18 * smooth(rel, half - 20, half - 2); this.rows[i] = 1 - 0.18 * smooth(rel2, half - 20, half - 2);
    }
    for (let j = 0; j < N; j++) {
      const jn = ((j + 1) & mask) * N, jp = ((j - 1) & mask) * N, row = j * N, rd = this.rows[j];
      for (let i = 0; i < N; i++) {
        const c = row + i, lap = h[row + ((i + 1) & mask)] + h[row + ((i - 1) & mask)] + h[jn + i] + h[jp + i] - 4 * h[c];
        v[c] = (v[c] + lap * C2) * 0.9935 * this.cols[i] * rd;
      }
    }
    const foamDecay = Math.exp(-1 / 30 / 3.2);
    for (let c = 0; c < N * N; c++) {
      h[c] += v[c];
      let fo = f[c] * foamDecay; if (fo > 1.4) fo = 1.4; f[c] = fo < 0.002 ? 0 : fo;
      data[c * 2] = h[c]; data[c * 2 + 1] = f[c];
    }
    this.tex.needsUpdate = true;
  }
  update(dt, x, z) {
    this.recenter(x, z); this.acc += Math.min(dt, 0.1);
    let n = 0; while (this.acc >= 1 / 30 && n < 3) { this.acc -= 1 / 30; this.step(); n++; }
  }
}

// --- Spray particles ---------------------------------------------------------
class Spray {
  constructor(scene, N = 1200) {
    this.N = N; this.next = 0;
    this.pos = new Float32Array(N * 3); this.size = new Float32Array(N); this.alpha = new Float32Array(N);
    this.vel = new Float32Array(N * 3); this.life = new Float32Array(N); this.max = new Float32Array(N); this.s0 = new Float32Array(N); this.s1 = new Float32Array(N);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, uniforms: { scale: { value: 500 } },
      vertexShader: 'attribute float aSize;attribute float aAlpha;varying float vA;uniform float scale;void main(){vA=aAlpha;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=aSize*scale/max(.5,-mv.z);gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'varying float vA;void main(){float d=length(gl_PointCoord-.5)*2.;float a=smoothstep(1.,.25,d)*vA;if(a<.01)discard;gl_FragColor=vec4(vec3(.97,.93,.86),a);}'
    });
    this.points = new THREE.Points(this.geo, this.material);
    this.points.frustumCulled = false; this.points.renderOrder = 5; scene.add(this.points);
    for (let i = 0; i < N; i++) this.pos[i * 3 + 1] = -999;
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, a = 0.8) {
    const i = this.next; this.next = (this.next + 1) % this.N;
    this.pos.set([x, y, z], i * 3); this.vel.set([vx, vy, vz], i * 3);
    this.life[i] = this.max[i] = life; this.s0[i] = s0; this.s1[i] = s1; this.alpha[i] = a; this.size[i] = s0;
  }
  update(dt, surface, time) {
    for (let i = 0; i < this.N; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt;
      const o = i * 3, t = 1 - this.life[i] / this.max[i];
      this.vel[o + 1] -= 9.81 * dt * 0.9; this.vel[o] *= 1 - dt * 0.6; this.vel[o + 2] *= 1 - dt * 0.6;
      this.pos[o] += this.vel[o] * dt; this.pos[o + 1] += this.vel[o + 1] * dt; this.pos[o + 2] += this.vel[o + 2] * dt;
      const sy = surface(this.pos[o], this.pos[o + 2], time);
      if (this.pos[o + 1] < sy && this.vel[o + 1] < 0) this.life[i] = Math.min(this.life[i], 0.12);
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      this.alpha[i] = Math.max(0, Math.min(1, (1 - t) * 1.6)) * Math.min(1, this.life[i] * 6) * 0.85;
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.aSize.needsUpdate = true; this.geo.attributes.aAlpha.needsUpdate = true;
  }
}

export function createOcean({ scene, camera, renderer, bed }) {
  const ripples = new Ripples(128, 0.6);
  const bedGLSL = 'float bedH(float x){float t=clamp((x-68.)/42.,0.,1.);return 1.7-3.5*(t*t*(3.-2.*t));}';
  const material = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      time: { value: 0 }, ripple: { value: ripples.tex }, rippleCell: { value: ripples.cell }, rippleN: { value: ripples.N },
      focus: { value: new THREE.Vector2() }
    },
    vertexShader: `varying vec3 v;uniform float time;${GLSL_WAVES}
void main(){v=position;vec3 p=position;p.y=seaH(p.xz,time);v.y=p.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader: `varying vec3 v;uniform float time;uniform sampler2D ripple;uniform float rippleCell;uniform float rippleN;uniform vec2 focus;
${GLSL_WAVES}${bedGLSL}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
void main(){
 vec2 p=v.xz;float y=v.y;
 vec2 g=seaG(p,time);
 // Shaded-only chop: small waves too fine for the vertex mesh.
 g+=vec2(cos(p.x*.62+p.y*.31+time*2.1)*.016+cos(p.x*1.7-p.y*.9-time*2.9)*.009,cos(p.y*.74-p.x*.2+time*1.8)*.016+cos(p.y*1.5+p.x*.8+time*2.4)*.009);
 // Live ripple field: height in R, foam in G.
 float rm=1.-smoothstep(rippleN*rippleCell*.34,rippleN*rippleCell*.47,max(abs(p.x-focus.x),abs(p.y-focus.y)));
 float rf=0.;
 if(rm>0.){
  vec2 q=p/rippleCell-.5;vec2 i0=floor(q);vec2 fr=q-i0;
  vec2 u00=(i0+.5)/rippleN,u10=(i0+vec2(1.5,.5))/rippleN,u01=(i0+vec2(.5,1.5))/rippleN,u11=(i0+1.5)/rippleN;
  vec2 a=texture2D(ripple,u00).rg,b=texture2D(ripple,u10).rg,c=texture2D(ripple,u01).rg,d=texture2D(ripple,u11).rg;
  vec2 gr=vec2(mix(b.r-a.r,d.r-c.r,fr.y),mix(c.r-a.r,d.r-b.r,fr.x))/rippleCell;
  g+=gr*rm*1.6;
  rf=mix(mix(a.g,b.g,fr.x),mix(c.g,d.g,fr.x),fr.y)*rm;
 }
 vec3 n=normalize(vec3(-g.x,1.,-g.y));
 vec3 view=normalize(cameraPosition-vec3(p.x,y,p.y));
 float fresnel=pow(1.-max(0.,dot(n,view)),3.);
 float depth=y-bedH(p.x);
 vec3 deep=mix(vec3(.12,.27,.28),vec3(.10,.16,.23),smoothstep(110.,350.,p.x));
 vec3 col=mix(vec3(.28,.52,.46),deep,smoothstep(.1,2.1,depth));
 col=mix(col,vec3(.40,.30,.36),fresnel*.65);
 float glint=pow(max(0.,dot(reflect(-normalize(vec3(1.,.28,-.5)),n),view)),120.);
 // Foam: wave crests when the sea builds, broken water on the shoreline, and wakes.
 float sea=smoothstep(95.,300.,p.x);
 float crest=smoothstep(.55,1.,(y+.05)/(.22+.7*sea)) * (.25+.75*sea);
 float nz=vnoise(p*.9+vec2(time*.3,-time*.2))*.65+vnoise(p*2.7-time*.4)*.35;
 float shore=(1.-smoothstep(.0,.55,depth))*(.55+.45*sin(depth*9.-time*1.6+nz*5.));
 shore*=smoothstep(.0,.15,depth+.2);
 float foam=clamp(crest*nz*1.3,0.,1.)*.55+clamp(shore*nz*1.5,0.,.85)+clamp(rf,0.,1.)*(.55+.45*nz);
 foam=clamp(foam,0.,1.);
 col+=vec3(.85,.48,.22)*glint*.65;
 col=mix(col,vec3(.86,.85,.80),foam*.9);
 float alpha=mix(.45,1.,smoothstep(.0,1.1,depth));
 alpha=max(alpha,foam);
 gl_FragColor=vec4(col,alpha);}`
  });
  const geo = new THREE.PlaneGeometry(2400, 3600, 320, 360); geo.rotateX(-Math.PI / 2); geo.translate(1290, 0, 0);
  const mesh = new THREE.Mesh(geo, material); mesh.frustumCulled = false; mesh.renderOrder = 2; scene.add(mesh);
  const spray = new Spray(scene);
  const floaters = [];
  let time = 0;

  const height = (x, z, t = time, withRipples = true) => seaHeight(x, z, t) + (withRipples ? ripples.sample(x, z) : 0);
  const tmp = [0, 0];
  const normal = (x, z, t = time, out = new THREE.Vector3()) => {
    seaGradient(x, z, t, tmp); const e = ripples.cell, r = (ripples.sample(x + e, z) - ripples.sample(x - e, z)) / (2 * e), s = (ripples.sample(x, z + e) - ripples.sample(x, z - e)) / (2 * e);
    return out.set(-(tmp[0] + r), 1, -(tmp[1] + s)).normalize();
  };

  function splash(x, z, power = 1, vx = 0, vz = 0, y = null) {
    const sy = y ?? height(x, z);
    ripples.disturb(x, z, 1.4 + power * 0.7, -0.12 * power);
    ripples.foam(x, z, 1.2 + power * 0.7, 0.8 * Math.min(1.5, power));
    const n = Math.min(40, Math.round(8 * power));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = (0.6 + Math.random() * 1.8) * (0.6 + power * 0.5);
      spray.emit(x + Math.cos(a) * 0.3, sy + 0.05, z + Math.sin(a) * 0.3, Math.cos(a) * s + vx * 0.3, 1.8 + Math.random() * 3.2 * Math.sqrt(power), Math.sin(a) * s + vz * 0.3, 0.7 + Math.random() * 0.6, 0.18 + Math.random() * 0.14, 0.5 + Math.random() * 0.3, 0.8);
    }
  }
  // A moving hull / limb leaves an advancing wake: ripples, foam and a little spray.
  function wake(x, z, vx, vz, radius = 0.6, strength = 1) {
    const speed = Math.hypot(vx, vz);
    if (speed < 0.35) return;
    ripples.disturb(x, z, radius * 1.4, -0.03 * strength * Math.min(speed, 12) / 6);
    ripples.foam(x, z, radius, 0.25 * strength * Math.min(1, speed / 5));
  }
  function addFloater(opts) {
    const fl = Object.assign({ x: 0, z: 0, vx: 0, vz: 0, radius: 0.5, lift: 0, anchor: null, tether: 0.4, drift: 0.08, drag: 1.1, tilt: 0.9, bobSpin: 0 }, opts);
    fl.y = height(fl.x, fl.z); floaters.push(fl); return fl;
  }
  function push(x, z, vx, vz, radius) {
    for (const fl of floaters) {
      const dx = fl.x - x, dz = fl.z - z, d = Math.hypot(dx, dz), reach = radius + fl.radius;
      if (d < reach && d > 0.001) {
        const k = (1 - d / reach);
        fl.vx += (dx / d * 3.5 + vx * 0.7) * k * 0.5; fl.vz += (dz / d * 3.5 + vz * 0.7) * k * 0.5;
        if (Math.hypot(vx, vz) > 1) ripples.disturb(fl.x, fl.z, 0.8, 0.02);
      }
    }
  }
  const nrm = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), qa = new THREE.Quaternion();
  function updateFloaters(dt) {
    for (const fl of floaters) {
      const grad = seaGradient(fl.x, fl.z, time, [0, 0]);
      // Slope push, a gentle shoreward drift and an optional mooring tether.
      fl.vx += (-grad[0] * 4.2 - fl.drift) * dt; fl.vz += (-grad[1] * 4.2) * dt;
      if (fl.anchor) {
        const dx = fl.anchor.x - fl.x, dz = fl.anchor.z - fl.z, d = Math.hypot(dx, dz), slack = fl.anchor.slack ?? 3;
        if (d > slack) { const k = (d - slack) * fl.tether; fl.vx += dx / d * k * dt * 3; fl.vz += dz / d * k * dt * 3; }
      }
      const damp = Math.exp(-fl.drag * dt); fl.vx *= damp; fl.vz *= damp;
      fl.x += fl.vx * dt; fl.z += fl.vz * dt;
      // Keep floaters out of the shallows: nudge back toward deeper water.
      if (fl.x < fl.minX) { fl.x = fl.minX; fl.vx = Math.abs(fl.vx) * 0.3; }
      const target = height(fl.x, fl.z) + fl.lift;
      fl.y += (target - fl.y) * Math.min(1, dt * 9);
      normal(fl.x, fl.z, time, nrm);
      qa.setFromUnitVectors(up, nrm.lerp(up, 1 - fl.tilt)); qa.multiply(new THREE.Quaternion().setFromAxisAngle(up, (fl.yaw = (fl.yaw ?? 0) + fl.bobSpin * dt)));
      if (fl.mesh) { fl.mesh.position.set(fl.x, fl.y, fl.z); fl.mesh.quaternion.slerp(qa, Math.min(1, dt * 6)); }
      if (Math.hypot(fl.vx, fl.vz) > 0.5 && Math.random() < dt * 8) ripples.foam(fl.x, fl.z, 0.5, 0.15);
    }
  }

  function update(dt, t, focusX, focusZ) {
    time = t;
    material.uniforms.time.value = t;
    const cx = Math.floor(focusX / ripples.cell) * ripples.cell, cz = Math.floor(focusZ / ripples.cell) * ripples.cell;
    material.uniforms.focus.value.set(cx, cz);
    spray.material.uniforms.scale.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
    if (dt > 0) { ripples.update(dt, focusX, focusZ); updateFloaters(dt); spray.update(dt, (x, z, tt) => seaHeight(x, z, tt), t); }
  }
  return { mesh, material, ripples, spray, height, normal, splash, wake, push, addFloater, floaters, update, seaHeight, seaGradient, level: SEA_LEVEL };
}
