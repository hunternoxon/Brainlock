// model.js (v3) — Level-aware trick selection + subcategory gating
export class BrainlockModel {
  constructor() {
    this.SCALE = 100;
    this.reset();
  }
  reset() {
    this.state = {
      level: 1,
      mode: 'SKATE',
      soloCount: 10,
      sessionActive: false,
      stances: new Set(['regular','fakie','nollie','switch']),
      families: new Set(['flips','grinds','manuals','spins']),
      obstacles: new Set(['flat','manual pad','box','curb','ledge','bank','flatbar','rail','gap','quarterpipe','hubba','handrail']),
      sub: {
        flips: new Set(['kickflip','heelflip','hardflip','inward heelflip','360 flip','tre flip','laser flip','impossible']),
        grinds: new Set(['50-50','5-0','boardslide','noseslide','tailslide','lipslide','smith','feeble','crooked','nosegrind','overcrook','bluntslide','noseblunt','salad']),
        manuals: new Set(['manual','nose manual']),
        spins: new Set(['180','360'])
      },
      flow: 0, repeatMap: new Map(), letters: 0, score: 0, history: []
    };
  }
  flipDiff(name){ const d={{'kickflip':1,'heelflip':1,'hardflip':3,'inward heelflip':3,'tre flip':5,'360 flip':5,'laser flip':6,'impossible':6}}; return d[name]??1; }
  grindDiff(name){ const d={{'50-50':1,'5-0':2,'boardslide':2,'noseslide':2,'tailslide':3,'lipslide':3,'smith':4,'feeble':4,'crooked':4,'nosegrind':4,'overcrook':5,'bluntslide':6,'noseblunt':7,'salad':4}}; return d[name]??1; }
  obstacleTier(ob){ const t1=new Set(['flat','manual pad','box','curb','bank']); const t2=new Set(['ledge','quarterpipe','flatbar','rail','gap']); const t3=new Set(['hubba','handrail']); if(t1.has(ob))return 1; if(t2.has(ob))return 2; if(t3.has(ob))return 3; return 1; }
  weightedPick(items, weightFn){ const arr=items.map(v=>({v,w:Math.max(0,weightFn(v))})); const total=arr.reduce((s,a)=>s+a.w,0); if(total<=0) return items[Math.floor(Math.random()*items.length)]; let r=Math.random()*total; for(const a of arr){{ if((r-=a.w)<=0) return a.v; }} return arr[arr.length-1].v; }
  stanceValue(s){{switch(s){{case'fakie':return.20;case'nollie':return.25;case'switch':return.25;default:return 0;}}}}
  spinValue(spin){{if(!spin)return 0; return spin===360?.30:.10;}}
  flipValue(flip){{const m={{'kickflip':.30,'heelflip':.35,'hardflip':.55,'inward heelflip':.60,'tre flip':.80,'360 flip':.80,'laser flip':.85,'impossible':.90}}; return m[flip]??0;}}
  manualValue(m){{return m==='manual'?.25:(m==='nose manual'?.30:0);}}
  grindBaseValue(g){{const m={{'50-50':.30,'5-0':.35,'boardslide':.35,'noseslide':.40,'tailslide':.45,'lipslide':.50,'smith':.60,'feeble':.65,'crooked':.70,'nosegrind':.70,'bluntslide':.80,'noseblunt':.90,'overcrook':.85,'salad':.65}}; return m[g]??0;}}
  grindDirMult(g,dir){{const tbl={{'smith':{{FS:1.10,BS:1.20}},'feeble':{{FS:1.15,BS:1.05}},'crooked':{{FS:1.12,BS:1.06}},'overcrook':{{FS:1.18,BS:1.25}},'noseblunt':{{FS:1.00,BS:1.05}},'bluntslide':{{FS:1.00,BS:1.05}}}}; if(tbl[g])return tbl[g][dir||'FS']||1; return 1;}}
  obstacleAdder(ob){{const m={{'flat':0,'manual pad':.10,'box':.10,'curb':.15,'ledge':.25,'hubba':.35,'flatbar':.35,'rail':.45,'handrail':.55,'gap':.50,'bank':.25,'quarterpipe':.45}}; return m[ob]??0;}}
  attemptMult(a){{return a===1?1:(a===2?.85:.75);}}
  flowMult(){{return 1+Math.min(this.state.flow*.03,.15);}}
  repeatMult(sig){{const n=(this.state.repeatMap.get(sig)||0); if(n<=2)return 1; return Math.max(0,1-.10*(n-2));}}
  legalPatternForObstacle(ob){{if(ob==='handrail')return['grind-only','flip→grind']; if(ob==='hubba'||ob==='ledge')return['grind-only','flip→grind','manual-only']; if(['flat','gap','bank','quarterpipe','flatbar','rail'].includes(ob))return['flip-only','grind-only','flip→grind','manual-only']; if(['manual pad','box','curb'].includes(ob))return['flip-only','manual-only','grind-only']; return['flip-only'];}}
  stancePool(){{const L=this.state.level; const src=[...this.state.stances]; const w=(s)=>{{if(s==='regular')return 10-Math.min(6,L); if(s==='fakie')return L>=2?(L<=6?3:4):0; if(s==='nollie')return L>=5?(L<=8?2:4):0; if(s==='switch')return L>=7?(L<=9?2:5):0; return 1;}}; return this.weightedPick(src,w);}}
  obstaclePool(){{const L=this.state.level; const src=[...this.state.obstacles]; const w=(ob)=>{{const tier=this.obstacleTier(ob); if(tier===1)return 8-Math.max(0,L-3); if(tier===2)return L>=3?(2+(L-3)):0; if(tier===3)return L>=8?(L-6):0; return 1;}}; return this.weightedPick(src,w);}}
  patternPool(ob){{const L=this.state.level; const fams=this.state.families; const patterns=this.legalPatternForObstacle(ob).filter(p=>{{ if(p.includes('grind')&&!fams.has('grinds'))return false; if(p.includes('manual')&&!fams.has('manuals'))return false; if(p.includes('flip')&&!fams.has('flips'))return false; return true; }}); const w=(p)=>{{ if(p==='flip-only')return L<=4?8:4; if(p==='manual-only')return L<=3?6:2; if(p==='grind-only')return L<=4?3:6; if(p==='flip→grind')return L>=5?(L-3):0; return 1; }}; return this.weightedPick(patterns,w);}}
  chooseFlip(){{const L=this.state.level; const enabled=[...this.state.sub.flips]; if(!enabled.length)return null; const allowed=enabled.filter(n=>{{const d=this.flipDiff(n); if(L<=3)return d<=1; if(L<=6)return d<=3; if(L<=9)return d<=6; return true;}}); if(!allowed.length)return null; return this.weightedPick(allowed,(n)=>1+this.flipDiff(n)); }}
  chooseGrind(){{const L=this.state.level; const enabled=[...this.state.sub.grinds]; if(!enabled.length)return null; const allowed=enabled.filter(n=>{{const d=this.grindDiff(n); if(L<=3)return d<=2; if(L<=6)return d<=4; if(L<=9)return d<=6; return true;}}); if(!allowed.length)return null; return this.weightedPick(allowed,(n)=>1+this.grindDiff(n)); }}
  chooseManual(){{const enabled=[...this.state.sub.manuals]; if(!enabled.length)return null; return this.weightedPick(enabled,()=>1);}}
  chooseSpin(){{if(!this.state.families.has('spins'))return null; const L=this.state.level; const spins=[...this.state.sub.spins].map(s=>parseInt(s,10)).filter(x=>x===180||x===360); if(!spins.length)return null; const pUse=L<=3?.25:L<=6?.45:L<=9?.65:.85; if(Math.random()>pUse)return null; const w=(s)=> s===360 ? (L<=3?.1:L<=6?.4:L<=9?.9:1.5) : 1; return this.weightedPick(spins,w);}}
  randomChoice(a){{return a[Math.floor(Math.random()*a.length)];}}
  selectTrick(){{const ob=this.obstaclePool(); const pattern=this.patternPool(ob); const stance=this.stancePool(); const t={{obstacle:ob, stance, pattern}}; if(pattern.includes('flip')){{ if(!this.state.families.has('flips')) return this.selectTrick(); t.flip=this.chooseFlip(); if(!t.flip) return this.selectTrick(); }} if(pattern.includes('grind')){{ if(!this.state.families.has('grinds')) return this.selectTrick(); t.grind=this.chooseGrind(); if(!t.grind) return this.selectTrick(); t.direction=Math.random()<.5?'FS':'BS'; }} if(pattern.includes('manual')){{ if(!this.state.families.has('manuals')) return this.selectTrick(); t.manual=this.chooseManual(); if(!t.manual) return this.selectTrick(); if(ob==='handrail') delete t.manual; }} const sp=this.chooseSpin(); if(sp) t.spin=sp; if(t.flip && t.manual && ob!=='manual pad') delete t.manual; t.signature=this.makeSignature(t); return t; }}
  makeSignature(t){{return ['stance','spin','flip','grind','manual','direction'].map(k=>(t[k]||'').toString().toLowerCase()).join('|');}}
  trickText(t){{const p=[]; if(t.stance && t.stance!=='regular')p.push(t.stance); if(t.spin)p.push(t.spin+'°'); if(t.flip)p.push(t.flip); if(t.grind)p.push((t.direction||'FS')+' '+t.grind); if(t.manual)p.push('to '+t.manual); p.push('on '+t.obstacle); return p.join(' ').replace('  ',' ').trim();}}
  scoreTrick(t,a){{let base=1.0; base+=this.stanceValue(t.stance); base+=this.spinValue(t.spin); base+=this.flipValue(t.flip); if(t.grind){{const gv=this.grindBaseValue(t.grind); const mult=this.grindDirMult(t.grind,t.direction); base+=gv*mult;}} if(t.manual) base+=this.manualValue(t.manual); base+=this.obstacleAdder(t.obstacle); let combo=1.0; if(t.flip&&t.grind) combo*=1.25; if(t.flip&&t.spin) combo*=1.30; if(t.spin&&t.grind) combo*=1.15; if(t.manual&&(t.flip||t.spin)) combo*=1.10; if(t.obstacle==='gap'&&t.flip&&t.spin) combo*=1.10; const attemptM=this.attemptMult(a), flowM=this.flowMult(), repeatM=this.repeatMult(t.signature); const total=Math.round(this.SCALE*base*combo*attemptM*flowM*repeatM); return {{base,combo,attemptM,flowM,repeatM,total}}; }}
}
