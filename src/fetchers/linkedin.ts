import { chromium, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { Job } from '../types';

const SESSION_FILE = path.join(process.cwd(), 'linkedin-session.json');

interface ScrollOptions {
  maxScrolls?: number;
  step?: number;
  delayMs?: number;
}

/**
 * Human-like infinite scroll for LinkedIn
 * Returns number of job cards found
 */
async function humanLikeScroll(
  page: Page, 
  options: ScrollOptions = {}
): Promise<number> {
  const { maxScrolls = 25, step = 500, delayMs = 200 } = options;  
  let previousCardCount = 0;
  let unchangedCount = 0;
  let totalCards = 0;
  
  for (let i = 0; i < maxScrolls; i++) {
    // Get current cards and scroll to the last one to trigger lazy loading
    let cards = await page.locator('.job-card-container, .jobs-search-results__list-item').all();
    
    if (cards.length > 0) {
      // Scroll to multiple cards deep to trigger more loading
      const scrollToIndex = Math.min(cards.length - 1, cards.length - 1 + 5);
      for (let j = cards.length - 1; j <= scrollToIndex && j < cards.length; j++) {
        await cards[j].scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
      }
      await page.waitForTimeout(1000);
    }
    
    // Also do a page scroll
    await page.evaluate('window.scrollBy(0, 1000)');
    await page.waitForTimeout(500);
    
    // Random human-like delay
    const randomDelay = delayMs + Math.random() * 300;
    await page.waitForTimeout(randomDelay);
    
    // Check how many cards loaded
    const cardCount = await page.locator('.job-card-container, .jobs-search-results__list-item').count();
    
    console.log(`  Scroll ${i+1}: ${cardCount} cards`);
    totalCards = Math.max(totalCards, cardCount);
    
    // Try clicking "Show more" if no new content
    if (cardCount === previousCardCount && cardCount > 0) {
      unchangedCount++;
      
      if (unchangedCount >= 2) {
        // Try to find and click "Show more" button
        const loadMoreSelectors = [
          'button:has-text("Show more")',
          'button:has-text("See more jobs")',
          'button:has-text("Load more")',
          '.infinite-scroller__show-more-button',
          '[aria-label*="more"]'
        ];
        
        let clicked = false;
        for (const selector of loadMoreSelectors) {
          try {
            const button = page.locator(selector).first();
            if (await button.isVisible({ timeout: 1000 })) {
              console.log(`  Clicking "${selector}"...`);
              await button.click();
              await page.waitForTimeout(2000);
              clicked = true;
              unchangedCount = 0;
              break;
            }
          } catch (e) {
            // Button not found
          }
        }
        
        if (!clicked) {
          console.log('  No more content loading, stopping scroll');
          break;
        }
      }
    } else {
      unchangedCount = 0;
    }
    
    previousCardCount = cardCount;
  }
  
  return totalCards;
}

/**
 * Fetch LinkedIn jobs with human-like scrolling
 */
export async function fetchLinkedInPlaywright(
  keywords: string[],
  maxKeywords: number = 10,
  maxJobs: number = 30,
  email?: string,
  password?: string,
  excludeTerms: string[] = []
): Promise<Job[]> {
  const jobs: Job[] = [];
  const seenLinks = new Set<string>();
  let browser: any = null;
  
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled']
    });
    
    let context: any;
    
    // Try to load saved session
    if (fs.existsSync(SESSION_FILE)) {
      console.log("🔐 Using saved LinkedIn session...");
      try {
        context = await browser.newContext({
          storageState: SESSION_FILE,
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          locale: 'es-CO',
          viewport: { width: 1920, height: 1080 }
        });
        
        // Verify session is still valid
        const testPage = await context.newPage();
        await testPage.goto('https://www.linkedin.com/feed', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await testPage.waitForTimeout(3000);
        
        if (testPage.url().includes('/login') || testPage.url().includes('challenge')) {
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
    
    // If no valid session, do login
    if (!context) {
      if (!email || !password) {
        console.log("⚠️ No LinkedIn credentials - skipping");
        if (browser) await browser.close();
        return jobs;
      }
      
      console.log(`🔐 Logging in to LinkedIn as ${email}...`);
      
      context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        locale: 'es-CO',
        viewport: { width: 1920, height: 1080 }
      });
      
      const loginPage = await context.newPage();
      
      await loginPage.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await loginPage.waitForSelector('#username', { timeout: 15000 });
      await loginPage.fill('#username', email);
      await loginPage.waitForTimeout(500);
      await loginPage.fill('#password', password);
      await loginPage.click('[type="submit"]');
      await loginPage.waitForTimeout(10000);
      
      const currentUrl = loginPage.url();
      if (currentUrl.includes('/login') || currentUrl.includes('challenge')) {
        console.log("❌ Login failed - need verification");
        if (browser) await browser.close();
        return jobs;
      }
      
      console.log("✅ Logged in");
      
      // Save session for future use
      await context.storageState({ path: SESSION_FILE });
      console.log("💾 Session saved to linkedin-session.json");
    }
    
    const page = await context.newPage();
    
    // Search for each keyword
    for (const keyword of keywords.slice(0, maxKeywords)) {
      if (jobs.length >= maxJobs) break;
      
      console.log(`🔍 Searching: ${keyword}`);
      await page.goto(`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keyword)}&location=Colombia&sortBy=DD`, {
        waitUntil: 'domcontentloaded',
        timeout: 45000
      });
      await page.waitForTimeout(3000);
      
      // Human-like scroll to load more cards
      console.log('  Starting human-like scroll...');
      const cardCount = await humanLikeScroll(page, { maxScrolls: 25, step: 300, delayMs: 150 });
      console.log(`  Total cards after scroll: ${cardCount}`);
      
      // Get all job cards
      const jobCards = await page.locator('.job-card-container, .jobs-search-results__list-item').all();
      console.log(`  Found ${jobCards.length} job cards`);
      
      for (const card of jobCards) {
        if (jobs.length >= maxJobs) break;
        
        try {
          // Extract job title from card
          let title = '';
          try {
            title = await card.locator('.job-card-list__title, .base-search-card__title, h3, [data-artifact-id="job-title"]').first().innerText({ timeout: 3000 }) || '';
          } catch {
            title = await card.locator('a').first().innerText({ timeout: 3000 }) || '';
          }
          // Clean whitespace and take only first line
          title = title.split('\n')[0].replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
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
      await page.waitForTimeout(2000 + Math.random() * 2000); // Random delay between keywords
    }
  } catch (error) {
    console.error("❌ LinkedIn error:", (error as Error).message);
  } finally {
    if (browser) await browser.close();
  }
  
  console.log(`📊 Total LinkedIn jobs: ${jobs.length}`);
  return jobs.slice(0, maxJobs);
}
