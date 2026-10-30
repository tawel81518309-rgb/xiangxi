import { gsap } from 'gsap';
import { createWorld } from './scene.js';
import { createStory } from './story.js';
import { createBatik } from './batik.js';

const $=id=>document.getElementById(id);
let currentScreen='home',switching=false,night=false,world;
const batik=createBatik();
const story=createStory(()=>enterBatik());

/** 通用场景切换：旧幕淡出后再隐藏，避免不可见场景继续拦截交互。 */
async function switchScreen(next){
  if(switching||next===currentScreen)return;
  switching=true;
  const from=$(currentScreen),to=$(next);
  await gsap.to(from,{opacity:0,duration:.45,ease:'power2.in'});
  from.classList.remove('is-active');from.hidden=true;
  to.hidden=false;to.classList.add('is-active');
  gsap.fromTo(to,{opacity:0},{opacity:1,duration:.65,ease:'power2.out'});
  currentScreen=next;switching=false;
  world?.setActive(next==='island');
}

/**
 * Canvas 水波纹转场。
 * 以点击处为圆心绘制多个相位不同的扩散环；中间用径向渐变遮住换幕瞬间。
 * 这是二维视觉转场，不会修改 Three.js 的相机或模型。
 */
function waterTransition(x,y,onCovered){
  if(switching)return;switching=true;
  const canvas=$('water-transition'),ctx=canvas.getContext('2d'),dpr=Math.min(devicePixelRatio,2);
  canvas.width=innerWidth*dpr;canvas.height=innerHeight*dpr;ctx.scale(dpr,dpr);
  const maxR=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y))*1.15;
  const state={p:0};let covered=false;
  gsap.set(canvas,{opacity:1});
  gsap.to(state,{p:1,duration:1.65,ease:'power2.inOut',onUpdate:()=>{
    ctx.clearRect(0,0,innerWidth,innerHeight);
    const radius=maxR*state.p;
    const gradient=ctx.createRadialGradient(x,y,0,x,y,Math.max(radius,1));
    gradient.addColorStop(0,'rgba(30,74,86,.94)');gradient.addColorStop(.78,'rgba(21,57,70,.9)');gradient.addColorStop(1,'rgba(190,220,217,0)');
    ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();
    for(let i=0;i<4;i++){
      const local=Math.max(0,state.p-i*.08),r=maxR*local;
      ctx.strokeStyle=`rgba(222,238,232,${Math.max(0,.42-local*.32)})`;ctx.lineWidth=1.5;
      ctx.beginPath();ctx.ellipse(x,y,r,r*.72,0,0,Math.PI*2);ctx.stroke();
    }
    if(state.p>.46&&!covered){covered=true;onCovered();}
  },onComplete:()=>{
    gsap.to(canvas,{opacity:0,duration:.35,onComplete:()=>{switching=false;ctx.clearRect(0,0,innerWidth,innerHeight);}});
  }});
}

let toastTimer;
function toast(message){
  const el=$('world-toast');el.textContent=message;el.classList.add('is-visible');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('is-visible'),2400);
}

const cityCopy={
  fenghuang:{name:'凤凰古城',pinyin:'FENGHUANG',description:'一江沱水穿城过，两岸吊脚楼枕着青山。虹桥连起烟火，跳岩留住渡江人的脚步。',landmarks:'沱江 · 虹桥 · 万名塔 · 雪桥'},
  chadong:{name:'茶峒',pinyin:'CHADONG',description:'清水江绕过边城，白塔静静守着渡口。拉拉渡的一根绳索，把翠翠岛与旧时光连在一起。',landmarks:'边城城楼 · 白塔 · 翠翠岛 · 拉拉渡'}
};
function selectCity(city){
  world?.setCity(city);const data=cityCopy[city];
  $('city-name').textContent=data.name;$('city-pinyin').textContent=data.pinyin;
  $('city-description').textContent=data.description;$('city-landmarks').textContent=data.landmarks;
  document.querySelectorAll('.city-tab').forEach(tab=>{const selected=tab.dataset.city===city;tab.classList.toggle('is-selected',selected);tab.setAttribute('aria-selected',String(selected));});
}

$('enter-button').addEventListener('click',e=>{
  const r=e.currentTarget.getBoundingClientRect();
  waterTransition(e.clientX||r.left+r.width/2,e.clientY||r.top+r.height/2,()=>{
    // 转场自身的 switching 需暂时释放，让场景切换执行；完成后由水波回调恢复。
    switching=false;switchScreen('island');
  });
});
$('back-home').addEventListener('click',()=>{world?.exitBoat();switchScreen('home');});
document.querySelectorAll('.city-tab').forEach(tab=>tab.addEventListener('click',()=>selectCity(tab.dataset.city)));
$('day-night').addEventListener('click',()=>{
  night=!night;world?.setNight(night);$('island').classList.toggle('is-night',night);
  $('day-night').setAttribute('aria-pressed',String(night));$('day-night').setAttribute('aria-label',night?'切换至白天':'切换至夜晚');
  $('day-night-label').textContent=night?'破晓':'入夜';$('scene-status').textContent=night?'夜晚 · 灯火映江':'白日 · 江雾未散';
});
$('open-windows').addEventListener('click',()=>world?.openWindows());
$('boat-mode').addEventListener('click',()=>world?.startBoat());
$('exit-boat').addEventListener('click',()=>world?.exitBoat());
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&world?.boatMode)world.exitBoat();});
$('continue-button').addEventListener('click',async()=>{
  // 按需求使用浏览器原生确认框：是=完整传说动画，否=留在岛上继续探索。
  if(window.confirm('是否体验蜡染？')){
    world?.exitBoat();await switchScreen('story');story.start();
  }else toast('好，山水再留一会儿。准备好时点击“继续”。');
});
$('skip-story').addEventListener('click',()=>story.skip());
async function enterBatik(){await switchScreen('batik');batik.start();}
$('return-home').addEventListener('click',()=>{batik.reset();switchScreen('home');});

// 模型在后台预载；首页不被加载阻塞，首次进入岛屿时通常已经可交互。
try{
  world=await createWorld($('world-canvas'),{
    onToast:toast,
    onBoatChange:active=>{$('exit-boat').hidden=!active;$('boat-mode').disabled=active;$('scene-status').textContent=active?'乘船 · 顺流览城':(night?'夜晚 · 灯火映江':'白日 · 江雾未散');}
  });
  world.setActive(false);
  gsap.to($('world-loading'),{opacity:0,duration:.4,onComplete:()=>$('world-loading').hidden=true});
}catch(error){
  $('world-loading').textContent='三维场景暂不可用，请刷新重试';
  console.error('场景初始化失败',error);
}

// 只读调试信息用于验证交互状态，不参与画面或数据持久化。
window.__XIANGXI__={get screen(){return currentScreen;},get city(){return world?.city;},get batikStep(){return batik.step;},get strokes(){return batik.strokes;},get stats(){return world?.getStats();}};
