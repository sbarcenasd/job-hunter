import { Job, WorkModes } from "../types";

export function detectWorkMode(text: string, workModes: WorkModes): string {
  if (workModes.remote.some((m) => text.includes(m))) return "remote";
  if (workModes.hybrid.some((m) => text.includes(m))) return "hybrid";
  if (workModes.presencial.some((m) => text.includes(m))) return "presencial";
  return "unknown";
}

export function extractSalary(text: string): string {
  const match = text.match(/(\$[\d,.]+|\d+\s*(k|mil|pesos))/i);
  return match ? match[0] : "";
}

export function scoreJob(job: Job, scoringRules: Record<string, number>): number {
  let s = 0;
  const text = `${job.title} ${job.content}`.toLowerCase();

  for (const [keyword, points] of Object.entries(scoringRules)) {
    if (text.includes(keyword)) {
      s += points;
    }
  }

  if (job.location === "colombia") s += 3;
  if (job.location === "remote") s += 2;

  if (job.workMode === "remote") s += 3;
  else if (job.workMode === "hybrid") s += 2;
  else if (job.workMode === "presencial") s += 1;

  return s;
}

export function filterJobs(
  jobs: Job[],
  keywords: string[],
  exclude: string[],
  scoringRules: Record<string, number>,
  workModes: WorkModes,
  maxResults: number = 50
): Job[] {
  const seen = new Set<string>();
  const filtered: Job[] = [];

  for (const job of jobs) {
    if (seen.has(job.link)) continue;
    seen.add(job.link);

const text = `${job.title} ${job.content} ${job.link}`.toLowerCase();

    job.salary = extractSalary(text);
    job.workMode = detectWorkMode(text, workModes);

    const matchKeyword = keywords.some((k) => {
      const keyword = k.replace(/\//g, "");
      return text.includes(keyword);
    });

    const isExcluded = exclude.some((e) => {
      const ex = e.replace(/\//g, "").toLowerCase();
      return text.includes(ex);
    });

    if (matchKeyword && !isExcluded) {
      job.score = scoreJob(job, scoringRules);
      if (job.score >= 0) {
        // Hybrid solo es válido si es de Colombia
        if (job.workMode === "hybrid" && job.location !== "colombia") {
          continue;
        }
        filtered.push(job);
      }
    }
  }

  return filtered.sort((a, b) => b.score - a.score).slice(0, maxResults);
}