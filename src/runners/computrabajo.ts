import { Job } from "../types";
import { fetchComputrabajo, enrichComputrabajoJob } from "../fetchers/scraper";
import { delay } from "../fetchers/scraper";
import { filterJobs } from "../filters/job";
import { FeedSource } from "../types";

const SCRAPER_DELAY = 2000;

export async function runComputrabajo(
  source: FeedSource,
  keywords: string[],
  exclude: string[],
  scoring: Record<string, number>,
  workModes: { remote: string[]; hybrid: string[]; presencial: string[]; allowedLocations?: string[] },
  maxJobs: number = 10,
  maxResults: number = 10
): Promise<Job[]> {
  console.log(`🕷️ Obteniendo de Computrabajo (scraper)...`);
  
  const scraperJobs = await fetchComputrabajo(
    source.keywords || keywords,
    keywords.length,
    maxJobs
  );
  
  console.log(`   Encontrados ${scraperJobs.length} jobs\n`);
  
  const filtered = filterJobs(scraperJobs, keywords, exclude, scoring, workModes, maxResults);
  console.log(`✅ Después de filtros: ${filtered.length} jobs\n`);
  
  const enrichedCT: Job[] = [];
  for (let i = 0; i < filtered.length; i++) {
    const job = filtered[i];
    console.log(`  [${i + 1}/${filtered.length}] ${job.title.slice(0, 50)}...`);
    const enrichedJob = await enrichComputrabajoJob(job);
    console.log(`       📝 Salary: ${enrichedJob.salary || "-"}`);
    enrichedCT.push(enrichedJob);
    if (i < filtered.length - 1) await delay(SCRAPER_DELAY);
  }
  
  return enrichedCT;
}