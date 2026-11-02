import * as THREE from 'three';
export function createStreetRules(scene,height,colliders){
 const junctions=[28,440],heads=[];
 const box=(w,h,d,color,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.75}));m.position.set(x,y,z);scene.add(m);return m};
 for(const z of junctions)for(const dir of [-1,1]){
  const x=-dir*7.3,pz=z-dir*9,y=height(x,pz);
  box(.16,4.8,.16,'#3c4540',x,y+2.4,pz);box(.48,1.35,.3,'#171d1d',x,y+4,pz);
  colliders.push({x,z:pz,w:.12,d:.12,h:4.8,kind:'signal'});
  const lamps=[];
  for(let i=0;i<3;i++){
   const mat=new THREE.MeshStandardMaterial({color:'#161c18',emissive:'#000000'});
   const lens=new THREE.Mesh(new THREE.CircleGeometry(.155,16),mat);lens.position.set(x,y+4.4-i*.4,pz-dir*.16);lens.rotation.y=dir>0?Math.PI:0;scene.add(lens);lamps.push(mat);
  }
  heads.push({lamps,z,dir});box(4,.025,.25,'#ddd8bd',-dir*3,y+.12,z-dir*10.5);
 }
 for(const dir of [-1,1]){
  const x=-dir*7.4,z=-125-dir*9,y=height(x,z);
  box(.07,2.4,.07,'#96978b',x,y+1.2,z);colliders.push({x,z,w:.08,d:.08,h:2.4,kind:'stop-sign'});
  const c=document.createElement('canvas');c.width=256;c.height=256;const ctx=c.getContext('2d');ctx.translate(128,128);ctx.beginPath();
  for(let i=0;i<8;i++){const a=Math.PI/8+i*Math.PI/4;ctx.lineTo(Math.cos(a)*120,Math.sin(a)*120)}ctx.closePath();ctx.fillStyle='#f6eddb';ctx.fill();ctx.lineWidth=12;ctx.strokeStyle='#f6eddb';ctx.stroke();ctx.fillStyle='#a92d26';ctx.fill();ctx.lineWidth=5;ctx.stroke();ctx.fillStyle='white';ctx.font='bold 65px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('STOP',0,5);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(.95,.95),new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(c),transparent:true,side:THREE.DoubleSide}));sign.position.set(x,y+2.1,z);sign.rotation.y=dir>0?Math.PI:0;scene.add(sign);
  box(4,.025,.28,'#ddd8bd',-dir*3,y+.12,-125-dir*10.5);
 }
 const phase=time=>{const t=time%28;return t<12?'green':t<15?'amber':'red'};
 return{
  phase,
  update(time){const p=phase(time);for(const h of heads)h.lamps.forEach((m,i)=>{const on=i===(p==='red'?0:p==='amber'?1:2),color=['#ff352a','#ffb632','#58dc81'][i];m.color.set(on?color:'#111c17');m.emissive.set(on?color:'#000000');m.emissiveIntensity=on?1.8:0})},
  limit(t,time,desired,dt){
   t.rule='cruise';
   for(const z of junctions){const d=(z-t.direction*10.5-t.z)*t.direction-2.4,p=phase(time);
    if(d>-.6&&d<65&&p!=='green'&&!(p==='amber'&&d<5)){desired=Math.min(desired,Math.sqrt(Math.max(0,d-.5)*3));t.rule=p==='red'?'red light':'amber light'}
   }
   const d=(-125-t.direction*10.5-t.z)*t.direction-2.4;
   if(d>-.8&&d<45&&!t.stopCleared){
    t.rule='stop sign';desired=Math.min(desired,Math.sqrt(Math.max(0,d-.25)*3));
    if(d<1.3&&(t.actualSpeed??t.speed)<.65){t.stopWait=(t.stopWait??0)+dt;if(t.stopWait>1.5){t.stopCleared=true;desired=3}}
   }
   return desired;
  }
 };
}
