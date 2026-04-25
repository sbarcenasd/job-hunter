# Job Hunter 🔍

Sistema automatizado de búsqueda de empleo para desarrolladores Full Stack.

## Características

- Búsqueda automática en múltiples fuentes (RemoteOK, LinkedIn, Indeed, Computrabajo)
- Filtrado por stack tecnológico (NestJS, Node.js, TypeScript, React, etc.)
- Exclusión de vacantes no deseadas (junior, java, springboot, etc.)
- Scoring por afinidad (ubicación, modo de trabajo, stack)
- Enriquecimiento de contenido para LinkedIn/Indeed
- Export a JSON y Markdown

## Stack

- **Node.js** + **TypeScript**
- **YAML** para configuración
- **RSS Parser** para feeds
- **Cheerio** para scraping
- **Axios** para HTTP requests

## Instalación

```bash
npm install
npm run build
```

## Uso

```bash
# Buscar empleo ahora
npm run dev

# Build para producción
npm run build

# Ejecutar versión compilada
npm start
```

## Configuración

Edita los archivos en `config/`:

| Archivo | Descripción |
|---------|------------|
| `sources.yaml` | Fuentes RSS y scraping |
| `keywords.yaml` | Palabras clave de búsqueda |
| `exclude.yaml` | Términos a excluir |
| `scoring.yaml` | Puntos por match |
| `workmodes.yaml` | Detección de modo de trabajo |

## Estructura del Proyecto

```
src/
├── index.ts          # Entry point
├── types.ts          # Interfaces
├── config/
│   └── loader.ts    # Carga de configuración YAML
├── fetchers/
│   ├── rss.ts       # Fetch RSS feeds
│   └── scraper.ts   # Web scraping
├── filters/
│   └── job.ts       # Filtrado y scoring
└── utils/
    └── export.ts    # Exportación
```

## Scheduling

El script se ejecuta automáticamente todos los días a las 7:00 AM usando `node-cron`.

## Disclaimer

Este proyecto es para uso personal. Respeta los Términos de Servicio de cada plataforma.