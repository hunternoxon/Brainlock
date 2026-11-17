(() => {
  const els = {
    tabs: {
      skate: document.getElementById('tab-skate'),
      tricks: document.getElementById('tab-tricks'),
      settings: document.getElementById('tab-settings'),
    },
    views: {
      skate: document.getElementById('view-skate'),
      tricks: document.getElementById('view-tricks'),
      settings: document.getElementById('view-settings'),
    },
    skill: document.getElementById('skill'),
    skillVal: document.getElementById('skillVal'),
    obstacleFilters: document.getElementById('obstacleFilters'),
    score: document.getElementById('score'),
    highScore: document.getElementById('highScore'),
    letters: document.getElementById('letters'),
    challenge: document.getElementById('challenge'),
    startBtn: document.getElementById('startBtn'),
    landBtn: document.getElementById('landBtn'),
    missBtn: document.getElementById('missBtn'),
    skipBtn: document.getElementById('skipBtn'),
    attempt: document.getElementById('attempt'),
    difficulty: document.getElementById('difficulty'),
    variety: document.getElementById('variety'),
    trickSearch: document.getElementById('trickSearch'),
    trickObstacle: document.getElementById('trickObstacle'),
    trickList: document.getElementById('trickList'),
  };

  // Tabs
  function show(view) {
    for (const k of Object.keys(els.views)) {
      els.views[k].classList.toggle('active', k === view);
      els.tabs[k].classList.toggle('active', k === view);
    }
  }
  els.tabs.skate.onclick = () => show('skate');
  els.tabs.tricks.onclick = () => show('tricks');
  els.tabs.settings.onclick = () => show('settings');

  // State
  const LETTERS = ['S','K','A','T','E'];
  let dataset = [];
  let filters = { obstacles: new Set() };
  let session = null;
  let recentTypes = []; // rotate to bias variety

  // Load / Save high score
  const highKey = 'brainlock_highscore_v1';
  function getHigh(){ return Number(localStorage.getItem(highKey) || 0); }
  function setHigh(v){ localStorage.setItem(highKey, String(v)); els.highScore.textContent = v; }
  setHigh(getHigh());

  // Load dataset
  fetch('data/brainlock_dataset.json')
    .then(r => r.json())
    .then(json => {
      dataset = normalize(json);
      buildObstacleFilters();
      buildTrickView();
    })
    .catch(err => {
      console.error('Dataset load failed', err);
      els.challenge.textContent = 'Failed to load dataset.';
    });

  function normalize(arr) {
    // Expect objects like:
    // { id, name, type, difficulty (1-10), obstacles:[], stance?, components? }
    return (arr || []).map((t, i) => ({
      id: t.id ?? i,
      name: t.name ?? 'Unknown',
      type: t.type ?? 'other',
      difficulty: clamp(Number(t.difficulty ?? 5), 1, 10),
      obstacles: Array.isArray(t.obstacles) ? t.obstacles : [],
      stance: t.stance ?? 'any',
      components: t.components ?? []
    }));
  }

  function clamp(n, a, b){ return Math.min(b, Math.max(a, n)); }

  function buildObstacleFilters() {
    const all = new Set();
    dataset.forEach(t => (t.obstacles||[]).forEach(o => all.add(o)));
    const list = Array.from(all).sort();
    els.obstacleFilters.innerHTML = '';
    list.forEach(o => {
      const btn = document.createElement('button');
      btn.textContent = o;
      btn.onclick = () => {
        if (filters.obstacles.has(o)) filters.obstacles.delete(o);
        else filters.obstacles.add(o);
        btn.classList.toggle('active');
        // Update trick list dropdown too
        buildTrickObstacleDropdown(list);
      };
      els.obstacleFilters.appendChild(btn);
    });
    buildTrickObstacleDropdown(list);
  }

  function buildTrickObstacleDropdown(list) {
    const sel = els.trickObstacle;
    const keep = sel.value;
    sel.innerHTML = '<option value="">Any obstacle</option>' + list.map(o => `<option value="${o}">${o}</option>`).join('');
    sel.value = keep || '';
  }

  // SKATE logic
  const LAND_BONUS = [1.00, 0.94, 0.92];

  function startSession() {
    session = {
      score: 0,
      misses: 0,
      attempt: 0,
      letters: '',
      current: null,
      skill: Number(els.skill.value)
    };
    pickNextTrick();
    updateUI();
    els.landBtn.disabled = false;
    els.missBtn.disabled = false;
    els.skipBtn.disabled = false;
  }

  function pickNextTrick() {
    const allowedObstacles = Array.from(filters.obstacles);
    let pool = dataset.filter(t => withinSkill(t, session.skill));
    if (allowedObstacles.length) {
      pool = pool.filter(t => t.obstacles.some(o => allowedObstacles.includes(o)));
    }
    // Variety bias: avoid immediate repeat type; prefer types not used recently
    const lastType = session?.current?.type;
    const preferred = pool.filter(t => t.type !== lastType && !recentTypes.includes(t.type));
    const choicePool = preferred.length ? preferred : pool;
    const next = choicePool[Math.floor(Math.random() * choicePool.length)];
    session.current = next || null;
    session.attempt = 0;
    if (next) {
      els.challenge.textContent = formatTrick(next);
      els.difficulty.textContent = next.difficulty.toFixed(1);
      els.attempt.textContent = '1 / 3';
      // track recent types (keep last 3)
      if (lastType) {
        recentTypes.push(lastType);
        if (recentTypes.length > 3) recentTypes.shift();
      }
    } else {
      els.challenge.textContent = 'No tricks match filters/skill.';
      els.difficulty.textContent = '—';
      els.attempt.textContent = '—';
    }
  }

  function withinSkill(t, skill) {
    // Allow difficulty within +/-2 of skill, with soft edges
    return Math.abs(t.difficulty - skill) <= 2.5;
  }

  function formatTrick(t) {
    // e.g., "FS Kickflip to 50-50 (Ledge)"
    const obs = t.obstacles?.[0] ? ` (${t.obstacles[0]})` : '';
    return `${t.name}${obs}`;
  }

  function land() {
    if (!session?.current) return;
    const diff = session.current.difficulty;
    const attemptIdx = Math.min(session.attempt, 2);
    const bonus = LAND_BONUS[attemptIdx];
    const base = Math.round(diff * 100);
    const gained = Math.round(base * bonus);
    session.score += gained;
    els.challenge.textContent = `${formatTrick(session.current)} — Landed +${gained}`;
    pickNextTrick();
    updateUI();
  }

  function miss() {
    if (!session?.current) return;
    session.attempt += 1;
    if (session.attempt >= 3) {
      session.misses += 1;
      session.letters = LETTERS.slice(0, session.misses).join('-');
      if (session.misses >= 5) {
        endSession();
        return;
      }
      pickNextTrick();
    } else {
      els.attempt.textContent = `${session.attempt + 1} / 3`;
    }
    updateUI();
  }

  function endSession() {
    els.landBtn.disabled = true;
    els.missBtn.disabled = true;
    els.skipBtn.disabled = true;
    els.challenge.textContent = `Session over — ${session.letters} | Score ${session.score}`;
    if (session.score > getHigh()) setHigh(session.score);
  }

  function skip() {
    if (!session) return;
    pickNextTrick();
    updateUI();
  }

  function updateUI() {
    if (!session) {
      els.score.textContent = '0';
      els.letters.textContent = '—';
      els.attempt.textContent = '—';
      els.difficulty.textContent = '—';
      return;
    }
    els.score.textContent = session.score;
    els.letters.textContent = session.letters || '—';
  }

  // Controls
  els.skill.addEventListener('input', e => {
    els.skillVal.textContent = e.target.value;
  });
  els.startBtn.onclick = startSession;
  els.landBtn.onclick = land;
  els.missBtn.onclick = miss;
  els.skipBtn.onclick = skip;

  // Trick list view
  function buildTrickView() {
    renderTrickList();
    els.trickSearch.oninput = renderTrickList;
    els.trickObstacle.onchange = renderTrickList;
  }

  function renderTrickList() {
    const q = (els.trickSearch.value || '').toLowerCase();
    const obs = els.trickObstacle.value || '';
    const items = dataset.filter(t => {
      const okQ = !q || (t.name.toLowerCase().includes(q) || t.type.toLowerCase().includes(q));
      const okO = !obs || t.obstacles.includes(obs);
      return okQ && okO;
    }).slice(0, 500);

    els.trickList.innerHTML = items.map(t => `
      <div class="card">
        <div><b>${t.name}</b></div>
        <div style="color:#8b949e">Type: ${t.type} • Diff ${t.difficulty} • Obstacles: ${(t.obstacles||[]).join(', ') || '—'}</div>
      </div>
    `).join('');
  }
})();