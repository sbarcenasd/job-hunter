import cron from "node-cron";

import { loadConfig } from "./config/loader";
import { fetchAllRSS } from "./fetchers/rss";
import { fetchComputrabajo, enrichJobsWithDelay } from "./fetchers/scraper";
import { filterJobs } from "./filters/job";
import { saveJSON, saveMarkdown, printJobs } from "./utils/export";

const MAX_JOBS_PER_FEED = 40;
const MAX_RESULTS = 50;
const MAX_TO_ENRICH = 10;

async function main() {
  console.log("🔍 Buscando empleos...\n");

  const config = loadConfig();
  const { sources, keywords, exclude, scoring, workModes } = config;

  const rssJobs = await fetchAllRSS(sources, MAX_JOBS_PER_FEED);
  const computrabajoJobs = await fetchComputrabajo(keywords, 3);
  
  const allJobs = [...rssJobs, ...computrabajoJobs];
  
  const filtered = filterJobs(allJobs, keywords, exclude, scoring, workModes, MAX_RESULTS);

  console.log(`📌 Encontrados: ${filtered.length} jobs\n`);

  if (filtered.length > 0) {
    printJobs(filtered);
    
    // Enriquecer los mejores con contenido completo (solo LinkedIn/Indeed)
    const linkedinIndeedJobs = filtered.filter(
      (j) => j.source.includes("LinkedIn") || j.source.includes("Indeed")
    );
    
    if (linkedinIndeedJobs.length > 0) {
      console.log("\n📥 Enriquciendo contenido de LinkedIn/Indeed...\n");
      const enriched = await enrichJobsWithDelay(linkedinIndeedJobs, MAX_TO_ENRICH);
      
      // Re-filtrar con contenido enriquecido
      const finalFiltered = filterJobs(
        [...filtered.slice(MAX_TO_ENRICH), ...enriched],
        keywords,
        exclude,
        scoring,
        workModes,
        MAX_RESULTS
      );
      
      saveJSON(finalFiltered);
      saveMarkdown(finalFiltered);
      console.log("\n💾 Guardado en jobs.json y jobs.md");
      return;
    }
  }

  saveJSON(filtered);
  saveMarkdown(filtered);
  console.log("💾 Guardado en jobs.json y jobs.md");
}

if (require.main === module) {
  main();

  cron.schedule("0 7 * * *", () => {
    console.log("\n⏰ Ejecutando búsqueda automática...");
    main();
  });
}

export { main };