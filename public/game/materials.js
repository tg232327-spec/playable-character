import * as THREE from 'three';

let seed=7351;
const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
export function makeSurface(kind){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
 const c=canvas.getContext('2d');
 c.fillStyle=kind==='asphalt'?'#a3a3a3':'#cdcdcd';c.fillRect(0,0,512,512);
 // Multi-scale grain rather than flat colours. All texture data is original.
 for(let i=0;i<22000;i++){
  const value=kind==='asphalt'?95+random()*90:160+random()*92;
  c.fillStyle=`rgba(${value},${value},${value},${.15+random()*.35})`;
  const size=random()<.06?3:1;c.fillRect(random()*512,random()*512,size,size);
 }
 if(kind==='grass'||kind==='sand'||kind==='dirt'){
  for(let i=0;i<2500;i++){
   const x=random()*512,y=random()*512,v=120+random()*130;
   c.strokeStyle=`rgba(${v},${v},${v},.25)`;c.lineWidth=kind==='grass'?1:2;
   c.beginPath();c.moveTo(x,y);c.lineTo(x+(random()-.5)*10,y-2-random()*7);c.stroke();
  }
  for(let i=0;i<140;i++){c.fillStyle=`rgba(80,80,80,${random()*.08})`;c.beginPath();c.ellipse(random()*512,random()*512,8+random()*35,5+random()*15,random()*3,0,7);c.fill()}
 }
 if(kind==='wood'){
  for(let y=0;y<512;y+=32){
   const grad=c.createLinearGradient(0,y,0,y+32);grad.addColorStop(0,'#ededed');grad.addColorStop(.15,'#cecece');grad.addColorStop(.92,'#bfbfbf');grad.addColorStop(1,'#717171');
   c.fillStyle=grad;c.fillRect(0,y,512,32);
   for(let j=0;j<22;j++){c.strokeStyle=`rgba(70,70,70,${random()*.15})`;c.beginPath();c.moveTo(0,y+random()*30);c.lineTo(512,y+random()*30);c.stroke()}
   for(const x of [7,258]){c.fillStyle='#858585';c.fillRect(x,y+4,2,2)}
  }
 }
 if(kind==='brick'){
  c.fillStyle='#a2a2a2';c.fillRect(0,0,512,512);
  for(let y=0;y<512;y+=32)for(let x=-64;x<512;x+=96){
   const xx=x+(y%64?48:0),value=160+random()*65;c.fillStyle=`rgb(${value},${value},${value})`;c.fillRect(xx+2,y+2,92,28);
   c.fillStyle='#ededed44';c.fillRect(xx+3,y+3,91,2);
  }
 }
 if(kind==='metal'){
  for(let x=0;x<512;x+=16){const g=c.createLinearGradient(x,0,x+16,0);g.addColorStop(0,'#787878');g.addColorStop(.3,'#dddddd');g.addColorStop(.8,'#b9b9b9');g.addColorStop(1,'#787878');c.fillStyle=g;c.fillRect(x,0,16,512)}
  for(let i=0;i<90;i++){c.fillStyle='#635c4c18';c.fillRect(random()*512,random()*512,2,10+random()*50)}
 }
 if(kind==='tile'){
  for(let y=0;y<512;y+=48)for(let x=0;x<512;x+=32){const g=c.createLinearGradient(x,0,x+32,0);g.addColorStop(0,'#858585');g.addColorStop(.4,'#eeeeee');g.addColorStop(1,'#bababa');c.fillStyle=g;c.fillRect(x,y,31,46);c.fillStyle='#777777';c.fillRect(x,y+44,32,3)}
 }
 const t=new THREE.CanvasTexture(canvas);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;
 const bump=t.clone();bump.colorSpace=THREE.NoColorSpace;bump.needsUpdate=true;
 return {map:t,bumpMap:bump};
}
export const surfaces=Object.fromEntries(['asphalt','grass','sand','dirt','wood','brick','metal','tile'].map(k=>[k,makeSurface(k)]));
export function texturedMaterial(color,kind,opts={}){
 return new THREE.MeshStandardMaterial({color,...surfaces[kind],roughness:kind==='metal'?.62:.95,bumpScale:kind==='brick'?.08:kind==='metal'?.025:.045,...opts});
}
export function worldUV(geometry,scale=4){
 const p=geometry.attributes.position,n=geometry.attributes.normal,uv=new Float32Array(p.count*2);
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i));uv[i*2]=(ny>.55?x:nx>.55?z:x)/scale;uv[i*2+1]=(ny>.55?z:y)/scale}
 geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));return geometry;
}

export function createEnvironment(renderer){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
 const c=canvas.getContext('2d'),g=c.createLinearGradient(0,0,0,512);
 g.addColorStop(0,'#342d56');g.addColorStop(.32,'#9a5875');g.addColorStop(.47,'#ee8752');g.addColorStop(.51,'#f2b46d');g.addColorStop(.59,'#55483a');g.addColorStop(1,'#282a29');c.fillStyle=g;c.fillRect(0,0,1024,512);
 const glow=c.createRadialGradient(720,244,0,720,244,140);glow.addColorStop(0,'#fff2be');glow.addColorStop(.06,'#ffd380');glow.addColorStop(1,'#ff7d3900');c.fillStyle=glow;c.fillRect(0,0,1024,512);
 const texture=new THREE.CanvasTexture(canvas);texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.SRGBColorSpace;
 const pmrem=new THREE.PMREMGenerator(renderer);const env=pmrem.fromEquirectangular(texture).texture;pmrem.dispose();texture.dispose();return env;
}
