import * as THREE from 'three';
const cache=new WeakMap(),V=()=>new THREE.Vector3();
// Quaternius rig bone names -> the names the posing code uses.
const MAP={Hips:'pelvis',Spine:'spine_01',Spine1:'spine_02',Spine2:'spine_03',Neck:'neck_01',Head:'Head',
 LeftShoulder:'clavicle_l',LeftArm:'upperarm_l',LeftForeArm:'lowerarm_l',LeftHand:'hand_l',LeftUpLeg:'thigh_l',LeftLeg:'calf_l',LeftFoot:'foot_l',LeftToeBase:'ball_l',
 RightShoulder:'clavicle_r',RightArm:'upperarm_r',RightForeArm:'lowerarm_r',RightHand:'hand_r',RightUpLeg:'thigh_r',RightLeg:'calf_r',RightFoot:'foot_r',RightToeBase:'ball_r'};
function rig(model){
 if(cache.has(model))return cache.get(model);
 const raw={},skins=[];model.traverse(o=>{if(o.isBone)raw[o.name]=o;if(o.isSkinnedMesh)skins.push(o)});
 const bones={skin:skins[0]};for(const k in MAP)bones[k]=raw[MAP[k]];
 cache.set(model,bones);return bones;
}
const _wq=new THREE.Quaternion(),_pq=new THREE.Quaternion(),_rq0=new THREE.Quaternion(),_e=new THREE.Euler(),_d=new THREE.Quaternion();
// Rotate a bone about the root's own X / Y / Z axes (x = left, y = up, z = forward), whatever the bone's local axes are.
function addRot(bone,root,x=0,y=0,z=0){
 if(!bone||(!x&&!y&&!z))return;
 root.updateWorldMatrix(true,false);root.getWorldQuaternion(_rq0);
 bone.parent.updateWorldMatrix(true,false);bone.updateWorldMatrix(false,false);
 _e.set(x,y,z,'XYZ');_d.setFromEuler(_e);
 // world delta = R * d * R^-1
 const R=_rq0,W=new THREE.Quaternion().copy(R).multiply(_d).multiply(_pq.copy(R).invert());
 bone.getWorldQuaternion(_wq);_wq.premultiply(W);
 bone.parent.getWorldQuaternion(_pq);bone.quaternion.copy(_pq.invert().multiply(_wq));bone.updateWorldMatrix(false,true);
}
function bindPose(model){const b=rig(model);b.skin&&b.skin.skeleton.pose();model.updateMatrixWorld(true)}
function aim(bone,child,target){
 if(!bone||!child)return;bone.updateWorldMatrix(true,true);
 const p=bone.getWorldPosition(V()),from=child.getWorldPosition(V()).sub(p).normalize(),to=target.clone().sub(p).normalize();
 const q=new THREE.Quaternion().setFromUnitVectors(from,to).multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
 bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));bone.updateWorldMatrix(false,true);
}
function arm(model,root,side,local){
 const b=rig(model),upper=b[side+'Arm'],lower=b[side+'ForeArm'],hand=b[side+'Hand'];if(!upper)return;
 root.updateWorldMatrix(true,true);const target=root.localToWorld(local.clone()),a=upper.getWorldPosition(V()),e=lower.getWorldPosition(V()),h=hand.getWorldPosition(V());
 const l1=a.distanceTo(e),l2=e.distanceTo(h),dir=target.clone().sub(a),d=THREE.MathUtils.clamp(dir.length(),.04,l1+l2-.005);dir.normalize();
 const along=(l1*l1-l2*l2+d*d)/(2*d),out=root.localToWorld(new THREE.Vector3(side==='Right'?-.4:.4,.95,.1)).sub(a);
 out.addScaledVector(dir,-out.dot(dir)).normalize();
 const elbow=a.clone().addScaledVector(dir,along).addScaledVector(out,Math.sqrt(Math.max(0,l1*l1-along*along)));
 aim(upper,lower,elbow);aim(lower,hand,target);
}
const _q=new THREE.Quaternion(),_p=new THREE.Quaternion(),_a=new THREE.Vector3(0,1,0);
// Twist a bone about the world up axis, whatever its local axes are.
function twist(bone,angle){
 if(!bone||!angle)return;bone.parent.updateWorldMatrix(true,false);
 bone.parent.getWorldQuaternion(_p);_q.setFromAxisAngle(_a,angle);
 bone.quaternion.premultiply(_p.clone().invert().multiply(_q).multiply(_p));
}

// Keep the rider's spine and head upright in the vehicle's frame, whatever the pose maths did:
// measures the sideways lean of pelvis->neck and head, and rolls it back about the vehicle's forward axis.
const _f=new THREE.Vector3(),_u=new THREE.Vector3(),_w=new THREE.Quaternion(),_rq=new THREE.Quaternion(),_ir=new THREE.Quaternion();
function rollBone(bone,root,axisUp){
 if(!bone)return;root.updateWorldMatrix(true,false);root.getWorldQuaternion(_rq);_ir.copy(_rq).invert();
 bone.updateWorldMatrix(true,false);
 axisUp(_u).applyQuaternion(_ir); // direction in the vehicle frame
 const ang=Math.atan2(_u.x,_u.y);if(Math.abs(ang)<1e-4)return;
 _f.set(0,0,1).applyQuaternion(_rq);
 _q.setFromAxisAngle(_f,ang);bone.parent.updateWorldMatrix(true,false);bone.parent.getWorldQuaternion(_p);bone.getWorldQuaternion(_w);
 _w.premultiply(_q);bone.quaternion.copy(_p.invert().multiply(_w));bone.updateWorldMatrix(false,true);
}
function level(model,root){
 const b=rig(model);if(!b.Hips||!b.Spine)return;
 const hips=V(),head=V();
 for(let i=0;i<2;i++){
  rollBone(b.Spine,root,o=>{b.Hips.getWorldPosition(hips);(b.Neck||b.Head).getWorldPosition(head);return o.copy(head).sub(hips).normalize()});
  rollBone(b.Spine1||b.Spine,root,o=>{b.Hips.getWorldPosition(hips);(b.Neck||b.Head).getWorldPosition(head);return o.copy(head).sub(hips).normalize()});
 }
 rollBone(b.Head,root,o=>o.set(0,1,0).applyQuaternion(b.Head.getWorldQuaternion(_w)));
}
export function poseTradie(model,root,kind,t,attack=0,extra=null){
 const b=rig(model);if(!b.Hips)return;
 const R=(bone,x,y,z)=>addRot(bone,root,x,y,z);
 // V11: gun aim — right arm tracks the aim target on top of whatever the anim mixer did.
 // Applies after update() each frame, so it must not bindPose.
 if(kind==='gun'){
  const target=extra;
  arm(model,root,'Right',target);
  return;
 }
 if(kind==='scooter'){
  // V11: proper forward stance — squared up to the bars, feet staggered along the deck,
  // knees soft; a tail whip scissor-kicks the legs as the deck spins underneath.
  bindPose(model);
  const lean=THREE.MathUtils.clamp(Math.abs(t.speed)/8,0,1),tuck=t.tuck||0,wh=t.wheelie||0,whip=t.whip||0;
  const crouch=.12+lean*.06+tuck*.32+wh*.12+whip*.25;
  R(b.Hips,.06-lean*.04-wh*.28,0,0);R(b.Spine,.03+lean*.03-wh*.12,.1,0);R(b.Spine1,.02,.05,0);R(b.Head,-.07,.08,0);
  R(b.LeftUpLeg,-.62-crouch*.5,0,-.04);R(b.LeftLeg,.85+crouch*.7,0,0);R(b.LeftFoot,-.2,0,0);
  R(b.RightUpLeg,-.28-crouch*.5,0,.06);R(b.RightLeg,.55+crouch*.7,0,0);R(b.RightFoot,-.12,0,0);
  if(whip>0){const k=Math.sin(Math.min(whip,1)*Math.PI);R(b.Hips,0,k*.5,0);R(b.LeftUpLeg,-k*.45,0,k*.1);R(b.RightUpLeg,k*.5,0,-k*.28);R(b.Spine,0,-k*.25,0)}
  level(model,root);arm(model,root,'Left',t.gl);arm(model,root,'Right',t.gr);return;
 }
 if(kind==='sit'){
  // V11: seated pose for couch / stool / bed — hips back, thighs level, knees bent.
  bindPose(model);
  R(b.Hips,-.06,0,0);R(b.Spine,-.04,.02,0);R(b.Spine1,.03,.02,0);R(b.Head,.03,0,0);
  R(b.LeftUpLeg,-1.45,0,-.05);R(b.LeftLeg,1.4,0,0);R(b.LeftFoot,-.15,0,0);
  R(b.RightUpLeg,-1.42,0,.05);R(b.RightLeg,1.38,0,0);R(b.RightFoot,-.12,0,0);
  arm(model,root,'Left',new THREE.Vector3(-.34,.62,.34));arm(model,root,'Right',new THREE.Vector3(.34,.62,.34));
  return;
 }
 if(kind==='jetski'){
  // Straddling the seat, leaning into the bars; thighs open, knees bent onto the footwells.
  bindPose(model);
  const lean=t.lean;
  R(b.Hips,-.1-lean*.12,0,0);R(b.Spine,.05+lean*.08,0,0);R(b.Head,-.08-lean*.06,0,0);
  for(const [side,s] of [['Left',1],['Right',-1]]){
   R(b[side+'UpLeg'],-1.0,0,s*.34);R(b[side+'Leg'],1.25,0,0);R(b[side+'Foot'],-.2,0,0);
  }
  level(model,root);arm(model,root,'Left',t.gl);arm(model,root,'Right',t.gr);return;
 }
 if(kind==='entry'){
  bindPose(model);
  R(b.Spine,.5*Math.sin(t*Math.PI),0,0);R(b.Head,.22,0,0);R(b.Hips,0,-.3,0);
  R(b.LeftUpLeg,-.8*t,0,0);R(b.RightUpLeg,-t,0,0);R(b.LeftLeg,1.15*t,0,0);R(b.RightLeg,1.4*t,0,0);
  if(extra?.hand){root.updateWorldMatrix(true,false);const s=extra.side||'Right';arm(model,root,s,root.worldToLocal(extra.hand.clone()));if(s==='Left')arm(model,root,'Right',new THREE.Vector3(-.4,1.13,.35))}
  else arm(model,root,'Right',new THREE.Vector3(-.4,1.13,.35));return;
 }
}
// Punches, hooks, hits and falls use real keyframed clips from the Quaternius Universal Animation Library (CC0).
export const MOVES=[
 {name:'JAB',clip:'jab',speed:1.15,hit:.24,reach:1.8,dmg:26,push:.35},
 {name:'CROSS',clip:'cross',speed:1.1,hit:.3,reach:1.9,dmg:34,push:.5},
 {name:'HOOK',clip:'hook',speed:.9,hit:.3,reach:1.8,dmg:30,push:.5},
 {name:'HAYMAKER',clip:'hook',speed:.6,hit:.46,reach:2.1,dmg:42,push:.9},
];
export function createBrawling(state,character,npcs,height,blocked,impact,toast){
 let attack=null,combo=0,health=100,hits=0,cooldown=0,down=0,fell=false;
 for(const n of npcs){n.health=100;n.aggro=false;n.down=0;n.cooldown=1;n.busy=0;n.fell=false}
 function cancel(){if(attack){attack=null;character.release()}}
 return{
  cancel,
  reset(){cancel();health=100;down=0;hits=0;fell=false;character.release();for(const n of npcs){n.health=100;n.aggro=false;n.down=0;n.busy=0;n.fell=false;n.play(n.walking?'walk':'idle');n.root.position.set(n.x,height(n.x,n.z)+.13,n.z)}},
  attack(){
   if(!state.started||state.paused||!state.onFoot||state.onBus||state.swimming||state.ride||attack||cooldown>0||down>0)return;
   const mv=MOVES[combo++%MOVES.length];
   attack={mv,kind:MOVES.indexOf(mv),time:0,hit:false,dur:0};
   let aim=state.orbit,bd=3.2;for(const n of npcs){const dx=n.root.position.x-state.walkX,dz=n.root.position.z-state.walkZ,d=Math.hypot(dx,dz);if(d<bd&&n.down<=0){bd=d;aim=Math.atan2(dx,dz)}}
   character.group.rotation.y=aim;attack.dur=character.playOnce(mv.clip,mv.speed);toast(mv.name);
  },
  update(dt){
   cooldown=Math.max(0,cooldown-dt);down=Math.max(0,down-dt);const root=character.group;
   if(attack&&state.onFoot&&!state.swimming){
    attack.time+=dt;
    if(!attack.hit&&attack.time>attack.mv.hit/attack.mv.speed*1.0){attack.hit=true;const mv=attack.mv;
     for(const n of npcs){const dx=n.root.position.x-state.walkX,dz=n.root.position.z-state.walkZ,d=Math.hypot(dx,dz),dot=(dx*Math.sin(root.rotation.y)+dz*Math.cos(root.rotation.y))/(d||1);
      if(d<mv.reach&&dot>.3&&n.down<=0){n.health=Math.max(0,n.health-mv.dmg);n.aggro=true;n.cooldown=1;hits++;impact();n.busy=.35;n.play('hit',.05);
       // V11: knockback is a proper shove — a burst of velocity with a vertical pop, not a teleport.
       const kx=dx/(d||1)*mv.push*6,kz=dz/(d||1)*mv.push*6;
       n.kx=(n.kx||0)+kx;n.kz=(n.kz||0)+kz;n.popY=(n.popY||0)+mv.push*1.6;
       if(n.health<=0){n.down=9;n.aggro=false;toast((n.name||'The local')+' is down for a breather.')}
      }
     }
    }
    if(attack.time>=attack.dur-.05){attack=null;cooldown=.04;character.release()}
   }
   if(down>0&&!fell){fell=true;attack=null;character.playOnce('knock',1,.05)}
   else if(down<=0&&fell){fell=false;character.release(.25)}
   for(const n of npcs){
    n.busy=Math.max(0,n.busy-dt);
    // V11: knockback integration — velocity decays, pop arcs under gravity.
    if(n.kx||n.kz||n.popY>0){
     n.kx=(n.kx||0)*(1-Math.min(1,dt*6));n.kz=(n.kz||0)*(1-Math.min(1,dt*6));n.popY=Math.max(0,(n.popY||0)-dt*9.8);
     const nx=n.root.position.x+n.kx*dt,nz=n.root.position.z+n.kz*dt;
     if(!blocked(nx,nz,.3))n.root.position.set(nx,height(nx,nz)+.13+Math.max(0,n.popY)*.18,nz);
     if(Math.abs(n.kx)<.05)n.kx=0;if(Math.abs(n.kz)<.05)n.kz=0;
    }
    if(n.down>0){
     if(!n.fell){n.fell=true;n.aggro=false;n.play('death',.08)}
     n.down-=dt;if(n.down<=0){n.fell=false;n.health=100;n.play(n.walking?'walk':'idle',.4)}continue}
    if(!n.aggro)continue;
    n.cooldown-=dt;const dx=state.walkX-n.root.position.x,dz=state.walkZ-n.root.position.z,d=Math.hypot(dx,dz);
    if(!state.onFoot||state.onBus||state.swimming||d>22){n.aggro=false;n.play(n.walking?'walk':'idle');continue}
    n.root.rotation.y=Math.atan2(dx,dz);
    if(n.busy<=0){
     if(d>1.35){const x=n.root.position.x+dx/(d||1)*dt*1.75,z=n.root.position.z+dz/(d||1)*dt*1.75;if(!blocked(x,z,.3))n.root.position.set(x,height(x,z)+.13,z);n.play('walk')}
     else n.play('idle');
    }
    if(n.strike>0){n.strike-=dt;if(n.strike<=0&&d<1.9&&down<=0){health=Math.max(0,health-12);impact();
     // V11: the player takes a shove too.
     state.walkX+=dx/(d||1)*-.22;state.walkZ+=dz/(d||1)*-.22;
     if(health===0){down=3;health=45;n.aggro=false;toast('Seeing stars. Take a breather.')}}}
    if(n.cooldown<=0&&d<1.7&&n.busy<=0){n.cooldown=1.65;n.busy=.8;n.strike=.3;n.play(Math.random()<.5?'jab':'cross',.1)}
   }
   // V11: NPCs no longer stack — gentle separation between brawlers and wanderers.
   for(let i=0;i<npcs.length;i++)for(let j=i+1;j<npcs.length;j++){
    const a=npcs[i],c=npcs[j];if(a.down>0||c.down>0)continue;
    const dx=c.root.position.x-a.root.position.x,dz=c.root.position.z-a.root.position.z,d=Math.hypot(dx,dz);
    if(d<.9&&d>1e-4){const push=(0.9-d)*.5,nx=dx/d,nz=dz/d;
     const ax=a.root.position.x-nx*push,az=a.root.position.z-nz*push,cx=c.root.position.x+nx*push,cz2=c.root.position.z+nz*push;
     if(!blocked(ax,az,.3))a.root.position.set(ax,height(ax,az)+.13,az);
     if(!blocked(cx,cz2,.3))c.root.position.set(cx,height(cx,cz2)+.13,cz2);}
   }
   if(!npcs.some(n=>n.aggro)&&!attack&&health<100)health=Math.min(100,health+dt*2);
   const target=npcs.find(n=>n.aggro);
   const el=document.getElementById('scrap-status');if(el)el.textContent=`${state.swimming?'IN THE DRINK':attack?attack.mv.name:down>0?'SEEING STARS':'FISTS / LEFT CLICK'} · ${Math.ceil(health)} HP${target?' / LOCAL '+target.health+' HP':''}`;
  },
  status:()=>({attack:attack?attack.mv.name:null,phase:attack?+(attack.time/attack.dur).toFixed(2):0,health:Math.ceil(health),hits,combo:combo%MOVES.length,npcs:npcs.map(n=>({hp:n.health,aggro:n.aggro,down:+n.down.toFixed(1),x:+n.root.position.x.toFixed(1),z:+n.root.position.z.toFixed(1)}))})
 };
}
