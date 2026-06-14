/**
 * World Cup 2026 Scraper
 * ----------------------
 * Extrae datos de promiedos.com.ar cada 60 segundos
 * Genera worldcup-data.json con la estructura completa
 *
 * Modos:
 *   - node index.js          → corre en loop infinito (setInterval 60s)
 *   - node index.js --once   → corre una vez y termina (para GitHub Actions)
 *   - node index.js --debug  → muestra logs detallados
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'worldcup-data.json');
const LOG_FILE = path.join(DATA_DIR, 'scraper.log');

const IS_ONCE = process.argv.includes('--once');
const IS_DEBUG = process.argv.includes('--debug');

const SOURCES = {
  bracket: 'https://www.promiedos.com.ar/league/fifa-world-cup/fjda',
  home: 'https://www.promiedos.com.ar/',
};

const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 2000;

// ============================================================================
// UTILIDADES
// ============================================================================

function log(level, message, data = null) {
  const ts = new Date().toISOString();
  const prefix = { info: 'ℹ️ ', success: '✅', warn: '⚠️ ', error: '❌', debug: '🔍' }[level] || '•';
  const line = `[${ts}] ${prefix} ${message}${data ? ' ' + JSON.stringify(data) : ''}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (e) {
    // si no puede loggear, no rompe nada
  }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function withRetry(fn, name, attempts = RETRY_ATTEMPTS) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      if (IS_DEBUG) log('debug', `[${name}] intento ${i + 1}/${attempts}`);
      return await fn();
    } catch (err) {
      lastError = err;
      log('warn', `[${name}] falló intento ${i + 1}/${attempts}: ${err.message}`);
      if (i < attempts - 1) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, i);
        log('info', `[${name}] esperando ${delay}ms antes de reintentar`);
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

function loadLastValid() {
  try {
    if (fs.existsSync(OUTPUT_FILE)) {
      const raw = fs.readFileSync(OUTPUT_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    log('warn', 'No se pudo cargar último JSON válido', { error: e.message });
  }
  return null;
}

function saveData(data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2), 'utf-8');
  const size = (fs.statSync(OUTPUT_FILE).size / 1024).toFixed(2);
  log('success', `worldcup-data.json guardado (${size} KB)`);
}

// ============================================================================
// SCRAPERS
// ============================================================================

/**
 * Espera a que el bracket (.cuadro o equivalente) esté poblado
 * No aceptar "Loading..." como estado válido
 */
async function scrapeBracket(page) {
  log('info', 'Scrapeando bracket...');
  await page.goto(SOURCES.bracket, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // esperar a que cargue el contenido real (no "Loading...")
  try {
    await page.waitForFunction(
      () => {
        const text = document.body.innerText || '';
        return !text.includes('Loading') && text.length > 500;
      },
      { timeout: 15000 }
    );
  } catch (e) {
    log('warn', 'No se detectó fin de Loading, continúo con lo que haya');
  }

  // Estructura básica - ajustamos selectores reales cuando inspeccionemos
  const bracket = await page.evaluate(() => {
    const result = {
      grupos: [],
      dieciseisavos: [],
      octavos: [],
      cuartos: [],
      semis: [],
      final: null,
    };

    // Grupos - selector por ajustar según inspección real
    const grupoBlocks = document.querySelectorAll('.grupo, [class*="group"], .group-table');
    grupoBlocks.forEach((block, idx) => {
      const letra = block.querySelector('.group-letter, .letra, h3, h4')?.innerText?.trim() || String.fromCharCode(65 + idx);
      const equipos = [];
      block.querySelectorAll('tr, .equipo, .team-row').forEach(row => {
        const cells = row.querySelectorAll('td, .cell');
        if (cells.length >= 8) {
          equipos.push({
            nombre: cells[0]?.innerText?.trim(),
            pts: parseInt(cells[1]?.innerText) || 0,
            pj: parseInt(cells[2]?.innerText) || 0,
            pg: parseInt(cells[3]?.innerText) || 0,
            pe: parseInt(cells[4]?.innerText) || 0,
            pp: parseInt(cells[5]?.innerText) || 0,
            gf: parseInt(cells[6]?.innerText) || 0,
            gc: parseInt(cells[7]?.innerText) || 0,
            dg: parseInt(cells[8]?.innerText) || 0,
          });
        }
      });
      if (equipos.length > 0) result.grupos.push({ letra, equipos });
    });

    return result;
  });

  log('success', `Bracket scrapeado: ${bracket.grupos.length} grupos`);
  return bracket;
}

/**
 * Scrapea partidos del día desde la home
 */
async function scrapePartidosHoy(page) {
  log('info', 'Scrapeando partidos del día...');
  await page.goto(SOURCES.home, { waitUntil: 'domcontentloaded', timeout: 30000 });

  await sleep(2000); // pequeño delay para que cargue JS

  const partidos = await page.evaluate(() => {
    const result = [];
    const matchNodes = document.querySelectorAll('.match, .partido, [class*="match"], [class*="game"]');
    matchNodes.forEach(node => {
      const local = node.querySelector('.local, .home, [class*="home"]')?.innerText?.trim();
      const visita = node.querySelector('.visit, .away, [class*="away"]')?.innerText?.trim();
      const golesL = node.querySelector('.goles-local, .home-score')?.innerText?.trim();
      const golesV = node.querySelector('.goles-visita, .away-score')?.innerText?.trim();
      const minuto = node.querySelector('.minuto, .minute, [class*="time"]')?.innerText?.trim();
      const estado = node.querySelector('.estado, .status, [class*="status"]')?.innerText?.trim();
      const hora = node.querySelector('.hora, .hour')?.innerText?.trim();
      const link = node.closest('a')?.href || node.querySelector('a')?.href;

      if (local && visita) {
        let estadoNorm = 'programado';
        const estadoLow = (estado || '').toLowerCase();
        if (estadoLow.includes('vivo') || estadoLow.includes('live') || minuto) estadoNorm = 'en_vivo';
        else if (estadoLow.includes('final') || estadoLow.includes('finished')) estadoNorm = 'finalizado';

        result.push({
          id: link || `${local}-${visita}-${Date.now()}`,
          grupo: node.querySelector('.grupo, .group')?.innerText?.trim() || '',
          local, visita,
          golesLocal: parseInt(golesL) || 0,
          golesVisita: parseInt(golesV) || 0,
          estado: estadoNorm,
          minuto: minuto || null,
          hora: hora || null,
          link,
        });
      }
    });
    return result;
  });

  log('success', `Partidos del día: ${partidos.length}`);
  return partidos;
}

/**
 * Para cada partido en vivo, click y scrapea eventos + estadísticas
 */
async function scrapeMatchDetail(page, match) {
  if (!match.link) return match;
  if (match.estado !== 'en_vivo') return match; // sólo en vivo vale la pena

  try {
    log('debug', `Scrapeando detalle: ${match.local} vs ${match.visita}`);
    await page.goto(match.link, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(2500);

    const detail = await page.evaluate(() => {
      const eventos = [];
      document.querySelectorAll('.evento, .event, [class*="event"]').forEach(ev => {
        const min = ev.querySelector('.minuto, .minute')?.innerText?.trim();
        const tipo = ev.querySelector('.tipo, .type')?.innerText?.trim()?.toLowerCase();
        const equipo = ev.querySelector('.equipo, .team')?.innerText?.trim();
        const jugador = ev.querySelector('.jugador, .player')?.innerText?.trim();
        const detalle = ev.querySelector('.detalle, .detail')?.innerText?.trim();
        if (min && tipo) {
          eventos.push({
            minuto: min, tipo, equipo, jugador, detalle,
          });
        }
      });

      const estadisticas = {};
      document.querySelectorAll('.stat, .estadistica').forEach(stat => {
        const label = stat.querySelector('.label')?.innerText?.trim()?.toLowerCase();
        const local = stat.querySelector('.local, .home')?.innerText?.trim();
        const visita = stat.querySelector('.visita, .away')?.innerText?.trim();
        if (label) {
          if (label.includes('poses')) {
            estadisticas.posesionLocal = parseInt(local) || 0;
            estadisticas.posesionVisita = parseInt(visita) || 0;
          } else if (label.includes('tiro') || label.includes('shot')) {
            estadisticas.tirosLocal = parseInt(local) || 0;
            estadisticas.tirosVisita = parseInt(visita) || 0;
          } else if (label.includes('corner') || label.includes('tiro de esquina')) {
            estadisticas.cornersLocal = parseInt(local) || 0;
            estadisticas.cornersVisita = parseInt(visita) || 0;
          }
        }
      });

      return { eventos, estadisticas };
    });

    return { ...match, eventos: detail.eventos, estadisticas: detail.estadisticas };
  } catch (e) {
    log('warn', `No se pudo scrapear detalle de ${match.local} vs ${match.visita}`, { error: e.message });
    return match;
  }
}

// ============================================================================
// PIPELINE PRINCIPAL
// ============================================================================

async function scrapeAll() {
  const startTime = Date.now();
  log('info', '═'.repeat(60));
  log('info', 'Iniciando scrape completo');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  let newData = null;

  try {
    // 1) Bracket
    const bracket = await withRetry(() => scrapeBracket(page), 'bracket');

    // 2) Partidos del día
    const partidosBase = await withRetry(() => scrapePartidosHoy(page), 'partidos-hoy');

    // 3) Detalle de partidos en vivo (en serie para no overloadear)
    const partidos = [];
    for (const m of partidosBase) {
      const detail = await withRetry(() => scrapeMatchDetail(page, m), `match-${m.id}`);
      partidos.push(detail);
    }

    const torneo = {
      nombre: 'FIFA World Cup 2026',
      fase: determinarFase(partidos),
      actualizado: new Date().toISOString(),
    };

    newData = {
      torneo,
      grupos: bracket.grupos,
      partidosHoy: partidos,
      bracket: {
        dieciseisavos: bracket.dieciseisavos,
        octavos: bracket.octavos,
        cuartos: bracket.cuartos,
        semis: bracket.semis,
        final: bracket.final,
      },
    };

    saveData(newData);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    log('success', `Scrape completo en ${elapsed}s`);
    return newData;
  } catch (err) {
    log('error', 'Scrape falló completamente', { error: err.message });
    // mantener último JSON válido
    const last = loadLastValid();
    if (last) {
      log('warn', 'Manteniendo último JSON válido en disco');
      last.torneo.actualizado = new Date().toISOString();
      last._lastError = err.message;
      saveData(last);
    } else {
      log('error', 'No hay JSON previo y el scrape falló. No se guarda nada.');
    }
    return null;
  } finally {
    await browser.close();
  }
}

function determinarFase(partidos) {
  const enVivo = partidos.filter(p => p.estado === 'en_vivo');
  if (enVivo.length > 0) return 'En vivo';
  if (partidos.some(p => p.estado === 'programado')) return 'En disputa';
  return 'Actualizado';
}

// ============================================================================
// ENTRY POINT
// ============================================================================

async function main() {
  if (IS_ONCE) {
    log('info', 'Modo --once: una corrida y salir');
    await scrapeAll();
    process.exit(0);
  } else {
    log('info', 'Modo loop: scrape cada 60 segundos');
    await scrapeAll(); // primera corrida inmediata
    setInterval(async () => {
      try {
        await scrapeAll();
      } catch (e) {
        log('error', 'Loop tick falló', { error: e.message });
      }
    }, 60_000);
  }
}

main().catch(err => {
  log('error', 'Fatal', { error: err.message, stack: err.stack });
  process.exit(1);
});