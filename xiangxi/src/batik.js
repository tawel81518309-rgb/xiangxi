import { gsap } from 'gsap';

/** 六步蜡染互动：拖拽、蜡刀绘画、染色遮罩与晾晒组成完整工艺循环。 */
export function createBatik() {
  const root=document.getElementById('batik');
  const stage=document.getElementById('batik-stage');
  const cloth=document.getElementById('cloth');
  const canvas=document.getElementById('cloth-canvas');
  const ctx=canvas.getContext('2d');
  const vat=document.getElementById('dye-vat');
  const water=document.getElementById('vat-water');
  const rinse=document.getElementById('rinse-overlay');
  const title=document.getElementById('batik-title');
  const instruction=document.getElementById('batik-instruction');
  const count=document.getElementById('craft-step-count');
  const finishWax=document.getElementById('finish-wax');
  const patternAssist=document.getElementById('pattern-assist');
  const step1Assist=document.getElementById('step1-assist');
  const dyeAssist=document.getElementById('dye-assist');
  const washButton=document.getElementById('wash-button');
  const dryButton=document.getElementById('dry-button');
  const brushHint=document.getElementById('brush-hint');
  const completion=document.getElementById('completion');
  const steps=[...root.querySelectorAll('.batik-steps li')];

  // waxCanvas 同时是“可见蜡迹”和“防染遮罩”；dyeLayer 在蜡迹处擦除蓝靛。
  const waxCanvas=document.createElement('canvas');waxCanvas.width=waxCanvas.height=640;
  const waxCtx=waxCanvas.getContext('2d');
  const dyeLayer=document.createElement('canvas');dyeLayer.width=dyeLayer.height=640;
  const dyeCtx=dyeLayer.getContext('2d');
  const state={step:1,dye:0,waxAlpha:1,strokes:0,busy:false};
  let drawing=false,drag=null,lastPoint=null;
  const numerals=['壹','贰','叁','肆','伍','陆'];
  const copy=[
    ['铺一方白布','拖拽屏幕中的白布，将它轻轻铺平。纹样，将从这里开始。'],
    ['以蜡刀作画','按住并拖拽蜡刀，在白布上留下淡黄色蜡迹。你画下的每一笔，都会成为最后的留白。'],
    ['浸入一池蓝靛','将画好的布拖入右侧染缸。水位升起时，未被蜡封住的纤维会缓缓吸收蓝靛。'],
    ['水洗，去蜡','点击“水洗去蜡”，让淡黄色蜡迹溶解，显露被保护的白布底色。'],
    ['漂洗，定色','清水带走浮色，水波晃动之间，蓝白纹样逐渐清晰并固化。'],
    ['晾晒成锦','点击“晾晒成锦”，让这一方独一无二的蓝白纹样，在日光里舒展。']
  ];
  function setupWaxContext(c){c.lineCap='round';c.lineJoin='round';c.strokeStyle='#dbc477';c.lineWidth=10;}
  setupWaxContext(waxCtx);

  function renderCloth(){
    // 1. 宣纸底色与纵向纤维。
    ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
    ctx.fillStyle='#efede2';ctx.fillRect(0,0,640,640);
    ctx.strokeStyle='rgba(95,100,91,.035)';ctx.lineWidth=1;
    for(let y=4;y<640;y+=7){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(640,y+2);ctx.stroke();}
    // 2. 在独立图层填蓝，再用 destination-out 按蜡迹擦除，形成真正的防染遮罩。
    dyeCtx.globalCompositeOperation='source-over';dyeCtx.clearRect(0,0,640,640);
    dyeCtx.fillStyle='#173d60';dyeCtx.fillRect(0,0,640,640);
    dyeCtx.globalCompositeOperation='destination-out';dyeCtx.drawImage(waxCanvas,0,0);
    dyeCtx.globalCompositeOperation='source-over';
    ctx.globalAlpha=state.dye;ctx.drawImage(dyeLayer,0,0);
    // 3. 去蜡前再把淡黄色蜡迹盖回表面；waxAlpha 降为 0 时露出下方留白。
    ctx.globalAlpha=state.waxAlpha;ctx.drawImage(waxCanvas,0,0);ctx.globalAlpha=1;
  }
  function showOnly(button){
    [finishWax,patternAssist,step1Assist,dyeAssist,washButton,dryButton].forEach(b=>b.hidden=b!==button);
    if(button===finishWax)patternAssist.hidden=false;
  }
  function setStep(n){
    state.step=n;title.textContent=copy[n-1][0];instruction.textContent=copy[n-1][1];count.textContent=`${numerals[n-1]} / 陆`;
    steps.forEach((li,i)=>{li.classList.toggle('is-active',i===n-1);li.classList.toggle('is-done',i<n-1);});
    cloth.classList.toggle('is-drawing',n===2);brushHint.classList.toggle('is-visible',n===2);
    if(n===1)showOnly(step1Assist);
    if(n===2)showOnly(finishWax);
    if(n===3)showOnly(dyeAssist);
    if(n===4)showOnly(washButton);
    if(n===6)showOnly(dryButton);
    if(n===5)[finishWax,patternAssist,step1Assist,dyeAssist,washButton,dryButton].forEach(b=>b.hidden=true);
  }
  function flatten(){
    if(state.step!==1||state.busy)return;
    state.busy=true;cloth.classList.remove('is-crumpled');
    gsap.to(cloth,{x:0,y:0,rotation:0,scale:1,duration:.8,ease:'power3.out',onComplete:()=>{state.busy=false;setStep(2);}});
  }
  function canvasPoint(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*640,y:(e.clientY-r.top)/r.height*640};}
  function beginStroke(e){
    if(state.step!==2||state.busy)return;
    e.preventDefault();drawing=true;lastPoint=canvasPoint(e);canvas.setPointerCapture(e.pointerId);
    waxCtx.beginPath();waxCtx.moveTo(lastPoint.x,lastPoint.y);waxCtx.lineTo(lastPoint.x+.01,lastPoint.y+.01);waxCtx.stroke();
    state.strokes++;finishWax.disabled=false;renderCloth();
  }
  function moveStroke(e){
    if(!drawing)return;const p=canvasPoint(e);
    // 二次曲线以相邻点为中点，快速划动也能得到平滑蜡线。
    const mid={x:(lastPoint.x+p.x)/2,y:(lastPoint.y+p.y)/2};
    waxCtx.beginPath();waxCtx.moveTo(lastPoint.x,lastPoint.y);waxCtx.quadraticCurveTo(lastPoint.x,lastPoint.y,mid.x,mid.y);waxCtx.lineTo(p.x,p.y);waxCtx.stroke();
    lastPoint=p;renderCloth();
  }
  function endStroke(){drawing=false;lastPoint=null;}

  function drawButterflyPattern(){
    if(state.step!==2)return;
    const c=waxCtx;c.save();c.strokeStyle='#dbc477';c.lineWidth=9;c.lineCap='round';c.lineJoin='round';
    c.beginPath();c.moveTo(320,180);c.bezierCurveTo(210,55,65,150,155,280);c.bezierCurveTo(205,345,270,290,320,245);c.bezierCurveTo(370,290,435,345,485,280);c.bezierCurveTo(575,150,430,55,320,180);c.stroke();
    c.beginPath();c.moveTo(320,170);c.lineTo(320,455);c.moveTo(292,150);c.lineTo(320,180);c.lineTo(350,145);c.stroke();
    c.beginPath();c.moveTo(280,310);c.bezierCurveTo(120,315,135,510,260,450);c.bezierCurveTo(300,430,315,365,320,330);c.moveTo(360,310);c.bezierCurveTo(520,315,505,510,380,450);c.bezierCurveTo(340,430,325,365,320,330);c.stroke();
    c.beginPath();c.arc(320,510,24,0,Math.PI*2);c.stroke();c.restore();
    state.strokes+=4;finishWax.disabled=false;renderCloth();
  }
  function prepareDye(){
    if(state.step!==2||state.strokes===0)return;
    gsap.to(cloth,{x:0,y:0,rotation:0,scale:.9,duration:.45});setStep(3);vat.classList.add('is-target');
  }
  function dye(){
    if(state.step!==3||state.busy)return;
    state.busy=true;vat.classList.remove('is-target');dyeAssist.disabled=true;
    const cr=cloth.getBoundingClientRect(),vr=vat.getBoundingClientRect();
    const dx=vr.left+vr.width/2-(cr.left+cr.width/2),dy=vr.top+vr.height*.28-(cr.top+cr.height/2);
    const x=Number(gsap.getProperty(cloth,'x')),y=Number(gsap.getProperty(cloth,'y'));
    const tl=gsap.timeline({onComplete:()=>{
      state.busy=false;dyeAssist.disabled=false;setStep(4);
    }});
    tl.to(cloth,{x:x+dx,y:y+dy,scale:.34,rotation:0,duration:.75,ease:'power2.inOut'})
      .to(water,{scaleY:1.55,duration:.4,transformOrigin:'center'},'<+.25')
      .to(state,{dye:1,duration:1.6,ease:'none',onUpdate:renderCloth},'<')
      .to(cloth,{y:y+dy+35,duration:.45,yoyo:true,repeat:1},'<')
      .to(cloth,{x:0,y:0,scale:.92,duration:.85,ease:'power3.out'})
      .to(water,{scaleY:1,duration:.4},'<');
  }
  function wash(){
    if(state.step!==4||state.busy)return;state.busy=true;
    gsap.to(state,{waxAlpha:0,duration:1.35,ease:'power2.inOut',onUpdate:renderCloth,onComplete:doRinse});
  }
  function doRinse(){
    setStep(5);
    gsap.set(rinse,{opacity:0});gsap.set(rinse.querySelectorAll('i'),{x:-80});
    const tl=gsap.timeline({onComplete:()=>{state.busy=false;setStep(6);}});
    tl.to(rinse,{opacity:1,duration:.35})
      .to(rinse.querySelectorAll('i'),{x:100,rotation:4,duration:1.1,stagger:.12,ease:'sine.inOut'},'<')
      .to(cloth,{rotation:2,duration:.35,yoyo:true,repeat:3},'<')
      .to(rinse,{opacity:0,duration:.45});
  }
  function dry(){
    if(state.step!==6||state.busy)return;state.busy=true;
    gsap.to(cloth,{x:0,y:-12,scale:1.04,rotation:0,duration:1,ease:'back.out(1.2)',onComplete:()=>{
      completion.hidden=false;document.getElementById('return-home').focus();state.busy=false;
    }});
  }

  function pointerDown(e){
    if(state.step===2){beginStroke(e);return;}
    if(![1,3].includes(state.step)||state.busy)return;
    e.preventDefault();cloth.setPointerCapture(e.pointerId);
    drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,x:Number(gsap.getProperty(cloth,'x')),y:Number(gsap.getProperty(cloth,'y')),moved:0};
  }
  function pointerMove(e){
    if(drawing){moveStroke(e);return;}if(!drag||drag.id!==e.pointerId)return;
    const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;drag.moved=Math.hypot(dx,dy);
    gsap.set(cloth,{x:drag.x+dx,y:drag.y+dy});
    if(state.step===3){const r=vat.getBoundingClientRect();vat.classList.toggle('is-target',e.clientX>r.left-70&&e.clientX<r.right+70&&e.clientY>r.top-100&&e.clientY<r.bottom+60);}
  }
  function pointerUp(e){
    if(drawing){endStroke();return;}if(!drag||drag.id!==e.pointerId)return;
    const current=drag;drag=null;
    if(state.step===1){if(current.moved>18)flatten();else gsap.to(cloth,{x:0,y:0,duration:.3});}
    else if(state.step===3){const r=vat.getBoundingClientRect(),inside=e.clientX>r.left-70&&e.clientX<r.right+70&&e.clientY>r.top-100&&e.clientY<r.bottom+60;vat.classList.remove('is-target');if(inside)dye();else gsap.to(cloth,{x:0,y:0,duration:.45,ease:'power2.out'});}
  }
  cloth.addEventListener('pointerdown',pointerDown);
  cloth.addEventListener('pointermove',pointerMove);
  cloth.addEventListener('pointerup',pointerUp);
  cloth.addEventListener('pointercancel',pointerUp);
  step1Assist.addEventListener('click',flatten);
  finishWax.addEventListener('click',prepareDye);
  patternAssist.addEventListener('click',drawButterflyPattern);
  dyeAssist.addEventListener('click',dye);
  washButton.addEventListener('click',wash);
  dryButton.addEventListener('click',dry);

  function reset(){
    gsap.killTweensOf([cloth,state,water,rinse]);
    waxCtx.clearRect(0,0,640,640);Object.assign(state,{step:1,dye:0,waxAlpha:1,strokes:0,busy:false});
    drawing=false;drag=null;completion.hidden=true;cloth.classList.add('is-crumpled');cloth.classList.remove('is-drawing');
    finishWax.disabled=true;dyeAssist.disabled=false;gsap.set(water,{scaleY:1});gsap.set(rinse,{opacity:0});
    gsap.set(cloth,{xPercent:-50,yPercent:-50,x:0,y:0,rotation:-7,scale:.88,opacity:1});
    setStep(1);renderCloth();
  }
  return {start:reset,reset,get step(){return state.step;},get strokes(){return state.strokes;}};
}
