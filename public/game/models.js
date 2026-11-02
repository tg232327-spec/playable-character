import { buildInterior } from './cars-own.js';
import * as THREE from 'three';
import { mergeGeometries } from './addons/utils/BufferGeometryUtils.js';
import { GLTFLoader } from './addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from './addons/utils/SkeletonUtils.js';
import { loadBogan,buildBogan,PALETTES,NPC_PALETTES } from './bogan-character.js';
import { attachPlayerAvatar } from './player-avatar.js';
import { surfaces } from './materials.js';

const box=new THREE.BoxGeometry(1,1,1);
const dark=new THREE.MeshStandardMaterial({color:'#131d22',roughness:.73});
const chrome=new THREE.MeshStandardMaterial({color:'#b9c2c5',metalness:.95,roughness:.2});
const rubber=new THREE.MeshStandardMaterial({color:'#23272a',roughness:.98,map:surfaces.asphalt.map,bumpMap:surfaces.asphalt.bumpMap,bumpScale:.025});
const glass=new THREE.MeshPhysicalMaterial({color:'#405e69',roughness:.09,metalness:.18,clearcoat:1,envMapIntensity:1.4});
const seam=new THREE.MeshStandardMaterial({color:'#353b3b',roughness:.75});
const discMaterial=new THREE.MeshStandardMaterial({color:'#586064',metalness:.7,roughness:.4});
function mergeBody(group){
 group.updateWorldMatrix(true,true);const inverse=group.matrixWorld.clone().invert(),byMaterial=new Map();
 group.traverse(o=>{if(o.isMesh){if(!byMaterial.has(o.material))byMaterial.set(o.material,[]);const g=o.geometry.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld));if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));byMaterial.get(o.material).push(g)}});
 group.clear();
 for(const [material,geos] of byMaterial){const mesh=new THREE.Mesh(mergeGeometries(geos.map(g=>g.index?g.toNonIndexed():g)),material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh)}
}
function shell(stations,material){
 const vertices=[],indices=[];
 for(const [z,width,top,bottom] of stations){
  const cross=[[-width+.08,bottom],[-width,bottom+.07],[-width,top-.09],[-width+.12,top],[width-.12,top],[width,top-.09],[width,bottom+.07],[width-.08,bottom]];
  for(const [x,y] of cross)vertices.push(x,y,z);
 }
 for(let j=0;j<stations.length-1;j++)for(let k=0;k<8;k++){const a=j*8+k,b=j*8+(k+1)%8,c=a+8,d=b+8;indices.push(a,c,b,b,c,d)}
 for(const end of [0,stations.length-1])for(let k=1;k<7;k++){const a=end*8;indices.push(a,a+k+(end===0?1:0),a+k+(end===0?0:1))}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();
 return new THREE.Mesh(g,material);
}
function driverOpening(mesh){
 const g=mesh.geometry,p=g.attributes.position,kept=[];
 for(let i=0;i<g.index.count;i+=3){
  const ids=[g.index.getX(i),g.index.getX(i+1),g.index.getX(i+2)];
  const z=ids.reduce((sum,id)=>sum+p.getZ(id),0)/3;
  if(ids.every(id=>p.getX(id)>.6)&&z>-.41&&z<.86)continue;
  kept.push(...ids);
 }
 g.setIndex(kept);g.computeVertexNormals();
}
export function makeDetailedCar(scene,isUte=false,color='#b94324'){
 const root=new THREE.Group(),body=new THREE.Group();root.add(body);body.position.y=isUte?.12:0;
 const paint=new THREE.MeshPhysicalMaterial({color,metalness:.42,roughness:.3,clearcoat:.8,clearcoatRoughness:.18,envMapIntensity:1.1});
 const lamp=new THREE.MeshStandardMaterial({color:'#fff2ca',emissive:'#ffe9b7',emissiveIntensity:.15,roughness:.15});
 const tail=new THREE.MeshStandardMaterial({color:'#a70d13',emissive:'#c91c13',emissiveIntensity:.18,roughness:.25});
 function part(geo,mat,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0){const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.rotation.set(rx,ry,rz);body.add(mesh);return mesh}
 function p(mat,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0){return part(box,mat,x,y,z,sx,sy,sz,rx,ry,rz)}
 const lower=shell(isUte?[[-.64,.97,.38,-.3],[-.4,.99,.39,-.29],[.9,1.03,.41,-.28],[2.17,.98,.38,-.27],[2.45,.91,.28,-.2]]:[[-2.45,.91,.29,-.26],[-2.25,1.035,.37,-.29],[-1.48,1.06,.39,-.29],[-.4,1.05,.39,-.29],[.85,1.04,.4,-.29],[2.18,1,.3,-.24],[2.45,.91,.23,-.19]],paint);driverOpening(lower);body.add(lower);
 // Sculpted bonnet and a sloping cabin instead of a stack of cubes.
 const cabin=shell(isUte?[[-.61,.93,.43,.34],[-.51,.83,1.22,.35],[-.4,.83,1.22,.35],[.55,.8,1.22,.35],[1.16,.94,.42,.34]]:[[-1.55,.94,.4,.33],[-.95,.82,1.0,.34],[-.4,.82,1.01,.34],[.57,.81,1.02,.34],[1.28,.95,.4,.34]],glass);driverOpening(cabin);
 body.add(cabin);
 p(paint,0,isUte?1.26:1.04,isUte?.02:-.17,1.7,.075,isUte?1.18:1.64);
 for(const side of [-1,1]){
  // A/B/C pillars, sills, door gaps, chrome handles and mirrors.
  p(paint,side*.86,isUte?.84:.72,.87,.065,isUte?.98:.82,.065,-.72);
  p(paint,side*.86,isUte?.84:.71,isUte?-.55:-1.22,.075,isUte?.85:.74,.075,isUte?.12:.66);
  if(!isUte)p(paint,side*.86,.73,-.28,.065,.6,.07);
  p(chrome,side*1.055,.49,isUte?.02:-.24,.025,.05,isUte?1.25:2.6);
  p(seam,side*1.063,.12,isUte?-.52:-.25,.012,.53,.017);
  p(seam,side*1.06,-.11,-.05,.015,.018,2.8);
  p(chrome,side*1.074,.39,isUte?-.3:-.52,.025,.055,.22);
  if(!isUte)p(chrome,side*1.074,.39,.56,.025,.055,.22);
  p(dark,side*1.18,.64,.81,.27,.18,.28,0,.15*side);
  p(chrome,side*1.325,.65,.81,.013,.13,.2);
  p(dark,side*1.055,-.18,0,.06,.09,3.6);
  // Curved wheel-arch lips and dark wheel wells.
  for(const z of [-1.49,1.49]){
   if(isUte&&z<0)continue;
   const arch=new THREE.TorusGeometry(isUte?.56:.51,.035,5,26,Math.PI);
   part(arch,paint,side*1.065,-.3,z,1,1,1,0,Math.PI/2,0);
   p(dark,side*1.03,-.15,z,.06,.19,.96);
  }
 }
 // Front fascia, recessed grille, split headlamps and amber indicators.
 p(dark,0,.08,2.42,1.7,.24,.08);
 for(let y=-.005;y<.2;y+=.055)p(chrome,0,y,2.47,.89,.017,.018);
 for(const side of [-1,1]){
  p(lamp,side*.67,.18,2.435,.47,.2,.07,0,side*.06);
  p(new THREE.MeshStandardMaterial({color:'#e8a437',roughness:.23}),side*.92,.16,2.39,.12,.17,.07);
  p(tail,side*.72,.15,-2.425,.43,.22,.07);
  p(lamp,side*.55,.13,-2.466,.09,.14,.02);
  p(dark,side*.5,-.2,2.29,.41,.12,.09);
 }
 p(chrome,0,-.08,2.44,1.9,.09,.07);p(chrome,0,-.08,-2.44,1.9,.09,.07);
 if(!isUte){
  p(dark,0,.17,-2.467,1.88,.26,.035);
  for(const side of [-1,1]){p(tail,side*.73,.2,-2.49,.5,.2,.03);p(lamp,side*.46,.17,-2.51,.08,.11,.02)}
  // A modest blown-V8 intake and long four-door VN-style silhouette.
  p(chrome,0,.54,1.62,.46,.24,.52);p(dark,0,.68,1.65,.48,.08,.58);
  for(const x of [-.14,0,.14])p(dark,x,.56,1.89,.10,.12,.02);
 }
 // Embossed-looking original number plate, not a third-party logo.
 const plate=document.createElement('canvas');plate.width=256;plate.height=64;const pc=plate.getContext('2d');pc.fillStyle='#eee8d3';pc.fillRect(0,0,256,64);pc.fillStyle='#263e42';pc.font='bold 37px sans-serif';pc.textAlign='center';pc.fillText(isUte?'GAZ-250':'BOG-042',128,45);
 const plateMat=new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(plate),roughness:.55});
 p(plateMat,0,.035,-2.477,.52,.135,.015);p(plateMat,0,-.07,2.49,.52,.135,.015);
 // Tailpipe, brake lamps, ute tray ribs, rear window and an actual esky.
 part(new THREE.CylinderGeometry(.075,.075,.34,12),chrome,-.77,-.29,-2.4,1,1,1,Math.PI/2);
 if(isUte){
  const tray=new THREE.MeshStandardMaterial({color:'#8a8e85',metalness:.65,roughness:.66,map:surfaces.metal.map});
  const tool=new THREE.MeshStandardMaterial({color:'#555d5c',metalness:.65,roughness:.55});
  p(dark,0,-.20,-1.42,1.43,.18,2.05);p(tray,0,.31,-1.43,2.15,.10,2.13);
  for(const side of [-1,1]){
   p(tray,side*1.04,.53,-1.43,.065,.35,2.12);
   for(const y of [.41,.51,.61])p(chrome,side*1.079,y,-1.43,.012,.017,2.08);
   p(dark,side*1.09,-.26,-1.9,.09,.46,.5);
   p(chrome,side*1.02,.97,-.52,.06,1.32,.06);
   p(chrome,side*1.02,1.38,-1.45,.065,.065,1.94);
   p(dark,side*.81,.48,2.62,.095,.75,.10);
   p(dark,side*1.02,.34,2.57,.08,.08,.24);
  }
  p(tray,0,.53,-2.46,2.15,.35,.07);
  p(chrome,0,1.62,-.52,2.1,.06,.06);p(chrome,0,1.38,-2.42,2.1,.06,.06);
  p(tool,0,.59,-.85,1.85,.47,.45);p(chrome,0,.83,-.85,1.9,.04,.49);
  p(dark,0,.77,2.66,1.84,.09,.09);p(dark,0,.2,2.63,2.18,.12,.13);
  // Snorkel, exposed tray chassis, ladder, toolbox and tied-down esky.
  p(dark,-1.0,.93,.94,.105,.92,.12);p(dark,-1.0,1.39,.87,.16,.12,.28);
  for(const side of [-1,1])p(chrome,side*.38,1.46,-1.35,.055,.055,2.1);
  for(let z=-2.3;z<-.35;z+=.28)p(chrome,0,1.46,z,.76,.04,.04);
  p(new THREE.MeshStandardMaterial({color:'#344a56',roughness:.8}),.45,.61,-1.7,.62,.48,.72);
  p(new THREE.MeshStandardMaterial({color:'#b7b1a0',roughness:.8}),.45,.86,-1.7,.65,.06,.76);
 }else{p(paint,0,.49,-2.06,1.9,.07,.29);for(const side of [-1,1])p(dark,side*.63,.39,-2.06,.07,.18,.12)}
 // Sidewall rings, five-spoke alloy rims, brake discs and exposed struts.
 buildInterior((geo,mat,x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0)=>part(geo,mat,x,y+(isUte?0:0),z,sx,sy,sz,rx,ry,rz),{zS:isUte?-.2:-.12,zD:isUte?.62:.74,rear:isUte?[]:[-1.05],roof:isUte?1.15:1.0,dx:1,width:.8,driver:false});
 mergeBody(body);
 const entryDoor=new THREE.Group();entryDoor.position.set(1.065,isUte?.12:0,.76);root.add(entryDoor);
 const doorPart=(mat,y,z,sy,sz)=>{const m=new THREE.Mesh(box,mat);m.position.set(0,y,z);m.scale.set(.055,sy,sz);m.castShadow=true;entryDoor.add(m)};
 doorPart(paint,.12,-.57,.53,1.14);doorPart(glass,isUte?.79:.69,-.55,isUte?.67:.5,1.02);
 doorPart(paint,isUte?1.16:.98,-.55,.045,1.12);
 // Inner door card, window sill seal and a pull handle that hinges at its front end.
 const trim=new THREE.Mesh(box,dark);trim.position.set(-.045,.1,-.57);trim.scale.set(.03,.46,1.04);entryDoor.add(trim);
 const seal=new THREE.Mesh(box,dark);seal.position.set(.0,isUte?.5:.43,-.55);seal.scale.set(.07,.035,1.1);entryDoor.add(seal);
 const handle=new THREE.Group();handle.position.set(.05,.43,-.84);entryDoor.add(handle);
 const handleBar=new THREE.Mesh(box,chrome);handleBar.position.set(.015,0,-.1);handleBar.scale.set(.03,.035,.2);handleBar.castShadow=true;handle.add(handleBar);
 entryDoor.userData.handle=handle;entryDoor.userData.handleLocal=new THREE.Vector3(.07,.43,-.94);
 const wheels=[],struts=[];
 for(const [x,z] of [[-1.08,1.49],[1.08,1.49],[-1.08,-1.49],[1.08,-1.49]]){
  const steering=new THREE.Group(),spin=new THREE.Group();steering.position.set(x,-.34,z);steering.add(spin);root.add(steering);
  const radius=isUte?.48:.43,tire=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,isUte?.34:.31,32,1),rubber);tire.rotation.z=Math.PI/2;spin.add(tire);
  for(const side of [-1,1]){
   const rim=new THREE.Mesh(new THREE.TorusGeometry(.285,.027,6,24),chrome);rim.rotation.y=Math.PI/2;rim.position.x=side*.151;spin.add(rim);
   const disk=new THREE.Mesh(new THREE.CylinderGeometry(.245,.245,.012,24),discMaterial);disk.rotation.z=Math.PI/2;disk.position.x=side*.13;spin.add(disk);
   for(let k=0;k<(isUte?6:5);k++){const a=k/(isUte?6:5)*Math.PI*2;const spoke=new THREE.Mesh(box,isUte?discMaterial:chrome);spoke.position.set(side*.155,Math.cos(a)*.14,Math.sin(a)*.14);spoke.scale.set(.025,.27,isUte?.075:.045);spoke.rotation.x=a;spin.add(spoke)}
   const hub=new THREE.Mesh(new THREE.CylinderGeometry(.075,.075,.02,12),chrome);hub.rotation.z=Math.PI/2;hub.position.x=side*.17;spin.add(hub);
  }
  mergeBody(spin);
  steering.userData.spin=spin;wheels.push(steering);
  const strut=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,1,8),chrome);strut.position.set(x,0,z);root.add(strut);struts.push(strut);
 }
 root.userData={wheels,struts,isUte,tail,body,entryDoor};scene.add(root);return root;
}

function addTradieDetails(model){
 const head=model.getObjectByName('mixamorigHead')||model.getObjectByName('mixamorig:Head');
 const hips=model.getObjectByName('mixamorigHips')||model.getObjectByName('mixamorig:Hips');
 if(!head)return;
 const skin=new THREE.MeshStandardMaterial({color:'#a97650',roughness:.96});
 const hair=new THREE.MeshStandardMaterial({color:'#28221f',roughness:1});
 const leather=new THREE.MeshStandardMaterial({color:'#392d24',roughness:1});
 const lens=new THREE.MeshStandardMaterial({color:'#151817',roughness:.28,metalness:.25});
 const sphere=new THREE.SphereGeometry(1,14,10);
 const details=new THREE.Group();details.name='OriginalTradieDetails';head.add(details);
 function part(parent,geometry,material,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0){
  const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.set(rx,ry,rz);m.castShadow=true;parent.add(m);return m;
 }
 // Close-cropped hair, receding temples, nose, heavy beard and wraparound sunnies.
 part(details,sphere,hair,0,17,0,9.5,5,10.5);
 part(details,sphere,hair,0,3.0,8.3,7.8,5.0,5.0);
 part(details,sphere,skin,0,7.8,12,1.7,2.1,2.2);
 for(const side of [-1,1]){
  part(details,box,hair,side*2.3,5.4,12.2,4.4,1.3,2.0,0,0,side*-.13);
  part(details,box,hair,side*7.2,7,4.5,2,10,5.0,0,side*.14);
  part(details,box,lens,side*3.5,11,11.8,6.5,3.0,1.8,0,side*.15);
  part(details,box,lens,side*7,11,6,.7,.7,11);
  part(details,sphere,skin,side*6.5,7.7,.2,1.3,2.1,1.1);
 }
 part(details,box,lens,0,11.3,12.2,2,.7,.8);
 mergeBody(details);
 const chest=model.getObjectByName('mixamorigSpine2');
 const shirt=new THREE.MeshStandardMaterial({color:'#b4ad36',roughness:.98});
 const navy=new THREE.MeshStandardMaterial({color:'#263540',roughness:1});
 const reflective=new THREE.MeshStandardMaterial({color:'#b5b9aa',roughness:.8});
 const cloth=new THREE.CylinderGeometry(1,1,1,10);
 if(chest){
  // A loose short-sleeve work shirt covers the segmented base rig.
  part(chest,cloth,shirt,0,-7,0,20,38,17.5);
  part(chest,cloth,navy,0,8,0,20.5,9,18);
  part(chest,cloth,navy,0,-23,0,20.2,6,17.7);
  part(chest,cloth,reflective,0,-4,0,20.35,3,17.85);
  part(chest,box,navy,-8,1,16.9,7,8,1);
 }
 for(const name of ['mixamorigLeftArm','mixamorigRightArm']){
  const arm=model.getObjectByName(name);if(arm)part(arm,cloth,shirt,0,6.5,0,7,15,7);
 }
 if(hips){
  const belt=new THREE.Group();belt.name='TradieToolBelt';hips.add(belt);
  part(belt,new THREE.TorusGeometry(14,1.2,6,28),leather,0,-1,0,1,1,.7,Math.PI/2);
  part(belt,box,chrome,0,-1,10.4,3,2.1,1);
  for(const side of [-1,1]){
   part(belt,box,leather,side*15,-6,1,6,9,5,0,0,side*.12);
   part(belt,box,chrome,side*17,-8,4,1.1,13,1.1,0,0,side*.15);
  }
  part(belt,box,discMaterial,-18,-13,4,5,2.5,3);
  mergeBody(belt);
 }
}

export class AnimatedLocal{
 constructor(scene){
  this.group=new THREE.Group();scene.add(this.group);this.group.visible=false;
  this.mixer=null;this.actions={};this.current='idle';this.loaded=false;this.speed=0;this.turn=0;this.override=null;
 }
 async load(){
  const asset=await loadBogan();this.asset=asset;
  const {root,body}=buildBogan(asset,PALETTES.player,{mullet:true,sunnies:true});
  const scale=1.80/asset.H;this.model=root;this.body=body;
  root.scale.setScalar(scale);root.position.y=-asset.box.min.y*scale;this.group.add(root);
  try{this.avatar=await attachPlayerAvatar(this.group,root)}catch(e){console.warn('player avatar failed, using default body',e)}
  this.mixer=new THREE.AnimationMixer(root);
  const loops={idle:'idle',walk:'walk',run:'jog',sprint:'sprint',swim:'swim',swimIdle:'swimIdle'};
  for(const [key,clip] of Object.entries(loops)){const a=this.mixer.clipAction(asset.clips[clip]);a.play();a.setEffectiveWeight(key==='idle'?1:0);this.actions[key]=a}
  this.once={};
  for(const n of ['jab','cross','hook','hit','death','knock']){const a=this.mixer.clipAction(asset.clips[n]);a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;this.once[n]=a}
  this.loaded=true;return this;
 }
 // One-shot clip (punches, hits, falls) that takes over from the locomotion blend until released.
 playOnce(name,speed=1,fade=.08){
  const a=this.once[name];if(!a)return 0;
  if(this.override&&this.override!==a)this.override.fadeOut(fade);
  a.reset();a.setEffectiveTimeScale(speed);a.setEffectiveWeight(1);a.fadeIn(fade);a.play();this.override=a;
  for(const l of Object.values(this.actions))l.setEffectiveWeight(0);
  return a.getClip().duration/speed;
 }
 release(fade=.15){
  if(!this.override)return;const a=this.override;this.override=null;a.fadeOut(fade);
 }
 spawnNPC(scene,x,z,height,walking=false){
  const idx=scene.userData.npcCount=(scene.userData.npcCount||0)+1;
  const {root:model}=buildBogan(this.asset,NPC_PALETTES[idx%NPC_PALETTES.length]);
  model.scale.setScalar(1.80/this.asset.H);model.position.y=-this.asset.box.min.y*1.80/this.asset.H;
  const root=new THREE.Group();root.add(model);root.position.set(x,height(x,z)+.13,z);scene.add(root);
  const mixer=new THREE.AnimationMixer(model),clips=this.asset.clips,acts={};
  for(const [k,c] of [['idle','idle'],['walk','walk'],['jab','jab'],['cross','cross'],['hook','hook'],['hit','hit'],['death','death']]){
   const a=mixer.clipAction(clips[c]);acts[k]=a;if(['jab','cross','hook','hit','death'].includes(k)){a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true}
  }
  const npc={root,model,mixer,acts,x,z,walking,time:Math.random()*20,cur:null,
   // V11: waypoint wander state — NPCs stroll between nearby spots instead of pacing on a sine.
   wp:null,wpWait:0,homeX:x,homeZ:z,
   play(name,fade=.18){
    const a=acts[name];if(!a||this.cur===a&&!(name==='jab'||name==='cross'||name==='hook'||name==='hit'))return;
    a.reset();a.setEffectiveWeight(1);a.setEffectiveTimeScale(name==='walk'?.9:1);a.play();
    if(this.cur&&this.cur!==a)this.cur.crossFadeTo(a,fade,false);this.cur=a;this.cur.name=name;
   },
   pickWaypoint(){
    const a=Math.random()*Math.PI*2,r=6+Math.random()*14;
    this.wp={x:this.homeX+Math.cos(a)*r,z:this.homeZ+Math.sin(a)*r};
   },
   update(dt){
    this.time+=dt;if(!this.rag)mixer.update(dt);
    if(this.cur===acts.death&&acts.death.time>2.1)acts.death.paused=true;
    if(this.aggro||this.down>0)return;
    if(!walking)return;
    if(!this.wp){this.wpWait-=dt;if(this.wpWait<=0)this.pickWaypoint();else if(this.cur!==acts.idle)this.play('idle')}
    else{
     const dx=this.wp.x-root.position.x,dz=this.wp.z-root.position.z,d=Math.hypot(dx,dz);
     if(d<.8){this.wp=null;this.wpWait=1.5+Math.random()*3.5;this.play('idle')}
     else{
      const step=Math.min(d,1.25*dt);
      root.position.x+=dx/d*step;root.position.z+=dz/d*step;
      root.position.y=height(root.position.x,root.position.z)+.13;
      const yaw=Math.atan2(dx,dz);
      let dy=yaw-root.rotation.y;dy=Math.atan2(Math.sin(dy),Math.cos(dy));root.rotation.y+=dy*Math.min(1,dt*6);
      if(this.cur!==acts.walk)this.play('walk');
     }
    }
   }};
  npc.play(walking?'walk':'idle');mixer.addEventListener('finished',()=>{if(!npc.down&&!npc.dead)npc.play(npc.aggro?'idle':(walking?'walk':'idle'))});
  return npc;
 }
 update(dt,speed,angle){
  if(!this.mixer)return;
  const target=this.swimming?(speed>.3?'swim':'swimIdle'):speed>.2?(speed>3.6?'sprint':speed>2.7?'run':'walk'):'idle';
  this.current=target;this.speed=speed;
  if(!this.override){
   for(const [name,a] of Object.entries(this.actions)){
    a.setEffectiveWeight(THREE.MathUtils.damp(a.getEffectiveWeight(),name===target?1:0,10,dt));
    a.setEffectiveTimeScale(name==='walk'?Math.max(.55,speed/1.7):name==='run'?Math.max(.7,speed/3.4):name==='sprint'?Math.max(.8,speed/6.2):name==='swim'?1:1);
   }
  }
  this.mixer.update(dt);this.swimming=false;
  if(speed>.1&&!this.override){const delta=Math.atan2(Math.sin(angle-this.group.rotation.y),Math.cos(angle-this.group.rotation.y));this.group.rotation.y+=delta*(1-Math.exp(-dt*12))}
 }
}

// Spring-driven car door: opens with a little overshoot, can be swung shut with a
// slam or a soft latch, and nudges the body on the suspension when it closes.
export class DoorRig{
 constructor(car,max=1.2){
  this.car=car;this.door=car.userData.entryDoor;this.body=car.userData.body;this.baseY=this.body?.position.y??0;
  this.max=max;this.a=0;this.w=0;this.target=0;this.stiff=0;this.damp=0;this.closeIn=-1;this.pull=0;this.pullTarget=0;
  this.kickY=0;this.kickV=0;this.kickR=0;this.kickRV=0;this.onEvent=null;this.settled=true;this.openedOnce=false;
 }
 get openness(){return this.a/this.max}
 open(){
  this.target=this.max*.9;this.stiff=105;this.damp=11.5;this.closeIn=-1;this.pullTarget=1;this.settled=false;
  this.onEvent?.('unlatch',1);
 }
 close(delay=0){this.closeIn=delay;this.pullTarget=0}
 reset(){this.a=this.w=this.target=0;this.closeIn=-1;this.pull=this.pullTarget=0;this.settled=true;this.apply()}
 update(dt){
  if(this.settled&&this.kickY===0&&this.kickR===0)return;
  dt=Math.min(dt,.033);
  if(this.closeIn>=0){this.closeIn-=dt;if(this.closeIn<0){this.target=-.35;this.stiff=62;this.damp=5.2;this.settled=false}}
  // Pull handle: eased in as the door opens and out once closed.
  this.pull+=(this.pullTarget-this.pull)*Math.min(1,dt*14);
  if(!this.settled){
   this.w+=((this.target-this.a)*this.stiff-this.w*this.damp)*dt;this.a+=this.w*dt;
   if(this.a>this.max){this.a=this.max;if(this.w>0)this.w*=-.25}
   if(this.a<=0){
    const hit=-this.w;this.a=0;
    if(this.target<0&&hit>.12){
     this.onEvent?.(hit>1.15?'slam':'latch',Math.min(1.8,hit));
     this.kickV-=Math.min(.45,hit*.2);this.kickRV+=Math.min(.35,hit*.12);
     this.w=hit>1.15?hit*.1:0;
     this.target=0;this.pullTarget=0;this.settled=true;this.w=0;
    }else if(this.target>=0)this.w=Math.max(0,this.w);
   }
  }
  // Body bounce on its suspension from a slam.
  this.kickV+=(-this.kickY*220-this.kickV*14)*dt;this.kickY+=this.kickV*dt;
  this.kickRV+=(-this.kickR*180-this.kickRV*12)*dt;this.kickR+=this.kickRV*dt;
  if(Math.abs(this.kickY)<1e-4&&Math.abs(this.kickV)<1e-3)this.kickY=this.kickV=0;
  if(Math.abs(this.kickR)<1e-4&&Math.abs(this.kickRV)<1e-3)this.kickR=this.kickRV=0;
  this.apply();
 }
 apply(){
  this.door.rotation.y=-this.a;
  const h=this.door.userData.handle;if(h)h.rotation.y=-.42*this.pull;
  if(this.body){this.body.position.y=this.baseY+this.kickY*.07;this.body.rotation.z=this.kickR*.05}
 }
 handleWorld(out=new THREE.Vector3()){this.door.updateWorldMatrix(true,true);return this.door.localToWorld(out.copy(this.door.userData.handleLocal))}
}
