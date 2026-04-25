import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { FeedSource, WorkModes } from "../types";

const CONFIG_DIR = path.join(__dirname, "..", "..", "config");

export function loadYaml(filename: string): any {
  const filePath = path.join(CONFIG_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, "utf-8");
  return yaml.load(content);
}

export function loadSources(): FeedSource[] {
  const config = loadYaml("sources.yaml");
  return config?.sources?.filter((s: FeedSource) => s.enabled) || [];
}

export function loadKeywords(): string[] {
  const config = loadYaml("keywords.yaml");
  return config?.keywords || [];
}

export function loadExclude(): string[] {
  const config = loadYaml("exclude.yaml");
  return config?.exclude || [];
}

export function loadScoring(): Record<string, number> {
  const config = loadYaml("scoring.yaml");
  return config?.scoring || {};
}

export function loadWorkModes(): WorkModes {
  const config = loadYaml("workmodes.yaml");
  return config?.workModes || { remote: [], hybrid: [], presencial: [] };
}

export function loadConfig() {
  return {
    sources: loadSources(),
    keywords: loadKeywords(),
    exclude: loadExclude(),
    scoring: loadScoring(),
    workModes: loadWorkModes(),
  };
}