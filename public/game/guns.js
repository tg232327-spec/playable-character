import * as THREE from 'three';
import { poseTradie } from './tradie-actions.js';
// V11 — simple guns, Aussie style: a pistol and a .22 bolt-action lookalike rifle.
// No arsenals, no attachments. Point, click, apologise to the local.
const GUNS=[
 {id:'pistol',label:'PISTOL',mag:10,ammo:10,dmg:38,rate:.45,range:55,spread:.035},
 {id:'rifle',label:'RIFLE',mag:5,ammo:5,dmg:70,rate:.9,range:90,spread:.008},
];
function box(w,h,d,color){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.45,metalness:.55}));return m}
function makeGun(id){
 const g=new THREE.Group();
 if(id==='pistol'){
  const body=box(.035,.055,.16,0x2b2b30);body.position.set(0,0,-.02);g.add(body);
  const slide=box(.038,.02,.14,0x3c3c44);slide.position.set(0,.038,-.03);g.add(slide);
  const grip=box(.034,.09,.045,0x513c2a);grip.position.set(0,-.06,.055);grip.rotation.x=.28;g.add(grip);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.006,.006,.05,8),new THREE.MeshStandardMaterial({color:0x191919,metalness:.7,roughness:.3}));barrel.rotation.x=Math.PI/2;barrel.position.set(0,.01,-.12);g.add(barrel);
  g.tip=new THREE.Object3D();g.tip.position.set(0,.01,-.15);g.add(g.tip);
 }else{
  const body=box(.04,.07,.42,0x3a2f1f);body.position.set(0,0,-.06);g.add(body);
  const barrel=new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,.34,8),new THREE.MeshStandardMaterial({color:0x24262b,metalness:.7,roughness:.3}));barrel.rotation.x=Math.PI/2;barrel.position.set(0,.012,-.4);g.add(barrel);
  const stock=box(.036,.075,.16,0x4a3a26);stock.position.set(0,-.012,.2);g.add(stock);
  const mag=box(.03,.07,.05,0x2a2a2e);mag.position.set(0,-.06,-.02);g.add(mag);
  const sight=box(.01,.025,.02,0x191919);sight.position.set(0,.05,-.2);g.add(sight);
  g.tip=new THREE.Object3D();g.tip.position.set(0,.012,-.58);g.add(g.tip);
 }
 g.visible=false;return g;
}
export function createGuns({scene,character,state,npcs,toast,tone}){
 const meshes=GUNS.map(g=>makeGun(g.id));
 // strap them to the right hand bone; the rig carries them through every anim.
 const hand=character.model.getObjectByName('hand_r');
 for(const m of meshes){if(hand)hand.add(m);else character.group.add(m)}
 let drawn=-1,cooldown=0,reloading=0;
 const tracers=[];
 function draw(i){drawn=drawn===i?-1:i;meshes.forEach((m,j)=>m.visible=j===drawn);
  if(drawn>=0){GUNS[drawn].ammo=GUNS[drawn].mag;toast(GUNS[drawn].label+' out. Left click to fire. Press '+(drawn+1)+' again to put it away.');tone(520,.06)}
  else toast('Gone quiet. Back to the fists.');}
 function fire(){
  if(drawn<0||cooldown>0||reloading>0)return false;
  const g=GUNS[drawn];
  if(g.ammo<=0){reloading=1.3;toast('Click. Reaching for another mag...');tone(180,.08);return true}
  g.ammo--;cooldown=g.rate;
  tone(90,.22,'square',.5);tone(1400,.05,'square',.25);
  // muzzle world position
  meshes[drawn].updateWorldMatrix(true,true);
  const muzzle=meshes[drawn].tip.getWorldPosition(new THREE.Vector3());
  const aim=Math.atan2(Math.sin(state.orbit),Math.cos(state.orbit));
  const fx=Math.sin(aim),fz=Math.cos(aim);
  // hitscan: nearest NPC inside a narrow cone.
  let best=null,bd=g.range;
  for(const n of npcs){
   const dx=n.root.position.x-state.walkX,dz=n.root.position.z-state.walkZ,d=Math.hypot(dx,dz);
   if(d>bd||n.down>0)continue;
   const dot=(dx*fx+dz*fz)/(d||1);
   if(dot>.965){best=n;bd=d}
  }
  const end=new THREE.Vector3(state.walkX+fx*g.range,state.walkY+1.35,state.walkZ+fz*g.range);
  if(best){
   best.health=Math.max(0,best.health-g.dmg);best.aggro=true;best.busy=.35;best.play('hit',.05);
   const dx=best.root.position.x-state.walkX,dz=best.root.position.z-state.walkZ,d=Math.hypot(dx,dz)||1;
   best.kx=(best.kx||0)+dx/d*4.5;best.kz=(best.kz||0)+dz/d*4.5;best.popY=(best.popY||0)+1.2;
   if(best.health<=0){best.down=9;best.aggro=false;toast((best.name||'The local')+' is down for a breather.')}
   end.set(best.root.position.x,best.root.position.y+1.2,best.root.position.z);
  }
  // tracer + flash
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([muzzle,end]),new THREE.LineBasicMaterial({color:0xffe9a0,transparent:true,opacity:.9}));
  scene.add(line);tracers.push({line,life:.07});
  const flash=new THREE.PointLight(0xffc966,3,4);flash.position.copy(muzzle);scene.add(flash);tracers.push({light:flash,life:.05});
  if(g.ammo===0){reloading=1.6;toast('Empty — swapping mags.')}
  return true;
 }
 return{
  GUNS,
  get drawn(){return drawn},
  draw,fire,
  update(dt){
   cooldown=Math.max(0,cooldown-dt);
   if(reloading>0){reloading-=dt;if(reloading<=0){const g=GUNS[drawn];if(g){g.ammo=g.mag;toast('Reloaded.')}}}
   for(let i=tracers.length-1;i>=0;i--){const t=tracers[i];t.life-=dt;
    if(t.line){t.line.material.opacity=Math.max(0,t.life/.07);if(t.life<=0){scene.remove(t.line);t.line.geometry.dispose();t.line.material.dispose();tracers.splice(i,1);continue}}
    if(t.light){t.light.intensity=Math.max(0,t.life/.05*3);if(t.life<=0){scene.remove(t.light);tracers.splice(i,1)}}
   }
   // point the right arm down range while drawn (works on top of the walk cycle).
   if(drawn>=0&&state.onFoot&&!state.sitting&&!state.onBus&&!state.swimming){
    const g=character.group;
    g.updateWorldMatrix(true,false);
    const target=g.localToWorld(new THREE.Vector3(Math.sin(state.orbit)*6,1.45,Math.cos(state.orbit)*6));
    poseTradie(character.model,g,'gun',0,0,target);
    g.rotation.y=state.orbit;
   }
  },
 };
}
