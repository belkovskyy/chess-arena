import {tuning} from './tuning.js';
// v11.1 design implementation. Kept separate so previous rules can remain frozen.
export function installEncounter(Battle,bosses,H){
 const {allSquares,step,attackOf,maxOf}=H,P=Battle.prototype;
 const base=Object.fromEntries(['normals','attacks','view','reset','snapshot','impact','apply','damageTo','litSquares','hunterInfo','hunterRelocate','bossMoves','giantInfo','chooseGiantMove'].map(k=>[k,P[k]]));
 const copy=x=>JSON.parse(JSON.stringify(x)),distance=(a,b)=>Math.max(Math.abs(a.charCodeAt(0)-b.charCodeAt(0)),Math.abs(+a[1]-+b[1]));
 const directions=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
 const hides=['a4','h4','b6','g6','e7','c5'],adjacent=s=>directions.map(([x,y])=>step(s,x,y)).filter(Boolean);
 const body=a=>[a,step(a,1,0),step(a,0,1),step(a,1,1)];
 const active=g=>['hunter','giant'].includes(g.boss);
 const isBoss=(g,s)=>g.get(s)?.color==='b'&&(g.get(s)?.giant||g.boss==='hunter'&&g.get(s)?.type==='k');
 const line=(from,to)=>{let x=from.charCodeAt(0)-97,y=+from[1],tx=to.charCodeAt(0)-97,ty=+to[1];const dx=Math.abs(tx-x),dy=-Math.abs(ty-y),sx=x<tx?1:-1,sy=y<ty?1:-1;let err=dx+dy;const out=[];while(x!==tx||y!==ty){const e=2*err;if(e>=dy){err+=dy;x+=sx;}if(e<=dx){err+=dx;y+=sy;}out.push(String.fromCharCode(97+x)+y);}return out;};
 P.ensurePieceIds=function(){if(!active(this))return;for(const p of Object.values(this.board))if(!p.uid)p.uid='u'+this.nextPieceId++;};
 P.reset=function(setup={}){base.reset.call(this,setup);if(this.boss==='hunter')for(const [s,p]of Object.entries(this.board))if(p.color==='w'&&!['b2','d2','f2','c1','d1','e1','g1','h1'].includes(s))delete this.board[s];this.encounterVersion=13;this.projectedFor=null;this.hiddenUnknown=false;this.matchDifficulty=setup.difficulty||'normal';this.nextPieceId=1;this.ensurePieceIds();this.hunterPhase='hunt';this.hunterBraceTurn=-1;this.hunterPinnedTurns=0;this.hunterTemporaryDuel=false;this.hunterShotDamage=3;if(this.boss==='giant'){for(const p of Object.values(this.board))if(p.giant){p.hp=36;p.max=36;}this.giantState.chargeReady=0;}};
 P.snapshot=function(){return {...base.snapshot.call(this),encounterVersion:this.encounterVersion,projectedFor:this.projectedFor,hiddenUnknown:this.hiddenUnknown,matchDifficulty:this.matchDifficulty,hunterBraceTurn:this.hunterBraceTurn,nextPieceId:this.nextPieceId,hunterPhase:this.hunterPhase,hunterPinnedTurns:this.hunterPinnedTurns,hunterTemporaryDuel:this.hunterTemporaryDuel};};
 P.view=function(viewer){const g=base.view.call(this,viewer);g.projectedFor=viewer;g.hiddenUnknown=this.hiddenUnknown||Object.keys(g.board).length<Object.keys(this.board).length;if(viewer==='w'&&this.hunterAim){const publicAim=a=>({target:a.target,direction:a.direction,cells:a.cells,damage:a.damage});g.hunterAim=this.visible(this.hunterAim.from,'w')?copy(this.hunterAim):{...publicAim(this.hunterAim),...(this.hunterAim.extra?{extra:publicAim(this.hunterAim.extra)}:{})};}return g;};
 P.litSquares=function(viewer){if(this.boss!=='hunter'||viewer==='b')return base.litSquares.call(this,viewer);const out=new Set();for(const [s,p]of Object.entries(this.board)){if(p.color===viewer){const radius=p.type==='k'?2:1;for(let x=-radius;x<=radius;x++)for(let y=-radius;y<=radius;y++){const q=step(s,x,y);if(q)out.add(q);}}if(p.revealUntil>this.ply||p.hunterRevealUntil>this.ply)out.add(s);}if(this.hunterFlushed||this.hunterTemporaryDuel){const s=this.hunterSquare();if(s)out.add(s);}return out;};
 P.hunterBowActive=function(){return this.boss==='hunter'&&(this.hunterFlushed||this.hunterTemporaryDuel);};
 P.attacks=function(from,to,board=this.board){if(!from||!to)return false;const p=board[from];if(this.boss==='hunter'&&p?.color==='b'&&p.type==='k'&&distance(from,to)<=4){const dx=to.charCodeAt(0)-from.charCodeAt(0),dy=+to[1]-+from[1];if((!dx||!dy||Math.abs(dx)===Math.abs(dy))&&line(from,to).slice(0,-1).every(s=>!board[s]))return true;}return base.attacks.call(this,from,to,board);};
 P.normals=function(square){const moves=base.normals.call(this,square);if(this.side!=='b'||!this.hunterBowActive()||this.hunterShotTurn===this.ply||this.hunterForced()||this.isOver())return moves;const from=this.hunterSquare();if(!from||square&&square!==from)return moves;for(const [to,p]of Object.entries(this.board))if(p.color==='w'&&distance(from,to)>1&&this.attacks(from,to))moves.push({from,to,bow:true});return moves;};
 P.hunterOpenHides=function(){return this.boss!=='hunter'?[]:hides.filter(s=>!this.burning(s)&&!Object.entries(this.board).some(([q,p])=>p.color==='w'&&this.visible(q,'b')&&distance(s,q)<=(p.type==='k'?2:1))&&(!this.visible(s,'b')||this.visible(s,'b')?.color==='b'&&this.visible(s,'b')?.type==='k'));};
 P.hunterDestinations=function(from=this.hunterSquare()){const range=this.hunterPinnedTurns>=2?4:3;return from?this.hunterOpenHides().filter(s=>s!==from&&distance(s,from)<=range):[];};
 P.hunterCanStep=function(){return this.hunterFlushed||this.hunterTemporaryDuel||this.hunterShotTurn!==this.ply&&(this.hunterCorneredUntil>this.ply||this.hunterPhase==='hunt'&&!this.hunterDestinations().length);};
 P.hunterForced=function(){const from=this.hunterSquare();return this.boss==='hunter'&&this.side==='b'&&!this.hunterFlushed&&this.hunterShotTurn!==this.ply&&from&&(this.hunterPhase==='retreat'||this.hunterTemporaryDuel||!this.hunterOpenHides().includes(from))&&this.hunterDestinations(from).length>0;};
 P.hunterInfo=function(){const info=base.hunterInfo.call(this);return {...info,version:13,braced:this.hunterBraceTurn===Math.floor(this.ply/2),cover:!this.hunterFlushed&&!this.hunterTemporaryDuel&&this.hunterCorneredUntil<=this.ply&&hides.includes(this.hunterSquare()),extraAim:this.hunterAim?.extra?{target:this.hunterAim.extra.target,cells:[...this.hunterAim.extra.cells],direction:[...this.hunterAim.extra.direction],damage:3}:null,hides:[...hides],phase:this.hunterPhase,temporaryDuel:this.hunterTemporaryDuel,pinnedTurns:this.hunterPinnedTurns,escapeCandidates:this.hunterPhase==='window'?this.hunterDestinations():[],visionRadius:1};};
 P.hunterMoves=function(){
  if(this.boss!=='hunter'||this.side!=='b'||this.isOver()||this.pending)return [];
  const from=this.hunterSquare();if(!from)return [];const out=[];
  if(this.hunterShotTurn!==this.ply){
   if(!this.hunterFlushed)for(const to of this.hunterDestinations(from)){out.push({hunter:'relocate',from,to});if(tuning.hunterRetreatAim)for(const aim of this.hunterAimOptions(to))out.push({hunter:'relocate',from,to,via:aim.to,...(aim.secondary?{secondary:aim.secondary}:{})});}
   const mayAim=this.hunterFlushed||this.hunterTemporaryDuel||this.hunterPhase==='hunt'&&this.hunterCorneredUntil<=this.ply;
   if(!this.hunterForced()&&mayAim&&this.ply>=this.hunterReadyAt)out.push(...this.hunterAimOptions(from));
  }
  if(!out.length&&!this.view('b').normals().length)out.push({hunter:'wait',from,to:from});return out;
 };
 P.hunterAimOptions=function(from){
  const out=[];for(const [target,p]of Object.entries(this.board)){
   if(p.color!=='w'||!this.visible(target,'b'))continue;
   const dx=target.charCodeAt(0)-from.charCodeAt(0),dy=+target[1]-+from[1],range=p.furyMarked?7:4;
   if(distance(from,target)>range||(!tuning.hunterAnyAngle&&dx&&dy&&Math.abs(dx)!==Math.abs(dy)))continue;
   const path=line(from,target),first=path.find(q=>q!==this.hunterSquare()&&this.visible(q,'b'));
   if(first!==target)continue;
   out.push({hunter:'aim',from,to:target,direction:[Math.sign(dx),Math.sign(dy)],cells:path.slice(0,-1).slice(-2),path,range});
  }const singles=[...out];for(const m of singles)for(const second of singles)if(second.to!==m.to&&this.get(second.to)?.furyMarked)out.push({...m,secondary:second.to});return out;
 };
 P.hunterRelocate=function(to,result){const success=base.hunterRelocate.call(this,to,result);if(success){this.hunterPhase='hunt';this.hunterPinnedTurns=0;this.hunterTemporaryDuel=false;this.hunterCorneredUntil=0;this.hunterReadyAt=this.ply+2;this.hunterAim=null;delete this.get(to).attack;}return success;};
 P.hunterStartTurn=function(result,damageAll){
  if(this.boss!=='hunter'||this.side!=='b'||this.isOver())return;
  if(this.hunterAim&&!this.hunterAim.from){
   const aim=this.hunterAim;this.hunterAim=null;const count=result.captured.length,damage=[];
   for(const arrow of [aim,aim.extra].filter(Boolean)){const target=[...arrow.cells,arrow.target].find(q=>this.get(q));if(target){const p=this.get(target);if(p.mirrorUntil>this.ply)delete p.mirrorUntil;else damage.push({square:target,amount:Math.max(1,(arrow.damage||3)-(p.trenchUntil>this.ply?1:0))});}}
   damageAll(damage);this.endCheck(result.captured.slice(count));return;
  }
  let from=this.hunterSquare();if(!from)return;
  if(hides.every(s=>this.burning(s))){this.hunterFlushed=true;this.hunterTemporaryDuel=false;this.hunterPhase='duel';}
  if(this.hunterAim?.from){
   const aim=this.hunterAim;this.hunterAim=null;
   if(aim.from===from){
    const damage=[],mirrored=[],arrows=[];
    for(const arrow of [aim,aim.extra].filter(Boolean)){
     const ray=arrow.path||this.ray(from,...arrow.direction).slice(0,arrow.range||4),target=ray.find(s=>this.get(s)),path=target?ray.slice(0,ray.indexOf(target)+1):ray,amount=arrow.damage||3;
     if(target){const v=this.get(target);if(v.color==='w'&&v.mirrorUntil>this.ply&&!mirrored.includes(target)){mirrored.push(target);damage.push({square:from,amount:this.damageTo(from,amount),reflected:true});}else damage.push({square:target,amount:Math.max(1,amount-(v.trenchUntil>this.ply?1:0))});}
     arrows.push({path,target,amount});
    }
    for(const target of mirrored)if(this.get(target))delete this.get(target).mirrorUntil;
    const path=arrows[0].path,target=arrows[0].target;
    const before=result.captured.length;damageAll(damage);if(damage.length)this.quiet=0;this.energy.b=Math.min(60,this.energy.b+Math.min(12,result.captured.slice(before).filter(p=>p.color==='w').length*4));
    for(const d of damage)if(this.get(d.square))this.get(d.square).revealUntil=this.ply+2;
    this.endCheck(result.captured.slice(before));this.hunterShotTurn=this.ply;this.hunterReadyAt=this.ply+4;
    if(this.get(from))this.get(from).hunterRevealUntil=this.ply+3;
    const candidates=this.hunterFlushed?[]:this.hunterDestinations(from);
    this.hunterIntel={source:from,path,extraPath:arrows[1]?.path,candidates:[...candidates],expiresAt:this.ply+4};
    result.hunterShot={from,path,arrows,damage,captured:result.captured.slice(before),mirrored,candidates:[...candidates],miss:arrows.every(a=>!a.target)};
    this.hunterPhase=this.hunterFlushed||this.hunterTemporaryDuel?'duel':'window';return;
   }
  }
  if(this.hunterPhase==='window')this.hunterPhase='retreat';
  if(this.hunterFlushed){this.get(from).hunterRevealUntil=this.ply+3;this.get(from).attack=3;return;}
  const destinations=this.hunterDestinations(from),blocked=this.hunterPhase==='retreat'||!this.hunterOpenHides().includes(from);
  if(blocked&&!destinations.length){
   this.hunterPinnedTurns++;this.hunterCorner(result);
   if(this.hunterPinnedTurns>=2){this.hunterTemporaryDuel=true;this.hunterPhase='duel';this.hunterCorneredUntil=0;}
  }
  if(this.hunterTemporaryDuel){this.get(from).hunterRevealUntil=this.ply+3;this.get(from).attack=3;}
 };
 // Damage rules are evaluated before landing, so a surviving target cannot accidentally be overrun.
 P.bossDamageReasons=function(square,source=this._damageSource){
  if(!active(this)||!isBoss(this,square)||!source||source.color!=='w')return [];
  const reasons=[],turn=Math.floor(this.ply/2),p=source.piece;
  if(this.get(square)?.giant){const weak=this.giantState.weakUntil>this.ply;if(weak)reasons.push('выдохся +1');else if(Math.min(...this.giantCells().map(s=>distance(source.square,s)))>1)reasons.push('−2 кожа');}
  if(this.boss==='hunter'&&hides.includes(square)&&!this.hunterFlushed&&!this.hunterTemporaryDuel&&this.hunterCorneredUntil<=this.ply&&distance(source.square,square)>1&&!['p','n','k'].includes(p?.type)&&!(p?.invisibleUntil>this.ply))reasons.push('укрытие: урон /2');
  if(this.boss==='hunter'&&this.hunterBraceTurn===turn)reasons.push('−2 уклонение');
  if(p?.lastBossHitTurn!==undefined&&p.lastBossHitTurn>=turn-1)reasons.push('повтор −1');return reasons;
 };
 P.damageTo=function(square,amount){let dealt=base.damageTo.call(this,square,amount);if(amount<=0)return dealt;const reasons=this.bossDamageReasons(square);if(reasons.includes('−2 кожа'))dealt-=2;if(reasons.includes('укрытие: урон /2'))dealt=Math.min(dealt,Math.ceil(amount/2));if(reasons.includes('−2 уклонение'))dealt-=2;if(reasons.includes('повтор −1'))dealt--;return Math.max(1,dealt);};
 P.impact=function(move){
  if(move.bossKind==='giant')return this.giantImpactV12(move);
  const previous=this._damageSource,p=this.get(move.from);this._damageSource={square:move.from,color:p?.color,piece:p};
  try{const impact=base.impact.call(this,move);if(move.bow){impact.landing=move.from;for(const d of impact.damage)if(!d.counter&&!d.reflected)d.amount=Math.max(1,3-(this.get(d.square)?.trenchUntil>this.ply?1:0));if(impact.damage.some(d=>!d.counter&&!d.reflected&&d.amount>=this.get(d.square)?.hp))impact.damage=impact.damage.filter(d=>!d.counter);}else if(this.boss==='hunter')for(const d of impact.damage)if(d.counter&&this.get(impact.struck)?.type==='k'&&this.get(impact.struck)?.color==='b')d.amount=Math.max(1,attackOf(this.get(impact.struck))-(p?.trenchUntil>this.ply?1:0));for(const d of impact.damage){const reasons=this.bossDamageReasons(d.square);if(reasons.length)d.reasons=reasons;}return impact;}finally{this._damageSource=previous;}
 };
 P.apply=function(action){
  this.ensurePieceIds();const mover=this.get(action?.from),uid=mover?.uid,white=this.side==='w',turn=Math.floor(this.ply/2);
  const oldMarks=Object.values(this.board).filter(p=>p.furyMarked).map(p=>p.uid);
  const bossSquares=active(this)&&white?new Set(Object.keys(this.board).filter(s=>isBoss(this,s))):new Set();
  const opening=this.boss==='giant'&&this.giantState.weakUntil>this.ply;
  const result=this.boss==='giant'&&action?.bossKind==='giant'?this.applyGiantV12(action):base.apply.call(this,action);
  if(result.damage.some(d=>d.amount>0&&bossSquares.has(d.square)&&!d.counter&&!d.reflected)){const survivor=Object.values(this.board).find(p=>p.uid===uid);if(survivor){survivor.furyMarked=true;survivor.lastBossHitTurn=turn;}if(opening&&tuning.singleOpening)this.giantState.weakUntil=0;if(this.boss==='hunter')this.hunterBraceTurn=turn;}
  if(tuning.hunterRetreatAim&&action?.hunter==='relocate'&&action.via&&!result.hunterAmbush&&this.hunterSquare()===action.to){
   const aim=this.hunterAimOptions(action.to).find(m=>m.to===action.via&&m.secondary===action.secondary);if(aim)this.hunterAim={from:action.to,target:aim.to,direction:aim.direction,cells:aim.cells,path:aim.path,range:aim.range};
  }
  if(action?.hunter==='aim'){
   if(this.hunterAim){const aim=this.hunterAimOptions(action.from).find(m=>m.to===action.to&&m.secondary===action.secondary);if(aim){this.hunterAim.path=aim.path;this.hunterAim.range=aim.range;}}
  }
  if(this.hunterAim&&action.secondary&&['aim','relocate'].includes(action.hunter)){
   const second=this.hunterAimOptions(this.hunterSquare()).find(m=>m.to===action.secondary&&!m.secondary);if(second)this.hunterAim.extra={from:second.from,target:second.to,path:second.path,cells:second.cells,direction:second.direction,range:second.range,damage:3};
  }
  const targeted=new Set(action?.hunter==='aim'||action?.hunter==='relocate'&&this.hunterAim?[this.hunterAim?.target,this.hunterAim?.extra?.target]:action?.bossAction==='giantWindup'?[action.secondary]:action?.bossKind==='giant'?result.area||[]:[]);
  if(action?.bossKind==='giant'&&['giantStep','giantCharge','giantWindup'].includes(action.bossAction)){for(const square of this.giantState.plan?.area||[])targeted.add(square);if(this.giantState.plan?.secondary)targeted.add(this.giantState.plan.secondary.at(-1));}
  for(const square of targeted){const p=this.get(square);if(p&&oldMarks.includes(p.uid))delete p.furyMarked;}

  if(this.draw&&this.boss==='hunter'&&this.hiddenUnknown&&this.side!==this.projectedFor&&this.ply<400&&this.quiet<100&&result.captured.filter(p=>p.type==='k').length<2)this.draw=false;
  this.ensurePieceIds();return result;
 };
 P.giantEnraged=function(){const p=this.get(this.giantState?.anchor);return Boolean(p?.giant&&p.hp<=(this.matchDifficulty==='hard'?24:18));};
 P.giantInfo=function(){const info=base.giantInfo.call(this);return info?{...info,strikeDamage:{stomp:4,sweep:5,throw:3,charge:2},skin:!info.weak,rageAt:this.matchDifficulty==='hard'?24:18,version:13}:null;};
 P.giantThrowPath=function(anchor,target){const source=body(anchor).filter(Boolean).sort((a,b)=>distance(a,target)-distance(b,target)||a.localeCompare(b))[0];return line(source,target).filter(s=>!body(anchor).includes(s));};
 P.giantChargePath=function(anchor,dx,dy){const path=[];for(let n=1;n<=2;n++){const a=step(anchor,dx*n,dy*n);if(!a||body(a).some(s=>!s))break;path.push(a);}return path;};
 P.bossMoves=function(){
  if(this.boss!=='giant')return base.bossMoves.call(this);
  if(this.side!=='b'||this.isOver())return [];
  const state=this.giantState,from=state.anchor;
  if(tuning.giantCounter&&state.phase==='windup'){
   const basic={bossAction:'giantWindup',bossKind:'giant',from,to:from,area:state.plan.area,pattern:state.plan.kind,direction:state.plan.direction};
   const counter=Object.entries(this.board).filter(([q,p])=>p.color==='w'&&p.furyMarked&&this.visible(q,'b')&&!state.plan.area.includes(q)).map(([q])=>({...basic,secondary:q}));
   return [basic,...counter];
  }
  if(state.phase!=='step')return [{bossAction:state.phase==='windup'?'giantWindup':state.phase==='charge'?'giantCharge':'giantStrike',bossKind:'giant',from,to:state.plan.destination||from,area:state.plan.area,pattern:state.plan.kind,direction:state.plan.direction}];
  const out=base.bossMoves.call(this),positions=[...new Set([from,...out.map(m=>m.to)])];
  for(const to of positions)for(const [target,p]of Object.entries(this.board))if(p.color==='w'&&p.furyMarked){const area=this.giantThrowPath(to,target);if(area.length)out.push({bossAction:'giantStep',bossKind:'giant',from,to,area,pattern:'throw',direction:target});}
  if(this.giantEnraged()&&this.ply>=(state.chargeReady||0))for(const [index,[dx,dy]]of directions.slice(0,4).entries()){
   const path=this.giantChargePath(from,dx,dy);if(!path.length)continue;
   const area=[...new Set(path.flatMap(body))].filter(s=>!body(from).includes(s));
   out.push({bossAction:'giantChargePrepare',bossKind:'giant',from,to:path.at(-1),area,pattern:'charge',direction:index,path});
  }
  return out;
 };
 P.giantImpactV12=function(move){
  const state=this.giantState,damage=[],mirrored=[],area=move.area||[];let landing=move.bossAction==='giantStep'&&!body(move.to).some(s=>this.get(s)&&!this.get(s).giant)?move.to:state.anchor;
  const hit=(square,amount)=>{const p=this.get(square);if(!p||p.giant)return;if(p.mirrorUntil>this.ply){mirrored.push(square);damage.push({square:state.anchor,amount:this.damageTo(state.anchor,amount),reflected:true});}else damage.push({square,amount:this.damageTo(square,amount)});};
  if(move.bossAction==='giantStrike'){
   if(state.plan.kind==='throw'){const s=area.find(s=>this.get(s)&&!this.get(s).giant);if(s)hit(s,3);}
   else for(const s of area)if(this.get(s)?.color==='w')hit(s,state.plan.kind==='stomp'?4:5);
   if(state.plan.secondary){const s=state.plan.secondary.find(q=>this.get(q)&&!this.get(q).giant);if(s&&!damage.some(d=>d.square===s))hit(s,3);}
  }
  if(move.bossAction==='giantCharge'){
   const seen=new Set();for(const anchor of state.plan.path){let blocked=false;for(const s of body(anchor)){const p=this.get(s);if(!p||p.giant||seen.has(s))continue;seen.add(s);hit(s,2);const d=damage.find(d=>d.square===s&&!d.reflected);if(!d||p.hp>d.amount)blocked=true;}if(blocked)break;landing=anchor;}
  }
  const reflected=damage.filter(d=>d.reflected);const hits=damage.filter(d=>!d.reflected);if(reflected.length)hits.push({...reflected[0],amount:Math.max(...reflected.map(d=>d.amount))});
  return {damage:hits,heals:[],mirrored,landing,area,reveal:null,struck:null};
 };
 P.applyGiantV12=function(action){
  const move=this.view(this.side).bossMoves().find(m=>m.from===action.from&&m.to===action.to&&m.bossAction===action.bossAction&&m.pattern===action.pattern&&m.direction===action.direction&&m.secondary===action.secondary);
  if(!move)throw new Error('Недопустимое действие великана.');
  this.snapshots.push(this.snapshot());const state=this.giantState,impact=this.impact(move),captured=[],oldCells=this.giantCells(),giant=this.get(state.anchor);
  if(move.bossAction==='giantStep'){
   const blockers=body(move.to).filter(s=>this.get(s)&&!this.get(s).giant);
   if(blockers.length){for(const s of blockers){delete this.get(s).invisibleUntil;this.get(s).revealUntil=this.ply+3;}impact.landing=state.anchor;impact.blocked=true;}
   else{for(const s of oldCells)delete this.board[s];state.anchor=move.to;for(const s of body(move.to))this.board[s]={...giant,giantAnchor:move.to};}
   const area=move.pattern==='throw'?this.giantThrowPath(state.anchor,move.direction):this.giantArea(state.anchor,move.pattern,move.direction);
   const fast=this.matchDifficulty!=='easy'&&this.giantEnraged();
   state.plan={kind:move.pattern,direction:move.direction,area,fast};state.phase=fast?'strike':'windup';
   if(fast){const targets=Object.entries(this.board).filter(([q,p])=>p.color==='w'&&p.furyMarked&&this.visible(q,'b')&&!area.includes(q)).sort((a,b)=>worth[b[1].type]/b[1].hp-worth[a[1].type]/a[1].hp);for(const [q]of targets){const path=this.giantThrowPath(state.anchor,q);if(path.find(s=>this.get(s)&&!this.get(s).giant)===q){state.plan.secondary=path;break;}}}
  }else if(move.bossAction==='giantChargePrepare'){
   state.plan={kind:'charge',direction:move.direction,area:[...move.area],path:[...move.path],destination:move.to};state.phase='charge';
  }else if(move.bossAction==='giantWindup'){state.phase='strike';if(move.secondary)state.plan.secondary=this.giantThrowPath(state.anchor,move.secondary);}
  else{
   for(const d of impact.damage){const p=this.get(d.square);if(!p)continue;p.hp-=d.amount;if(p.hp<=0){captured.push({square:d.square,...p});if(p.type!=='k')this.grave[p.color].push(p.type);delete this.board[d.square];}}
   for(const s of impact.mirrored)if(this.get(s))delete this.get(s).mirrorUntil;
   if(giant.hp<=0){for(const s of oldCells)delete this.board[s];}
   else{for(const s of oldCells)delete this.board[s];state.anchor=impact.landing;for(const s of body(state.anchor))this.board[s]={...giant,giantAnchor:state.anchor};}
   if(move.bossAction==='giantCharge'&&giant.hp>0){
    state.chargeReady=this.ply+6;
    const plans=[['stomp',0],['sweep',0],['sweep',1],['sweep',2],['sweep',3]].map(([kind,direction])=>({kind,direction,area:this.giantArea(state.anchor,kind,direction)}));
    plans.sort((a,b)=>b.area.reduce((n,s)=>n+(this.visible(s,'b')?.color==='w'?worth[this.visible(s,'b').type]:0),0)-a.area.reduce((n,s)=>n+(this.visible(s,'b')?.color==='w'?worth[this.visible(s,'b').type]:0),0));
    state.plan={...plans[0],fast:this.matchDifficulty!=='easy'&&this.giantEnraged()};state.phase=state.plan.fast?'strike':'windup';state.weakUntil=0;
   }else{state.phase='step';state.plan=null;state.weakUntil=this.ply+2;}
  }
  this.actions.push({...move});this.ep=null;this.pending=null;this.quiet=impact.damage.length?0:this.quiet+1;this.endCheck(captured);
  const result={...move,...impact,id:null,color:'b',captured,revived:[],burn:[],bossResolved:['giantStrike','giantCharge'].includes(move.bossAction)};
  if(!this.isOver()){this.side='w';this.ply++;const held=['d4','e4','d5','e5'].filter(s=>this.get(s)?.color==='w').length;this.energy.w=Math.min(60,this.energy.w+8+Math.min(4,held*2));if(this.ply>=240||this.quiet>=80)this.draw=true;}
  return result;
 };
 const worth={p:1,n:3,b:3,r:5,q:7,k:25};
 P.chooseHunterMove=function(level='normal',history=this,options={}){
  const g=this.view('b'),moves=[...g.normals(),...g.specials(),...g.hunterMoves()];
  if(!moves.length)return null;
  // Finish a bare-kings duel instead of cycling between the four safe squares forever.
  if(g.hunterFlushed&&Object.values(g.board).filter(p=>p.color==='b').length===1){const hp=g.get(g.hunterSquare())?.hp;const stalled=(history.snapshots||[]).slice(-12).filter(s=>s.side==='b'&&Object.values(s.board).some(p=>p.color==='b'&&p.type==='k'&&p.hp===hp)).length>=4;if(stalled||Object.values(g.board).every(p=>p.type==='k')){const contact=moves.filter(m=>!m.power&&!m.hunter&&g.get(m.to)?.color==='w').sort((a,b)=>{const score=m=>{const p=g.get(m.to),hit=g.impact(m);return (hit.damage.some(d=>d.square===m.to&&d.amount>=p.hp)?100:0)+worth[p.type]/p.hp;};return score(b)-score(a);})[0];if(contact)return contact;}}
  const king=g.hunterSquare(),white=Object.entries(g.board).filter(([,p])=>p.color==='w');
  const incoming=(board,s)=>Math.max(0,...Object.entries(board.board).filter(([,p])=>p.color==='w').filter(([from])=>board.attacks(from,s)).map(([,p])=>board.damageTo(s,attackOf(p))));
  const danger=incoming(g,king),ranked=[];
  for(const move of moves){
   const next=Object.assign(Object.create(Battle.prototype),g.snapshot(),{actions:[],snapshots:[]});const result=next.apply(move);
   if(next.winner==='b')return move;
   const at=next.hunterSquare(),boss=next.get(at);if(!boss)continue;
   const exposed=next.visible(at,'w'),risk=exposed?incoming(next,at):0;
   const repeats=(history.snapshots||[]).slice(-16).filter(s=>s.side==='b'&&s.board[at]?.color==='b'&&s.board[at]?.type==='k').length;
   let score=-repeats*6;if(move.secondary){const p=g.get(move.secondary);if(p)score+=8+worth[p.type]*Math.min(1,3/p.hp)*7;}
   if(next.burning(at,next.ply+1)){const safeDistance=Math.min(8,...allSquares.filter(s=>!next.burning(s,next.ply+3)).map(s=>distance(at,s)));score-=safeDistance*2000;if(boss.hp<=safeDistance)score-=30000;}
   for(const d of result.damage){const p=g.get(d.square);if(p)score+=(p.color==='w'?1:-1.3)*worth[p.type]*Math.min(d.amount,p.hp)/p.hp*12;}
   for(const h of result.heals){const p=g.get(h.square);if(p)score+=(p.color==='b'?1:-1)*h.amount*2;}
   score-=risk*14+(risk>=boss.hp?10000:0)+(next.burning(at,next.ply+1)?(boss.hp<=1?30000:500):0);
   if(move.hunter==='aim'){
    const victim=g.get(move.to),cost=worth[victim.type],guard=g.damageTo(move.to,3),range=victim.furyMarked?7:4;
    const threat=cost*Math.min(1,guard/victim.hp);
    score+=18+threat*9;
    if(exposed&&risk)score-=220+risk*30;
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
    if(move.via){const victim=g.get(move.via);score+=18+worth[victim.type]*Math.min(1,3/victim.hp)*9;}
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
     if(mover.variant==='wolf'){const wk=white.find(([,p])=>p.type==='k')?.[0];if(wk)score+=18-distance(result.landing,wk)*4;for(const [q,p]of white)if(next.attacks(result.landing,q))score+=worth[p.type]*1.2;if(next.hunterAim){const victim=next.hunterAim.target;for(const m of next.view('w').normals(victim))if(next.attacks(result.landing,m.to))score+=3;}}
    }
   }
   ranked.push({move,score,burning:next.burning(at,next.ply+1)});
  }
  const safe=ranked.filter(r=>!r.burning),choices=safe.length?safe:ranked;choices.sort((a,b)=>b.score-a.score);if(!choices.length)return moves[0];
  if(level==='hard'&&tuning.hunterSearch){
   const clone=g=>Object.assign(Object.create(Battle.prototype),g.snapshot(),{actions:[],snapshots:[]});
   const value=g=>{if(g.winner)return g.winner==='b'?1e6:-1e6;let score=(g.get(g.hunterSquare())?.hp||0)*10;for(const p of Object.values(g.board)){if(p.color==='w')score-=p.type==='k'?p.hp*18:worth[p.type]*(.3+.7*p.hp/maxOf(p))*5;else if(p.type!=='k')score+=worth[p.type]*(.3+.7*p.hp/maxOf(p))*5;}return score;};
   const deadline=performance.now()+(options.timeMs??1200);
   const reply=(g,left,budget)=>{
    if(g.isOver()||g.side!=='w'||!left||budget.nodes<=0||performance.now()>deadline)return value(g);
    const view=g.view('w'),rows=[];
    for(const m of [...view.normals(),...view.specials()]){if(budget.nodes--<=0||performance.now()>deadline)break;const n=clone(g);n.apply(m);rows.push({n,v:value(n)});}
    rows.sort((a,b)=>a.v-b.v);let worst=rows[0]?.v??value(g);
    for(const row of rows.filter(r=>r.n.side==='w'&&!r.n.isOver()).slice(0,2))worst=Math.min(worst,reply(row.n,left-1,budget));
    return worst;
   };

   let best=choices[0].move,score=-Infinity;
   for(const row of choices.slice(0,6)){if(performance.now()>deadline)break;const next=clone(g);next.apply(row.move);const v=reply(next,3,{nodes:300})+row.score*4;if(v>score){score=v;best=row.move;}}return best;
  }
  return choices[level==='easy'?Math.floor(Math.random()*Math.min(4,choices.length)):0]?.move||moves[0];
 };

 P.chooseGiantMove=function(level='normal'){
  const moves=this.bossMoves();if(moves.length<2)return moves[0]||null;
  const whites=Object.entries(this.board).filter(([,p])=>p.color==='w'),king=whites.find(([,p])=>p.type==='k')?.[0];
  if(this.giantState.phase==='windup'){
   const candidates=moves.map(m=>{const p=this.get(m.secondary);if(!p)return {m,score:0};const ray=this.giantThrowPath(this.giantState.anchor,m.secondary),first=ray.find(q=>this.get(q)&&!this.get(q).giant);return {m,score:first===m.secondary?worth[p.type]*(p.hp<=3?2:3/p.hp):0};});
   return candidates.sort((a,b)=>b.score-a.score)[0].m;
  }
  const scored=moves.map(move=>{
   const zone=new Set(move.area),preview=Object.assign(Object.create(Battle.prototype),this.snapshot(),{actions:[],snapshots:[]});preview.apply(move);
   const affected=move.pattern==='throw'?move.area.filter(s=>this.get(s)&&!this.get(s).giant).slice(0,1):move.area;
   const damage={throw:3,charge:2,stomp:4,sweep:5}[move.pattern];let threat=0;const escapes=[];
   const exits=level!=='easy'?preview.normals():[];
   for(const [s,p]of whites)if(affected.includes(s)){const risk=worth[p.type]*(p.hp<=damage?1.5:damage/p.hp);threat+=risk;if(exits.some(m=>m.from===s&&!preview.get(m.to)&&!zone.has(m.to)))escapes.push(risk);}
   escapes.sort((a,b)=>b-a);const turns=move.pattern==='charge'||preview.giantState.phase==='strike'?1:2;
   if(level!=='easy')threat-=escapes.slice(0,turns).reduce((a,b)=>a+b,0)*.65;
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
   return {move,score:threat*3*tempo-range*(level==='hard'?4:3)-(level!=='easy'?incoming+safeAttackers*.1:incoming*.6)+punish+(move.pattern==='charge'?8:0)};
  }).sort((a,b)=>b.score-a.score||a.move.to.localeCompare(b.move.to));
  if(level!=='easy'){
   const clone=g=>Object.assign(Object.create(Battle.prototype),g.snapshot(),{actions:[],snapshots:[]});
   const utility=g=>{if(g.winner)return g.winner==='b'?1e6:-1e6;let score=(g.giantInfo()?.hp||0)*4;for(const p of Object.values(g.board))if(p.color==='w')score-=p.type==='k'?p.hp*15+100:worth[p.type]*(.3+.7*p.hp/maxOf(p))*5;return score;};
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
   const shortlist=scored.slice(0,level==='hard'?7:3);
   for(const kind of (level==='hard'?['throw','stomp','sweep']:[])){const r=scored.find(r=>r.move.pattern===kind);if(r&&!shortlist.includes(r))shortlist.push(r);}
   for(const row of shortlist){
    let n=clone(this);n.apply(row.move);
    const replies=row.move.pattern==='charge'||n.giantState.phase==='strike'?1:2;
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
 bosses.hunter.text='Охота отрядом из 8 фигур. Босс: 18 HP, два волка и четыре пешки. Прицел → выстрел на 3 → окно для атаки → уход. Обзор фигур 1, короля 2 клетки.';
 bosses.hunter.lore='Твой отряд: король e1, ферзь d1, слон c1, конь g1, ладья h1; пешки b2, d2, f2. Все шесть типов способностей доступны. После выстрела Охотник открыт на один твой ход. Перекрой лёжки, чтобы задержать уход. Загнанный через два хода переходит во временную дуэль; когда лёжка освободится, скрывается. В кустах дальние удары слона, ладьи и ферзя вдвое слабее; конь и засада обходят защиту. После отхода новый прицел. Ярость позволяет добавить вторую стрелу на 3 по отмеченному стрелку. Обе линии видны заранее. Лук отвечает на обычную атаку в пределах 4 клеток: 2 урона; способности ответа не вызывают. В дуэли лук бьёт и отвечает на 3 по прямой/диагонали до 4 клеток, Стража не ослабляет стрелы. Прицел срывает удар на 3+ или вплотную. Повторный удар одной фигурой слабее на 1.';
 bosses.giant.text='Тело 2×2, 36 HP. Каменная кожа: издалека −2 урона, вплотную полный. После удара кожа снята и +1 урона по нему. Бросок по отмеченному стрелку.';
 bosses.giant.lore='Шаг → замах → удар: два твоих ответа. Бросок останавливает первая фигура на линии. Вторая фаза: 24 HP на сложном, 18 на остальных. На обычном и сложном новые замахи дают один ответ. Доступен Рывок: предупреждение за один ход, по 2 урона на пути, остановка перед выжившими. После основного удара одно усиленное попадание без кожи. Рывок заменяет шаг и готовит основной удар. Повторный удар одной фигурой слабее на 1.';
}
