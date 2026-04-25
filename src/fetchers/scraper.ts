import axios from "axios";
import * as cheerio from "cheerio";
import { Job, FeedSource } from "../types";

export const SCRAPER_DELAY = 2000;

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchPageContent(url: string): Promise<string> {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      },
      timeout: 15000,
    });
    return response.data;
  } catch (error) {
    return "";
  }
}

export async function fetchScraperSource(source: FeedSource, keywords: string[]): Promise<Job[]> {
  const jobs: Job[] = [];
  
  if (!source.keywords || source.keywords.length === 0) {
    source.keywords = keywords;
  }
  
  const location = source.location === "colombia" ? "Colombia" : 
                 source.location === "remote" ? "Remote" : "Colombia";
  
  for (const keyword of source.keywords) {
    let url = source.searchUrl || source.url;
    url = url.replace("{keyword}", encodeURIComponent(keyword));
    url = url.replace("{location}", encodeURIComponent(location));
    
    try {
      const html = await fetchPageContent(url);
      
      if (!html) continue;
      
      const $ = cheerio.load(html);
      
      $(".job-search-card, .job-card-container").each((_, element) => {
        const title = $(element).find(".job-card-list__title, .job-card-list__title--link").text().trim() || 
                     $(element).find("h3").first().text().trim();
        let link = $(element).find("a").attr("href") || "";
        
        link = link.replace(/https:\/\/www\.linkedin\.comhttps?:\/\/[a-z]+\.linkedin\.com/, "https://www.linkedin.com");
        link = link.replace(/^\/\//, "https://");
        
        if (!link.startsWith("http")) {
          link = "https://www.linkedin.com" + link;
        }
        
        const company = $(element).find(".job-card-container__company-name, .artdeco-entity-lockup__subtitle").text().trim() || "";
        const locationText = $(element).find(".job-card-container__metadata-item, .job-card-container__metadata-item").text().trim();
        
        if (title && link && link.includes("/jobs/view/")) {
          jobs.push({
            title: title.trim(),
            link,
            content: `${title} ${company} ${locationText}`.toLowerCase(),
            source: source.name,
            location: locationText.toLowerCase().includes("colombia") ? "colombia" : "remote",
            score: 0,
            date: new Date().toISOString(),
          });
        }
      });
      
      await delay(SCRAPER_DELAY);
    } catch (error) {
      console.error(`Error fetching ${source.name} (${keyword}):`, (error as Error).message);
    }
  }
  
  return jobs;
}

function extractLinkedInJob(html: string): { description: string; salary?: string; location?: string; workMode?: string } {
  const $ = cheerio.load(html);
  
  let description = "";
  let salary: string | undefined;
  let location: string | undefined;
  let workMode: string | undefined;
  
  description = $("body").text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
  
  const salaryMatch = description.match(/(\$[\d,.]+|\d+[\d,.]*\s*(k|K|mil|MIL|pesos|COP|USD))/i);
  if (salaryMatch) salary = salaryMatch[0];
  
  const locationPatterns = [
    /trabajo\s+en\s+([^,\.]+)/i,
    /en\s+([^,\.]+)\s*-\s*LinkedIn/i,
    /ubicación[:\s]*([^\n]+)/i,
  ];
  
  for (const pattern of locationPatterns) {
    const match = description.match(pattern);
    if (match) {
      location = match[1].trim();
      break;
    }
  }
  
  const workModePatterns = [
    /hybrid|hibrido|presencial|remote|remoto|work from home/i
  ];
  
  for (const pattern of workModePatterns) {
    const match = description.match(pattern);
    if (match) {
      workMode = match[0].toLowerCase();
      break;
    }
  }
  
  return { description, salary, location, workMode };
}

export async function enrichJobFromHTML(job: Job): Promise<Job> {
  const html = await fetchPageContent(job.link);
  
  if (!html) return job;

  const extracted = extractLinkedInJob(html);
  
  if (extracted.description.length > job.content.length) {
    job.content = extracted.description;
  }
  
  if (extracted.salary && !job.salary) {
    job.salary = extracted.salary;
  }
  
  if (extracted.workMode && !job.workMode) {
    job.workMode = extracted.workMode;
  }
  
  return job;
}

export async function enrichJobsWithDelay(jobs: Job[], maxToEnrich: number = 10): Promise<Job[]> {
  const enriched: Job[] = [];
  
  console.log(`\n📥 Enriquciendo ${Math.min(jobs.length, maxToEnrich)} ofertas...\n`);
  
  for (let i = 0; i < Math.min(jobs.length, maxToEnrich); i++) {
    const job = jobs[i];
    console.log(`  [${i + 1}/${Math.min(jobs.length, maxToEnrich)}] ${job.title.slice(0, 50)}...`);
    
    const enrichedJob = await enrichJobFromHTML(job);
    
    console.log(`       📝 Contenido: ${enrichedJob.content.length} chars | 💰 ${enrichedJob.salary || "-"}`);
    
    enriched.push(enrichedJob);
    
    if (i < Math.min(jobs.length, maxToEnrich) - 1) {
      await delay(SCRAPER_DELAY);
    }
  }
  
  return enriched;
}

export async function fetchComputrabajo(keywords: string[], maxKeywords: number = 3, maxJobs: number = 10): Promise<Job[]> {
  const baseUrl = "https://co.computrabajo.com/trabajo-de-";
  const jobs: Job[] = [];
  const seenLinks = new Set<string>();
  let jobCount = 0;

  for (const keyword of keywords.slice(0, maxKeywords)) {
    if (jobCount >= maxJobs) break;
    try {
      const url = `${baseUrl}${encodeURIComponent(keyword)}`;
      const html = await fetchPageContent(url);

      if (!html) continue;

      const $ = cheerio.load(html);
      $("h2.fs18").each((_, element) => {
        if (jobCount >= maxJobs) return false;
        
        const titleLink = $(element).find("a.js-o-link");
        const title = titleLink.text().trim() || $(element).text().trim();
        let link = titleLink.attr("href") || "";
        
        if (link && !link.startsWith("http")) {
          link = "https://co.computrabajo.com" + link;
        }
        
        if (seenLinks.has(link)) return;
        seenLinks.add(link);
        
        const parent = $(element).parent();
        const company = parent.find(".fc_mg span, .fc_tertiary").first().text().trim();
        const location = parent.find(".fc_dest, .location-text, [class*='location']").text().trim();
        
        if (title && link) {
          jobs.push({
            title,
            link,
            content: `${title} ${company} ${location}`.toLowerCase(),
            source: "Computrabajo",
            location: "colombia",
            score: 0,
            date: new Date().toISOString(),
          });
          jobCount++;
        }
      });
      
      if (jobCount >= maxJobs) break;
      await delay(SCRAPER_DELAY);
    } catch (error) {
      console.error(`Error fetching Computrabajo (${keyword}):`, (error as Error).message);
    }
  }

  return jobs;
}

function extractComputrabajoDetails(html: string): { salary?: string; conditions?: string; location?: string } {
  const $ = cheerio.load(html);
  
  let salary: string | undefined;
  let conditions: string | undefined;
  let location: string | undefined;
  
  const allText = $("body").text();
  
  const salaryMatch = allText.match(/Salario[:\s]*[\$][\d,.]+|[\d,.]+\s*(mil|pesos)/i);
  if (salaryMatch) salary = salaryMatch[0];
  
  const condMatch = allText.match(/Condiciones[:\s]*[^\n]+/i);
  if (condMatch) conditions = condMatch[0];
  
  const locMatch = allText.match(/ubicaci[óo]n[:\s]*[^\n]+/i);
  if (locMatch) location = locMatch[0];
  
  return { salary, conditions, location };
}

export async function enrichComputrabajoJob(job: Job): Promise<Job> {
  const html = await fetchPageContent(job.link);
  
  if (!html) return job;
  
  const extracted = extractComputrabajoDetails(html);
  
  if (extracted.salary) {
    job.salary = extracted.salary;
  }
  
  if (extracted.conditions) {
    job.content += " " + extracted.conditions.toLowerCase();
  }
  
  return job;
}