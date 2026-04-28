import { Job } from "../types";
import { chromium } from "playwright";

function randomDelay() {
  return Math.floor(Math.random() * 3000) + 2000;
}

export async function fetchLinkedInPlaywright(keywords: string[], maxKeywords: number = 3, maxJobs: number = 10, email?: string, password?: string): Promise<Job[]> {
  const jobs: Job[] = [];
  const seenLinks = new Set<string>();
  let browser = null;
  
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
    
    // Login
    await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#username', { timeout: 15000 });
    await page.fill('#username', email);
    await page.waitForTimeout(500);
    await page.fill('#password', password);
    await page.click('[type="submit"]');
    await page.waitForTimeout(10000);
    
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('checkpoint')) {
      console.log("❌ Login failed - need verification");
      if (browser) await browser.close();
      return jobs;
    }
    
    console.log("✅ Logged in");
    
    // Wait for page to fully load
    await page.waitForTimeout(3000);
    
    // Search for each keyword
    for (const keyword of keywords.slice(0, maxKeywords)) {
      if (jobs.length >= maxJobs) break;
      
      console.log(`🔍 Searching: ${keyword}`);
      await page.goto(`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keyword)}&location=Colombia`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3000);
      
      // Get job cards using Playwright
      const jobCards = await page.locator('.job-card-container, .jobs-search-results__list-item').all();
      console.log(`  Found ${jobCards.length} job cards`);
      
       for (const card of jobCards) {
         if (jobs.length >= maxJobs) break;
         
         try {
           // Extract job title from card
           let title = '';
           try {
             title = await card.locator('.job-card-list__title, .base-search-card__title, h3, [data-artifact-id="job-title"]').first().textContent({ timeout: 3000 }) || '';
           } catch {
             title = await card.locator('a').first().textContent({ timeout: 3000 }) || '';
           }
           title = title.trim();
           if (!title) title = 'LinkedIn Job';
           
           // Find the anchor link inside the card
           const anchor = card.locator('a').first();
           let link = await anchor.getAttribute('href');
           if (!link) {
             link = await card.getAttribute('href');
           }
           if (!link || seenLinks.has(link)) continue;
           
           seenLinks.add(link);
           
           const isRemote = title.toLowerCase().includes('remote') || title.toLowerCase().includes('remoto');
           
           jobs.push({
             title: title,
             link: link.startsWith('http') ? link : 'https://www.linkedin.com' + link,
             content: title.toLowerCase(),
             source: 'LinkedIn',
             location: isRemote ? 'remote' : 'colombia',
             score: 0,
             date: new Date().toISOString()
           });
         } catch (e) {
           // Skip bad cards
         }
       }
      
      console.log(`  Collected ${jobs.length} jobs`);
      
      if (jobs.length >= maxJobs) break;
      await page.waitForTimeout(randomDelay());
    }
  } catch (error) {
    console.error("❌ LinkedIn error:", (error as Error).message);
  } finally {
    if (browser) await browser.close();
  }
  
  console.log(`📊 Total LinkedIn jobs: ${jobs.length}`);
  return jobs.slice(0, maxJobs);
}
