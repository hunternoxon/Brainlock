// app.js (v2 with tray states, options sheet, attempts, score peek)
export class BrainlockApp {
  constructor(model, opts) {
    this.model = model;
    this.version = opts?.version || 'dev';
    this.ui = this.qs();
    this.restore();
    this.bind();
    this.setTray('start');
    this.updateHUD();
  }
  qs() {
    const g = (id) => document.getElementById(id);
    return {
      trickText: g('trickText'), subText: g('subText'),
      levelBadge: g('levelBadge'), modeBadge: g('modeBadge'),
      scoreVal: g('scoreVal'), highVal: g('highVal'), streakVal: g('streakVal'),
      skateLetters: g('skateLetters'), attemptDots: g('attemptDots'), scorePeek: g('scorePeek'),
      trayStart: g('trayStart'), trayActive: g('trayActive'), trayLanded: g('trayLanded'), trayMissed: g('trayMissed'), trayOver: g('trayOver'),
      optionsBtn: g('optionsBtn'), endBtnTop: g('endBtnTop'), startBtn: g('startBtn'), endBtn: g('endBtn'),
      landBtn: g('landBtn'), missBtn: g('missBtn'), skipBtn: g('skipBtn'), endBtn2: g('endBtn2'),
      nextBtnLanded: g('nextBtnLanded'), endBtn3: g('endBtn3'), nextBtnMissed: g('nextBtnMissed'), endBtn4: g('endBtn4'),
      restartBtn: g('restartBtn'), endBtn5: g('endBtn5'),
      // options sheet
      optionsDlg: g('optionsDlg'), closeOptions: g('closeOptions'), optTabs: g('optTabs'),
      levelRange: g('levelRange'), levelVal: g('levelVal'), soloCount: g('soloCount'), soloCountVal: g('soloCountVal'),
      stances: g('stances'), families: g('families'), obstacles: g('obstacles'),
      // settings
      settingsBtn: g('settingsBtn'), settingsDlg: g('settingsDlg'), closeSettings: g('closeSettings'),
      clearScores: g('clearScores'), toggleAdmin: g('toggleAdmin'), clearCaches: g('clearCaches'),
      nickInput: g('nickInput'), fbInput: g('fbInput'), saveFeedback: g('saveFeedback'),
      // score breakdown + debug
      scoreDlg: g('scoreDlg'), scoreOut: g('scoreOut'), closeScore: g('closeScore'),
      dbgBtn: g('dbgBtn'), dbgDlg: g('dbgDlg'), dbgOut: g('dbgOut'), closeDbg: g('closeDbg')
    };
  }
  bind() {
    const U = this.ui;
    // Options bottom sheet
    U.optionsBtn.onclick = () => U.optionsDlg.showModal();
    U.closeOptions.onclick = () => U.optionsDlg.close();
    U.optTabs.addEventListener('click', (e)=>{
      const t = e.target.closest('.tab'); if(!t) return;
      U.optTabs.querySelectorAll('.tab').forEach(x=>x.classList.remove('on')); t.classList.add('on');
      document.querySelectorAll('.sheet-body').forEach(p=>p.classList.toggle('on', p.dataset.page===t.dataset.tab));
    });
    // Mode
    U.optionsDlg.querySelectorAll('[data-mode]').forEach(el=>{
      el.onclick = ()=>{
        U.optionsDlg.querySelectorAll('[data-mode]').forEach(x=>x.classList.remove('on'));
        el.classList.add('on'); this.model.state.mode = el.dataset.mode;
        U.modeBadge.textContent = 'Mode: ' + this.model.state.mode; this.persist();
      };
    });
    // Ranges
    U.levelRange.oninput = (e)=>{ this.model.state.level=+e.target.value; U.levelVal.textContent=this.model.state.level; this.persist(); this.updateHUD(); };
    U.soloCount.oninput = (e)=>{ this.model.state.soloCount=+e.target.value; U.soloCountVal.textContent=this.model.state.soloCount; this.persist(); };

    // Settings
    U.settingsBtn.onclick=()=>U.settingsDlg.showModal();
    U.closeSettings.onclick=()=>U.settingsDlg.close();
    U.saveFeedback.onclick=()=>{ const fb=U.fbInput.value?.trim(); if(fb){ const arr=JSON.parse(localStorage.getItem('brainlock:feedback')||'[]'); arr.push({at:new Date().toISOString(),nick:U.nickInput.value||'',text:fb}); localStorage.setItem('brainlock:feedback',JSON.stringify(arr)); alert('Saved locally ✅'); U.fbInput.value=''; } };
    U.nickInput.oninput=()=>localStorage.setItem('brainlock:nick', U.nickInput.value||'');
    U.clearScores.onclick=()=>{ localStorage.removeItem('brainlock:highscores'); this.high=[]; this.updateHUD(); alert('High scores cleared'); };
    U.toggleAdmin.onclick=()=>{ this.admin=!this.admin; localStorage.setItem('brainlock:admin', this.admin?'1':'0'); alert('Admin '+(this.admin?'enabled':'disabled')); };
    U.clearCaches.onclick=async()=>{ if('caches' in window){const keys=await caches.keys(); await Promise.all(keys.map(k=>caches.delete(k)));} alert('Cache cleared. Reload recommended.'); };

    // Debug
    U.dbgBtn.onclick=()=>U.dbgDlg.showModal();
    U.closeDbg.onclick=()=>U.dbgDlg.close();

    // Game controls
    const endAny=()=>this.endSession();
    U.endBtnTop.onclick=endAny; U.endBtn.onclick=endAny; U.endBtn2.onclick=endAny; U.endBtn3.onclick=endAny; U.endBtn4.onclick=endAny; U.endBtn5.onclick=endAny;
    U.startBtn.onclick=()=>this.startSession();
    U.restartBtn.onclick=()=>this.startSession();
    U.landBtn.onclick=()=>this.land();
    U.missBtn.onclick=()=>this.miss();
    U.skipBtn.onclick=()=>this.skip();
    U.nextBtnLanded.onclick=()=>this.next();
    U.nextBtnMissed.onclick=()=>this.next();

    // Chips (label→key for families with Flip Tricks)
    this.renderChips('stances', ['regular','fakie','nollie','switch'], this.model.state.stances, x=>x);
    const famLabels = ['Flip Tricks','Grinds','Manuals','Airs','Spins'];
    const famKey = l => ({'Flip Tricks':'flips','Grinds':'grinds','Manuals':'manuals','Airs':'airs','Spins':'spins'})[l]||l;
    this.renderChips('families', famLabels, this.model.state.families, famKey);
    this.renderChips('obstacles', ['flat','manual pad','box','curb','ledge','hubba','flatbar','rail','handrail','gap','bank','quarterpipe'], this.model.state.obstacles, x=>x);

    // Score peek
    U.scorePeek.onclick=()=>this.openScoreBreakdown();
  }
  renderChips(containerId, labels, set, toKey) {
    const el = this.ui[containerId]; el.innerHTML='';
    labels.forEach(label=>{
      const key = toKey(label); const active=set.has(key);
      const chip = document.createElement('div'); chip.className='toggle'+(active?' on':''); chip.textContent=label;
      chip.onclick=()=>{ if(set.has(key)) set.delete(key); else set.add(key); chip.classList.toggle('on'); this.persist(); };
      el.appendChild(chip);
    });
  }
  setTray(state) {
    this.trayState = state;
    const on = (el, bool)=>el.classList.toggle('hidden', !bool);
    on(this.ui.trayStart, state==='start');
    on(this.ui.trayActive, state==='active');
    on(this.ui.trayLanded, state==='landed');
    on(this.ui.trayMissed, state==='missed');
    on(this.ui.trayOver, state==='over');
  }
  formatLetters(n){ Array.from(this.ui.skateLetters.children).forEach((s,i)=>s.classList.toggle('on', i<n)); }
  renderAttempts(){
    const wrap=this.ui.attemptDots; wrap.innerHTML='';
    const current=Math.max(1, this.attempts||0);
    for(let i=1;i<=3;i++){ const dot=document.createElement('div'); dot.className='attempt-dot'; if(i===current && this.trayState==='active') dot.classList.add('active');
      if(this.missHistory?.includes(i)){ const m=document.createElement('div'); m.className='mark'; m.textContent='×'; dot.classList.add('missed'); dot.appendChild(m); }
      if(this.trayState==='landed' && this.landHistory?.includes(i)){ const m=document.createElement('div'); m.className='mark'; m.textContent='✓'; dot.classList.add('landed'); dot.appendChild(m); }
      wrap.appendChild(dot);
    }
  }
  restore(){
    this.high=JSON.parse(localStorage.getItem('brainlock:highscores')||'[]');
    this.admin=localStorage.getItem('brainlock:admin')==='1';
    const s=JSON.parse(localStorage.getItem('brainlock:settings')||'null');
    if(s){ this.model.state.level=s.level??1; this.model.state.mode=s.mode??'SKATE'; this.model.state.soloCount=s.soloCount??10;
      this.model.state.stances=new Set(s.stances||['regular','fakie','nollie','switch']);
      this.model.state.families=new Set(s.families||['flips','grinds','manuals','airs','spins']);
      this.model.state.obstacles=new Set(s.obstacles||['flat']); }
    this.ui.nickInput && (this.ui.nickInput.value = localStorage.getItem('brainlock:nick')||'');
  }
  persist(){
    const {level,mode,soloCount}=this.model.state;
    localStorage.setItem('brainlock:settings', JSON.stringify({ level, mode, soloCount,
      stances:[...this.model.state.stances], families:[...this.model.state.families], obstacles:[...this.model.state.obstacles] }));
  }
  updateHUD(){
    this.ui.levelBadge.textContent='Level '+this.model.state.level;
    this.ui.modeBadge.textContent='Mode: '+this.model.state.mode;
    this.ui.scoreVal.textContent=this.model.state.score;
    this.ui.highVal.textContent=(this.high[0]?.value)||0;
    this.ui.streakVal.textContent=this.model.state.flow;
    this.formatLetters(this.model.state.letters);
    this.renderAttempts();
    this.updateScorePeek();
  }
  startSession(){
    const cfg=JSON.parse(localStorage.getItem('brainlock:settings')||'null');
    this.model.reset();
    if(cfg){ this.model.state.level=cfg.level; this.model.state.mode=cfg.mode; this.model.state.soloCount=cfg.soloCount;
      this.model.state.stances=new Set(cfg.stances||['regular','fakie','nollie','switch']);
      this.model.state.families=new Set(cfg.families||['flips','grinds','manuals','airs','spins']);
      this.model.state.obstacles=new Set(cfg.obstacles||['flat']); }
    this.attempts=1; this.countDone=0; this.missHistory=[]; this.landHistory=[];
    this.pushNextTrick(); this.setTray('active');
  }
  pushNextTrick(){
    const t=this.model.selectTrick();
    this.current=t; this.attempts=1; this.missHistory=[]; this.landHistory=[];
    this.ui.trickText.textContent=this.model.trickText(t);
    this.ui.subText.textContent='Attempt 1 of 3';
    this.updateHUD(); this.debugDump();
  }
  land(){
    if(!this.current) return;
    const b=this.model.scoreTrick(this.current, this.attempts);
    this.model.state.score += b.total; this.model.state.flow += 1;
    const count=(this.model.state.repeatMap.get(this.current.signature)||0)+1; this.model.state.repeatMap.set(this.current.signature,count);
    this.ui.subText.textContent = `+${b.total} (tap score for breakdown)`;
    this.landHistory.push(this.attempts);
    this.setTray('landed'); this.updateHUD();
  }
  miss(){
    if(!this.current) return;
    this.missHistory.push(this.attempts);
    if(this.attempts>=3){
      this.model.state.flow=0; this.model.state.letters=Math.min(5,this.model.state.letters+1);
      this.ui.subText.textContent='Missed 3× → +1 letter';
      if(this.model.state.mode==='SKATE' && this.model.state.letters>=5) return this.endSession();
      this.setTray('missed');
    }else{
      this.attempts+=1; this.ui.subText.textContent=`Miss (attempt ${this.attempts} of 3)`; this.setTray('active');
    }
    this.updateHUD();
  }
  skip(){ this.model.state.flow=0; this.ui.subText.textContent='Skipped'; this.next(); }
  next(){
    if(this.model.state.mode==='SOLO'){ this.countDone=(this.countDone||0)+1; if(this.countDone>=this.model.state.soloCount) return this.endSession(); }
    this.pushNextTrick(); this.setTray('active');
  }
  endSession(){
    const score=this.model.state.score; const entry={id:Date.now(), value:score, created_at:new Date().toISOString()};
    this.high.push(entry); this.high.sort((a,b)=>b.value-a.value); this.high=this.high.slice(0,100);
    localStorage.setItem('brainlock:highscores', JSON.stringify(this.high));
    this.ui.trickText.textContent='Session Over'; this.ui.subText.textContent='Final: '+score+' — High: '+(this.high[0]?.value);
    this.setTray('over'); this.updateHUD();
  }
  predictedScore(){ if(!this.current||!this.attempts) return null; return this.model.scoreTrick(this.current, this.attempts); }
  updateScorePeek(){ const p=this.predictedScore(); this.ui.scorePeek.textContent = p?`This attempt: +${p.total}`:''; }
  openScoreBreakdown(){
    const b=this.predictedScore(); if(!b) return;
    this.ui.scoreOut.textContent = ['If you land now:',
      `Base: ${b.base.toFixed(2)}`, `Combo: ×${b.combo.toFixed(2)}`, `Attempt: ×${b.attemptM.toFixed(2)}`,
      `Flow: ×${b.flowM.toFixed(2)}`, `Repeat: ×${b.repeatM.toFixed(2)}`, `Total: ${b.total}`].join('\n');
    document.getElementById('scoreDlg').showModal();
    document.getElementById('closeScore').onclick=()=>document.getElementById('scoreDlg').close();
  }
  debugDump(){ const t=this.current; if(!t) return; this.ui.dbgOut.textContent=['Build '+this.version, JSON.stringify(t,null,2)].join('\n'); }
}
