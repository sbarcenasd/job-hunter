import { Job } from "../types";
import { fetchAllRSS } from "../fetchers/rss";
import { enrichJobsWithDelay } from "../fetchers/scraper";
import { filterJobs } from "../filters/job";
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
  console.log(`   Encontrados ${rssJobs.length} jobs\n`);
  
  const filtered = filterJobs(rssJobs, keywords, exclude, scoring, workModes, maxResults);
  console.log(`✅ Después de filtros: ${filtered.length} jobs\n`);
  
  const enriched = await enrichJobsWithDelay(filtered, MAX_TO_ENRICH);
  
  return { jobs: filtered, enriched };
}