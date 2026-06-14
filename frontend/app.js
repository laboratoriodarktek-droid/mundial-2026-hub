/* ============================================
   MUNDIAL 2026 HUB — App logic
   ============================================ */

// ============================================================================
// CONFIG
// ============================================================================
const CONFIG = {
  // URL del JSON generado por el scraper.
  // Apuntar a tu GitHub raw URL una vez que el workflow esté activo:
  // https://raw.githubusercontent.com/<USER>/<REPO>/main/data/worldcup-data.json
  DATA_URL: 'data/worldcup-data.json', // fallback local para testing
  REFRESH_MS: 60_000,
  // Personajes placeholder (reemplazar cuando definas los reales)
  PERSONAJES: [
    { nombre: 'Avatar 1', bio: 'Reemplazar con personaje definido', avatar: 'A' },
    { nombre: 'Avatar 2', bio: 'Reemplazar con personaje definido', avatar: 'B' },
    { nombre: 'Avatar 3', bio: 'Reemplazar con personaje definido', avatar: 'C' },
    { nombre: 'Avatar 4', bio: 'Reemplazar con personaje definido', avatar: 'D' },
  ],
};

// ============================================================================
// STATE
// ============================================================================
const state = {
  data: null,
  lang: localStorage.getItem('lang') || 'es',
  refreshTimer: null,
  isLoading: false,
};

// ============================================================================
// I18N
// ============================================================================
const i18n = {
  es: {
    live: 'EN VIVO',
    scheduled: 'PROGRAMADO',
    finished: 'FINALIZADO',
    lastUpdate: 'Última actualización',
    noMatches: 'No hay partidos para hoy.',
    noGroups: 'No hay información de grupos disponible.',
    noBracket: 'El bracket se habilitará cuando comience la fase eliminatoria.',
    minute: 'min',
    vs: 'VS',
    refresh: 'Actualizar',
  },
  en: {
    live: 'LIVE',
    scheduled: 'SCHEDULED',
    finished: 'FINISHED',
    lastUpdate: 'Last update',
    noMatches: 'No matches today.',
    noGroups: 'No group information available.',
    noBracket: 'Bracket will appear once knockouts start.',
    minute: 'min',
    vs: 'VS',
    refresh: 'Refresh',
  },
};
const t = () => i18n[state.lang];

// ============================================================================
// DATA FETCH
// ============================================================================
async function fetchData() {
  if (state.isLoading) return;
  state.isLoading = true;
  setStatus('loading', 'Actualizando...');
  try {
    const res = await fetch(CONFIG.DATA_URL + '?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    state.data = data;
    render();
    setStatus('live', `${t().lastUpdate}: ${formatTime(data.torneo?.actualizado)}`);
  } catch (err) {
    console.error('fetch error:', err);
    setStatus('error', 'Sin conexión al scraper');
    // mantener último data si hay
    if (state.data) render();
  } finally {
    state.isLoading = false;
  }
}

function setStatus(kind, text) {
  const pill = document.getElementById('statusPill');
  const txt = document.getElementById('statusText');
  pill.className = 'status-pill ' + kind;
  txt.textContent = text;
}

function formatTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(state.lang === 'es' ? 'es-AR' : 'en-US', {
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return '—'; }
}

function timeSince(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return `hace ${h} h`;
}

// ============================================================================
// RENDER — TOP
// ============================================================================
function render() {
  if (!state.data) return;
  renderTopbar();
  renderLiveHero();
  renderPartidos();
  renderGrupos();
  renderBracket();
  renderPersonajes();
  document.getElementById('lastUpdate').textContent =
    `${t().lastUpdate}: ${formatTime(state.data.torneo?.actualizado)}`;
}

function renderTopbar() {
  const torneo = state.data.torneo || {};
  document.getElementById('brandSub').textContent =
    `${torneo.nombre || 'FIFA World Cup 2026'} · ${torneo.fase || ''}`;
}

// ============================================================================
// RENDER — LIVE HERO
// ============================================================================
function renderLiveHero() {
  const el = document.getElementById('liveHero');
  const enVivo = (state.data.partidosHoy || []).find(p => p.estado === 'en_vivo');
  if (!enVivo) {
    el.innerHTML = `
      <div class="live-placeholder">
        <div class="live-placeholder-icon">📺</div>
        <p>${state.lang === 'es' ? 'No hay partidos en vivo en este momento' : 'No live matches right now'}</p>
        <small>${state.lang === 'es' ? 'Volvé a chequear más tarde o mirá los partidos del día abajo' : 'Check back later or browse today\'s matches below'}</small>
      </div>`;
    return;
  }
  const m = enVivo;
  el.innerHTML = `
    <div class="live-match">
      <div class="live-match-header">
        <span class="live-badge">${t().live}</span>
        <span>${m.grupo || ''} · ${m.estadio || (state.lang === 'es' ? 'Estadio' : 'Stadium')}</span>
      </div>
      <div class="live-scoreboard">
        <div class="team">
          <div class="team-flag">${(m.local || '?')[0].toUpperCase()}</div>
          <div class="team-name">${m.local}</div>
        </div>
        <div class="score-center">
          <span class="score-vs">${t().vs}</span>
          <div style="display:flex;align-items:center;gap:14px;">
            <span class="team-score">${m.golesLocal}</span>
            <span class="team-score">${m.golesVisita}</span>
          </div>
          <span class="score-minute">${m.minuto || '—'}'</span>
        </div>
        <div class="team away">
          <div class="team-flag">${(m.visita || '?')[0].toUpperCase()}</div>
          <div class="team-name">${m.visita}</div>
        </div>
      </div>
    </div>`;
  // actualizar el board con los eventos del partido en vivo
  renderBoard(m.eventos || []);
}

// ============================================================================
// RENDER — PARTIDOS
// ============================================================================
function renderPartidos() {
  const el = document.getElementById('partidosGrid');
  const partidos = state.data.partidosHoy || [];
  document.getElementById('hoyMeta').textContent =
    `${partidos.length} ${state.lang === 'es' ? 'partidos' : 'matches'} · ${timeSince(state.data.torneo?.actualizado)}`;

  if (partidos.length === 0) {
    el.innerHTML = `<div class="loading">${t().noMatches}</div>`;
    return;
  }
  el.innerHTML = partidos.map(m => `
    <article class="partido-card ${m.estado}">
      <div class="partido-status">
        <span>${m.grupo || ''} · ${m.hora || ''}</span>
        <span class="estado-tag ${m.estado}">${m.estado === 'en_vivo' ? t().live : m.estado === 'finalizado' ? t().finished : t().scheduled}</span>
      </div>
      <div class="equipos-row">
        <div class="equipo">
          <div class="team-flag" style="width:32px;height:32px;font-size:16px;">${(m.local||'?')[0].toUpperCase()}</div>
          <span>${m.local}</span>
        </div>
        <div class="goles">${m.golesLocal} - ${m.golesVisita}</div>
        <div class="equipo visita">
          <div class="team-flag" style="width:32px;height:32px;font-size:16px;">${(m.visita||'?')[0].toUpperCase()}</div>
          <span>${m.visita}</span>
        </div>
      </div>
      ${m.minuto ? `<div style="font-size:11px;color:var(--text-dim);margin-top:4px;">⏱ ${m.minuto}'</div>` : ''}
      ${renderEventosMini(m.eventos || [])}
    </article>
  `).join('');
}

function renderEventosMini(eventos) {
  if (!eventos.length) return '';
  return `<div class="eventos-mini">${eventos.slice(-6).map(e =>
    `<span class="evento-chip ${e.tipo}">⚡${e.minuto}' ${e.jugador || e.tipo}</span>`
  ).join('')}</div>`;
}

// ============================================================================
// RENDER — GRUPOS
// ============================================================================
function renderGrupos() {
  const el = document.getElementById('gruposGrid');
  const grupos = state.data.grupos || [];
  if (grupos.length === 0) {
    el.innerHTML = `<div class="loading">${t().noGroups}</div>`;
    return;
  }
  el.innerHTML = grupos.map(g => `
    <article class="grupo-card">
      <div class="grupo-letra">${g.letra}</div>
      <table class="grupo-tabla">
        <thead>
          <tr>
            <th>${state.lang === 'es' ? 'Equipo' : 'Team'}</th>
            <th>Pts</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th>
          </tr>
        </thead>
        <tbody>
          ${(g.equipos || []).map(e => `
            <tr>
              <td>${e.nombre || ''}</td>
              <td><strong>${e.pts || 0}</strong></td>
              <td>${e.pj || 0}</td>
              <td>${e.pg || 0}</td>
              <td>${e.pe || 0}</td>
              <td>${e.pp || 0}</td>
              <td>${e.gf || 0}</td>
              <td>${e.gc || 0}</td>
              <td>${e.dg || 0}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </article>
  `).join('');
}

// ============================================================================
// RENDER — BRACKET
// ============================================================================
function renderBracket() {
  const el = document.getElementById('bracketWrap');
  const b = state.data.bracket || {};
  const fases = [
    { key: 'dieciseisavos', title: '16avos' },
    { key: 'octavos', title: 'Octavos' },
    { key: 'cuartos', title: 'Cuartos' },
    { key: 'semis', title: 'Semis' },
    { key: 'final', title: 'Final' },
  ];
  const hasData = fases.some(f => b[f.key] && (Array.isArray(b[f.key]) ? b[f.key].length : b[f.key]));
  if (!hasData) {
    el.innerHTML = `<div class="loading">${t().noBracket}</div>`;
    return;
  }
  el.innerHTML = `<div class="bracket">${fases.map(f => `
    <div class="bracket-col">
      <div class="bracket-col-title">${f.title}</div>
      ${renderBracketCol(b[f.key])}
    </div>
  `).join('')}</div>`;
}

function renderBracketCol(data) {
  const arr = Array.isArray(data) ? data : (data ? [data] : []);
  if (arr.length === 0) return '<div class="bracket-match" style="opacity:0.4">—</div>';
  return arr.map(m => `
    <div class="bracket-match">
      <div class="bracket-team ${m.ganador === m.local ? 'winner' : ''}">
        <span>${m.local || 'TBD'}</span>
        <span class="bracket-team-score">${m.golesLocal ?? '-'}</span>
      </div>
      <div class="bracket-team ${m.ganador === m.visita ? 'winner' : ''}">
        <span>${m.visita || 'TBD'}</span>
        <span class="bracket-team-score">${m.golesVisita ?? '-'}</span>
      </div>
    </div>
  `).join('');
}

// ============================================================================
// RENDER — PERSONAJES
// ============================================================================
function renderPersonajes() {
  const el = document.getElementById('personajesGrid');
  el.innerHTML = CONFIG.PERSONAJES.map((p, i) => `
    <article class="personaje-card">
      <div class="personaje-avatar avatar-${i + 1}">${p.avatar}</div>
      <h3>${p.nombre}</h3>
      <p>${p.bio}</p>
    </article>
  `).join('');
}

// ============================================================================
// RENDER — BOARD (timeline de acciones)
// ============================================================================
function renderBoard(eventos) {
  const el = document.getElementById('boardBody');
  if (!eventos || eventos.length === 0) {
    el.innerHTML = `<p class="board-empty">${state.lang === 'es' ? 'No hay acciones registradas.' : 'No actions logged yet.'}</p>`;
    return;
  }
  el.innerHTML = eventos.slice().reverse().map(e => `
    <div class="evento-row">
      <div class="evento-minuto">${e.minuto}'</div>
      <div class="evento-info">
        <div class="tipo">${e.tipo} · ${e.equipo || ''}</div>
        <div class="jugador">${e.jugador || '—'}</div>
        ${e.detalle ? `<div class="detalle">${e.detalle}</div>` : ''}
      </div>
    </div>
  `).join('');
}

// ============================================================================
// TABS
// ============================================================================
function initTabs() {
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById('tab-' + btn.dataset.tab);
      if (target) target.classList.add('active');
    });
  });
}

// ============================================================================
// BOARD
// ============================================================================
function initBoard() {
  const fab = document.getElementById('boardFab');
  const panel = document.getElementById('boardPanel');
  const close = document.getElementById('boardClose');
  fab.addEventListener('click', () => panel.classList.add('open'));
  close.addEventListener('click', () => panel.classList.remove('open'));
}

// ============================================================================
// LANG
// ============================================================================
function initLang() {
  const btn = document.getElementById('langToggle');
  btn.textContent = state.lang === 'es' ? 'EN' : 'ES';
  btn.addEventListener('click', () => {
    state.lang = state.lang === 'es' ? 'en' : 'es';
    localStorage.setItem('lang', state.lang);
    btn.textContent = state.lang === 'es' ? 'EN' : 'ES';
    if (state.data) render();
  });
}

// ============================================================================
// INIT
// ============================================================================
function init() {
  initTabs();
  initBoard();
  initLang();
  fetchData();
  state.refreshTimer = setInterval(fetchData, CONFIG.REFRESH_MS);
  // refrescar al volver a la tab
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) fetchData();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}