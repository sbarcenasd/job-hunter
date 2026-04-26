import { Job } from "../types";
import { fetchLinkedInPlaywright } from "../fetchers/linkedin";
import { enrichJobFromHTML, delay } from "../fetchers/scraper";
import { filterJobs } from "../filters/job";
import { FeedSource } from "../types";
import { getLinkedInEmail, getLinkedInPassword } from "../config/env";

const SCRAPER_DELAY = 2000;
const MAX_TO_ENRICH = 10;

export async function runLinkedIn(
  source: FeedSource,
  keywords: string[],
  exclude: string[],
  scoring: Record<string, number>,
  workModes: { remote: string[]; hybrid: string[]; presencial: string[]; allowedLocations?: string[] },
  maxJobs: number = 10,
  maxResults: number = 10
): Promise<Job[]> {
  const email = getLinkedInEmail();
  const password = getLinkedInPassword();
  
  if (!email || !password) {
    console.log("⚠️ LinkedIn credentials not found in .env - skipping LinkedIn");
    return [];
  }
  
  console.log(`🕷️ Obteniendo de LinkedIn (Playwright)...`);
  
  const scraperJobs = await fetchLinkedInPlaywright(
    source.keywords || keywords,
    keywords.length,
    maxJobs,
    email,
    password
  );
  
  console.log(`   Encontrados ${scraperJobs.length} jobs\n`);
  
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