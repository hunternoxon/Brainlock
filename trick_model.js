export default class BrainlockModel {
  constructor() {
    this.cfg = null;
    this.ready = this.loadConfig();
    this.reset();
  }
  async loadConfig() {
    try { const res = await fetch('./model-config.json'); this.cfg = await res.json(); }
    catch (e) { console.warn('cfg load failed', e); this.cfg = {}; }
  }
  reset() {
    const obst = Object.keys(this.cfg?.obstacles || {"flat":{}});
    this.state = {
      level: 1, mode: 'SKATE', soloCount: 10, sessionActive: false,
      stances: new Set(['regular','fakie','nollie','switch']),
      families: new Set(['flips','grinds','manuals','spins']),
      obstacles: new Set(obst),
      sub: {
        flips: new Set(Object.keys(this.cfg?.families?.flips?.subs || {})),
        grinds: new Set(Object.keys(this.cfg?.families?.grinds?.subs || {})),
        manuals: new Set(Object.keys(this.cfg?.families?.manuals?.subs || {})),
        spins: new Set(Object.keys(this.cfg?.families?.spins?.subs || {}))
      },
      flow: 0, repeatMap: new Map(), letters: 0, score: 0,
      why: ''
    };
  }
  weightedPick(items, weightFn){ const arr=items.map(v=>({v,w:Math.max(0,weightFn(v))})); const total=arr.reduce((s,a)=>s+a.w,0); if(total<=0) return null; let r=Math.random()*total; for(const a of arr){ if((r-=a.w)<=0) return a.v; } return arr[arr.length-1]?.v ?? null; }
  stancePool(){ const L=this.state.level-1; const S=this.cfg?.stances||{}; const c=[...this.state.stances].filter(s=>S[s]); return c.length? this.weightedPick(c, s=>S[s].weight_by_level?.[L]??1) : 'regular'; }
  obstaclePool(){ const L=this.state.level-1; const O=this.cfg?.obstacles||{}; const c=[...this.state.obstacles].filter(o=>O[o]); return c.length? this.weightedPick(c, o=>O[o].weight_by_level?.[L]??1) : 'flat'; }
  legalPatternForObstacle(ob){ return this.cfg?.obstacles?.[ob]?.patterns || ['flip-only']; }
  allowedFlipOnObstacle(f, ob, L){ const e=this.cfg?.families?.flips?.subs?.[f]; return !!(e && L>= (e.minLevel||1) && (!e.allowed_obstacles || e.allowed_obstacles.includes(ob))); }
  allowedGrindOnObstacle(g, ob, L){ const e=this.cfg?.families?.grinds?.subs?.[g]; return !!(e && L>= (e.minLevel||1) && (!e.allowed_obstacles || e.allowed_obstacles.includes(ob))); }
  allowedManualOnObstacle(m, ob, L){ const e=this.cfg?.families?.manuals?.subs?.[m]; return !!(e && L>= (e.minLevel||1) && (!e.allowed_obstacles || e.allowed_obstacles.includes(ob))); }
  pickFlip(ob){ const L=this.state.level-1; const subs=[...this.state.sub.flips]; const allowed=subs.filter(s=>this.allowedFlipOnObstacle(s,ob,L+1)); if(!allowed.length) return null; return this.weightedPick(allowed, s=> (this.cfg?.families?.flips?.subs?.[s]?.weight_by_level?.[L] ?? 1)); }
  pickGrind(ob){ const L=this.state.level-1; const subs=[...this.state.sub.grinds]; const allowed=subs.filter(s=>this.allowedGrindOnObstacle(s,ob,L+1)); if(!allowed.length) return null; return this.weightedPick(allowed, s=> (this.cfg?.families?.grinds?.subs?.[s]?.weight_by_level?.[L] ?? 1)); }
  pickManual(ob){ const L=this.state.level-1; const subs=[...this.state.sub.manuals]; const allowed=subs.filter(s=>this.allowedManualOnObstacle(s,ob,L+1)); if(!allowed.length) return null; return this.weightedPick(allowed, s=> (this.cfg?.families?.manuals?.subs?.[s]?.weight_by_level?.[L] ?? 1)); }
  pickSpin(){ if(!this.state.families.has('spins')) return null; const L=this.state.level; const subs=[...this.state.sub.spins]; const allowed=subs.filter(s=> L>=(this.cfg?.families?.spins?.subs?.[s]?.minLevel||1)); if(!allowed.length) return null; const prob=L<=3?.25:L<=6?.45:L<=9?.65:.85; if(Math.random()>prob) return null; return this.weightedPick(allowed, _=>1); }
  patternPool(ob){ const L=this.state.level; const fams=this.state.families; let pats=this.legalPatternForObstacle(ob).filter(p=>{ if(p.includes('flip')&&!fams.has('flips')) return false; if(p.includes('grind')&&!fams.has('grinds')) return false; if(p.includes('manual')&&!fams.has('manuals')) return false; return true; }); if(!pats.length) return null; const w=p=> p==='flip-only'?(L<=4?8:4): p==='manual-only'?(L<=3?6:2): p==='grind-only'?(L<=4?3:6): p==='flip→grind'?(L>=5?(L-3):0):1; return this.weightedPick(pats,w); }
  selectTrick(){
    let tries=0; const why=[];
    while(tries++<20){
      const ob=this.obstaclePool();
      const pat=this.patternPool(ob);
      if(!pat){ why.push(`No legal pattern for obstacle "${ob}" with current families; retry.`); continue; }
      const stance=this.stancePool();
      const t={ obstacle:ob, stance, pattern:pat };
      if(pat.includes('flip')){ t.flip=this.pickFlip(ob); if(!t.flip){ why.push(`No allowed flip on ${ob}; retry.`); continue; } }
      if(pat.includes('grind')){ t.grind=this.pickGrind(ob); if(!t.grind){ why.push(`No allowed grind on ${ob}; retry.`); continue; } t.direction=Math.random()<.5?'FS':'BS'; }
      if(pat.includes('manual')){ t.manual=this.pickManual(ob); if(!t.manual){ why.push(`No allowed manual on ${ob}; retry.`); continue; } if(ob==='handrail') delete t.manual; }
      const sp=this.pickSpin(); if(sp) t.spin=parseInt(sp,10)||sp;
      if(t.flip && t.manual && ob!=='manual pad'){ t.manual=undefined; }
      t.signature=this.makeSignature(t);
      this.state.why = why.concat([`obstacle=${ob}`, `pattern=${pat}`, `stance=${stance}`, `flip=${t.flip||'-'}`, `grind=${t.grind||'-'}`, `manual=${t.manual||'-'}`, `spin=${t.spin||'-'}`]).join('\n');
      return t;
    }
    const ob='flat'; const stance='regular'; const t={ obstacle:ob, stance, pattern:'flip-only', flip:[...this.state.sub.flips][0]||'kickflip' }; t.signature=this.makeSignature(t); this.state.why='fallback after 20 tries'; return t;
  }
  makeSignature(t){ return ['stance','spin','flip','grind','manual','direction'].map(k=>(t[k]||'').toString().toLowerCase()).join('|'); }
  trickText(t){ const p=[]; if(t.stance && t.stance!=='regular') p.push(t.stance); if(t.spin) p.push(t.spin+'°'); if(t.flip) p.push(t.flip); if(t.grind) p.push((t.direction||'FS')+' '+t.grind); if(t.manual) p.push('to '+t.manual); p.push('on '+t.obstacle); return p.join(' ').replace('  ',' ').trim(); }
  stanceValue(s){ return (this.cfg?.scoring?.stance?.[s]||0); }
  spinValue(sp){ if(!sp) return 0; const k=String(sp); return (this.cfg?.scoring?.spin?.[k]||0); }
  flipValue(f){ return (this.cfg?.scoring?.flip?.[f]||0); }
  manualValue(m){ return (this.cfg?.scoring?.manual?.[m]||0); }
  grindBaseValue(g){ return (this.cfg?.scoring?.grind_base?.[g]||0); }
  grindDirMult(g,d){ const t=this.cfg?.scoring?.grind_dir_mult?.[g]; return t?(t[d||'FS']||1):1; }
  obstacleAdder(o){ return (this.cfg?.scoring?.obstacle_add?.[o]||0); }
  attemptMult(a){ return (this.cfg?.scoring?.attempt_mult?.[String(a)]||1); }
  flowMult(){ const cap=this.cfg?.scoring?.flow_mult_cap??.15; const step=this.cfg?.scoring?.flow_step??.03; return 1+Math.min(this.state.flow*step,cap); }
  repeatMult(sig){ const n=(this.state.repeatMap.get(sig)||0); if(n<=2) return 1; return Math.max(0,1-.10*(n-2)); }
  scoreTrick(t,a){ const S=this.cfg?.scoring||{}; const SCALE=S.scale||100; let base=1.0; base+=this.stanceValue(t.stance)+this.spinValue(t.spin)+this.flipValue(t.flip); if(t.grind){ base+=this.grindBaseValue(t.grind)*this.grindDirMult(t.grind,t.direction);} if(t.manual){base+=this.manualValue(t.manual);} base+=this.obstacleAdder(t.obstacle); let combo=1.0; if(t.flip&&t.grind) combo*=(S.combo_mult?.['flip&grind']||1); if(t.flip&&t.spin) combo*=(S.combo_mult?.['flip&spin']||1); if(t.spin&&t.grind) combo*=(S.combo_mult?.['spin&grind']||1); if(t.manual&&(t.flip||t.spin)) combo*=(S.combo_mult?.['manual&(flip|spin)']||1); if(t.obstacle==='gap'&&t.flip&&t.spin) combo*=(S.combo_mult?.['gap&flip&spin']||1); const total=Math.round(SCALE*base*this.attemptMult(a)*this.flowMult()*this.repeatMult(t.signature)*combo); return {base,combo,attemptM:this.attemptMult(a),flowM:this.flowMult(),repeatM:this.repeatMult(t.signature),total}; }
}