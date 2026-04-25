import cron from "node-cron";

import { loadConfig } from "./config/loader";
import { fetchAllRSS } from "./fetchers/rss";
import { fetchComputrabajo, enrichJobsWithDelay, fetchLinkedInJobs } from "./fetchers/scraper";
import { filterJobs } from "./filters/job";
import { saveJSON, saveMarkdown, printJobs } from "./utils/export";

const MAX_JOBS_PER_FEED = 3;
const MAX_RESULTS = 15;
const MAX_TO_ENRICH = 3;

async function main() {
  console.log("🔍 Buscando empleos...\n");

  const config = loadConfig();
  const { sources, keywords, exclude, scoring, workModes } = config;

  console.log("📡 Obteniendo de fuentes RSS...");
  const rssJobs = await fetchAllRSS(sources, MAX_JOBS_PER_FEED);
  console.log(`   Encontrados ${rssJobs.length} jobs de RSS\n`);
  
  console.log("🔗 Obteniendo de LinkedIn (scraping)...");
  const linkedInJobs = await fetchLinkedInJobs(keywords);
  console.log(`   Encontrados ${linkedInJobs.length} jobs de LinkedIn\n`);
  
  console.log("🌐 Obteniendo de Computrabajo...");
  const computrabajoJobs = await fetchComputrabajo(keywords, 3);
  console.log(`   Encontrados ${computrabajoJobs.length} jobs de Computrabajo\n`);
  
  const allJobs = [...rssJobs, ...linkedInJobs, ...computrabajoJobs];
  console.log(`📊 Total: ${allJobs.length} jobs sin filtrar\n`);
  
  const filtered = filterJobs(allJobs, keywords, exclude, scoring, workModes, MAX_RESULTS);
  console.log(`✅ Después de filtros: ${filtered.length} jobs\n`);

  if (filtered.length > 0) {
    printJobs(filtered);
    
    const linkedinIndeedJobs = filtered.filter(
      (j) => j.source.includes("LinkedIn") || j.source.includes("Indeed")
    );
    
    if (linkedinIndeedJobs.length > 0) {
      const enriched = await enrichJobsWithDelay(linkedinIndeedJobs, MAX_TO_ENRICH);
      
      const allWithEnriched = filtered.map((job) => {
        const enrichedVersion = enriched.find((e) => e.link === job.link);
        return enrichedVersion || job;
      });
      
      const finalFiltered = filterJobs(allWithEnriched, keywords, exclude, scoring, workModes, MAX_RESULTS);
      
      saveJSON(finalFiltered);
      saveMarkdown(finalFiltered);
      
      console.log(`\n💾 Guardado en jobs.json y jobs.md`);
      console.log(`📊 Filtrado final: ${finalFiltered.length} jobs`);
      return;
    }
  }

  saveJSON(filtered);
  // saveMarkdown(filtered);
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