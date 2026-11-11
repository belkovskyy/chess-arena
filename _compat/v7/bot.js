import {Battle,allSquares,other,center,maxOf,attack} from './battle.js';
export const difficulties={easy:'Лёгкий',normal:'Обычный',hard:'Сложный'};
export const cleanDifficulty=d=>Object.hasOwn(difficulties,d)?d:'normal';
const worth={p:110,n:340,b:340,r:540,q:900,k:1800};
// Once the turn is handed over, a king on 1 HP cannot survive its next burn.
// Escaping, healing or winning now is mandatory, not a material trade.
const burningDeath=(g,color)=>!g.isOver()&&g.side!==color&&Object.entries(g.board).some(([s,p])=>p.type==='k'&&p.color===color&&p.hp<=1&&g.burning(s,g.ply+1));
function evaluate(g,root){
 if(g.winner)return g.winner===root?1e7:-1e7;
 if(g.draw)return 0;
 let score=0;
 const lights={w:g.litSquares('w'),b:g.litSquares('b')};
 for(const [s,p] of Object.entries(g.board)){
  const sign=p.color===root?1:-1,hp=p.hp/maxOf(p);
  let v=worth[p.type]*(.35+.65*hp);
  if(p.type==='k')v+=p.hp*65+g.guards(s)*45;
  if(center.includes(s))v+=35;
  if(g.burning(s,g.ply+2))v-=p.type==='k'?210:65;
  if(p.invisibleUntil>g.ply)v+=45;
  if(p.mirrorUntil>g.ply)v+=65;
  // Use the resulting board, including counter-strikes and removed blockers.
  let danger=0;
  for(const [e,q] of Object.entries(g.board))if(q.color!==p.color&&g.visible(s,q.color,lights[q.color])&&g.attacks(e,s)){
   const hit=g.damageTo(s,attack[q.type]);
   danger=Math.max(danger,hit>=p.hp?(p.type==='k'?5000:worth[p.type]*.55):hit*(p.type==='k'?70:15));
  }
  if(p.mirrorUntil>g.ply)danger*=.15;
  score+=sign*(v-danger);
 }
 if(g.hunterPlan){const t=g.get(g.hunterPlan.target),k=g.get(g.hunterPlan.via);if(t?.color==='w'&&k?.type==='k'&&k.color==='b')score+=(root==='b'?1:-1)*Math.min(250,worth[t.type]*3/t.hp*.45);}
 if(g.bossPlan){
  // Forecast the actual marked strike, including guard and reflected damage.
  // The temporary perspective contains only pieces already known to the search.
  const plan=g.bossPlan,shadow=Object.assign(Object.create(Battle.prototype),g,{side:'b'});
  for(const {square,amount} of shadow.impact({bossAction:'resolve',bossKind:plan.kind,from:plan.from,to:plan.target,area:plan.area}).damage){
   const victim=g.get(square);if(victim)score+=(victim.color===root?-1:1)*worth[victim.type]*Math.min(1,amount/victim.hp)*.45;
  }
 }
 return score+(g.energy[root]-g.energy[other(root)])*2-(burningDeath(g,root)?200000:0)+(burningDeath(g,other(root))?200000:0);
}
function copy(g){return Object.assign(Object.create(Battle.prototype),g.snapshot(),{actions:[],snapshots:[]});}
// No opponent's hidden pieces enter the search. Every branch generates moves
// from its own visible position; apply resolves known collisions normally.
export function chooseMove(input,difficulty='normal',options={}){
 const level=cleanDifficulty(difficulty),root=input.side,g=input.view(root);
 if(g.hunterPlan&&g.side==='b')return g.hunterMoves()[0]||null;
 if(g.bossPlan&&g.side==='b')return g.bossMoves()[0]||null;
 const deadline=performance.now()+(options.timeMs??850),limit=options.nodes??1800;
 let nodes=0,cut=false;
 const expired=()=>nodes>=limit||performance.now()>=deadline;
 function ranked(state,width=Infinity){
  const view=state.view(state.side),moves=[...view.normals(),...view.specials(),...view.hunterMoves(),...view.bossMoves()],rows=[];
  for(const move of moves){
   if(expired()&&rows.length){cut=true;break;}
   const next=copy(state);next.apply(move);nodes++;
   rows.push({move,next,score:evaluate(next,root)});
  }
  rows.sort((a,b)=>state.side===root?b.score-a.score:a.score-b.score);
  return rows.slice(0,width);
 }
 function search(state,turns,actionsLeft,alpha=-Infinity,beta=Infinity){
  if(expired()){cut=true;return evaluate(state,root);}
  if(state.isOver()||turns<=0||actionsLeft<=0)return evaluate(state,root);
  const rows=ranked(state,state.side===root?5:7);
  if(!rows.length)return evaluate(state,root);
  let best=state.side===root?-Infinity:Infinity;
  for(const row of rows){
   const changed=row.next.side!==state.side;
   const score=search(row.next,turns-(changed?1:0),actionsLeft-1,alpha,beta);
   if(state.side===root){best=Math.max(best,score);alpha=Math.max(alpha,best);}
   else{best=Math.min(best,score);beta=Math.min(beta,best);}
   if(beta<=alpha||expired())break;
  }
  return best;
 }
 const candidates=ranked(g),survivors=candidates.filter(r=>!burningDeath(r.next,root));
 const rows=survivors.length?survivors:candidates;
 if(!rows.length)return null;
 // Always take an immediate win, even if another ability looks attractive.
 const win=rows.find(r=>r.next.winner===root);if(win)return win.move;
 if(level==='easy'){
  const pool=rows.filter(r=>!(r.move.power||r.move.hunter||r.move.bossAction)||Math.random()<.2);
  const choices=(pool.length?pool:rows).slice(0,8);
  return choices[Math.floor(Math.random()*choices.length)].move;
 }
 // Finish free actions when comparing abilities against ordinary moves.
 for(const row of rows.filter(r=>r.next.side===root))if(!expired()){const score=search(row.next,1,4);if(!cut)row.score=score;}
 rows.sort((a,b)=>b.score-a.score);
 if(level==='normal')return rows[0].move;
 let best=rows[0].move,bestScore=-Infinity;
 for(const row of rows.slice(0,12)){
  if(expired())break;
  cut=false;
  const score=search(row.next,row.next.side===root?2:1,5);
  // Never compare an incomplete response search with a completed one.
  if(cut)break;
  if(score>bestScore){bestScore=score;best=row.move;}
 }
 return best;
}
