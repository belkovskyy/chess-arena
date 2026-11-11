// The giant is one entity occupying four cells. This module installs the
// encounter without changing the rules of the other modes.
export const GIANT_HP=42;
export function installGiant(Battle,bosses){
 bosses.giant={name:'Великан',text:'Тело 2×2, '+GIANT_HP+' HP. Зона удара видна за два твоих хода. После удара получает +1 урона на твой ход.',lore:'Шаг и выбор удара → замах → удар. Обойди отмеченную область и атакуй, пока великан выдохся. Огонь в этом бою отключён. Это первый прототип без свиты.',loadout:{}};
 const P=Battle.prototype,base=Object.fromEntries(['reset','snapshot','impact','apply','bossMoves','normals','specials','damageTo','attacks','guards','chain','burning'].map(k=>[k,P[k]]));
 const files='abcdefgh',sq=(x,y)=>x>=0&&x<8&&y>=1&&y<=8?files[x]+y:null;
 const xy=s=>[files.indexOf(s[0]),+s[1]],dist=(a,b)=>{const [x,y]=xy(a),[u,v]=xy(b);return Math.max(Math.abs(x-u),Math.abs(y-v));};
 const cells=a=>{const [x,y]=xy(a);return [sq(x,y),sq(x+1,y),sq(x,y+1),sq(x+1,y+1)];};
 const dirs=[[0,1],[1,0],[0,-1],[-1,0]];
 const jumps=[[1,2],[-2,-1],[2,-1],[-1,2],[-1,-2],[2,1],[-2,1],[1,-2]];
 const copy=v=>JSON.parse(JSON.stringify(v));
 const key=(g,s)=>g.get(s)?.giant?g.giantState.anchor:s;
 P.reset=function(setup={}){
  const result=base.reset.call(this,setup);
  this.giantState=null;
  if(this.boss==='giant'){
   for(const [s,p] of Object.entries(this.board))if(p.color==='b')delete this.board[s];
   this.giantState={anchor:'d7',phase:'step',plan:null,weakUntil:0};
   for(const s of cells('d7'))this.board[s]={type:'k',color:'b',hp:GIANT_HP,max:GIANT_HP,giant:true,giantAnchor:'d7',attack:0};
  }
  return result;
 };
 P.snapshot=function(){return {...base.snapshot.call(this),giantState:copy(this.giantState??null)};};
 P.giantCells=function(){return this.giantState?cells(this.giantState.anchor):[];};
 P.giantArea=function(anchor,kind,direction=0){
  const [x,y]=xy(anchor),body=new Set(cells(anchor)),out=[];
  if(kind==='stomp')for(let u=x-1;u<=x+2;u++)for(let v=y-1;v<=y+2;v++){const s=sq(u,v);if(s&&!body.has(s))out.push(s);}
  else{
   const [dx,dy]=dirs[direction];
   for(let d=1;d<=4;d++)for(let w=0;w<2;w++){
    const s=dx?sq(dx>0?x+1+d:x-d,y+w):sq(x+w,dy>0?y+1+d:y-d);if(s)out.push(s);
   }
  }
  return out;
 };
 P.giantInfo=function(){if(this.boss!=='giant'||!this.giantState)return null;const p=this.get(this.giantState.anchor);return {...copy(this.giantState),cells:this.giantCells(),hp:p?.giant?p.hp:0,maxHp:p?.giant?p.max:GIANT_HP,weak:this.giantState.weakUntil>this.ply};};
 P.burning=function(s,ply=this.ply){return this.boss==='giant'?false:base.burning.call(this,s,ply);};
 P.guards=function(s){return this.get(s)?.giant?0:base.guards.call(this,s);};
 P.damageTo=function(s,amount){return this.get(s)?.giant?amount+(amount>0&&this.giantState.weakUntil>this.ply?1:0):base.damageTo.call(this,s,amount);};
 P.attacks=function(from,to,board=this.board){return board[from]?.giant?false:base.attacks.call(this,from,to,board);};
 P.normals=function(s){return this.boss==='giant'&&this.side==='b'?[]:base.normals.call(this,s);};
 P.specials=function(s){return this.boss==='giant'&&this.side==='b'?[]:base.specials.call(this,s);};
 P.bossMoves=function(){
  if(this.boss!=='giant')return base.bossMoves.call(this);
  if(this.side!=='b'||this.isOver())return [];
  const state=this.giantState,from=state.anchor;
  if(state.phase!=='step')return [{bossAction:state.phase==='windup'?'giantWindup':'giantStrike',bossKind:'giant',from,to:from,area:state.plan.area,pattern:state.plan.kind,direction:state.plan.direction}];
  const [x,y]=xy(from),destinations=[];
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
   if(!dx&&!dy)continue;
   const a=sq(x+dx,y+dy);if(!a)continue;const body=cells(a);
   if(body.every(s=>s&&(!this.get(s)||this.get(s).giant)))destinations.push(a);
  }
  if(!destinations.length)destinations.push(from);
  const out=[];
  for(const to of destinations)for(const [kind,direction] of [['stomp',0],...dirs.map((_,i)=>['sweep',i])]){
   const area=this.giantArea(to,kind,direction);if(area.length)out.push({bossAction:'giantStep',bossKind:'giant',from,to,area,pattern:kind,direction});
  }
  return out;
 };
 P.chooseGiantMove=function(level='normal'){
  const moves=this.bossMoves();if(moves.length<=1)return moves[0]||null;
  const whites=Object.entries(this.board).filter(([,p])=>p.color==='w'),king=whites.find(([,p])=>p.type==='k')?.[0];
  const value={p:1,n:3,b:3,r:4,q:5,k:20};
  const score=m=>m.area.reduce((n,s)=>n+(this.get(s)?.color==='w'?value[this.get(s).type]:0),0)*2-(king?Math.min(...cells(m.to).map(s=>dist(s,king))):0)-Math.min(...whites.map(([s])=>dist(s,m.to)),8);
  moves.sort((a,b)=>score(b)-score(a)||a.to.localeCompare(b.to)||a.pattern.localeCompare(b.pattern));
  return level==='easy'?moves[Math.floor(Math.random()*Math.min(4,moves.length))]:moves[0];
 };
 P.chain=function(first,color){
  if(this.boss!=='giant')return base.chain.call(this,first,color);
  const path=[first],seen=new Set([key(this,first)]);let at=first;
  while(path.length<4){const [x,y]=xy(at);const next=jumps.map(([dx,dy])=>sq(x+dx,y+dy)).filter(s=>s&&this.get(s)?.color!==color&&this.get(s)&&!seen.has(key(this,s))).sort((a,b)=>this.get(a).hp-this.get(b).hp||a.localeCompare(b))[0];if(!next)break;path.push(next);seen.add(key(this,next));at=next;}
  return path;
 };
 P.impact=function(move){
  if(this.boss!=='giant')return base.impact.call(this,move);
  if(move.bossKind==='giant'){
   const damage=[],mirrored=[],area=move.area||[],state=this.giantState;
   if(move.bossAction==='giantStrike')for(const s of area){const p=this.get(s);if(p?.color!=='w')continue;const amount=state.plan.kind==='stomp'?3:4;
    if(p.mirrorUntil>this.ply){mirrored.push(s);damage.push({square:state.anchor,amount:this.damageTo(state.anchor,amount),reflected:true});}
    else damage.push({square:s,amount:this.damageTo(s,amount)});
   }
   const reflected=damage.filter(d=>d.reflected),others=damage.filter(d=>!d.reflected);
   if(reflected.length)others.push({...reflected[0],amount:Math.max(...reflected.map(d=>d.amount))});
   return {damage:others,heals:[],mirrored,landing:move.to,area,reveal:null,struck:null};
  }
  const result=base.impact.call(this,move),id=move.power?this.idOf(move):null;
  if(id==='quiet'&&move.mode==='snipe'){
   let strength=4;const seen=new Set();result.damage=[];result.mirrored=[];
   for(const s of move.area){const p=this.get(s);if(!p||seen.has(key(this,s)))continue;seen.add(key(this,s));
    if(p.color!==this.side&&p.mirrorUntil>this.ply){result.mirrored.push(s);result.damage.push({square:move.from,amount:this.damageTo(move.from,strength),reflected:true});}
    else result.damage.push({square:s,amount:this.damageTo(s,strength)});
    strength=Math.max(1,strength-1);
   }
  }
  const hits=result.damage.filter(d=>this.get(d.square)?.giant);
  result.damage=result.damage.filter(d=>!this.get(d.square)?.giant);
  if(hits.length)result.damage.push({...hits[0],square:this.giantState.anchor,amount:Math.max(...hits.map(d=>d.amount))});
  if(id==='gallop'&&this.get(result.landing)?.giant)result.landing=move.from;
  return result;
 };
 P.apply=function(action){
  if(this.boss!=='giant')return base.apply.call(this,action);
  let result;
  if(action?.bossKind==='giant'){
   const move=this.bossMoves().find(m=>m.from===action.from&&m.to===action.to&&m.bossAction===action.bossAction&&m.pattern===action.pattern&&m.direction===action.direction);
   if(!move)throw new Error('Недопустимое действие великана.');
   this.snapshots.push(this.snapshot());const impact=this.impact(move),captured=[],state=this.giantState;
   if(move.bossAction==='giantStep'){
    const p=this.get(state.anchor);for(const s of this.giantCells())delete this.board[s];state.anchor=move.to;
    for(const s of cells(move.to))this.board[s]={...p,giantAnchor:move.to};
    state.plan={kind:move.pattern,direction:move.direction,area:[...move.area]};state.phase='windup';
   }else if(move.bossAction==='giantWindup')state.phase='strike';
   else{
    for(const d of impact.damage){const p=this.get(d.square);if(!p)continue;p.hp-=d.amount;if(p.hp<=0){captured.push({square:d.square,...p});if(p.type!=='k')this.grave[p.color].push(p.type);delete this.board[d.square];}}
    for(const s of impact.mirrored)if(this.get(s))delete this.get(s).mirrorUntil;
    state.plan=null;state.phase='step';state.weakUntil=this.ply+2;
   }
   this.actions.push({...move});this.ep=null;this.pending=null;this.quiet=impact.damage.length?0:this.quiet+1;
   result={...move,id:null,color:'b',captured,revived:[],...impact,burn:[],bossResolved:move.bossAction==='giantStrike'};
   this.endCheck(captured);
   if(!this.isOver()){
    this.side='w';this.ply++;
    const held=['d4','e4','d5','e5'].filter(s=>this.get(s)?.color==='w').length;
    this.energy.w=Math.min(60,this.energy.w+8+Math.min(4,held*2));
    if(this.ply>=400||this.quiet>=100)this.draw=true;
   }
  }else result=base.apply.call(this,action);
  const anchor=this.giantState.anchor,p=this.board[anchor];
  for(const [s,q] of Object.entries(this.board))if(q.giant){if(!p?.giant)delete this.board[s];else{q.hp=p.hp;q.giantAnchor=anchor;}}
  return result;
 };
}
