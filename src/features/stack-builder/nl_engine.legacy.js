export class NLParser {
  constructor(tables){ this.tables = tables || {}; this.alias = this.tables.aliases || {}; }
  norm(s){ return (s||'').toLowerCase().replace(/\s+/g,' ').trim(); }
  aliasWord(w){ const a=this.alias; return a[w]||w; }
  tokenize(s){
    s = this.norm(s).replace(/\b50\s*50\b/g, '50-50');
    const toks = s.split(/\s+/).map(t=>this.aliasWord(t));
    const out=[];
    for(let i=0;i<toks.length;i++){
      const a=toks[i], b=toks[i+1]||''; const pair=a+' '+b;
      if(['nose manual','backside flip','frontside flip','varial kickflip','varial heelflip','tre flip','360 flip','primo slide'].includes(pair)){ out.push(pair); i++; continue; }
      out.push(a);
    }
    return out;
  }
  parse(input){
    const toks=this.tokenize(input);
    const res={ stance:null, direction:null, flips:[], grind:null, manual:null, obstacle:null, impliedObstacle:null, tokens:toks.slice() };
    for(let i=0;i<toks.length;i++){
      const t=toks[i];
      if(['fakie','nollie','switch','regular'].includes(t)){ res.stance=t; continue; }
      if(t==='frontside'||t==='backside'){ res.direction=(t==='frontside'?'FS':'BS'); continue; }
      if(this.tables.obstacle_bonus && this.tables.obstacle_bonus[t]!==undefined){ res.obstacle=t; continue; }
      if(this.tables.flip_tricks && this.tables.flip_tricks[t]!==undefined){ res.flips.push(t); continue; }
      if(this.tables.grinds && this.tables.grinds[t]!==undefined){ res.grind=t; continue; }
      if(this.tables.manuals && this.tables.manuals[t]!==undefined){ res.manual=t; continue; }
      if(t==='flip' && toks[i+1]==='out'){ res.flips.push((res.direction==='BS'?'backside flip':'frontside flip')); i++; continue; }
    }
    if(res.grind && !res.direction){ const map=this.tables.direction_default||{}; res.direction = map[res.grind] || 'FS'; }
    if(res.grind && !res.obstacle){ res.impliedObstacle='ledge'; }
    if(res.manual && !res.obstacle){ res.impliedObstacle='manual pad'; }
    return res;
  }
}

export class NLScorer {
  constructor(tables){ this.t=tables||{}; }
  stanceMult(stance){ return (this.t.stance_multiplier?.[stance||'regular']??1.0); }
  scoreFlip(name){ return this.t.flip_tricks?.[name]??0; }
  scoreGrind(name){ return this.t.grinds?.[name]??0; }
  scoreManual(name){ return this.t.manuals?.[name]??0; }
  bonusObstacle(name){ return (this.t.obstacle_bonus?.[name]??0); }
  fromStructured(trick){
    const flips = []; if(trick.flip) flips.push(trick.flip);
    const grind = trick.grind||null;
    const manual = trick.manual||null;
    const stance = trick.stance||'regular';
    const obstacle = trick.obstacle||null;
    const direction = trick.direction||null;
    const impliedObstacle = (!obstacle && grind) ? 'ledge' : (!obstacle && manual ? 'manual pad' : null);
    return {stance, flips, grind, manual, obstacle, impliedObstacle, direction};
  }
  evalParts(parts){
    let sum=0; const detail=[]; const st=parts.stance||'regular';
    for(const f of (parts.flips||[])){ const v=this.scoreFlip(f); sum+=v; detail.push(`Flip Trick: ${f} = ${v}`); }
    if(parts.grind){ const v=this.scoreGrind(parts.grind); sum+=v; detail.push(`Grind/Slide: ${parts.grind} = ${v}`); }
    if(parts.manual){ const v=this.scoreManual(parts.manual); sum+=v; detail.push(`Manual: ${parts.manual} = ${v}`); }
    const obs = parts.obstacle || parts.impliedObstacle; let bonus=0;
    if(obs){ bonus=this.bonusObstacle(obs); sum+=bonus; detail.push(`Obstacle bonus: ${obs} = +${bonus}`); }
    const mult=this.stanceMult(st); const total=sum*mult; detail.push(`Stance: ${st} ×${mult.toFixed(2)}`);
    return {sum, mult, total, breakdown: detail.join('\n')};
  }
  scoreStructured(trick, attempt=1, flow=0, repeatM=1.0){
    const parts=this.fromStructured(trick);
    const base=this.evalParts(parts);
    const attemptM = attempt===1?1.00: attempt===2?0.85: 0.75;
    const flowM = 1+Math.min(flow*0.03, 0.15);
    const total = Math.round(base.total * attemptM * flowM * repeatM * 10);
    return { base:base.total, combo:1.0, attemptM, flowM, repeatM, total, parts, detail:base.breakdown };
  }
}