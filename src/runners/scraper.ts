import { Job, FeedSource } from "../types";
import { fetchScraperSource } from "../fetchers/scraper";
import { filterJobs } from "../filters/job";

const SCRAPER_DELAY = 2000;
const MAX_TO_ENRICH = 10;

export async function runScraper(
  source: FeedSource,
  keywords: string[],
  exclude: string[],
  scoring: Record<string, number>,
  workModes: { remote: string[]; hybrid: string[]; presencial: string[]; allowedLocations?: string[] },
  maxJobs: number = 10,
  maxResults: number = 10
): Promise<Job[]> {
  console.log(`🕷️ Obteniendo de ${source.name} (scraper)...`);
  
  const scraperJobs = await fetchScraperSource(source, keywords.slice(0, source.keywords?.length || 3));
  console.log(`   Encontrados ${scraperJobs.length} jobs\n`);
  
  const filtered = filterJobs(scraperJobs, keywords, exclude, scoring, workModes, maxResults);
  console.log(`✅ Después de filtros: ${filtered.length} jobs\n`);
  
  return filtered.slice(0, maxJobs);
}