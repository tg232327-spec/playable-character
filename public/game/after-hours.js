import * as THREE from 'three';

export function createSunset(scene){
 const material=new THREE.ShaderMaterial({
  side:THREE.BackSide,depthWrite:false,toneMapped:false,
  vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`varying vec3 direction;
  void main(){
   vec3 d=normalize(direction);float h=max(0.,d.y);
   vec3 horizon=vec3(.97,.48,.24),middle=vec3(.59,.30,.43),top=vec3(.16,.15,.29);
   vec3 color=mix(horizon,middle,smoothstep(0.,.32,h));
   color=mix(color,top,smoothstep(.22,.92,h));
   color=mix(vec3(.47,.31,.28),color,smoothstep(-.13,.015,d.y));
   float s=dot(d,normalize(vec3(1.,.085,-.30)));
   color+=vec3(.45,.19,.045)*pow(max(s,0.),30.);
   color=mix(color,vec3(1.,.83,.48),smoothstep(.99925,.99965,s));
   float cloud=sin(d.x*23.+sin(d.z*9.)*2.)*.5+.5;
   color=mix(color,color*.76,cloud*smoothstep(.10,.15,h)*(1.-smoothstep(.20,.24,h))*.38);
   gl_FragColor=vec4(color,1.);
  }`
 });
 const sky=new THREE.Mesh(new THREE.SphereGeometry(1550,32,20),material);sky.frustumCulled=false;sky.renderOrder=-100;scene.add(sky);
 return sky;
}

export function createTyreFX(scene,height){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
 const c=canvas.getContext('2d'),gradient=c.createRadialGradient(64,64,1,64,64,64);
 gradient.addColorStop(0,'rgba(230,224,217,.8)');gradient.addColorStop(.4,'rgba(206,199,190,.5)');gradient.addColorStop(1,'rgba(170,165,160,0)');
 c.fillStyle=gradient;c.fillRect(0,0,128,128);
 const texture=new THREE.CanvasTexture(canvas),particles=[];
 const marks=new THREE.InstancedMesh(new THREE.BoxGeometry(.23,.012,.85),new THREE.MeshStandardMaterial({color:'#171410',roughness:1,transparent:true,opacity:.72,depthWrite:false}),500);
 marks.count=0;marks.frustumCulled=false;scene.add(marks);
 const dummy=new THREE.Object3D(),p=new THREE.Vector3(),q=new THREE.Quaternion();
 let emission=0,markTime=0,markIndex=0,silence=0,combo=0,best=0,total=0,banked=0;
 return {
  get stats(){return {combo:Math.floor(combo),best:Math.floor(best),total:Math.floor(total),smoke:particles.length,marks:marks.count}},
  reset(){combo=best=total=banked=0;silence=emission=markTime=0;marks.count=0;markIndex=0;for(const p of particles){scene.remove(p.sprite);p.sprite.material.dispose()}particles.length=0},
  update(dt,rig,active,carMesh){
   let payout=0;
   if(active){
    const burning=rig.wheels.slice(2).some(w=>w.contact)&&(rig.rearSpin>9||(rig.slip>.18&&Math.abs(rig.speed)>5));
    if(burning){
     const points=dt*(20+Math.min(110,rig.rearSpin)*1.5+rig.slip*90);
     combo+=points;total+=points;silence=0;emission+=dt;markTime+=dt;
     const body=rig.body.translation(),rotation=rig.body.rotation();q.set(rotation.x,rotation.y,rotation.z,rotation.w);
     if(emission>.065){
      emission=0;
      // V11: smoke now rises from the visible wheel meshes, not the physics connection points.
      const wheelParts=carMesh&&carMesh.userData&&carMesh.userData.wheels;
      for(const local of rig.connections.slice(2)){
       if(wheelParts){
        const part=local.z<0?wheelParts[2]:wheelParts[3];
        if(part){part.getWorldPosition(p)}else{p.set(local.x,0,local.z).applyQuaternion(q).add(new THREE.Vector3(body.x,0,body.z))}
       }else{
        p.set(local.x,0,local.z).applyQuaternion(q).add(new THREE.Vector3(body.x,0,body.z));
       }
       if(particles.length<64){
        const material=new THREE.SpriteMaterial({map:texture,color:'#d3c0ad',transparent:true,opacity:.45,depthWrite:false,rotation:Math.random()*6});
        const sprite=new THREE.Sprite(material);sprite.position.set(p.x,height(p.x,p.z)+.35,p.z);sprite.scale.setScalar(.8);scene.add(sprite);
        particles.push({sprite,life:3.3,max:3.3,dx:(Math.random()-.5)*.7,dz:(Math.random()-.5)*.7});
       }
       if(markTime>.07&&rig.surface(p.x,p.z)==='asphalt'){
        dummy.position.set(p.x,height(p.x,p.z)+.105,p.z);dummy.rotation.set(0,Math.atan2(2*q.w*q.y,1-2*q.y*q.y),0);dummy.updateMatrix();
        marks.setMatrixAt(markIndex++%500,dummy.matrix);marks.count=Math.min(500,markIndex);marks.instanceMatrix.needsUpdate=true;
       }
      }
      if(markTime>.07)markTime=0;
     }
    }else if(combo>0){
     silence+=dt;
     if(silence>1.4){best=Math.max(best,combo);payout=Math.min(250,Math.floor(combo/25));banked+=payout;combo=0;silence=0}
    }
   }
   for(let i=particles.length-1;i>=0;i--){
    const s=particles[i];s.life-=dt;s.sprite.position.x+=s.dx*dt;s.sprite.position.z+=s.dz*dt;s.sprite.position.y+=dt*.8;
    s.sprite.scale.multiplyScalar(1+dt*.65);s.sprite.material.opacity=Math.max(0,s.life/s.max*.44);
    if(s.life<=0){scene.remove(s.sprite);s.sprite.material.dispose();particles.splice(i,1)}
   }
   return payout;
  }
 };
}
