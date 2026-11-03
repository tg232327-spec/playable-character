import * as THREE from 'three';

// Pose the original rig, so the replacement avatar and held props follow it too.
// World-space limb directions avoid assumptions about the rig's local bone axes.
export class JumpAnimation {
 constructor(model,group){
  this.group=group;this.air=false;this.elapsed=0;this.landing=0;
  this.limbs=[];this.trunk=[];
  model.updateWorldMatrix(true,true);
  for(const side of ['l','r'])for(const [bone,child,kind] of [
   ['thigh','calf','thigh'],['calf','foot','calf'],
   ['upperarm','lowerarm','arm'],['lowerarm','hand','forearm']
  ]){
   const joint=model.getObjectByName(`${bone}_${side}`),tip=model.getObjectByName(`${child}_${side}`);
   if(joint&&tip)this.limbs.push({joint,direction:tip.position.clone().normalize(),kind,side:side==='l'?1:-1});
  }
  for(const name of ['spine_02','spine_03','neck_01']){
   const bone=model.getObjectByName(name);
   if(bone)this.trunk.push({bone,rest:bone.quaternion.clone()});
  }
 }
 update(dt,motion,enabled=true){
  const airborne=enabled&&!!motion&&motion.height>.025;
  if(!enabled){this.air=false;this.elapsed=0;this.landing=0;return}
  if(airborne&&!this.air){this.elapsed=0;this.landing=0}
  if(!airborne&&this.air)this.landing=.24;
  this.air=airborne;
  if(airborne)this.elapsed+=dt;
  else this.landing=Math.max(0,this.landing-dt);
  if(!airborne&&this.landing===0)return;
  const smooth=x=>{x=THREE.MathUtils.clamp(x,0,1);return x*x*(3-2*x)};
  const falling=airborne?smooth(-(motion?.velocity??0)/3.5):1;
  const tuck=airborne?1-falling:.65*Math.sin(Math.PI*this.landing/.24);
  const weight=airborne?smooth(this.elapsed/.09):smooth(this.landing/.24);
  const groupQ=this.group.getWorldQuaternion(new THREE.Quaternion());
  for(const {bone,rest} of this.trunk){
   const pitch=bone.name==='neck_01'?-.05:.07*tuck;
   const pose=rest.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),pitch));
   bone.quaternion.slerp(pose,weight);bone.updateWorldMatrix(false,true);
  }
  for(const {joint,direction,kind,side} of this.limbs){
   let desired;
   if(kind==='thigh')desired=new THREE.Vector3(side*.07,-1,.12+.58*tuck);
   else if(kind==='calf')desired=new THREE.Vector3(0,-1,-.12-.95*tuck);
   else if(kind==='arm')desired=new THREE.Vector3(side*.24,-1,.18+.5*tuck);
   else desired=new THREE.Vector3(side*.08,-1,.5+.35*tuck);
   desired.normalize().applyQuaternion(groupQ);
   const parent=joint.parent;if(!parent)continue;
   parent.updateWorldMatrix(true,false);
   desired.applyQuaternion(parent.getWorldQuaternion(new THREE.Quaternion()).invert());
   const pose=new THREE.Quaternion().setFromUnitVectors(direction,desired);
   joint.quaternion.slerp(pose,weight);joint.updateWorldMatrix(false,true);
  }
 }
}