import { Job } from "../types";
import { fetchLinkedInPlaywright } from "../fetchers/linkedin";
import { enrichJobFullContent, delay } from "../fetchers/scraper";
import { filterJobs } from "../filters/job";
import { FeedSource } from "../types";
import { getLinkedInEmail, getLinkedInPassword } from "../config/env";

const SCRAPER_DELAY = 2000;

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
  
  // Pasar exclude terms para filtrar títulos DURANTE la búsqueda
  const scraperJobs = await fetchLinkedInPlaywright(
    source.keywords || keywords,
    keywords.length,
    maxJobs,
    email,
    password,
    exclude  // Nuevo parámetro
  );  
  
  console.log(`   Encontrados ${scraperJobs.length} jobs (ya filtrados por título)`);  
    
  // Enrich jobs with full content BEFORE filtering
  console.log(`   Enriqueciendo ${scraperJobs.length} ofertas con Playwright para filtrado...`);
  const enriched: Job[] = [];
  for (let i = 0; i < scraperJobs.length; i++) {
    const job = scraperJobs[i];
    console.log(`     [${i + 1}/${scraperJobs.length}] ${job.title.slice(0, 50)}...`);
    const enrichedJob = await enrichJobFullContent(job);
    enriched.push(enrichedJob);
    if (i < scraperJobs.length - 1) await delay(SCRAPER_DELAY);
  }
  
  console.log(`\n🔍 Filtrando ${enriched.length} ofertas enriquecidas...`);
  const filtered = filterJobs(enriched, keywords, exclude, scoring, workModes, maxResults);
  console.log(`✅ Después de filtros: ${filtered.length} jobs\n`);
  
  return filtered;
}