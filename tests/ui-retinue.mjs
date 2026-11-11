import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as rules from '../battle.js';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const nodes=new Map();
class Element{
 constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.style={};this.attributes={};this.className='';this.textContent='';this.hidden=false;this.classList={add:(...names)=>{this.className=[...new Set([...this.className.split(' ').filter(Boolean),...names])].join(' ');},remove:(...names)=>{this.className=this.className.split(' ').filter(n=>!names.includes(n)).join(' ');},contains:name=>this.className.split(' ').includes(name),toggle:(name,on)=>{const active=on??!this.classList.contains(name);this.classList[active?'add':'remove'](name);return active;}};}
 set id(value){this._id=value;nodes.set(value,this);}get id(){return this._id;}
 append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;}
 setAttribute(name,value){this.attributes[name]=value;}getAttribute(name){return this.attributes[name];}
 addEventListener(){}get firstElementChild(){return this.children[0]||(this.children[0]=new Element());}
 querySelectorAll(selector){const match=e=>selector.startsWith('.')?e.classList.contains(selector.slice(1)):false;return this.children.flatMap(e=>[...(match(e)?[e]:[]),...e.querySelectorAll(selector)]);}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}
const $=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
const context={...rules,currentRules:14,rulesVersion:14,room:null,playerColor:'w',opponentColor:'b',myTurn:()=>true,renderRoom:()=>{},difficulty:'hard',$,document:{documentElement:new Element('html'),createElement:tag=>new Element(tag),createElementNS:(_ns,tag)=>new Element(tag)},game:new rules.Battle(),board:$('board'),names:{p:'Пешка',n:'Конь',b:'Слон',r:'Ладья',q:'Ферзь',k:'Король'},busy:false,selected:null,mode:null,aim:null,revive:null,last:null,events:[],cardButtons:{},botRetryBlocked:false,targetSquares:()=>[],attackPreview:()=>new Map(),preview:()=>{},renderResult:()=>{},click:()=>{}};
vm.createContext(context);
const between=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end));
vm.runInContext(between('function image(','const themes=')+between('function kingHp(','function targets(')+between('function renderHunterIntel(','function lines('),context);
const render=game=>{context.game=game;vm.runInContext('render()',context);};

const iron=new rules.Battle({boss:'iron'});render(iron);assert.equal(context.board.querySelectorAll('.formation-square').length,2);assert.equal(context.board.querySelectorAll('.escort-square').length,2);assert.match($('retinueIntentTitle').textContent,/Строй собран/);assert.equal($('retinueIntent').hidden,false);assert.equal($('bossInfo').hidden,true);assert.equal($('supportMarks').children.length,4);
iron.side='b';iron.ply=1;iron.board.e4={type:'p',color:'w',hp:2};iron.board.e7=iron.board.e8;delete iron.board.e8;iron.apply(iron.bossMoves().find(m=>m.to==='d5'));render(iron);assert.match($('retinueIntentTitle').textContent,/3 урона после/);assert.ok(context.board.querySelectorAll('.boss-zone-mark').every(e=>e.textContent==='↓3'));
delete iron.board.d7;render(iron);assert.match($('retinueIntentTitle').textContent,/3 урона/);assert.equal(iron.supportInfo().active,false);iron.winner='w';render(iron);assert.equal(context.board.querySelectorAll('.boss-zone-mark').length,0);assert.equal($('retinueIntent').hidden,true);
console.log('PASS four rook roles, frozen 3-damage warning, finished overlays hidden');
const warlock=new rules.Battle({boss:'warlock'});render(warlock);assert.equal(context.board.querySelectorAll('.seal-token').length,4);assert.equal(context.board.querySelectorAll('.seal-square').length,4);assert.match($('retinueIntentTitle').textContent,new RegExp('Печати 4/4.*радиус.*3'));delete warlock.board.b8;delete warlock.board.g8;render(warlock);assert.match($('retinueIntentTitle').textContent,new RegExp('Печати 2/4.*2'));
const {Battle:V13}=await import('../_compat/v13/battle.js');context.rulesVersion=13;render(new V13({boss:'iron'}));assert.equal($('retinueIntent').hidden,true);assert.equal($('bossInfo').hidden,false);assert.equal($('rulesVersionLabel').textContent,'Старая партия · 13');
console.log('PASS live seal indicators; v13 retains old HUD and old two-rook rules');
