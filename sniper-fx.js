// Presentation only: the caller applies the move once this sequence finishes.
export async function sniperShot({actor,angle,animate,wait,fire}){
 const glasses=document.createElement('span');glasses.className='sniper-glasses';glasses.setAttribute('aria-hidden','true');
 glasses.innerHTML='<svg viewBox="0 0 80 30"><path d="M3 7 11 9M69 9 77 7M34 11Q40 7 46 11" fill="none" stroke="#111318" stroke-width="5" stroke-linecap="round"/><path d="M9 6 34 8 32 22Q19 29 11 20ZM46 8 71 6 69 20Q61 29 48 22Z" fill="#080b10" stroke="#b6c1c7" stroke-width="1.4"/><path d="m14 10 9 1m29 1 10-2" stroke="#52616c" stroke-width="2"/></svg>';
 const pivot=document.createElement('span');pivot.className='sniper-pivot';pivot.style.transform='rotate('+angle+'rad)';pivot.setAttribute('aria-hidden','true');
 const rifle=document.createElement('span');rifle.className='sniper-rifle';rifle.style.setProperty('--scope-flip',Math.cos(angle)<0?-1:1);
 rifle.innerHTML='<svg viewBox="0 0 160 52"><g stroke="#070c10" stroke-width="2" stroke-linejoin="round"><path d="M4 27 29 21 42 24 43 36 18 39 4 44Z" fill="#584b3d"/><path d="M28 24H93V35H30Z" fill="#52616a"/><path d="M42 34 55 34 51 48 43 46Z" fill="#1b2329"/><path d="M55 35v9h13l4-9" fill="none"/><path d="M91 25H139V31H91Z" fill="#a4b2b8"/><path d="M137 22h19v12h-19Z" fill="#27343e"/><path d="M50 23V16M77 23V16" fill="none" stroke-width="4"/><path d="M41 7h45v10H41Z" fill="#263440"/><path d="M37 5h9v14h-9ZM82 4h11v16H82Z" fill="#465766"/><path d="M56 5v-3h9v5" fill="#364653"/><path d="m88 35 12 13m-12-13-5 13" fill="none"/><path d="M34 27H85M96 27h33" stroke="#d9e3e4" stroke-width="1.5"/></g><ellipse cx="90" cy="12" rx="2" ry="5" fill="#94d9d3"/></svg>';
 const flash=document.createElement('span');flash.className='sniper-flash';flash.innerHTML='<svg viewBox="0 0 60 60"><path d="m0 30 18-6-2-13 12 12 28-11-19 18 19 17-28-10-12 12 2-13Z" fill="#ffb13b"/><path d="m0 30 24-7 17 7-17 7Z" fill="#fff8cc"/></svg>';
 pivot.append(rifle,flash);actor.append(pivot,glasses);
 try{
  await Promise.all([
   animate(glasses,[{opacity:0,transform:'translateY(-65%) rotate(-12deg)'},{opacity:1,transform:'translateY(0) rotate(0deg)'}],{duration:240,easing:'ease-out'}),
   animate(rifle,[{opacity:0,transform:'translateX(-15%) scaleY(var(--scope-flip))'},{opacity:1,transform:'translateX(0) scaleY(var(--scope-flip))'}],{duration:280,easing:'ease-out'})
  ]);
  rifle.classList.add('aimed');
  await wait(360);
  await Promise.all([
   animate(flash,[{opacity:0,transform:'scale(.3)'},{opacity:1,transform:'scale(1)',offset:.15},{opacity:0,transform:'scale(.65)'}],{duration:180}),
   animate(rifle,[{transform:'translateX(0) scaleY(var(--scope-flip))'},{transform:'translateX(-8%) scaleY(var(--scope-flip))',offset:.18},{transform:'translateX(0) scaleY(var(--scope-flip))'}],{duration:300,easing:'ease-out'}),
   fire()
  ]);
  await wait(180);
 }finally{pivot.remove();glasses.remove();}
}
