import RAPIER from './rapier.es.js';
import * as THREE from 'three';

await RAPIER.init();

export class VehiclePhysics{
 constructor(terrain,colliders,height,surface,roads=[]){
  this.height=height;this.surface=surface;
  this.world=new RAPIER.World({x:0,y:-9.81,z:0});this.world.timestep=1/120;
  const vertices=new Float32Array(terrain.attributes.position.array),indices=new Uint32Array(terrain.index.array);
  this.world.createCollider(RAPIER.ColliderDesc.trimesh(vertices,indices).setFriction(.9));
  for(const road of roads){const g=road.geometry;this.world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(g.attributes.position.array),new Uint32Array(g.index.array)).setFriction(.95))}
  for(const b of colliders){
   const y=height(b.x,b.z),h=b.h??7;
   this.world.createCollider(RAPIER.ColliderDesc.cuboid(b.w,h/2,b.d).setTranslation(b.x,y+h/2,b.z).setFriction(.6).setRestitution(.12));
  }
  this.body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,height(0,102)+1.15,102).setLinearDamping(.04).setAngularDamping(.5).setCanSleep(false).setCcdEnabled(true));
  // A low-centred, 1400 kg chassis, not a position-controlled arcade sprite.
  this.world.createCollider(RAPIER.ColliderDesc.cuboid(1.02,.35,2.24).setTranslation(0,.13,0).setMass(1400).setFriction(.55).setRestitution(.1),this.body);
  this.world.createCollider(RAPIER.ColliderDesc.cuboid(.85,.35,1.04).setTranslation(0,.79,-.22).setDensity(0).setFriction(.4),this.body);
  this.controller=this.world.createVehicleController(this.body);this.controller.indexUpAxis=1;this.controller.setIndexForwardAxis=2;
  this.connections=[{x:-1.08,y:.12,z:1.49},{x:1.08,y:.12,z:1.49},{x:-1.08,y:.12,z:-1.49},{x:1.08,y:.12,z:-1.49}];
  this.wheels=this.connections.map((p,i)=>{
   this.controller.addWheel(p,{x:0,y:-1,z:0},{x:-1,y:0,z:0},.48,.43);
   this.controller.setWheelSuspensionStiffness(i,34);
   this.controller.setWheelSuspensionCompression(i,4.8);
   this.controller.setWheelSuspensionRelaxation(i,5.2);
   this.controller.setWheelMaxSuspensionTravel(i,.27);
   this.controller.setWheelMaxSuspensionForce(i,16000);
   this.controller.setWheelFrictionSlip(i,2.1);
   this.controller.setWheelSideFrictionStiffness(i,1);
   return {contact:false,compression:0,surface:'asphalt',grip:1,rotation:0,steer:0,normalLoad:0};
  });
  this.steer=0;this.speed=0;this.type=0;this.accumulator=0;this.distance=0;this.slip=0;this.burnout=false;this.rearSpin=0;
  this.teleport(0,102,Math.PI);
  this.dynamicProps=[];this.kinematics=[];this.npcVehicles=[];
 }
 teleport(x,z,angle){
  this.body.setTranslation({x,y:this.height(x,z)+1.05,z},true);
  this.body.setRotation({x:0,y:Math.sin(angle/2),z:0,w:Math.cos(angle/2)},true);
  this.body.setLinvel({x:0,y:0,z:0},true);this.body.setAngvel({x:0,y:0,z:0},true);this.steer=0;this.speed=0;this.accumulator=0;this.rearSpin=0;
  for(const w of this.wheels){w.angularSpeed=0;w.spinAngle=0}
 }
 step(dt,input,enabled=true){
  this.accumulator+=Math.min(dt,.1);
  const steps=Math.floor(this.accumulator*120);
  for(const k of this.kinematics)k.start={...k.body.translation()};
  for(let i=0;i<steps;i++){
   for(const k of this.kinematics)k.fraction=(i+1)/steps;
   this.fixedStep(1/120,input,enabled);this.accumulator-=1/120;
  }
 }
 fixedStep(dt,input,enabled){
  const velocity=this.body.linvel(),rotation=this.body.rotation(),q=new THREE.Quaternion(rotation.x,rotation.y,rotation.z,rotation.w);
  const fwd=new THREE.Vector3(0,0,1).applyQuaternion(q),right=new THREE.Vector3(1,0,0).applyQuaternion(q);
  this.speed=velocity.x*fwd.x+velocity.z*fwd.z;
  const lateral=velocity.x*right.x+velocity.z*right.z;
  this.slip=Math.atan2(Math.abs(lateral),Math.abs(this.speed)+2);
  const steerInput=enabled?input.steer:0;
  // Keep useful steering lock at speed. Tyre forces, not a near-zero steering
  // angle, now limit cornering. The old speed-squared curve felt unresponsive.
  const maxSteer=(this.type?.49:.56)/(1+Math.abs(this.speed)*(this.type?.028:.022));
  this.steer=THREE.MathUtils.damp(this.steer,steerInput*maxSteer,12,dt);
  this.burnout=!!(enabled&&input.burnout);
  const throttle=enabled?(this.burnout?1:input.throttle):0;
  const braking=throttle!==0&&throttle*this.speed<-.8;
  const engine=braking?0:throttle*(this.type?9300:12500)*(this.burnout?1.25:1)*Math.max(.18,1-Math.abs(this.speed)/(throttle<0?14:this.type?48:61));
  const chassis=this.body.translation();
  for(let i=0;i<4;i++){
   this.controller.setWheelSuspensionStiffness(i,this.type?36:38);
   this.controller.setWheelRadius(i,this.type?.48:.43);
   const local=this.connections[i],point=new THREE.Vector3(local.x,local.y,local.z).applyQuaternion(q).add(new THREE.Vector3(chassis.x,chassis.y,chassis.z));
   const ground=this.surface(point.x,point.z);
   const grip=ground==='asphalt'?1:ground==='gravel'?.7:ground==='sand'?.42:ground==='dirt'?.61:.66;
   const rear=i>=2,handbrake=enabled&&input.handbrake&&rear;
   this.controller.setWheelEngineForce(i,this.type&&!this.burnout?engine*(rear?.3:.2):rear?engine*.5:0);
   this.controller.setWheelBrake(i,!enabled?8:this.burnout?(rear?0:180):handbrake?75:braking?55:throttle===0?1.2:0);
   this.controller.setWheelSteering(i,i<2?this.steer:0);
   const loose=rear?(this.burnout?.32:this.type?2.45:Math.abs(throttle)>.1?.92:1.16):this.type?2.35:1.85;
   this.controller.setWheelFrictionSlip(i,grip*(handbrake?.32:loose));
   this.controller.setWheelSideFrictionStiffness(i,grip*(rear?(handbrake?.18:this.burnout?.24:this.type?1.45:.64):this.type?1.35:1.12));
   const w=this.wheels[i];w.surface=ground;w.grip=grip;w.traction=grip*loose;w.steer=i<2?this.steer:0;
   // Rotational tyre inertia: excess axle torque accelerates a slipping rear
   // tyre rather than making its visual rotation depend only on chassis speed.
   const rolling=this.speed/(this.type?.48:.43),load=w.normalLoad||3430;
   const excess=rear?Math.max(0,Math.abs(engine)*(this.type&&!this.burnout?.3:.5)-load*grip*(this.burnout?.28:this.type?2.2:.82)):0;
   const torque=excess*.43,omegaTarget=rolling+Math.sign(throttle)*Math.min(120,torque/14);
   w.angularSpeed=THREE.MathUtils.damp(w.angularSpeed??rolling,handbrake?0:rear?omegaTarget:rolling,excess>0?6:14,dt);
   w.spinAngle=(w.spinAngle??0)+w.angularSpeed*dt;
  }
  const wheelRadius=this.type?.48:.43;
  this.rearSpin=(Math.abs(this.wheels[2].angularSpeed-this.speed/wheelRadius)+Math.abs(this.wheels[3].angularSpeed-this.speed/wheelRadius))*.5;
  const speed3=Math.hypot(velocity.x,velocity.y,velocity.z);
  const surfaceDrag=this.wheels.reduce((s,w)=>s+(w.surface==='sand'?10:w.surface==='asphalt'?0:3),0)/4;
  this.body.resetForces(true);
  this.body.addForce({x:-velocity.x*(.45*speed3+surfaceDrag),y:0,z:-velocity.z*(.45*speed3+surfaceDrag)},true);
  this.controller.updateVehicle(dt,undefined,undefined,c=>c.parent()?.handle!==this.body.handle);
  for(const k of this.kinematics){
   const p=k.body.translation(),t=k.target,d=Math.hypot(t.x-p.x,t.z-p.z);
   if(d>90){k.body.setTranslation(t,true);k.start={...t}}
   const f=k.fraction??1,s=k.start??p;
   k.body.setNextKinematicTranslation({x:s.x+(t.x-s.x)*f,y:s.y+(t.y-s.y)*f,z:s.z+(t.z-s.z)*f});k.body.setNextKinematicRotation(k.mesh.quaternion);
  }
  for(const n of this.npcVehicles){
   const p=n.body.translation(),v=n.body.linvel(),q=n.body.rotation(),yaw=Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.y*q.y+q.z*q.z));
   const speed=v.x*Math.sin(yaw)+v.z*Math.cos(yaw),lane=n.direction>0?-3:3;
   if(Math.abs(v.x)>2.4)n.stun=4;
   if(Math.abs(p.x-lane)>7||1-2*(q.x*q.x+q.z*q.z)<.3)n.stun=Math.max(n.stun,12);
   n.stun=Math.max(0,n.stun-dt);n.crashed=n.stun>0;
   const desiredYaw=Math.atan2((lane-p.x),n.direction*14),error=Math.atan2(Math.sin(desiredYaw-yaw),Math.cos(desiredYaw-yaw));
   const steering=THREE.MathUtils.clamp(error*.9,-.43,.43),target=n.crashed?0:n.targetSpeed;
   const force=THREE.MathUtils.clamp((target-speed)*720,-1000,2400);
   for(let i=0;i<4;i++){
    n.controller.setWheelSteering(i,i<2&&!n.crashed?steering:0);
    n.controller.setWheelEngineForce(i,i>=2&&!n.crashed?force:0);
    n.controller.setWheelBrake(i,n.crashed?0:target<.3?170:speed>target+1?65:0);
   }
   n.controller.updateVehicle(dt,undefined,undefined,c=>c.parent()?.handle!==n.body.handle);
  }
  this.world.step();
  for(let i=0;i<4;i++){
   const w=this.wheels[i];w.contact=this.controller.wheelIsInContact(i);
   w.length=this.controller.wheelSuspensionLength(i)??.48;w.compression=.48-w.length;
   w.rotation=this.controller.wheelRotation(i)??0;
   w.normalLoad=this.controller.wheelSuspensionForce(i)??0;
  }
  this.distance+=Math.abs(this.speed)*dt;
 }
 addDynamicProp(mesh,{w=.32,h=.55,d=.32,mass=14}={}){
  const p=mesh.position,body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x,p.y,p.z).setLinearDamping(.2).setAngularDamping(.3).setCcdEnabled(true));
  this.world.createCollider(RAPIER.ColliderDesc.cuboid(w,h,d).setMass(mass).setFriction(.65).setRestitution(.25),body);
  this.dynamicProps.push({mesh,body,origin:p.clone()});return body;
 }
 addTraffic(mesh,w=1.05,h=.8,d=2.3,centerY=h*.5){
  const p=mesh.position,body=this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x,p.y,p.z).setRotation(mesh.quaternion));
  this.world.createCollider(RAPIER.ColliderDesc.cuboid(w,h,d).setTranslation(0,centerY,0).setFriction(.5).setRestitution(.08),body);
  const k={mesh,body,target:{x:p.x,y:p.y,z:p.z}};this.kinematics.push(k);return k;
 }
 addDynamicTraffic(mesh,direction=1){
  const p=mesh.position,body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x,p.y,p.z).setRotation(mesh.quaternion).setAngularDamping(.8).setLinearDamping(.04).setCcdEnabled(true));
  this.world.createCollider(RAPIER.ColliderDesc.cuboid(1.0,.34,2.24).setTranslation(0,.14,0).setMass(1250).setFriction(.55).setRestitution(.13),body);
  this.world.createCollider(RAPIER.ColliderDesc.cuboid(.8,.3,1.0).setTranslation(0,.75,-.2).setDensity(0),body);
  const controller=this.world.createVehicleController(body);controller.indexUpAxis=1;controller.setIndexForwardAxis=2;
  // Same order as the player's axle layout: the first two wheels are fronts.
  for(const [x,z] of [[-1.02,1.4],[1.02,1.4],[-1.02,-1.4],[1.02,-1.4]])controller.addWheel({x,y:.12,z},{x:0,y:-1,z:0},{x:-1,y:0,z:0},.45,.43);
  for(let i=0;i<4;i++){controller.setWheelSuspensionStiffness(i,32);controller.setWheelMaxSuspensionForce(i,18000);controller.setWheelSuspensionCompression(i,4.5);controller.setWheelSuspensionRelaxation(i,5);controller.setWheelFrictionSlip(i,2.0);controller.setWheelSideFrictionStiffness(i,1.2)}
  const n={mesh,body,controller,direction,targetSpeed:8,stun:0,crashed:false,initial:{position:{...body.translation()},rotation:{...body.rotation()}}};this.npcVehicles.push(n);return n;
 }
 resetTraffic(){
  for(const n of this.npcVehicles){n.body.setTranslation(n.initial.position,true);n.body.setRotation(n.initial.rotation,true);n.body.setLinvel({x:0,y:0,z:0},true);n.body.setAngvel({x:0,y:0,z:0},true);n.stun=0;n.crashed=false}
 }
 syncTraffic(){
  for(const n of this.npcVehicles){
   const p=n.body.translation(),q=n.body.rotation();n.mesh.position.set(p.x,p.y,p.z);n.mesh.quaternion.set(q.x,q.y,q.z,q.w);
   for(let i=0;i<4;i++){const w=n.mesh.userData.wheels[i];w.position.y=.12-(n.controller.wheelSuspensionLength(i)??.45)+(n.mesh.userData.wheelLift||0);w.rotation.y=n.controller.wheelSteering(i)??0;w.userData.spin.rotation.x=n.controller.wheelRotation(i)??0}
  }
 }
 syncWorldProps(){
  for(const p of this.dynamicProps){
   const v=p.body.translation(),q=p.body.rotation();p.mesh.position.set(v.x,v.y,v.z);p.mesh.quaternion.set(q.x,q.y,q.z,q.w);
  }
 }
 resetProps(){
  for(const p of this.dynamicProps){p.body.setTranslation(p.origin,true);p.body.setRotation({x:0,y:0,z:0,w:1},true);p.body.setLinvel({x:0,y:0,z:0},true);p.body.setAngvel({x:0,y:0,z:0},true)}
 }
 sync(car){
  const p=this.body.translation(),q=this.body.rotation();
  car.position.set(p.x,p.y,p.z);car.quaternion.set(q.x,q.y,q.z,q.w);
  const parts=car.userData.wheels;
  for(let i=0;i<4;i++){
   const w=this.wheels[i],part=parts[i];if(!part)continue;
   part.position.y=this.connections[i].y-(w.length??.48);
   part.rotation.y=w.steer;
   part.userData.spin.rotation.x=w.spinAngle??w.rotation;
   if(car.userData.struts?.[i]){const strut=car.userData.struts[i];strut.scale.y=Math.max(.12,w.length??.48);strut.position.y=.12-(w.length??.48)/2}
  }
  return {x:p.x,y:p.y,z:p.z,angle:Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.y*q.y+q.z*q.z)),speed:this.speed};
 }
}
