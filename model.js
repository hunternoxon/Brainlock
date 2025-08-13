export class BrainlockModel {
  constructor(){ this.SCALE=100; this.reset(); }
  reset(){ this.state={ level:1, mode:'SKATE', soloCount:10,
    stances:new Set(['regular','fakie','nollie','switch']),
    families:new Set(['flips','grinds','manuals','airs','spins']),
    obstacles:new Set(['flat','manual pad','box','curb','ledge','hubba','flatbar','rail','handrail','gap','bank','quarterpipe']),
    flow:0, repeatMap:new Map(), letters:0, score:0, sessionActive:false
  };}
  stanceValue(s){ switch(s){case'Fakie':return.2;default:return 0;} }
  spinValue(x){ return x===360?0.3:(x?0.1:0); }
  flipValue(f){ const m={'kickflip':.3}; return m[f]??0; }
  manualValue(m){ return m==='nose manual'?.3:(m==='manual'?.25:0); }
  grindBaseValue(g){ const m={'50-50':.3}; return m[g]??0; }
  grindDirMult(g,d){ return 1; }
  obstacleAdder(o){ return 0; }
  attemptMult(a){ return a===1?1:a===2?.85:.75; }
  flowMult(){ return 1+Math.min(this.state.flow*.03,.15); }
  repeatMult(sig){ const n=this.state.repeatMap.get(sig)||0; return n<=2?1:Math.max(0,1-.1*(n-2)); }
  legalPatternForObstacle(o){ return ['flip-only','grind-only','flip→grind','manual-only']; }
  randomChoice(a){ return a[Math.floor(Math.random()*a.length)]; }
  sampleSpin(){ return Math.random()<.2?360:180; }
  selectTrick(){
    const stances=[...this.state.stances], fams=[...this.state.families], obstacles=[...this.state.obstacles];
    const ob = this.randomChoice(obstacles);
    const stance = this.randomChoice(stances);
    const data={ obstacle:ob, stance, pattern:'flip-only' };
    data.flip='kickflip'; data.signature=this.makeSignature(data); return data;
  }
  makeSignature(t){ return ['stance','spin','flip','grind','manual','direction'].map(k=>(t[k]||'')+'').join('|'); }
  trickText(t){ const p=[]; if(t.stance!=='regular')p.push(t.stance); if(t.spin)p.push(t.spin+'°'); if(t.flip)p.push(t.flip); if(t.grind)p.push((t.direction||'FS')+' '+t.grind); if(t.manual)p.push('to '+t.manual); p.push('on '+t.obstacle); return p.join(' ').trim(); }
  scoreTrick(t,a){ let base=1; base+=this.stanceValue(t.stance)+this.spinValue(t.spin)+this.flipValue(t.flip);
    const combo=1; const attemptM=this.attemptMult(a), flowM=this.flowMult(), repeatM=this.repeatMult(t.signature);
    const total=Math.round(this.SCALE*base*combo*attemptM*flowM*repeatM); return {base,combo,attemptM,flowM,repeatM,total}; }
}