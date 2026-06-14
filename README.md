# 🏆 Mundial 2026 — Scraper + Frontend

Pipeline completo para extraer datos del Mundial 2026 desde promiedos.com.ar y servirlos en una página moderna estilo canal deportivo.

## 📐 Arquitectura

```
┌──────────────────────────┐
│  GitHub Actions (gratis) │
│  corre cada 5 min        │
│  └─ scraper (Playwright) │
│     └─> worldcup-data.json│
└──────────┬───────────────┘
           │ commit
           ▼
┌──────────────────────────┐
│  GitHub raw URL          │
│  raw.githubusercontent…  │
└──────────┬───────────────┘
           │ fetch cada 60s
           ▼
┌──────────────────────────┐
│  Frontend estático       │  ← deployado con Claw (permanente)
│  Claw                    │
│  World Cup 2026 Hub      │
└──────────────────────────┘
```

## 🗂️ Estructura del repo

```
worldcup2026/
├── scraper/                 # Node.js + Playwright
│   ├── index.js             # entry point
│   └── package.json
├── .github/workflows/
│   └── scrape.yml           # corre scraper cada 5 min
├── data/                    # generado, se commitea
│   ├── worldcup-data.json
│   └── scraper.log
├── frontend/                # HTML/CSS/JS estático
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── assets/
└── docs/
    └── deploy.md            # guía paso a paso
```

## 🚀 Setup local (opcional)

```bash
cd scraper
npm install
npx playwright install --with-deps chromium
node index.js --once --debug   # una corrida de prueba
```

## ⚙️ Activar GitHub Actions

1. Subir este repo a GitHub
2. Ir a la pestaña **Actions**
3. Click en **Scrape Mundial 2026** → **Run workflow** (la primera vez)
4. Esperar a que termine y verificar que `data/worldcup-data.json` aparezca en el repo
5. Copiar la URL raw:
   ```
   https://raw.githubusercontent.com/<TU-USER>/<TU-REPO>/main/data/worldcup-data.json
   ```
6. Pegarla en `frontend/app.js` (variable `DATA_URL`)

## 🎨 Deploy del frontend

El frontend se deploya con `website_deploy` desde Mavis. Una vez activo, la URL queda permanente y cualquiera puede ver los datos en vivo.

## 📊 Estructura del JSON

Ver `data/worldcup-data.json` después de la primera corrida. Esquema:

```json
{
  "torneo": { "nombre", "fase", "actualizado" },
  "grupos": [ { "letra", "equipos": [...] } ],
  "partidosHoy": [ { "id","local","visita","goles","estado","minuto","eventos","estadisticas" } ],
  "bracket": { "dieciseisavos","octavos","cuartos","semis","final" }
}
```

## 🛡️ Manejo de errores

- 3 reintentos con backoff exponencial (2s, 4s, 8s)
- Si todo falla, mantiene el último JSON válido (no sobreescribe con vacío)
- Log en `data/scraper.log`

## 📌 TODO (fase 2)

- [ ] YouTube IDs por partido (highlights)
- [ ] Scraping de noticias por partido/equipo
- [ ] 3-4 personajes avatares (presentadores)
- [ ] Radio en vivo por partido
- [ ] Conexión con el otro programa del usuario
