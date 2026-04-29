import cron from "node-cron";
import { Job } from "./types";
import { loadConfig } from "./config/loader";
import { getEnv } from "./config/env";
import { runRSS, runComputrabajo, runIndeed } from "./runners";
import { runLinkedIn } from "./runners/linkedin";
import { filterJobs } from "./filters/job";
import { saveJSON, saveMarkdown, printJobs } from "./utils/export";

const MAX_JOBS_PER_FEED = parseInt(getEnv("MAX_JOBS_PER_FEED", "50"));
const MAX_RESULTS = parseInt(getEnv("MAX_RESULTS", "50"));
const MAX_JOBS_FROM_SCRAPER = parseInt(getEnv("MAX_JOBS_FROM_SCRAPER", "50"));

async function main() {
  console.log("🔍 Buscando empleos...\n");

  const config = loadConfig();
  const { sources, keywords, exclude, scoring, workModes } = config;

  const allJobs: Job[] = [];

  for (const source of sources) {
    if (!source.enabled) continue;

    if (source.type === "rss") {
      const { jobs } = await runRSS(source, keywords, exclude, scoring, workModes, MAX_JOBS_PER_FEED, MAX_RESULTS);
      allJobs.push(...jobs);
    } else if (source.type === "scraper") {
      if (source.name.toLowerCase().includes("computrabajo")) {
        const jobs = await runComputrabajo(source, keywords, exclude, scoring, workModes, MAX_JOBS_FROM_SCRAPER, MAX_RESULTS);
        allJobs.push(...jobs);
      } else if (source.name.toLowerCase().includes("indeed")) {
        const jobs = await runIndeed(source, keywords, exclude, scoring, workModes, MAX_JOBS_FROM_SCRAPER, MAX_RESULTS);
        allJobs.push(...jobs);
      } else if (source.name.toLowerCase().includes("linkedin")) {
        const jobs = await runLinkedIn(source, keywords, exclude, scoring, workModes, MAX_JOBS_FROM_SCRAPER, MAX_RESULTS);
        allJobs.push(...jobs);
      }
    }
  }

  console.log(`📊 Total: ${allJobs.length} jobs sin filtrar\n`);

  const finalFiltered = filterJobs(allJobs, keywords, exclude, scoring, workModes, MAX_RESULTS);
  console.log(`✅ Filtrado final: ${finalFiltered.length} jobs\n`);

  if (finalFiltered.length > 0) {
    printJobs(finalFiltered);
    saveJSON(finalFiltered);
    saveMarkdown(finalFiltered);
    console.log(`💾 Guardado en jobs.json y jobs.md`);
  }
}

if (require.main === module) {
  main();

  cron.schedule("0 7 * * *", () => {
    console.log("\n⏰ Ejecutando búsqueda automática...");
    main();
  });
}

export { main };