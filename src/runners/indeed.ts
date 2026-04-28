import { Job } from "../types";
import { fetchIndeedPlaywright, enrichJobFullContent } from "../fetchers/scraper";
import { delay } from "../fetchers/scraper";
import { filterJobs, quickFilterByTitle } from "../filters/job";
import { FeedSource } from "../types";

const SCRAPER_DELAY = 2000;

export async function runIndeed(
  source: FeedSource,
  keywords: string[],
  exclude: string[],
  scoring: Record<string, number>,
  workModes: { remote: string[]; hybrid: string[]; presencial: string[]; allowedLocations?: string[] },
  maxJobs: number = 10,
  maxResults: number = 10
): Promise<Job[]> {
  console.log(`🕷️ Obteniendo de Indeed (Playwright)...`);  
  const scraperJobs = await fetchIndeedPlaywright(
    source.keywords || keywords,
    keywords.length,
    maxJobs
  );  
  console.log(`   Encontrados ${scraperJobs.length} jobs`);  
  // Filtro rápido por título antes de Playwright
  const quickFiltered = quickFilterByTitle(scraperJobs, exclude);
  console.log(`   Después de filtro rápido por título: ${quickFiltered.length} jobs`);
  
  // Enrich jobs with full content BEFORE filtering
  console.log(`   Enriqueciendo ${quickFiltered.length} ofertas con Playwright para filtrado...`);
  const enriched: Job[] = [];
  for (let i = 0; i < quickFiltered.length; i++) {
    const job = quickFiltered[i];
    console.log(`     [${i + 1}/${quickFiltered.length}] ${job.title.slice(0, 50)}...`);
    const enrichedJob = await enrichJobFullContent(job);
    enriched.push(enrichedJob);
    if (i < quickFiltered.length - 1) await delay(SCRAPER_DELAY);
  }
  
  console.log(`\n🔍 Filtrando ${enriched.length} ofertas enriquecidas...`);
  const filtered = filterJobs(enriched, keywords, exclude, scoring, workModes, maxResults);
  console.log(`✅ Después de filtros: ${filtered.length} jobs\n`);
  
  return filtered;
}