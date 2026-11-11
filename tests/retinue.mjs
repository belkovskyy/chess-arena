import assert from 'node:assert/strict';import{Battle}from '../battle.js';import{Battle as V13}from '../_compat/v13/battle.js';import{chooseMove}from '../bot.js';import{chooseMove as oldMove}from '../_compat/v13/bot.js';
const p=(type,color,hp,extra={})=>({type,color,hp,...extra});
function iron(){const g=new Battle({boss:'iron'});g.board={e6:p('k','b',20,{max:20}),d5:p('r','b',4),f5:p('r','b',6),a1:p('k','w',12),b5:p('r','w',6),c4:p('p','w',2)};g.side='b';g.ply=1;return g;}
function warlock(){const g=new Battle({boss:'warlock'});g.board={e8:p('k','b',16,{max:16}),b8:p('b','b',3,{seal:true}),c7:p('b','b',3,{seal:true}),f7:p('b','b',3,{seal:true}),g8:p('b','b',3,{seal:true}),a1:p('k','w',12),c2:p('r','w',6),d4:p('p','w',2),g1:p('b','w',3)};g.side='b';g.ply=1;return g;}
const prepare=(g,to)=>{const m=g.bossMoves().find(m=>m.to===to);assert.ok(m);return g.apply(m);};
{
 const g=new Battle({boss:'iron'});assert.equal(g.supportInfo().squares.length,4);assert.deepEqual(g.supportInfo().linked,['d7','f7']);assert.equal(g.supportInfo().damage,3);assert.equal(g.board.e8.hp,20);
 const h=iron(),before=h.snapshot();prepare(h,'c4');assert.equal(h.bossPlan.damage,3);h.apply({from:'b5',to:'d5'});assert.equal(h.supportInfo().active,false);assert.equal(h.supportInfo().damage,2);assert.equal(h.bossMoves()[0].castDamage,3);const r=h.apply(h.bossMoves()[0]);assert.equal(r.damage.find(d=>d.square==='d5').amount,3);while(h.actions.length)h.undo();assert.deepEqual(h.snapshot(),before);
 const x=iron();delete x.board.f5;prepare(x,'c4');assert.equal(x.bossPlan.damage,2);
 console.log('PASS four rooks, active/broken formation, fixed damage after guard death, undo');
}
{
 const g=warlock(),before=g.snapshot();prepare(g,'d4');const area=[...g.bossPlan.area];assert.equal(area.length,13);g.apply({from:'c2',to:'c7'});assert.equal(g.supportInfo().radius,2);assert.deepEqual(g.bossMoves()[0].area,area);const r=g.apply(g.bossMoves()[0]);assert.equal(g.get('g1'),undefined);assert.ok(r.damage.some(d=>d.square==='g1'&&d.amount===3));while(g.actions.length)g.undo();assert.deepEqual(g.snapshot(),before);
 const h=warlock();for(const s of ['b8','c7','f7','g8'])delete h.board[s];h.board.e7=p('b','b',3);assert.equal(h.supportInfo().squares.length,0);assert.equal(h.supportInfo().radius,1);
 console.log('PASS seal loss shrinks future radius, announced outer cells still hit, ordinary bishop is not a seal');
}
{
 const g=warlock();g.get('g1').type='q';g.get('g1').mirrorUntil=99;g.get('e8').hp=1;prepare(g,'d4');g.apply({from:'a1',to:'a2'});g.apply(g.bossMoves()[0]);assert.equal(g.winner,'w');
 const h=warlock();h.board.e5=p('r','w',6);prepare(h,'d4');const r=h.apply({from:'e5',to:'e8'});assert.equal(r.bossInterrupted,true);assert.equal(h.bossPlan,null);
 const fire=warlock();fire.ply=47;prepare(fire,'d4');fire.apply({from:'a1',to:'a2'});assert.ok(fire.bossPlan);assert.ok(fire.board.e8.hp<16);
 console.log('PASS mirror can kill caster; figure hit interrupts; fire does not');
}
{
 const g=iron();prepare(g,'c4');g.apply({from:'a1',to:'a2'});const m=g.bossMoves()[0],r=g.apply({...m,area:['a2'],castDamage:999});assert.ok(!r.damage.some(d=>d.square==='a2'));assert.equal(r.damage.find(d=>d.square==='c4').amount,3);
 console.log('PASS client cannot forge spell area or damage');
}
for(const boss of [null,'horde','hunter','giant']){const a=new Battle({boss,difficulty:'hard'}),b=new V13({boss,difficulty:'hard'});assert.deepEqual(a.snapshot(),b.snapshot());for(let i=0;i<12&&!a.isOver();i++){const m=oldMove(b,'hard',{nodes:500,timeMs:10000});if(boss==='horde')assert.deepEqual(chooseMove(a,'hard',{nodes:500,timeMs:10000}),m);a.apply(m);b.apply(m);assert.deepEqual(a.snapshot(),b.snapshot());}}
console.log('PASS Horde decisions and ordinary/Hunter/Giant rules unchanged; v13 remains frozen');
