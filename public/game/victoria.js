import * as THREE from 'three';
import { mergeGeometries } from './addons/utils/BufferGeometryUtils.js';
// (V11: createGumPainter retained for now — native eucalyptus trees are the one bit of
// greenery the user asked to keep Australian; see game.js for where it's used.)

function rng(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}
export function createGumPainter({add,height,colliders,rand}){
 const trunk=new THREE.CylinderGeometry(.6,1,1,9),branch=new THREE.CylinderGeometry(.35,1,1,7);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d'),r=rng(532);
 c.fillStyle='#b7b9a8';c.fillRect(0,0,256,256);
 for(let i=0;i<150;i++){c.fillStyle=['#767b71','#dedbc3','#aa9d84','#e1ddc9','#8c8d7e'][i%5];c.beginPath();c.ellipse(r()*256,r()*256,4+r()*15,8+r()*43,r()*.6,0,7);c.fill()}
 const bark=new THREE.CanvasTexture(canvas);bark.wrapS=bark.wrapT=THREE.RepeatWrapping;bark.colorSpace=THREE.SRGBColorSpace;
 const material=new THREE.MeshStandardMaterial({color:'#d4d1bf',map:bark,roughness:1});
 const sprays=[],leafMaterials=['#687761','#758a71','#8c9a7c','#5f775e'].map(color=>new THREE.MeshStandardMaterial({color,roughness:1,side:THREE.DoubleSide}));
 for(let variant=0;variant<4;variant++){
  const p=[],n=[];
  for(let i=0;i<24;i++){
   const x=(r()-.5)*2.9,y=(r()-.5)*1.25,z=(r()-.5)*2.6,a=r()*6.28,w=.035+r()*.05,l=.35+r()*.4;
   const dx=Math.cos(a)*w,dz=Math.sin(a)*w;
   // Narrow lanceolate leaves hang individually, leaving an open crown.
   p.push(x,y+l*.5,z,x-dx,y,z-dz,x,y-l*.5,z+.13,x,y+l*.5,z,x,y-l*.5,z+.13,x+dx,y,z+dz);
   for(let k=0;k<6;k++)n.push(0,.3,1);
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));geo.computeVertexNormals();sprays.push(geo);
 }
 return(x,z,s=1)=>{
  const y=height(x,z),h=(7+rand()*3.5)*s,lean=(rand()-.5)*.14;
  add(trunk,material,x,y+h*.32,z,.35*s,h*.64,.35*s,0,0,lean);
  colliders.push({x,z,w:.32*s,d:.32*s,h:h*.6,kind:'gum trunk'});
  for(let k=0;k<5;k++){
   const a=k*2.35+rand()*.7,dx=Math.sin(a)*(2+rand()*1.5)*s,dz=Math.cos(a)*(2+rand()*1.5)*s;
   const tipY=y+h*(.72+rand()*.24),v=new THREE.Vector3(dx,tipY-y-h*.42,dz),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.clone().normalize()),e=new THREE.Euler().setFromQuaternion(q);
   add(branch,material,x+dx*.5,(y+h*.42+tipY)/2,z+dz*.5,.20*s,v.length(),.20*s,e.x,e.y,e.z);
   for(let j=0;j<2;j++){
    const ox=(rand()-.5)*1.5*s,oz=(rand()-.5)*1.5*s;
    add(sprays[(k+j)%4],leafMaterials[(j+k)%4],x+dx+ox,tipY+(rand()-.5)*1.1*s,z+dz+oz,s,s,s,0,rand()*6.28);
   }
  }
 };
}

export function buildVictorianStreets({scene,add,box,ribbon,height,onRoad,colliders,housePlots,rand}){
 const bins=[],stops=[],signs=[],poles=[],cube=new THREE.BoxGeometry(1,1,1),cylinder=new THREE.CylinderGeometry(1,1,1,10);
 const black=new THREE.MeshStandardMaterial({color:'#26332e',roughness:.95}),steel=new THREE.MeshStandardMaterial({color:'#9aa59e',roughness:.7,metalness:.55});
 const hard=(x,z,w,d,h,kind)=>colliders.push({x,z,w,d,h,kind});
 function pole(x,z,h=8){
  if(onRoad(x,z,.5))return;
  const y=height(x,z);add(cylinder,'#8c9690',x,y+h/2,z,.085,h,.085);
  hard(x,z,.12,.12,h,'light pole');box('#7f8d85',x-.8,y+h,z,1.8,.1,.12);
  box('#d8d7b3',x-1.55,y+h-.08,z,.65,.12,.35);add(cylinder,'#5f6a64',x,y+.35,z,.15,.7,.15);box('#fff1c0',x-1.55,y+h-.16,z,.5,.04,.26);box('#5f6a64',x,y+h-1.2,z,.16,.1,1.1);poles.push({x,z});
 }
 function sign(limit,x,z,rot=0,privateRoad=false){
  if(onRoad(x,z,.5))return;
  const y=height(x,z),canvas=document.createElement('canvas');canvas.width=256;canvas.height=320;const c=canvas.getContext('2d');
  c.fillStyle='#eeeeDF';c.fillRect(0,0,256,320);c.strokeStyle='#b52b28';c.lineWidth=19;c.beginPath();c.arc(128,125,91,0,7);c.stroke();
  c.fillStyle='#191d1d';c.font=`bold ${limit>99?86:105}px sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(String(limit),128,128);
  c.font='bold 23px sans-serif';c.fillText(privateRoad?'PRIVATE TEST':'SPEED LIMIT',128,263);c.font='16px sans-serif';c.fillText(privateRoad?'CLOSED ROAD':'VICTORIA',128,294);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const m=new THREE.MeshStandardMaterial({map:texture,roughness:.9});
  for(const side of [0,1]){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.82,1.02),m);mesh.position.set(x,y+2.35,z+(side?-.013:.013));mesh.rotation.y=rot+side*Math.PI;scene.add(mesh)}
  add(cylinder,'#9eaaa1',x,y+1.3,z,.035,2.6,.035);hard(x,z,.055,.055,2.8,'speed sign');signs.push({limit,x,z,privateRoad});
 }
 function wheelie(x,z,lidColor){
  if(onRoad(x,z,.4))return;
  const group=new THREE.Group(),green=new THREE.MeshStandardMaterial({color:'#254e3c',roughness:.96}),lid=new THREE.MeshStandardMaterial({color:lidColor,roughness:.85});
  function part(g,m,x,y,z,sx,sy,sz,rx=0){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.rotation.x=rx;o.castShadow=true;group.add(o)}
  part(cube,green,0,-.02,0,.56,.91,.62);part(cube,lid,0,.47,0,.65,.075,.7);
  part(cube,black,0,.38,-.34,.49,.07,.06);
  for(const side of [-1,1])part(new THREE.CylinderGeometry(.1,.1,.07,12),black,side*.27,-.42,-.23,1,1,1,Math.PI/2);
  part(cube,steel,0,-.4,-.24,.65,.025,.025);
  const grouped=new Map();
  for(const mesh of [...group.children]){
   mesh.updateMatrix();if(!grouped.has(mesh.material))grouped.set(mesh.material,[]);
   grouped.get(mesh.material).push(mesh.geometry.clone().applyMatrix4(mesh.matrix));group.remove(mesh);
  }
  for(const [material,geos] of grouped){const mesh=new THREE.Mesh(mergeGeometries(geos),material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);for(const g of geos)g.dispose()}
  group.position.set(x,height(x,z)+.56,z);scene.add(group);bins.push({mesh:group,w:.32,h:.52,d:.35,mass:12,lid:lidColor});
 }
 function shelter(side,z,name){
  const x=side*10.9,y=height(x,z),green='#245440';
  // Corrugated green roof, pale-green metal frame, glass rear and timber seat.
  box(green,x,y+2.6,z,2.7,.18,5.4);
  for(const xx of [-1.15,1.15])for(const zz of [-2.35,2.35]){
   box('#698579',x+xx,y+1.3,z+zz,.09,2.6,.09);hard(x+xx,z+zz,.075,.075,2.7,'shelter post');
  }
  const glass=new THREE.MeshStandardMaterial({color:'#779b8f',transparent:true,opacity:.32,roughness:.25,side:THREE.DoubleSide});
  box(glass,x+side*1.15,y+1.45,z,.045,2,4.6);
  hard(x+side*1.15,z,.06,2.3,2.5,'shelter glass');
  box('#7a7157',x+side*.5,y+.48,z,.56,.12,3.7);box(green,x+side*.78,y+.85,z,.1,.6,3.7);
  hard(x+side*.6,z,.35,1.9,1.1,'bus-stop bench');
  const sx=side*7.25,sz=z+2.8;box('#9ba69c',sx,height(sx,sz)+1.5,sz,.065,3,.065);
  const c=document.createElement('canvas');c.width=256;c.height=512;const cx=c.getContext('2d');
  cx.fillStyle='#efeee0';cx.fillRect(0,0,256,512);cx.fillStyle='#ed7625';cx.fillRect(0,0,256,134);cx.fillStyle='#17211c';cx.font='bold 64px sans-serif';cx.fillText('BUS',44,88);cx.font='bold 28px sans-serif';cx.fillText('VIC COAST',18,188);cx.font='64px sans-serif';cx.fillText('782',54,284);cx.font='20px sans-serif';cx.fillText(name,14,345);cx.fillText('NORTH HEAD',20,409);cx.fillText('BOGAN BAY',20,449);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
  const board=new THREE.Mesh(new THREE.PlaneGeometry(.48,.96),new THREE.MeshStandardMaterial({map:texture,side:THREE.DoubleSide}));board.position.set(sx,height(sx,sz)+2.45,sz);scene.add(board);
  hard(sx,sz,.065,.065,3,'bus-stop pole');stops.push({x,z,side,name});
 }
 for(const x of [0,-170,-290,-410])for(const side of [-1,1]){
  for(let z=-280;z<280;z+=3){
   const px=x+side*(x===0?8.35:6.85);
   if(onRoad(px,z,1)||onRoad(px,z+2.95,1)||housePlots.some(p=>Math.hypot(px-p.end[0],z-p.end[1])<2.1))continue;
   ribbon([[px,z],[px,z+2.95]],1.55,'#a5a697',.055,true);
  }
 }
 for(let z=-285;z<300;z+=52)for(const side of [-1,1])pole(side*6.15,z);
 for(const x of [-170,-290,-410])for(let z=-258;z<265;z+=80)pole(x+7.7,z);
 housePlots.forEach((p,i)=>{
  const fx=Math.sin(p.angle),fz=Math.cos(p.angle),sx=Math.cos(p.angle),sz=-Math.sin(p.angle);
  const x=p.end[0]-fx*1.1+sx*2.1,z=p.end[1]-fz*1.1+sz*2.1;
  // The mailbox and bins belong to the driveway, behind the actual road edge.
  if(!onRoad(x,z,.4)){const y=height(x,z);box('#82745b',x,y+.65,z,.1,1.3,.1);box('#65796e',x,y+1.32,z,.43,.28,.33);hard(x,z,.19,.17,1.5,'letterbox')}
  if(i%3===0){
   wheelie(x-sx*.9,z-sz*.9,'#cf3f32');
   if(i%2===0)wheelie(x-sx*1.65,z-sz*1.65,'#e4bb35');
  }
 });
 for(const [side,z,name] of [[-1,62,'RUSTY ROO'],[1,-42,'BOGAN BAY'],[-1,-164,'BEACH ROAD'],[1,188,'BANKSIA'],[-1,470,'INDUSTRIAL'],[1,-786,'NORTH HEAD']])shelter(side,z,name);
 for(const z of [-270,-105,145,270])for(const side of [-1,1])sign(40,side*6.85,z);
 for(const z of [-35,45])sign(30,-6.85,z);
 for(const x of [-170,-290,-410])for(const z of [-205,185])sign(40,x+6.5,z);
 for(const z of [-880,-570,620,840])for(const side of [-1,1])sign(z<-700?110:100,side*7,z);
 sign(120,-627,662,0,true);
 // (V11: roadside grass tufts removed — plain simple roads, no procedural nature.)
 return{bins,stops,signs,poles};
}

export function createVicBus(scene,route='782 NORTH HEAD'){
 const root=new THREE.Group(),parts=[],materials={},cube=new THREE.BoxGeometry(1,1,1);
 const mat=(c)=>materials[c]??=(new THREE.MeshStandardMaterial({color:c,roughness:c==='#223a41'?.2:.75,metalness:c==='#223a41'?.3:0}));
 function box(c,x,y,z,w,h,d){const g=cube.clone();g.scale(w,h,d);g.translate(x,y,z);parts.push({g,m:mat(c)})}
 box('#e6e5d8',0,1.35,0,2.5,2.5,11.7);box('#d96926',0,.45,0,2.52,.7,11.72);box('#d96926',0,1.2,-4.25,2.52,2,3.1);
 box('#223a41',0,2.05,5.88,2.28,1.25,.035);box('#182424',0,2.79,5.88,2.35,.36,.045);
 box('#223a41',0,2.05,-5.88,1.9,.88,.04);box('#39423d',0,.8,-5.9,1.55,.48,.035);
 for(let y=.63;y<1.02;y+=.07)box('#727b70',0,y,-5.925,1.4,.025,.02);
 box('#282e2a',0,.23,-5.94,2.25,.15,.08);
 for(const side of [-1,1]){
  for(let z=-4.8;z<4.8;z+=1.42)box('#223a41',side*1.26,2.05,z,.025,1.03,1.27);
  // Low-floor boarding doors on the left-hand pavement side.
  if(side<0)for(const z of [4.1,-.35]){
   box('#192c2e',-1.28,1.32,z,.04,2.15,1.25);
   box('#87958b',-1.31,1.33,z,.02,2.13,.045);
   box('#e8b54f',-1.33,.3,z,.025,.08,1.2);
   for(const sign of [-1,1]){
    const panel=new THREE.Mesh(new THREE.BoxGeometry(.035,2.02,.57),mat('#334b4d'));
    panel.position.set(-1.325,1.34,z+sign*.3);panel.userData={baseZ:panel.position.z,sign};root.add(panel);
    (root.userData.doors??=[]).push(panel);
   }
  }
  box('#bbc0b5',side*1.27,.9,0,.025,.11,9);
  // Original angular orange panels echo Victorian bus livery without logos.
  for(let k=0;k<4;k++)box(k%2?'#e4e4d6':'#cf5a20',side*1.275,1.15,-3.4+k*.55,.02,.55,.55);
  box('#242d2b',side*1.41,2.37,5.2,.2,.46,.26);
 }
 box('#ccd0c7',0,2.67,-.5,2.3,.14,10);box('#a2aaa2',0,2.86,-1.5,1.9,.3,2.8);
 for(const side of [-1,1]){
  box('#ece4b6',side*.87,.7,5.89,.46,.22,.035);box('#ac2e24',side*.92,1,-5.89,.2,.6,.035);
  for(const z of [-3.7,3.7]){
   const tire=new THREE.CylinderGeometry(.49,.49,.3,24);tire.rotateZ(Math.PI/2);tire.translate(side*1.12,.05,z);parts.push({g:tire,m:mat('#202623')});
   const hub=new THREE.CylinderGeometry(.28,.28,.33,16);hub.rotateZ(Math.PI/2);hub.translate(side*1.14,.05,z);parts.push({g:hub,m:mat('#a4ada7')});
  }
 }
 const groups=new Map();for(const p of parts){if(!groups.has(p.m))groups.set(p.m,[]);groups.get(p.m).push(p.g)}
 for(const [material,geos] of groups){const o=new THREE.Mesh(mergeGeometries(geos),material);o.castShadow=true;o.receiveShadow=true;root.add(o)}
 const c=document.createElement('canvas');c.width=768;c.height=96;const ctx=c.getContext('2d');ctx.fillStyle='#14211a';ctx.fillRect(0,0,768,96);ctx.fillStyle='#ecae3e';ctx.font='bold 54px monospace';ctx.textAlign='center';ctx.fillText(route,384,69);
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
 const display=new THREE.Mesh(new THREE.PlaneGeometry(2.2,.28),new THREE.MeshBasicMaterial({map:texture}));display.position.set(0,2.79,5.91);root.add(display);
 scene.add(root);return root;
}
