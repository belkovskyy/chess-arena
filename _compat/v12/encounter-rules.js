// v11.1 design implementation. Kept separate so previous rules can remain frozen.
export function installEncounter(Battle,bosses,H){
 const {allSquares,step,attackOf,maxOf}=H,P=Battle.prototype;
 const base=Object.fromEntries(['reset','snapshot','impact','apply','damageTo','litSquares','hunterInfo','hunterRelocate','bossMoves','giantInfo','chooseGiantMove'].map(k=>[k,P[k]]));
 const copy=x=>JSON.parse(JSON.stringify(x)),distance=(a,b)=>Math.max(Math.abs(a.charCodeAt(0)-b.charCodeAt(0)),Math.abs(+a[1]-+b[1]));
 const directions=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
 const hides=['a4','h4','b6','g6','e7','c5'],adjacent=s=>directions.map(([x,y])=>step(s,x,y)).filter(Boolean);
 const body=a=>[a,step(a,1,0),step(a,0,1),step(a,1,1)];
 const active=g=>['hunter','giant'].includes(g.boss);
 const isBoss=(g,s)=>g.get(s)?.color==='b'&&(g.get(s)?.giant||g.boss==='hunter'&&g.get(s)?.type==='k');
 const line=(from,to)=>{let x=from.charCodeAt(0)-97,y=+from[1],tx=to.charCodeAt(0)-97,ty=+to[1];const dx=Math.abs(tx-x),dy=-Math.abs(ty-y),sx=x<tx?1:-1,sy=y<ty?1:-1;let err=dx+dy;const out=[];while(x!==tx||y!==ty){const e=2*err;if(e>=dy){err+=dy;x+=sx;}if(e<=dx){err+=dx;y+=sy;}out.push(String.fromCharCode(97+x)+y);}return out;};
 P.ensurePieceIds=function(){if(!active(this))return;for(const p of Object.values(this.board))if(!p.uid)p.uid='u'+this.nextPieceId++;};
 P.reset=function(setup={}){base.reset.call(this,setup);this.encounterVersion=12;this.matchDifficulty=setup.difficulty||'normal';this.nextPieceId=1;this.ensurePieceIds();this.hunterPhase='hunt';this.hunterPinnedTurns=0;this.hunterTemporaryDuel=false;this.hunterShotDamage=3;if(this.boss==='giant'){for(const p of Object.values(this.board))if(p.giant){p.hp=36;p.max=36;}this.giantState.chargeReady=0;}};
 P.snapshot=function(){return {...base.snapshot.call(this),encounterVersion:this.encounterVersion,matchDifficulty:this.matchDifficulty,nextPieceId:this.nextPieceId,hunterPhase:this.hunterPhase,hunterPinnedTurns:this.hunterPinnedTurns,hunterTemporaryDuel:this.hunterTemporaryDuel};};
 P.litSquares=function(viewer){if(this.boss!=='hunter'||viewer==='b')return base.litSquares.call(this,viewer);const out=new Set();for(const [s,p]of Object.entries(this.board)){if(p.color===viewer){const radius=p.type==='k'?2:1;for(let x=-radius;x<=radius;x++)for(let y=-radius;y<=radius;y++){const q=step(s,x,y);if(q)out.add(q);}}if(p.revealUntil>this.ply||p.hunterRevealUntil>this.ply)out.add(s);}if(this.hunterFlushed||this.hunterTemporaryDuel){const s=this.hunterSquare();if(s)out.add(s);}return out;};
 P.hunterOpenHides=function(){return this.boss!=='hunter'?[]:hides.filter(s=>!this.burning(s)&&![s,...adjacent(s)].some(q=>this.visible(q,'b')?.color==='w')&&(!this.visible(s,'b')||this.visible(s,'b')?.color==='b'&&this.visible(s,'b')?.type==='k'));};
 P.hunterDestinations=function(from=this.hunterSquare()){const range=this.hunterPinnedTurns>=2?4:3;return from?this.hunterOpenHides().filter(s=>s!==from&&distance(s,from)<=range):[];};
 P.hunterCanStep=function(){return this.hunterFlushed||this.hunterTemporaryDuel||this.hunterShotTurn!==this.ply&&(this.hunterCorneredUntil>this.ply||this.hunterPhase==='hunt'&&!this.hunterDestinations().length);};
 P.hunterForced=function(){const from=this.hunterSquare();return this.boss==='hunter'&&this.side==='b'&&!this.hunterFlushed&&this.hunterShotTurn!==this.ply&&from&&(this.hunterPhase==='retreat'||this.hunterTemporaryDuel||!this.hunterOpenHides().includes(from))&&this.hunterDestinations(from).length>0;};
 P.hunterInfo=function(){const info=base.hunterInfo.call(this);return {...info,hides:[...hides],phase:this.hunterPhase,temporaryDuel:this.hunterTemporaryDuel,pinnedTurns:this.hunterPinnedTurns,escapeCandidates:this.hunterPhase==='window'?this.hunterDestinations():[],visionRadius:1};};
 P.hunterMoves=function(){
  if(this.boss!=='hunter'||this.side!=='b'||this.isOver()||this.pending)return [];
  const from=this.hunterSquare();if(!from)return [];const out=[];
  if(this.hunterShotTurn!==this.ply){
   if(!this.hunterFlushed)for(const to of this.hunterDestinations(from))out.push({hunter:'relocate',from,to});
   const mayAim=this.hunterFlushed||this.hunterTemporaryDuel||this.hunterPhase==='hunt'&&this.hunterCorneredUntil<=this.ply;
   if(!this.hunterForced()&&mayAim&&this.ply>=this.hunterReadyAt)for(const [dx,dy]of directions){const path=this.ray(from,dx,dy),i=path.findIndex(s=>this.visible(s,'b')),victim=this.visible(path[i],'b');if(i<0||victim?.color!=='w')continue;if((i>=1||victim.furyMarked)&&(i<4||victim.furyMarked))out.push({hunter:'aim',from,to:path[i],direction:[dx,dy],cells:path.slice(0,i).slice(-2),range:victim.furyMarked?7:4});}
  }
  if(!out.length&&!this.normals().length)out.push({hunter:'wait',from,to:from});return out;
 };
 P.hunterRelocate=function(to,result){const success=base.hunterRelocate.call(this,to,result);if(success){this.hunterPhase='hunt';this.hunterPinnedTurns=0;this.hunterTemporaryDuel=false;this.hunterCorneredUntil=0;this.hunterReadyAt=this.ply+2;this.hunterAim=null;}return success;};
 P.hunterStartTurn=function(result,damageAll){
  if(this.boss!=='hunter'||this.side!=='b'||this.isOver())return;
  let from=this.hunterSquare();if(!from)return;
  if(hides.every(s=>this.burning(s))){this.hunterFlushed=true;this.hunterTemporaryDuel=false;this.hunterPhase='duel';}
  if(this.hunterAim?.from){
   const aim=this.hunterAim;this.hunterAim=null;
   if(aim.from===from){
    const ray=this.ray(from,...aim.direction).slice(0,aim.range||4),target=ray.find(s=>this.get(s)),path=target?ray.slice(0,ray.indexOf(target)+1):ray,damage=[],mirrored=[];
    if(target){const v=this.get(target);if(v.color==='w'&&v.mirrorUntil>this.ply){mirrored.push(target);damage.push({square:from,amount:this.damageTo(from,3),reflected:true});delete v.mirrorUntil;}else damage.push({square:target,amount:this.damageTo(target,3)});}
    const before=result.captured.length;damageAll(damage);this.quiet=0;this.energy.b=Math.min(60,this.energy.b+Math.min(12,result.captured.slice(before).filter(p=>p.color==='w').length*4));
    for(const d of damage)if(this.get(d.square))this.get(d.square).revealUntil=this.ply+2;
    this.endCheck(result.captured.slice(before));this.hunterShotTurn=this.ply;this.hunterReadyAt=this.ply+4;
    if(this.get(from))this.get(from).hunterRevealUntil=this.ply+3;
    const candidates=this.hunterFlushed?[]:this.hunterDestinations(from);
    this.hunterIntel={source:from,path,candidates:[...candidates],expiresAt:this.ply+4};
    result.hunterShot={from,path,damage,captured:result.captured.slice(before),mirrored,candidates:[...candidates],miss:!target};
    this.hunterPhase=this.hunterFlushed||this.hunterTemporaryDuel?'duel':'window';return;
   }
  }
  if(this.hunterPhase==='window')this.hunterPhase='retreat';
  if(this.hunterFlushed){this.get(from).hunterRevealUntil=this.ply+3;return;}
  const destinations=this.hunterDestinations(from),blocked=this.hunterPhase==='retreat'||!this.hunterOpenHides().includes(from);
  if(blocked&&!destinations.length){
   this.hunterPinnedTurns++;this.hunterCorner(result);
   if(this.hunterPinnedTurns>=2){this.hunterTemporaryDuel=true;this.hunterPhase='duel';this.hunterCorneredUntil=0;}
  }
  if(this.hunterTemporaryDuel)this.get(from).hunterRevealUntil=this.ply+3;
 };
 // Damage rules are evaluated before landing, so a surviving target cannot accidentally be overrun.
 P.bossDamageReasons=function(square,source=this._damageSource){
  if(!active(this)||!isBoss(this,square)||!source||source.color!=='w')return [];
  const reasons=[],turn=Math.floor(this.ply/2),p=source.piece;
  if(this.get(square)?.giant){const weak=this.giantState.weakUntil>this.ply;if(weak)reasons.push('выдохся +1');else if(Math.min(...this.giantCells().map(s=>distance(source.square,s)))>1)reasons.push('−2 кожа');}
  if(p?.lastBossHitTurn!==undefined&&p.lastBossHitTurn>=turn-1)reasons.push('повтор −1');return reasons;
 };
 P.damageTo=function(square,amount){let dealt=base.damageTo.call(this,square,amount);if(amount<=0)return dealt;const reasons=this.bossDamageReasons(square);if(reasons.includes('−2 кожа'))dealt-=2;if(reasons.includes('повтор −1'))dealt--;return Math.max(1,dealt);};
 P.impact=function(move){
  if(move.bossKind==='giant')return this.giantImpactV12(move);
  const previous=this._damageSource,p=this.get(move.from);this._damageSource={square:move.from,color:p?.color,piece:p};
  try{const impact=base.impact.call(this,move);for(const d of impact.damage){const reasons=this.bossDamageReasons(d.square);if(reasons.length)d.reasons=reasons;}return impact;}finally{this._damageSource=previous;}
 };
 P.apply=function(action){
  this.ensurePieceIds();const mover=this.get(action?.from),uid=mover?.uid,white=this.side==='w',turn=Math.floor(this.ply/2);
  const oldMarks=Object.values(this.board).filter(p=>p.furyMarked).map(p=>p.uid);
  const bossSquares=active(this)&&white?new Set(Object.keys(this.board).filter(s=>isBoss(this,s))):new Set();
  const result=this.boss==='giant'&&action?.bossKind==='giant'?this.applyGiantV12(action):base.apply.call(this,action);
  if(result.damage.some(d=>d.amount>0&&bossSquares.has(d.square)&&!d.counter&&!d.reflected)){const survivor=Object.values(this.board).find(p=>p.uid===uid);if(survivor){survivor.furyMarked=true;survivor.lastBossHitTurn=turn;}}
  if(action?.hunter==='aim'){
   if(this.hunterAim){const target=this.get(this.hunterAim.target);this.hunterAim.range=target?.furyMarked?7:4;}
  }
  if(action?.hunter==='aim'||action?.bossAction==='giantStep'||action?.bossAction==='giantChargePrepare')for(const p of Object.values(this.board))if(oldMarks.includes(p.uid))delete p.furyMarked;
  this.ensurePieceIds();return result;
 };
 P.giantEnraged=function(){const p=this.get(this.giantState?.anchor);return Boolean(p?.giant&&p.hp<=p.max/2);};
 P.giantInfo=function(){const info=base.giantInfo.call(this);return info?{...info,strikeDamage:{stomp:4,sweep:5,throw:3,charge:2},skin:!info.weak,version:12}:null;};
 P.giantThrowPath=function(anchor,target){const source=body(anchor).filter(Boolean).sort((a,b)=>distance(a,target)-distance(b,target)||a.localeCompare(b))[0];return line(source,target).filter(s=>!body(anchor).includes(s));};
 P.giantChargePath=function(anchor,dx,dy){const path=[];for(let n=1;n<=2;n++){const a=step(anchor,dx*n,dy*n);if(!a||body(a).some(s=>!s))break;path.push(a);}return path;};
 P.bossMoves=function(){
  if(this.boss!=='giant')return base.bossMoves.call(this);
  if(this.side!=='b'||this.isOver())return [];
  const state=this.giantState,from=state.anchor;
  if(state.phase!=='step')return [{bossAction:state.phase==='windup'?'giantWindup':state.phase==='charge'?'giantCharge':'giantStrike',bossKind:'giant',from,to:state.plan.destination||from,area:state.plan.area,pattern:state.plan.kind,direction:state.plan.direction}];
  const out=base.bossMoves.call(this),positions=[...new Set([from,...out.map(m=>m.to)])];
  for(const to of positions)for(const [target,p]of Object.entries(this.board))if(p.color==='w'&&p.furyMarked){const area=this.giantThrowPath(to,target);if(area.length)out.push({bossAction:'giantStep',bossKind:'giant',from,to,area,pattern:'throw',direction:target});}
  if(this.giantEnraged()&&this.ply>=(state.chargeReady||0))for(const [index,[dx,dy]]of directions.slice(0,4).entries()){
   const path=this.giantChargePath(from,dx,dy);if(!path.length)continue;
   const area=[...new Set(path.flatMap(body))].filter(s=>!body(from).includes(s));
   out.push({bossAction:'giantChargePrepare',bossKind:'giant',from,to:path.at(-1),area,pattern:'charge',direction:index,path});
  }
  const charges=out.filter(m=>m.bossAction==='giantChargePrepare');
  return out;
 };
 P.giantImpactV12=function(move){
  const state=this.giantState,damage=[],mirrored=[],area=move.area||[];let landing=move.bossAction==='giantStep'&&!body(move.to).some(s=>this.get(s)&&!this.get(s).giant)?move.to:state.anchor;
  const hit=(square,amount)=>{const p=this.get(square);if(!p||p.giant)return;if(p.mirrorUntil>this.ply){mirrored.push(square);damage.push({square:state.anchor,amount:this.damageTo(state.anchor,amount),reflected:true});}else damage.push({square,amount:this.damageTo(square,amount)});};
  if(move.bossAction==='giantStrike'){
   if(state.plan.kind==='throw'){const s=area.find(s=>this.get(s)&&!this.get(s).giant);if(s)hit(s,3);}
   else for(const s of area)if(this.get(s)?.color==='w')hit(s,state.plan.kind==='stomp'?4:5);
  }
  if(move.bossAction==='giantCharge'){
   const seen=new Set();for(const anchor of state.plan.path){let blocked=false;for(const s of body(anchor)){const p=this.get(s);if(!p||p.giant||seen.has(s))continue;seen.add(s);hit(s,2);const d=damage.find(d=>d.square===s&&!d.reflected);if(!d||p.hp>d.amount)blocked=true;}if(blocked)break;landing=anchor;}
  }
  const reflected=damage.filter(d=>d.reflected);const hits=damage.filter(d=>!d.reflected);if(reflected.length)hits.push({...reflected[0],amount:Math.max(...reflected.map(d=>d.amount))});
  return {damage:hits,heals:[],mirrored,landing,area,reveal:null,struck:null};
 };
 P.applyGiantV12=function(action){
  const move=this.view(this.side).bossMoves().find(m=>m.from===action.from&&m.to===action.to&&m.bossAction===action.bossAction&&m.pattern===action.pattern&&m.direction===action.direction);
  if(!move)throw new Error('Недопустимое действие великана.');
  this.snapshots.push(this.snapshot());const state=this.giantState,impact=this.impact(move),captured=[],oldCells=this.giantCells(),giant=this.get(state.anchor);
  if(move.bossAction==='giantStep'){
   const blockers=body(move.to).filter(s=>this.get(s)&&!this.get(s).giant);
   if(blockers.length){for(const s of blockers){delete this.get(s).invisibleUntil;this.get(s).revealUntil=this.ply+3;}impact.landing=state.anchor;impact.blocked=true;}
   else{for(const s of oldCells)delete this.board[s];state.anchor=move.to;for(const s of body(move.to))this.board[s]={...giant,giantAnchor:move.to};}
   const area=move.pattern==='throw'?this.giantThrowPath(state.anchor,move.direction):this.giantArea(state.anchor,move.pattern,move.direction);
   state.plan={kind:move.pattern,direction:move.direction,area,fast:false};state.phase='windup';
  }else if(move.bossAction==='giantChargePrepare'){
   state.plan={kind:'charge',direction:move.direction,area:[...move.area],path:[...move.path],destination:move.to};state.phase='charge';
  }else if(move.bossAction==='giantWindup')state.phase='strike';
  else{
   for(const d of impact.damage){const p=this.get(d.square);if(!p)continue;p.hp-=d.amount;if(p.hp<=0){captured.push({square:d.square,...p});if(p.type!=='k')this.grave[p.color].push(p.type);delete this.board[d.square];}}
   for(const s of impact.mirrored)if(this.get(s))delete this.get(s).mirrorUntil;
   if(giant.hp<=0){for(const s of oldCells)delete this.board[s];}
   else{for(const s of oldCells)delete this.board[s];state.anchor=impact.landing;for(const s of body(state.anchor))this.board[s]={...giant,giantAnchor:state.anchor};}
   if(move.bossAction==='giantCharge'&&giant.hp>0){
    state.chargeReady=this.ply+6;
    const plans=[['stomp',0],['sweep',0],['sweep',1],['sweep',2],['sweep',3]].map(([kind,direction])=>({kind,direction,area:this.giantArea(state.anchor,kind,direction)}));
    plans.sort((a,b)=>b.area.reduce((n,s)=>n+(this.visible(s,'b')?.color==='w'?worth[this.visible(s,'b').type]:0),0)-a.area.reduce((n,s)=>n+(this.visible(s,'b')?.color==='w'?worth[this.visible(s,'b').type]:0),0));
    state.plan=plans[0];state.phase='windup';state.weakUntil=0;
   }else{state.phase='step';state.plan=null;state.weakUntil=this.ply+2;}
  }
  this.actions.push({...move});this.ep=null;this.pending=null;this.quiet=impact.damage.length?0:this.quiet+1;this.endCheck(captured);
  const result={...move,...impact,id:null,color:'b',captured,revived:[],burn:[],bossResolved:['giantStrike','giantCharge'].includes(move.bossAction)};
  if(!this.isOver()){this.side='w';this.ply++;const held=['d4','e4','d5','e5'].filter(s=>this.get(s)?.color==='w').length;this.energy.w=Math.min(60,this.energy.w+8+Math.min(4,held*2));if(this.ply>=240||this.quiet>=80)this.draw=true;}
  return result;
 };
 const worth={p:1,n:3,b:3,r:5,q:7,k:25};
 P.chooseHunterMove=function(level='normal',history=this){
  const g=this.view('b'),moves=[...g.normals(),...g.specials(),...g.hunterMoves()];
  if(!moves.length)return null;
  const king=g.hunterSquare(),white=Object.entries(g.board).filter(([,p])=>p.color==='w');
  const incoming=(board,s)=>Math.max(0,...Object.entries(board.board).filter(([,p])=>p.color==='w').filter(([from])=>board.attacks(from,s)).map(([,p])=>board.damageTo(s,attackOf(p))));
  const danger=incoming(g,king),ranked=[];
  for(const move of moves){
   const next=Object.assign(Object.create(Battle.prototype),g.snapshot(),{actions:[],snapshots:[]});const result=next.apply(move);
   if(next.winner==='b')return move;
   const at=next.hunterSquare(),boss=next.get(at);if(!boss)continue;
   const exposed=next.visible(at,'w'),risk=exposed?incoming(next,at):0;
   const repeats=(history.snapshots||[]).slice(-16).filter(s=>s.side==='b'&&s.board[at]?.color==='b'&&s.board[at]?.type==='k').length;
   let score=-repeats*6;
   if(next.burning(at,next.ply+1)){const safeDistance=Math.min(8,...allSquares.filter(s=>!next.burning(s,next.ply+3)).map(s=>distance(at,s)));score-=safeDistance*2000;if(boss.hp<=safeDistance)score-=30000;}
   for(const d of result.damage){const p=g.get(d.square);if(p)score+=(p.color==='w'?1:-1.3)*worth[p.type]*Math.min(d.amount,p.hp)/p.hp*12;}
   for(const h of result.heals){const p=g.get(h.square);if(p)score+=(p.color==='b'?1:-1)*h.amount*2;}
   score-=risk*14+(risk>=boss.hp?10000:0)+(next.burning(at,next.ply+1)?(boss.hp<=1?30000:500):0);
   if(move.hunter==='aim'){
    const victim=g.get(move.to),cost=worth[victim.type],guard=g.damageTo(move.to,3),range=victim.furyMarked?7:4;
    const threat=cost*Math.min(1,guard/victim.hp);
    score+=18+threat*9;
    if(exposed&&risk)score-=50+risk*10;
    if(g.burning(king,g.ply+4))score-=600;
    if(level==='hard'){
     const plan=new Set(g.ray(move.from,...move.direction).slice(0,range));
     const view=Object.assign(Object.create(Battle.prototype),next.snapshot(),{side:'w'});
     const exits=view.normals(move.to).filter(m=>!plan.has(m.to)&&!view.get(m.to));
     const blocks=view.normals().filter(m=>m.from!==move.to&&plan.has(m.to)&&!view.get(m.to));
     score+=exits.length?0:cost*.6;score+=blocks.length?0:.9;
     const wolves=Object.entries(g.board).filter(([,p])=>p.color==='b'&&p.variant==='wolf');
     score+=exits.filter(m=>wolves.some(([s])=>g.attacks(s,m.to))).length*.3;
    }
   }else if(move.hunter==='relocate'){
    score+=danger?20: -8;
    score+=Math.min(7,...white.map(([s])=>distance(s,at)))*1.5;
    if(level==='hard'){
     score+=next.hunterDestinations(at).length*.45-incoming(next,at)*.75;
     const aimNext=Object.assign(Object.create(Battle.prototype),next.snapshot(),{side:'b',ply:next.ply+1});
     score+=aimNext.hunterMoves().filter(m=>m.hunter==='aim').length*.75;
    }
   }else if(move.hunter==='wait')score-=30;
   else{
    const mover=next.get(result.landing);if(mover?.color==='b'&&mover.type==='k'){const enemyKing=white.find(([,p])=>p.type==='k')?.[0];if(enemyKing)score-=distance(result.landing,enemyKing)*2;}if(mover?.color==='b'&&mover.type!=='k'){
     const loss=incoming(next,result.landing);score-=loss>=mover.hp?worth[mover.type]*12:loss*2;
     if(level==='hard'&&mover.variant==='wolf')score+=hides.filter(s=>distance(s,result.landing)<=2).length*.3;
    }
   }
   ranked.push({move,score,burning:next.burning(at,next.ply+1)});
  }
  const safe=ranked.filter(r=>!r.burning),choices=safe.length?safe:ranked;choices.sort((a,b)=>b.score-a.score);return choices[level==='easy'?Math.floor(Math.random()*Math.min(4,choices.length)):0]?.move||moves[0];
 };

 P.chooseGiantMove=function(level='normal'){
  const moves=this.bossMoves();if(moves.length<2)return moves[0]||null;
  const whites=Object.entries(this.board).filter(([,p])=>p.color==='w'),king=whites.find(([,p])=>p.type==='k')?.[0];
  const scored=moves.map(move=>{
   const zone=new Set(move.area),preview=Object.assign(Object.create(Battle.prototype),this.snapshot(),{actions:[],snapshots:[]});preview.apply(move);
   const affected=move.pattern==='throw'?move.area.filter(s=>this.get(s)&&!this.get(s).giant).slice(0,1):move.area;
   const damage={throw:3,charge:2,stomp:4,sweep:5}[move.pattern];let threat=0;const escapes=[];
   const exits=level==='hard'?preview.normals():[];
   for(const [s,p]of whites)if(affected.includes(s)){const risk=worth[p.type]*(p.hp<=damage?1.5:damage/p.hp);threat+=risk;if(exits.some(m=>m.from===s&&!preview.get(m.to)&&!zone.has(m.to)))escapes.push(risk);}
   escapes.sort((a,b)=>b-a);const turns=move.pattern==='charge'?1:2;
   if(level==='hard')threat-=escapes.slice(0,turns).reduce((a,b)=>a+b,0)*.65;
   const anchor=['giantStep','giantChargePrepare'].includes(move.bossAction)?move.to:this.giantState.anchor,range=king?Math.min(...body(anchor).map(s=>distance(s,king))):0;
   const safeAttackers=whites.filter(([s])=>!zone.has(s)&&body(anchor).some(t=>preview.attacks(s,t))).reduce((n,[,p])=>n+worth[p.type],0);
   const incoming=whites.filter(([s])=>body(anchor).some(t=>preview.attacks(s,t))).map(([s,p])=>{
    const melee=Math.min(...body(anchor).map(t=>distance(s,t)))<=1;
    return Math.max(1,attackOf(p)-(melee?0:2))*(zone.has(s)?.45:1);
   }).sort((a,b)=>b-a).slice(0,2).reduce((a,b)=>a+b,0);
   // A charge costs one response, while the other attacks cost two. Pressure per response matters.
   const tempo=move.pattern==='charge'?1.8:1;
   const marked=move.pattern==='throw'?whites.find(([s])=>move.direction===s):null;
   const punish=marked?worth[marked[1].type]*.9:0;
   return {move,score:threat*3*tempo-range*.8-(level==='hard'?incoming*3+safeAttackers*.3:incoming*.6)+punish+(move.pattern==='charge'?8:0)};
  }).sort((a,b)=>b.score-a.score||a.move.to.localeCompare(b.move.to));
  if(level==='hard'){
   const clone=g=>Object.assign(Object.create(Battle.prototype),g.snapshot(),{actions:[],snapshots:[]});
   const utility=g=>{if(g.winner)return g.winner==='b'?1e6:-1e6;let score=(g.giantInfo()?.hp||0)*4;for(const p of Object.values(g.board))if(p.color==='w')score-=p.type==='k'?p.hp*5+100:worth[p.type]*(.3+.7*p.hp/maxOf(p))*5;return score;};
   const response=g=>{
    let best=null,score=Infinity;
    for(const m of [...g.normals(),...g.specials()]){
     const n=clone(g);n.apply(m);let value=utility(n);
     if(!n.isOver()&&n.side==='b'&&['strike','charge'].includes(n.giantState.phase)){const resolved=clone(n);resolved.apply(resolved.bossMoves()[0]);value=utility(resolved);}
     if(value<score){score=value;best=n;}
    }
    return best;
   };
   let best=scored[0].move,bestValue=-Infinity;
   const shortlist=scored.slice(0,7);
   for(const kind of ['throw','stomp','sweep']){const r=scored.find(r=>r.move.pattern===kind);if(r&&!shortlist.includes(r))shortlist.push(r);}
   for(const row of shortlist){
    let n=clone(this);n.apply(row.move);
    const replies=row.move.pattern==='charge'?1:2;
    for(let turn=0;turn<replies&&!n.isOver();turn++){
     let budget=4;while(n.side==='w'&&!n.isOver()&&budget--){const answer=response(n);if(!answer)break;n=answer;}
     if(n.side==='b'&&!n.isOver())n.apply(n.bossMoves()[0]);
    }
    const value=utility(n)*.15+row.score;
    if(value>bestValue){bestValue=value;best=row.move;}
   }
   return best;
  }
  return scored[level==='easy'?Math.floor(Math.random()*Math.min(5,scored.length)):0].move;
 };
 bosses.hunter.text='18 HP, два волка и четыре пешки. Прицел → выстрел на 3 → окно для атаки → уход. Обзор фигур 1, короля 2 клетки.';
 bosses.hunter.lore='После выстрела Охотник открыт на один твой ход. Перекрой лёжки, чтобы задержать уход. Загнанный через два хода переходит во временную дуэль; когда лёжка освободится, скрывается. Ярость позволяет прицелиться в ударившую фигуру на любой дистанции по прямой или диагонали. Повторный удар одной фигурой слабее на 1.';
 bosses.giant.text='Тело 2×2, 36 HP. Каменная кожа: издалека −2 урона, вплотную полный. После удара кожа снята и +1 урона по нему. Бросок по отмеченному стрелку.';
 bosses.giant.lore='Шаг → замах → удар: два твоих ответа. Бросок останавливает первая фигура на линии. При 18 HP доступен Рывок: предупреждение за один ход, по 2 урона на пути, остановка перед выжившими. После основного удара окно слабости. Рывок заменяет шаг и готовит основной удар. Повторный удар одной фигурой слабее на 1.';
}
