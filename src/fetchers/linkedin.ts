import { Job } from "../types";
import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

const SESSION_FILE = path.join(process.cwd(), "linkedin-session.json");

function randomDelay() {
  return Math.floor(Math.random() * 3000) + 2000;
}

export async function fetchLinkedInPlaywright(keywords: string[], maxKeywords: number = 3, maxJobs: number = 10, email?: string, password?: string, excludeTerms: string[] = []): Promise<Job[]> {
  const jobs: Job[] = [];
  const seenLinks = new Set<string>();
  let browser = null;
  
  try {
    browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
    
    let context;
    
    // Intentar cargar sesión guardada
    if (fs.existsSync(SESSION_FILE)) {
      console.log("🔐 Using saved LinkedIn session...");
      try {
        context = await browser.newContext({
          storageState: SESSION_FILE,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          locale: 'es-CO', viewport: { width: 1920, height: 1080 }
        });
        
        // Verificar que la sesión siga activa
        const testPage = await context.newPage();
        await testPage.goto('https://www.linkedin.com/feed', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await testPage.waitForTimeout(3000);
        
        if (testPage.url().includes('/login') || testPage.url().includes('checkpoint')) {
          console.log("⚠️ Saved session expired, need to login again");
          await testPage.close();
          await context.close();
          throw new Error("Session expired");
        }
        
        console.log("✅ Session loaded successfully");
        await testPage.close();
      } catch (e) {
        console.log("⚠️ Failed to load session, logging in...");
        if (context) await context.close();
        context = null;
      }
    }
    
    // Si no hay sesión válida, hacer login
    if (!context) {
      if (!email || !password) {
        console.log("⚠️ No LinkedIn credentials - skipping");
        if (browser) await browser.close();
        return jobs;
      }
      
      console.log(`🔐 Logging in to LinkedIn as ${email}...`);
      
      context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        locale: 'es-CO', viewport: { width: 1920, height: 1080 }
      });
      
      const page = await context.newPage();
      
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
      
      // Guardar sesión para futuras ejecuciones
      await context.storageState({ path: SESSION_FILE });
      console.log("💾 Session saved to linkedin-session.json");
    }
    
    const page = await context.newPage();
    
    // Search for each keyword
    for (const keyword of keywords.slice(0, maxKeywords)) {
      if (jobs.length >= maxJobs) break;
      
      console.log(`🔍 Searching: ${keyword}`);
      await page.goto(`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keyword)}&location=Colombia`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(3000);
      
      // Scroll para cargar más ofertas (lazy loading)
      for (let i = 0; i < 3; i++) {
        await page.evaluate("window.scrollBy(0, 800)");
        await page.waitForTimeout(1000);
      }
      await page.waitForTimeout(2000);
      
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
              
              // FILTRO RÁPIDO POR TÍTULO - ANTES de agregar a la lista
              const titleLower = title.toLowerCase();
              const isExcluded = excludeTerms.some(term => titleLower.includes(term.replace(/\//g, '')));
              if (isExcluded) {
                console.log(`     ⏭️  Skipping (title match): ${title.slice(0, 50)}`);
                continue;
              }
              
              // Find the anchor link inside the card
              const anchor = card.locator('a').first();
              let link = await anchor.getAttribute('href');
              if (!link) {
                link = await card.getAttribute('href');
              }
              if (!link || seenLinks.has(link)) continue;
              
              seenLinks.add(link);
              
              // Extract snippet from card (job description preview)
              let snippet = '';
              try {
                snippet = await card.locator('.job-card-list__description, .job-search-card__snippet, [data-artifact-id="job-description"]').first().textContent({ timeout: 2000 }) || '';
              } catch {
                // Snippet not available
              }
              
              const isRemote = title.toLowerCase().includes('remote') || title.toLowerCase().includes('remoto');
              
              jobs.push({
                title: title,
                link: link.startsWith('http') ? link : 'https://www.linkedin.com' + link,
                content: `${title} ${snippet}`.toLowerCase(),
                source: 'LinkedIn',
                location: isRemote ? 'remote' : 'colombia',
                score: 0,
                date: new Date().toISOString()
              });
          } catch (e) {
            // Skip bad cards
          }
        }
      
      console.log(`  Collected ${jobs.length} jobs (after title filter)`);
      
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
