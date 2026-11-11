import {installGiant} from './giant-rules.js';
export const MAX_ENERGY=60, TURN_ENERGY=8, KILL_ENERGY=4, KILL_ENERGY_CAP=12, CENTER_ENERGY=2, CENTER_ENERGY_CAP=4;
export const SNIPE_COST=50, STEALTH_COST=25, REVIVE_STEP=10, KING_GUARD_CAP=2, HEAL=2, AMBUSH_BONUS=2;
export const CHAIN_HITS=4, CHAIN_DAMAGE=2;
// Shrinking arena: from move 25 the outer ring burns, then every 8 moves the next one.
export const BURN_START=48, BURN_STEP=16, BURN_DAMAGE=1;
export const HUNTER_SHOT_DAMAGE=3, HUNTER_AIM_COOLDOWN=2;
export const HUNTER_HIDES=['a4','h4','b6','g6','e7','d5'];
export const attackOf=p=>p?.attack??attack[p?.type]??0;
const distance=(a,b)=>Math.max(Math.abs(a.charCodeAt(0)-b.charCodeAt(0)),Math.abs(+a[1]-+b[1]));
// Each piece type has one or more abilities; a draft before the game picks one per type.
export const abilities = {
 p:[
  {id:'blast',name:'Последний аргумент',cost:20,cooldown:0,label:'Пешка',text:'Пешка взрывается: 3 урона всем соседям, своим тоже.'},
  {id:'trench',name:'Окоп',cost:20,cooldown:3,label:'Пешка',text:'Пешка окапывается: +2 HP сверх максимума (до 4), и до её следующего хода каждый удар по ней слабее на 1.'},
 ],
 n:[
  {id:'svarog',name:'Звезда Сварога',cost:40,cooldown:2,label:'Конь',text:'Во всех коневых точках: врагам 2 урона, своим 1. Конь возвращается назад.'},
  {id:'gallop',name:'Скачка',cost:45,cooldown:3,label:'Конь',text:'Бьёт врага на коневой точке и скачет дальше к следующему врагу, до 4 ударов по 2 урона. Если последний убит, конь встаёт на его место, иначе возвращается.'},
 ],
 b:[
  {id:'quiet',name:'Снайперка',cost:SNIPE_COST,cooldown:3,label:'Слон',text:'Выстрел с места по диагонали: 4→3→2→1 урона всем на линии, своим тоже.'},
  {id:'stealth',name:'Инвиз',cost:STEALTH_COST,cooldown:3,label:'Слон',text:'Слон исчезает и сразу ходит невидимым. Инвиз длится два ответа соперника. Удар из инвиза даёт +2 урона и раскрывает слона.'},
 ],
 r:[
  {id:'train',name:'Паровоз',cost:50,cooldown:2,label:'Ладья',text:'По 4 урона всем на прямой, своим тоже. Останавливается перед первой выжившей фигурой. Износ: ладья теряет 2 HP за применение и может погибнуть.'},
  {id:'swap',name:'Подмена',cost:30,cooldown:2,label:'Ладья',text:'Ладья меняется местами с любой своей фигурой на доске.'},
 ],
 q:[
  {id:'order',name:'Приказ',cost:55,cooldown:3,label:'Ферзь',text:'Не тратит ход: любая своя фигура, кроме ферзя, делает лишний обычный ход, потом ходишь как обычно.'},
  {id:'mirror',name:'Зеркало',cost:30,cooldown:3,label:'Ферзь',text:'До твоего хода через два хода первый удар по ферзю отражается в атакующего.'},
 ],
 k:[
  {id:'revive',name:'Возвращение в лобби',cost:20,cooldown:3,label:'Король',text:'Возвращает потерянную фигуру с половиной HP: пешка 20, конь/слон 35, ладья 45, ферзь 55. Каждое воскрешение дороже на 10.'},
  {id:'rally',name:'Клич',cost:30,cooldown:3,label:'Король',text:'Свои фигуры рядом с королём восстанавливают 2 HP, сам король 1.'},
 ],
};
// Archive: retired abilities and ideas, shown for reference but not playable.
export const archive=[
 {piece:'Ферзь',name:'Вне очереди',status:'выведена',text:'Телепорт на пустую клетку, откуда ферзь не бьёт вражеского короля, и 2 урона соседним врагам.'},
 {piece:'Ферзь',name:'Буря',status:'выведена',text:'2 урона каждому врагу, которого ферзь сейчас бьёт. Ферзь остаётся на месте.'},
 {piece:'Конь',name:'Наскок',status:'выведена',text:'Два коневых прыжка за ход на пустую клетку и 2 урона всем соседним врагам при приземлении.'},
 {piece:'Слон',name:'Исцеление',status:'выведена',text:'Первая фигура на каждой диагонали слона, если своя, восстанавливает 2 HP.'},
 {piece:'Пешка',name:'Жертва',status:'идея',text:'Пешка погибает, +15 энергии. Покупает ульту материалом; воскрешение пешки дороже, вечного цикла нет.'},
 {piece:'Пешка',name:'Под знамя',status:'выведена',text:'Пешка на чужой половине доски становится конём с 2 HP.'},
 {piece:'Конь',name:'Таран',status:'идея',text:'Удар 3 и отбрасывание цели на клетку назад; если сзади фигура, обеим по 1.'},
 {piece:'Слон',name:'Метка',status:'идея',text:'Помеченный враг 2 хода получает +1 урона от всех ударов.'},
 {piece:'Ладья',name:'Бастион',status:'идея',text:'Ладья 2 хода стоит на месте, а своим фигурам рядом с ней каждый удар наносит на 1 меньше.'},
 {piece:'Король',name:'Ярость',status:'идея',text:'Король +2 к атаке на 2 хода, но стража не действует.'},
 {piece:'Правило',name:'Комбо',status:'идея',text:'Если способность кого-то убила, следующая в этот ход дешевле на 10.'},
];
export const types=['p','n','b','r','q','k'];
export const powers=Object.fromEntries(types.map(t=>[t,abilities[t][0]]));
export const ability=(type,index=0)=>abilities[type][Number(index)||0]||abilities[type][0];
export const defaultLoadout=()=>Object.fromEntries(types.map(t=>[t,0]));
export const randomLoadout=()=>Object.fromEntries(types.map(t=>[t,Math.floor(Math.random()*abilities[t].length)]));
const cleanLoadout=l=>Object.fromEntries(types.map(t=>{const v=l?.[t];const i=v===true?1:Number(v)||0;return [t,i>=0&&i<abilities[t].length?i:0];}));
// Boss mode: the bot gets a fixed deck and one rule bent in its favour.
export const bosses={
 iron:{name:'Железный король',text:'Король 20 HP, две ладьи и четыре пешки в плотном строю. Готовит удар по области 3×3: 2 урона врагам. Перед ударом есть ход для ответа. Стража до 3.',lore:'Удар занимает два хода: замах, затем обвал. После него — три хода перезарядки. Свита прикрывает короля, но ферзя и лёгких фигур у него нет.',loadout:{r:0,k:1}},
 horde:{name:'Дед',text:'Лишний ряд чёрных пешек на 6-й горизонтали и +2 энергии за ход. Колода: Окоп, Скачка.',lore:'Обычно в дебюте выводят коней и слонов. Эмиль Димер в партии против Томаса Хайлинга начал с 17 ходов подряд одними пешками — и выиграл. Нюрнберг, 1984. Этот босс решил, что пешек в той партии было недостаточно.',loadout:{p:1,n:1}},
 warlock:{name:'Колдун',text:'Король 16 HP, четыре слона и четыре пешки. Ритуал по пяти клеткам крест-накрест: 3 урона врагам. Уходи с меток или нанеси колдуну урон, чтобы сорвать подготовку.',lore:'Ритуал занимает два хода и прерывается уроном от фигур во время подготовки. Огонь арены ритуал не срывает. После ритуала или срыва — три хода перезарядки. Стартует с 60 энергии; обычные способности восстанавливаются быстрее.',loadout:{b:0,k:1}},
 hunter:{name:'Охотник в тумане',text:'Король 18 HP, два волка и четыре пешки. Целится по линии на 2–4 клетки, затем автоматически стреляет на 3 урона и скрывается в другой лёжке.',lore:'Занимай лёжки и клетки рядом с ними. Полученный урон срывает прицел. После выстрела источник, линия и возможные укрытия отмечены на один твой ход. Загнанный охотник может вернуться в туман, когда освободится укрытие. После пожара перекрытие последней лёжки начинает финальную дуэль.',loadout:{b:1,q:1,k:1}},
};
export const maxHP={p:2,n:4,b:3,r:6,q:5,k:12};
export const maxOf=p=>p?.max??maxHP[p?.type];
export const attack={p:2,n:3,b:3,r:4,q:4,k:2};
export const reviveCost={p:20,n:35,b:35,r:45,q:55};
export const center=['d4','e4','d5','e5'];
export const files='abcdefgh';
export const allSquares=Array.from({length:64},(_,i)=>files[i%8]+(8-Math.floor(i/8)));
export const other=c=>c==='w'?'b':'w';
// Ring 0 is the board edge, ring 3 the four central squares.
export const ringOf=s=>{const x=files.indexOf(s[0]),y=+s[1]-1;return Math.min(x,7-x,y,7-y);};
export const burnLevel=ply=>ply<BURN_START?0:Math.min(3,1+Math.floor((ply-BURN_START)/BURN_STEP));
const straight=[[1,0],[-1,0],[0,1],[0,-1]], diagonal=[[1,1],[-1,1],[1,-1],[-1,-1]];
const adjacent=[...straight,...diagonal], jumps=[[1,2],[-2,-1],[2,-1],[-1,2],[-1,-2],[2,1],[-2,1],[1,-2]];
export function step(s,dx,dy){const x=files.indexOf(s[0])+dx,y=+s[1]+dy;return x>=0&&x<8&&y>0&&y<9?files[x]+y:null;}
const around=s=>adjacent.map(([x,y])=>step(s,x,y)).filter(Boolean);
const knightFrom=s=>jumps.map(([x,y])=>step(s,x,y)).filter(Boolean);
const clone=x=>JSON.parse(JSON.stringify(x));
export class Battle {
 constructor(setup){this.reset(setup);}
 reset(setup={}){
  this.board={};for(const c of ['w','b']){const rank=c==='w'?1:8,pawn=c==='w'?2:7;[...'rnbqkbnr'].forEach((t,i)=>{this.board[files[i]+rank]={type:t,color:c,hp:maxHP[t]};this.board[files[i]+pawn]={type:'p',color:c,hp:2};});}
  this.boss=bosses[setup.boss]?setup.boss:null;
  const bossDeck=this.boss?{...defaultLoadout(),...bosses[this.boss].loadout}:null;
  this.loadout={w:cleanLoadout(setup.w),b:cleanLoadout(bossDeck||setup.b)};
  this.side='w';this.energy={w:20,b:20};this.readyAt={w:{},b:{}};this.grave={w:[],b:[]};this.revives={w:0,b:0};this.moved=[];this.ep=null;this.ply=0;this.winner=null;this.draw=false;this.actions=[];this.snapshots=[];this.quiet=0;this.pending=null;this.hunterPlan=null;this.hunterReadyAt=0;this.hunterTrace=null;this.bossPlan=null;this.bossReadyAt=0;
  if(['iron','warlock'].includes(this.boss)){
   for(const s of allSquares)if(this.get(s)?.color==='b')delete this.board[s];
   const iron=this.boss==='iron',hp=iron?20:16;this.board.e8={type:'k',color:'b',hp,max:hp};
   for(const s of iron?['d7','f7']:['b8','g8','c7','f7'])this.board[s]={type:iron?'r':'b',color:'b',hp:iron?6:3};
   for(const s of ['c6','d6','e6','f6'])this.board[s]={type:'p',color:'b',hp:2};
  }
  if(this.boss==='horde')for(const f of files)this.board[f+'6']={type:'p',color:'b',hp:2};
  if(this.boss==='warlock')this.energy.b=MAX_ENERGY;
  this.hunterAim=null;this.hunterIntel=null;this.hunterCorneredUntil=0;this.hunterFlushed=false;this.hunterShotTurn=-1;
  if(this.boss==='hunter'){
   for(const [s,p] of Object.entries(this.board))if(p.color==='b')delete this.board[s];
   this.board.e7={type:'k',color:'b',hp:18,max:18};
   for(const s of ['c8','f8'])this.board[s]={type:'n',color:'b',hp:3,max:3,attack:2,variant:'wolf'};
   for(const s of ['b7','c7','f7','g7'])this.board[s]={type:'p',color:'b',hp:2};
  }
 }
 get(s){return this.board[s];}
 fogEnabled(){return this.boss==='hunter';}
 litSquares(viewer){
  if(!this.fogEnabled()||viewer==='b')return new Set(allSquares);
  const out=new Set();
  for(const [s,p] of Object.entries(this.board)){
   if(p.color===viewer)for(let x=-2;x<=2;x++)for(let y=-2;y<=2;y++){const q=step(s,x,y);if(q)out.add(q);}
   if(p.revealUntil>this.ply||p.hunterRevealUntil>this.ply)out.add(s);
  }
  if(this.hunterFlushed){const s=this.hunterSquare();if(s)out.add(s);}
  return out;
 }
 visible(s,viewer,lit){const p=this.get(s);if(!p||p.color===viewer||p.revealUntil>this.ply||p.hunterRevealUntil>this.ply)return p;return p.invisibleUntil>this.ply||!(lit||this.litSquares(viewer)).has(s)?undefined:p;}
 hiddenFrom(s,viewer){const p=this.get(s);return Boolean(p&&p.color!==viewer&&!this.visible(s,viewer));}
 view(viewer){const g=new Battle();Object.assign(g,this.snapshot());const lit=this.litSquares(viewer);g.board=Object.fromEntries(Object.entries(g.board).filter(([s,p])=>p.color===viewer||p.revealUntil>this.ply||p.hunterRevealUntil>this.ply||(!(p.invisibleUntil>this.ply)&&lit.has(s))));if(viewer==='w'&&g.hunterAim){g.hunterAim={target:g.hunterAim.target,direction:g.hunterAim.direction,cells:g.hunterAim.cells};}return g;}
 // Moves as the side to move sees them: hidden enemies neither block nor show up as targets.
 legal(square){return this.view(this.side).normals(square);}
 legalSpecials(square){return this.view(this.side).specials(square);}
 abilityOf(type,color=this.side){return ability(type,this.loadout[color][type]);}
 idOf(move,color=this.side){return ability(move.power,move.alt).id;}
 cost(move,color=this.side){
  const id=this.idOf(move,color);
  if(id==='revive')return reviveCost[move.revive]+REVIVE_STEP*this.revives[color];
  if(id==='quiet')return SNIPE_COST;
  if(id==='stealth')return STEALTH_COST;
  return ability(move.power,move.alt).cost;
 }
 cooldownFor(move,color=this.side){return Math.max(0,ability(move.power,move.alt).cooldown-(this.boss==='warlock'&&color==='b'?1:0));}
 turn(){return this.side;}
 isOver(){return Boolean(this.winner||this.draw);}
 snapshot(){return clone({board:this.board,boss:this.boss,loadout:this.loadout,side:this.side,energy:this.energy,readyAt:this.readyAt,grave:this.grave,revives:this.revives,moved:this.moved,ep:this.ep,ply:this.ply,winner:this.winner,draw:this.draw,quiet:this.quiet,pending:this.pending,hunterReadyAt:this.hunterReadyAt,hunterAim:this.hunterAim,hunterIntel:this.hunterIntel,hunterCorneredUntil:this.hunterCorneredUntil,hunterFlushed:this.hunterFlushed,hunterShotTurn:this.hunterShotTurn,bossPlan:this.bossPlan,bossReadyAt:this.bossReadyAt});}
 cooldown(type,color=this.side){return Math.max(0,Math.ceil(((this.readyAt[color][type]||0)-this.ply)/2));}
 undo(){const prior=this.snapshots.pop();if(prior){Object.assign(this,prior);this.actions.pop();}}
 ray(from,dx,dy){const out=[];for(let s=step(from,dx,dy);s;s=step(s,dx,dy))out.push(s);return out;}
 between(from,to){
  const dx=files.indexOf(to[0])-files.indexOf(from[0]),dy=+to[1]-+from[1];
  if(!(dx===0||dy===0||Math.abs(dx)===Math.abs(dy)))return [];
  const out=[];for(let s=step(from,Math.sign(dx),Math.sign(dy));s&&s!==to;s=step(s,Math.sign(dx),Math.sign(dy)))out.push(s);return out;
 }
 burning(s,ply=this.ply){return ringOf(s)<burnLevel(ply);}
 bossArea(kind,target){return [target,...(kind==='iron'?adjacent:diagonal).map(([x,y])=>step(target,x,y)).filter(Boolean)];}
 bossMoves(){
  if(!['iron','warlock'].includes(this.boss)||this.side!=='b'||this.isOver()||this.pending)return [];
  const from=allSquares.find(s=>this.get(s)?.type==='k'&&this.get(s)?.color==='b');if(!from)return [];
  if(this.bossPlan)return [{bossAction:'resolve',bossKind:this.bossPlan.kind,from,to:this.bossPlan.target,area:this.bossArea(this.bossPlan.kind,this.bossPlan.target)}];
  if(this.ply<this.bossReadyAt)return [];
  const range=this.boss==='iron'?2:4,out=[];
  for(const to of allSquares){
   if(Math.max(Math.abs(files.indexOf(from[0])-files.indexOf(to[0])),Math.abs(+from[1]-+to[1]))>range)continue;
   const area=this.bossArea(this.boss,to);
   if(area.some(s=>this.visible(s,'b')?.color==='w'))out.push({bossAction:'prepare',bossKind:this.boss,from,to,area});
  }
  return out;
 }
 hunterSquare(){return allSquares.find(s=>this.get(s)?.type==='k'&&this.get(s)?.color==='b');}
 hunterOpenHides(){
  if(this.boss!=='hunter')return [];
  return HUNTER_HIDES.filter(s=>!this.burning(s)&&![s,...around(s)].some(q=>this.visible(q,'b')?.color==='w')&&(!this.visible(s,'b')||this.visible(s,'b')?.type==='k'&&this.visible(s,'b')?.color==='b'));
 }
 hunterDestinations(from=this.hunterSquare()){return from?this.hunterOpenHides().filter(s=>s!==from&&distance(s,from)<=3):[];}
 hunterEscapeScore(to){
  const from=this.hunterSquare(),board={...this.view('b').board},king=board[from];if(!king)return -Infinity;
  delete board[from];board[to]=king;
  const known=Object.assign(Object.create(Battle.prototype),this,{board});
  const white=Object.entries(board).filter(([,p])=>p.color==='w');
  const nearest=Math.min(9,...white.map(([s])=>distance(s,to)));
  const damage=Math.max(0,...white.filter(([s])=>known.attacks(s,to)).map(([,p])=>known.damageTo(to,attackOf(p))));
  return nearest*24-damage*150;
 }
 hunterCanStep(){return this.hunterShotTurn!==this.ply&&(this.hunterFlushed||this.hunterCorneredUntil>this.ply);}
 hunterForced(){const from=this.hunterSquare();return this.boss==='hunter'&&this.side==='b'&&!this.hunterFlushed&&this.hunterShotTurn!==this.ply&&from&&!this.hunterOpenHides().includes(from)&&this.hunterDestinations(from).length>0;}
 hunterInfo(viewer='w'){
  const aim=this.hunterAim?{target:this.hunterAim.target,direction:[...this.hunterAim.direction],cells:[...this.hunterAim.cells]}:null;
  return {hides:[...HUNTER_HIDES],aim,intel:this.hunterIntel?.expiresAt>this.ply?clone(this.hunterIntel):null,cornered:this.hunterCorneredUntil>this.ply,flushed:this.hunterFlushed};
 }
 hunterMoves(){
  if(this.boss!=='hunter'||this.side!=='b'||this.isOver()||this.pending)return [];
  const from=this.hunterSquare();if(!from)return [];
  const out=[];
  if(this.hunterShotTurn!==this.ply){
   if(!this.hunterFlushed)for(const to of this.hunterDestinations(from))out.push({hunter:'relocate',from,to});
   if(!this.hunterForced()&&this.hunterCorneredUntil<=this.ply&&this.ply>=this.hunterReadyAt){
    for(const [dx,dy] of adjacent){const path=this.ray(from,dx,dy).slice(0,4),i=path.findIndex(s=>this.visible(s,'b'));if(i>=1&&this.visible(path[i],'b')?.color==='w')out.push({hunter:'aim',from,to:path[i],direction:[dx,dy],cells:path.slice(0,i).slice(-2)});}
   }
  }
  if(!out.length&&!this.normals().length)out.push({hunter:'wait',from,to:from});
  return out;
 }
 hunterCorner(result){
  const s=this.hunterSquare();if(!s)return;
  this.hunterCorneredUntil=this.ply+2;this.get(s).hunterRevealUntil=this.ply+2;this.hunterAim=null;result.hunterCornered=true;
 }
 hunterRelocate(to,result){
  const from=this.hunterSquare(),p=this.get(from);if(!p)return false;
  const occupant=this.get(to);
  if(occupant){occupant.revealUntil=this.ply+2;delete occupant.invisibleUntil;result.hunterAmbush={square:to};this.hunterCorner(result);if(this.hunterIntel)this.hunterIntel.candidates=[];return false;}
  delete this.board[from];this.board[to]=p;this.moved.push(from);return true;
 }
 hunterStartTurn(result,damageAll){
  if(this.boss!=='hunter'||this.side!=='b'||this.isOver())return;
  let from=this.hunterSquare();if(!from)return;
  // A projected white view has no hidden shooter; never reconstruct it from secret state.
  if(this.hunterAim?.from){
   const aim=this.hunterAim;this.hunterAim=null;
   if(aim.from===from){
    const ray=this.ray(from,...aim.direction).slice(0,4),target=ray.find(s=>this.get(s)),path=target?ray.slice(0,ray.indexOf(target)+1):ray,damage=[],mirrored=[];
    if(target){const v=this.get(target);if(v.color==='w'&&v.mirrorUntil>this.ply){mirrored.push(target);damage.push({square:from,amount:this.damageTo(from,HUNTER_SHOT_DAMAGE),reflected:true});delete v.mirrorUntil;}else damage.push({square:target,amount:this.damageTo(target,HUNTER_SHOT_DAMAGE)});}
    const before=result.captured.length;damageAll(damage);
    this.quiet=0;this.energy.b=Math.min(MAX_ENERGY,this.energy.b+Math.min(KILL_ENERGY_CAP,result.captured.slice(before).filter(p=>p.color==='w').length*KILL_ENERGY));
    for(const d of damage){const p=this.get(d.square);if(p)p.revealUntil=this.ply+2;}
    this.endCheck(result.captured.slice(before));
    this.hunterShotTurn=this.ply;this.hunterReadyAt=this.ply+2*(HUNTER_AIM_COOLDOWN+1);
    const candidates=this.hunterFlushed||!this.get(from)||this.isOver()?[]:this.hunterDestinations(from);
    this.hunterIntel={source:from,path,candidates:[...candidates],expiresAt:this.ply+2};
    result.hunterShot={from,path,damage,captured:result.captured.slice(before),mirrored,candidates:[...candidates],miss:!target};
    if(this.get(from)&&!this.isOver()&&!this.hunterFlushed){
     if(candidates.length){const to=[...candidates].sort((a,b)=>this.hunterEscapeScore(b)-this.hunterEscapeScore(a)||a.localeCompare(b))[0];this.hunterRelocate(to,result);}
     else this.hunterCorner(result);
    }
   }
  }
  from=this.hunterSquare();if(!from||this.isOver())return;
  if(!this.hunterFlushed&&HUNTER_HIDES.every(s=>s==='d5'||this.burning(s))&&!this.hunterOpenHides().length){this.hunterFlushed=true;this.hunterCorner(result);result.hunterFlushed=true;}
  else if(!this.hunterFlushed&&!this.hunterOpenHides().includes(from)&&!this.hunterDestinations(from).length)this.hunterCorner(result);
 }
 normals(square){
  if(this.isOver()||this.side==='b'&&this.bossPlan||this.hunterForced())return [];
  const out=[],pend=this.pending;
  // After going invisible only that bishop moves (it may stay put); after an order the queen sits out.
  let sources=square?[square]:allSquares;
  if(pend?.kind==='stealth'){sources=sources.filter(s=>s===pend.square);if(sources.length)out.push({from:pend.square,to:pend.square,stay:true});}
  if(pend?.kind==='order')sources=sources.filter(s=>s!==pend.square);
  for(const from of sources){
   const p=this.get(from);if(!p||p.color!==this.side)continue;
   const add=(to,extra={})=>{if(!to||this.get(to)?.color===p.color)return;if(this.boss==='hunter'&&p.color==='b'&&p.type==='k'&&!this.hunterCanStep()&&this.get(to)?.color!=='w')return; if(p.type==='p'&&/[18]$/.test(to)){for(const promotion of ['q','r','b','n'])out.push({from,to,promotion,...extra});}else out.push({from,to,...extra});};
   if(p.type==='p'){
    const dy=p.color==='w'?1:-1,one=step(from,0,dy),two=step(from,0,dy*2);
    if(one&&!this.get(one)){add(one);if(from[1]===(p.color==='w'?'2':'7')&&!this.get(two))add(two,{double:true});}
    for(const dx of [-1,1]){const to=step(from,dx,dy);if(to&&(this.get(to)?.color===other(p.color)||to===this.ep))add(to,{enPassant:to===this.ep});}
   }else if(p.type==='n'||p.type==='k'){
    for(const [dx,dy] of p.type==='n'?jumps:adjacent)add(step(from,dx,dy));
    const home=p.color==='w'?'1':'8';
    if(p.type==='k'&&from==='e'+home&&!this.moved.includes(from)){
     for(const [rook,to,empty] of [['h','g','fg'],['a','c','bcd']]){
      const rp=this.get(rook+home);
      if(rp?.type==='r'&&rp.color===p.color&&!this.moved.includes(rook+home)&&[...empty].every(f=>!this.get(f+home)))add(to+home,{castle:rook+home});
     }
    }
   }else{
    for(const [dx,dy] of p.type==='r'?straight:p.type==='b'?diagonal:adjacent){
     for(const to of this.ray(from,dx,dy)){if(this.get(to)?.color===p.color)break;add(to);if(this.get(to))break;}
    }
   }
  }return out;
 }
 attacks(from,target,board=this.board){
  if(!target)return false;const p=board[from];if(!p)return false;
  const dx=files.indexOf(target[0])-files.indexOf(from[0]),dy=+target[1]-+from[1],ax=Math.abs(dx),ay=Math.abs(dy);
  if(p.type==='p')return ax===1&&dy===(p.color==='w'?1:-1);
  if(p.type==='n')return ax*ay===2;
  if(p.type==='k')return Math.max(ax,ay)===1;
  if(!(p.type!=='b'&&(dx===0||dy===0)||p.type!=='r'&&ax===ay)||(!dx&&!dy))return false;
  for(let s=step(from,Math.sign(dx),Math.sign(dy));s&&s!==target;s=step(s,Math.sign(dx),Math.sign(dy)))if(board[s])return false;
  return true;
 }
 threatened(color){const king=allSquares.find(s=>this.get(s)?.color===color&&this.get(s)?.type==='k');return allSquares.some(s=>this.get(s)?.color===other(color)&&this.attacks(s,king));}
 wounded(s){const p=this.get(s);return Boolean(p&&(p.hp??maxOf(p))<maxOf(p));}
 // Knight chain: hit the chosen enemy, then hop to the weakest unhit enemy a knight's jump away.
 chain(first,color){
  const path=[first],hit=new Set([first]);let at=first;
  while(path.length<CHAIN_HITS){
   const next=knightFrom(at).filter(s=>!hit.has(s)&&this.get(s)&&this.get(s).color!==color).sort((a,b)=>(this.get(a).hp??maxOf(this.get(a)))-(this.get(b).hp??maxOf(this.get(b)))||a.localeCompare(b))[0];
   if(!next)break;path.push(next);hit.add(next);at=next;
  }
  return path;
 }
 specials(square){
  if(this.isOver()||this.pending||this.side==='b'&&(this.boss==='hunter'||this.bossPlan))return [];
  const out=[],color=this.side;
  for(const from of square?[square]:allSquares){
   const p=this.get(from);if(!p||p.color!==color)continue;
   const index=this.loadout[color][p.type],def=ability(p.type,index);
   if(this.energy[color]<def.cost||this.cooldown(p.type,color))continue;
   const add=(to,area=[],extra={})=>out.push({from,to,power:p.type,area,...(index?{alt:index}:{}),...extra});
   switch(def.id){
    case 'blast':{const area=around(from);if(area.some(s=>this.get(s)?.color===other(color)))add(from,area);break;}
    case 'trench':if((p.hp??maxOf(p))<4)add(from,[from]);break;
    case 'svarog':{const area=knightFrom(from);if(area.some(s=>this.get(s)))add(from,area);break;}
    case 'gallop':for(const s of knightFrom(from))if(this.get(s)?.color===other(color))add(s,this.chain(s,color));break;
    case 'stealth':if(!(p.invisibleUntil>this.ply))add(from,[],{mode:'stealth'});break;
    case 'quiet':
     if(this.energy[color]>=SNIPE_COST)for(const [dx,dy] of diagonal){const area=this.ray(from,dx,dy);if(area.some(s=>this.get(s)))add(area.at(-1),area,{mode:'snipe'});}
     break;
    case 'train':for(const [dx,dy] of straight){const area=this.ray(from,dx,dy);if(area.some(s=>this.get(s)))add(area.at(-1),area,{path:area});}break;
    case 'swap':for(const s of allSquares)if(s!==from&&this.get(s)?.color===color)add(s,[s]);break;
    case 'teleport':{
     const king=allSquares.find(s=>this.get(s)?.color===other(color)&&this.get(s)?.type==='k');
     for(const to of allSquares)if(!this.get(to)){const board={...this.board};delete board[from];board[to]=p;if(!this.attacks(to,king,board))add(to,around(to));}
     break;
    }
    case 'storm':{const area=allSquares.filter(s=>this.get(s)?.color===other(color)&&this.attacks(from,s));if(area.length)add(from,area);break;}
    case 'order':if(this.normals().some(m=>m.from!==from))add(from,[]);break;
    case 'mirror':if(!(p.mirrorUntil>this.ply))add(from,[from]);break;
    case 'revive':
     for(const revive of new Set(this.grave[color]))if(this.energy[color]>=this.cost({power:'k',revive},color))for(const to of around(from))if(!this.get(to)&&!(revive==='p'&&/[18]$/.test(to)))add(to,[],{revive});
     break;
    case 'rally':{const area=around(from).filter(s=>this.get(s)?.color===color);if(this.wounded(from)||area.some(s=>this.wounded(s)))add(from,[from,...area]);break;}
   }
  }return out;
 }
 // Royal guard: each ally next to the king absorbs 1 damage (2 at most, 3 for the iron king); a hit always deals at least 1.
 guards(square){const k=this.get(square);if(k?.type!=='k')return 0;const cap=this.boss==='iron'&&k.color==='b'?3:KING_GUARD_CAP;return Math.min(cap,around(square).filter(s=>this.get(s)?.color===k.color).length);}
 damageTo(square,amount){const p=this.get(square);if(p?.trenchUntil>this.ply)amount=Math.max(1,amount-1);if(p?.type==='k')amount=Math.max(1,amount-this.guards(square));if(this.boss==='hunter'&&p?.type==='k'&&p.color==='b'&&this.hunterCorneredUntil>this.ply)amount++;return amount;}
 // Resolves a move against the real board. Moves come from the mover's view, so a hidden
 // enemy may stand in the way: the mover bumps into it, reveals it and attacks it if it can.
 impact(move){
  const damage=[],heals=[],mirrored=[],color=this.side,id=move.power?this.idOf(move):null;let landing=move.to,area=move.area||[],reveal=null,struck=null;
  const hit=(square,amount,extra={})=>{
   const victim=this.get(square);
   // A mirrored queen sends the first enemy blow back at whoever struck it.
   if(victim&&victim.color!==color&&victim.mirrorUntil>this.ply&&!mirrored.includes(square)&&this.get(move.from)){mirrored.push(square);damage.push({square:move.from,amount:this.damageTo(move.from,amount),reflected:true});return 0;}
   const dealt=this.damageTo(square,amount);damage.push({square,amount:dealt,...extra});return dealt;
  };
  const heal=(square,amount)=>{const p=this.get(square);if(!p)return;const gain=Math.min(amount,maxOf(p)-(p.hp??maxOf(p)));if(gain>0)heals.push({square,amount:gain});};
  if(move.bossAction){
   landing=move.from;
   if(move.bossAction==='resolve'&&this.bossPlan?.from===move.from)for(const s of this.bossArea(move.bossKind,move.to))if(this.get(s)?.color===other(color))hit(s,move.bossKind==='iron'?2:3);
  }else if(move.hunter){
   landing=move.hunter==='relocate'&&!this.get(move.to)?move.to:move.from;
  }else if(id){
   landing=move.from;
   switch(id){
    case 'blast':for(const s of move.area)if(this.get(s))hit(s,3);break;
    case 'svarog':for(const s of move.area){const p=this.get(s);if(p)hit(s,p.color===color?1:2);}break;
    case 'gallop':{
     area=move.area||[];let last=null;
     for(const s of area){const p=this.get(s);const dealt=hit(s,CHAIN_DAMAGE);last={s,dead:(p.hp??maxOf(p))<=dealt};}
     if(last?.dead)landing=last.s;break;
    }
    case 'quiet':
     if(move.mode==='snipe'){let strength=4;for(const s of move.area)if(this.get(s)){hit(s,strength);strength=Math.max(1,strength-1);}}
     break;
    case 'train':
     area=[];
     for(const s of move.area){area.push(s);const p=this.get(s);if(p){const dealt=hit(s,4);if((p.hp??maxOf(p))>dealt)break;}landing=s;}
     damage.push({square:move.from,amount:2,self:true,recoil:true});
     break;
    case 'swap':landing=move.to;break;
    case 'teleport':if(this.get(move.to))reveal=move.to;else{landing=move.to;for(const s of move.area){const p=this.get(s);if(p&&p.color!==color)hit(s,2);}}break;
    case 'storm':for(const s of allSquares){const p=this.get(s);if(p&&p.color!==color&&this.attacks(move.from,s))hit(s,2);}break;
    case 'revive':if(this.get(move.to))reveal=move.to;break;
    case 'rally':heal(move.from,1);for(const s of move.area)if(s!==move.from)heal(s,HEAL);break;
   }
  }else if(move.stay){
   landing=move.from;
  }else{
   const p=this.get(move.from),path=this.between(move.from,move.to);
   const route=[...path,move.to],blockAt=route.findIndex(s=>this.hiddenFrom(s,color));
   let target=move.enPassant?move.to[0]+move.from[1]:move.to,before=move.from;
   if(blockAt>=0){
    reveal=route[blockAt];before=blockAt>0?route[blockAt-1]:move.from;
    if(move.castle)return {damage,heals,mirrored,landing:move.from,area,reveal,struck};
    if(p.type==='p'&&move.from[0]===move.to[0])return {damage,heals,mirrored,landing:before,area,reveal,struck};
    target=reveal;
   }
   const v=this.get(target);
   if(v&&v.color!==color){
    struck=target;const ambush=p.invisibleUntil>this.ply?AMBUSH_BONUS:0;const amount=hit(target,attackOf(p)+ambush,ambush?{ambush:true}:{});
    if((v.hp??maxOf(v))>amount){
     landing=before;
     // Counter-strike: a survivor that hits the attacker's square strikes back (not after a mirror).
     const board={...this.board};delete board[move.from];board[landing]=p;
     if(!mirrored.length&&this.attacks(target,landing,board))hit(move.from,attackOf(v),{counter:true});
    }else landing=target;
   }else if(blockAt>=0)landing=before;
  }
  if(!move.hunter&&!move.power&&this.boss==='hunter'&&color==='b'&&this.get(move.from)?.type==='k'&&!this.hunterCanStep())landing=move.from;
  return {damage,heals,mirrored,landing,area,reveal,struck,blocked:Boolean(move.hunter==='relocate'&&landing!==move.to)};
 }
 apply(action){
  if(this.isOver())throw new Error('Партия завершена.');
  if(!action||typeof action!=='object')throw new Error('Некорректный ход.');
  const options=action.bossAction?this.view(this.side).bossMoves():action.hunter?this.view(this.side).hunterMoves():action.power?this.legalSpecials(action.from):this.legal(action.from);
  const move=options.find(m=>m.from===action.from&&m.to===action.to&&m.bossAction===action.bossAction&&m.bossKind===action.bossKind&&m.hunter===action.hunter&&(!m.hunter||m.via===action.via&&m.retreat===action.retreat)&&m.power===action.power&&(Number(m.alt)||0)===(Number(action.alt)||0)&&Boolean(m.stay)===Boolean(action.stay)&&m.promotion===action.promotion&&m.revive===action.revive&&m.mode===action.mode);
  if(!move)throw new Error('Недопустимый ход или недостаточно энергии.');
  this.snapshots.push(this.snapshot());
  const color=this.side,p=this.get(move.from),captured=[],revived=[],impact=this.impact(move),id=move.power?this.idOf(move):null,spent=move.power?this.cost(move,color):0;
  let bossInterrupted=false,hunterInterrupted=false;const hunterEvents={};
  const damageAll=(list,environment=false)=>{for(const {square,amount,counter} of list){const victim=this.get(square);if(!victim)continue;
   if(!environment&&amount>0&&victim.type==='k'&&victim.color==='b'&&this.bossPlan?.kind==='warlock'&&move.bossAction!=='resolve'){bossInterrupted=true;this.bossPlan=null;this.bossReadyAt=this.ply+(this.side==='b'?8:7);}
   if(amount>0&&victim.type==='k'&&victim.color==='b'&&this.boss==='hunter'){if(this.hunterAim)hunterInterrupted=true;this.hunterAim=null;victim.revealUntil=this.ply+(this.side==='b'?2:3);}
   victim.hp=(victim.hp??maxOf(victim))-amount;if(victim.hp<=0){captured.push({square,...victim,...(counter?{counter:true}:{})});if(victim.type!=='k')this.grave[victim.color].push(victim.type);delete this.board[square];if(!this.moved.includes(square))this.moved.push(square);}}};
  damageAll(impact.damage);
  if(this.fogEnabled())for(const {square} of impact.damage){const victim=this.get(square);if(victim)victim.revealUntil=this.ply+3;}
  for(const {square,amount} of impact.heals){const q=this.get(square);if(q)q.hp=Math.min(maxOf(q),(q.hp??maxOf(q))+amount);}
  for(const s of impact.mirrored)if(this.get(s))delete this.get(s).mirrorUntil;
  for(const s of [impact.reveal,impact.struck])if(s&&this.get(s)){delete this.get(s).invisibleUntil;if(this.fogEnabled())this.get(s).revealUntil=this.ply+3;}
  if(this.fogEnabled()&&impact.damage.length&&this.get(move.from))this.get(move.from).revealUntil=this.ply+3;
  const free=id==='stealth'||id==='order';
  if(!free)this.ep=null;
  const alive=this.get(move.from)===p;
  if(move.bossAction){
   if(move.bossAction==='prepare'&&alive){this.bossPlan={kind:move.bossKind,from:move.from,target:move.to,area:this.bossArea(move.bossKind,move.to)};p.revealUntil=this.ply+4;}
   else{this.bossPlan=null;this.bossReadyAt=this.ply+8;}
  }else if(move.hunter){
   if(alive){
    if(move.hunter==='aim')this.hunterAim={from:move.from,target:move.to,direction:move.direction,cells:move.cells};
    else if(move.hunter==='relocate')this.hunterRelocate(move.to,hunterEvents);
   }
  }else if(move.power){
   this.energy[color]-=spent;
   this.readyAt[color][move.power]=this.ply+2*(this.cooldownFor(move,color)+1);
   switch(id){
    case 'blast':delete this.board[move.from];this.grave[color].push('p');break;
    case 'trench':p.max=4;p.hp=Math.min(4,(p.hp??maxOf(p))+2);p.trenchUntil=this.ply+2;break;
    case 'gallop':if(alive&&impact.landing!==move.from){delete this.board[move.from];this.board[impact.landing]=p;}if(alive)delete p.invisibleUntil;break;
    case 'quiet':delete p.invisibleUntil;break;
    case 'stealth':p.invisibleUntil=this.ply+4;break;
    case 'train':if(alive){delete this.board[move.from];this.board[impact.landing]=p;}break;
    case 'swap':{const mate=this.board[move.to];this.board[move.to]=p;this.board[move.from]=mate;this.moved.push(move.to);break;}
    case 'teleport':if(alive&&!impact.reveal){delete this.board[move.from];this.board[impact.landing]=p;}break;
    case 'mirror':p.mirrorUntil=this.ply+4;break;
    case 'revive':if(!impact.reveal){this.board[move.to]={type:move.revive,color,hp:Math.ceil(maxHP[move.revive]/2)};this.grave[color].splice(this.grave[color].indexOf(move.revive),1);this.revives[color]++;this.moved.push(move.to);revived.push(move.to);}break;
   }
  }else if(alive&&!move.stay){
   if(impact.struck)delete p.invisibleUntil;
   delete this.board[move.from];
   const promote=move.promotion&&impact.landing===move.to;
   this.board[impact.landing]={...p,...(promote?{type:move.promotion,hp:maxHP[move.promotion]}:{})};
   if(promote){delete this.board[impact.landing].max;delete this.board[impact.landing].trenchUntil;}
   if(move.double&&impact.landing===move.to)this.ep=step(move.from,0,color==='w'?1:-1);
   if(move.castle&&impact.landing===move.to){const dest=(move.to[0]==='g'?'f':'d')+move.from[1];this.board[dest]=this.board[move.castle];delete this.board[move.castle];this.moved.push(move.castle);}
  }
  this.moved.push(move.from);
  this.actions.push({from:move.from,to:move.to,...(move.bossAction?{bossAction:move.bossAction,bossKind:move.bossKind}:{}),...(move.hunter?{hunter:move.hunter,via:move.via,retreat:move.retreat}:{}),...(move.power?{power:move.power}:{}),...(move.alt?{alt:move.alt}:{}),...(move.stay?{stay:true}:{}),...(move.revive?{revive:move.revive}:{}),...(move.mode?{mode:move.mode}:{}),...(move.promotion?{promotion:move.promotion}:{})});
  this.energy[color]=Math.min(MAX_ENERGY,this.energy[color]+Math.min(KILL_ENERGY_CAP,captured.filter(p=>p.color!==color).length*KILL_ENERGY));
  this.quiet=impact.damage.length||p.type==='p'||move.revive?0:this.quiet+1;
  const result={...move,id,color,captured,revived,damage:impact.damage,heals:impact.heals,mirrored:impact.mirrored,landing:impact.landing,reveal:impact.reveal,struck:impact.struck,hunterBlocked:impact.blocked,hunterInterrupted,...hunterEvents,bossInterrupted,bossResolved:move.bossAction==='resolve',burn:[]};
  this.endCheck(captured);
  // Free actions keep the turn: stealth lets that bishop move, an order grants one extra move.
  const wasOrder=this.pending?.kind==='order';
  if(!this.isOver()&&free){this.pending=id==='order'?{kind:'order',square:move.from}:{kind:'stealth',square:move.from};return {...result,followUp:true};}
  if(!this.isOver()&&wasOrder&&!move.power){this.pending=null;return {...result,followUp:true};}
  this.pending=null;
  if(this.isOver())return result;
  this.side=other(color);this.ply++;
  if(this.hunterIntel?.expiresAt<=this.ply)this.hunterIntel=null;
  if(this.ply>1){
   const s=this.side,held=center.filter(q=>this.get(q)?.color===s).length;
   this.energy[s]=Math.min(MAX_ENERGY,this.energy[s]+TURN_ENERGY+Math.min(CENTER_ENERGY_CAP,held*CENTER_ENERGY)+(this.boss==='horde'&&s==='b'?2:0));
  }
  // The burning edge scorches the pieces of the side about to move.
  const scorched=allSquares.filter(q=>this.get(q)?.color===this.side&&this.burning(q)).map(q=>({square:q,amount:BURN_DAMAGE}));
  if(scorched.length){const before=captured.length;damageAll(scorched,true);result.burn=scorched;result.captured=captured;result.bossInterrupted=bossInterrupted;this.quiet=0;this.endCheck(captured.slice(before));}
  this.hunterStartTurn(result,damageAll);result.hunterInterrupted=hunterInterrupted;
  if(!this.isOver()&&(this.quiet>=100||this.ply>=400||(!this.legal().length&&!this.legalSpecials().length&&!this.hunterMoves().length&&!this.bossMoves().length)))this.draw=true;
  return result;
 }
 endCheck(captured){const kings=captured.filter(p=>p.type==='k');if(kings.length>=2)this.draw=true;else if(kings.length)this.winner=other(kings[0].color);}
 fen(){
  const rows=[];for(let rank=8;rank>=1;rank--){let row='',empty=0;for(const file of files){const p=this.get(file+rank);if(!p){empty++;continue;}if(empty){row+=empty;empty=0;}row+=p.color==='w'?p.type.toUpperCase():p.type;}if(empty)row+=empty;rows.push(row);}
  return rows.join('/')+' '+this.side+' - '+(this.ep||'-')+' '+this.quiet+' '+(Math.floor(this.ply/2)+1);
 }
}
export const uci=m=>m.from+m.to+(m.promotion||'');
const value={p:1,n:3,b:3,r:5,q:9,k:100};
const threatenedAt=(game,s,color)=>allSquares.some(e=>game.get(e)?.color===other(color)&&game.attacks(e,s));
// Both bot helpers expect the bot's own view of the game (hidden enemies removed).
export function abilityChoice(game){
 const color=game.side;
 const options=game.specials().map(move=>{
  const impact=game.impact(move),id=game.idOf(move);
  let score=impact.damage.reduce((sum,{square:s,amount})=>{const p=game.get(s);return sum+(p.color===other(color)?1:-1.5)*value[p.type]*Math.min(1,amount/(p.hp??maxOf(p)));},0);
  score+=impact.heals.reduce((sum,{square:s,amount})=>sum+Math.min(value[game.get(s).type],20)*amount/maxOf(game.get(s)),0);
  if(id==='revive')score=value[move.revive];
  if(id==='blast')score-=1;
  if(id==='trench')score=threatenedAt(game,move.from,color)?2.5:0;
  if(id==='swap')score=game.get(move.to)?.type==='k'&&threatenedAt(game,move.to,color)&&!threatenedAt(game,move.from,color)?6:0;
  if(id==='order')score=3.5;
  if(id==='mirror')score=threatenedAt(game,move.from,color)?4:0;
  if(move.mode==='stealth')score=threatenedAt(game,move.from,color)?3:0;
  return {move,score:score-game.cost(move,color)/30};
 }).sort((a,b)=>b.score-a.score);
 return options[0]?.score>=1.5?options[0].move:null;
}
export function localMove(game){
 const special=abilityChoice(game);if(special)return special;
 const color=game.side,soon=game.ply+4;
 return game.normals().map(move=>{
  const impact=game.impact(move),mover=game.get(move.from);let score=Math.random()*2+(move.promotion?8:0);
  for(const {square,amount} of impact.damage){const v=game.get(square);score+=(v.color===color?-1.2:1)*value[v.type]*Math.min(1,amount/(v.hp??maxOf(v)))*10;}
  if(impact.landing!==move.from&&threatenedAt(game,move.to,color))score-=value[mover.type]*2;
  if(center.includes(impact.landing)&&!center.includes(move.from))score+=1.5;
  // Get off the burning edge, and do not step onto the next ring to burn.
  if(game.burning(move.from,soon)&&!game.burning(impact.landing,soon))score+=mover.type==='k'?12:4;
  if(!game.burning(move.from,soon)&&game.burning(impact.landing,soon))score-=mover.type==='k'?12:4;
  return {move,score};
 }).sort((a,b)=>b.score-a.score)[0]?.move||game.specials()[0];
}
installGiant(Battle,bosses);
