import { openRoom, roomFromHash } from './room.js';
import {difficulties,cleanDifficulty} from './bot.js';
import {sniperShot} from './sniper-fx.js';
import {Battle as BattleV6} from './_compat/v6/battle.js';
import {Battle as BattleV7} from './_compat/v7/battle.js';
import {Battle as BattleV8} from './_compat/v8/battle.js';
import {Battle as BattleV13,bosses as bossesV13} from './_compat/v13/battle.js';
import {Battle as BattleV12,bosses as bossesV12} from './_compat/v12/battle.js';
import {Battle as BattleV11,bosses as legacyBosses} from './_compat/v11/battle.js';
import {Battle as BattleV10} from './_compat/v10/battle.js';
import {Battle as BattleV9} from './_compat/v9/battle.js';
import {Battle,abilities,ability,archive,bosses,types,defaultLoadout,randomLoadout,maxOf,attack,attackOf,allSquares,files,center,ringOf,burnLevel,BURN_START,BURN_STEP,MAX_ENERGY} from './battle.js';
const $=id=>document.getElementById(id),board=$('board'),effects=$('effects'),floats=$('floats');
const currentRules=14;
let game=new Battle(),rulesVersion=currentRules,storageKey='arena-game-v'+currentRules;
const draftKey='arena-draft-v2';
let difficulty='normal';
let room=null,solo=null,playerColor='w',opponentColor='b';
let botRetryBlocked=false;
let resultDismissed=false;
let busy=false,selected=null,mode=null,revive=null,aim=null,pending=null,events=[],last=null,draft=loadDraft();
const names={p:'Пешка',n:'Конь',b:'Слон',r:'Ладья',q:'Ферзь',k:'Король'};
const accents={p:'#ff8a3d',n:'#ff3b3b',b:'#9b7bff',r:'#5fa8ff',q:'#e467ff',k:'#4fd69c'};
const cardButtons={};
// Gold line ornaments for the card windows: one per ability.
const G='stroke="url(#gold)" fill="none" stroke-width="2.2" stroke-linejoin="round"';
const rays=(n,r1,r2)=>Array.from({length:n},(_,i)=>{const a=i*2*Math.PI/n;return `<line x1="${(50+r1*Math.cos(a)).toFixed(1)}" y1="${(50+r1*Math.sin(a)).toFixed(1)}" x2="${(50+r2*Math.cos(a)).toFixed(1)}" y2="${(50+r2*Math.sin(a)).toFixed(1)}" ${G}/>`;}).join('');
const dots=(n,r,size)=>Array.from({length:n},(_,i)=>{const a=i*2*Math.PI/n;return `<circle cx="${(50+r*Math.cos(a)).toFixed(1)}" cy="${(50+r*Math.sin(a)).toFixed(1)}" r="${size}" ${G}/>`;}).join('');
const emblems={
 blast:`<circle cx="50" cy="50" r="30" ${G}/>${rays(12,36,47)}`,
 trench:`<path d="M6 70 Q50 40 94 70" ${G}/><path d="M14 82 Q50 56 86 82" ${G} opacity=".55"/><path d="M50 8 L80 20 V44 Q80 62 50 74 Q20 62 20 44 V20 Z" ${G}/>`,
 svarog:`<polygon points="50,3 63,19 85,15 81,37 97,50 81,63 85,85 63,81 50,97 37,81 15,85 19,63 3,50 19,37 15,15 37,19" ${G}/><polygon points="50,15 60,27 75,25 73,40 85,50 73,60 75,75 60,73 50,85 40,73 25,75 27,60 15,50 27,40 25,25 40,27" ${G} opacity=".55"/>`,
 gallop:`<polyline points="10,84 30,44 52,68 72,24 90,46" ${G}/>${[[10,84],[30,44],[52,68],[72,24],[90,46]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="5" ${G}/>`).join('')}`,
 quiet:`<circle cx="50" cy="50" r="42" ${G}/><circle cx="50" cy="50" r="27" ${G} opacity=".6"/><line x1="50" y1="2" x2="50" y2="24" ${G}/><line x1="50" y1="76" x2="50" y2="98" ${G}/><line x1="2" y1="50" x2="24" y2="50" ${G}/><line x1="76" y1="50" x2="98" y2="50" ${G}/>`,
 train:`<path d="M8 30 H92 M8 70 H92" ${G}/>${[16,32,48,64,80].map(x=>`<line x1="${x}" y1="24" x2="${x}" y2="76" ${G} opacity=".55"/>`).join('')}<path d="M70 18 L90 50 L70 82" ${G}/>`,
 swap:`<path d="M14 36 H72 L62 26 M86 64 H28 L38 74" ${G}/><circle cx="50" cy="50" r="44" ${G} opacity=".4"/>`,
 order:`<path d="M50 6 V60 M34 44 L50 60 L66 44" ${G}/><path d="M24 74 H76 M30 86 H70" ${G} opacity=".6"/>${dots(8,46,2.5)}`,
 mirror:`<polygon points="50,4 92,50 50,96 8,50" ${G}/><polygon points="50,20 76,50 50,80 24,50" ${G} opacity=".55"/><line x1="30" y1="30" x2="44" y2="44" ${G}/>`,
 revive:`${dots(12,40,4.5)}<circle cx="50" cy="50" r="30" ${G} opacity=".55"/>`,
 rally:`<path d="M20 60 Q50 20 80 60" ${G}/><path d="M10 70 Q50 6 90 70" ${G} opacity=".55"/><path d="M30 52 Q50 32 70 52" ${G} opacity=".8"/>`,
};
const goldDefs='<defs><linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe7a3"/><stop offset=".5" stop-color="#c8963c"/><stop offset="1" stop-color="#f3d07a"/></linearGradient></defs>';
emblems.stealth=`<path d="M6 50 Q50 8 94 50 Q50 92 6 50" ${G}/><circle cx="50" cy="50" r="15" ${G}/><path d="M16 86 L84 14" ${G}/>`;
const emblemSvg=id=>'<svg class="emblem" viewBox="0 0 100 100" aria-hidden="true">'+goldDefs+(emblems[id]||'')+'</svg>';
function loadDraft(){try{const d=JSON.parse(localStorage.getItem(draftKey)||'null');if(d)return {deck:{...defaultLoadout(),...d.deck},boss:bosses[d.boss]?d.boss:null,difficulty:cleanDifficulty(d.difficulty)};}catch{}return {deck:defaultLoadout(),boss:null,difficulty:'normal'};}
function saved(){if(room)return;try{localStorage.setItem(storageKey,JSON.stringify({rulesVersion,actions:game.actions,loadout:game.loadout,boss:game.boss,difficulty,model:'arena'}));}catch{}}
function clear(){selected=null;mode=null;revive=null;aim=null;pending=null;effects.replaceChildren();}
function image(type,color){const img=document.createElement('img');img.src='./pieces/'+color+type+'.svg';img.alt='';img.draggable=false;return img;}
const bossAsset=key=>'./assets/boss-'+key+'.svg';
const hunterV8=()=>game.boss==='hunter'&&typeof game.hunterInfo==='function';
function token(p){
 const hp=p.hp??maxOf(p),el=document.createElement('div');
 el.className='piece '+(p.color===playerColor?'ally':'enemy')+(hp<maxOf(p)?' wounded':'');
 const base=document.createElement('i');base.className='base';
 const atk=document.createElement('span');atk.className='atk';atk.textContent=attackOf(p);
 const life=document.createElement('span');life.className='hpv';life.textContent=hp;
 const pieceImage=image(p.type,p.color);
 if(p.color==='b'&&p.type==='k'&&bosses[game.boss]){pieceImage.src=bossAsset(game.boss);el.classList.add('boss-token');}
 if(p.seal)el.classList.add('seal-token');
 if(p.variant==='wolf'){pieceImage.src='./assets/hunter-wolf.svg';el.classList.add('wolf-token');}
 el.append(base,pieceImage,atk,life);return el;
}
const themes=[['lacquer','Шкатулка'],['tavern','Таверна']];
function applyTheme(name){const theme=themes.find(t=>t[0]===name)||themes[0];document.documentElement.dataset.theme=theme[0];$('themeToggle').textContent='Тема: '+theme[1];try{localStorage.setItem('arena-theme',theme[0]);}catch{}}
const idOf=type=>game.abilityOf(type,playerColor).id;
const needsChoice=type=>idOf(type)==='revive';
function kingHp(color){return Object.values(game.board).find(p=>p.color===color&&p.type==='k')?.hp||0;}
function targets(){
 if(!selected)return [];
 if(!mode)return game.legal(selected);
 return game.legalSpecials(selected).filter(m=>!revive||m.revive===revive);
}
function targetSquares(){return [...new Set(targets().map(m=>m.to))];}
// What a plain attack would do to each visible enemy in reach: the blow, a counter-strike, or a mirror.
function attackPreview(){
 const out=new Map();if(!selected||mode||game.side!==playerColor)return out;
 const view=game.view(playerColor),attacker=view.get(selected);if(!attacker)return out;
 for(const m of game.legal(selected)){
  const impact=view.impact(m);if(!impact.struck)continue;
  const blow=impact.damage.find(d=>!d.counter&&!d.reflected),back=impact.damage.find(d=>d.counter||d.reflected),victim=view.get(impact.struck);
  out.set(m.to,{amount:blow?.amount||0,reasons:blow?.reasons||[],mirror:!blow,lethal:Boolean(blow)&&(victim.hp??maxOf(victim))<=blow.amount,back:back?.amount||0,backLethal:Boolean(back)&&(attacker.hp??maxOf(attacker))<=back.amount});
 }
 return out;
}
function error(text=''){$('error').textContent=text;$('error').hidden=!text;}
function buildCards(){
 $('cards').replaceChildren();
 for(const type of types){
  const index=game.loadout[playerColor][type],def=ability(type,index),btn=document.createElement('button');btn.className='card'+(index?' alt':'');btn.type='button';btn.title=def.text;btn.dataset.type=type;
  btn.style.setProperty('--accent',accents[type]);
  const cost=document.createElement('span');cost.className='cost';cost.textContent=def.id==='revive'?def.cost+'+':def.cost;
  const art=document.createElement('span');art.className='art';art.innerHTML=emblemSvg(def.id);
  const cd=document.createElement('span');cd.className='cd';
  art.append(image(type,playerColor),cd);
  const title=document.createElement('strong');title.textContent=def.name;
  const label=document.createElement('span');label.className='card-label';label.textContent=def.label;
  const available=document.createElement('span');available.className='availability';
  btn.append(cost,art,title,label,available);btn.addEventListener('click',()=>chooseCard(type));$('cards').append(btn);cardButtons[type]=btn;
 }
 const foe=types.map(t=>names[t]+': '+ability(t,game.loadout[opponentColor][t]).name).join(' · ');
 const boss=game.boss&&(rulesVersion<12?legacyBosses[game.boss]:rulesVersion===12?bossesV12[game.boss]:rulesVersion===13?bossesV13[game.boss]:bosses[game.boss]);
 document.documentElement.dataset.boss=game.boss||'';
 const portrait=$('opponentPanel').querySelector('.portrait');portrait.classList.toggle('boss-portrait',Boolean(boss));
 const portraitImage=portrait.querySelector('img');portraitImage.classList.toggle('chess-icon',Boolean(boss));portraitImage.onerror=()=>{portraitImage.onerror=null;portraitImage.src='./pieces/'+opponentColor+'k.svg';};portraitImage.src=boss?bossAsset(game.boss):'./pieces/'+opponentColor+'k.svg';
 $('botName').textContent=room?'Друг · '+(opponentColor==='w'?'белые':'чёрные'):(boss?boss.name:'Соперник')+' · '+difficulties[difficulty];
 $('playerSide').textContent=playerColor==='w'?'белые':'чёрные';
 document.querySelector('.human .portrait img').src='./pieces/'+playerColor+'k.svg';
 $('botName').title=$('botName').textContent;
 $('foeLoadout').textContent=(boss?boss.text+' ':'')+foe;$('opponentPanel').title='Способности соперника - '+foe;
 if(game.boss==='giant'){$('foeLoadout').textContent='Великан: Топот — '+giantDamage(game.giantInfo(),'stomp')+' урона вокруг тела, Взмах — '+giantDamage(game.giantInfo(),'sweep')+' урона полосой. Шаг → замах → удар; после удара уязвим один твой ход. Общие '+game.giantInfo().maxHp+' HP.';if(game.giantInfo().version>=12)$('foeLoadout').textContent=boss.text+' '+boss.lore;$('opponentPanel').title=$('foeLoadout').textContent;}
 $('opponentPanel').classList.toggle('boss',Boolean(boss));
}
function renderResult(){
 const over=game.isOver(),outcome=game.draw?'draw':game.winner===playerColor?'win':'loss';
 if(!over)resultDismissed=false;
 const panel=$('gameResult');panel.hidden=!over||busy||resultDismissed;panel.dataset.outcome=outcome;
 $('resultTitle').textContent=outcome==='win'?'Победа':outcome==='loss'?'Поражение':'Ничья';
 $('resultText').textContent=outcome==='win'?(game.boss==='giant'?'Великан повержен.':'Король соперника повержен.'):outcome==='loss'?'Твой король повержен.':'Партия завершилась без победителя.';
 $('resultNew').hidden=Boolean(room);
 $('resultReturn').hidden=!over||!resultDismissed;
 $('turn').classList.toggle('finished',over);$('turn').dataset.outcome=over?outcome:'';
}
function renderHunterIntel(info){
 const layer=$('hunterIntelLayer'),notice=$('hunterIntent');layer.replaceChildren();notice.hidden=!info||game.isOver();
 if(!info)return;
 const point=s=>[(files.indexOf(s[0])+.5)*100,(8-Number(s[1])+.5)*100];
 const points=squares=>squares.map(s=>point(s).join(',')).join(' ');
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 800 800');
 let drawing='<defs><marker id="hunter-aim-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0L6 3.5L0 7" fill="none" stroke="#ffb99c" stroke-width="1.5"/></marker></defs>';
 if(info.intel?.extraPath)drawing+='<polyline class="hunter-known-shot" points="'+points([info.intel.source,...info.intel.extraPath])+'"/>';
 if(info.extraAim){const a=info.extraAim;drawing+='<polyline class="hunter-known-aim hunter-rage-aim" points="'+points([...a.cells,a.target])+'" marker-end="url(#hunter-aim-arrow)"/>';}
 if(info.intel){drawing+='<polyline class="hunter-known-shot" points="'+points([info.intel.source,...info.intel.path])+'"/>';const [x,y]=point(info.intel.source);drawing+='<circle class="hunter-known-source" cx="'+x+'" cy="'+y+'" r="37"/>';}
 if(info.aim){
  const [x,y]=point(info.aim.target),[dx,dy]=info.aim.direction;
  const trail=info.aim.cells.length?points([...info.aim.cells,info.aim.target]):(x-dx*35)+','+(y+dy*35)+' '+x+','+y;
  drawing+='<polyline class="hunter-known-aim" points="'+trail+'" marker-end="url(#hunter-aim-arrow)"/>';
 }
 svg.innerHTML=drawing;layer.append(svg);
 notice.dataset.phase=info.cornered?'cornered':info.flushed?'flushed':info.aim?'aim':info.intel?'search':'search';
 let title='Обложить зверя',text='Шесть лёжек. Подведи фигуры к кустам или займи их, чтобы лишить охотника укрытий. Волки ходят как кони.';
 if(info.intel){title='Стреляли с '+info.intel.source+' · охотник сменил лёжку';text=info.intel.candidates.length?'Линия выстрела и «?» останутся до конца твоего хода. «?» — возможное укрытие, не подтверждённая фигура.':'Выстрел раскрывает источник. Доступных кандидатов для перебежки не осталось.';}
 if(info.aim){title='Прицел на '+info.aim.target+' → выстрел и перебежка';text='После твоего хода первая фигура на линии получит до '+(info.shotDamage??3)+' урона. Уведи цель, перекрой линию или рани охотника, чтобы сорвать прицел.';}
 if(info.flushed){title='Выкурен · финальная дуэль'+(info.aim?' · прицел на '+info.aim.target:'');text=(rulesVersion>=9?'Огонь уничтожил внешние лёжки, последняя перекрыта. Охотник теперь постоянно виден.':'Открытых лёжек не осталось: охотник постоянно виден и ходит как король.')+(info.aim?' Выстрел до '+(info.shotDamage??3)+' урона сработает после твоего хода.':'');}
 if(info.cornered){title=info.flushed?'Выкурен · уязвим сейчас':'Загнан!';text='Охотник виден и получает +1 урона этот ход.'+(rulesVersion>=9&&!info.flushed?' Может снова скрыться, если откроется лёжка.':'');}

 if(info.visionRadius===1){
  title='Охота · обзор фигур 1, короля 2';text='Закрывай лёжки фигурами и ищи Охотника. После выстрела он остаётся открытым на один твой ход. Метка ⌖ разрешает дальний прицел; повторный удар той же фигурой слабее на 1.';
  if(info.intel){title='Выстрел с '+info.intel.source;text='Пунктир показывает прошлый выстрел. «?» — возможные укрытия, присутствие Охотника там не подтверждено.';}
  if(info.aim){title='Прицел на '+info.aim.target+' · выстрел после твоего хода';text='3 урона первой фигуре на линии. Уведи цель с линии или поставь заслон. Найденного Охотника можно ранить и сорвать прицел.';}
  if(info.phase==='window'){title='Охотник раскрыт · окно до конца твоего хода';text='Ударь или перекрой отход к «?». Затем Охотник потратит свой ход на уход. Дополнительные действия Приказа входят в это окно.';}
  if(info.cornered){title='Загнан · +1 урона по Охотнику';text='Отход перекрыт. Через два хода без выхода он перейдёт во временную дуэль; открытая лёжка снова позволит уйти.';}
  if(info.temporaryDuel){title='Временная дуэль'+(info.aim?' · прицел на '+info.aim.target:'');text='Охотник виден, ходит и стреляет. Открытая лёжка позволит ему скрыться.';}
  if(info.flushed){title='Выкурен · финальная дуэль'+(info.aim?' · прицел на '+info.aim.target:'');text='Все лёжки сгорели. Охотник постоянно виден, ходит и стреляет.';}
 }
 if(info.version>=13){
  if(info.phase==='window')text='Ударь или перекрой отход. При уходе Охотник сразу выберет следующий прицел. Приказ даёт действия в этом же окне.';
  if(info.aim){text='Первая стрела: 3 урона; Стража её не ослабляет, Окоп снимает 1. Уведи цель, поставь заслон или сорви прицел: попадание на 3+ урона либо вплотную.';if(info.extraAim){title='Двойной прицел · '+info.aim.target+' и '+info.extraAim.target;text+=' Стрела ярости в '+info.extraAim.target+' — ещё 3 урона. Обе линии сработают после твоего хода.';}}
  if(info.temporaryDuel||info.flushed)text+=' Лук: 3 урона по прямой/диагонали до 4 клеток, включая ответный выстрел. Заслон перекрывает линию; Стража не ослабляет стрелу, Окоп снимает 1.';
  if(!info.aim&&!info.temporaryDuel&&!info.flushed)text+=' Лук отвечает на обычные атаки: 2 урона по прямой/диагонали до 4 клеток. Способности не вызывают ответ. В кустах удары слона, ладьи и ферзя с 2+ клеток вдвое слабее. Подойди вплотную, используй коня или засаду из инвиза.';
  if(info.braced)text+=' Пригнулся: дополнительные попадания в этот ход −2 урона.';
 }
 $('hunterIntentTitle').textContent=title;$('hunterIntentText').textContent=text;
}
function giantPattern(kind){return {stomp:'Топот',sweep:'Взмах',throw:'Бросок',charge:'Рывок'}[kind]||'Удар';}
function giantDamage(info,kind){return info.strikeDamage?.[kind]??(kind==='stomp'?3:4);}
function renderSupport(info){
 const notice=$('retinueIntent');notice.hidden=!info||game.isOver();if(!info)return;
 const plan=game.bossPlan,iron=info.kind==='iron',name=iron?'Обвал':'Ритуал';notice.dataset.phase=plan?'aim':'search';
 $('retinueIntentTitle').textContent=plan?name+' · '+plan.damage+' урона после твоего хода':iron?(info.active?'Строй собран · следующий Обвал 3':'Строй разорван · следующий Обвал 2'):'Печати '+info.squares.length+'/4 · радиус ритуала '+info.radius;
 $('retinueIntentText').textContent=plan?(iron?'Уведи фигуры из отмеченной зоны. Урон и зона этого Обвала уже зафиксированы.':'Уйди с меток или нанеси Колдуну урон, чтобы сорвать ритуал. Печати меняют только следующие зоны.'):(iron?'Рядом с королём '+info.linked.length+' ладьи. Нужно две для Строя. Вымани или уничтожь охрану.':'Четыре слона расширяют крест до трёх клеток в каждую сторону. Уничтожай печати: две-три дают радиус 2, одна или ни одной — 1.');
 const marks=$('supportMarks');marks.replaceChildren();for(let i=0;i<4;i++){const mark=document.createElement('i');mark.className='support-dot'+(i<info.squares.length?' alive':'')+(iron&&i<info.linked.length?' linked':'');mark.textContent=iron?'♜':'◇';marks.append(mark);}marks.setAttribute('aria-label',iron?'Ладей '+info.squares.length+', в строю '+info.linked.length:'Печатей '+info.squares.length+' из четырёх');
}
function renderGiant(info){
 const layer=$('giantLayer'),notice=$('giantIntent');layer.replaceChildren();notice.hidden=!info||game.isOver();
 if(!info)return;
 if(info.hp>0){
  const body=document.createElement('div');body.id='giantBody';body.className='giant-body'+(info.weak?' weak':'');
  body.style.left=files.indexOf(info.anchor[0])*12.5+'%';body.style.top=(7-Number(info.anchor[1]))*12.5+'%';
  const img=document.createElement('img');img.src='./assets/boss-giant.svg';img.alt='';img.draggable=false;
  const life=document.createElement('div');life.className='giant-life';const fill=document.createElement('i');fill.style.width=Math.max(0,Math.min(100,info.hp/info.maxHp*100))+'%';const label=document.createElement('b');label.textContent=info.hp+' / '+info.maxHp;life.append(fill,label);body.append(img,life);layer.append(body);
 }
 notice.dataset.phase=info.weak?'cornered':info.plan?'aim':'search';
 const pattern=giantPattern(info.plan?.kind),damage=giantDamage(info,info.plan?.kind);
 const phaseLabel=info.enraged?'Ярость · ':'';
 $('giantIntentTitle').textContent=phaseLabel+(info.weak?'Великан выдохся · +1 урона по нему':info.plan?pattern+' · '+(info.phase==='windup'?'до удара два твоих хода':'удар после этого твоего хода'):info.enraged?'следующий удар ускорен':'Великан · шаг → замах → удар');
 $('giantIntentText').textContent=info.weak?'Уязвимость действует этот твой ход. Атакуй любую из четырёх клеток тела: HP общие.':info.plan?'Отмеченная область получит '+damage+' урона. Уведи фигуры из зоны; после удара великан станет уязвим.':'Одно тело занимает четыре клетки. После шага зона удара известна заранее. Огонь в этом бою отключён.';
 if(info.version===12){
  if(info.weak)$('giantIntentText').textContent='Кожа снята, +1 урона до конца твоего хода. Повторный удар одной фигурой всё ещё слабее на 1.';
  else if(!info.plan){$('giantIntentTitle').textContent=info.enraged?'Вторая фаза · доступен Рывок':'Каменная кожа';$('giantIntentText').textContent='Издалека −2 урона, вплотную полный. Ударившая фигура получает ⌖: возможен Бросок. Повторный удар одной фигурой слабее на 1.';}
  else if(info.plan.kind==='throw')$('giantIntentText').textContent='Бросок: 3 урона первой фигуре на отмеченной линии. Уйди с линии или поставь заслон; направление не меняется.';
  else if(info.plan.kind==='charge')$('giantIntentText').textContent='Рывок после твоего хода: 2 урона на пути. Перед выжившей фигурой Великан остановится. После Рывка Великан объявит основной удар; на ответ будет два хода.';
 }else if(info.enraged&&!info.plan)$('giantIntentText').textContent+=' С нового замаха до удара один твой ход.';
 if(info.version>=13){
  if(info.weak){$('giantIntentTitle').textContent='Великан выдохся · один усиленный удар';$('giantIntentText').textContent='Следующее попадание: кожа снята, +1 урона. После него кожа восстановится — дополнительные действия Приказа не продлевают уязвимость.';}
  else if(!info.plan){$('giantIntentTitle').textContent=info.enraged?'Вторая фаза':'Каменная кожа';$('giantIntentText').textContent='Издалека −2 урона, вплотную полный. Отмеченному стрелку грозит дополнительный Бросок во время замаха.'+(info.enraged&&difficulty!=='easy'?' Новые удары теперь после одного ответа.':' Вторая фаза при '+info.rageAt+' HP.');}
  if(info.plan?.kind==='charge')$('giantIntentText').textContent='Рывок после твоего хода: 2 урона на пути, остановка перед выжившими. Затем новый замах: '+(difficulty==='easy'?'два ответа.':'один ответ.');
  if(info.plan?.secondary){$('giantIntentTitle').textContent+=' + ответный Бросок';$('giantIntentText').textContent+=' Фиолетовая линия: 3 урона первой фигуре. Оба удара после этого твоего хода.';}
 }

}
let noticesObserver=null;
function syncBoardNotices(){
 if(typeof matchMedia!=='function'||typeof getComputedStyle!=='function')return;
 const notices=[$('burnNotice'),$('hunterIntent'),$('giantIntent'),$('retinueIntent')];
 const height=matchMedia('(min-width: 901px)').matches?notices.filter(el=>!el.hidden).reduce((sum,el)=>sum+el.getBoundingClientRect().height+(parseFloat(getComputedStyle(el).marginBottom)||0),0):0;
 const value=Math.ceil(height)+'px',root=document.documentElement;
 if(root.style.getPropertyValue('--notice-space')!==value)root.style.setProperty('--notice-space',value);
 if(!noticesObserver&&typeof ResizeObserver==='function'){noticesObserver=new ResizeObserver(()=>requestAnimationFrame(syncBoardNotices));notices.forEach(el=>noticesObserver.observe(el));}
}
function render(){
 if(game.pending?.kind==='stealth'&&game.side===playerColor&&!busy){selected=game.pending.square;mode=null;}
 const target=new Set(targetSquares()),hits=attackPreview(),burnSoon=burnLevel(game.ply+4)>burnLevel(game.ply);
 const hunter=hunterV8()?game.hunterInfo('w'):null;
 const giant=game.giantInfo?.()||null,support=game.supportInfo?.()||null;
 $('rulesVersionLabel').textContent=rulesVersion===currentRules?'Баланс 14':'Старая партия · '+rulesVersion;$('rulesVersionLabel').title=rulesVersion===currentRules?'Четыре ладьи и Строй; слоны-печати Колдуна':'Для обновлённых боссов начни новую партию. Эта партия сохраняет прежние правила.';document.documentElement.dataset.encounterRules=String(rulesVersion);document.documentElement.dataset.hunterRules=typeof game.hunterInfo==='function'?'8':'legacy';
 const fog=game.fogEnabled(),lit=fog?game.litSquares(playerColor):new Set(allSquares),plan=hunter?null:game.hunterPlan,bossPlan=game.bossPlan;
 const trace=!hunter&&game.hunterTrace?.expiresAt>game.ply?game.hunterTrace:null;
 board.classList.toggle('fog-board',fog);
 const sources=mode?new Set(game.legalSpecials().filter(m=>m.power===mode).map(m=>m.from)):new Set();
 board.replaceChildren();
 for(const s of (playerColor==='w'?allSquares:[...allSquares].reverse())){
  const p=game.visible(s,playerColor),b=document.createElement('button');
  b.className='square'+((files.indexOf(s[0])+(+s[1]))%2===0?' dark':'');
  b.type='button';b.dataset.square=s;b.setAttribute('role','gridcell');b.setAttribute('aria-label',s+(p?', '+(p.variant==='wolf'?'Волк':names[p.type])+(p.color==='w'?' белые':' чёрные'):''));
  if(center.includes(s)){b.classList.add('center');const mark=document.createElement('i');mark.className='center-mark';b.append(mark);b.title='Центр: +2 энергии за ход, если здесь стоит твоя фигура';}
  if(!lit.has(s)&&!p){b.classList.add('fogged');b.setAttribute('aria-label',s+', туман: содержимое неизвестно');b.title='Туман: содержимое клетки неизвестно';const mist=document.createElement('i');mist.className='fog-cover';b.append(mist);}
  if(hunter?.hides.includes(s)){b.classList.add('hunter-hide');const bush=document.createElement('img');bush.className='hide-bush';bush.src='./assets/hunter-bush.svg';bush.alt='';bush.draggable=false;b.append(bush);const hint='Лёжка охотника. Займи её или подведи фигуру вплотную (короля — на две клетки), чтобы закрыть укрытие. Огонь тоже закрывает лёжку.';b.title=(b.title?b.title+' · ':'')+hint;b.setAttribute('aria-label',b.getAttribute('aria-label')+', лёжка');}
  if(hunter?.aim?.cells.includes(s))b.classList.add('hunter-aim-line');
  if(hunter?.extraAim?.cells.includes(s))b.classList.add('hunter-aim-line','hunter-rage-line');
  if(hunter?.extraAim?.target===s){b.classList.add('hunter-aim-target','hunter-rage-target');const mark=document.createElement('span');mark.className='hunter-mark';mark.textContent='⌖3';b.append(mark);const hint='Стрела ярости: 3 урона первой фигуре на фиолетовой линии после твоего хода.';b.title=(b.title?b.title+' · ':'')+hint;b.setAttribute('aria-label',b.getAttribute('aria-label')+', '+hint);}
  if(hunter?.aim?.target===s){b.classList.add('hunter-aim-target');const mark=document.createElement('span');mark.className='hunter-mark';mark.textContent='⌖';b.append(mark);const hint=hunter.version>=13?'Под прицелом: 3 урона после твоего хода. Уведи цель, перекрой линию или сорви прицел ударом на 3+ либо вплотную.':'Под прицелом: выстрел после твоего хода. Уведи цель, перекрой линию или рани охотника.';b.title=(b.title?b.title+' · ':'')+hint;b.setAttribute('aria-label',b.getAttribute('aria-label')+', '+hint);}
  if(hunter?.intel?.source===s){b.title=(b.title?b.title+' · ':'')+'Стреляли отсюда. Это источник прошлого выстрела, не текущее положение охотника.';}
  if((hunter?.phase==='window'?hunter.escapeCandidates:hunter?.intel?.candidates)?.includes(s)){b.classList.add('hunter-candidate');const mark=document.createElement('span');mark.className='hunter-candidate-mark';mark.textContent='?';b.append(mark);const hint=hunter?.phase==='window'?'Охотник сможет уйти сюда после твоего хода. Перекрой лёжку или клетку рядом.':'Возможная лёжка после выстрела. Метка не подтверждает его присутствие.';b.title=(b.title?b.title+' · ':'')+hint;b.setAttribute('aria-label',b.getAttribute('aria-label')+', возможное укрытие охотника');}
  if(!game.isOver()&&giant?.plan?.area.includes(s)){const damage=giantDamage(giant,giant.plan.kind);b.classList.add('giant-danger');b.title=(b.title?b.title+' · ':'')+(giantPattern(giant.plan.kind))+': '+damage+' урона, '+(giant.phase==='windup'?'через два твоих хода.':'после этого твоего хода.');const mark=document.createElement('span');mark.className='boss-zone-mark giant-zone-mark';mark.textContent='↓'+damage;b.append(mark);b.setAttribute('aria-label',b.getAttribute('aria-label')+', зона удара великана, '+damage+' урона');}
  if(!game.isOver()&&giant?.plan?.secondary?.includes(s)){b.classList.add('giant-counter');const hint='Ответный Бросок: 3 урона первой фигуре на фиолетовой линии после твоего хода.';b.title=(b.title?b.title+' · ':'')+hint;b.setAttribute('aria-label',b.getAttribute('aria-label')+', '+hint);if(!giant.plan.area.includes(s)){const mark=document.createElement('span');mark.className='boss-zone-mark counter-zone-mark';mark.textContent='↗3';b.append(mark);}}
  if(plan?.target===s){b.classList.add('hunter-target');b.title='Засада: охотник ударит сюда на следующем ходу. Уведи фигуру.';const mark=document.createElement('span');mark.className='hunter-mark';mark.textContent='⌖';b.append(mark);}
  if(plan?.retreat===s){b.classList.add('hunter-retreat');b.title='Отход охотника: займи клетку, чтобы он не смог вернуться в туман.';const mark=document.createElement('span');mark.className='hunter-mark retreat';mark.textContent='↶';b.append(mark);}
  if(trace?.square===s){b.classList.add('hunter-trace');const warning='След охотника · здесь он напал и ушёл. След сохраняется на один твой ход; это не его текущее положение.';b.title=(b.title?b.title+' · ':'')+warning;b.setAttribute('aria-label',b.getAttribute('aria-label')+', '+warning);const mark=document.createElement('span');mark.className='hunter-trace-mark';mark.setAttribute('aria-hidden','true');mark.innerHTML='<svg viewBox="0 0 64 64" fill="none"><path d="M21 43c-4-4-2-10 2-12 4 1 5 4 3 8l-2 5zm-2 4 4 1-1 5-5-1zm22-19c4-4 2-10-2-12-4 1-5 4-3 8l2 5zm2 4-4 1 1 5 5-1z"/><path d="M12 57h40" stroke-dasharray="2 5"/></svg><small>СЛЕД</small>';b.append(mark);}
  if(!game.isOver()&&bossPlan?.area.includes(s)){const iron=bossPlan.kind==='iron',castDamage=bossPlan.damage??(iron?2:3);b.classList.add('boss-zone',iron?'slam-zone':'ritual-zone');const warning=iron?'Обвал: '+castDamage+' урона на следующем ходу босса. Уведи фигуру.':'Ритуал: 3 урона на следующем ходу босса. Уведи фигуру или нанеси урон Колдуну.';b.title=warning;b.setAttribute('aria-label',b.getAttribute('aria-label')+', '+warning);const mark=document.createElement('span');mark.className='boss-zone-mark';mark.textContent=(iron?'↓':'◇')+castDamage;b.append(mark);}
  if(support?.squares.includes(s)){const linked=support.linked.includes(s);b.classList.add(support.kind==='warlock'?'seal-square':linked?'formation-square':'escort-square');const hint=support.kind==='warlock'?'Слон-печать: его потеря сужает следующие ритуалы.':linked?'Ладья в строю: две соседние ладьи усиливают следующий Обвал.':'Ладья вне строя: подойдя к королю, может усилить следующий Обвал.';b.title=(b.title?b.title+' · ':'')+hint;b.setAttribute('aria-label',b.getAttribute('aria-label')+', '+hint);}
  if(!game.isOver()&&bossPlan?.kind==='warlock'&&bossPlan.from===s){b.classList.add('ritual-caster');b.title='Колдун поддерживает ритуал. Урон от фигуры сорвёт заклинание; огонь арены — нет.';}
  if(game.burning(s)){b.classList.add('burning');const warning='Горящая клетка: −1 HP фигуре в начале её хода. Урон обеим сторонам.';b.title=(b.title?b.title+' · ':'')+warning;b.setAttribute('aria-label',b.getAttribute('aria-label')+', '+warning);const mark=document.createElement('span');mark.className='burn-mark';mark.textContent='−1';mark.setAttribute('aria-hidden','true');b.append(mark);}
  else if(burnSoon&&game.burning(s,game.ply+4)){b.classList.add('burn-next');const warning='Скоро загорится: −1 HP в начале хода фигуры, для обеих сторон.';b.title=(b.title?b.title+' · ':'')+warning;b.setAttribute('aria-label',b.getAttribute('aria-label')+', '+warning);}
  if(s===selected)b.classList.add('selected');
  if(last&&(s===last.from||s===last.to))b.classList.add('last');
  if(sources.has(s))b.classList.add('source');
  if(target.has(s))b.classList.add(mode?'target':s===selected?'stay-target':hits.has(s)?'attack-target':'normal-target');
  if(p){
   b.classList.add('occupied',p.color===playerColor?'own':'foe');if(p.giant){b.classList.add('giant-cell');b.setAttribute('aria-label',s+', часть великана, общие '+p.hp+' HP');b.title=(b.title?b.title+' · ':'')+'Часть тела великана. У всех четырёх клеток одно здоровье.';}else b.append(token(p));
   if(p.variant==='wolf')b.title=(b.title?b.title+' · ':'')+'Волк охотника: ходит как конь, 2 атаки, 3 максимальных HP.';
   b.setAttribute('aria-label',b.getAttribute('aria-label')+', '+(p.hp??maxOf(p))+' HP, атака '+attackOf(p));
   const tags=[];if(p.type==='k'&&p.color==='b'&&hunter?.cover)tags.push(['cover','⛨','Укрытие: урон с расстояния 3+ клетки вдвое меньше, округление вверх. Вблизи полный.']);
   if(p.furyMarked){const mark=document.createElement('span');mark.className='fury-mark';mark.textContent='⌖';mark.title='Ярость: босс может выбрать эту фигуру для дальнего прицела или Броска. Метка сохраняется, пока босс не объявит атаку на эту фигуру.';b.append(mark);}
   if(p.invisibleUntil>game.ply){const left=Math.ceil((p.invisibleUntil-game.ply)/2);b.classList.add('invisible-own');tags.push(['stealth','◌'+left,'Невидим ещё ответов соперника: '+left]);}
   if(p.mirrorUntil>game.ply)tags.push(['mirror','◇','Зеркало: первый удар по ферзю отразится в атакующего']);
   if(p.trenchUntil>game.ply)tags.push(['trench','⛨','Окоп: каждый удар слабее на 1']);
   for(const [cls,text,title] of tags.slice(0,1)){const tag=document.createElement('span');tag.className='status-tag '+cls;tag.title=title;tag.textContent=text;b.append(tag);}
  }
  const hit=hits.get(s);
  if(hit){
   const label=document.createElement('span');label.className='damage-preview'+(hit.lethal?' lethal':hit.mirror?' mirror':'');label.textContent=hit.mirror?'◇':hit.lethal?'☠':'−'+hit.amount;b.append(label);if(hit.reasons?.length){const reason=document.createElement('span');reason.className='damage-reason';reason.textContent=hit.reasons.join(' · ');b.append(reason);b.title=(b.title?b.title+' · ':'')+hit.reasons.join(' · ');}
   if(hit.back){const back=document.createElement('span');back.className='counter-preview'+(hit.backLethal?' lethal':'');back.title=hit.mirror?'Зеркало вернёт удар':'Ответный удар по твоей фигуре';back.textContent='↩'+(hit.backLethal?'☠':hit.back);b.append(back);}
  }
  const bottom=playerColor==='w'?'1':'8',left=playerColor==='w'?'a':'h';
  if(s[1]===bottom){const c=document.createElement('span');c.className='coord file';c.textContent=s[0];b.append(c);}
  if(s[0]===left){const c=document.createElement('span');c.className='coord rank';c.textContent=s[1];b.append(c);}
  b.addEventListener('click',()=>click(s));
  b.addEventListener('pointerenter',()=>preview(s));
  b.addEventListener('focus',()=>preview(s));
  board.append(b);
 }
 renderHunterIntel(hunter);
 renderGiant(giant);renderSupport(support);
 const energy=game.energy[playerColor];
 $('energyValue').textContent=energy;$('botEnergy').textContent=game.energy[opponentColor];
 $('energyBar').setAttribute('aria-valuenow',String(energy));$('energyBar').firstElementChild.style.width=(100*energy/MAX_ENERGY)+'%';
 $('energyBar').classList.toggle('full',energy>=MAX_ENERGY);
 const income=8+Math.min(4,center.filter(s=>game.get(s)?.color===playerColor).length*2);$('energyIncome').textContent='+'+income+' за ход';
 for(const [id,color] of [['humanLife',playerColor],['botLife',opponentColor]]){const square=allSquares.find(s=>game.get(s)?.color===color&&game.get(s)?.type==='k'),king=square&&game.visible(square,playerColor),known=Boolean(king)||game.isOver(),hp=kingHp(color);$(id).textContent=known?hp:'?';$(id).title=known?'Здоровье короля':'Король скрыт туманом';$(id).classList.toggle('wounded',known&&hp<maxOf(king||{type:'k'}));}
 const move=Math.floor(game.ply/2)+1,burnIn=Math.ceil((BURN_START-game.ply)/2);
 $('turnCount').textContent=giant?'Ход '+move+' · огонь отключён':burnLevel(game.ply)?'Арена горит':burnIn<=6?'Ход '+move+' · огонь через '+burnIn:'Ход '+move;
 const fireLevel=burnLevel(game.ply),fireNext=fireLevel<3?Math.ceil(((fireLevel?BURN_START+fireLevel*BURN_STEP:BURN_START)-game.ply)/2):null;
 const rounds=n=>n===1?'1 ход':n>=2&&n<=4?n+' хода':n+' ходов';
 $('burnNotice').hidden=Boolean(giant)||(!fireLevel&&burnIn>2);$('burnNotice').classList.toggle('soon',!fireLevel);
 $('burnHeadline').textContent=fireLevel?'Арена горит · −1 HP в начале своего хода':'Край арены загорится через '+rounds(burnIn);
 $('burnDetails').textContent=fireLevel?'Урон обеим сторонам · '+(fireNext?'до следующего кольца: '+rounds(fireNext)+'.':'последнее кольцо.'):'Уведи фигуры с края · −1 HP в начале своего хода у обеих сторон.';
 const mine=myTurn();
 const visibleThreat=!game.isOver()&&game.view(playerColor).threatened(playerColor);
 $('turn').className='turn '+(game.isOver()?'over':mine?(visibleThreat?'mine danger':'mine'):'theirs');
 $('status').textContent=game.winner?(game.winner===playerColor?'Победа':'Поражение'):game.draw?'Ничья':room&&!room.ready?'Партия на паузе':room?.awaiting?'Отправляем ход…':busy&&!room&&game.side==='b'?'Соперник думает':busy?'Удар…':game.side!==playerColor?'Ход соперника':game.pending?.kind==='stealth'?'Слон невидим - ходи им':game.pending?.kind==='order'?'Приказ: лишний ход':visibleThreat?'Король под ударом':'Твой ход';
 $('bossInfo').hidden=Boolean(support)||Boolean(hunter)||game.isOver()||(!fog&&!['iron','warlock'].includes(game.boss));$('bossInfo').classList.toggle('warning',Boolean(plan||bossPlan));
 $('bossInfo').textContent=fog?(plan?'Засада на '+plan.target+' · отход '+plan.retreat+'. Уведи цель или перекрой отход.':'Туман скрывает поле только от тебя: видишь клетки в двух шагах от своих фигур. Охотник видит всё поле и предупреждает о выпаде за ход. Инвиз скрывает слона и от него.'):bossPlan?.kind==='iron'?'Обвал вокруг '+bossPlan.target+': 2 урона по отмеченным клеткам. Удар по королю обвал не остановит. Уведи фигуры из зоны.':bossPlan?.kind==='warlock'?'Ритуал на '+bossPlan.target+': 3 урона по отмеченному диагональному кресту. Нанеси любой урон Колдуну, чтобы сорвать ритуал, или уйди из зоны.':game.boss==='iron'?'Обвал бьёт по области 3×3 рядом с королём. Есть один ход на отход или защиту. Соседние союзники поглощают до 3 урона по королю.':'Колдун готовит ритуал по пяти клеткам: центр и четыре соседние диагонали. Урон Колдуну во время подготовки отменяет ритуал.';
 if(fog&&!plan&&trace)$('bossInfo').textContent='След на '+trace.square+': здесь охотник напал и ушёл. След останется на один твой ход и не показывает его нынешнюю позицию. Огонь виден сквозь туман, фигуры он не раскрывает.';
 $('opponentPanel').classList.toggle('active',game.side===opponentColor&&!game.isOver());
 $('newGame').disabled=busy||Boolean(room);
 $('undo').disabled=busy||Boolean(room)||!game.actions.length;
 $('retry').hidden=Boolean(room)||busy||game.side!=='b'||game.isOver()||botRetryBlocked;
 renderResult();
 $('cancel').hidden=!mode;
 for(const [type,btn] of Object.entries(cardButtons)){
  const def=game.abilityOf(type,playerColor),enough=energy>=def.cost,has=allSquares.some(s=>game.get(s)?.type===type&&game.get(s)?.color===playerColor),cd=game.cooldown(type,playerColor);
  const count=game.side===playerColor?game.legalSpecials().filter(m=>m.power===type).length:0;
  btn.classList.toggle('active',mode===type);btn.classList.toggle('locked',!enough||!has||Boolean(cd)||Boolean(game.pending));
  btn.classList.toggle('ready',Boolean(count)&&!busy&&!game.isOver());btn.classList.toggle('cooling',Boolean(cd));
  btn.querySelector('.cd').textContent=cd||'';
  if(def.id==='revive')btn.querySelector('.cost').textContent=game.cost({power:'k',revive:'p'},playerColor)+'+';
  btn.setAttribute('aria-pressed',String(mode===type));btn.disabled=!mine;
  btn.querySelector('.availability').textContent=!has?'Фигура потеряна':cd?'Перезарядка':game.pending?'После хода':!enough?'Ещё '+(def.cost-energy):count?'Готово':'Нет цели';
 }
 const help=game.side===playerColor&&game.pending?.kind==='stealth'?'Слон невидим. Сходи им - соперник не увидит куда - или нажми на него, чтобы остаться на месте.':game.side===playerColor&&game.pending?.kind==='order'?'Приказ: сделай лишний ход любой фигурой, кроме ферзя. Потом будет обычный ход.':mode?(game.abilityOf(mode,playerColor).text+' '+(!selected?'Выбери фигуру на поле.':idOf(mode)==='revive'?'Выбери клетку для возвращения.':idOf(mode)==='gallop'?'Выбери первого врага - дальше конь поскачет сам.':idOf(mode)==='swap'?'Выбери свою фигуру для обмена.':'Выбери подсвеченную цель.')):'';
 $('aimHelp').textContent=help;$('aimHelp').hidden=!help;
 $('history').replaceChildren();
 if(!events.length){const li=document.createElement('li');li.textContent='Ходов пока нет.';$('history').append(li);}
 for(const event of events.slice(-12).reverse()){const li=document.createElement('li'),a=document.createElement('span'),b=document.createElement('b');a.textContent=event.color===playerColor?'Ты':'Соперник';b.textContent=event.label;li.append(a,b);$('history').append(li);}
 renderRoom();
 syncBoardNotices();
 preview();
}
function lines(points,preview=false){
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 8 8');
 const path=document.createElementNS(ns,'polyline');path.setAttribute('points',points.filter(Boolean).map(s=>{const [x,y]=boardPoint(s);return (x+.5)+','+(y+.5);}).join(' '));svg.append(path);effects.append(svg);effects.classList.toggle('preview',preview);return svg;
}
function preview(s){
 if(busy)return;
 effects.replaceChildren();board.querySelectorAll('.zone,.friendly-risk,.threat').forEach(b=>b.classList.remove('zone','friendly-risk','threat'));board.querySelectorAll('.damage-preview.ability,.damage-reason.ability,.heal-preview').forEach(e=>e.remove());
 if(!mode){
  // Hovering an enemy shows every square it currently hits.
  const view=game.view(playerColor),p=s&&view.get(s);
  if(p&&p.color!==playerColor)for(const t of allSquares)if(view.attacks(s,t))board.querySelector('[data-square="'+t+'"]')?.classList.add('threat');
  return;
 }
 if(!selected)return;
 const list=targets();
 aim=list.find(m=>m.to===s)||(aim&&list.find(m=>m.to===aim.to))||list[0];
 if(!aim)return;
 const impact=game.view(playerColor).impact(aim),id=idOf(mode);
 for(const cell of impact.area){const b=board.querySelector('[data-square="'+cell+'"]');b?.classList.add('zone');if(game.visible(cell,playerColor)?.color===playerColor&&impact.damage.some(d=>d.square===cell))b?.classList.add('friendly-risk');}
 const combinedDamage=new Map();for(const hit of impact.damage)combinedDamage.set(hit.square,(combinedDamage.get(hit.square)||0)+hit.amount);
 for(const [square,amount] of combinedDamage){const b=board.querySelector('[data-square="'+square+'"]'),victim=game.visible(square,playerColor),label=document.createElement('span');const lethal=victim&&(victim.hp??maxOf(victim))<=amount;label.className='damage-preview ability'+(lethal?' lethal':'');label.textContent=(lethal?'☠ ':'')+'−'+amount;b?.append(label);const reasons=impact.damage.find(d=>d.square===square)?.reasons;if(reasons?.length){const note=document.createElement('span');note.className='damage-reason ability';note.textContent=reasons.join(' · ');b?.append(note);}}
 for(const heal of impact.heals){const b=board.querySelector('[data-square="'+heal.square+'"]'),label=document.createElement('span');label.className='heal-preview';label.textContent='+'+heal.amount;b?.append(label);}
 const points=id==='svarog'?[aim.from,...aim.area,aim.from]:id==='gallop'?[aim.from,...impact.area]:id==='quiet'&&aim.mode==='snipe'?[aim.from,...aim.area]:id==='train'?[aim.from,...impact.area]:id==='swap'?[aim.from,aim.to]:null;
 if(points)lines(points,true);
}
function openChoice(){
 if(idOf(mode)==='revive'){
  $('resurrection').querySelector('.eyebrow').textContent='Воскрешение';
  $('resurrection').querySelector('h2').textContent='Кого возвращаем?';
  const options=[...new Set(game.legalSpecials(selected).map(m=>m.revive))];
  if(!options.length)return;
  $('reviveChoices').replaceChildren();
  for(const type of options){const b=document.createElement('button');b.textContent=names[type]+' · '+game.cost({power:'k',revive:type},playerColor);b.addEventListener('click',()=>{revive=type;$('resurrection').close();render();});$('reviveChoices').append(b);}
  $('resurrection').showModal();
 }
}
function chooseCard(type){
 if(!myTurn()||game.pending)return;
 if(mode===type){clear();render();return;}
 clear();mode=type;const sources=[...new Set(game.legalSpecials().filter(m=>m.power===type).map(m=>m.from))];
 if(sources.length===1)selected=sources[0];
 render();if(selected&&needsChoice(mode))openChoice();
}
function click(s){
 if(!myTurn())return;
 error();
 if(game.pending?.kind==='stealth')selected=game.pending.square;
 if(mode){
  const moves=targets();
  const action=moves.find(m=>m.to===s&&(!needsChoice(mode)||revive));
  if(action){void play(action,true);return;}
  if(game.legalSpecials(s).some(m=>m.power===mode)){selected=s;revive=null;aim=null;render();if(needsChoice(mode))openChoice();}
  return;
 }
 const options=selected?game.legal(selected).filter(m=>m.to===s):[];
 if(options.length){if(options[0].promotion){pending=options;$('promotion').showModal();}else void play(options[0],true);return;}
 if(game.pending?.kind==='stealth')return;
 selected=game.get(s)?.color===playerColor&&s!==selected?s:null;render();board.querySelector('[data-square="'+s+'"]')?.focus({preventScroll:true});
}
function boardPoint(square){
 const x=files.indexOf(square[0]),y=8-Number(square[1]);
 return playerColor==='w'?[x,y]:[7-x,7-y];
}
function coord(s){const [x,y]=boardPoint(s);return {x:x*effects.clientWidth/8,y:y*effects.clientHeight/8};}
function ghost(s,p){
 const size=effects.clientWidth/8,c=coord(s),el=document.createElement('div');el.className='ghost-wrap';Object.assign(el.style,{left:c.x+'px',top:c.y+'px',width:size+'px',height:size+'px'});el.append(token(p));effects.append(el);return el;
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
// A hidden or minimised window pauses animations; the timer keeps the turn going anyway.
async function animate(el,frames,options){try{const a=el.animate(frames,{fill:'forwards',...options});await Promise.race([a.finished,wait((options.duration||0)+200)]);}catch{}}
function ring(s,color){
 const pos=coord(s),size=effects.clientWidth/8,el=document.createElement('div');el.className='blast';Object.assign(el.style,{left:pos.x+'px',top:pos.y+'px',width:size+'px',height:size+'px',...(color?{borderColor:color}:{})});effects.append(el);
 return animate(el,[{opacity:1,transform:'scale(.2) rotate(0deg)'},{opacity:0,transform:'scale(1.9) rotate(45deg)'}],{duration:420}).then(()=>el.remove());
}
function floatText(s,text,cls){
 const pos=coord(s),size=effects.clientWidth/8,el=document.createElement('div');el.className='dmg-float '+cls;el.textContent=text;
 Object.assign(el.style,{left:pos.x+'px',top:pos.y+'px',width:size+'px',height:size+'px'});floats.append(el);
 animate(el,[{opacity:0,transform:'translateY(10%) scale(.6)'},{opacity:1,transform:'translateY(-15%) scale(1.15)',offset:.2},{opacity:1,transform:'translateY(-40%) scale(1)',offset:.7},{opacity:0,transform:'translateY(-70%) scale(.95)'}],{duration:950,easing:'ease-out'}).then(()=>el.remove());
}
// Floating number over a struck piece; the piece shakes, and fades if the blow is lethal.
function strike(s,amount,force=false,cls=''){
 const victim=game.get(s);if(!victim||(!force&&!game.visible(s,playerColor)))return;
 const lethal=(victim.hp??maxOf(victim))<=amount;floatText(s,'−'+amount,(lethal?'lethal ':'')+cls);
 const piece=victim.giant?$('giantBody'):board.querySelector('[data-square="'+s+'"] .piece');
 if(piece)void animate(piece,lethal?[{opacity:1,transform:'scale(1)'},{opacity:1,transform:'scale(1.12) rotate(-6deg)',offset:.3},{opacity:0,transform:'scale(.5) rotate(12deg)'}]:[{transform:'translateX(0)'},{transform:'translateX(-7%)'},{transform:'translateX(6%)'},{transform:'translateX(-4%)'},{transform:'translateX(0)'}],{duration:lethal?420:300});
}
function showBurn(list){const lit=game.litSquares(playerColor);for(const {square,amount} of list||[])if(lit.has(square)){floatText(square,'−'+amount,'burn');void ring(square,'#ff7a1a');}}
function showAftermath(result){
 showBurn(result.burn);
 if(result.hunterShot){
  const shot=result.hunterShot;
  for(const hit of shot.damage||[])if(game.visible(hit.square,playerColor)||hit.square===shot.from||(shot.arrows||[{path:shot.path}]).some(a=>a.path.includes(hit.square)))floatText(hit.square,'−'+hit.amount,'hunter-shot-damage');
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
   const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 800 800');svg.classList.add('hunter-shot-flash');
   const point=s=>[(files.indexOf(s[0])+.5)*100,(8-Number(s[1])+.5)*100],source=point(shot.from);
   svg.innerHTML=(shot.arrows||[{path:shot.path}]).map((a,i)=>'<polyline fill="none" stroke="'+(i?'#d6b4ff':'#ffe6b4')+'" stroke-width="7" points="'+[shot.from,...a.path].map(s=>point(s).join(',')).join(' ')+'"/>').join('')+'<circle cx="'+source[0]+'" cy="'+source[1]+'" r="22" fill="#ffe6b4"/>';
   $('hunterShotFx').append(svg);void animate(svg,[{opacity:0},{opacity:1,offset:.15},{opacity:0}],{duration:250}).then(()=>svg.remove());
  }
 }
 if(result.hunterAmbush)floatText(result.hunterAmbush.square,'Засада!','ritual-broken');
 if(result.bossInterrupted){const square=allSquares.find(s=>game.get(s)?.type==='k'&&game.get(s)?.color==='b')||result.to;floatText(square,'Ритуал сорван','ritual-broken');if(!matchMedia('(prefers-reduced-motion: reduce)').matches)void ring(square,'#b8e7d3');}
}
function concealedMove(move){return !move.hunter&&!move.bossAction&&(!game.visible(move.from,playerColor)||(game.fogEnabled()&&!game.litSquares(playerColor).has(move.to)));}
async function giantEffect(move,impact){
 const body=$('giantBody'),title=$('announcement');title.textContent=move.bossAction==='giantChargePrepare'?'Готовит рывок':move.bossAction==='giantStep'?'Шаг великана':move.bossAction==='giantWindup'?'Замах':giantPattern(move.pattern);title.classList.add('show');
 try{
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  if(move.bossAction==='giantStep'&&body){const from=coord(move.from),to=coord(impact.landing||move.to);await animate(body,[{transform:'translate(0,0)'},{transform:'translate('+(to.x-from.x)+'px,'+(to.y-from.y)+'px)'}],{duration:430,easing:'ease-in-out'});}
  else if(move.bossAction==='giantWindup'&&body)await animate(body,[{transform:'translateY(0)'},{transform:'translateY(-5%) scale(1.025)',offset:.65},{transform:'translateY(0)'}],{duration:420});
  else if(['giantStrike','giantCharge'].includes(move.bossAction)){
   if(move.bossAction==='giantCharge'&&body){const from=coord(move.from),to=coord(impact.landing);await animate(body,[{transform:'translate(0,0)'},{transform:'translate('+(to.x-from.x)+'px,'+(to.y-from.y)+'px)'}],{duration:400,easing:'ease-in'});}
   else if(move.pattern==='throw'){const end=impact.damage.find(d=>!d.reflected)?.square||move.area.at(-1),start=move.from;if(end){const from=coord(start),to=coord(end),stone=document.createElement('i');stone.className='giant-stone';stone.style.left=(from.x+effects.clientWidth/16)+'px';stone.style.top=(from.y+effects.clientHeight/16)+'px';effects.append(stone);await animate(stone,[{transform:'translate(-50%,-50%) rotate(0deg)'},{transform:'translate('+(to.x-from.x)+'px,'+(to.y-from.y)+'px) rotate(360deg)'}],{duration:360,easing:'ease-in'});stone.remove();}}
   else if(body)await animate(body,[{transform:'translateY(0)'},{transform:'translateY(-8%)',offset:.4},{transform:'translateY(4%)',offset:.72},{transform:'translateY(0)'}],{duration:330});
   for(const hit of impact.damage)strike(hit.square,hit.amount);
  }
  await Promise.all((move.area||[]).map(s=>ring(s,'#f3c98a')));
 }finally{title.classList.remove('show');effects.replaceChildren();}
}
async function bossEffect(move,impact){
 const iron=move.bossKind==='iron',preparing=move.bossAction==='prepare',color=iron?'#ffc58c':'#d2a2ff',title=$('announcement');
 title.textContent=iron?(preparing?'Обвал: подготовка':'Обвал'):(preparing?'Ритуал: подготовка':'Ритуал');title.classList.add('show');
 const source=board.querySelector('[data-square="'+move.from+'"] .piece'),area=move.area||impact.area||[];
 try{
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  if(preparing){
   await ring(move.from,color);
   await Promise.all(area.map(s=>ring(s,color)));
  }else{
   if(source)await animate(source,iron?[{transform:'translateY(0)'},{transform:'translateY(-15%)',offset:.45},{transform:'translateY(5%)',offset:.8},{transform:'translateY(0)'}]:[{filter:'brightness(1)'},{filter:'brightness(2)'},{filter:'brightness(1)'}],{duration:360});
   for(const d of impact.damage)strike(d.square,d.amount);
   await Promise.all(area.map(s=>ring(s,color)));
  }
 }finally{title.classList.remove('show');effects.replaceChildren();}
}
async function hunterEffect(move,p,impact){
 if(!p)return;
 const startSquare=move.hunter==='mark'?impact.landing:move.from;
 const actor=ghost(startSquare,p),start=coord(startSquare),original=board.querySelector('[data-square="'+move.from+'"] .piece');
 if(original)original.style.visibility='hidden';
 const go=async(to,duration)=>{const end=coord(to),prev=actor.style.transform||'translate(0px,0px)',next='translate('+(end.x-start.x)+'px,'+(end.y-start.y)+'px)';await animate(actor,[{transform:prev},{transform:next}],{duration,easing:'ease-out'});actor.getAnimations().forEach(a=>a.cancel());actor.style.transform=next;};
 try{
  if(move.hunter==='mark'){
   await animate(actor,[{opacity:0,filter:'blur(12px)',transform:'scale(.7)'},{opacity:1,filter:'blur(0px)',transform:'scale(1)'}],{duration:420});
   if(impact.blocked)await ring(move.via,'#90bfc4');
   else await Promise.all([ring(move.to,'#ef795f'),ring(move.retreat,'#90bfc4')]);
  }else{
   await go(move.to,180);
   for(const d of impact.damage)strike(d.square,d.amount);
   await ring(move.to,'#ef795f');
   await go(impact.landing,260);
   if(impact.landing===move.retreat)await animate(actor,[{opacity:1},{opacity:.3,filter:'blur(5px)'}],{duration:220});
  }
 }finally{actor.remove();effects.replaceChildren();if(original)original.style.visibility='';}
}
async function effect(move){
 effects.replaceChildren();effects.classList.remove('preview');
 const p=game.get(move.from),visible=game.visible(move.from,playerColor),impact=game.impact(move),id=move.power?game.idOf(move):null;
 if(move.bossAction){if(move.bossKind==='giant')await giantEffect(move,impact);else await bossEffect(move,impact);return;}
 if(move.bow&&visible){if(!matchMedia('(prefers-reduced-motion: reduce)').matches){const ray=lines([move.from,move.to]);await animate(ray,[{opacity:0},{opacity:1,offset:.3},{opacity:0}],{duration:360});}for(const d of impact.damage)strike(d.square,d.amount);effects.replaceChildren();return;}
 if(move.hunter){
  if(hunterV8()){if(move.hunter==='aim'&&!matchMedia('(prefers-reduced-motion: reduce)').matches)await ring(move.to,'#ffb99c');return;}
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)await hunterEffect(move,p,impact);return;
 }
 // Hidden enemy actions may show consequences on visible pieces, never their source/path.
 if(p?.color===opponentColor&&concealedMove(move)){
  for(const d of impact.damage)if(game.visible(d.square,playerColor)){strike(d.square,d.amount);void ring(d.square);}
  for(const h of impact.heals)if(game.visible(h.square,playerColor))floatText(h.square,'+'+h.amount,'heal');
  if(visible){const el=board.querySelector('[data-square="'+move.from+'"] .piece');if(el)await animate(el,[{opacity:1},{opacity:0}],{duration:180});}
  return;
 }
 const backs=impact.damage.filter(d=>d.counter||d.reflected||d.self||d.recoil),back=backs.length?{amount:backs.reduce((sum,d)=>sum+d.amount,0)}:null;
 const dmg=new Map(impact.damage.filter(d=>!d.counter&&!d.reflected&&!d.self&&!d.recoil).map(d=>[d.square,d.amount]));
 const animatedHits=new Set();
 const hit=(s,color)=>{if(!game.visible(s,playerColor))return Promise.resolve();const damageSquare=game.get(s)?.giant?game.get(s).giantAnchor:s;if(dmg.has(damageSquare)&&!animatedHits.has(damageSquare)){strike(damageSquare,dmg.get(damageSquare));animatedHits.add(damageSquare);}return ring(s,color);};
 const healAll=()=>Promise.all(impact.heals.map(h=>{floatText(h.square,'+'+h.amount,'heal');return ring(h.square,'#7fe08a');}));
 const recoil=async()=>{
  if(!back)return;
  if(impact.mirrored.length)void ring(impact.mirrored[0],'#e467ff');
  const square=id==='train'?impact.landing:move.from;void ring(square,'#ff6a3c');
  if(id==='train'){
   const hp=Math.max(0,(p.hp??maxOf(p))-back.amount),piece=actor.querySelector('.piece');
   floatText(square,'−'+back.amount,hp===0?'lethal':'');
   const badge=actor.querySelector('.hpv');if(badge)badge.textContent=hp;
   if(piece)await animate(piece,hp===0?[{opacity:1},{opacity:0,transform:'scale(.4) rotate(12deg)'}]:[{transform:'translateX(0)'},{transform:'translateX(-8%)'},{transform:'translateX(6%)'},{transform:'translateX(0)'}],{duration:300});
  }else strike(move.from,back.amount);
  await wait(150);
 };
 if(matchMedia('(prefers-reduced-motion: reduce)').matches||!p||(!visible&&!move.power))return;
 const original=board.querySelector('[data-square="'+move.from+'"] .piece'),actor=ghost(move.from,p),start=coord(move.from);
 if(original)original.style.visibility='hidden';
 const title=$('announcement');title.textContent=move.mode==='stealth'?'Инвиз':move.mode==='snipe'?'Снайперка':move.power?ability(move.power,move.alt).name:'';
 if(move.power)title.classList.add('show');
 const go=async(to,duration=240,el=actor,from=start)=>{const c=coord(to);const previous=el.style.transform||'translate(0px,0px)';const next='translate('+(c.x-from.x)+'px,'+(c.y-from.y)+'px)';await animate(el,[{transform:previous},{transform:next}],{duration,easing:'cubic-bezier(.3,.1,.2,1)'});el.getAnimations().forEach(a=>a.cancel());el.style.transform=next;};
 try{
  if(!move.power){
   if(impact.struck){
    // Lunge at the target (a hidden one is revealed by the hit), then fall back if it survived.
    await go(impact.struck,170);const damageSquare=game.get(impact.struck)?.giant?game.get(impact.struck).giantAnchor:impact.struck;if(dmg.has(damageSquare))strike(damageSquare,dmg.get(damageSquare),true);void ring(impact.struck);await wait(130);
    if(impact.landing!==impact.struck)await go(impact.landing,140);
    if(back){const g=actor.querySelector('.piece');if(g)void animate(g,[{transform:'translateX(0)'},{transform:'translateX(-8%)'},{transform:'translateX(6%)'},{transform:'translateX(0)'}],{duration:280});await recoil();}
   }else{
    if(impact.reveal)void ring(impact.reveal,'#b9a6ff');
    await go(impact.landing,150);
   }
  }
  else switch(id){
   case 'blast':await animate(actor,[{transform:'scale(1)',filter:'brightness(1)'},{transform:'scale(1.3)',filter:'brightness(2)'},{transform:'scale(0)',filter:'brightness(3)'}],{duration:280});await Promise.all([ring(move.from,'#ffd27a'),...move.area.map(s=>hit(s))]);await recoil();break;
   case 'trench':await ring(move.from,'#ffd27a');await animate(actor,[{transform:'translateY(0)'},{transform:'translateY(8%) scale(1.05)'},{transform:'translateY(0)'}],{duration:320});break;
   case 'svarog':{
    const eye=document.createElement('i');eye.className='eyes';actor.append(eye);
    lines([move.from,...move.area,move.from]);await wait(160);
    for(const s of move.area){await go(s,85);void hit(s,'#ff3535');}
    await go(move.from,130);await recoil();break;
   }
   case 'gallop':{
    const eye=document.createElement('i');eye.className='eyes';actor.append(eye);
    lines([move.from,...impact.area]);
    for(const s of impact.area){await go(s,150);void hit(s,'#ff3535');await wait(90);}
    await go(impact.landing,160);await recoil();break;
   }
   case 'stealth':await animate(actor,[{opacity:1,filter:'blur(0px)'},{opacity:.35,filter:'blur(5px)'}],{duration:420});break;
   case 'quiet':
    {const a=coord(move.from),b=coord(move.to);
    await sniperShot({actor,angle:Math.atan2(b.y-a.y,b.x-a.x),animate,wait,fire:async()=>{
     const beam=lines([move.from,...move.area]);
     await Promise.all([animate(beam,[{opacity:1},{opacity:.8,offset:.15},{opacity:0}],{duration:280}),...move.area.filter(s=>game.get(s)).map(s=>hit(s))]);await recoil();
    }});}
    break;
   case 'train':lines([move.from,...impact.area]);for(const s of impact.area){await go(s,65);if(game.get(s))void hit(s);}if(impact.landing!==impact.area.at(-1))await go(impact.landing,150);await recoil();await wait(150);break;
   case 'swap':{
    const mate=game.get(move.to),mateEl=board.querySelector('[data-square="'+move.to+'"] .piece');
    if(mateEl)mateEl.style.visibility='hidden';const other=mate&&ghost(move.to,mate);
    await Promise.all([go(move.to,320),other&&go(move.from,320,other,coord(move.to))]);await Promise.all([ring(move.to,'#e8c46a'),ring(move.from,'#e8c46a')]);
    if(mateEl)mateEl.style.visibility='';break;
   }
   case 'order':await ring(move.from,'#e8c46a');await animate(actor,[{transform:'scale(1)'},{transform:'scale(1.15)'},{transform:'scale(1)'}],{duration:320});break;
   case 'mirror':await Promise.all([ring(move.from,'#e467ff'),animate(actor,[{filter:'brightness(1)'},{filter:'brightness(1.8) hue-rotate(40deg)'},{filter:'brightness(1)'}],{duration:420})]);break;
   case 'revive':{await ring(move.to,'#ffe7a3');const reborn=ghost(move.to,{type:move.revive,color:p.color,hp:Math.ceil(maxOf({type:move.revive})/2)});await animate(reborn,[{opacity:0,transform:'translateY(25px) scale(.5)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:350});break;}
   default:await healAll();
  }
 }finally{title.classList.remove('show');effects.replaceChildren();if(original)original.style.visibility='';}
}
function log(result,concealed=false){
 const count=game.fogEnabled()?0:result.captured.length;
 const label=result.bossKind==='giant'?(result.bossAction==='giantChargePrepare'?'Великан готовит рывок':result.bossAction==='giantStep'?'Великан шагнул на '+result.to:result.bossAction==='giantWindup'?'Великан замахивается':giantPattern(result.pattern)):result.hunter==='aim'?'Прицел на '+result.to:result.hunter==='relocate'?'Охотник сменил лёжку':result.hunter==='wait'?'Охотник затаился':result.bossAction?(result.bossKind==='iron'?'Обвал':'Ритуал')+(result.bossAction==='prepare'?' готовится на ':' на ')+result.to:result.hunter==='mark'?(result.hunterBlocked?'Засада сорвана':'Засада на '+result.to+' · отход '+result.retreat):result.hunter==='strike'?'Выпад на '+result.to+(result.landing===result.retreat?' · отход':' · отход перекрыт'):concealed?'Скрытый манёвр':result.mode==='stealth'?'Слон ушёл в инвиз':result.mode==='snipe'?'Снайперка'+(count?' · ×'+count:''):result.stay?'Слон затаился':result.power?(ability(result.power,result.alt).name+(count?' · ×'+count:'')):result.from+' → '+result.to;
 const extra=[];
 if(result.bossInterrupted)extra.push('Ритуал сорван');if(result.hunterInterrupted)extra.push('Прицел сорван');
 if(result.secondary)extra.push('Стрела ярости / ответный Бросок: '+result.secondary);
 if(result.hunterShot)extra.push('Охотник: выстрел с '+result.hunterShot.from+(result.hunterShot.miss?' — промах':''));
 if(result.hunterAmbush)extra.push('Засада в лёжке '+result.hunterAmbush.square+' — охотник загнан');
 if(result.hunterFlushed)extra.push('Охотник выкурен из укрытий');else if(result.hunterCornered&&!result.hunterAmbush)extra.push('Охотник загнан');
 events.push({color:result.color,label:[label,...extra].join(' · ')});
 last=concealed||result.stay||result.bossAction||['aim','relocate','wait'].includes(result.hunter)?null:result;
}
async function play(action,human){
 if(busy||(human&&!myTurn()))return;
 const session=room;
 if(human&&session&&!session.host){
  session.awaiting=session.net.send({type:'move',index:game.actions.length,action});
  if(!session.awaiting)error('Не удалось отправить ход. Подключись снова.');
  render();
  return;
 }
 busy=true;
 $('retry').hidden=true;
 render();
 try{
  const concealed=Boolean(session)&&game.side!==playerColor&&concealedMove(action);
  await effect(action);
  const result=game.apply(action);
  if(session?.host)session.net.send({type:'commit',index:game.actions.length-1,action:game.actions.at(-1)});
  log(result,concealed);saved();clear();showAftermath(result);
 }catch(e){error(e.message);}
 finally{busy=false;render();}
 if(!session&&human&&game.side==='b'&&!game.isOver())void botTurn();
}

function myTurn(){
 return !busy&&!game.isOver()&&game.side===playerColor&&(!room||room.ready&&!room.awaiting);
}

function renderRoom(){
 $('roomCreate').disabled=busy||Boolean(room);
 $('roomPanel').hidden=!room;
 if(!room)return;
 $('roomStatus').textContent=room.text;
 $('roomInviteRow').hidden=!room.host||!room.published;
 $('roomRetry').hidden=room.host||room.status!=='lost';
 $('roomLeave').disabled=busy;
}

function roomStatus(session,status,text){
 if(room!==session||(session.status==='error'&&status==='lost'))return;
 session.status=status;
 session.text=text;
 session.ready=status==='ready';
 if(status==='waiting')session.published=true;
 if(!session.ready)session.awaiting=false;
 render();
}

function freshDuel(){
 const deck=defaultLoadout();
 return new Battle({w:deck,b:deck});
}

function legalRoomAction(action){
 if(!action||typeof action!=='object'||!allSquares.includes(action.from)||!allSquares.includes(action.to))return null;
 const options=action.power?game.legalSpecials(action.from):game.legal(action.from);
 return options.find(move=>move.to===action.to&&move.power===action.power
  &&(move.alt||0)===(action.alt||0)&&Boolean(move.stay)===Boolean(action.stay)
  &&move.promotion===action.promotion&&move.revive===action.revive&&move.mode===action.mode);
}

function sendRoomState(session){
 session.net.send({type:'state',actions:game.actions});
}

async function receiveRoomMessage(session,data){
 if(room!==session||!data||typeof data!=='object')return;
 if(session.host){
  if(data.type==='sync'){
   sendRoomState(session);
  }else if(data.type==='move'){
   const action=session.ready&&!busy&&game.side==='b'&&data.index===game.actions.length&&legalRoomAction(data.action);
   if(action)await play(action,false);
   else{
    session.net.send({type:'rejected'});
    sendRoomState(session);
   }
  }
  return;
 }
 if(data.type==='refused'){
  roomStatus(session,'error',data.reason==='Место уже занято.'?data.reason:'Обновите страницу игры.');
  return;
 }
 if(data.type==='rejected'){
  session.awaiting=false;
  error('Ход не принят. Проверяем состояние партии.');
  render();
  return;
 }
 if(data.type==='state'){
  if(!Array.isArray(data.actions)||data.actions.length>1600)throw new Error('История партии повреждена.');
  const next=freshDuel(),nextEvents=[];
  for(const action of data.actions){
   const concealed=next.side!==playerColor&&!next.visible(action.from,playerColor);
   const result=next.apply(action);
   nextEvents.push({result,concealed});
  }
  game=next;events=[];last=null;
  for(const {result,concealed} of nextEvents)log(result,concealed);
  session.awaiting=false;clear();error();
  roomStatus(session,'ready','Друг подключён. Ты играешь чёрными.');
  return;
 }
 if(data.type==='commit'){
  const action=data.index===game.actions.length&&legalRoomAction(data.action);
  if(!action){
   roomStatus(session,'connecting','Восстанавливаем позицию…');
   session.net.send({type:'sync'});
   return;
  }
  session.awaiting=false;
  await play(action,false);
 }
}

function guestRoomToken(id){
 const key='arena-room-guest-'+id;
 try{
  const token=sessionStorage.getItem(key)||crypto.randomUUID();
  sessionStorage.setItem(key,token);
  return token;
 }catch{return crypto.randomUUID();}
}

async function enterRoom(id,host){
 if(room||busy)return;
 const session={id,host,ready:false,awaiting:false,published:false,status:'connecting',text:'Подключаемся к сервису комнат…',inbox:Promise.resolve()};
 solo={game,rulesVersion,events,last,resultDismissed,botRetryBlocked};
 room=session;
 playerColor=host?'w':'b';opponentColor=host?'b':'w';
 game=freshDuel();rulesVersion=currentRules;events=[];last=null;resultDismissed=false;
 clear();error();buildCards();render();
 const link=new URL(location.href);
 link.hash=new URLSearchParams({room:id}).toString();
 $('roomInvite').value=link.href;
 $('roomCopy').textContent='Копировать';
 try{
  const net=await openRoom({
   id,host,token:host?null:guestRoomToken(id),version:currentRules,
   status:(state,text)=>roomStatus(session,state,text),
   joined:()=>{
    if(!host||room!==session)return;
    sendRoomState(session);
    roomStatus(session,'ready','Друг подключён. Ты играешь белыми.');
   },
   message:data=>{
    session.inbox=session.inbox.then(()=>receiveRoomMessage(session,data)).catch(()=>{
     roomStatus(session,'error','Не удалось синхронизировать партию. Открой комнату заново.');
    });
   },
  });
  if(room===session)session.net=net;
  else net.close();
 }catch{roomStatus(session,'error','Не удалось загрузить сетевую игру. Попробуй открыть комнату заново.');}
}

function leaveRoom(){
 if(!room||busy)return;
 const session=room;
 room=null;session.net?.close();
 if(roomFromHash(location.hash))history.replaceState(null,'',location.pathname+location.search);
 playerColor='w';opponentColor='b';
 ({game,rulesVersion,events,last,resultDismissed,botRetryBlocked}=solo);
 solo=null;clear();error();buildCards();render();
 if(game.side==='b'&&!game.isOver())void botTurn();
}

$('roomCreate').onclick=()=>void enterRoom('arena-'+crypto.randomUUID(),true);
$('roomLeave').onclick=leaveRoom;
$('roomRetry').onclick=()=>room?.net?.retry();
$('roomCopy').onclick=async()=>{
 const field=$('roomInvite');
 try{
  await navigator.clipboard.writeText(field.value);
  $('roomCopy').textContent='Скопировано';
 }catch{field.focus();field.select();}
};

let battleWorker;
function requestBotTurn(state) {
  return new Promise((resolve, reject) => {
    const worker = battleWorker ??= new Worker(new URL('./battle-worker.js', import.meta.url), { type: 'module' });

    function finish(error, reply, restart = false) {
      clearTimeout(timeout);
      worker.onmessage = worker.onerror = worker.onmessageerror = null;
      if (restart) {
        worker.terminate();
        battleWorker = undefined;
      }
      if (error) reject(error);
      else resolve(reply);
    }

    const timeout = setTimeout(() => finish(new Error('Соперник долго думает.'), null, true), 10000);
    worker.onmessage = ({ data }) => finish(
      data.error ? Object.assign(new Error(data.error), { code: data.code }) : null,
      data,
    );
    worker.onerror = worker.onmessageerror = () => finish(new Error('Не удалось запустить бота.'), null, true);
    try {
      worker.postMessage(state);
    } catch (error) {
      finish(error, null, true);
    }
  });
}

async function botTurn(){
 if(room||busy||game.side!=='b'||game.isOver())return;
 busy=true;botRetryBlocked=false;clear();error();render();let failed=false,applying=false;
 try{
  const data=await requestBotTurn({rulesVersion,actions:game.actions,loadout:game.loadout,boss:game.boss,difficulty});
  if(data.rulesVersion!==rulesVersion)throw Object.assign(new Error('Бот и вкладка используют разные правила. Обнови страницу перед новой партией.'),{code:'RULES_VERSION'});
  const action=data.action,concealed=concealedMove(action);
  applying=true;
  await wait(250);
  await effect(action);const result=game.apply(action);log(result,concealed);saved();showAftermath(result);
 }catch(e){failed=true;botRetryBlocked=['RULES_VERSION','HISTORY_MISMATCH'].includes(e.code)||applying;error(botRetryBlocked?(applying?'Ход соперника не подходит к этой партии. Обнови страницу; сохранение останется в браузере.':e.message):e.message+' Нажми «Повторить ход соперника».');}
 finally{busy=false;render();}
 // Free actions (stealth, order) leave the bot to finish its turn.
 if(!failed&&game.side==='b'&&!game.isOver())void botTurn();
}
function newGame(){resultDismissed=false;botRetryBlocked=false;difficulty=cleanDifficulty(draft.difficulty);rulesVersion=currentRules;storageKey='arena-game-v'+currentRules;game=new Battle({w:draft.deck,b:randomLoadout(),boss:draft.boss,difficulty});events=[];last=null;clear();error();saved();buildCards();render();}
// Pre-battle menu: pick the mode and your six abilities; any card can be swapped for one of its alternatives.
function openDraft(){
 const deck=$('draftDeck'),choice={deck:{...draft.deck},boss:draft.boss,difficulty:cleanDifficulty(draft.difficulty)};
 const costOf=(type,i)=>{const d=ability(type,i);return d.id==='revive'?'20+':String(d.cost);};
 $('difficulty').value=choice.difficulty;
 $('difficulty').onchange=()=>{choice.difficulty=cleanDifficulty($('difficulty').value);};
 const paint=()=>{
  $('draftModes').replaceChildren();
  for(const [key,boss] of [[null,{name:'Обычный бой',text:'Соперник собирает колоду случайно.'}],...Object.entries(bosses)]){
   const b=document.createElement('button');b.type='button';b.className='draft-mode'+(key?' boss':'');b.setAttribute('aria-pressed',String(choice.boss===key));
   b.innerHTML='<span class="mode-art"></span><b></b><small></small>';b.querySelector('b').textContent=boss.name;b.querySelector('small').textContent=boss.text;
   b.dataset.boss=key||'';
   const art=b.querySelector('.mode-art');
   if(key){const img=document.createElement('img');img.src=bossAsset(key);img.classList.add('chess-icon');img.alt='';img.loading='lazy';img.onerror=()=>{img.onerror=null;img.src='./pieces/bk.svg';};art.append(img);}
   else{art.classList.add('classic');art.textContent='♜';}
   b.addEventListener('click',()=>{choice.boss=key;paint();});$('draftModes').append(b);
  }
  let lore=$('bossLore');
  if(!lore){lore=document.createElement('p');lore.id='bossLore';lore.className='draft-hint';$('draftModes').after(lore);}
  lore.textContent=(bosses[choice.boss]?.lore||'');lore.hidden=!lore.textContent;
  deck.replaceChildren();
  for(const type of types){
   const index=choice.deck[type],def=ability(type,index);
   const card=document.createElement('div');card.className='draft-card'+(index?' alt':'');card.style.setProperty('--accent',accents[type]);
   card.innerHTML='<span class="cost"></span><span class="art">'+emblemSvg(def.id)+'</span><strong></strong><span class="card-label"></span><p></p>';
   card.querySelector('.cost').textContent=costOf(type,index);card.querySelector('.art').append(image(type,'w'));
   card.querySelector('strong').textContent=def.name;card.querySelector('.card-label').textContent=def.label;card.querySelector('p').textContent=def.text;
   const others=abilities[type].map((a,i)=>[a,i]).filter(([,i])=>i!==index);
   if(!others.length){const note=document.createElement('span');note.className='draft-swap fixed';note.textContent='Без замены';card.append(note);}
   for(const [spare,i] of others){const swap=document.createElement('button');swap.type='button';swap.className='draft-swap';swap.title=spare.text;swap.textContent='⇄ '+spare.name+' · '+costOf(type,i);swap.addEventListener('click',()=>{choice.deck[type]=i;paint();});card.append(swap);}
   deck.append(card);
  }
 };
 paint();
 $('draftReset').onclick=()=>{choice.deck=defaultLoadout();paint();};
 $('draftStart').onclick=()=>{draft=choice;try{localStorage.setItem(draftKey,JSON.stringify(draft));}catch{}$('draft').close();newGame();};
 $('draftArchive').onclick=openArchive;
 $('draft').showModal();
}
function openArchive(){
 const list=$('archiveList');list.replaceChildren();
 for(const item of archive){const row=document.createElement('div');row.className='archive-item '+(item.status==='идея'?'idea':'retired');row.innerHTML='<span class="archive-piece"></span><b></b><em></em><p></p>';row.querySelector('.archive-piece').textContent=item.piece;row.querySelector('b').textContent=item.name;row.querySelector('em').textContent=item.status;row.querySelector('p').textContent=item.text;list.append(row);}
 $('archive').showModal();
}
$('cancel').onclick=()=>{clear();render();};
$('rulesOpen').onclick=()=>$('rules').showModal();$('rulesClose').onclick=()=>$('rules').close();
$('archiveClose').onclick=()=>$('archive').close();
$('reviveCancel').onclick=()=>{$('resurrection').close();clear();render();};
$('resurrection').addEventListener('cancel',()=>{clear();render();});
$('promotion').addEventListener('cancel',()=>{pending=null;render();});
for(const b of $('promotion').querySelectorAll('button'))b.onclick=()=>{const action=pending?.find(m=>m.promotion===b.dataset.promotion);$('promotion').close();pending=null;if(action)void play(action,true);};
$('retry').onclick=()=>void botTurn();
$('newGame').onclick=()=>{if(!busy&&!room)openDraft();};
$('resultNew').onclick=()=>{if(!busy&&!room)openDraft();};
$('resultInspect').onclick=()=>{resultDismissed=true;render();$('resultReturn').focus();};
$('resultReturn').onclick=()=>{resultDismissed=false;render();$('resultInspect').focus();};
$('draftCancel').onclick=()=>$('draft').close();
// Undo back to the start of your previous turn, skipping the bot's reply and any free actions.
$('undo').onclick=()=>{if(room||busy||!game.actions.length)return;while(game.actions.length){game.undo();events.pop();if(game.side===playerColor&&!game.pending)break;}last=null;clear();error();saved();render();};
board.addEventListener('pointerleave',()=>preview());
$('themeToggle').onclick=()=>{const i=themes.findIndex(t=>t[0]===document.documentElement.dataset.theme);applyTheme(themes[(i+1)%themes.length][0]);};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!busy){clear();render();}});
applyTheme(document.documentElement.dataset.theme);

try{
 if(!localStorage.getItem(storageKey))for(const [version,Engine] of [[13,BattleV13],[12,BattleV12],[11,BattleV11],[10,BattleV10],[9,BattleV9],[8,BattleV8],[7,BattleV7],[6,BattleV6]]){if(localStorage.getItem('arena-game-v'+version)){rulesVersion=version;storageKey='arena-game-v'+version;game=new Engine();break;}}
 const state=JSON.parse(localStorage.getItem(storageKey)||'null');
 if(state){if(!Array.isArray(state.actions)||state.actions.length>1600)throw new Error();difficulty=cleanDifficulty(state.difficulty);game.reset({...state.loadout,boss:state.boss,difficulty});for(const a of state.actions){const concealed=game.side!==playerColor&&concealedMove(a);log(game.apply(a),concealed);}}
 else {difficulty=cleanDifficulty(draft.difficulty);game.reset({w:draft.deck,b:randomLoadout(),boss:draft.boss,difficulty});}
}catch{difficulty=cleanDifficulty(draft.difficulty);rulesVersion=currentRules;storageKey='arena-game-v'+currentRules;game=new Battle({w:draft.deck,b:randomLoadout(),boss:draft.boss,difficulty});events=[];last=null;error('Не удалось прочитать сохранение. Оно оставлено в браузере; открыта новая партия.');}
buildCards();render();
const invitedRoom=roomFromHash(location.hash);
if(invitedRoom)void enterRoom(invitedRoom,false);
else if(game.side==='b'&&!game.isOver())void botTurn();

window.addEventListener('hashchange', () => {
 const invited=roomFromHash(location.hash);
 if(invited&&invited!==room?.id)location.reload();
});
