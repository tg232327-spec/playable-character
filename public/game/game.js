import * as THREE from 'three';
import { texturedMaterial, surfaces, worldUV, createEnvironment } from './materials.js';
import { makeDetailedCar, AnimatedLocal, DoorRig } from './models.js';
import { createStreetRules } from './street-rules.js';
import { poseTradie,createBrawling } from './tradie-actions.js';
import { VehiclePhysics } from './vehicle-physics.js';
import { createRagdolls } from './ragdoll.js';
import { createSunset, createTyreFX } from './after-hours.js';
import { buildVictorianStreets, createVicBus } from './victoria.js';
import { VictorianSoundscape } from './victoria-audio.js';
import { createOcean } from './ocean.js';
import { createRides } from './rides.js';
import { createHome, HOME } from './home.js?v=12';
import { makeTrafficCar, bakeParkedOwn, STYLE_NAMES } from './cars-own.js';
import { createStreetscape } from './streetscape.js';
import { collectNature, spawnNature } from './nature.js';
import { createGuns } from './guns.js';
import { createSeaLife } from './fish.js';
import { createServo, SERVO_SITES } from './servo.js';

const $=id=>document.getElementById(id);
const scene=new THREE.Scene();
scene.background=new THREE.Color('#b9654b');
scene.fog=new THREE.FogExp2('#b47559',.00105);
const sunset=createSunset(scene);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.4));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=.9;
scene.environment=createEnvironment(renderer);
scene.environmentIntensity=.55;
$('scene').appendChild(renderer.domElement);
const camera=new THREE.PerspectiveCamera(54,innerWidth/innerHeight,.2,2000);
const ambient=new THREE.HemisphereLight('#c3aec6','#4a3d34',2.0);scene.add(ambient);
const sun=new THREE.DirectionalLight('#ffae70',3.5);
sun.position.set(-120,170,90);sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-65;sun.shadow.camera.right=65;sun.shadow.camera.top=70;sun.shadow.camera.bottom=-70;sun.shadow.camera.near=1;sun.shadow.camera.far=450;sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;sun.shadow.radius=2;
scene.add(sun,sun.target);
let seed=17;
function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
const clamp=THREE.MathUtils.clamp,lerp=THREE.MathUtils.lerp;
const mats={};
function mat(color,roughness=.86){
 if(mats[color])return mats[color];
 let kind=null;
 if(['#555a55','#5c6057'].includes(color))kind='asphalt';
 else if(['#d0c29e','#b4b99d','#c8af90','#ddd1af','#bfbb9b','#c0b698','#bda777','#d7c9a7','#b3ac8d','#d3c2a0','#cbbb98','#a29877','#b2a584'].includes(color))kind='wood';
 else if(['#8d6854','#965b42','#916046'].includes(color))kind='tile';
 else if(['#657b79','#6f7d66','#588a83','#82938b','#a7b4a6'].includes(color))kind='metal';
 else if(['#b0aa88','#c2b68e','#a7a17e','#b5ad8c','#aaa589'].includes(color))kind='dirt';
 mats[color]=kind?texturedMaterial(color,kind,{side:THREE.DoubleSide}):new THREE.MeshStandardMaterial({color,roughness,metalness:0,side:THREE.DoubleSide});
 return mats[color];
}
const boxGeo=new THREE.BoxGeometry(1,1,1);
const sphereGeo=new THREE.IcosahedronGeometry(1,1);
const coneGeo=new THREE.ConeGeometry(1,1,7);
const cylinderGeo=new THREE.CylinderGeometry(1,1,1,8);
const batch=new Map(),colliders=[],roadMeshes=[],roadRoutes=[];
const housePlots=[],walkPads=[];let placement=null;
let footPathAt=null;
const padAt=(x,z)=>{let m=-Infinity;for(const p of walkPads)if(Math.abs(x-p.x)<p.w&&Math.abs(z-p.z)<p.d&&p.y>m)m=p.y;if(footPathAt){const f=footPathAt(x,z);if(f!=null&&f>m)m=f}return m===-Infinity?null:m};
const transform=new THREE.Object3D();
function add(geo,color,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0){
 const m=typeof color==='string'?mat(color):color;
 transform.position.set(x,y,z);transform.scale.set(sx,sy,sz);transform.rotation.set(rx,ry,rz);transform.updateMatrix();
 if(placement){
  const dx=x-placement.x,dz=z-placement.z,c=Math.cos(placement.angle),s=Math.sin(placement.angle);
  transform.position.set(placement.x+dx*c+dz*s,y,placement.z-dx*s+dz*c);
  transform.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),placement.angle));transform.updateMatrix();
  x=transform.position.x;z=transform.position.z;
 }
 if(!batch.has(m))batch.set(m,new Map());
 const chunks=batch.get(m),key=Math.floor(x/120)+','+Math.floor(z/120);
 if(!chunks.has(key))chunks.set(key,[]);
 chunks.get(key).push(geo.clone().applyMatrix4(transform.matrix));
}
function box(color,x,y,z,sx,sy,sz,ry=0){add(boxGeo,color,x,y,z,sx,sy,sz,0,ry)}
function flush(){
 const grouped=new Map();
 for(const [m,chunks] of batch){
  const key=[m.type,m.map?.uuid,m.bumpMap?.uuid,m.roughness,m.metalness,m.transparent,m.opacity,m.side,m.emissive?.getHex()].join('|');
  if(!grouped.has(key)){const material=m.clone();material.color.set('#ffffff');material.vertexColors=true;grouped.set(key,{material,chunks:new Map()})}
  const target=grouped.get(key).chunks;
  for(const [chunk,geos] of chunks){
   if(!target.has(chunk))target.set(chunk,[]);
   for(const g of geos){
    const colors=new Float32Array(g.attributes.position.count*3);
    for(let i=0;i<colors.length;i+=3){colors[i]=m.color.r;colors[i+1]=m.color.g;colors[i+2]=m.color.b}
    g.setAttribute('color',new THREE.BufferAttribute(colors,3));target.get(chunk).push(g);
   }
  }
 }
 for(const {material:m,chunks} of grouped.values())for(const geos of chunks.values()){
  const all=geos.map(g=>g.index?g.toNonIndexed():g);let length=all.reduce((n,g)=>n+g.attributes.position.array.length,0);
  const p=new Float32Array(length),n=new Float32Array(length),c=new Float32Array(length);let offset=0;
  for(const g of all){p.set(g.attributes.position.array,offset);n.set(g.attributes.normal.array,offset);c.set(g.attributes.color.array,offset);offset+=g.attributes.position.array.length;g.dispose()}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(p,3));geo.setAttribute('normal',new THREE.BufferAttribute(n,3));geo.setAttribute('color',new THREE.BufferAttribute(c,3));worldUV(geo);
  const mesh=new THREE.Mesh(geo,m);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);
 }
 batch.clear();
}
function height(x,z){
 const coast=1.7-THREE.MathUtils.smoothstep(x,68,110)*3.5;
 const inland=THREE.MathUtils.smoothstep(-x,80,460);
 const rolling=inland*(3+3*Math.sin(x*.009)*Math.cos(z*.008));
 const hills=Math.max(0,-x-450)*.10*(.8+.22*Math.sin(z*.009));
 const back=THREE.MathUtils.smoothstep(Math.abs(z),350,920)*(12+9*Math.sin(z*.009)*Math.sin(x*.008));
 const humps=Math.abs(x)<8?.17*Math.exp(-(((z-51)/1.2)**2))+.17*Math.exp(-(((z+56)/1.2)**2)):0;
 const base=coast+rolling+hills+back+humps,d=Math.hypot(x+180,z-440);
 return lerp(3.8,base,THREE.MathUtils.smoothstep(d,48,66));
}
// A handcrafted fictional coastline, with vertex-coloured dunes and inland ranges.
const terrain=new THREE.PlaneGeometry(1900,2600,230,310);
terrain.rotateX(-Math.PI/2);terrain.translate(-590,0,0);
const pos=terrain.attributes.position,colors=[];
const sand=new THREE.Color('#aa8a62'),grass=new THREE.Color('#62664b'),hill=new THREE.Color('#4d5c47');
for(let i=0;i<pos.count;i++){
 const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,height(x,z));
 let col=x>64?sand.clone():grass.clone().lerp(hill,clamp((-x-30)/700,0,1));
 if(x<-260&&z>340)col.lerp(new THREE.Color('#b17a50'),THREE.MathUtils.smoothstep(z,340,510));
 col.multiplyScalar(.97+rand()*.06);colors.push(col.r,col.g,col.b);
}
terrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrain.computeVertexNormals();
const landMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});
landMaterial.onBeforeCompile=shader=>{
 shader.uniforms.groundGrass={value:surfaces.grass.map};shader.uniforms.groundSand={value:surfaces.sand.map};
 shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 groundPos;').replace('#include <begin_vertex>','#include <begin_vertex>\ngroundPos=position;');
 shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D groundGrass;uniform sampler2D groundSand;varying vec3 groundPos;').replace('#include <color_fragment>','#include <color_fragment>\nvec3 detail=mix(texture2D(groundGrass,groundPos.xz*.18).rgb,texture2D(groundSand,groundPos.xz*.22).rgb,smoothstep(62.,83.,groundPos.x));diffuseColor.rgb*=mix(vec3(.65),vec3(1.35),detail);');
};
const land=new THREE.Mesh(terrain,landMaterial);
land.receiveShadow=true;scene.add(land);
const ocean=createOcean({scene,camera,renderer});
const waveHeight=(x,z,time=state.time)=>ocean.height(x,z,time);
window.boganWater={height:waveHeight,normal(x,z,t){return ocean.normal(x,z,t)},bounds:{minX:90,maxX:2490},ripples:ocean.ripples,spray:ocean.spray};
// Crests and shore foam are shaded on the moving surface itself.
function ribbon(points,width,color,offset=.05,batched=false){
 const sampled=[];
 for(let i=0;i<points.length-1;i++){
  const a=points[i],b=points[i+1],steps=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/3));
  for(let j=0;j<steps;j++)sampled.push([lerp(a[0],b[0],j/steps),lerp(a[1],b[1],j/steps)]);
 }
 sampled.push(points[points.length-1]);points=sampled;
 const ps=[],idx=[];
 for(let i=0;i<points.length;i++){
  const [x,z]=points[i],prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)];
  const dx=next[0]-prev[0],dz=next[1]-prev[1],len=Math.hypot(dx,dz)||1;
  for(const sign of [-1,1]){const xx=x+dz/len*width/2*sign,zz=z-dx/len*width/2*sign;ps.push(xx,height(xx,zz)+offset,zz)}
  if(i<points.length-1){const a=i*2;idx.push(a,a+2,a+1,a+1,a+2,a+3)}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(ps,3));g.setIndex(idx);g.computeVertexNormals();worldUV(g,4);
 const m=new THREE.Mesh(g,mat(color));m.receiveShadow=true;if(batched)add(g,color,0,0,0);else scene.add(m);
 if(['#555a55','#5c6057','#9a7751'].includes(color))roadMeshes.push(m);
 if(['#555a55','#5c6057','#9a7751'].includes(color))roadRoutes.push({points,width,surface:color==='#9a7751'?'dirt':'asphalt'});
}
const roadZ=[-960,-800,-650,-500,-380,-300,-240,-180,-125,-60,0,60,125,200,300,450,600,750,900];
ribbon(roadZ.map(z=>[0,z]),15,'#b5ad8c',.04);
ribbon(roadZ.map(z=>[0,z]),11,'#555a55',.07);
const crossRoads=[28,-125,-240,125,-360,240,380,560,740];
for(const z of [28,-125,-240,125]){
 ribbon([[-115,z],[-65,z],[0,z],[50,z],[85,z]],12,'#aaa589',.05);
 ribbon([[-115,z],[-65,z],[0,z],[50,z],[85,z]],9,'#5c6057',.09);
}
// (V11: painted centre lines and edge lines removed — plain asphalt now)
// Gravel pub forecourt and beach parking.
box('#b0aa88',-25,1.74,0,32,.08,54);box('#c2b68e',62,1.74,-125,44,.08,33);
for(let z=-18;z<=18;z+=7)box('#e5dcc0',-17,1.82,z,8,.025,.12);
function sign(text,x,y,z,w=10,h=2,bg='#2b493b',fg='#fff3d3',rot=0){
 const c=document.createElement('canvas');c.width=768;c.height=192;const cx=c.getContext('2d');
 cx.fillStyle=bg;cx.fillRect(0,0,768,192);cx.strokeStyle=fg;cx.lineWidth=5;cx.strokeRect(10,10,748,172);
 cx.fillStyle=fg;cx.font=`bold ${text.length>22?39:57}px sans-serif`;cx.textAlign='center';cx.textBaseline='middle';cx.fillText(text,384,100,720);
 const m=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),side:THREE.DoubleSide});
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),m);mesh.position.set(x,y,z);mesh.rotation.y=rot;scene.add(mesh);return mesh;
}
function roof(x,y,z,w,d,color){
 // Gabled roof, rotated so the ridge runs down the house.
 const geo=new THREE.BufferGeometry(),p=[-w/2,0,-d/2,w/2,0,-d/2,0,2.1,-d/2,-w/2,0,d/2,0,2.1,d/2,w/2,0,d/2,-w/2,0,-d/2,0,2.1,-d/2,-w/2,0,d/2,0,2.1,-d/2,0,2.1,d/2,-w/2,0,d/2,w/2,0,-d/2,w/2,0,d/2,0,2.1,-d/2,w/2,0,d/2,0,2.1,d/2,0,2.1,-d/2];
 geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.computeVertexNormals();add(geo,color,x,y,z);
}
function nearestRoad(x,z){
 let best={distance:Infinity,x,z,width:11,angle:0};
 for(const r of roadRoutes)for(let i=1;i<r.points.length;i++){
  const a=r.points[i-1],b=r.points[i],dx=b[0]-a[0],dz=b[1]-a[1],len=dx*dx+dz*dz;
  const t=clamp(((x-a[0])*dx+(z-a[1])*dz)/len,0,1),px=a[0]+t*dx,pz=a[1]+t*dz,d=Math.hypot(x-px,z-pz);
  if(d<best.distance)best={distance:d,x:px,z:pz,width:r.width,angle:Math.atan2(px-x,pz-z)};
 }
 return best;
}
function house(x,z,color,index=0,dense=false){
 const access=nearestRoad(x,z),angle=Math.round(access.angle/(Math.PI/2))*Math.PI/2,colliderStart=colliders.length;
 placement={x,z,angle};
 const y=height(x,z)+.2,w=dense?14.5+rand()*.5:10+rand()*5,d=dense?11.6:11+rand()*4;
 const brickKey=index%3?'brick-warm':'brick-cool';
 const brick=mats[brickKey]??=(texturedMaterial(index%3?'#aa8a75':'#928b7b','brick'));
 box(brick,x,y-.2,z,w+.4,1.1,d+.4);
 const boards=mats['wb'+color]??=texturedMaterial(color,'weatherboard',{bumpScale:.12});
 const glass=mats.__glass??=new THREE.MeshStandardMaterial({color:'#4a6670',roughness:.06,metalness:.85,envMapIntensity:1.4});
 const joinery=mats.__panel??=texturedMaterial('#ffffff','panel',{roughness:.6,bumpScale:.05});
 const brass=mats.__brass??=new THREE.MeshStandardMaterial({color:'#c9a14a',roughness:.3,metalness:1});
 const lamp=mats.__lamp??=new THREE.MeshStandardMaterial({color:'#ffe6b0',emissive:'#ffcf7a',emissiveIntensity:1.6,roughness:.4});
 box(index%4===2?brick:boards,x,y+2.1,z,w,4.2,d);
 roof(x,y+4.2,z,w+1.6,d+1.8,index%2?'#8d6854':'#657b79');
 // Fascias, gutters, corner boards and a layered timber veranda.
 for(const side of [-1,1]){
  box('#e7ddc5',x+side*(w/2+.65),y+4.18,z,.18,.24,d+1.9);
  box('#d1c7b1',x+side*(w/2+.3),y+2,z+d/2,.13,4.3,.14);
  box('#9eac9c',x+side*(w/2+.72),y+2.05,z+d/2-.4,.09,4.1,.09);
 }
 box('#d7c9a7',x,y+.18,z+d/2+2,w+3,.35,4);
 box('#b3ac8d',x,y+3.35,z+d/2+1.7,w+2,.2,3.8);
 for(const dx of [-w/2+1,w/2-1])box('#e8dfbe',x+dx,y+1.7,z+d/2+2.8,.15,3.2,.15);
 box('#eadfc8',x,y+3.12,z+d/2+3.4,w+1.5,.14,.14);
 for(let k=0;k<3;k++)box('#b5b0a0',x,y+.1-k*.13,z+d/2+4+k*.3,2.3,.2,.5);
 box('#52675e',x,y+1.5,z+d/2+.06,1.6,3,.14);
 for(const dx of [-3.2,3.2]){
  box('#e6dbc0',x+dx,y+2.3,z+d/2+.08,2.35,1.9,.18);
  box(glass,x+dx,y+2.3,z+d/2+.2,1.95,1.55,.12);
  box('#d8cba9',x+dx,y+2.3,z+d/2+.3,.07,1.55,.07);
  box('#d8cba9',x+dx,y+2.3,z+d/2+.3,1.95,.07,.07);
  box('#d8cba9',x+dx,y+1.35,z+d/2+.3,2.5,.15,.35);
  // Draped curtains and recessed shadow at the window header.
  for(const side of [-1,1])box('#d4c9b0',x+dx+side*.78,y+2.3,z+d/2+.27,.22,1.4,.035);
 }
 for(let zz=-3;zz<5;zz+=4){box('#ddd1b6',x+w/2+.04,y+2.4,z+zz,.18,1.8,2.1);box(glass,x+w/2+.15,y+2.4,z+zz,.09,1.5,1.8)}
 const fx=x+(dense?9:w/2+3);
 for(let zz=-10;zz<=11;zz+=2)if(zz<d/2+1)box('#d1cbb2',fx,y+.9,z+zz,.25,1.8,.8);
 box('#c8c2a6',fx,y+.75,z, .15,.15,23);box('#c8c2a6',fx,y+1.35,z,.15,.15,23);
 colliders.push({x:fx,z,w:.13,d:11.5,h:1.9,kind:'yard fence'});
 colliders.push({x,z,w:w/2+.05,d:d/2+.05,kind:'house'});
 // Walkable veranda: only the posts block, the deck and steps are floors.
 const padStart=colliders.length;
 for(const dx of [-w/2+1,w/2-1])colliders.push({x:x+dx,z:z+d/2+2.8,w:.14,d:.14,h:3.2,kind:'veranda post'});
 const localPads=[{x,z:z+d/2+2,w:(w+3)/2,d:2,y:y+.355},{x,z:z+d/2+4.05,w:1.15,d:.25,y:y+.2},{x,z:z+d/2+4.35,w:1.15,d:.18,y:y+.07}];
 // V10 detail pass: ridge cap, shutters, lintels, a proper front door, downpipes, a tank and a letterbox.
 {
  const fz=z+d/2,shut=['#4f6b5a','#6b3f35','#3d5568','#59503c','#7a6a3b'][index%5],doorC=['#52675e','#7a3a30','#2f4a63','#5a4630','#3f3f45'][(index+1)%5];
  box('#565c5a',x,y+6.3,z,.42,.16,d+1.9);
  for(const e of [-1,1])box('#e7ddc5',x,y+4.55,z+e*(d/2+.9),w+1.7,.3,.1);
  for(const dx of [-3.2,3.2]){
   for(const s of [-1,1])box(shut,x+dx+s*1.5,y+2.3,fz+.3,.52,1.7,.08);
   box('#cfc3a6',x+dx,y+3.3,fz+.3,2.6,.16,.32);
   box('#e6dbc0',x+dx,y+2.3,fz+.36,.06,1.55,.05);
   // Six-pane sash bars, a deeper reveal, and a planter box under each window.
   for(const s of [-1,1])box('#e6dbc0',x+dx+s*.5,y+2.3,fz+.36,.04,1.55,.04);
   box('#2a2724',x+dx,y+2.3,fz+.15,2.1,1.7,.05);
   box('#7a5a3e',x+dx,y+1.1,fz+.5,2.1,.32,.36);
   box('#4f3d2b',x+dx,y+1.27,fz+.5,1.95,.04,.3);
   for(let k=-3;k<=3;k++)add(sphereGeo,['#5f7d45','#6f8c4c','#c45a6a','#e2c25a'][(k+3+index)%4],x+dx+k*.27,y+1.38,fz+.5,.17,.14,.15);
  }
  const doorMat=mats['door'+doorC]??=texturedMaterial(doorC,'panel',{roughness:.55,bumpScale:.05});
  box('#2a2724',x,y+1.5,fz+.12,1.6,3,.06);
  box(doorMat,x,y+1.5,fz+.2,1.5,2.95,.1);
  // Raised panels: two low, two high, with a glazed light at the top.
  for(const s of [-1,1]){
   box(doorMat,x+s*.36,y+.75,fz+.27,.5,.9,.05);
   box(doorMat,x+s*.36,y+1.75,fz+.27,.5,.75,.05);
  }
  box('#e9e0c8',x,y+3.05,fz+.17,1.9,.14,.16);
  box('#e9e0c8',x,y+3.55,fz+.17,1.9,.12,.16);
  box(glass,x,y+3.3,fz+.2,1.6,.38,.06);
  for(const s of [-1,1])box('#e9e0c8',x+s*.85,y+1.7,fz+.17,.12,3.95,.16);
  box(glass,x,y+2.6,fz+.27,1.05,.5,.04);
  box(brass,x+.58,y+1.45,fz+.3,.08,.08,.1);
  box(brass,x+.58,y+1.25,fz+.28,.07,.16,.04);
  box(brass,x,y+1.05,fz+.28,.32,.06,.03);
  box(brass,x-.9,y+2.7,fz+.3,.16,.22,.03);
  box('#2d2a26',x-1.25,y+2.7,fz+.25,.16,.3,.1);
  box(lamp,x-1.25,y+2.62,fz+.33,.12,.2,.08);
  box('#5b4a36',x,y+.37,fz+.9,1.4,.03,.75);
  for(const s of [-1,1])box('#8d928f',x+s*(w/2+.12),y+2.1,fz+.04,.1,4.2,.1);
  if(index%2===0){add(cylinderGeo,'#6a8a86',x+w/2+1.1,y+1.1,z-d/2+1.2,.85,2.2,.85);add(cylinderGeo,'#566f6c',x+w/2+1.1,y+2.25,z-d/2+1.2,.9,.1,.9);box('#566f6c',x+w/2+.45,y+3.4,z-d/2+1.2,1.2,.08,.08);colliders.push({x:x+w/2+1.1,z:z-d/2+1.2,w:.85,d:.85,h:2.3,kind:'tank'})}
  box('#6d716b',x+w/2+2.6,y+.55,fz+3.5,.08,1,.08);box(['#9f3a2f','#305d7a','#6d716b'][index%3],x+w/2+2.6,y+1.1,fz+3.5,.5,.28,.34);
 }
 // A tiled annex or a garage, solar hot water, a chimney and garden beds.
 if(index%3===0&&!dense){
  const gx=x-w/2-5;
  box(brick,gx,y+1.65,z,7,3.3,8);roof(gx,y+3.3,z,7.8,8.6,'#8d6854');
  box('#a5aca0',gx,y+1.4,z+4.05,5.4,2.8,.1);
  for(let yy=.25;yy<2.8;yy+=.3)box('#7f887e',gx,y+yy,z+4.12,5.4,.025,.02);
  colliders.push({x:gx,z,w:3.8,d:4.3,h:4});
 }else{
  for(const dx of [-2,1])box('#274956',x+dx,y+5.5,z-1.7,2.2,.07,3.2,.08);
 }
 box(brick,x-w*.29,y+5.55,z-3,1,2.4,1);
 box('#6d716b',x-w*.29,y+6.8,z-3,1.2,.16,1.2);
 // (V11: front-yard garden beds removed — plain yards now)
 box('#695440',x+2,y+4.8,z+d/2+.02,1.8,.16,.04);
 if(dense){
  box('#a4aca5',x-w/2-.3,y+.55,z-2,.45,.85,1.05);
  for(let k=0;k<4;k++)box('#4f5d5d',x-w/2-.54,y+.3+k*.14,z-2,.025,.04,.83);
 }
 placement=null;
 for(let i=colliderStart;i<colliders.length;i++){
  const b=colliders[i],dx=b.x-x,dz=b.z-z,c=Math.cos(angle),s=Math.sin(angle);
  b.x=x+dx*c+dz*s;b.z=z-dx*s+dz*c;
  const bw=b.w,bd=b.d;b.w=Math.abs(c)*bw+Math.abs(s)*bd;b.d=Math.abs(s)*bw+Math.abs(c)*bd;
 }
 for(const lp of localPads){const dx=lp.x-x,dz=lp.z-z,c=Math.cos(angle),sn=Math.sin(angle);walkPads.push({x:x+dx*c+dz*sn,z:z-dx*sn+dz*c,w:Math.abs(c)*lp.w+Math.abs(sn)*lp.d,d:Math.abs(sn)*lp.w+Math.abs(c)*lp.d,y:lp.y})}
 const forward=new THREE.Vector2(Math.sin(angle),Math.cos(angle)),side=new THREE.Vector2(Math.cos(angle),-Math.sin(angle));
 const driveSide=dense?7.8:w/2+3;
 const start=[x+forward.x*(d/2+3.5)-side.x*driveSide,z+forward.y*(d/2+3.5)-side.y*driveSide];
 const end=[access.x-forward.x*(access.width/2+.45)-side.x*driveSide,access.z-forward.y*(access.width/2+.45)-side.y*driveSide];
 ribbon([start,end],dense?2.25:3.1,'#b2ad9b',.09,true);
 housePlots.push({x,z,angle,start,end,width:w,depth:d,driveSide,sharedFence:dense});
}
for(const z of [-77,-40,48,84,165,-177,-205,-100,-150,0,145]){
 if(z!==0)house(-22,z,['#d0c29e','#b4b99d','#c8af90'][Math.floor(rand()*3)],Math.floor(rand()*3));
 if(z!==-40)house(22,z,['#ddd1af','#bfbb9b','#c0b698'][Math.floor(rand()*3)],Math.floor(rand()*3));
}
// The Rusty Roo: weatherboard, wraparound veranda, tin roof and beer garden.
const pubX=-38,pubZ=0;
box('#bda777',pubX,5.8,pubZ,21,8,22);roof(pubX,9.8,pubZ,23,24,'#965b42');
for(let yy=2.2;yy<9.7;yy+=.5)box('#a58c60',pubX,yy,11.05,21,.05,.05);
box('#d3c2a0',pubX,2,14,26,.45,7);
box('#6f7d66',pubX,6.2,14,26,.26,7.3);
for(let dx=-12;dx<=12;dx+=4){
 box('#e5d4ad',pubX+dx,4.1,17.3,.22,4,.22);
 box('#e5d4ad',pubX+dx,3.1,17.3,.16,.15,1);
}
for(const dx of [-8,-4,4,8]){box('#513f2d',pubX+dx,4.1,11.1,2,3.1,.2);box('#6a9390',pubX+dx,4.3,11.23,1.6,2.3,.1);box('#d6c09b',pubX+dx,7.8,11.1,2,2.2,.16)}
box('#453c2b',pubX,3.7,11.15,2.5,3.8,.2);
sign('THE RUSTY ROO',pubX,6.6,17.75,18,2.3,'#283b2c','#f5d88d');
sign('COLD DRINKS · GOOD YARNS',pubX,9.1,11.15,14,1.2,'#b39962','#fff0cb');
colliders.push({x:pubX,z:pubZ,w:11,d:11});
for(const z of [-8,3,14])for(const x of [-65,-75]){
 box('#735d3b',x,3,z,4,.25,2);for(const side of [-1,1]){box('#8a744b',x,2.55,z+side*1.7,4,.2,.55);box('#574b33',x+side*1.3,2.4,z,.18,1.2,1.7)}
 colliders.push({x,z,w:2,d:2.1,h:1.4,kind:'pub table'});
}
sign('RUSTY ROO  →',-11,6.4,18,7,1.7,'#3f5640','#f3ddac',Math.PI/2);
box('#4c5744',-11,4,18,.2,4.5,.2);
// Beach facilities, umbrellas, towels, boardwalk and surf club.
box('#d6bd88',89,.8,-124,13,.25,3.6);
for(let x=82;x<104;x+=2.7)box('#cdbb8d',x,height(x,-124)+.4,-124,2.4,.3,4);
for(const [x,z,col] of [[95,-85,'#bd6544'],[92,-106,'#f1d787'],[97,-148,'#6c9f9a'],[94,-170,'#d08864'],[92,45,'#d7b56b']]){
 const y=height(x,z);box('#705b3e',x,y+1.5,z,.09,3,.09);
 add(new THREE.ConeGeometry(2.4,.75,10),col,x,y+3,z);
 box('#e5c8a3',x+2,y+.1,z+2,1.2,.08,2.5,.4);box('#a65a3f',x-1,y+.1,z+1,1,.08,2.4,-.3);
}
box('#e4d3a7',59,3.5,-157,14,3.6,9);roof(59,5.3,-157,16,11,'#588a83');
sign('BOGAN BAY SURF CLUB',59,4.8,-152.4,12,1.4,'#568b80');
colliders.push({x:59,z:-157,w:8,d:5.5});
for(let z=-180;z<-70;z+=15){box('#b19a6b',78,2.7,z,.17,2,.17);box('#b5a47c',78,3.2,z+7,.1,.12,14)}
// Lookout and details: picnic area, water tank, servo, power lines.
box('#a7a17e',-91,height(-91,-260)+.05,-260,30,.15,24);
sign('SERENITY LOOKOUT',-91,height(-91,-260)+3.4,-268,12,1.8);
for(const x of [-98,-84]){box('#746a47',x,height(x,-268)+1.8,-268,.18,3.6,.18);colliders.push({x,z:-268,w:.1,d:.1,h:3.6,kind:'lookout sign'})}
add(cylinderGeo,'#82938b',-72,5,-56,5,6,5);add(new THREE.ConeGeometry(5.2,1,12),'#a7b4a6',-72,8.5,-56);
box('#cbbb98',-37,3.7,-147,15,4,12);box('#916046',-37,6,-147,17,.6,14);
sign('BAY SERVO',-37,6,-139.8,12,1.6,'#ad583b');
for(let x=-24;x<-12;x+=5){box('#e6d6b4',x,3,-115,1,2.6,1);box('#aa513c',x,3.7,-114.4,.8,.8,.12)}
colliders.push({x:-37,z:-147,w:8,d:7});
for(let z=-290;z<235;z+=42){
 if(crossRoads.some(n=>Math.abs(n-z)<8))continue;
 box('#756d4e',-10,6,z,.25,8.7,.25);box('#625d47',-10,9.8,z,4,.15,.16);
 colliders.push({x:-10,z,w:.15,d:.15,h:9,kind:'power pole'});
 const pts=[];for(let j=0;j<=12;j++)pts.push(new THREE.Vector3(-10,10-Math.sin(j/12*Math.PI)*1.2,z+j/12*42));
 scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:'#5e6859',transparent:true,opacity:.6})));
 box('#7b8876',8,4.3,z,.16,5.3,.16);box('#465b51',7.2,6.9,z,1.8,.16,.3);
 colliders.push({x:8,z,w:.1,d:.1,h:5.4,kind:'light pole'});
}
const districts=[
 {name:'Bogan Bay',tag:'COASTAL TOWN',x:9.1,z:101.2,angle:-Math.PI/2,description:'The local, the servo and the coast road.'},
 {name:'Banksia Heights',tag:'RESIDENTIAL',x:-290,z:105,angle:Math.PI,description:'Leafy streets, brick homes and weatherboard cottages.'},
 {name:'Tin Can Industrial',tag:'WAREHOUSES & WHARF',x:0,z:440,angle:Math.PI,description:'Steel sheds, shipping containers and a working jetty.'},
 {name:'Stringybark Forest',tag:'HILL COUNTRY',x:-220,z:-620,angle:Math.PI,description:'Winding tarmac, tall gums and proper elevation.'},
 {name:'Red Dirt Downs',tag:'COUNTRY & GRAVEL',x:-520,z:560,angle:Math.PI/2,description:'Loose gravel, corrugations and wide-open country.'},
 {name:'North Head',tag:'SURF & LOOKOUT',x:0,z:-800,angle:Math.PI,description:'A quieter surf beach at the end of the coast road.'},
 {name:'Skid Row',tag:'SKIDPAN / MEET / SCRAPYARD',x:-180,z:440,angle:Math.PI,description:'Private asphalt, tyre stacks, car meet and a scrap yard. Hold B to fry the rears.'}
];
function makeRoad(points,width=9,dirt=false){
 ribbon(points,width+2,dirt?'#b39369':'#b5ad8c',.05);
 ribbon(points,width,dirt?'#9a7751':'#5c6057',.11);
 if(!dirt)for(let i=0;i<points.length-1;i++){
  const a=points[i],b=points[i+1],distance=Math.hypot(b[0]-a[0],b[1]-a[1]);
  for(let d=5;d<distance;d+=13){const t=d/distance,x=lerp(a[0],b[0],t),z=lerp(a[1],b[1],t);box('#e4d8ac',x,height(x,z)+.15,z,.14,.018,4,Math.atan2(b[0]-a[0],b[1]-a[1]))}
 }
}
for(const x of [-170,-290,-410])makeRoad([[x,-280],[x,-120],[x,28],[x,150],[x,280]]);
for(const z of [-240,28,240])makeRoad([[-455,z],[-290,z],[-170,z],[-115,z]]);
makeRoad([[-520,-750],[-520,-360],[-520,0],[-520,380],[-520,740]],10,true);
for(const z of [-360,380,740])makeRoad([[-520,z],[-350,z],[-170,z],[0,z]]);
makeRoad([[-520,560],[-340,560],[-170,560],[0,560]],10,true);
makeRoad([[-520,560],[-620,560],[-620,760]],10);
sign('PRIVATE TEST ROAD',-628,height(-628,575)+3,575,5,1.3,'#35382b','#e5d3ad');
makeRoad([[0,-500],[-100,-510],[-200,-550],[-220,-620],[-300,-700],[-420,-740],[-520,-750]],10);
makeRoad([[-220,-620],[-185,-420],[-170,-280]],9);
makeRoad([[-170,380],[-170,560]],11);
makeRoad([[0,440],[40,440],[85,440]],11);
makeRoad([[-410,105],[-453,105]],7);
for(const x of [-148,-192,-268,-312,-388,-432])for(let z=-272;z<272;z+=15.4){
 if(nearestRoad(x,z).distance<20)continue;
 house(x,z,['#d0c29e','#b4b99d','#c8af90','#ddd1af','#bfbb9b','#c0b698'][Math.floor(rand()*6)],Math.floor(rand()*5),true);
}
sign('BANKSIA HEIGHTS',-126,height(-126,28)+3,40,13,1.7,'#354c3d');
for(const x of [-132,-120])box('#7d7357',x,height(x,40)+1.5,40,.16,3,.16);
// Larger industrial sheds, individual doors, skylights and roof ventilators.
const corrugated=texturedMaterial('#8a9698','metal'),warehouseBrick=texturedMaterial('#9b8a78','brick');
for(const [x,z] of [[-48,425],[-105,485],[-265,350],[-220,520]]){
 const y=height(x,z);
 box(warehouseBrick,x,y-1,z,36,4.4,27);
 box(corrugated,x,y+5,z,36,9,27);roof(x,y+9.5,z,38,29,'#657b79');
 for(const dx of [-10,9]){box('#485258',x+dx,y+3,z+13.6,9,6,.16);for(let yy=.3;yy<5.9;yy+=.4)box('#9ba3a0',x+dx,y+yy,z+13.72,9,.035,.025)}
 for(const dx of [-13,-5,3,11])box('#6b8a91',x+dx,y+9.85,z-3,4,.08,7);
 for(const dx of [-9,9])add(cylinderGeo,'#8d9790',x+dx,y+11.3,z,1.1,1.8,1.1);
 colliders.push({x,z,w:18.5,d:14,h:11});
}
sign('TIN CAN INDUSTRIAL',-50,height(-50,425)+9.2,439,29,2.1,'#44575a','#efdeae');
for(let i=0;i<12;i++){
 const x=30+(i%3)*14,z=490+Math.floor(i/3)*9,y=height(x,z);
 const c=mat(['#657c83','#a66343','#9c9f7a'][i%3]);c.map=surfaces.metal.map;c.bumpMap=surfaces.metal.bumpMap;c.bumpScale=.025;
 box(c,x,y+1.5,z,11,3,4.2);for(const dx of [-5.15,5.15])box('#443e35',x+dx,y+1.5,z+2.13,.1,2.8,.05);
 colliders.push({x,z,w:5.6,d:2.3,h:3});
}
for(let x=86;x<154;x+=3)box('#9b8863',x,1.9,440,2.8,.25,8);
for(let x=90;x<154;x+=12)for(const z of [436.3,443.7]){box('#6f6c52',x,1.1,z,.45,4,.45);box('#d1c4a1',x,2.8,z,.12,1.4,.12)}
// Country cabins and farm yards.
for(const [x,z] of [[-580,490],[-450,650],[-590,-365],[-320,-790]]){
 house(x,z,'#c8af90',1);box('#92957a',x+24,height(x+24,z)+3,z,17,6,22);roof(x+24,height(x+24,z)+6,z,19,24,'#657b79');
 colliders.push({x:x+24,z,w:9,d:11,h:8});
 for(let k=0;k<6;k++)add(cylinderGeo,'#b69c60',x+16+k*2.5,height(x+16+k*2.5,z+20)+.8,z+20,1,1.5,1);
}
sign('RED DIRT DOWNS',-500,height(-500,565)+4,575,15,2,'#774d31','#f4dbb0');
sign('STRINGYBARK NATIONAL PARK',-200,height(-200,-580)+4,-580,18,2,'#355346');
// North Head surf village, beach access and viewing shelter.
for(const z of [-760,-810,-865]){house(22,z===-810?-828:z,'#ddd1af',1);house(-22,z,'#b4b99d',0)}
makeRoad([[0,-800],[45,-800],[88,-800]],9);
box('#a69265',84,height(84,-800)+.2,-800,18,.3,11);
for(const x of [77,91])for(const z of [-805,-795])box('#8b7b56',x,height(x,z)+2,z,.16,4,.16);
box('#657b79',84,height(84,-800)+4,-800,17,.16,12);
sign('NORTH HEAD · SURF RESERVE',36,height(36,-800)+3,-786,19,1.7,'#426c64');
const surfaceGrid=new Map();
function indexRoads(){
surfaceGrid.clear();
for(const route of roadRoutes)for(let i=0;i<route.points.length-1;i++){
 const a=route.points[i],b=route.points[i+1],radius=route.width/2;
 const segment={a,b,radius,surface:route.surface};
 for(let gx=Math.floor((Math.min(a[0],b[0])-radius)/20);gx<=Math.floor((Math.max(a[0],b[0])+radius)/20);gx++)for(let gz=Math.floor((Math.min(a[1],b[1])-radius)/20);gz<=Math.floor((Math.max(a[1],b[1])+radius)/20);gz++){const key=gx+','+gz;if(!surfaceGrid.has(key))surfaceGrid.set(key,[]);surfaceGrid.get(key).push(segment)}
}
}
indexRoads();
function surfaceAt(x,z){
 for(const segment of surfaceGrid.get(Math.floor(x/20)+','+Math.floor(z/20))??[]){
  const {a,b,radius,surface}=segment,dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);
  if(Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)<radius)return surface;
 }
 if((x>-42&&x<-9&&Math.abs(z)<28)||(x>40&&x<84&&Math.abs(z+125)<17))return 'gravel';
 if(x>69)return 'sand';
 if(x<-260&&z>340)return 'dirt';return 'grass';
}
// Infill: pack more homes along the coast road so the town feels lived in.
{
 const crossZ=[28,-125,-240,125,-360,240,380];
 const nearHome=(x,z)=>x>0&&z>HOME.cz-HOME.hz-14&&z<HOME.cz+HOME.hz+14;
 for(let z=-340;z<=400;z+=19)for(const side of [-1,1]){
  const x=22*side;
  if(crossZ.some(c=>Math.abs(c-z)<18)||nearHome(x,z)||SERVO_SITES.some(s=>s.x*x>0&&Math.abs(s.z-z)<26))continue;
  if(housePlots.some(p=>Math.abs(p.x-x)<25&&Math.abs(p.z-z)<17))continue;
  if(colliders.some(b=>Math.abs(b.x-x)<b.w+9&&Math.abs(b.z-z)<b.d+9))continue;
  if([-9,0,9].some(o=>surfaceAt(x+o,z)!=='grass'))continue;
  house(x,z,side<0?['#d0c29e','#b4b99d','#c8af90'][Math.floor(rand()*3)]:['#ddd1af','#bfbb9b','#c0b698'][Math.floor(rand()*3)],Math.floor(rand()*3));
 }
}
// Eucalyptus groves: warm trunks, crooked branches and airy sage crowns.
function onRoad(x,z,padding=0){
 const gx=Math.floor(x/20),gz=Math.floor(z/20),n=padding>0?1:0;
 for(let xx=gx-n;xx<=gx+n;xx++)for(let zz=gz-n;zz<=gz+n;zz++)for(const seg of surfaceGrid.get(xx+','+zz)??[]){
  const {a,b,radius}=seg,dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);
  if(Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)<radius+padding)return true;
 }return false;
}
// V11: the procedural bush (gum painter + flora.js) is gone — downloaded Australian
// models (bloodwood / acacia) are instanced instead. See nature.js.
const nature=collectNature({rand});
const inHome=(x,z,m=6)=>(x>HOME.cx-HOME.hx-m-4&&x<HOME.cx+HOME.hx+m&&z>HOME.cz-HOME.hz-m&&z<HOME.cz+HOME.hz+m)||(x>3&&x<17.5&&z>94&&z<114)||SERVO_SITES.some(s=>x*s.x>0&&Math.abs(x)>4&&Math.abs(x)<45&&Math.abs(z-s.z)<17);
function tree(x,z,s=1){
 if(inHome(x,z))return;
 if(Math.hypot(x+180,z-440)<66)return;
 if(Math.abs(x+465)<22&&Math.abs(z-80)<23)return;
 if(onRoad(x,z,4.2)||x>68||(Math.abs(x)<12.5&&z>-940&&z<890))return;
 nature.addTree(x,z,s);
}
for(let i=0;i<760;i++){
 const x=-1100+rand()*1180,z=-1150+rand()*2300;
 if(surfaceAt(x,z)==='asphalt'||surfaceAt(x,z)==='dirt'||colliders.some(b=>Math.abs(x-b.x)<b.w+7&&Math.abs(z-b.z)<b.d+7))continue;
 if(x>-15&&x<75&&rand()>.35)continue;
 tree(x,z,.85+rand()*.8);
}
for(const [x,z] of [[20,27],[-20,70],[58,-55],[65,13],[-70,31],[67,-206],[20,-91]])tree(x,z,1.3);
for(let i=0;i<190;i++){
 const x=-580+rand()*460,z=-910+rand()*500;
 if(surfaceAt(x,z)==='asphalt'||surfaceAt(x,z)==='dirt'||colliders.some(b=>Math.abs(x-b.x)<b.w+7&&Math.abs(z-b.z)<b.d+7))continue;
 tree(x,z,1.4+rand()*1.1);
}
// Roadside stands make the national-park drive feel enclosed, not like open paddocks.
for(const route of roadRoutes.filter(r=>r.points.some(([x,z])=>x<-100&&x>-450&&z<-490&&z>-760))){
 for(let i=0;i<route.points.length;i+=3){
  const p=route.points[i],next=route.points[Math.min(i+1,route.points.length-1)];
  const direction=new THREE.Vector2(next[0]-p[0],next[1]-p[1]).normalize();
  for(const side of [-1,1]){
   const offset=11+rand()*7,x=p[0]+direction.y*side*offset,z=p[1]-direction.x*side*offset;
   if(surfaceAt(x,z)==='grass'&&!blockedByBuilding(x,z))tree(x,z,1.5+rand()*.65);
  }
 }
}
// (V11: understory shrubs, dune flora, house gardens and verge plantings removed.)
function blockedByBuilding(x,z){return colliders.some(b=>Math.abs(x-b.x)<b.w+5&&Math.abs(z-b.z)<b.d+5)}
for(const x of [-157,-277,-397])for(let z=-210;z<235;z+=49)if(surfaceAt(x,z)!=='asphalt')tree(x,z,.85+rand()*.3);
await spawnNature(scene,nature.spots,{height,colliders});
// V11: the bay comes alive — dolphins, a whale, a ray, a shark, schools and coral.
const seaLife=await createSeaLife({scene,ocean,height,rand});
// The beach is deliberately clear sand, without the old scattered rock blobs.
// Skid Row: a level, physically drivable pad with an open east-side entrance.
ribbon([[-219,440],[-141,440]],82,'#555a55',.08);
ribbon([[-141,450],[0,450]],10,'#5c6057',.09);
for(const z of [401,479])for(let x=-216;x<=-144;x+=12){
 if(Math.abs(x+170)<11)continue;
 box('#6e6c5f',x,height(x,z)+.5,z,9,1.0,.8);
 box('#b09d42',x,height(x,z)+.65,z+.43,4,.22,.02);
 colliders.push({x,z,w:4.5,d:.4,h:1});
}
for(const x of [-219,-141])for(const z of [408,420,461,473]){
 box('#6e6c5f',x,height(x,z)+.5,z,.8,1,9);
 colliders.push({x,z,w:.4,d:4.5,h:1});
}
const tyreGeo=new THREE.TorusGeometry(.38,.13,7,18);
for(let i=0;i<30;i++){
 const x=-221-rand()*12,z=411+rand()*65,y=height(x,z);
 for(let n=0;n<2+Math.floor(rand()*4);n++)add(tyreGeo,'#20211f',x,y+.18+n*.24,z,1,1,1,Math.PI/2);
}
box('#657b79',-245,height(-245,455)+3,455,21,6,18);
roof(-245,height(-245,455)+6,455,23,20,'#916046');
colliders.push({x:-245,z:455,w:10.5,d:9,h:7});
sign('SKID ROW / CASH ONLY',-244,height(-244,455)+4.5,464.1,18,2.4,'#302720','#dbb865',Math.PI);
sign('PRIVATE PAD / NO WHINGING',-180,7.3,400.4,24,2,'#2b2925','#d5c6a2',0);
for(let i=0;i<9;i++){
 const x=-275+rand()*40,z=420+rand()*70,y=height(x,z);
 box('#443b32',x,y+.6,z,2.1,.7,4.8,0,rand()*3);
 box('#39454a',x,y+1.2,z,1.65,.5,2,0,rand()*.1);
 box('#70634d',x+.9,y+.2,z+1,.2,.5,.6);
}
// Cash-in-hand worksite: unfinished framing, scaffolding and equipment.
// Worksite access is registered before housing so plots cannot block it.
indexRoads();
const siteY=height(-465,80);
box('#74756d',-465,siteY-1.35,80,24,3.3,17);
for(const x of [-476,-470,-464,-458,-453])for(const z of [72,88]){
 box('#8a7653',x,siteY+2.0,z,.16,3.7,.16);
 box('#8a7653',x,siteY+3.9,80,.16,.16,16);
}
for(const z of [72,88]){box('#8a7653',-464.5,siteY+3.9,z,23,.18,.18);box('#8a7653',-464.5,siteY+2,z,23,.13,.13)}
for(const x of [-478,-452])for(const z of [71,89])add(cylinderGeo,'#657b79',x,siteY+2.3,z,.10,4.5,.1);
box('#6b6854',-472,siteY+.5,96,6,1,2);
for(let i=0;i<6;i++)box('#8a7653',-469+i*.5,siteY+.25,96,.3,.25,6);
sign('CASHIES / ASK FOR GAZ',-453,height(-453,94)+2.5,94,11,1.6,'#38332a','#d4bb81');
// Rougher roadside dressing and patched bitumen, without toy-like billboards.
for(let i=0;i<55;i++){
 const z=-900+rand()*1750,x=(rand()-.5)*6;
 if(!crossRoads.some(n=>Math.abs(n-z)<10))box('#33372f',x,height(x,z)+.082,z,1+rand()*2,.008,1+rand()*3,0,rand()*.3);
}
for(const [x,z] of [[-45,36],[50,-140],[-300,120],[-20,454],[-152,407]]){
 const y=height(x,z);
 for(let i=0;i<4;i++)box('#5b4939',x+1.4+i*.2,y+.2,z+1.3,1.2,.15,.1);
}
// Thin dusk cloud streaks replace the old marshmallow clouds.
const cloudMat=new THREE.MeshBasicMaterial({color:'#80596b',transparent:true,opacity:.25,depthWrite:false});
for(let i=0;i<12;i++){const x=-650+rand()*1600,z=-800+rand()*1000,y=110+rand()*80;add(sphereGeo,cloudMat,x,y,z,70+rand()*70,2+rand()*3,13)}
const victoria=buildVictorianStreets({scene,add,box,ribbon,height,onRoad,colliders,housePlots,rand});
flush();

function makeCar(isUte=false,color='#c85e32'){
 const g=new THREE.Group(),wheels=[];
 const bodyMat=new THREE.MeshStandardMaterial({color,roughness:.35,metalness:.25});
 const dark=mat('#263933'),glass=new THREE.MeshStandardMaterial({color:'#507779',roughness:.18,metalness:.5});
 function part(geo,m,x,y,z,sx,sy,sz,rx=0){const a=new THREE.Mesh(geo,m);a.position.set(x,y,z);a.scale.set(sx,sy,sz);a.rotation.x=rx;a.castShadow=true;a.receiveShadow=true;g.add(a);return a}
 part(boxGeo,bodyMat,0,.85,0,2.35,.65,4.9);
 part(boxGeo,bodyMat,0,1.15,1.45,2.25,.25,1.8);
 part(boxGeo,bodyMat,0,1.15,-1.65,2.25,.25,1.2);
 const cabinZ=isUte?.35:-.3;
 part(boxGeo,glass,0,1.65,cabinZ,1.94,.75,isUte?1.35:2.4);
 part(boxGeo,bodyMat,0,2.04,cabinZ,2.07,.13,isUte?1.6:2.65);
 for(const x of [-1,1]){
  part(boxGeo,bodyMat,x,1.65,cabinZ+.6,.10,.8,.12,-.15);
  part(boxGeo,bodyMat,x,1.65,cabinZ-(isUte?.6:1.1),.1,.8,.12,.13);
  if(!isUte)part(boxGeo,bodyMat,x,1.65,cabinZ-.15,.08,.8,.1);
  part(boxGeo,bodyMat,x*1.24,1.5,.72,.25,.18,.35);
  part(boxGeo,mat('#b9b4a0'),x*1.19,1.15,-.3,.05,.06,.3);
 }
 if(isUte){
  part(boxGeo,dark,0,1.2,-1.4,1.85,.12,1.8);
  for(const x of [-1.03,1.03])part(boxGeo,bodyMat,x,1.45,-1.45,.2,.55,1.75);
  part(boxGeo,bodyMat,0,1.45,-2.3,2.1,.55,.18);
  part(boxGeo,mat('#e7c992'),.45,1.6,-1.5,.65,.65,.8);
  part(boxGeo,mat('#e9dfbd'),.45,1.97,-1.5,.7,.1,.85);
 }else part(boxGeo,dark,0,1.5,-2.12,2.3,.12,.4);
 for(const z of [-2.48,2.48]){
  part(boxGeo,mat('#b8b5a5'),0,.72,z,2.27,.17,.12);
  part(boxGeo,dark,0,1,z,1.03,.3,.08);
  for(const x of [-.8,.8])part(boxGeo,mat(z>0?'#fff0b9':'#b83c2a'),x,1.06,z,.55,.24,.12);
 }
 for(const x of [-1.14,1.14])for(const z of [-1.52,1.53]){
  const wg=new THREE.Group();wg.position.set(x,.57,z);
  const tire=new THREE.Mesh(new THREE.CylinderGeometry(.56,.56,.35,14),mat('#252b29'));tire.rotation.z=Math.PI/2;wg.add(tire);
  const hub=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.365,10),mat('#b8bbb1'));hub.rotation.z=Math.PI/2;wg.add(hub);g.add(wg);wheels.push(wg);
 }
 // Merge the body and wheel geometry by material to keep traffic inexpensive.
 g.updateMatrixWorld(true);
 const groups=new Map();
 g.traverse(o=>{if(o.isMesh){if(!groups.has(o.material))groups.set(o.material,[]);groups.get(o.material).push(o.geometry.clone().applyMatrix4(o.matrixWorld))}});
 g.clear();
 for(const [material,geos] of groups){
  const all=geos.map(q=>q.index?q.toNonIndexed():q),count=all.reduce((n,q)=>n+q.attributes.position.array.length,0);
  const p=new Float32Array(count),n=new Float32Array(count);let offset=0;
  for(const q of all){p.set(q.attributes.position.array,offset);n.set(q.attributes.normal.array,offset);offset+=q.attributes.position.array.length;q.dispose()}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(p,3));geo.setAttribute('normal',new THREE.BufferAttribute(n,3));
  const m=new THREE.Mesh(geo,material);m.castShadow=true;m.receiveShadow=true;g.add(m);
 }
 g.userData={wheels:[],isUte};scene.add(g);return g;
}
const cars=[makeDetailedCar(scene,false,'#762d37'),makeDetailedCar(scene,true,'#b8b5a6')];
cars[1].visible=false;
const traffic=[];
const TRAFFIC_MIX=[['hatch','#c2a13a'],['ute','#6f7d86'],['suv','#3f5c4a'],['van','#e6e2d6'],['sedan','#8f2f2c'],['hatch','#2e4f7a']];
for(let i=0;i<6;i++){const [st,col]=TRAFFIC_MIX[i];const car=st==='ute'||st==='sedan'?makeDetailedCar(scene,st==='ute',col):makeTrafficCar(scene,st,col);car.scale.setScalar(1);traffic.push({car,z:i===3?72:-810+i*280,direction:i%2?1:-1,speed:8+rand()*5})}
for(let i=0;i<5;i++){
 const x=[-207,-195,-183,-156,-147][i],z=410,car=makeDetailedCar(scene,i===4,['#363c43','#c4bfae','#283f4c','#9b7235','#b9b6aa'][i]);
 car.position.set(x,height(x,z)+.85,z);car.rotation.y=Math.PI+(i%2?.12:-.12);
 colliders.push({x,z,w:1.15,d:2.6,h:2});
}
const character=new AnimatedLocal(scene);
await character.load();
const person=character.group;
const streetRules=createStreetRules(scene,height,colliders);
// Home base: the cottage, driveway, the other car and a scooter all sit by the coast road.
const PARK_Y=.84;
const home=await createHome({scene,height,colliders});
const SPAWN=home.slots.player;
const parkedCars=[makeDetailedCar(scene,false,'#762d37'),makeDetailedCar(scene,true,'#b8b5a6')];
for(const [i,c] of parkedCars.entries()){
 const s=home.slots.other;c.position.set(s.x,height(s.x,s.z)+PARK_Y,s.z);c.rotation.y=s.angle;
 c.userData.wheels?.forEach((w,k)=>{w.position.y=.12-.4});
}
colliders.push({x:home.slots.other.x,z:home.slots.other.z,w:2.35,d:1.1,h:1.8,kind:'parked car'});
const servos=SERVO_SITES.map(site=>createServo({scene,height,colliders,site}));
// Parked cars on driveways (own models), baked into a few meshes.
{
 const list=[],rr=(()=>{let a=991;return()=>{a=(a*1664525+1013904223)>>>0;return a/4294967296}})();
 const pool=STYLE_NAMES,COLS=['#a53a2f','#2f4a73','#d9d5c8','#3c4146','#7d8b8f','#c8a548','#476a52','#8b5a3c','#e1e1e1','#5a2f4a'];
 for(const p of housePlots){
  if(rr()>.5||pool.length===0)continue;
  const t=.3+rr()*.15,x=p.start[0]+(p.end[0]-p.start[0])*t,z=p.start[1]+(p.end[1]-p.start[1])*t;
  if(Math.hypot(x-HOME.cx,z-HOME.cz)<20||SERVO_SITES.some(q=>Math.abs(q.z-z)<28&&q.x*x>0))continue;
  const yaw=Math.atan2(p.end[0]-p.start[0],p.end[1]-p.start[1])+(rr()<.5?Math.PI:0),sideways=Math.abs(Math.sin(yaw))>.5;
  const cw=sideways?2.4:1.15,cd=sideways?1.15:2.4;
  if(colliders.some(b=>Math.abs(b.x-x)<b.w+cw&&Math.abs(b.z-z)<b.d+cd))continue;
  list.push({style:pool[Math.floor(rr()*pool.length)],color:COLS[Math.floor(rr()*COLS.length)],x,y:height(x,z)+.03,z,yaw});colliders.push({x,z,w:cw,d:cd,h:1.6,kind:'parked car'});
 }
 bakeParkedOwn(scene,list);
}
const streetscape=createStreetscape({scene,height,housePlots,colliders,servoSites:SERVO_SITES,inHomeArea:(x,z)=>inHome(x,z,1),rand});footPathAt=streetscape.pathAt;
const buildings=[home,...servos];
const vehiclePhysics=new VehiclePhysics(terrain,colliders,height,surfaceAt,roadMeshes);
vehiclePhysics.teleport(SPAWN.x,SPAWN.z,SPAWN.angle);
for(const b of victoria.bins)vehiclePhysics.addDynamicProp(b.mesh,b);
for(const t of traffic){
 const x=t.direction>0?-3:3;t.car.position.set(x,height(x,t.z)+.8,t.z);t.car.rotation.y=t.direction>0?0:Math.PI;
 t.physics=vehiclePhysics.addDynamicTraffic(t.car,t.direction);
}
const buses=[{z:25,direction:1},{z:510,direction:-1}].map((b,i)=>{
 const car=createVicBus(scene,i?'782 BOGAN BAY':'782 NORTH HEAD'),x=b.direction>0?-3.25:3.25;
 car.position.set(x,height(x,b.z)+.55,b.z);car.rotation.y=i?Math.PI:0;
 return{...b,car,speed:8,wait:0,lastStop:null,physics:vehiclePhysics.addTraffic(car,1.27,1.5,5.9,1.5)};
});
const tyreFX=createTyreFX(scene,height);
const npcLocals=[];
// V11: the locals are the Brown Town boys now — Lez, Sassy, Donny, Nolan, Clarence, Owly, Sergio and Noelsy.
const NPC_NAMES=['Lez','Sassy','Donny','Nolan','Clarence','Owly','Sergio','Noelsy'];
for(const [i,[x,z,walking]] of [[-29,23,false],[-36,27,false],[71,-130,true],[89,-102,true],[-280,80,true],[-160,-80,true],[-17,444,true],[64,-790,false]].entries()){
 const n=character.spawnNPC(scene,x,z,height,walking);n.name=NPC_NAMES[i];npcLocals.push(n);
}
const targetGroup=new THREE.Group();scene.add(targetGroup);
const targetRing=new THREE.Mesh(new THREE.TorusGeometry(3.2,.1,8,56),new THREE.MeshBasicMaterial({color:'#ffda65'}));targetRing.rotation.x=Math.PI/2;targetGroup.add(targetRing);
const targetDiamond=new THREE.Mesh(new THREE.OctahedronGeometry(.85),new THREE.MeshStandardMaterial({color:'#ffda65',emissive:'#a96812',emissiveIntensity:.4}));targetDiamond.position.y=6;targetGroup.add(targetDiamond);
const beam=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,20,6),new THREE.MeshBasicMaterial({color:'#ffe394',transparent:true,opacity:.22}));beam.position.y=10;targetGroup.add(beam);
let checkpoints=[
 {x:-20,z:16,title:'First stop: the local.',description:"Pull into the Rusty Roo to pick up Lez's esky.",label:'the pub',toast:"Esky secured. Lez reckons you're a legend, mate."},
 {x:76,z:-125,title:'Down to the beach.',description:"Drop the esky off at the beach car park. Take the coast road.",label:'the beach',toast:"Beach delivery done. Take the scenic route up to Serenity Lookout."},
 {x:-88,z:-250,title:"How's the serenity?",description:'Pull off the inland road at the lookout for a proper bit of fresh air.',label:'the lookout',toast:"Absolutely bloody beautiful. Head back to the pub for your mate rate."},
 {x:-20,z:16,title:'Back to the local.',description:'Finish your lap at the Rusty Roo. Lez owes you one.',label:'the pub',toast:"Too easy! Esky run complete. $250 in the pocket."}
];
const jobs={
 esky:{label:'THE ESKY RUN',reward:250,limit:0,points:checkpoints},
 cashie:{label:'A QUICK CASHIE',reward:450,limit:0,points:[
  {x:-17,z:-125,title:'Grab the tools.',description:'Lez left the gear at the servo. Pick it up from the forecourt.',label:'the servo',toast:'Tools aboard. Worksite is west of Banksia Heights.'},
  {x:-453,z:105,title:'Drop the gear.',description:'Follow the suburb roads west to the unfinished job. No paperwork.',label:'the worksite',toast:'Gear delivered. Lez is settling up at the pub.'},
  {x:-20,z:16,title:'Cash in hand.',description:'Pull in at the Rusty Roo and collect the cashie.',label:'the pub',toast:'Cashie sorted. $450, no invoice.'}
 ]},
 sprint:{label:'LAST-LIGHT SPRINT',reward:600,limit:95,points:[
  {x:0,z:-380,title:'Open her up.',description:'Leave North Head. First timing gate is south on the coast road.',label:'gate one',toast:'First gate. Next one is by the pub intersection.'},
  {x:0,z:28,title:'Through town.',description:'Cross the timing gate at the pub intersection. Watch the traffic.',label:'gate two',toast:'Two down. Industrial end for the finish.'},
  {x:0,z:440,title:'Bring it home.',description:'Last gate is at Tin Can Industrial. Stay on the coast road.',label:'the finish',toast:'Across the line. $600 in the pocket.'}
 ]}
};
let jobId='esky',jobElapsed=0,jobFailed=false;
const state={mode:'menu',x:9.1,z:101.2,y:3,angle:-Math.PI/2,speed:0,vehicle:0,onFoot:false,walkX:0,walkZ:0,walkVX:0,walkVZ:0,walkY:0,walkVY:0,orbit:Math.PI,mission:0,cash:0,paused:false,started:false,camera:0,time:0,travel:0,sitting:null,high:0,drunk:0};
// Rapier ragdolls: KO'd locals, the player when flattened, rammed or thrown off a ride.
const ragdolls=createRagdolls({height,colliders,floor:(x,z)=>Math.max(height(x,z),padAt(x,z)??-Infinity,ocean.level-.8)});
let playerRag=0;
function knockPlayer(vel,dur=3.5){
 if(ragdolls.active('player')){ragdolls.hit('player',vel);playerRag=Math.max(playerRag,dur);return true}
 if(entry||state.onBus||state.sitting)return false;
 if(!state.onFoot&&!rides.active)return false;
 brawling.cancel();if(guns.drawn>=0)guns.draw(guns.drawn);
 person.updateMatrixWorld(true);
 if(!ragdolls.start('player',character.model,vel))return false;
 if(rides.active)rides.forceDismount();
 playerRag=dur;state.walkVX=state.walkVZ=state.walkVY=0;return true;
}
function endPlayerRag(){
 playerRag=0;const p=ragdolls.release('player');if(!p)return;
 state.walkX=p.x;state.walkZ=p.z;state.walkY=Math.max(height(p.x,p.z),padAt(p.x,p.z)??-Infinity)+.13;
 person.quaternion.identity();person.position.set(state.walkX,state.walkY,state.walkZ);person.rotation.y=state.orbit;person.visible=true;character.release(.2);
}
const brawling=createBrawling(state,character,npcLocals,height,blocked,()=>audio?.impact?.(),toast,{
 npcDown:(n,v)=>{n.root.updateMatrixWorld(true);if(!ragdolls.start(n,n.model,v))return false;n.rag=true;return true},
 npcUp:n=>{const p=ragdolls.release(n);n.rag=false;if(p){n.root.position.set(p.x,height(p.x,p.z)+.13,p.z)}},
 playerDown:(v,d)=>knockPlayer(v,d),
 playerUp:()=>{if(playerRag>0)endPlayerRag()},
});
// V11: two simple guns — press 1 for the pistol, 2 for the rifle, left click to fire.
const guns=createGuns({scene,character,state,npcs:npcLocals,toast,tone});
let entry=null,spacePress=0;
const rides=createRides({padAt,scene,height,extraSites:[{x:home.slots.scooter.x,z:home.slots.scooter.z,yaw:home.slots.scooter.yaw}],blocked,ocean,surfaceAt,housePlots,colliders,npcs:npcLocals,character,person,state,toast,impact:()=>audio?.impact?.(),onGround:(x,z)=>spawnDust(x,z)});
const doorRigs=cars.map(c=>new DoorRig(c));
function doorSound(kind,power=1){
 if(!audio||!audioOn||!audio.ctx)return;const {ctx,master,noiseBuffer}=audio,t=ctx.currentTime;
 const thunk=(freq,lp,vol,len)=>{const s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain(),o=ctx.createOscillator(),og=ctx.createGain();
  s.buffer=noiseBuffer;f.type='lowpass';f.frequency.value=lp;g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+len);s.connect(f).connect(g).connect(master);s.start(t);s.stop(t+len+.02);
  o.type='sine';o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(freq*.45,t+len);og.gain.setValueAtTime(vol*.9,t);og.gain.exponentialRampToValueAtTime(.001,t+len);o.connect(og).connect(master);o.start(t);o.stop(t+len+.02)};
 if(kind==='unlatch'){tone(1500,.04,'square',.05);setTimeout(()=>tone(900,.05,'square',.04),40);setTimeout(()=>{if(!audio)return;const o=audio.ctx.createOscillator(),g=audio.ctx.createGain(),n=audio.ctx.currentTime;o.type='sawtooth';o.frequency.setValueAtTime(260,n);o.frequency.linearRampToValueAtTime(330,n+.35);g.gain.setValueAtTime(.018,n);g.gain.exponentialRampToValueAtTime(.001,n+.38);o.connect(g).connect(audio.master);o.start(n);o.stop(n+.4)},90)}
 else if(kind==='slam')thunk(150,900,.5*Math.min(1.4,power),.22);
 else if(kind==='latch'){thunk(170,700,.26,.12);setTimeout(()=>tone(1100,.04,'square',.06),30)}
}
for(const r of doorRigs)r.onEvent=doorSound;
function clearEntry(){entry=null;rides.forceDismount();for(const r of doorRigs)r.reset()}
const keys=new Set();let toastTime=0,crashCooldown=0,recoverTimer=0,audio=null,audioOn=false;
function toast(t){$('toast').textContent=t;$('toast').classList.add('visible');toastTime=4.5}
function setupAudio(){
 if(audio)return;
 audio=new VictorianSoundscape();audioOn=true;$('sound').textContent='SOUND ON';
}
function tone(f,d=.15,type='sine',volume=.3){
 if(!audio||!audioOn)return;const {ctx,master}=audio,o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(volume,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+d);o.connect(g).connect(master);o.start();o.stop(ctx.currentTime+d);
}
function music(){
 if(!audio||!audioOn||state.paused)return;
 const {ctx}=audio;if(ctx.currentTime>audio.next){const notes=[110,0,164.81,220,0,164.81,146.83,0,130.81,0,196,261.63,0,196,164.81,0];const note=notes[audio.beat%notes.length];if(note)tone(note,.2,'triangle',.14);audio.beat++;audio.next=ctx.currentTime+.25}
}
function start(){if(state.started)return;state.started=true;state.mode='playing';document.body.classList.add('playing');setupAudio();toast("Welcome home. Your cottage is on the right, scooter by the path. Keep left, give it a bit, don't hit the locals.");renderer.domElement.focus()}
function pause(force){if(!state.started)return;state.paused=typeof force==='boolean'?force:!state.paused;keys.clear();$('paused').hidden=!state.paused;if(audio)audio.setMuted(state.paused||!audioOn)}
function recover(){clearEntry();state.swimming=false;state.onBus=null;const x=Math.abs(state.x+520)<Math.abs(state.x)?-520:0;state.x=x;state.z=clamp(state.z,-920,880);state.angle=Math.PI;state.speed=0;state.onFoot=false;person.visible=false;recoverTimer=0;vehiclePhysics.teleport(state.x,state.z,state.angle);toast('Back on the blacktop. No harm done.')}
function syncParked(){parkedCars.forEach((c,i)=>c.visible=i!==state.vehicle)}
syncParked();
function swap(){if(state.onFoot){toast('Hop into your car first.');return}state.vehicle=1-state.vehicle;syncParked();vehiclePhysics.type=state.vehicle;cars.forEach((c,i)=>c.visible=i===state.vehicle);$('vehicle-name').textContent=state.vehicle?'HILUX-INSPIRED TRAYBACK':'COMMODORE-INSPIRED V8';toast(state.vehicle?'Grippy 4x4 trayback. Diesel, tools and planted tyres.':'Blown V8 sedan. Rear-drive. Loose rear tyres.');tone(220,.1)}
function foot(){
 if(entry)return;
 if(state.sitting){state.sitting=null;state.walkY=height(state.walkX,state.walkZ)+.13;toast('Back on the feet.');return}
 if(rides.active){rides.dismount();return}
 if(state.onFoot&&!state.onBus&&!entry){
  // V11: take a seat (couch, stool, chair...) or use the bong / grab a beer.
  const seat=home.seats.find(s=>Math.hypot(state.walkX-s.x,state.walkZ-s.z)<1.5);
  if(seat){state.sitting=seat;state.walkVX=state.walkVZ=0;brawling.cancel();toast('Having a seat. E to get up.');return}
  const act=home.interactables.find(a=>Math.hypot(state.walkX-a.x,state.walkZ-a.z)<1.9);
  if(act){
   if(act.type==='bong'){state.high=60;toast('Ripped the bong. Everything is... real mellow.');tone(140,.5);tone(180,.4)}
   else if(act.type==='beer'){state.drunk=Math.min(120,state.drunk+45);toast('Skolled a cold one. Steady, mate.');tone(320,.15)}
   return;
  }
 }
 if(state.onFoot&&!state.onBus&&!entry&&!state.sitting){const r=rides.nearest(state.walkX,state.walkZ),cd=Math.hypot(state.walkX-state.x,state.walkZ-state.z);
  if(r&&(cd>=6||r.dist<cd)){brawling.cancel();rides.mountObj(r.obj);toast(r.obj.kind==='jetski'?'W to throttle, A/D to steer, Shift to boost. E to hop off.':'W to go, A/D to steer, Space to hop. E to hop off.');return}}
 if(state.onBus){rideBus();return}
 if(!state.onFoot){
  if(state.drunk>25){toast("No way mate — you're maggot. Walk it off.");return}
  if(Math.abs(state.speed)>3){toast('Pull up before hopping out, mate.');return}state.onFoot=true;state.walkVX=state.walkVZ=0;state.walkVY=0;state.orbit=state.angle;
  const A=state.angle,seat=new THREE.Vector3(state.x+Math.cos(A)*.48,state.y-.62,state.z-Math.sin(A)*.48);state.walkX=seat.x;state.walkY=seat.y;state.walkZ=seat.z;person.position.copy(seat);person.rotation.y=A;person.visible=true;
  entry={dir:'out',time:0,seat,fromYaw:A};brawling.cancel();toast('Stretch the legs. Shift to run. Drag the view to look around.')} else if(state.swimming)toast('Get back onto dry land first.');
 else if(Math.hypot(state.walkX-state.x,state.walkZ-state.z)<6){
  if(state.drunk>25){toast("You're maggot, mate. Not driving.");return}
  if(Math.abs(state.speed)>1){toast('Wait for the car to stop.');return}
  const side=1.55;entry={dir:'in',time:0,from:new THREE.Vector3(state.walkX,state.walkY,state.walkZ),fromYaw:person.rotation.y};
  brawling.cancel();toast('Getting in. Mind your head.');
 }else toast('Get a bit closer to your car.');
}
function availableBus(){return state.onFoot?buses.find(b=>b.wait>0&&Math.hypot(state.walkX-b.car.position.x,state.walkZ-b.z)<9):null}
function rideBus(){
 if(state.onBus){
  const b=state.onBus;if(b.wait<=0){toast('Wait for the next stop, mate.');return}
  state.onBus=null;state.walkX=-b.direction*7.4;state.walkZ=b.z+b.direction*3.5;state.walkY=height(state.walkX,state.walkZ)+.13;
  state.walkVX=state.walkVZ=state.walkVY=0;person.position.set(state.walkX,state.walkY,state.walkZ);person.visible=true;toast('Mind the step. Your car is marked on the map.');return;
 }
 const b=availableBus();if(!b){toast('Walk up to a stopped bus to board.');return}
 state.onBus=b;person.visible=false;state.walkVX=state.walkVZ=0;toast('Route 782. F or the ride button to get off at a stop.');
}
$('bus-action').onclick=rideBus;
function reset(){
 clearEntry();brawling.reset();Object.assign(state,{x:SPAWN.x,z:SPAWN.z,angle:SPAWN.angle,speed:0,onFoot:false,onBus:null,swimming:false,mission:0,cash:0,travel:0});
 vehiclePhysics.teleport(SPAWN.x,SPAWN.z,SPAWN.angle);vehiclePhysics.resetProps();vehiclePhysics.resetTraffic();vehiclePhysics.distance=0;
 for(const t of traffic){t.stopCleared=false;t.stopWait=0;t.z=t.physics.initial.position.z}
 person.visible=false;tyreFX.reset();pause(false);selectJob('esky',false);toast('Fresh tank. Fresh start.');
}
function openHelp(){if(state.started)pause(true);$('help').showModal()}
function closeHelp(){$('help').close();if(state.started)pause(false)}
function updateMission(){
 const q=checkpoints[state.mission],job=jobs[jobId];targetGroup.visible=!!q&&!jobFailed;
 $('job-label').textContent=job.label;$('reward').textContent=`$${job.reward} CASH`;
 if(jobFailed){$('mission-title').textContent='Missed the knock-off.';$('mission-desc').textContent='Time ran out. Open JOBS to have another crack.';$('mission-count').textContent='TIME UP';$('distance').textContent='No payout. Still your coast.'}
 else if(q){targetGroup.position.set(q.x,height(q.x,q.z)+.3,q.z);$('mission-title').textContent=q.title;$('mission-desc').textContent=q.description;$('mission-count').textContent=`${String(state.mission+1).padStart(2,'0')} / ${String(checkpoints.length).padStart(2,'0')}`;$('distance').textContent=`${Math.round(Math.hypot(q.x-state.x,q.z-state.z))} m to ${q.label}`}
 else{$('mission-title').textContent=jobId==='esky'?"You're a local now.":'Job done.';$('mission-desc').textContent=`$${job.reward} earned. Open JOBS for another cashie, or head to Skid Row.`;$('mission-count').textContent='COMPLETE';$('distance').textContent='Free roam / cashies / tyre fry';$('reward').textContent='CASH SETTLED'}
 $('job-timer').hidden=!job.limit;
 $('cash').textContent=`$${state.cash}`;
 $('phone-cash').textContent=`$${state.cash}`;$('phone-job').textContent=jobs[jobId].label;
}
function selectJob(id,notify=true){
 clearEntry();brawling.cancel();
 document.body.classList.toggle('sprint-job',id==='sprint');
 jobId=id;jobElapsed=0;jobFailed=false;state.mission=0;checkpoints=jobs[id].points.map(p=>({...p}));
 if(id==='sprint'){
  state.swimming=false;state.onBus=null;state.onFoot=false;person.visible=false;vehiclePhysics.teleport(0,-800,0);
  camPos.set(0,height(0,-800)+5,-812);lookPos.set(0,height(0,-800)+1,-790);
 }
 updateMission();if(notify)toast(id==='sprint'?'95 seconds. Three gates. Head south.':'Cashie pinned. Follow the yellow marker.');
}
function openJobs(){if(state.started)pause(true);$('jobs').showModal()}
function closeJobs(){$('jobs').close();if(state.started)pause(false)}
$('jobs-open').onclick=openJobs;$('close-jobs').onclick=closeJobs;
$('jobs').addEventListener('cancel',e=>{e.preventDefault();closeJobs()});
document.querySelectorAll('[data-job]').forEach(b=>b.onclick=()=>{closeJobs();if(!state.started)start();selectJob(b.dataset.job)});
updateMission();
$('start').onclick=start;$('pause').onclick=()=>pause();$('resume').onclick=()=>pause(false);$('reset').onclick=reset;
$('help-button').onclick=openHelp;$('help-top').onclick=openHelp;$('close-help').onclick=closeHelp;
function openTravel(){if(state.started)pause(true);$('travel').showModal()}
function closeTravel(){$('travel').close();if(state.started)pause(false)}
$('travel-top').onclick=openTravel;$('close-travel').onclick=closeTravel;
// V11: the phone. Most of the HUD moved into your pocket — press Q or the PHONE button.
function phoneOpen(){return !$('phone').hidden}
function togglePhone(force){const open=typeof force==='boolean'?force:!phoneOpen();$('phone').hidden=!open;
 if(open){$('phone-cash').textContent=`$${state.cash}`;$('phone-job').textContent=state.started?jobs[jobId].label:'NO JOB';keys.clear()}}
function mapOpen(){return !$('map-overlay').hidden}
function toggleMap(force){const open=typeof force==='boolean'?force:!mapOpen();$('map-overlay').hidden=!open;if(open)drawMap()}
$('phone-top').onclick=()=>togglePhone();
$('phone').onclick=e=>{if(e.target.id==='phone')togglePhone(false)};
$('app-jobs').onclick=()=>{togglePhone(false);if(!state.started)start();openJobs()};
$('app-map').onclick=()=>{togglePhone(false);toggleMap(true)};
$('app-travel').onclick=()=>{togglePhone(false);openTravel()};
$('app-help').onclick=()=>{togglePhone(false);openHelp()};
$('map-overlay').onclick=e=>{if(e.target.id==='map-overlay')toggleMap(false)};
$('travel').addEventListener('cancel',e=>{e.preventDefault();closeTravel()});
districts.forEach((d,i)=>{
 const b=document.createElement('button');b.className='destination';b.dataset.district=i;
 b.innerHTML=`<span>${d.tag}</span><strong>${d.name}</strong><small>${d.description}</small>`;
 b.onclick=()=>{
  closeTravel();if(!state.started)start();clearEntry();brawling.cancel();state.swimming=false;state.onBus=null;state.onFoot=false;person.visible=false;
  Object.assign(state,{x:d.x,z:d.z,angle:d.angle,speed:0,y:height(d.x,d.z)+1.05});
  vehiclePhysics.teleport(d.x,d.z,d.angle);toast(`Welcome to ${d.name}.`);
  camPos.set(d.x-Math.sin(d.angle)*10.5,height(d.x,d.z)+5,d.z-Math.cos(d.angle)*10.5);
  lookPos.set(d.x,height(d.x,d.z)+1,d.z);updateHUD();
 };$('district-list').appendChild(b);
});
$('telemetry-toggle').onclick=()=>{$('telemetry').hidden=!$('telemetry').hidden};
$('wheel-grid').innerHTML=['FRONT RIGHT','FRONT LEFT','REAR RIGHT','REAR LEFT'].map((name,i)=>`<div class="wheel"><strong>${name}</strong><small id="wheel-${i}-surface">ASPHALT</small><div class="spring"><i id="wheel-${i}-spring"></i></div><small id="wheel-${i}-data">WAITING FOR CONTACT</small></div>`).join('');
function updateTelemetry(){
 if($('telemetry').hidden)return;
 vehiclePhysics.wheels.forEach((w,i)=>{
  $(`wheel-${i}-surface`).textContent=w.surface.toUpperCase()+' · '+(w.contact?'CONTACT':'AIRBORNE');
  $(`wheel-${i}-spring`).style.width=`${clamp(w.compression/.27*100,0,100)}%`;
  $(`wheel-${i}-data`).textContent=`${Math.round(w.compression*1000)} mm · ${Math.round(w.normalLoad)} N · GRIP ×${w.grip.toFixed(2)}`;
 });
 $('physics-slip').textContent=`SLIP ${Math.round(vehiclePhysics.slip*180/Math.PI)}° · ${state.vehicle?'UTE':'V8'} · REAR DRIVE`;
}
$('help').addEventListener('cancel',e=>{e.preventDefault();closeHelp()});
$('sound').onclick=()=>{if(!audio)setupAudio();else{audioOn=!audioOn;audio.setMuted(!audioOn||state.paused);audio.ctx.resume();$('sound').textContent=audioOn?'SOUND ON':'SOUND OFF'}};
$('mobile-car').onclick=()=>swap();
$('mobile-punch').onclick=()=>{if(!entry)brawling.attack()};
$('mobile-foot').onclick=()=>{foot();$('mobile-foot').textContent=state.onFoot?'ENTER':'EXIT'};
document.querySelectorAll('[data-key]').forEach(b=>{
 let held=null;
 b.addEventListener('pointerdown',e=>{
  e.preventDefault();held=state.onFoot&&b.dataset.key==='b'?'shift':b.dataset.key;keys.add(held);if(held===' ')spacePress++;
  try{b.setPointerCapture(e.pointerId)}catch{/* Synthetic/expired pointer: release handlers still clear the key. */}
 });
 for(const evt of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(evt,()=>{if(held)keys.delete(held);held=null});
});
addEventListener('keydown',e=>{
 const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright','tab'].includes(k))e.preventDefault();
 // V11: Q brings up the phone, M the map — the rest of the HUD lives in your pocket.
 if(k==='q'){if(!e.repeat)togglePhone();return}
 if(k==='m'){if(!e.repeat)toggleMap();return}
 if(k==='escape'&&(phoneOpen()||mapOpen())){if(!e.repeat){togglePhone(false);toggleMap(false)}return}
 if($('help').open||$('travel').open||$('jobs').open)return;
 if(phoneOpen()||mapOpen())return;
 if(!e.repeat){
  if(k===' ')spacePress++;
  if(k==='enter'&&!state.started)start();
  else if(k==='escape'||k==='p')pause();
  else if(k==='?'||k==='/')openHelp();
  else if(k==='g')openTravel();
  else if(k==='j')openJobs();
  else if(k==='f2'){e.preventDefault();$('telemetry').hidden=!$('telemetry').hidden}
  else if(k==='1')guns.draw(0);
  else if(k==='2')guns.draw(1);
  else if(state.started&&!state.paused){
   if(k==='f')rideBus();if(k==='v')swap();if(k==='r')recover();if(k==='e')foot();if(k==='c'){state.camera=(state.camera+1)%3;toast(['Chase camera','Scenic camera','Bonnet camera'][state.camera])}if(k==='h'){tone(165,.45,'sawtooth',.6);tone(208,.45,'sawtooth',.3)}
  }
 }keys.add(k);
});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>keys.clear());
let lastDragX=0;
let cameraPress=null;
function trackCameraDrag(e){
 if(cameraPress&&cameraPress.id===e.pointerId&&Math.hypot(e.clientX-cameraPress.x,e.clientY-cameraPress.y)>6)cameraPress.dragged=true;
}
renderer.domElement.addEventListener('pointerdown',e=>{
 if(!state.onFoot||cameraPress)return;
 cameraPress={id:e.pointerId,x:e.clientX,y:e.clientY,dragged:false,attack:!entry&&e.button===0&&e.pointerType!=='touch'};
 lastDragX=e.clientX;renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove',e=>{
 if(!cameraPress||cameraPress.id!==e.pointerId)return;
 trackCameraDrag(e);
 if(state.onFoot&&renderer.domElement.hasPointerCapture(e.pointerId)){const dx=(e.clientX-lastDragX)*.006;if(rides.active){rides.camYaw-=dx;state.orbit-=dx}else state.orbit-=dx;lastDragX=e.clientX}
});
renderer.domElement.addEventListener('pointerup',e=>{
 if(!cameraPress||cameraPress.id!==e.pointerId)return;
 trackCameraDrag(e);
 const attack=cameraPress.attack&&!cameraPress.dragged&&state.onFoot&&!entry;
 cameraPress=null;
 if(renderer.domElement.hasPointerCapture(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId);
 if(attack){if(guns.drawn>=0)guns.fire();else brawling.attack()}
});
for(const event of ['pointercancel','lostpointercapture'])renderer.domElement.addEventListener(event,e=>{if(cameraPress?.id===e.pointerId)cameraPress=null});
addEventListener('blur',()=>{cameraPress=null});
document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();if(state.started)pause(true)}});
function blocked(x,z,r=1.2){return colliders.some(b=>Math.abs(x-b.x)<b.w+r&&Math.abs(z-b.z)<b.d+r)}
function walkMag(){return Math.hypot(state.walkVX,state.walkVZ)}
function update(dt){
 // V11: high / drunk timers tick down (a coffee would help, but there isn't one).
 state.high=Math.max(0,state.high-dt);state.drunk=Math.max(0,state.drunk-dt*1.4);
 if(!state.paused)state.time+=dt;
 state.indoorsAt=state.onFoot&&!state.onBus&&!rides.active?buildings.find(b=>b.inside(state.walkX,state.walkZ))??null:null;state.indoors=!!state.indoorsAt;
 const active=state.started&&!state.paused&&!$('help').open&&!$('travel').open&&!$('jobs').open&&!phoneOpen()&&!mapOpen();
 const input={throttle:0,steer:0,handbrake:false,burnout:false},rideInput={throttle:0,steer:0,brake:false,boost:false,jump:false};
 if(active){
  const forward=keys.has('w')||keys.has('arrowup'),back=keys.has('s')||keys.has('arrowdown'),left=keys.has('a')||keys.has('arrowleft'),right=keys.has('d')||keys.has('arrowright'),drift=keys.has(' ');
  if(playerRag>0){
   // Ragdolled: physics owns the body; camera follows the pelvis.
   playerRag-=dt;const p=ragdolls.pos('player');if(p){state.walkX=p.x;state.walkZ=p.z;state.walkY=Math.max(height(p.x,p.z),padAt(p.x,p.z)??-Infinity)+.13}
   state.walkVX=state.walkVZ=0;if(playerRag<=0)endPlayerRag();
  }else if(state.onFoot&&state.sitting&&!state.onBus&&!entry&&!rides.active){
   // V11: parked on the couch / stool — hold the pose, breathe.
   const s=state.sitting;
   state.walkX=s.x;state.walkZ=s.z;state.walkY=s.y-.95;state.walkVX=state.walkVZ=0;
   character.update(dt,0,s.yaw);person.position.set(state.walkX,state.walkY,state.walkZ);person.rotation.y=s.yaw;
   poseTradie(character.model,person,'sit',0);
  }else if(state.onFoot&&!state.onBus&&!entry&&!rides.active){
   const dx=(right?1:0)-(left?1:0),f=(forward?1:0)-(back?1:0),length=Math.hypot(dx,f)||1,velocity=state.swimming?2.5:keys.has('shift')?5.1:2.3;
   let tx=(-dx*Math.cos(state.orbit)+f*Math.sin(state.orbit))/length*velocity,tz=(dx*Math.sin(state.orbit)+f*Math.cos(state.orbit))/length*velocity;
   // V11: too many beers and the legs stop listening.
   if(state.drunk>0){const k=Math.min(1,state.drunk/70)*.55;tx+=Math.sin(state.time*2.3)*k*velocity;tz+=Math.cos(state.time*1.8)*k*velocity}
   state.walkVX=THREE.MathUtils.damp(state.walkVX,tx,9,dt);state.walkVZ=THREE.MathUtils.damp(state.walkVZ,tz,9,dt);
   const nx=state.walkX+state.walkVX*dt,nz=state.walkZ+state.walkVZ*dt;
   if(!blocked(nx,state.walkZ,.32)&&nx<420&&nx>-780)state.walkX=nx;
   if(!blocked(state.walkX,nz,.32)&&nz>-1000&&nz<930)state.walkZ=nz;
   const ground=Math.max(height(state.walkX,state.walkZ),padAt(state.walkX,state.walkZ)??-Infinity,rides.platformAt(state.walkX,state.walkZ)??-Infinity,buildings.reduce((m,b)=>Math.max(m,b.floorAt(state.walkX,state.walkZ)??-Infinity),-Infinity))+.13;
   if(keys.has(' ')&&!state.swimming&&state.walkY<=ground+.03){state.walkVY=4.2;keys.delete(' ')}
   state.walkVY-=9.81*dt;state.walkY=Math.max(ground,state.walkY+state.walkVY*dt);if(state.walkY<=ground)state.walkVY=0;
   const surface=waveHeight(state.walkX,state.walkZ,state.time);const wasSwim=state.swimming;state.swimming=state.walkX>90&&surface-ground>.85;
   if(state.swimming&&!wasSwim)ocean.splash(state.walkX,state.walkZ,.7,state.walkVX,state.walkVZ);
   if(state.swimming&&walkMag()>.4&&rand()<.5)ocean.wake(state.walkX,state.walkZ,state.walkVX,state.walkVZ,.5);
   if(state.swimming){const dive=keys.has(' ')?1.7:0;state.walkY=THREE.MathUtils.damp(state.walkY,Math.max(ground+.2,surface-.95-dive),5,dt);state.walkVY=0}
   const walkingSpeed=Math.hypot(state.walkVX,state.walkVZ);
   character.swimming=state.swimming;character.update(dt,walkingSpeed,Math.atan2(state.walkVX,state.walkVZ),{height:state.walkY-ground,velocity:state.walkVY});
   person.position.set(state.walkX,state.walkY,state.walkZ);
  }else if(!state.onFoot){
   input.throttle=(forward?1:0)-(back?1:0);input.steer=(left?1:0)-(right?1:0);input.handbrake=drift;input.burnout=keys.has('b')||(forward&&back);
   const road=surfaceAt(state.x,state.z)==='asphalt';
   if((drift||vehiclePhysics.slip>.15)&&Math.abs(state.speed)>6&&rand()<.6)spawnDust(state.x,state.z);
   if(!road&&Math.abs(state.speed)>5&&rand()<.4)spawnDust(state.x,state.z);
  }
  if(rides.active&&!entry){rideInput.throttle=(forward?1:0)-(back?1:0);rideInput.steer=(left?1:0)-(right?1:0);rideInput.brake=false;rideInput.fwd=forward;rideInput.back=back;rideInput.jumpPress=spacePress;spacePress=0;rideInput.boost=keys.has('shift')||(drift&&rides.active.kind==='jetski');rideInput.jump=false}
  else{rideInput.throttle=rideInput.steer=0;rideInput.brake=rideInput.boost=rideInput.jump=rideInput.fwd=rideInput.back=false;rideInput.jumpPress=0;spacePress=0}
  const px=state.onFoot?state.walkX:state.x,pz=state.onFoot?state.walkZ:state.z;
  if(jobs[jobId].limit&&!jobFailed&&state.mission<checkpoints.length){
   jobElapsed+=dt;if(jobElapsed>=jobs[jobId].limit){jobFailed=true;toast('Clock ran out. Open JOBS to retry the sprint.');updateMission()}
  }
  const q=jobFailed?null:checkpoints[state.mission];
  if(q){
   const distance=Math.hypot(q.x-px,q.z-pz);$('distance').textContent=`${Math.round(distance)} m to ${q.label}`;
   if(distance<(jobId==='sprint'?12:7)&&(jobId==='sprint'||state.onFoot||Math.abs(state.speed)<9)){toast(q.toast);tone(440,.2);setTimeout(()=>tone(660,.3),130);state.mission++;if(state.mission===checkpoints.length)state.cash+=jobs[jobId].reward;updateMission()}
  }
  const nearRide=state.onFoot&&!entry&&!rides.active&&!state.onBus?rides.nearest(state.walkX,state.walkZ):null,carD=Math.hypot(state.walkX-state.x,state.walkZ-state.z);
  if(rides.active){$('interaction').style.display='block';$('interaction').innerHTML='<kbd>E</kbd> Get off '+(rides.active.kind==='jetski'?'the jet ski':'the e-scooter')}
  else if(nearRide&&(carD>=6||nearRide.dist<carD)){$('interaction').style.display='block';$('interaction').innerHTML='<kbd>E</kbd> '+(nearRide.obj.kind==='jetski'?'Board jet ski':'Ride e-scooter')}
  else if(state.onFoot&&!entry&&carD<6){$('interaction').style.display='block';$('interaction').innerHTML='<kbd>E</kbd> Hop in your car'}else $('interaction').style.display='none';
 }
 if(active&&entry){
  entry.time+=dt;const t=entry.time,A=state.angle,sm=THREE.MathUtils.smoothstep,rig=doorRigs[state.vehicle];
  const cs=Math.cos(A),sn=Math.sin(A),gy=height(state.x,state.z)+.13;
  const door=new THREE.Vector3(state.x+cs*1.55,gy,state.z-sn*1.55),out=new THREE.Vector3(state.x+cs*2.35,height(state.x+cs*2.35,state.z-sn*2.35)+.13,state.z-sn*2.35);
  const seat=new THREE.Vector3(state.x+cs*.48,state.y-.62,state.z-sn*.48),face=A-Math.PI/2,lerpYaw=(a,b,k)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*k;
  let p,yaw,seated=0,speed=0,hand=null,side='Right',finished=false;
  if(entry.dir==='in'){
   // V11: quicker, cleaner entry — walk up, swing the door, drop into the seat.
   if(t>=.1&&!entry.opened){entry.opened=true;rig.open()}
   if(t>=.8&&!entry.closing){entry.closing=true;rig.close(.07)}
   const wk=sm(t,0,.5);p=entry.from.clone().lerp(door,wk);
   if(t>.5){const k=sm(t,.5,1.0);p.lerp(seat,k);p.y+=Math.sin(Math.min(k,1)*Math.PI)*.16}   // little dip over the sill
   yaw=t<.55?lerpYaw(entry.fromYaw,face,sm(t,0,.45)):face+Math.PI/2*sm(t,.55,1.0);
   seated=THREE.MathUtils.clamp((t-.55)/.4,0,1);speed=t<.5?1.5:0;
   if(t>.15&&t<.85)hand=rig.handleWorld();
   if(t>=1.2)finished=true;
  }else{
   if(t>=.1&&!entry.opened){entry.opened=true;rig.open()}
   if(t>=.75&&!entry.closing){entry.closing=true;rig.close(.07)}
   p=entry.seat.clone().lerp(seat,1);if(t>.25)p.lerp(door,sm(t,.25,.75));if(t>.7)p.lerp(out,sm(t,.7,1.15));
   yaw=A+Math.PI/2*sm(t,.3,.9);seated=1-sm(t,.25,.8);speed=t>.7?1.5:0;
   if(t<.5){hand=rig.handleWorld();side='Right'}
   if(t>=1.25)finished=true;
  }
  state.walkX=p.x;state.walkY=p.y;state.walkZ=p.z;state.walkVX=state.walkVZ=0;person.position.copy(p);
  character.update(dt,speed,yaw);person.rotation.y=yaw;
  poseTradie(character.model,person,'entry',seated,0,hand?{hand,side}:null);
  if(finished){
   if(entry.dir==='in'){state.onFoot=false;person.visible=false;clearEntry();toast('Belt up.')}
   else{state.orbit=A;entry=null}
  }
 }
 if(!state.paused)for(const r of doorRigs)r.update(dt);
 state.ride=rides.active;
 if(!state.paused)rides.update(dt,rideInput,audioOn?audio:null);
 if(rides.crash){const c=rides.crash;rides.crash=null;const k=Math.min(1.4,.7+c.speed/25);
  if(knockPlayer({x:c.vx*k,y:2.5+c.speed*.22,z:c.vz*k},4))toast(c.kind==='jetski'?'Ate it on the jet ski. Big stack.':'Stacked the scooter. That one hurt.')}
 if(!state.paused&&!$('help').open&&!$('travel').open&&!$('jobs').open)vehiclePhysics.step(dt,input,active&&!state.onFoot);
 if(!state.onFoot&&!state.paused&&state.x>86){
  const tr=vehiclePhysics.body.translation(),wl=ocean.height(tr.x,tr.z),depth=wl-(tr.y-.55);
  if(depth>0){const v=vehiclePhysics.body.linvel(),k=Math.min(1,depth/.9),dr=Math.exp(-dt*(1.2+3.2*k));
   vehiclePhysics.body.setLinvel({x:v.x*dr,y:v.y*Math.exp(-dt*2)+Math.min(depth,1)*dt*13,z:v.z*dr},true);
   const sp=Math.hypot(v.x,v.z);if(sp>2&&rand()<.6){ocean.wake(tr.x,tr.z,v.x,v.z,1.6,Math.min(2,sp/8));if(sp>6)ocean.splash(tr.x+v.x*.05,tr.z+v.z*.05,Math.min(1.6,sp/10),v.x,v.z)}
   state.drowning=(state.drowning||0)+(depth>1.1?dt:-dt*.5);state.drowning=Math.max(0,state.drowning);
  }else state.drowning=Math.max(0,(state.drowning||0)-dt);
 }
 const pose=vehiclePhysics.sync(cars[state.vehicle]);state.x=pose.x;state.z=pose.z;state.y=pose.y;state.angle=pose.angle;state.speed=pose.speed;state.travel=vehiclePhysics.distance;
 vehiclePhysics.syncWorldProps();
 vehiclePhysics.syncTraffic();
 for(const b of victoria.bins)b.mesh.visible=Math.hypot(b.mesh.position.x-(state.onFoot?state.walkX:state.x),b.mesh.position.z-(state.onFoot?state.walkZ:state.z))<160;
 if(active&&!state.onFoot){
  const rotation=vehiclePhysics.body.rotation();
  const outside=state.x>132||(state.drowning||0)>3.2||state.x<-810||state.z<-1020||state.z>950||state.y<height(state.x,state.z)-3;
  const tipped=1-2*(rotation.x*rotation.x+rotation.z*rotation.z)<.2&&Math.abs(state.speed)<2;
  if(outside||tipped){recoverTimer+=dt;if(recoverTimer>(outside?.4:3)){recover();if(outside)toast("Engine's drowned. Back to the blacktop.")}}else recoverTimer=0;
 }
 crashCooldown-=dt;if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('toast').classList.remove('visible')}
 if(!state.paused)for(const t of traffic){
  let desired=t.speed;
  for(const b of buses){const d=(b.z-t.z)*t.direction;if(b.direction===t.direction&&d>0&&d<45)desired=Math.min(desired,Math.max(0,(d-13)*.65))}
  for(const other of traffic){const d=(other.z-t.z)*t.direction;if(other!==t&&other.direction===t.direction&&d>0&&d<25)desired=Math.min(desired,Math.max(0,(d-7)*.7))}
  // V11: traffic also brakes for the player's car and pedestrians — no more ramming.
  {
   const obstacles=[];
   if(!state.onFoot)obstacles.push({x:state.x,z:state.z});
   else obstacles.push({x:state.walkX,z:state.walkZ});
   for(const npc of npcLocals)if(npc.root.visible)obstacles.push({x:npc.root.position.x,z:npc.root.position.z});
   for(const o of obstacles){
    const d=(o.z-t.z)*t.direction;
    if(d>0&&d<24&&Math.abs(o.x-t.car.position.x)<2.8)desired=Math.min(desired,Math.max(0,(d-6.5)*.55));
   }
  }
  t.z=t.physics.body.translation().z;const v=t.physics.body.linvel();t.actualSpeed=Math.hypot(v.x,v.z);
  t.physics.targetSpeed=streetRules.limit(t,state.time,desired,dt);
  if((t.z>900||t.z<-950)&&!t.physics.crashed){const z=t.direction>0?-945:895,x=t.direction>0?-3:3;t.physics.body.setTranslation({x,y:height(x,z)+.95,z},true);t.physics.body.setLinvel({x:0,y:0,z:0},true);t.stopCleared=false;t.stopWait=0}
  t.car.visible=Math.hypot(t.car.position.x-(state.onFoot?state.walkX:state.x),t.z-(state.onFoot?state.walkZ:state.z))<250;
 }
 if(!state.paused)for(const b of buses){
  if(b.wait>0){b.wait=Math.max(0,b.wait-dt);b.speed=0}
  else{
   const next=victoria.stops.filter(s=>s.side===-b.direction&&s!==b.lastStop).map(s=>({s,d:(s.z-b.z)*b.direction})).filter(s=>s.d>=0).sort((a,b)=>a.d-b.d)[0];
   let desired=next&&next.d<25?Math.max(.7,next.d*.5):Math.abs(b.z)<310?8:16;
   for(const t of traffic){const d=(t.z-b.z)*b.direction;if(t.direction===b.direction&&d>0&&d<35)desired=Math.min(desired,Math.max(0,(d-12)*.65))}
   b.actualSpeed=b.speed;desired=streetRules.limit(b,state.time,desired,dt);
   b.speed=THREE.MathUtils.damp(b.speed,desired,3,dt);b.z+=b.direction*b.speed*dt;
   if(next&&next.d<1){b.wait=5;b.lastStop=next.s}
   if(b.z>895||b.z<-940){b.z=b.direction>0?-940:895;b.lastStop=null;b.stopCleared=false;b.stopWait=0}
  }
  const x=b.direction>0?-3.25:3.25;b.car.position.set(x,height(x,b.z)+.55,b.z);b.car.visible=state.onBus===b||Math.hypot(x-(state.onFoot?state.walkX:state.x),b.z-(state.onFoot?state.walkZ:state.z))<320;
  Object.assign(b.physics.target,b.car.position);
  for(const door of b.car.userData.doors)door.position.z=THREE.MathUtils.damp(door.position.z,door.userData.baseZ+(b.wait>0?door.userData.sign*.48:0),8,dt);
 }
 if(state.onBus){const b=state.onBus;state.walkX=b.car.position.x;state.walkZ=b.z;state.walkY=b.car.position.y+1.1;state.orbit=b.direction>0?0:Math.PI}
 const canBoard=availableBus(),busAction=$('bus-action');busAction.hidden=!active||(!state.onBus&&!canBoard);
 busAction.textContent=state.onBus?(state.onBus.wait>0?'F · GET OFF BUS':'ROUTE 782 · NEXT STOP'): 'F · BOARD ROUTE 782';
 busAction.disabled=!!state.onBus&&state.onBus.wait<=0;
 if(active){brawling.update(dt);guns.update(dt);streetRules.update(state.time)}
 // Cars (yours and traffic) send people flying.
 if(!state.paused){
  const hitters=[];
  if(!state.onFoot&&!state.onBus){const lv=vehiclePhysics.body.linvel();hitters.push({x:state.x,z:state.z,vx:lv.x,vz:lv.z,mine:true})}
  for(const t of traffic)if(t.car.visible){const lv=t.physics.body.linvel();hitters.push({x:t.car.position.x,z:t.car.position.z,vx:lv.x,vz:lv.z})}
  for(const h of hitters){
   const sp=Math.hypot(h.vx,h.vz);if(sp<4)continue;
   const vel={x:h.vx*1.15,y:2+sp*.28,z:h.vz*1.15};
   for(const n of npcLocals){
    if(!n.root.visible)continue;const p=ragdolls.pos(n)||n.root.position;if(Math.hypot(p.x-h.x,p.z-h.z)>2.2)continue;
    if(n.rag){if((n.hitCD||0)<state.time){ragdolls.hit(n,vel);n.hitCD=state.time+.7}continue}
    n.health=0;n.down=8;n.aggro=false;n.hitV=vel;audio?.impact?.();if(h.mine)toast('Sent a local flying. Brutal.');
   }
   if(state.onFoot&&!rides.active&&!h.mine&&(playerRag<=0)&&Math.hypot(state.walkX-h.x,state.walkZ-h.z)<2){if(knockPlayer(vel,4)){audio?.impact?.();toast('Cleaned up by traffic. Look both ways.')}}
  }
  ragdolls.update(dt);
 }
 if(!state.paused)for(const npc of npcLocals){npc.root.visible=Math.hypot(npc.root.position.x-(state.onFoot?state.walkX:state.x),npc.root.position.z-(state.onFoot?state.walkZ:state.z))<110;if(npc.root.visible)npc.update(dt)}
 if(!state.paused)targetDiamond.rotation.y+=dt;targetDiamond.position.y=6+Math.sin(state.time*2)*.4;
 ocean.update(state.paused?0:dt,state.time,state.onFoot?state.walkX:state.x,state.onFoot?state.walkZ:state.z);
 if(!state.paused)seaLife.update(dt,state.time,state.onFoot?state.walkX:state.x,state.onFoot?state.walkZ:state.z);
 if(!state.paused)for(let i=dust.length-1;i>=0;i--){const p=dust[i];p.life-=dt;p.mesh.position.y+=dt*.6;p.mesh.scale.multiplyScalar(1+dt*.6);p.mesh.material.opacity=Math.max(0,p.life*.18);if(p.life<=0){scene.remove(p.mesh);p.mesh.material.dispose();dust.splice(i,1)}}
 const payout=tyreFX.update(state.paused?0:dt,vehiclePhysics,active,cars[state.vehicle]);
 if(payout){state.cash+=payout;$('cash').textContent=`$${state.cash}`;toast(`Tyre-fry combo banked. $${payout} from the boys at the pad.`)}
 const fry=tyreFX.stats;$('burnout-score').textContent=String(fry.combo).padStart(4,'0');$('burnout-best').textContent=`PTS · BEST ${fry.best}`;
 $('burnout-kind').textContent=vehiclePhysics.burnout?'LINE LOCK':fry.combo?'POWER SLIDE':'HOLD B OR W + S';$('burnout-card').classList.toggle('hot',fry.combo>0);
 if(jobs[jobId].limit){const remaining=Math.max(0,Math.ceil(jobs[jobId].limit-jobElapsed));$('job-timer').textContent=state.mission>=checkpoints.length?`FINISHED / ${jobElapsed.toFixed(1)} SEC`:`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')} / ${jobFailed?'TIME UP':'SPRINT'}`;$('job-timer').classList.toggle('urgent',remaining<20)}
 if(audio&&!state.paused)audio.update(state,vehiclePhysics,input,buses,dt);
 if(!state.paused)updateCamera(dt);updateHUD();if(mapOpen())drawMap();updateTelemetry();
}
const dust=[],dustGeo=new THREE.IcosahedronGeometry(.7,0);
function spawnDust(x,z){if(dust.length>32)return;const m=new THREE.Mesh(dustGeo,new THREE.MeshBasicMaterial({color:'#d2bd8c',transparent:true,opacity:.22,depthWrite:false}));m.position.set(x+(rand()-.5)*2,height(x,z)+.4,z);scene.add(m);dust.push({mesh:m,life:1.5})}
const camPos=new THREE.Vector3(),lookPos=new THREE.Vector3(),temp=new THREE.Vector3();
function updateCamera(dt){
 const x=state.onFoot?state.walkX:state.x,z=state.onFoot?state.walkZ:state.z,y=state.onFoot?state.walkY:state.y-.8,a=state.onFoot?state.orbit:state.angle;
 const scenic=!state.started;
 const rk=rides.active?.kind;
 const distance=scenic?44:state.indoors?3.1:rk==='jetski'?9.5:rk==='scooter'?5.8:state.onBus?13:state.camera===1?25:state.camera===2&&!state.onFoot?-1.2:state.onFoot?5.3:10.5;
 const side=scenic?38:state.camera===1?10:0;
 const up=scenic?35:state.indoors?2.7:rk==='jetski'?3.4:rk==='scooter'?2.5:state.onBus?5:state.camera===1?15:state.camera===2&&!state.onFoot?2.1:state.onFoot?2.8:4.1;
 temp.set(x-Math.sin(a)*distance+Math.cos(a)*side,y+up,z-Math.cos(a)*distance-Math.sin(a)*side);
 const factor=1-Math.exp(-dt*(scenic?1.8:5));camPos.lerp(temp,factor);
 camPos.y=Math.max(camPos.y,height(camPos.x,camPos.z)+.8,state.indoors?state.indoorsAt.fl+.9:-1e9,camPos.x>84?ocean.height(camPos.x,camPos.z)+(state.swimming&&keys.has(' ')?-.35:.9):-1e9);
 lookPos.lerp(new THREE.Vector3(scenic?28:x+Math.sin(a)*(state.onFoot?1:7),y+(scenic?1:state.onFoot?1.1:1.1),z+Math.cos(a)*(scenic?50:state.onFoot?1:7)),factor);
 camera.position.copy(camPos);camera.lookAt(lookPos);
 // V11: too many beers = the world tilts; a rip of the bong = slow mellow breathing.
 if(state.drunk>0){const k=Math.min(1,state.drunk/70);camera.rotation.z+=Math.sin(state.time*1.3)*.055*k;camPos.y+=Math.sin(state.time*2.4)*.05*k;camera.position.y=camPos.y;camera.lookAt(lookPos)}
 if(state.high>0){const k=Math.min(1,state.high/60);camera.fov=54+Math.sin(state.time*.9)*2.4*k;camera.updateProjectionMatrix();camPos.y+=Math.sin(state.time*.5)*.04*k;camera.position.y=camPos.y}
 for(const b of buildings)b.update(x,z,camPos.x,camPos.z,b===state.indoorsAt&&!scenic);
 sunset.position.copy(camera.position);sun.position.set(x+135,y+38,z-45);sun.target.position.set(x,y,z);
}
function updateHUD(){
 document.body.classList.toggle('on-foot',state.onFoot&&!state.onBus);
 $('mobile-foot').textContent=state.onBus?'LEAVE':state.onFoot?'ENTER':'EXIT';
 document.querySelector('[data-key="b"]').textContent=rides.active?'BOOST':state.onFoot?'RUN':'BURN';
 document.querySelector('[data-key=" "]').textContent=rides.active?(rides.active.kind==='jetski'?'BOOST':'HOP'):state.onFoot?'JUMP':'DRIFT';
 const speed=state.onBus?Math.round(state.onBus.speed*3.6):rides.active?Math.round(Math.abs(rides.active.speed)*3.6):state.onFoot?0:Math.round(Math.abs(state.speed)*3.6);
 $('vehicle-name').textContent=state.onBus?'VIC COAST / ROUTE 782':state.vehicle?'HILUX-INSPIRED TRAYBACK':'COMMODORE-INSPIRED V8';
 $('speed').textContent=String(speed).padStart(3,'0');$('gear').textContent=state.onBus?'BUS':rides.active?(rides.active.kind==='jetski'?'JET':'SCOOT'):state.swimming?'SWIM':state.onFoot?'WALK':state.speed<-.5?'R':speed<2?'N':Math.min(5,Math.floor(speed/30)+1);
 $('rpm').style.width=`${Math.min(100,speed/1.35)}%`;
 $('drive-status').textContent=state.onBus?'VIC COAST · ROUTE 782':entry?(entry.dir==='out'?'GETTING OUT':'GETTING IN'):rides.active?(rides.active.kind==='jetski'?(rides.active.airborne>0?'AIRBORNE':'JET SKI · '+(Math.abs(rides.active.speed)>9?'PLANING':'DISPLACEMENT')):'E-SCOOTER'):state.swimming?'SWIMMING':state.onFoot?character.current.toUpperCase():vehiclePhysics.burnout?'LINE LOCK / REARS LIT':keys.has(' ')?'REAR WHEELS LOCKED':surfaceAt(state.x,state.z).toUpperCase()+(state.vehicle?' · GRIPPY 4×4':' · LOOSE RWD');
 const z=state.onFoot?state.walkZ:state.z,x=state.onFoot?state.walkX:state.x;
 $('area').textContent=Math.hypot(x+180,z-440)<85?'SKID ROW':z<-460?(x<-100?'STRINGYBARK FOREST':'NORTH HEAD'):z>340?(x<-260?'RED DIRT DOWNS':'TIN CAN INDUSTRIAL'):x<-100?'BANKSIA HEIGHTS':x>70?'BOGAN BAY BEACH':Math.abs(z)<35?'RUSTY ROO PRECINCT':'COAST ROAD';
}
const map=$('minimap'),mc=map.getContext('2d');
function drawMap(){
 const w=map.width,h=map.height;mc.clearRect(0,0,w,h);mc.fillStyle='#71846a';mc.fillRect(0,0,w,h);
 const px=state.onFoot?state.walkX:state.x,pz=state.onFoot?state.walkZ:state.z;
 const expanded=map.parentElement.classList.contains('expanded'),rangeX=expanded?960:370,rangeZ=expanded?1950:380,minX=expanded?-810:px-rangeX*.5,minZ=expanded?-1020:pz-rangeZ*.6;
 const X=x=>(x-minX)/rangeX*w,Z=z=>(z-minZ)/rangeZ*h;
 mc.fillStyle='#b08b61';mc.fillRect(0,Z(340),Math.max(0,X(-260)),h);
 mc.fillStyle='#c9b98b';mc.fillRect(X(68),0,X(110)-X(68),h);mc.fillStyle='#62aaa3';mc.fillRect(X(104),0,w-X(104),h);
 for(const r of roadRoutes){mc.strokeStyle=r.surface==='dirt'?'#d0ab70':'#d1cbb1';mc.lineWidth=expanded?1.6:4;mc.beginPath();r.points.forEach(([x,z],i)=>i?mc.lineTo(X(x),Z(z)):mc.moveTo(X(x),Z(z)));mc.stroke()}
 mc.fillStyle='#e8dec0';for(const b of colliders)mc.fillRect(X(b.x-b.w),Z(b.z-b.d),Math.max(1,b.w*2/rangeX*w),Math.max(1,b.d*2/rangeZ*h));
 for(const b of buses){mc.fillStyle='#e17d35';mc.fillRect(X(b.car.position.x)-3,Z(b.z)-4,6,8)}
 mc.fillStyle='#ff9a3c';for(const s of rides.scooters)if(!s.ridden&&Math.abs(s.x-px)<(expanded?9999:200)&&Math.abs(s.z-pz)<(expanded?9999:200))mc.fillRect(X(s.x)-1.5,Z(s.z)-1.5,3,3);
 mc.fillStyle='#ffd24a';mc.fillRect(X(rides.jetty.x1)-4,Z(rides.jetty.z)-3,8,6);mc.font='bold 9px sans-serif';mc.fillText('JET SKI HIRE',X(rides.jetty.x0)-60,Z(rides.jetty.z)-6);
 if(state.onFoot){mc.fillStyle='#ffffff';mc.fillRect(X(state.x)-3,Z(state.z)-3,6,6);mc.font='bold 9px sans-serif';mc.fillText('CAR',X(state.x)+5,Z(state.z))}
 mc.font='bold 9px sans-serif';mc.fillStyle='#f7edcf';
 if(expanded)for(const d of districts)mc.fillText(d.name.toUpperCase(),X(d.x+8),Z(d.z-20));else{mc.fillText('HOME',X(home.bounds.front-1),Z(home.bounds.north-2));for(const s of servos)mc.fillText('SERVO',X(s.x-6),Z(s.site.z-17));mc.fillText('PUB',X(-60),Z(5));mc.fillText('BEACH',X(75),Z(-92))}
 const q=checkpoints[state.mission];if(q){mc.beginPath();mc.arc(X(q.x),Z(q.z),5,0,Math.PI*2);mc.fillStyle='#ffdc65';mc.fill();mc.strokeStyle='#3a4e39';mc.lineWidth=2;mc.stroke()}
 mc.save();mc.translate(X(px),Z(pz));mc.rotate(-(rides.active?rides.active.yaw:state.angle));mc.beginPath();mc.moveTo(0,7);mc.lineTo(-5,-5);mc.lineTo(5,-5);mc.closePath();mc.fillStyle='#fff8df';mc.fill();mc.strokeStyle='#344b3c';mc.lineWidth=2;mc.stroke();mc.restore();
}
camPos.set(-38,36,146);lookPos.set(28,3,52);
window.render_game_to_text=()=>JSON.stringify({
 version:'5.0-streetlife',mode:state.paused?'paused':state.mode,
 coordinate_system:'x east toward beach; z south; metres; forward sin(angle),cos(angle)',
 player:{x:+(state.onFoot?state.walkX:state.x).toFixed(2),y:+(state.onFoot?state.walkY:state.y).toFixed(2),z:+(state.onFoot?state.walkZ:state.z).toFixed(2),angle:+state.angle.toFixed(3),speed_kmh:+((state.onBus?state.onBus.speed:state.onFoot?0:state.speed)*3.6).toFixed(1),on_foot:state.onFoot,on_bus:!!state.onBus,vehicle:state.onBus?'VIC COAST route 782':state.vehicle?'Hilux-inspired grippy 4x4':'Commodore-inspired loose V8'},
 physics:{engine:'Rapier',fixedHz:120,steering:+vehiclePhysics.steer.toFixed(3),slip_deg:Math.round(vehiclePhysics.slip*180/Math.PI),burnout:vehiclePhysics.burnout,rear_spin:+vehiclePhysics.rearSpin.toFixed(1),rotation:vehiclePhysics.body.rotation(),wheels:vehiclePhysics.wheels.map(w=>({contact:w.contact,surface:w.surface,grip:w.grip,traction:w.traction,suspension_mm:Math.round(w.compression*1000),load_N:Math.round(w.normalLoad),rotation:+w.rotation.toFixed(2)}))},
 character:{source:'Original human/workwear mesh; imported Mixamo skeleton and idle/walk/run',visibleRobotMesh:false,loaded:character.loaded,animation:character.current,speed:+character.speed.toFixed(2)},
 world:{districts:districts.map(d=>d.name),fixedColliders:colliders.length,houses:housePlots.length,dynamicBins:victoria.bins.length,greenBusShelters:victoria.stops.length,lightPoles:victoria.poles.length,speedSigns:victoria.signs.map(s=>s.limit),drivableBounds:{x:[-780,104],z:[-1000,930]}},
 buses:buses.map(b=>({route:'782',x:b.car.position.x,z:+b.z.toFixed(2),kmh:+(b.speed*3.6).toFixed(1),dwell:+b.wait.toFixed(2),stop:b.lastStop?.name??null})),
 mission:{job:jobId,stage:state.mission,total:checkpoints.length,elapsed:+jobElapsed.toFixed(2),failed:jobFailed,reward:jobs[jobId].reward,target:jobFailed?null:checkpoints[state.mission]??null},
 tyreFry:tyreFX.stats,cash:state.cash,camera:state.camera,sound:audioOn,audio:audio?{rpm:Math.round(audio.rpm),gear:audio.gear,birdCalls:audio.calls}:null,
 landmarks:{pub:{x:-20,z:16},beach:{x:76,z:-125},lookout:{x:-88,z:-250},skidRow:{x:-180,z:440},worksite:{x:-465,z:80}},
 combat:brawling.status(),swimming:!!state.swimming,entry:entry?+entry.time.toFixed(2):null,signals:streetRules.phase(state.time),
 traffic:traffic.map(t=>({x:+t.car.position.x.toFixed(2),z:+t.z.toFixed(1),kmh:+(t.actualSpeed*3.6).toFixed(1),rule:t.rule,crashed:t.physics.crashed,dynamic:true}))
});
let manualClock=false;
window.setManualGameClock=enabled=>{manualClock=!!enabled};
window.advanceTime=(ms,render=true)=>{for(let i=0;i<Math.ceil(ms/(1000/60));i++)update(1/60);if(render)renderer.render(scene,camera)};
// QA hook for the V11 release checks (sitting, bong/beer, guns, seats).
window.boganV11={state,home,guns,scene,person,teleport(x,z){clearEntry();brawling.cancel();state.onFoot=true;state.onBus=null;state.swimming=false;state.sitting=null;state.walkX=x;state.walkZ=z;state.walkY=height(x,z)+.13;state.walkVX=state.walkVZ=0;state.orbit=Math.PI;person.visible=true;person.position.set(x,state.walkY,z);person.rotation.y=Math.PI;}};
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.4))});
let last=null,fpsFrames=0,fpsLast=performance.now();
function frame(now){
 if(manualClock){last=now;requestAnimationFrame(frame);return}
 const dt=last===null?0:clamp((now-last)/1000,0,.04);last=now;update(dt);renderer.render(scene,camera);fpsFrames++;
 if(now-fpsLast>1000){$('performance').textContent=`${Math.round(fpsFrames*1000/(now-fpsLast))} FPS · ${renderer.info.render.calls} DRAWS · ${(renderer.info.render.triangles/1000).toFixed(0)}K TRIS`;fpsFrames=0;fpsLast=now}
 requestAnimationFrame(frame);
}
renderer.setAnimationLoop(null);requestAnimationFrame(frame);
$('loading').style.display='none';

window.boganRag={ragdolls,knockPlayer,npcs:npcLocals,state};
