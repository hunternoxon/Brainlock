export default class BrainlockApp {
  constructor(model, opts) {
    this.model = model;
    this.version = opts?.version || 'dev';
    this.ui = this.qs();
    this.restore();
    this.bind();
    this.setTray('start');
    this.updateHUD();
  }
  qs(){ const g=id=>document.getElementById(id); return {
    skateTop:g('skateTop'), trickText:g('trickText'), subText:g('subText'),
    levelBadge:g('levelBadge'), modeBadge:g('modeBadge'),
    scoreVal:g('scoreVal'), highVal:g('highVal'), streakVal:g('streakVal'),
    attemptDots:g('attemptDots'), scorePeek:g('scorePeek'),
    optionsBtn:g('optionsBtn'), endBtnModule:g('endBtnModule'),
    trayStart:g('trayStart'), trayActive:g('trayActive'), trayLanded:g('trayLanded'), trayMissed:g('trayMissed'), trayOver:g('trayOver'),
    startBtn:g('startBtn'), landBtn:g('landBtn'), missBtn:g('missBtn'), skipBtn:g('skipBtn'), nextBtnLanded:g('nextBtnLanded'), nextBtnMissed:g('nextBtnMissed'), restartBtn:g('restartBtn'),
    optionsDlg:g('optionsDlg'), closeOptions:g('closeOptions'), optTabs:g('optTabs'),
    levelRange:g('levelRange'), levelVal:g('levelVal'), soloCount:g('soloCount'), soloCountVal:g('soloCountVal'),
    stances:g('stances'), obstacles:g('obstacles'), catsWrap:g('catsWrap'),
    settingsBtn:g('settingsBtn'), settingsDlg:g('settingsDlg'), closeSettings:g('closeSettings'),
    clearScores:g('clearScores'), toggleAdmin:g('toggleAdmin'), clearCaches:g('clearCaches'),
    nickInput:g('nickInput'), fbInput:g('fbInput'), saveFeedback:g('saveFeedback'),
    scoreDlg:g('scoreDlg'), closeScore:g('closeScore'), scoreOut:g('scoreOut'),
    dbgBtn:g('dbgBtn'), dbgDlg:g('dbgDlg'), closeDbg:g('closeDbg'), dbgOut:g('dbgOut'), whyOut:g('whyOut')
  };}
  bind(){ const U=this.ui;
    U.optionsBtn.onclick=()=>U.optionsDlg.showModal();
    U.closeOptions.onclick=()=>U.optionsDlg.close();
    U.optTabs.addEventListener('click',e=>{const t=e.target.closest('.tab'); if(!t) return; U.optTabs.querySelectorAll('.tab').forEach(x=>x.classList.remove('on')); t.classList.add('on'); const page=t.dataset.tab; document.querySelectorAll('.sheet-body').forEach(p=>p.classList.toggle('on', p.dataset.page===page));});
    U.levelRange.oninput=e=>{this.model.state.level=+e.target.value; U.levelVal.textContent=this.model.state.level; this.persist(); this.updateHUD();};
    U.soloCount.oninput=e=>{this.model.state.soloCount=+e.target.value; U.soloCountVal.textContent=this.model.state.soloCount; this.persist();};
    U.optionsDlg.querySelectorAll('[data-mode]').forEach(el=>{el.onclick=()=>{U.optionsDlg.querySelectorAll('[data-mode]').forEach(x=>x.classList.remove('on')); el.classList.add('on'); this.model.state.mode=el.dataset.mode; this.persist(); this.updateHUD();};});
    this.renderChips(U.stances, ['regular','fakie','nollie','switch'], this.model.state.stances);
    this.renderChips(U.obstacles, Object.keys(this.model.cfg?.obstacles||{flat:1}), this.model.state.obstacles);
    this.renderCategories();
    U.settingsBtn.onclick=()=>U.settingsDlg.showModal();
    U.closeSettings.onclick=()=>U.settingsDlg.close();
    U.saveFeedback.onclick=()=>{const fb=U.fbInput.value?.trim(); if(fb){ const arr=JSON.parse(localStorage.getItem('brainlock:feedback')||'[]'); arr.push({at:new Date().toISOString(),nick:U.nickInput.value||'',text:fb}); localStorage.setItem('brainlock:feedback',JSON.stringify(arr)); alert('Saved locally ✅'); U.fbInput.value=''; }};
    U.nickInput.oninput=()=>localStorage.setItem('brainlock:nick',U.nickInput.value||'');
    U.clearScores.onclick=()=>{ localStorage.removeItem('brainlock:highscores'); this.high=[]; this.updateHUD(); alert('High scores cleared'); };
    U.toggleAdmin.onclick=()=>{ this.admin=!this.admin; localStorage.setItem('brainlock:admin', this.admin?'1':'0'); alert('Admin '+(this.admin?'enabled':'disabled')); };
    U.clearCaches.onclick=async()=>{ if('caches' in window){ const keys=await caches.keys(); await Promise.all(keys.map(k=>caches.delete(k))); } alert('Cache cleared. Reload recommended.'); };
    U.startBtn.onclick=()=>this.startSession(); U.restartBtn.onclick=()=>this.startSession();
    U.landBtn.onclick=()=>this.land(); U.missBtn.onclick=()=>this.miss(); U.skipBtn.onclick=()=>this.skip();
    U.nextBtnLanded.onclick=()=>this.next(); U.nextBtnMissed.onclick=()=>this.next();
    U.scorePeek.onclick=()=>this.openScoreBreakdown();
    U.dbgBtn.onclick=()=>{ U.dbgDlg.showModal(); this.dumpWhy(); };
    U.closeDbg.onclick=()=>U.dbgDlg.close();
  }
  renderChips(container, labels, set){ container.innerHTML=''; labels.forEach(label=>{ const active=set.has(label); const chip=document.createElement('div'); chip.className='toggle'+(active?' on':''); chip.textContent=label; chip.onclick=()=>{ if(set.has(label)) set.delete(label); else set.add(label); chip.classList.toggle('on'); this.persist(); }; container.appendChild(chip); }); }
  renderCategories(){ const wrap=this.ui.catsWrap; wrap.innerHTML=''; const fams=['flips','grinds','manuals','spins']; const labels={flips:this.model.cfg?.families?.flips?.label||'Flip Tricks',grinds:'Grinds',manuals:'Manuals',spins:'Spins'}; fams.forEach(key=>{ const famOn=this.model.state.families.has(key); const head=document.createElement('div'); head.className='cat-head'; const toggle=document.createElement('div'); toggle.className='toggle'+(famOn?' on':''); toggle.textContent=labels[key]; toggle.onclick=()=>{ if(this.model.state.families.has(key)) this.model.state.families.delete(key); else this.model.state.families.add(key); toggle.classList.toggle('on'); subs.style.opacity=this.model.state.families.has(key)?'1':'.35'; this.persist(); }; head.appendChild(toggle); wrap.appendChild(head); const subs=document.createElement('div'); subs.className='subs'; subs.style.opacity=famOn?'1':'.35'; const sublist=Object.keys(this.model.cfg?.families?.[key]?.subs||{}); const set=this.model.state.sub[key]; sublist.forEach(name=>{ const chip=document.createElement('div'); const active=set.has(name); chip.className='toggle'+(active?' on':''); chip.textContent=name; chip.onclick=()=>{ if(!this.model.state.families.has(key)) return; if(set.has(name)) set.delete(name); else set.add(name); chip.classList.toggle('on'); this.persist(); }; subs.appendChild(chip); }); wrap.appendChild(subs); }); }
  setTray(state){ this.trayState=state; const vis=(el,on)=>el.classList.toggle('hidden',!on); vis(this.ui.trayStart,state==='start'); vis(this.ui.trayActive,state==='active'); vis(this.ui.trayLanded,state==='landed'); vis(this.ui.trayMissed,state==='missed'); vis(this.ui.trayOver,state==='over'); }
  formatLetters(n){ Array.from(this.ui.skateTop.children).forEach((s,i)=>s.classList.toggle('on', i<n)); }
  renderAttempts(){ const wrap=this.ui.attemptDots; wrap.innerHTML=''; const cur=Math.max(1,this.attempts||0); for(let i=1;i<=3;i++){ const dot=document.createElement('div'); dot.className='attempt-dot'; if(i===cur && this.trayState==='active') dot.classList.add('active'); if(this.missHistory?.includes(i)){ const m=document.createElement('div'); m.className='mark'; m.textContent='×'; dot.classList.add('missed'); dot.appendChild(m);} if(this.trayState==='landed' && this.landHistory?.includes(i)){ const m=document.createElement('div'); m.className='mark'; m.textContent='✓'; dot.classList.add('landed'); dot.appendChild(m);} wrap.appendChild(dot); } }
  restore(){ this.high=JSON.parse(localStorage.getItem('brainlock:highscores')||'[]'); this.admin=localStorage.getItem('brainlock:admin')==='1'; const s=JSON.parse(localStorage.getItem('brainlock:settings')||'null'); if(s){ this.model.state.level=s.level??1; this.model.state.mode=s.mode??'SKATE'; this.model.state.soloCount=s.soloCount??10; this.model.state.stances=new Set(s.stances||['regular','fakie','nollie','switch']); this.model.state.families=new Set(s.families||['flips','grinds','manuals','spins']); this.model.state.obstacles=new Set(s.obstacles||Object.keys(this.model.cfg?.obstacles||{})); if(s.sub){ this.model.state.sub.flips=new Set(s.sub.flips||Object.keys(this.model.cfg?.families?.flips?.subs||{})); this.model.state.sub.grinds=new Set(s.sub.grinds||Object.keys(this.model.cfg?.families?.grinds?.subs||{})); this.model.state.sub.manuals=new Set(s.sub.manuals||Object.keys(this.model.cfg?.families?.manuals?.subs||{})); this.model.state.sub.spins=new Set(s.sub.spins||Object.keys(this.model.cfg?.families?.spins?.subs||{})); } } this.ui.nickInput && (this.ui.nickInput.value=localStorage.getItem('brainlock:nick')||''); }
  persist(){ const st=this.model.state; localStorage.setItem('brainlock:settings', JSON.stringify({ level:st.level, mode:st.mode, soloCount:st.soloCount, stances:[...st.stances], families:[...st.families], obstacles:[...st.obstacles], sub:{ flips:[...st.sub.flips], grinds:[...st.sub.grinds], manuals:[...st.sub.manuals], spins:[...st.sub.spins] } })); }
  updateHUD(){ this.ui.levelBadge.textContent='Level '+this.model.state.level; this.ui.modeBadge.textContent='Mode: '+this.model.state.mode; this.ui.scoreVal.textContent=this.model.state.score; this.ui.highVal.textContent=(this.high[0]?.value)||0; this.ui.streakVal.textContent=this.model.state.flow; this.formatLetters(this.model.state.letters); this.renderAttempts(); const p=this.predictedScore(); this.ui.scorePeek.textContent=p?`This attempt: +${p.total}`:''; this.ui.endBtnModule.classList.toggle('hidden', !this.model.state.sessionActive); }
  async startSession(){ await this.model.ready; if(!this._hydrated){ this.renderChips(this.ui.obstacles, Object.keys(this.model.cfg?.obstacles||{}), this.model.state.obstacles); this.renderCategories(); this._hydrated=true; } const cfg=JSON.parse(localStorage.getItem('brainlock:settings')||'null'); this.model.reset(); if(cfg){ this.model.state.level=cfg.level; this.model.state.mode=cfg.mode; this.model.state.soloCount=cfg.soloCount; this.model.state.stances=new Set(cfg.stances||['regular','fakie','nollie','switch']); this.model.state.families=new Set(cfg.families||['flips','grinds','manuals','spins']); this.model.state.obstacles=new Set(cfg.obstacles||Object.keys(this.model.cfg?.obstacles||{})); if(cfg.sub){ this.model.state.sub.flips=new Set(cfg.sub.flips||Object.keys(this.model.cfg?.families?.flips?.subs||{})); this.model.state.sub.grinds=new Set(cfg.sub.grinds||Object.keys(this.model.cfg?.families?.grinds?.subs||{})); this.model.state.sub.manuals=new Set(cfg.sub.manuals||Object.keys(this.model.cfg?.families?.manuals?.subs||{})); this.model.state.sub.spins=new Set(cfg.sub.spins||Object.keys(this.model.cfg?.families?.spins?.subs||{})); } } this.model.state.sessionActive=true; this.attempts=1; this.countDone=0; this.missHistory=[]; this.landHistory=[]; this.pushNextTrick(); this.setTray('active'); this.updateHUD(); }
  pushNextTrick(){ const t=this.model.selectTrick(); this.current=t; this.attempts=1; this.missHistory=[]; this.landHistory=[]; this.ui.trickText.textContent=this.model.trickText(t); this.ui.subText.textContent='Attempt 1 of 3'; this.updateHUD(); this.dumpWhy(); }
  dumpWhy(){ if(!this.ui.whyOut) return; this.ui.whyOut.textContent = 'Why this trick:\\n' + (this.model.state.why||''); this.ui.dbgOut.textContent = 'Build '+this.version; }
  land(){ if(!this.current) return; const b=this.model.scoreTrick(this.current, this.attempts); this.model.state.score+=b.total; this.model.state.flow+=1; const count=(this.model.state.repeatMap.get(this.current.signature)||0)+1; this.model.state.repeatMap.set(this.current.signature,count); this.ui.subText.textContent=`+${b.total} (tap score for breakdown)`; this.landHistory.push(this.attempts); this.setTray('landed'); this.updateHUD(); }
  miss(){ if(!this.current) return; this.missHistory.push(this.attempts); if(this.attempts>=3){ this.model.state.flow=0; this.model.state.letters=Math.min(5,this.model.state.letters+1); this.ui.subText.textContent='Missed 3× → +1 letter'; if(this.model.state.mode==='SKATE' && this.model.state.letters>=5) return this.endSession(); this.setTray('missed'); } else { this.attempts+=1; this.ui.subText.textContent=`Miss (attempt ${this.attempts} of 3)`; this.setTray('active'); } this.updateHUD(); }
  skip(){ this.model.state.flow=0; this.ui.subText.textContent='Skipped'; this.next(); }
  next(){ if(this.model.state.mode==='SOLO'){ this.countDone=(this.countDone||0)+1; if(this.countDone>=this.model.state.soloCount) return this.endSession(); } this.pushNextTrick(); this.setTray('active'); }
  endSession(){ const score=this.model.state.score; const entry={id:Date.now(), value:score, created_at:new Date().toISOString()}; this.high.push(entry); this.high.sort((a,b)=>b.value-a.value); this.high=this.high.slice(0,100); localStorage.setItem('brainlock:highscores', JSON.stringify(this.high)); this.ui.trickText.textContent='Session Over'; this.ui.subText.textContent='Final: '+score+' — High: '+(this.high[0]?.value); this.model.state.sessionActive=false; this.setTray('over'); this.updateHUD(); }
  predictedScore(){ if(!this.current||!this.attempts) return null; return this.model.scoreTrick(this.current, this.attempts); }
  openScoreBreakdown(){ const b=this.predictedScore(); if(!b) return; this.ui.scoreOut.textContent=['If you land now:',`Base: ${b.base.toFixed(2)}`,`Combo: ×${b.combo.toFixed(2)}`,`Attempt: ×${b.attemptM.toFixed(2)}`,`Flow: ×${b.flowM.toFixed(2)}`,`Repeat: ×${b.repeatM.toFixed(2)}`,`Total: ${b.total}`].join('\n'); this.ui.scoreDlg.showModal(); this.ui.closeScore.onclick=()=>this.ui.scoreDlg.close(); }
}