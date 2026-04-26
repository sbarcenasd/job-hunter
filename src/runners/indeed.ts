import { Job } from "../types";
import { fetchIndeedPlaywright, enrichJobFromHTML } from "../fetchers/scraper";
import { delay } from "../fetchers/scraper";
import { filterJobs } from "../filters/job";
import { FeedSource } from "../types";

const SCRAPER_DELAY = 2000;
const MAX_TO_ENRICH = 10;

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
  if (scraperJobs.length > 0) {
    console.log(`   [DEBUG] Primer job: "${scraperJobs[0].title.slice(0,40)}"`);
    console.log(`   [DEBUG] content: "${scraperJobs[0].content.slice(0,80)}"`);
    console.log(`   [DEBUG] keywords: ${JSON.stringify(keywords.slice(0,5))}`);
  }
  console.log("");
  
  const filtered = filterJobs(scraperJobs, keywords, exclude, scoring, workModes, maxResults);
  console.log(`✅ Después de filtros: ${filtered.length} jobs\n`);
  
  const enriched: Job[] = [];
  for (let i = 0; i < filtered.length; i++) {
    const job = filtered[i];
    console.log(`  [${i + 1}/${filtered.length}] ${job.title.slice(0, 50)}...`);
    const enrichedJob = await enrichJobFromHTML(job);
    console.log(`       📝 Salary: ${enrichedJob.salary || "-"}`);
    enriched.push(enrichedJob);
    if (i < filtered.length - 1) await delay(SCRAPER_DELAY);
  }
  
  return enriched;
}