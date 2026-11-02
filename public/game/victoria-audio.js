// Original synthesised sound design. No ripped game audio or bird recordings.
export class VictorianSoundscape{
 constructor(){
  const c=this.ctx=new (window.AudioContext||window.webkitAudioContext)();
  this.master=c.createGain();this.master.gain.value=.22;
  const compressor=c.createDynamicsCompressor();compressor.threshold.value=-19;compressor.ratio.value=4;
  this.analyser=c.createAnalyser();this.analyser.fftSize=1024;
  this.master.connect(compressor).connect(this.analyser).connect(c.destination);
  const buffer=c.createBuffer(1,c.sampleRate*3,c.sampleRate),data=buffer.getChannelData(0);let last=0;
  for(let i=0;i<data.length;i++){last=(last+Math.random()*.12-.06)/1.025;data[i]=last*5}
  this.noiseBuffer=buffer;
  const voice=(type,freq,gain,filterFreq)=>{
   const o=c.createOscillator(),g=c.createGain(),f=c.createBiquadFilter();o.type=type;o.frequency.value=freq;f.type='lowpass';f.frequency.value=filterFreq;g.gain.value=gain;o.connect(f).connect(g).connect(this.master);o.start();return{o,g,f};
  };
  this.exhaust=voice('sawtooth',48,.15,340);this.sub=voice('sine',24,.11,180);this.intake=voice('triangle',95,.05,1500);
  // Original PCM exhaust impulses: unequal firing intervals, pressure tail,
  // mechanical rasp and combustion noise, looped and pitched by engine RPM.
  const pulse=c.createBuffer(1,c.sampleRate,c.sampleRate),pcm=pulse.getChannelData(0);
  for(let j=0;j<64;j++){
   const start=Math.floor((j+(j%4===1?.055:j%4===3?-.035:0))*c.sampleRate/64);
   for(let k=0;k<c.sampleRate*.032;k++){const i=(start+k)%pcm.length,t=k/c.sampleRate;pcm[i]+=Math.exp(-t*180)*(Math.sin(t*1050)*.5+Math.sin(t*320)*.35+(Math.random()-.5)*.25)}
  }
  this.pulse=c.createBufferSource();this.pulse.buffer=pulse;this.pulse.loop=true;
  this.pulseFilter=c.createBiquadFilter();this.pulseFilter.type='lowpass';this.pulseFilter.frequency.value=850;
  this.pulseGain=c.createGain();this.pulseGain.gain.value=.3;this.pulse.connect(this.pulseFilter).connect(this.pulseGain).connect(this.master);this.pulse.start();
  this.rattle=voice('square',140,0,2200);this.tyre=voice('sine',650,0,1600);this.bus=voice('sawtooth',52,0,280);
  const noise=(frequency,q=0)=>{
   const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=buffer;s.loop=true;f.type='bandpass';f.frequency.value=frequency;f.Q.value=q;g.gain.value=0;s.connect(f).connect(g).connect(this.master);s.start();return{g,f};
  };
  this.road=noise(800);this.wind=noise(350);this.surf=noise(1100,.3);this.gravel=noise(1850,1);this.tyreNoise=noise(2400,1);
  this.nextBird=0;this.lastBusBrake=0;this.rpm=850;this.gear=1;this.calls=0;this.enabled=true;
  c.resume();
 }
 setMuted(muted){this.master.gain.setTargetAtTime(muted?0:.22,this.ctx.currentTime,.06)}
 bird(){
  const c=this.ctx,now=c.currentTime,kind=Math.floor(Math.random()*3),count=kind===2?7:4;
  for(let i=0;i<count;i++){
   const o=c.createOscillator(),g=c.createGain(),t=now+i*(kind===2?.12:.23),f=kind===0?[1200,870,1500,1040][i]:kind===1?[2700,3300,2250,3100][i]:580+i*65;
   o.type=kind===2?'triangle':'sine';o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*(kind===2?1.6:.76),t+.13);
   g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(kind===2?.11:.08,t+.02);g.gain.exponentialRampToValueAtTime(.001,t+.19);
   const pan=c.createStereoPanner();pan.pan.value=Math.sin(this.calls*2.3)*.8;o.connect(g).connect(pan).connect(this.master);o.start(t);o.stop(t+.22);
  }this.calls++;
 }
 airBrake(strength=.2){
  const c=this.ctx,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=this.noiseBuffer;f.type='highpass';f.frequency.value=1300;g.gain.setValueAtTime(strength,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.8);s.connect(f).connect(g).connect(this.master);s.start();s.stop(c.currentTime+.85);
 }
 impact(){
  const c=this.ctx,t=c.currentTime,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=this.noiseBuffer;f.type='lowpass';f.frequency.value=650;g.gain.setValueAtTime(.8,t);g.gain.exponentialRampToValueAtTime(.001,t+.13);s.connect(f).connect(g).connect(this.master);s.start();s.stop(t+.15);
  const o=c.createOscillator(),gain=c.createGain();o.frequency.setValueAtTime(145,t);o.frequency.exponentialRampToValueAtTime(42,t+.11);gain.gain.setValueAtTime(.5,t);gain.gain.exponentialRampToValueAtTime(.001,t+.13);o.connect(gain).connect(this.master);o.start();o.stop(t+.15);
 }
 update(state,physics,input,buses,dt){
  const c=this.ctx,t=c.currentTime,set=(p,v)=>p.setTargetAtTime(v,t,.065),speed=Math.abs(state.speed),ute=!!state.vehicle,throttle=Math.abs(input.throttle),ratio=[3.4,2.2,1.5,1.05,.78];
  let rpm=800+speed*ratio[this.gear-1]*95+Math.min(4300,physics.rearSpin*32);
  if(rpm>(ute?3500:5700)&&this.gear<5){this.gear++;rpm*=.7}
  if(rpm<1250&&this.gear>1)this.gear--;
  rpm=Math.min(ute?4400:6800,Math.max(ute?810:850,rpm+throttle*350));this.rpm+=(rpm-this.rpm)*Math.min(1,dt*9);
  const firing=this.rpm/60*(ute?2:4),distance=state.onFoot?Math.hypot(state.walkX-state.x,state.walkZ-state.z):0,attenuation=1/(1+distance*.12),load=.12+throttle*.13;
  set(this.pulse.playbackRate,firing/64);set(this.pulseGain.gain,(ute?.32:.42)*(1+throttle*.8)*attenuation);set(this.pulseFilter.frequency,ute?600+throttle*800:850+throttle*1900);
  set(this.exhaust.o.frequency,firing);set(this.exhaust.f.frequency,ute?320+throttle*450:450+throttle*1100);set(this.exhaust.g.gain,load*attenuation);
  set(this.sub.o.frequency,firing*.5);set(this.sub.g.gain,.12*attenuation);
  set(this.intake.o.frequency,firing*1.5);set(this.intake.g.gain,(.015+throttle*.055)*attenuation);
  set(this.rattle.o.frequency,firing*3.13);set(this.rattle.g.gain,ute?.038*attenuation:0);
  const slip=state.onFoot?0:Math.min(1,physics.slip+physics.rearSpin*.008);
  set(this.tyre.o.frequency,740+Math.min(850,physics.rearSpin*4)+Math.sin(t*31)*32+Math.sin(t*11)*45);set(this.tyre.g.gain,slip*.18*(.8+.2*Math.sin(t*23)));this.tyre.o.type='sawtooth';set(this.tyre.f.frequency,1800+slip*1000);
  set(this.tyreNoise.g.gain,slip*.14);set(this.tyreNoise.f.frequency,1700+Math.sin(t*13)*500+slip*650);set(this.road.g.gain,state.onFoot?0:Math.min(.18,speed*.005));set(this.road.f.frequency,450+speed*38);
  set(this.gravel.g.gain,state.onFoot||physics.wheels.every(w=>w.surface==='asphalt')?0:Math.min(.15,speed*.007));
  set(this.wind.g.gain,.015+(state.onFoot?0:Math.min(.11,speed*.002)));
  const x=state.onFoot?state.walkX:state.x;set(this.surf.g.gain,Math.max(.005,.12/(1+Math.abs(x-105)*.04))*(.8+Math.sin(t*.35)*.2));
  const px=state.onFoot?state.walkX:state.x,pz=state.onFoot?state.walkZ:state.z;
  let nearest=Infinity,waiting=false;for(const b of buses){const d=Math.hypot(px-b.car.position.x,pz-b.z);if(d<nearest){nearest=d;waiting=b.wait>0}}
  set(this.bus.g.gain,Math.max(0,.14*(1-nearest/65)));set(this.bus.o.frequency,waiting?46:74);
  if(waiting&&nearest<45&&t-this.lastBusBrake>8){this.airBrake(.15*(1-nearest/55));this.lastBusBrake=t}
  if(t>this.nextBird&&!state.paused){this.bird();this.nextBird=t+4+Math.random()*6}
 }
}
