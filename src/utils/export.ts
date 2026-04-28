import fs from "fs";
import { Job } from "../types";

export function saveJSON(jobs: Job[], filename: string = "jobs.json"): void {
  // Save only the provided jobs (consistent with markdown export)
  fs.writeFileSync(filename, JSON.stringify(jobs, null, 2));
}

export function saveMarkdown(jobs: Job[], filename: string = "jobs.md"): void {
  const modeIcon = (mode: string) => {
    if (mode === "remote") return "🏠";
    if (mode === "hybrid") return "🏢";
    if (mode === "presencial") return "🏬";
    return "❓";
  };

  const content = jobs
    .map((j, i) => {
      return `${i + 1}. [${j.score}] **${j.title}**
   - 📍 ${j.source} | ${modeIcon(j.workMode || "?")} ${j.workMode || "?"}
   - 💰 ${j.salary || "No especificado"}
   - 🔗 [Link](${j.link})
`;
    })
    .join("\n");

  fs.writeFileSync(filename, `# Empleos Encontrados (${jobs.length})\n\n${content}`);
}

export function printJobs(jobs: Job[]): void {
  const modeIcon = (mode: string) => {
    if (mode === "remote") return "🏠";
    if (mode === "hybrid") return "🏢";
    if (mode === "presencial") return "🏬";
    return "❓";
  };

  jobs.slice(0, 10).forEach((job, i) => {
    console.log(`${i + 1}. [${job.score}] ${job.title}`);
    console.log(`   📍 ${job.source} | ${modeIcon(job.workMode || "?")} ${job.workMode || "?"}`);
    console.log(`   💰 ${job.salary || "No especificado"}`);
    console.log(`   🔗 ${job.link}`);
    console.log("");
  });
}