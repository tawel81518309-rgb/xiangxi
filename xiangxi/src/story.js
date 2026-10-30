import { gsap } from 'gsap';

/** 蓝白叙事时间线：三幕共用一条时间线，跳过时先销毁，避免回调重复进入游戏。 */
export function createStory(onComplete) {
  const root=document.getElementById('story');
  const scenes=[...root.querySelectorAll('.story-scene')];
  const subtitle=document.getElementById('story-subtitle');
  const progress=[...root.querySelectorAll('.story-progress i')];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let timeline=null,finished=false;

  const captions=[
    '枫木树心，化作蝴蝶妈妈。',
    '蝴蝶妈妈与水泡“游方”，生下十二个蛋。',
    '鹡宇鸟孵出人类祖先姜央，也孵出世间万物。'
  ];
  function caption(index){subtitle.textContent=captions[index];progress.forEach((p,i)=>p.classList.toggle('is-active',i===index));}
  function finish(){if(finished)return;finished=true;timeline?.kill();onComplete();}

  function start(){
    finished=false;timeline?.kill();
    gsap.set(scenes,{autoAlpha:0});
    gsap.set('.maple-tree',{autoAlpha:1,scale:1,transformOrigin:'50% 70%'});
    gsap.set('.butterfly-hero',{autoAlpha:0,scale:.45,transformOrigin:'50% 50%'});
    gsap.set('.tree-heart',{scale:1,transformOrigin:'50% 50%'});
    gsap.set('.story-butterfly-small',{x:0,y:0,rotation:0,transformOrigin:'50% 50%'});
    gsap.set('.bubbles',{x:0,y:0});
    gsap.set('.eggs',{autoAlpha:0,y:20});
    gsap.set('.bird',{y:0,scale:1,transformOrigin:'50% 50%'});
    gsap.set(['.ancestor','.living-things'],{autoAlpha:0,y:18});
    caption(0);
    const unit=reduced ? .35 : 1;
    timeline=gsap.timeline({defaults:{ease:'power2.inOut'},onComplete:finish});
    timeline.set(scenes[0],{autoAlpha:1})
      .from('.maple-tree',{y:40,autoAlpha:0,duration:1.2*unit})
      .to('.tree-heart',{scale:1.35,duration:.7*unit,yoyo:true,repeat:1})
      .to('.maple-tree',{autoAlpha:.16,scale:.92,duration:1*unit},'+=.3')
      .to('.butterfly-hero',{autoAlpha:1,scale:1,duration:1.1*unit},'<')
      .to(scenes[0],{autoAlpha:0,duration:.55*unit},'+=1.1')
      .call(caption,[1])
      .set(scenes[1],{autoAlpha:1})
      .from('.story-butterfly-small',{x:-180,y:80,rotation:-12,duration:1.4*unit})
      .from('.bubbles',{x:140,y:-60,autoAlpha:0,duration:1.2*unit},'<')
      .to('.story-butterfly-small',{y:-18,duration:.8*unit,yoyo:true,repeat:1})
      .to('.bubbles',{y:-20,duration:.8*unit,yoyo:true,repeat:1},'<')
      .to('.eggs',{autoAlpha:1,y:0,duration:1*unit},'-=.5')
      .to(scenes[1],{autoAlpha:0,duration:.55*unit},'+=1')
      .call(caption,[2])
      .set(scenes[2],{autoAlpha:1})
      .from('.sun-disc',{scale:.6,autoAlpha:0,rotation:-30,transformOrigin:'50% 50%',duration:1.3*unit})
      .from('.bird',{scale:.7,autoAlpha:0,duration:1.1*unit},'<')
      .to('.bird',{y:-16,duration:.65*unit,yoyo:true,repeat:1})
      .to('.ancestor',{autoAlpha:1,y:0,duration:1*unit},'-=.4')
      .to('.living-things',{autoAlpha:1,y:0,duration:1*unit},'<')
      .to({},{duration:1.3*unit});
  }
  return {start,skip:finish,stop(){timeline?.kill();}};
}
