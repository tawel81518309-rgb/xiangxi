import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { gsap } from 'gsap';

/**
 * 双城微缩岛
 * 坐标约定：Y 向上，沱江沿 Z 轴穿岛，建筑按两岸分组。
 * 所有重复建筑、树木与石块均由函数和固定种子生成，方便整体调参。
 */
const SEED = 10936;
const DURATION = 24;
function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const clamp = THREE.MathUtils.clamp;

export async function createWorld(container, hooks = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.28;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const daySky = new THREE.Color(0x315f68);
  const nightSky = new THREE.Color(0x0b1729);
  scene.background = null; // 让 CSS 天空渐变透出，避免画布边缘出现矩形接缝。
  scene.fog = new THREE.Fog(daySky, 28, 70);

  const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 180);
  camera.position.set(15, 13.5, 22);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, -0.8, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.065;
  controls.minDistance = 14;
  controls.maxDistance = 36;
  controls.minPolarAngle = Math.PI * 0.18;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.enablePan = false;

  const hemi = new THREE.HemisphereLight(0xd8e9e2, 0x32402c, 2.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe0a3, 3.2);
  sun.position.set(-10, 18, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -14; sun.shadow.camera.right = 14;
  sun.shadow.camera.top = 14; sun.shadow.camera.bottom = -14;
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x92c9d0, 1.1);
  rim.position.set(12, 6, -12);
  scene.add(rim);

  const M = {
    rock: new THREE.MeshStandardMaterial({ color: 0x59655a, roughness: 1, flatShading: true }),
    earth: new THREE.MeshStandardMaterial({ color: 0x7b8060, roughness: 1 }),
    grass: new THREE.MeshStandardMaterial({ color: 0x657557, roughness: 1 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x633c2d, roughness: .82 }),
    woodLight: new THREE.MeshStandardMaterial({ color: 0x986146, roughness: .78 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x303c3e, roughness: .88 }),
    roofLight: new THREE.MeshStandardMaterial({ color: 0x5e6c6b, roughness: .82 }),
    stone: new THREE.MeshStandardMaterial({ color: 0xa5a798, roughness: .96 }),
    white: new THREE.MeshStandardMaterial({ color: 0xd5d5c5, roughness: .85 }),
    warm: new THREE.MeshStandardMaterial({ color: 0xe8d2a0, emissive: 0xffb43b, emissiveIntensity: .12, roughness: .65 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x425f4a, roughness: 1, flatShading: true }),
    leafLight: new THREE.MeshStandardMaterial({ color: 0x6f8056, roughness: 1, flatShading: true }),
    red: new THREE.MeshStandardMaterial({ color: 0x854539, roughness: .8 }),
  };
  const interactive = [];
  const shutters = [];
  const nightLights = [];

  function mesh(geometry, material, parent, position = [0, 0, 0], shadow = true) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(...position);
    m.castShadow = shadow;
    m.receiveShadow = shadow;
    parent.add(m);
    return m;
  }
  function box(parent, size, pos, mat = M.wood) {
    return mesh(new THREE.BoxGeometry(...size), mat, parent, pos);
  }
  function tag(group, action, label) {
    group.userData.action = action;
    group.userData.label = label;
    interactive.push(group);
    return group;
  }

  // 双坡瓦屋顶：独立屋脊与起翘檐口，比单纯圆锥更接近湘西木构。
  function roofGeometry(w, d, h) {
    const y = 0;
    const v = new Float32Array([
      -w*.38,h,0, w*.38,h,0, -w/2,y,d/2, w/2,y,d/2,
      -w/2,y,-d/2, w/2,y,-d/2, -w*.53,y+.07,d*.57, w*.53,y+.07,d*.57,
      -w*.53,y+.07,-d*.57, w*.53,y+.07,-d*.57
    ]);
    const idx = [0,2,3,0,3,1, 1,3,5, 0,4,2, 0,1,5,0,5,4, 2,6,7,2,7,3, 4,5,9,4,9,8];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(v,3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }

  function makeHouse(scale = 1, variant = 0) {
    const g = new THREE.Group();
    const w = 1.35 * scale, d = 1.05 * scale, bodyH = (1 + variant * .1) * scale;
    const stilt = .48 * scale;
    for (const x of [-w*.39,w*.39]) for (const z of [-d*.35,d*.35]) {
      box(g,[.075*scale,stilt,.075*scale],[x,stilt/2,z],M.woodLight);
    }
    box(g,[w,bodyH,d],[0,stilt+bodyH/2,0], variant % 2 ? M.woodLight : M.wood);
    box(g,[w*1.08,.08*scale,d*1.14],[0,stilt+.05*scale,0],M.woodLight);
    const roof = mesh(roofGeometry(w*1.2,d*1.35,.48*scale),M.roof,g,[0,stilt+bodyH,0]);
    roof.castShadow = true;
    const ridge = mesh(new THREE.CylinderGeometry(.035*scale,.035*scale,w*.9,8),M.roofLight,g,[0,stilt+bodyH+.49*scale,0]);
    ridge.rotation.z = Math.PI/2;
    // 两扇木窗各带一个铰链父节点；点击时只旋转窗扇，不移动建筑。
    for (const x of [-w*.25,w*.25]) {
      const frame = box(g,[.32*scale,.38*scale,.035*scale],[x,stilt+bodyH*.56,d/2+.025*scale],M.warm);
      frame.castShadow = false;
      for (const side of [-1,1]) {
        const pivot = new THREE.Group();
        pivot.position.set(x+side*.16*scale,stilt+bodyH*.56,d/2+.05*scale);
        const shutter = box(pivot,[.15*scale,.36*scale,.025*scale],[-side*.075*scale,0,0],M.woodLight);
        shutter.castShadow = false;
        g.add(pivot); shutters.push({ pivot, side, open: false });
      }
    }
    g.userData.height = stilt+bodyH+.5*scale;
    return tag(g,'windows','吊脚楼木窗');
  }

  function makeTree(scale = 1, light = false) {
    const g = new THREE.Group();
    mesh(new THREE.CylinderGeometry(.05*scale,.075*scale,.65*scale,6),M.wood,g,[0,.32*scale,0]);
    const crown = mesh(new THREE.IcosahedronGeometry(.43*scale,1),light?M.leafLight:M.leaf,g,[0,.83*scale,0]);
    crown.scale.set(1,.95+rand()*.25,1);
    const crown2 = mesh(new THREE.IcosahedronGeometry(.28*scale,1),light?M.leaf:M.leafLight,g,[.18*scale,1.06*scale,-.04*scale]);
    crown2.castShadow = true;
    return g;
  }

  const waterUniforms = {
    uTime: { value: 0 }, uNight: { value: 0 },
    uDay: { value: new THREE.Color(0x4b8d8b) }, uDark: { value: new THREE.Color(0x102c48) }
  };
  const waterMaterial = new THREE.ShaderMaterial({
    uniforms: waterUniforms, transparent: true, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; uniform float uTime; void main(){vUv=uv;vec3 p=position;p.y+=sin((p.z+uTime)*3.0)*0.018;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
    fragmentShader: `varying vec2 vUv;uniform float uTime;uniform float uNight;uniform vec3 uDay;uniform vec3 uDark;void main(){float wave=sin(vUv.y*115.0-uTime*3.0+sin(vUv.x*18.0))*0.5+0.5;float line=smoothstep(.87,1.0,wave)*.18;vec3 c=mix(uDay,uDark,uNight)+line;gl_FragColor=vec4(c,.91);}`
  });

  function riverCurve() {
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(-.6,.36,-7.4),new THREE.Vector3(.55,.36,-4),
      new THREE.Vector3(-.35,.36,-1),new THREE.Vector3(.45,.36,2),new THREE.Vector3(-.25,.36,7.4)
    ]);
  }
  function makeRiver(parent) {
    const curve = riverCurve();
    const vertices = [], uvs = [], indices = [], segments = 90, width = 2.05;
    for (let i=0;i<=segments;i++) {
      const t=i/segments,p=curve.getPoint(t),tan=curve.getTangent(t),side=new THREE.Vector3(-tan.z,0,tan.x).normalize();
      for (const s of [-1,1]) {
        const q=p.clone().addScaledVector(side,s*width/2);
        vertices.push(q.x,q.y,q.z);uvs.push((s+1)/2,t);
      }
      if(i<segments){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);geo.computeVertexNormals();
    mesh(geo,waterMaterial,parent,[0,0,0],false);
    return curve;
  }

  function makeIslandBase(parent) {
    const rock=mesh(new THREE.SphereGeometry(7.55,48,24),M.rock,parent,[0,-4.1,0]);
    rock.scale.y=.58;
    mesh(new THREE.CylinderGeometry(7.35,7.55,.6,64),M.earth,parent,[0,-.05,0]);
    const green=mesh(new THREE.CircleGeometry(7.32,64),M.grass,parent,[0,.26,0]);green.rotation.x=-Math.PI/2;
    for(let i=0;i<22;i++){
      const a=rand()*Math.PI*2,r=6.6+rand()*.55;
      const stone=mesh(new THREE.DodecahedronGeometry(.22+rand()*.24,0),M.rock,parent,[Math.cos(a)*r,-.2-rand()*.7,Math.sin(a)*r]);
      stone.scale.y=1.5+rand();
    }
  }

  function makeBridge(parent,z,covered=false,light=false) {
    const g=new THREE.Group();g.position.z=z;
    box(g,[4.8,.18,.72],[0,.72,0],light?M.white:M.stone);
    for(const x of [-2.1,-1.05,0,1.05,2.1]){
      const arch=mesh(new THREE.TorusGeometry(.47,.075,6,16,Math.PI),light?M.white:M.stone,g,[x,.62,0]);
      arch.rotation.z=0;arch.rotation.y=0;
    }
    for(const side of [-1,1]){
      box(g,[4.8,.08,.06],[0,1.02,side*.32],light?M.white:M.woodLight);
      for(let x=-2.25;x<=2.26;x+=.45) box(g,[.045,.36,.045],[x,.87,side*.32],light?M.white:M.woodLight);
    }
    if(covered){
      for(const x of [-1.9,-.95,0,.95,1.9]) for(const zz of [-.28,.28]) box(g,[.09,1.15,.09],[x,1.35,zz],M.red);
      mesh(roofGeometry(5.15,1.25,.55),M.roof,g,[0,1.88,0]);
      const ridge=mesh(new THREE.CylinderGeometry(.045,.045,4.2,8),M.roofLight,g,[0,2.44,0]);ridge.rotation.z=Math.PI/2;
    }
    parent.add(g);return g;
  }

  function makePagoda(parent,x,z,white=false,levels=5) {
    const g=new THREE.Group();g.position.set(x,.28,z);
    const mat=white?M.white:M.stone;
    box(g,[1.05,.25,1.05],[0,.12,0],mat);
    for(let i=0;i<levels;i++){
      const s=1-i*.115,y=.25+i*.58;
      mesh(new THREE.CylinderGeometry(.28*s,.34*s,.56,8),mat,g,[0,y+.28,0]);
      const cap=mesh(new THREE.ConeGeometry(.58*s,.22,4),white?M.roofLight:M.roof,g,[0,y+.59,0]);cap.rotation.y=Math.PI/4;
    }
    mesh(new THREE.ConeGeometry(.09,.45,8),M.warm,g,[0,.25+levels*.58+.2,0]);
    parent.add(g);tag(g,'landmark',white?'白塔':'万名塔');return g;
  }

  function makeBoat(parent,curve) {
    const g=new THREE.Group();
    const hull=mesh(new THREE.CapsuleGeometry(.23,1.05,4,10),M.wood,g,[0,.16,0]);hull.rotation.x=Math.PI/2;hull.scale.set(1,.45,1);
    box(g,[.42,.07,.88],[0,.27,0],M.woodLight);
    for(const x of [-.2,.2]) for(const z of [-.26,.26]) box(g,[.035,.48,.035],[x,.52,z],M.woodLight);
    const canopy=mesh(new THREE.CylinderGeometry(.32,.32,.68,12,1,true,0,Math.PI),M.roof,g,[0,.74,0]);canopy.rotation.z=Math.PI/2;canopy.rotation.y=Math.PI/2;
    parent.add(g);tag(g,'boat','江面小船');return g;
  }

  function addTrees(parent,excludeCenter=false) {
    for(let i=0;i<25;i++){
      const a=rand()*Math.PI*2,r=4.7+rand()*2.1,x=Math.cos(a)*r,z=Math.sin(a)*r;
      if(excludeCenter&&Math.abs(x)<1.6)continue;
      const t=makeTree(.6+rand()*.6,i%3===0);t.position.set(x,.27,z);parent.add(t);
    }
  }

  const fenghuang=new THREE.Group(),chadong=new THREE.Group();
  scene.add(fenghuang,chadong);chadong.visible=false;
  makeIslandBase(fenghuang);const fRiver=makeRiver(fenghuang);
  // 两岸吊脚楼：中部密集，上下游逐渐疏朗。
  const houseZ=[-4.7,-3.25,-1.7,.1,1.6,3.15];
  for(const side of [-1,1])houseZ.forEach((z,i)=>{
    const h=makeHouse(.75+(i%3)*.08,(i+(side>0?1:0))%2);
    h.position.set(side*(1.65+(i%2)*.45),.28,z);h.rotation.y=side<0?Math.PI*.46:-Math.PI*.46;
    fenghuang.add(h);
  });
  makeBridge(fenghuang,-4.15,true); // 虹桥风雨楼
  makeBridge(fenghuang,-2.1,false,true); // 雪桥
  makeBridge(fenghuang,3.85,false,false); // 云桥
  makeBridge(fenghuang,5.65,false,true); // 雾桥
  makePagoda(fenghuang,2.5,2.25,false,5);
  for(let i=0;i<9;i++)box(fenghuang,[.42,.16,.36],[-1.05+i*.27,.48,.65+Math.sin(i)*.07],M.stone);
  addTrees(fenghuang,true);
  const fBoat=makeBoat(fenghuang,fRiver);

  makeIslandBase(chadong);const cRiver=makeRiver(chadong);addTrees(chadong,true);
  // 边城城楼位于岛高处，下方是渡口与江心翠翠岛。
  const tower=makeHouse(1.45,1);tower.position.set(-3.6,.75,-4.15);chadong.add(tower);
  box(chadong,[3.2,.55,2.5],[-3.6,.43,-4.15],M.stone);
  makePagoda(chadong,-3.25,.1,true,4);
  const cuicui=mesh(new THREE.CylinderGeometry(1.05,1.2,.25,24),M.grass,chadong,[0,.42,.6]);
  const cTree=makeTree(1.4,true);cTree.position.set(0,.55,.6);chadong.add(cTree);
  for(const side of [-1,1])for(const z of [-3,-1.2,2.4]){const h=makeHouse(.8,1);h.position.set(side*2.05,.28,z);h.rotation.y=side<0?Math.PI*.46:-Math.PI*.46;chadong.add(h);}
  makeBridge(chadong,3.15,false,false);
  const ferry=makeBoat(chadong,cRiver);ferry.scale.set(1.15,1,1.15);
  // 拉拉渡的牵引索横跨江面。
  const rope=mesh(new THREE.CylinderGeometry(.012,.012,5.8,5),M.woodLight,chadong,[0,1.25,2.55],false);rope.rotation.z=Math.PI/2;
  // 碾坊与水车。
  const mill=makeHouse(.9,0);mill.position.set(3.25,.28,3.5);chadong.add(mill);
  const wheel=mesh(new THREE.TorusGeometry(.64,.075,8,20),M.woodLight,chadong,[2.35,.82,3.55]);wheel.rotation.y=Math.PI/2;
  for(let i=0;i<8;i++){const spoke=box(chadong,[.055,1.15,.055],[2.35,.82,3.55],M.woodLight);spoke.rotation.x=i*Math.PI/4;}

  // 晨雾精灵：柔和径向纹理，不产生硬边矩形。
  const fogCanvas=document.createElement('canvas');fogCanvas.width=128;fogCanvas.height=128;
  const fc=fogCanvas.getContext('2d'),grad=fc.createRadialGradient(64,64,0,64,64,64);
  grad.addColorStop(0,'rgba(255,255,255,.5)');grad.addColorStop(1,'rgba(255,255,255,0)');fc.fillStyle=grad;fc.fillRect(0,0,128,128);
  const fogTexture=new THREE.CanvasTexture(fogCanvas),fogSprites=[];
  for(let i=0;i<11;i++){
    const mat=new THREE.SpriteMaterial({map:fogTexture,transparent:true,opacity:.15,depthWrite:false,color:0xf2f1df});
    const s=new THREE.Sprite(mat);s.position.set((rand()-.5)*3,.85+rand()*.6,-5+i);s.scale.set(4+rand()*2,1.2+rand(),1);fenghuang.add(s);fogSprites.push(s);
  }
  // 星空只在夜间显现。
  const starPositions=[];for(let i=0;i<260;i++){const a=rand()*Math.PI*2,r=25+rand()*25,y=8+rand()*28;starPositions.push(Math.cos(a)*r,y,Math.sin(a)*r);}
  const starGeo=new THREE.BufferGeometry();starGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));
  const starMat=new THREE.PointsMaterial({color:0xdce8ff,size:.095,transparent:true,opacity:0,depthWrite:false});
  scene.add(new THREE.Points(starGeo,starMat));

  // 设计资源库吊脚楼：保留 loader 的轴向/根变换，仅在外层 placement 上缩放与摆放。
  // 替换模型时，只需替换 public/assets/diaojiaolou 并保留 createAsset 接口。
  try {
    const assetModulePath = '/assets/diaojiaolou/asset.mjs';
    const { createAsset } = await import(/* @vite-ignore */ assetModulePath);
    const source=await createAsset(THREE,{states:'lazy',sharedResources:true});
    const bounds=new THREE.Box3().setFromObject(source),size=bounds.getSize(new THREE.Vector3());
    const scale=2.45/Math.max(size.y,.001);
    const placements=[[-2.55,.28,-.65,.46],[2.7,.28,-2.9,-.46]];
    placements.forEach(([x,y,z,yaw],i)=>{
      const placement=new THREE.Group();const model=i===0?source:source.clone(true);
      placement.add(model);placement.scale.setScalar(scale);placement.position.set(x,y,z);placement.rotation.y=yaw;
      fenghuang.add(placement);tag(placement,'windows','吊脚楼木窗');
      const light=new THREE.PointLight(0xffa33d,0,4,2);light.position.set(x,y+1.2,z);fenghuang.add(light);nightLights.push(light);
    });
  } catch (error) {
    console.warn('吊脚楼资源未载入，已使用程序化木构建筑作为回退。',error);
  }

  let active=true,currentCity='fenghuang',boatMode=false,isNight=false,nightMix=0,paused=false;
  let simT=0,windowsOpen=false;
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const pointerDown=new THREE.Vector2();
  const clock=new THREE.Clock();

  function toast(text){hooks.onToast?.(text);}
  function openWindows(force) {
    windowsOpen=typeof force==='boolean'?force:!windowsOpen;
    shutters.forEach(({pivot,side})=>gsap.to(pivot.rotation,{y:windowsOpen?side*Math.PI*.58:0,duration:.65,ease:'power2.out',overwrite:true}));
    toast(windowsOpen?'木窗推开，江风入户':'木窗轻合，灯火留在屋里');
  }
  function activeGroup(){return currentCity==='fenghuang'?fenghuang:chadong;}
  function activeBoat(){return currentCity==='fenghuang'?fBoat:ferry;}
  function activeRiver(){return currentCity==='fenghuang'?fRiver:cRiver;}

  function setCity(city) {
    if(city===currentCity||boatMode)return;
    const old=activeGroup(),next=city==='fenghuang'?fenghuang:chadong;
    currentCity=city;
    gsap.to(old.scale,{x:.65,y:.65,z:.65,duration:.38,ease:'power2.in',onComplete:()=>{old.visible=false;old.scale.setScalar(1);}});
    next.visible=true;next.scale.setScalar(.65);next.rotation.y=-.35;
    gsap.to(next.scale,{x:1,y:1,z:1,duration:.75,delay:.28,ease:'power3.out'});
    gsap.to(next.rotation,{y:0,duration:.75,delay:.28,ease:'power3.out'});
    toast(city==='fenghuang'?'抵达凤凰古城':'抵达茶峒 · 拉拉渡仍在等你');
  }
  function setNight(value) {
    isNight=value;
    toast(isNight?'夜幕落下，万家灯火亮起':'晨光回到江面，雾气升起');
  }
  function startBoat() {
    if(boatMode)return;
    boatMode=true;controls.enabled=false;
    hooks.onBoatChange?.(true);toast('乘船视角 · 顺流而下');
  }
  function exitBoat() {
    if(!boatMode)return;
    boatMode=false;controls.enabled=true;
    camera.position.set(15,13.5,22);controls.target.set(0,-.8,0);controls.update();
    hooks.onBoatChange?.(false);
  }

  function pick(event,activate=false) {
    if(!active||boatMode)return;
    const rect=renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX-rect.left)/rect.width*2-1,-((event.clientY-rect.top)/rect.height)*2+1);
    raycaster.setFromCamera(pointer,camera);
    const hits=raycaster.intersectObjects(interactive.filter(o=>o.visible&&activeGroup().getObjectById(o.id)),true);
    let target=null;
    if(hits.length){let o=hits[0].object;while(o&&!o.userData.action)o=o.parent;target=o;}
    renderer.domElement.style.cursor=target?'pointer':'grab';
    if(activate&&target){
      if(target.userData.action==='boat')startBoat();
      else if(target.userData.action==='windows')openWindows();
      else toast(target.userData.label||'此处留有湘西的故事');
    }
  }
  renderer.domElement.addEventListener('pointerdown',e=>pointerDown.set(e.clientX,e.clientY));
  renderer.domElement.addEventListener('pointerup',e=>{if(pointerDown.distanceTo(new THREE.Vector2(e.clientX,e.clientY))<5)pick(e,true);});
  renderer.domElement.addEventListener('pointermove',e=>{if(e.buttons===0)pick(e,false);});

  function sample(t) {
    const phase=t/DURATION*Math.PI*2;
    waterUniforms.uTime.value=phase;
    fenghuang.position.y=Math.sin(phase)*.12;
    chadong.position.y=Math.sin(phase)*.12;
    fogSprites.forEach((s,i)=>{s.position.x=Math.sin(phase+i)*1.1;s.material.opacity=(.12+Math.sin(phase*2+i)*.035)*(1-nightMix);});
    for(const [boat,curve,offset] of [[fBoat,fRiver,.08],[ferry,cRiver,.58]]){
      const u=(t/DURATION+offset)%1,p=curve.getPoint(u),tan=curve.getTangent(u);
      boat.position.copy(p);boat.position.y+=.05+Math.sin(phase*4)*.025;
      boat.rotation.y=Math.atan2(tan.x,tan.z);
    }
    wheel.rotation.x=phase*2;
    if(boatMode){
      activeGroup().updateMatrixWorld(true);
      const boat=activeBoat(),curve=activeRiver();
      const bp=boat.getWorldPosition(new THREE.Vector3());
      const u=(t/DURATION+(currentCity==='fenghuang'?.08:.58))%1,tan=curve.getTangent(u).transformDirection(activeGroup().matrixWorld);
      camera.position.copy(bp).add(new THREE.Vector3(0,.72,0)).addScaledVector(tan,-.3);
      camera.lookAt(bp.clone().addScaledVector(tan,5).add(new THREE.Vector3(0,.28,0)));
    }
  }
  function draw() {
    controls.update();
    renderer.render(scene,camera);
  }
  function resize() {
    const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;
    renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
    if(paused)draw();
  }
  new ResizeObserver(resize).observe(container);resize();

  renderer.setAnimationLoop(()=>{
    const dt=Math.min(clock.getDelta(),.08);
    if(!paused){
      simT+=dt;
      nightMix=THREE.MathUtils.damp(nightMix,isNight?1:0,4,dt);
      waterUniforms.uNight.value=nightMix;
      scene.fog.color.copy(daySky).lerp(nightSky,nightMix);
      sun.intensity=3.2-nightMix*2.85;sun.color.setHex(isNight?0x8fa9df:0xffe0a3);
      hemi.intensity=2.1-nightMix*1.35;rim.intensity=1.1+nightMix*.5;
      starMat.opacity=nightMix*.9;M.warm.emissiveIntensity=.12+nightMix*2.5;
      nightLights.forEach(l=>l.intensity=nightMix*2.2);
      sample(simT);
    }
    if(active||paused)draw();
  });
  sample(0);draw();

  window.__seek=(t)=>{paused=true;simT=Math.max(0,Number(t)||0);sample(simT);draw();};
  window.__play=()=>{paused=false;clock.getDelta();};
  const tParam=new URLSearchParams(location.search).get('t');if(tParam!==null)window.__seek(tParam);
  const getStats=()=>({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures});
  window.__SCENE_READY__=true;

  return {
    setCity,setNight,openWindows,startBoat,exitBoat,getStats,
    setActive(value){active=value;if(value)clock.getDelta();},
    get boatMode(){return boatMode;},get city(){return currentCity;},
    resize,
  };
}
