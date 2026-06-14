# 🚀 Guía de deploy paso a paso

## 1) Crear el repo en GitHub

1. Andá a https://github.com/new
2. Nombre: `worldcup2026` (o lo que quieras)
3. Visibility: **Public** (necesario para que GitHub Actions gratis funcione)
4. **NO** inicialices con README (ya tenemos uno)
5. Click **Create repository**

## 2) Subir el código

```bash
cd worldcup2026
git init
git add .
git commit -m "feat: scraper + frontend inicial"
git branch -M main
git remote add origin https://github.com/TU-USER/worldcup2026.git
git push -u origin main
```

## 3) Activar GitHub Actions

1. En tu repo → pestaña **Actions**
2. Si te pregunta, aceptá que se ejecuten workflows
3. Click en **Scrape Mundial 2026** (en el panel izquierdo)
4. Click **Run workflow** → **Run workflow** (botón verde)
5. Esperá ~3-4 minutos. Primera vez instala Playwright, eso tarda.
6. Andá a **data/worldcup-data.json** y verificá que esté el JSON

> 💡 **Nota**: los selectores del scraper son tentativas. Probablemente necesites ajustar los selectores CSS de promiedos.com.ar cuando los inspecciones con DevTools. Ajustables en `scraper/index.js`.

## 4) Obtener la URL del JSON raw

Una vez que el JSON está commiteado, la URL es:

```
https://raw.githubusercontent.com/TU-USER/worldcup2026/main/data/worldcup-data.json
```

## 5) Deploy del frontend (yo lo hago por vos)

Decime "deployá el frontend" y te paso una URL pública permanente.

O, si querés hacerlo vos en otro lado (Netlify, Vercel, GitHub Pages):
- El frontend está en la carpeta `frontend/`
- Cualquier host estático sirve (es solo HTML/CSS/JS)
- **Importante**: actualizá `CONFIG.DATA_URL` en `frontend/app.js` con la URL raw de tu GitHub

## 6) Verificar

Andá a la URL del frontend y deberías ver:
- ✅ Estado "Conectando..." → "Actualizado" en el top
- ✅ Grupos con datos
- ✅ Partidos del día
- ✅ Hero con el partido en vivo (si hay)
- ✅ Board de acciones al hacer click en el botón flotante

---

## 🐛 Troubleshooting

**El scraper no devuelve datos / JSON vacío**
- Promiedos cambia sus selectores. Inspeccioná la página con DevTools
- Ajustá los selectores en `scraper/index.js`
- Corré `node scraper/index.js --once --debug` localmente

**GitHub Actions falla por timeout**
- El timeout default es 8 min. Está bien para el caso normal.
- Si falla, mirá los logs en la pestaña Actions

**CORS error en el frontend**
- Si usás otro dominio que no sea Claw, GitHub raw ya tiene CORS abierto
- Si hosteás vos, asegurate de tener `Access-Control-Allow-Origin: *`

---

## 🔄 Después: cuando agregues el otro programa

El JSON que ya está armado es la "fuente única de verdad". Tu otro programa puede:
- **Consumir**: hacer fetch a la URL raw del JSON
- **Producir**: si genera datos, agregalos como sección nueva en el JSON (ej: `data.predicciones`)

Cuando me lo pases, lo conecto en 5 minutos.
