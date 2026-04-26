import axios from "axios";
import * as cheerio from "cheerio";
import { chromium } from "playwright";
import { Job, FeedSource } from "../types";

export const SCRAPER_DELAY = 2000;

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay() {
  return Math.floor(Math.random() * 3000) + 2000;
}

export async function fetchPageContent(url: string): Promise<string> {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
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
  const location = source.location === "colombia" ? "Colombia" : source.location === "remote" ? "Remote" : "Colombia";
  
  for (const keyword of source.keywords) {
    let url = source.searchUrl || source.url;
    url = url.replace("{keyword}", encodeURIComponent(keyword));
    url = url.replace("{location}", encodeURIComponent(location));
    
    try {
      const html = await fetchPageContent(url);
      if (!html) continue;
      
      const $ = cheerio.load(html);
      $(".job-search-card, .job-card-container").each((_, element) => {
        const title = $(element).find(".job-card-list__title, .job-card-list__title--link").text().trim() || $(element).find("h3").first().text().trim();
        let link = $(element).find("a").attr("href") || "";
        link = link.replace(/https:\/\/www\.linkedin\.comhttps?:\/\/[a-z]+\.linkedin\.com/, "https://www.linkedin.com").replace(/^\/\//, "https://");
        if (!link.startsWith("http")) link = "https://www.linkedin.com" + link;
        
        const company = $(element).find(".job-card-container__company-name, .artdeco-entity-lockup__subtitle").text().trim();
        const locationText = $(element).find(".job-card-container__metadata-item").text().trim();
        
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

export async function fetchComputrabajo(keywords: string[], maxKeywords: number = 3, maxJobs: number = 10): Promise<Job[]> {
  const baseUrl = "https://co.computrabajo.com/trabajo-de-";
  const jobs: Job[] = [];
  const seenLinks = new Set<string>();

  for (const keyword of keywords.slice(0, maxKeywords)) {
    try {
      const url = `${baseUrl}${encodeURIComponent(keyword)}`;
      const html = await fetchPageContent(url);
      if (!html) continue;

      const $ = cheerio.load(html);
      $("h2.fs18").each((_, element) => {
        if (jobs.length >= maxJobs) return;
        const titleLink = $(element).find("a.js-o-link");
        const title = titleLink.text().trim() || $(element).text().trim();
        let link = titleLink.attr("href") || "";
        if (link && !link.startsWith("http")) link = "https://co.computrabajo.com" + link;
        if (seenLinks.has(link)) return;
        seenLinks.add(link);
        const parent = $(element).parent();
        const company = parent.find(".fc_mg span, .fc_tertiary").first().text().trim();
        const location = parent.find(".fc_dest").text().trim();
        
        if (title && link) {
          jobs.push({ title, link, content: `${title} ${company} ${location}`.toLowerCase(), source: "Computrabajo", location: "colombia", score: 0, date: new Date().toISOString() });
        }
      });
      if (jobs.length >= maxJobs) break;
      await delay(SCRAPER_DELAY);
    } catch (error) {
      console.error(`Error fetching Computrabajo (${keyword}):`, (error as Error).message);
    }
    if (jobs.length >= maxJobs) break;
  }
  return jobs.slice(0, maxJobs);
}

export async function fetchIndeedPlaywright(keywords: string[], maxKeywords: number = 3, maxJobs: number = 10): Promise<Job[]> {
  const jobs: Job[] = [];
  const seenLinks = new Set<string>();
  let browser;
  
  try {
    browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      locale: 'es-CO', viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();
    
    for (const keyword of keywords.slice(0, maxKeywords)) {
      if (jobs.length >= maxJobs) break;
      
      let attempts = 0;
      while (attempts < 2 && jobs.length < maxJobs) {
        try {
          await page.goto(`https://co.indeed.com/jobs?q=${encodeURIComponent(keyword)}&l=Colombia`, { waitUntil: 'domcontentloaded', timeout: 45000 });
          await page.waitForTimeout(randomDelay());
          
          const pageContent = await page.content();
          const $ = cheerio.load(pageContent);
          
          $('.job_seen_beacon, .job_card').each((_, element) => {
            if (jobs.length >= maxJobs) return;
            const titleEl = $(element).find('h2, .jobTitle').first();
            const title = titleEl.text().trim();
            const link = 'https://co.indeed.com' + (titleEl.find('a').attr('href') || $(element).find('a').attr('href') || '');
            const company = $(element).find('.companyName').text().trim();
            const locationIndeed = $(element).find('.companyLocation').text().trim().toLowerCase();
            const isLocationRemote = locationIndeed.includes('remote') || locationIndeed.includes('remoto');
            const jobLocation = isLocationRemote ? 'remote' : 'colombia';
            if (title && link && !seenLinks.has(link)) {
              seenLinks.add(link);
              jobs.push({ title, link, content: `${title} ${company} ${locationIndeed}`.toLowerCase(), source: 'Indeed', location: jobLocation, score: 0, date: new Date().toISOString() });
            }
          });
          break;
        } catch (error) {
          attempts++;
          await page.waitForTimeout(randomDelay() * 2);
        }
      }
      if (jobs.length >= maxJobs) break;
      await page.waitForTimeout(randomDelay());
    }
  } finally {
    if (browser) await browser.close();
  }
  return jobs.slice(0, maxJobs);
}

export async function fetchLinkedInPlaywright(keywords: string[], maxKeywords: number = 3, maxJobs: number = 10, email?: string, password?: string): Promise<Job[]> {
  const jobs: Job[] = [];
  const seenLinks = new Set<string>();
  let browser;
  
  if (!email || !password) {
    console.log("⚠️ No LinkedIn credentials - skipping");
    return jobs;
  }
  
  console.log(`🔐 Logging in to LinkedIn as ${email}...`);
  
  try {
    browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      locale: 'es-CO', viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();
    
    for (const keyword of keywords.slice(0, maxKeywords)) {
      if (jobs.length >= maxJobs) break;
      
      let attempts = 0;
      while (attempts < 2 && jobs.length < maxJobs) {
        try {
          await page.goto(`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keyword)}&location=Colombia`, { waitUntil: 'domcontentloaded', timeout: 45000 });
          await page.waitForTimeout(randomDelay());
          
          const pageContent = await page.content();
          const $ = cheerio.load(pageContent);
          
          $('.job-card-container, .jobs-search-results__list-item').each((_, element) => {
            if (jobs.length >= maxJobs) return;
            const titleEl = $(element).find('.job-card-list__title, h3').first();
            const title = titleEl.text().trim();
            let link = $(element).find('a').first().attr('href') || '';
            if (link && !link.startsWith('http')) link = 'https://www.linkedin.com' + link;
            const company = $(element).find('.job-card-container__company-name, .artdeco-entity-lockup__subtitle').text().trim();
            const location = $(element).find('.job-card-container__metadata-item').text().trim();
            if (title && link && !seenLinks.has(link)) {
              seenLinks.add(link);
              jobs.push({ title, link, content: `${title} ${company} ${location}`.toLowerCase(), source: 'LinkedIn', location: 'colombia', score: 0, date: new Date().toISOString() });
            }
          });
          break;
        } catch (error) {
          attempts++;
          await page.waitForTimeout(randomDelay() * 2);
        }
      }
      if (jobs.length >= maxJobs) break;
      await page.waitForTimeout(randomDelay());
    }
  } finally {
    if (browser) await browser.close();
  }
  return jobs.slice(0, maxJobs);
}

export async function enrichComputrabajoJob(job: Job): Promise<Job> {
  const html = await fetchPageContent(job.link);
  if (!html) return job;
  const $ = cheerio.load(html);
  const allText = $("body").text();
  const salaryMatch = allText.match(/Salario[:\s]*[\$][\d,.]+|[\d,.]+\s*(mil|pesos)/i);
  if (salaryMatch) job.salary = salaryMatch[0];
  return job;
}

export async function enrichJobFromHTML(job: Job): Promise<Job> {
  const html = await fetchPageContent(job.link);
  if (!html) return job;
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, 8000);
  const salaryMatch = text.match(/(\$[\d,.]+|\d+[\d,.]*\s*(k|K|mil|pesos|COP|USD))/i);
  if (salaryMatch) job.salary = salaryMatch[0];
  return job;
}

export async function enrichJobsWithDelay(jobs: Job[], maxToEnrich: number = 10): Promise<Job[]> {
  const enriched: Job[] = [];
  for (let i = 0; i < Math.min(jobs.length, maxToEnrich); i++) {
    const job = jobs[i];
    const enrichedJob = await enrichJobFromHTML(job);
    enriched.push(enrichedJob);
    if (i < maxToEnrich - 1) await delay(SCRAPER_DELAY);
  }
  return enriched;
}