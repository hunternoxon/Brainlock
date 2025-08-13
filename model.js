// model.js
// Brainlock Trick Model (standalone, reusable)
// Follows your spec for legality, selector, scoring, and gating.
// SCALE controls global tuning of points.
export class BrainlockModel {
  constructor() {
    this.SCALE = 100; // normalize to 100-based difficulty
    this.reset();
  }
  reset() {
    this.state = {
      level: 1,
      mode: 'SKATE', // 'SOLO'
      soloCount: 10,
      stances: new Set(['regular','fakie','nollie','switch']),
      families: new Set(['flips','grinds','manuals','airs','spins']),
      obstacles: new Set(['flat','manual pad','box','curb','ledge','hubba','flatbar','rail','handrail','gap','bank','quarterpipe']),
      flow: 0, // streak lands
      repeatMap: new Map(), // signature -> count
      attempt: 1,
      letters: 0,
      score: 0,
      sessionActive: false,
      history: [],
    };
  }
  // Values largely reflect your deep spec tables
  stanceValue(s) {
    switch (s) {
      case 'fakie': return 0.20; // +20%
      case 'nollie': return 0.25;
      case 'switch': return 0.25;
      default: return 0.00;
    }
  }
  spinValue(spin) {
    if (!spin) return 0;
    return spin === 360 ? 0.30 : 0.10; // 540+ excluded
  }
  flipValue(flip) {
    const map = {
      'kickflip': 0.30, 'heelflip': 0.35, 'hardflip': 0.55, 'inward heelflip': 0.60,
      'tre flip': 0.80, '360 flip': 0.80, 'laser flip': 0.85, 'impossible': 0.90
    };
    return map[flip] ?? 0;
  }
  manualValue(m) { return m === 'manual' ? 0.25 : (m === 'nose manual' ? 0.30 : 0); }
  grindBaseValue(g) {
    const map = {
      '50-50':0.30,'5-0':0.35,'boardslide':0.35,'noseslide':0.40,'tailslide':0.45,'lipslide':0.50,
      'smith':0.60,'feeble':0.65,'crooked':0.70,'nosegrind':0.70,'bluntslide':0.80,'noseblunt':0.90,'overcrook':0.85,'salad':0.65
    };
    return map[g] ?? 0;
  }
  // Direction multipliers for certain grinds/slides
  grindDirMult(g, dir) {
    const tbl = {
      'smith': { FS:1.10, BS:1.20 },
      'feeble': { FS:1.15, BS:1.05 },
      'crooked': { FS:1.12, BS:1.06 },
      'overcrook': { FS:1.18, BS:1.25 },
      'noseblunt': { FS:1.00, BS:1.05 },
      'bluntslide': { FS:1.00, BS:1.05 }
    };
    if (tbl[g]) return tbl[g][dir || 'FS'] || 1;
    return 1;
  }
  obstacleAdder(ob) {
    const map = { 'flat':0, 'manual pad':0.10, 'box':0.10, 'curb':0.15, 'ledge':0.25, 'hubba':0.35, 'flatbar':0.35, 'rail':0.45, 'handrail':0.55, 'gap':0.50, 'bank':0.25, 'quarterpipe':0.45 };
    return map[ob] ?? 0;
  }
  attemptMult(attempt) { return attempt === 1 ? 1.00 : (attempt === 2 ? 0.85 : 0.75); }
  flowMult() { return 1 + Math.min(this.state.flow * 0.03, 0.15); }
  repeatMult(sig) {
    const n = (this.state.repeatMap.get(sig) || 0);
    if (n <= 2) return 1; // penalty starts after 3rd time
    return Math.max(0, 1 - 0.10*(n - 2));
  }
  // Gating
  gate(family, name) {
    const L = this.state.level;
    if (family === 'spins' && name > 360) return false;
    if (name === 'pressure flip' && L < 5) return false;
    // simple gates for rare tricks
    if (name === 'late flip' && L < 7) return false;
    if (name === 'no-comply' && L < 6) return false;
    if (name === 'darkslide' && L < 8) return false;
    if (name && String(name).includes('primo') && L < 7) return false;
    return true;
  }
  // Legality for combinations based on obstacle and pattern
  legalPatternForObstacle(ob) {
    if (ob === 'handrail') return ['grind-only','flip→grind'];
    if (ob === 'ledge' || ob === 'hubba') return ['grind-only','flip→grind','manual-only'];
    if (['flat','gap','bank','quarterpipe','flatbar','rail'].includes(ob)) return ['flip-only','grind-only','flip→grind','manual-only'];
    if (['manual pad','box','curb'].includes(ob)) return ['flip-only','manual-only','grind-only'];
    return ['flip-only'];
  }
  // selector
  randomChoice(arr) { return arr[Math.floor(Math.random()*arr.length)]; }
  sampleSpin() {
    const L = this.state.level;
    const p360 = L <=3 ? 0.08 : (L<=6 ? 0.28 : 0.50);
    return Math.random() < p360 ? 360 : 180;
  }
  selectTrick() {
    // Build pools
    const stances = Array.from(this.state.stances);
    const fams = Array.from(this.state.families);
    const obstacles = Array.from(this.state.obstacles);
    // fallback
    if (obstacles.length === 0) obstacles.push('flat');
    const ob = this.randomChoice(obstacles);
    const patterns = this.legalPatternForObstacle(ob).filter(p => {
      if (p.includes('grind') && !fams.includes('grinds')) return false;
      if (p.includes('manual') && !fams.includes('manuals')) return false;
      if (p.includes('flip') && !fams.includes('flips')) return false;
      return true;
    });
    const pattern = this.randomChoice(patterns);
    const stance = this.randomChoice(stances);
    const data = { obstacle: ob, stance, pattern };

    // Fill parts
    if (pattern.includes('flip')) {
      const flips = ['kickflip','heelflip','hardflip','inward heelflip','360 flip','tre flip','laser flip','impossible']
        .filter(n => this.gate('flips', n));
      data.flip = this.randomChoice(flips);
    }
    if (pattern.includes('grind')) {
      const grinds = ['50-50','5-0','boardslide','noseslide','tailslide','lipslide','smith','feeble','crooked','nosegrind','bluntslide','noseblunt','overcrook','salad'];
      data.grind = this.randomChoice(grinds);
      data.direction = Math.random() < 0.5 ? 'FS' : 'BS';
    }
    if (pattern.includes('manual')) {
      const mans = ['manual','nose manual'];
      data.manual = this.randomChoice(mans);
      // Manual legality: no manuals on handrail
      if (ob === 'handrail') delete data.manual;
    }
    // Optional spin
    if (Math.random() < 0.5 && this.state.families.has('spins')) {
      data.spin = this.sampleSpin();
    }

    // Validate legality specifics
    if (data.manual && ob === 'handrail') delete data.manual;
    // flip to manual legal only on pad
    if (data.flip && data.manual && ob !== 'manual pad') delete data.manual;

    // Signature for repeat tracking
    data.signature = this.makeSignature(data);
    return data;
  }
  makeSignature(t) {
    return ['stance','spin','flip','grind','manual','direction']
      .map(k => (t[k]||'').toString().toLowerCase()).join('|');
  }
  trickText(t) {
    const pieces = [];
    if (t.stance && t.stance!=='regular') pieces.push(t.stance);
    if (t.spin) pieces.push(t.spin + '°');
    if (t.flip) pieces.push(t.flip);
    if (t.grind) pieces.push((t.direction||'FS') + ' ' + t.grind);
    if (t.manual) pieces.push('to ' + t.manual);
    pieces.push('on ' + t.obstacle);
    return pieces.join(' ').replace('  ', ' ').trim();
  }
  // Scoring
  scoreTrick(t, attempt) {
    // additive base
    let base = 1.0;
    base += this.stanceValue(t.stance);
    base += this.spinValue(t.spin);
    base += this.flipValue(t.flip);
    if (t.grind) {
      const gv = this.grindBaseValue(t.grind);
      const mult = this.grindDirMult(t.grind, t.direction);
      base += gv * mult;
    }
    if (t.manual) base += this.manualValue(t.manual);
    base += this.obstacleAdder(t.obstacle);

    // combo multipliers
    let combo = 1.0;
    if (t.flip && t.grind) combo *= 1.25; // flip into grind
    if (t.flip && t.spin) combo *= 1.30;  // spin + flip
    if (t.spin && t.grind) combo *= 1.15; // spin into grind
    if (t.manual && (t.flip || t.spin)) combo *= 1.10;
    if (t.obstacle === 'gap' && t.flip && t.spin) combo *= 1.10;

    const attemptM = this.attemptMult(attempt);
    const flowM = this.flowMult();
    const repeatM = this.repeatMult(t.signature);

    const finalScore = Math.round(this.SCALE * base * combo * attemptM * flowM * repeatM);
    return {
      base, combo, attemptM, flowM, repeatM, total: finalScore
    };
  }
}
