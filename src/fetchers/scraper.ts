import axios from "axios";
import * as cheerio from "cheerio";
import { Job } from "../types";

const SCRAPER_DELAY = 2000; // 2 segundos entre requests

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchPageContent(url: string): Promise<string> {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      timeout: 15000,
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching ${url}:`, (error as Error).message);
    return "";
  }
}

export async function enrichJobFromHTML(job: Job): Promise<Job> {
  const html = await fetchPageContent(job.link);
  
  if (!html) return job;

  const $ = cheerio.load(html);
  
  // Intentar extraer más información
  const fullContent = $("body").text().toLowerCase();
  
  // Si el contenido actual es muy corto, usar el nuevo
  if (job.content.length < 100 && fullContent.length > job.content.length) {
    job.content = fullContent.slice(0, 5000); // Limitar a 5000 chars
  }
  
  return job;
}

export async function enrichJobsWithDelay(jobs: Job[], maxToEnrich: number = 10): Promise<Job[]> {
  const enriched: Job[] = [];
  
  for (let i = 0; i < Math.min(jobs.length, maxToEnrich); i++) {
    console.log(`Enriquciendo ${i + 1}/${Math.min(jobs.length, maxToEnrich)}: ${jobs[i].title.slice(0, 40)}...`);
    
    const enrichedJob = await enrichJobFromHTML(jobs[i]);
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