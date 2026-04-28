import { Job } from "../types";
import { fetchAllRSS } from "../fetchers/rss";
import { enrichJobFullContent } from "../fetchers/scraper";
import { filterJobs, quickFilterByTitle } from "../filters/job";
import { FeedSource } from "../types";

const MAX_TO_ENRICH = 10;

export async function runRSS(
  source: FeedSource,
  keywords: string[],
  exclude: string[],
  scoring: Record<string, number>,
  workModes: { remote: string[]; hybrid: string[]; presencial: string[]; allowedLocations?: string[] },
  maxJobsPerFeed: number = 5,
  maxResults: number = 10
): Promise<{ jobs: Job[]; enriched: Job[] }> {
  console.log(`📡 Obteniendo de ${source.name} (RSS)...`);  
  const rssJobs = await fetchAllRSS([source], maxJobsPerFeed);
  console.log(`   Encontrados ${rssJobs.length} jobs`);  
  // Filtro rápido por título antes de Playwright
  const quickFiltered = quickFilterByTitle(rssJobs, exclude);
  console.log(`   Después de filtro rápido por título: ${quickFiltered.length} jobs`);
  
  // Enrich jobs with full content BEFORE filtering
  console.log(`   Enriqueciendo ${quickFiltered.length} ofertas con Playwright para filtrado...`);
  const enriched: Job[] = [];
  for (let i = 0; i < Math.min(quickFiltered.length, MAX_TO_ENRICH); i++) {
    const job = quickFiltered[i];
    console.log(`     [${i + 1}/${Math.min(quickFiltered.length, MAX_TO_ENRICH)} ${job.title.slice(0, 50)}...`);
    const enrichedJob = await enrichJobFullContent(job);
    enriched.push(enrichedJob);
  }
  
  const filtered = filterJobs(enriched, keywords, exclude, scoring, workModes, maxResults);
  console.log(`✅ Después de filtros: ${filtered.length} jobs\n`);
  
  return { jobs: filtered, enriched: filtered };
}