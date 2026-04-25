import axios from "axios";
import * as cheerio from "cheerio";
import { Job } from "../types";

const SCRAPER_DELAY = 2000;

async function delay(ms: number): Promise<void> {
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

export async function fetchLinkedInJobs(keywords: string[]): Promise<Job[]> {
  const jobs: Job[] = [];
  
  const searchUrls = [
    "https://www.linkedin.com/jobs/search/?keywords=full+stack+developer&location=Colombia&f_TPR=r604800",
    "https://www.linkedin.com/jobs/search/?keywords=node+developer&location=Latin+America",
    "https://www.linkedin.com/jobs/search/?keywords=nestjs+developer&remote=yes",
  ];
  
  for (const url of searchUrls) {
    try {
      const html = await fetchPageContent(url);
      
      if (!html) continue;
      
      const $ = cheerio.load(html);
      
      $(".job-search-card").each((_, element) => {
        const title = $(element).find(".job-card-list__title").text().trim() || 
                     $(element).find("h3").first().text().trim();
        let link = $(element).find("a").attr("href") || "";
        
        link = link.replace(/https:\/\/www\.linkedin\.comhttps?:\/\/[a-z]+\.linkedin\.com/, "https://www.linkedin.com");
        link = link.replace(/^\/\//, "https://");
        
        if (!link.startsWith("http")) {
          link = "https://www.linkedin.com" + link;
        }
        
        const company = $(element).find(".job-card-container__company-name").text().trim() ||
                       $(element).find(".artdeco-entity-lockup__subtitle").text().trim() ||
                       $(element).find("a").find("img").attr("alt") || "";
        const location = $(element).find(".job-card-container__metadata-item").text().trim();
        
        if (title && link && link.includes("/jobs/view/")) {
          jobs.push({
            title: title.trim(),
            link,
            content: `${title} ${company} ${location}`.toLowerCase(),
            source: "LinkedIn",
            location: location.toLowerCase().includes("colombia") ? "colombia" : "remote",
            score: 0,
            date: new Date().toISOString(),
          });
        }
      });
      
      if (jobs.length > 0) break;
      
      await delay(SCRAPER_DELAY);
    } catch (error) {
      console.error(`Error fetching LinkedIn:`, (error as Error).message);
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

export async function fetchComputrabajo(keywords: string[], maxKeywords: number = 3): Promise<Job[]> {
  const baseUrl = "https://www.computrabajo.com.co/ofertas-de-trabajo/";
  const jobs: Job[] = [];

  for (const keyword of keywords.slice(0, maxKeywords)) {
    try {
      const url = `${baseUrl}?q=${encodeURIComponent(keyword)}`;
      const html = await fetchPageContent(url);

      if (!html) continue;

      const $ = cheerio.load(html);
      $(".box_offer").each((_, element) => {
        const title = $(element).find(".title_offer a").text().trim();
        const link = "https://www.computrabajo.com.co" + $(element).find(".title_offer a").attr("href");
        const content = $(element).find(".description").text().trim();

        if (title && link) {
          jobs.push({
            title,
            link,
            content: content.toLowerCase(),
            source: "Computrabajo",
            location: "colombia",
            score: 0,
            date: new Date().toISOString(),
          });
        }
      });

      await delay(SCRAPER_DELAY);
    } catch (error) {
      console.error(`Error fetching Computrabajo (${keyword}):`, (error as Error).message);
    }
  }

  return jobs;
}