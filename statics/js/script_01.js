/* -------------------------
   サンプルデータ（実運用時はAPIから取得）
   ------------------------- */
let sampleTeams = [];
let samplePlayers = [];

// JSONファイルを読み込み
async function loadData() {
  try {
    const [playersRes, teamsRes] = await Promise.all([
      fetch("statics/json/players.json"),
      fetch("statics/json/teams.json")
    ]);
    samplePlayers = await playersRes.json();
    sampleTeams = await teamsRes.json();
    render(); // データ取得後に初回描画
  } catch (err) {
    console.error("JSON load error:", err);
  }
}

/* -------------------------
   基本状態
   ------------------------- */
let state = {
  mode: 'players', // players | teams
  q:'',
  numMax:'',
  sortBy:'relevance',
  perPage:12,
  viewGrid:true,
  page:1
};

/* -------------------------
   DOM
   ------------------------- */
const qEl = document.getElementById('q');
const numMaxEl = document.getElementById('numMax');
const sortByEl = document.getElementById('sortBy');
const perPageEl = document.getElementById('perPage');
const resultsArea = document.getElementById('resultsArea');
const countEl = document.getElementById('count');
const activeFiltersEl = document.getElementById('activeFilters');
const summaryEl = document.getElementById('summary');
const modalRoot = document.getElementById('modalRoot');
const tabs = document.querySelectorAll('.tab');
const toggleViewBtn = document.getElementById('toggleView');
const resetBtn = document.getElementById('resetFilters');

/* -------------------------
   イベント登録
   ------------------------- */
tabs.forEach(t=>{
  t.addEventListener('click', ()=> {
    tabs.forEach(x=> x.setAttribute('aria-selected','false'));
    t.setAttribute('aria-selected','true');
    state.mode = t.dataset.target === 'teams' ? 'teams' : 'players';
    render();
  });
});

[qEl, numMaxEl, sortByEl, perPageEl].forEach(el=>{
  el.addEventListener('input', (e)=> {
    state[e.target.id === 'q' ? 'q' : (e.target.id || e.target.name)] = e.target.value;
    if (e.target.id === 'perPage') state.perPage = parseInt(e.target.value) || 12;
    render();
  });
});

resetBtn.addEventListener('click', ()=> {
  qEl.value = ''; numMaxEl.value='';
  state.q=''; state.numMax=''; render();
});

toggleViewBtn.addEventListener('click', ()=> {
  state.viewGrid = !state.viewGrid;
  render();
});

/* キーボードショートカット */
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault(); qEl.focus();
  }
});

/* -------------------------
   検索 / フィルタ処理
   ------------------------- */
function filterAndSort(){
  const q = state.q.trim().toLowerCase();
  let items = state.mode === 'players' ? samplePlayers.slice() : sampleTeams.slice();

  // 番号完全一致フィルタ
  if (state.mode === 'players' && state.numMax !== '' && state.numMax != null) {
      const target = Number(state.numMax);
      if (!isNaN(target)) {
          items = items.filter(it => Number(it.number) === target);
      }
  }

  // クエリ検索（名前、チーム名）
  if (q) {
    const tokens = q.split(/\s+/);
    items = items.filter(it => {
      const hay = `${it.name || ''} ${it.team || ''} ${it.name_en || ''} ${it.city || ''} ${it.name}`.toLowerCase();
      return tokens.every(t => hay.includes(t));
    });
  }

  // ソート
  if (state.sortBy === 'name') items.sort((a,b)=> (a.name||'').localeCompare(b.name||''));
  else if (state.sortBy === 'number' && state.mode==='players') items.sort((a,b)=> (a.number||0) - (b.number||0));
  // relevance はデフォルトの順（サーバ側スコア利用が望ましい）

  return items;
}

/* -------------------------
   レンダリング
   ------------------------- */
function render(){
  // summary
  document.querySelectorAll('.tab').forEach(t => {
    if ((t.dataset.target === 'players' && state.mode==='players') || (t.dataset.target === 'teams' && state.mode==='teams')){
      t.setAttribute('aria-selected','true');
    } else t.setAttribute('aria-selected','false');
  });

  const filtered = filterAndSort();
  countEl.textContent = filtered.length;
  summaryEl.innerHTML = `${state.mode === 'players' ? '選手' : 'チーム'}を表示中 — 全 <strong>${filtered.length}</strong> 件`;
  updateActiveFilters();

  // ページング（簡易）
  const per = state.perPage || 12;
  const page = Math.max(1, state.page || 1);
  const paged = filtered.slice((page-1)*per, page*per);

  // 結果描画
  if (state.mode === 'players') renderPlayers(paged);
  else renderTeams(paged);
}

function updateActiveFilters(){
  const parts = [];
  if (state.q) parts.push(`検索："${state.q}"`);
  if (state.numMax) parts.push(`番号 = ${state.numMax}`);
  activeFiltersEl.textContent = parts.length ? `フィルタ： ${parts.join(' / ')}` : 'フィルタ：なし';
}

/* プレイヤー表示 */
function renderPlayers(players){
  const wrapper = document.createElement('div');
  wrapper.className = state.viewGrid ? 'result-grid' : '';
  if (!state.viewGrid){
    // テーブル表示
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr><th>番号</th><th>選手名</th><th>チーム</th><th>学年</th><th>ポジション</th><th></th></tr>`;
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    players.forEach(p=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>#${p.number}</td><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.team)}</td><td>${p.grade}</td><td>${p.position}</td><td><button class="btn small" data-id="${p.id}" data-type="player">詳細</button></td>`;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);
  } else {
    players.forEach(p=>{
      const c = document.createElement('article');
      c.className = 'card';
      c.tabIndex = 0;
      c.innerHTML = `
        <div style="display:flex;gap:12px;align-items:center">
          <div class="team-badge">${escapeHtml(p.number)}</div>
          <div>
            <div style="font-weight:700">${escapeHtml(p.name)}</div>
            <div class="meta">${escapeHtml(p.team)} ${p.position}</div>
            <div class="meta">${p.grade}年</div>
          </div>
        </div>
      `;
      c.addEventListener('click', ()=> openModalPlayer(p.id));
      c.addEventListener('keydown', (e)=> { if (e.key === 'Enter') openModalPlayer(p.id) });
      wrapper.appendChild(c);
    });
  }
  resultsArea.innerHTML = '';
  resultsArea.appendChild(wrapper);

  // attach detail buttons (for table view)
  resultsArea.querySelectorAll('button[data-type="player"]').forEach(btn=>{
    btn.addEventListener('click', (e)=> openModalPlayer(e.currentTarget.dataset.id));
  });
}

/* チーム表示 */
function renderTeams(teams){
  const wrapper = document.createElement('div');
  wrapper.className = state.viewGrid ? 'result-grid' : '';
  if (!state.viewGrid){
    const table = document.createElement('table');
    table.innerHTML = `<thead><tr><th>チーム</th><th>ニックネーム</th><th>所在地</th><th>創設年</th><th></th></tr></thead><tbody></tbody>`;
    teams.forEach(t=>{
      const row = document.createElement('tr');
      row.innerHTML = `<td>${escapeHtml(t.name)}</td><td>${t.nickname}</td><td>${escapeHtml(t.city)}</td><td>${t.founded}</td><td><button class="btn small" data-id="${t.id}" data-type="team">詳細</button></td>`;
      table.querySelector('tbody').appendChild(row);
    });
    wrapper.appendChild(table);
  } else {
    teams.forEach(t=>{
      const c = document.createElement('article');
      c.className = 'card';
      c.tabIndex = 0;
      c.innerHTML = `
        <div style="display:flex;gap:12px;align-items:center">
          <div class="team-badge">${escapeHtml(t.name.split(' ').map(s=>s[0]).join('').slice(0,2))}</div>
          <div>
            <div style="font-weight:700">${escapeHtml(t.name)}</div>
            <div class="meta">${escapeHtml(t.nickname)}</div>
            <div class="muted">創設 ${t.founded}</div>
          </div>
        </div>
      `;
      c.addEventListener('click', ()=> openModalTeam(t.id));
      c.addEventListener('keydown', (e)=> { if (e.key === 'Enter') openModalTeam(t.id) });
      wrapper.appendChild(c);
    });
  }

  resultsArea.innerHTML = '';
  resultsArea.appendChild(wrapper);

  resultsArea.querySelectorAll('button[data-type="team"]').forEach(btn=>{
    btn.addEventListener('click', (e)=> openModalTeam(e.currentTarget.dataset.id));
  });
}

/* -------------------------
   モーダル（詳細）表示
   ------------------------- */
function openModalPlayer(id){
  const p = samplePlayers.find(x=>x.id===id);
  if (!p) return;
  modalRoot.innerHTML = `
    <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="選手詳細">
      <div class="modal">
        <button class="close" id="modalClose">閉じる</button>
        <h2>${escapeHtml(p.name)} <span class="muted">#${p.number}</span></h2>
        <div class="muted">チーム: ${escapeHtml(p.team)} ・ ポジション: ${p.position} ・ ${p.grade} 年</div>
        <hr style="border:none;height:1px;background:rgba(255,255,255,0.03);margin:12px 0">
        <div style="display:flex;gap:18px;flex-wrap:wrap">
          <div style="min-width:180px">
            <div class="muted">身長 / 体重</div>
            <div style="font-weight:700">${p.height} cm / ${p.weight} kg</div>

            <div class="muted" style="margin-top:8px">出身校</div>
            <div>${p.almaMater}</div>
          </div>
          <div style="margin-top:8px"><button class="btn" id="openTeamFromPlayer">チーム詳細を開く</button></div>
        </div>
      </div>
    </div>
  `;
  modalRoot.setAttribute('aria-hidden','false');
  const backdrop = modalRoot.querySelector('.modal-backdrop');
  const close = modalRoot.querySelector('#modalClose');
  close.focus();
  close.addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e)=> { if (e.target === backdrop) closeModal(); });
  const openTeamBtn = modalRoot.querySelector('#openTeamFromPlayer');
  openTeamBtn.addEventListener('click', ()=> {
    closeModal();
    // チーム詳細を開く
    const team = sampleTeams.find(t => t.name === p.team);
    if (team) openModalTeam(team.id);
  });
  window.addEventListener('keydown', escHandler);
}

function openModalTeam(id){
  const t = sampleTeams.find(x=>x.id===id);
  if (!t) return;
  modalRoot.innerHTML = `
    <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="チーム詳細">
      <div class="modal">
        <button class="close" id="modalClose">閉じる</button>
        <h2>${escapeHtml(t.name)} <span class="muted">(${escapeHtml(t.city)})</span></h2>
        <div class="muted">ニックネーム: ${escapeHtml(t.nickname)} ・創設年:${escapeHtml(t.founded)}</div>
        <div class="muted">ヘッドコーチ: ${escapeHtml(t.coach)}</div>
        <hr style="border:none;height:1px;background:rgba(5, 4, 4, 0.03);margin:12px 0">
        <div>
          <div style="margin-top:10px" class="muted">登録選手</div>
          <ul id="teamPlayersList" class="muted" style="margin-top:3px"></ul>
        </div>
      </div>
    </div>
  `;
  // list players
  const lst = modalRoot.querySelector('#teamPlayersList');
  samplePlayers.filter(p=>p.team===t.name).forEach(p=>{
    const li = document.createElement('li');
    li.innerHTML = `<button class="btn small" data-id="${p.id}" data-type="player-inline">${escapeHtml(p.name)} (#${p.number})</button>`;
    lst.appendChild(li);
  });

  modalRoot.setAttribute('aria-hidden','false');
  const backdrop = modalRoot.querySelector('.modal-backdrop');
  const close = modalRoot.querySelector('#modalClose');
  close.focus();
  close.addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e)=> { if (e.target === backdrop) closeModal(); });

  modalRoot.querySelectorAll('button[data-type="player-inline"]').forEach(b=>{
    b.addEventListener('click', (e)=> {
      const id = e.currentTarget.dataset.id;
      closeModal();
      setTimeout(()=> openModalPlayer(id), 120);
    });
  });

  window.addEventListener('keydown', escHandler);
}

function closeModal(){ modalRoot.innerHTML=''; modalRoot.setAttribute('aria-hidden','true'); window.removeEventListener('keydown', escHandler); }
function escHandler(e){ if (e.key === 'Escape') closeModal(); }

/* -------------------------
   ユーティリティ
   ------------------------- */
function escapeHtml(s){ if (!s && s !== 0) return ''; return String(s).replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* 初期レンダリング */
// render();
loadData();   // JSON読み込み後にrender()