# Job Hunter - Progreso

## Sesión: Refactorización Modular + type: scraper

---

## ✅ Completado

### 1. Estructura Modular
```
src/
├── types.ts              # Interfaces compartidas
├── index.ts              # Entry point simplificado
├── config/
│   └── loader.ts         # Carga YAML
├── fetchers/
│   ├── rss.ts            # Fetch RSS feeds
│   └── scraper.ts       # Web scraping
├── filters/
│   └── job.ts            # Filtrado y scoring
└── utils/
    └── export.ts         # Export JSON + Markdown
```

### 2. type: "scraper" en sources.yaml
- `FeedSource.type` ahora soporta `"rss" | "scraper"`
- Configuración de scrapers en YAML:
  - `searchUrl` con placeholders `{keyword}`, `{location}`
  - `keywords` configurables por fuente

### 3. fetchScraperSource() Genérico
- Recibe `FeedSource` como parámetro
- Reemplaza placeholders en URL
- Soporta múltiples keywords

### 4. Variables de Control (en index.ts)
```typescript
const MAX_JOBS_PER_FEED = 3;
const MAX_RESULTS = 15;
const MAX_TO_ENRICH = 3;
```

### 5. GitHub
- Repo: https://github.com/sbarcenasd/job-hunter
- Rama: main
- README.md + .gitignore

---

## 📊 Estadísticas Actuales
| Métrica | Valor |
|--------|-------|
| Jobs scraper | 137 |
| Total filtrado | 15 → 12 |
| Enriquecidos | 3 |

---

## 🔧 Configuración Activa
| Fuente | Estado |
|--------|--------|
| RemoteOK RSS | ❌ Deshabilitado |
| LinkedIn Colombia RSS | ❌ Deshabilitado |
| LinkedIn Remoto RSS | ❌ Deshabilitado |
| LinkedIn Scraping | ✅ Habilitado |
| Computrabajo | ❌ Deshabilitado |

---

## 📝 Comandos
```bash
npm run dev      # Desarrollo
npm run build   # Build
npm start       # Producción
```