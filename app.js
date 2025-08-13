// app.js
export class BrainlockApp {
  constructor(model, opts) {
    this.model = model;
    this.version = opts?.version || 'dev';
    this.ui = this.qs();
    this.restore();
    this.bind();
    this.updateHUD();
  }
  qs() {
    const g = (id) => document.getElementById(id);
    return {
      trickText: g('trickText'),
      subText: g('subText'),
      levelBadge: g('levelBadge'),
      modeBadge: g('modeBadge'),
      scoreVal: g('scoreVal'),
      highVal: g('highVal'),
      streakVal: g('streakVal'),
      skateLetters: g('skateLetters'),
      startBtn: g('startBtn'),
      nextBtn: g('nextBtn'),
      landBtn: g('landBtn'),
      missBtn: g('missBtn'),
      skipBtn: g('skipBtn'),
      endBtn: g('endBtn'),
      settingsBtn: g('settingsBtn'),
      settingsDlg: g('settingsDlg'),
      closeSettings: g('closeSettings'),
      dbgBtn: g('dbgBtn'),
      dbgDlg: g('dbgDlg'),
      dbgOut: g('dbgOut'),
      levelRange: g('levelRange'),
      levelVal: g('levelVal'),
      stances: g('stances'),
      families: g('families'),
      obstacles: g('obstacles'),
      soloCountWrap: g('soloCountWrap'),
      soloCount: g('soloCount'),
      soloCountVal: g('soloCountVal'),
      clearScores: g('clearScores'),
      toggleAdmin: g('toggleAdmin'),
      clearCaches: g('clearCaches')
    };
  }
  bind() {
    const U = this.ui;
    // Top buttons
    U.settingsBtn.onclick = () => U.settingsDlg.showModal();
    U.closeSettings.onclick = () => U.settingsDlg.close();
    U.dbgBtn.onclick = () => U.dbgDlg.showModal();
    document.getElementById('closeDbg').onclick = () => U.dbgDlg.close();

    // Buttons
    U.startBtn.onclick = () => this.startSession();
    U.nextBtn.onclick = () => this.next();
    U.landBtn.onclick = () => this.land();
    U.missBtn.onclick = () => this.miss();
    U.skipBtn.onclick = () => this.skip();
    U.endBtn.onclick = () => this.endSession();

    // Options
    U.levelRange.oninput = (e) => { 
      this.model.state.level = Number(e.target.value);
      U.levelVal.textContent = this.model.state.level;
      this.persist(); this.updateHUD();
    };

    U.soloCount.oninput = (e) => {
      this.model.state.soloCount = Number(e.target.value);
      U.soloCountVal.textContent = this.model.state.soloCount;
      this.persist();
    };

    // Mode toggles
    U.settingsDlg.querySelectorAll('[data-mode]').forEach(el => {
      el.onclick = () => {
        U.settingsDlg.querySelectorAll('[data-mode]').forEach(x => x.classList.remove('on'));
        el.classList.add('on');
        const mode = el.dataset.mode;
        this.model.state.mode = mode;
        U.modeBadge.textContent = 'Mode: ' + mode;
        U.soloCountWrap.classList.toggle('hidden', mode!=='SOLO');
        this.persist();
      }
    });

    // Admin & caches
    U.clearScores.onclick = () => { 
      localStorage.removeItem('brainlock:highscores'); 
      this.high = []; this.updateHUD(); 
      alert('High scores cleared');
    };
    U.toggleAdmin.onclick = () => {
      this.admin = !this.admin; localStorage.setItem('brainlock:admin', this.admin ? '1':'0');
      alert('Admin ' + (this.admin?'enabled':'disabled'));
    };
    U.clearCaches.onclick = async () => {
      if ('caches' in window) { const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); }
      alert('Cache cleared. Reload recommended.');
    };

    // Dynamic chips
    this.renderChips('stances', ['regular','fakie','nollie','switch'], this.model.state.stances);
    this.renderChips('families', ['flips','grinds','manuals','airs','spins'], this.model.state.families);
    this.renderChips('obstacles', ['flat','manual pad','box','curb','ledge','hubba','flatbar','rail','handrail','gap','bank','quarterpipe'], this.model.state.obstacles);
  }
  renderChips(key, items, set) {
    const el = this.ui[key];
    el.innerHTML = '';
    items.forEach(name => {
      const chip = document.createElement('div');
      chip.className = 'toggle' + (set.has(name)?' on':'');
      chip.textContent = name;
      chip.onclick = () => { 
        if (set.has(name)) set.delete(name); else set.add(name);
        chip.classList.toggle('on');
        this.persist();
      };
      el.appendChild(chip);
    });
  }
  formatLetters(n) {
    const letters = Array.from(this.ui.skateLetters.children);
    letters.forEach((span, i) => span.classList.toggle('on', i < n));
  }
  restore() {
    this.high = JSON.parse(localStorage.getItem('brainlock:highscores')||'[]');
    this.admin = localStorage.getItem('brainlock:admin')==='1';
    // load settings
    const s = JSON.parse(localStorage.getItem('brainlock:settings')||'null');
    if (s) {
      Object.assign(this.model.state, s);
      this.ui.levelRange.value = this.model.state.level;
      this.ui.levelVal.textContent = this.model.state.level;
      this.ui.soloCount.value = this.model.state.soloCount;
      this.ui.soloCountVal.textContent = this.model.state.soloCount;
      // restore sets
      if (s.stances) this.model.state.stances = new Set(s.stances);
      if (s.families) this.model.state.families = new Set(s.families);
      if (s.obstacles) this.model.state.obstacles = new Set(s.obstacles);
    }
  }
  persist() {
    const { level, mode, soloCount } = this.model.state;
    localStorage.setItem('brainlock:settings', JSON.stringify({
      level, mode, soloCount,
      stances: Array.from(this.model.state.stances),
      families: Array.from(this.model.state.families),
      obstacles: Array.from(this.model.state.obstacles)
    }));
  }
  updateHUD() {
    this.ui.levelBadge.textContent = 'Level ' + this.model.state.level;
    this.ui.modeBadge.textContent = 'Mode: ' + this.model.state.mode;
    this.ui.scoreVal.textContent = this.model.state.score;
    this.ui.highVal.textContent = (this.high[0]?.value)||0;
    this.ui.streakVal.textContent = this.model.state.flow;
    this.formatLetters(this.model.state.letters);
    // Toggle Next visibility per spec: show Next only after a result
    const hasNext = !!this.nextReady;
    this.ui.nextBtn.classList.toggle('hidden', !hasNext);
    // Hide Skip/Miss/Land when Next visible
    this.ui.landBtn.classList.toggle('hidden', hasNext);
    this.ui.missBtn.classList.toggle('hidden', hasNext);
    this.ui.skipBtn.classList.toggle('hidden', hasNext);
  }
  startSession() {
    // Reset but keep settings
    const cfg = JSON.parse(localStorage.getItem('brainlock:settings')||'null');
    this.model.reset();
    if (cfg) {
      this.model.state.level = cfg.level;
      this.model.state.mode = cfg.mode;
      this.model.state.soloCount = cfg.soloCount;
      this.model.state.stances = new Set(cfg.stances||['regular','fakie','nollie','switch']);
      this.model.state.families = new Set(cfg.families||['flips','grinds','manuals','airs','spins']);
      this.model.state.obstacles = new Set(cfg.obstacles||['flat']);
    }
    this.attempts = 0;
    this.countDone = 0;
    this.nextReady = false;
    this.pushNextTrick();
  }
  pushNextTrick() {
    const t = this.model.selectTrick();
    this.current = t;
    this.attempts = 0;
    this.nextReady = false;
    this.ui.trickText.textContent = this.model.trickText(t);
    this.ui.subText.textContent = 'Attempt 1 of 3';
    this.updateHUD();
    this.debugDump();
  }
  land() {
    if (!this.current) return;
    this.attempts = Math.min(3, (this.attempts||0)+1);
    const breakdown = this.model.scoreTrick(this.current, this.attempts);
    this.model.state.score += breakdown.total;
    this.model.state.flow += 1;
    // track repeat
    const count = (this.model.state.repeatMap.get(this.current.signature)||0)+1;
    this.model.state.repeatMap.set(this.current.signature, count);
    this.ui.subText.textContent = `+${breakdown.total} (base ${breakdown.base.toFixed(2)} × combo ${breakdown.combo.toFixed(2)} × attempt ${breakdown.attemptM.toFixed(2)} × flow ${breakdown.flowM.toFixed(2)} × repeat ${breakdown.repeatM.toFixed(2)})`;
    this.nextReady = true;
    this.updateHUD();
  }
  miss() {
    if (!this.current) return;
    this.attempts = Math.min(3, (this.attempts||0)+1);
    if (this.attempts >= 3) {
      // Letter
      this.model.state.flow = 0;
      this.model.state.letters = Math.min(5, this.model.state.letters + 1);
      this.ui.subText.textContent = 'Missed 3× → +1 letter';
      this.nextReady = true;
      if (this.model.state.mode === 'SKATE' && this.model.state.letters >= 5) return this.endSession();
    } else {
      this.ui.subText.textContent = `Miss (attempt ${this.attempts} of 3)`;
    }
    this.updateHUD();
  }
  skip() {
    // No points, move to next trick immediately
    this.model.state.flow = 0;
    this.ui.subText.textContent = 'Skipped';
    this.next();
  }
  next() {
    // Progress counter for SOLO mode
    if (this.model.state.mode === 'SOLO') {
      this.countDone = (this.countDone||0) + 1;
      if (this.countDone >= this.model.state.soloCount) return this.endSession();
    }
    this.pushNextTrick();
  }
  endSession() {
    this.nextReady = false;
    const score = this.model.state.score;
    const entry = { id: Date.now(), value: score, created_at: new Date().toISOString() };
    this.high.push(entry);
    this.high.sort((a,b)=>b.value-a.value);
    this.high = this.high.slice(0,100);
    localStorage.setItem('brainlock:highscores', JSON.stringify(this.high));
    this.ui.trickText.textContent = 'Session Over';
    this.ui.subText.textContent = 'Final: ' + score + ' — High: ' + (this.high[0]?.value);
    this.updateHUD();
  }
  debugDump() {
    const t = this.current;
    if (!t) return;
    const lines = [
      'Build ' + this.version,
      JSON.stringify(t, null, 2)
    ];
    this.ui.dbgOut.textContent = lines.join('\n');
  }
}
