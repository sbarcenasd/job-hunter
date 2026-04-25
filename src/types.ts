export interface Job {
  title: string;
  link: string;
  content: string;
  source: string;
  location: string;
  score: number;
  date: string;
  salary?: string;
  workMode?: string;
}

export interface FeedSource {
  name: string;
  url: string;
  type: "rss" | "scraper";
  location: "colombia" | "remote" | "any";
  enabled: boolean;
  keywords?: string[];
  searchUrl?: string;
}

export interface WorkModes {
  remote: string[];
  hybrid: string[];
  presencial: string[];
  allowedLocations?: string[];
}

export interface ConfigFiles {
  sources: FeedSource[];
  keywords: string[];
  exclude: string[];
  scoring: Record<string, number>;
  workModes: WorkModes;
}