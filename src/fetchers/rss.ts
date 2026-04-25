import Parser from "rss-parser";
import { FeedSource, Job } from "../types";

const parser = new Parser();

export async function fetchRSSFeed(feed: FeedSource, maxItems: number = 40): Promise<Job[]> {
  try {
    const parsed = await parser.parseURL(feed.url);
    return parsed.items.slice(0, maxItems).map((item) => ({
      title: item.title?.replace(/<[^>]*>/g, "").trim() || "",
      link: item.link || "",
      content:
        item.contentSnippet?.toLowerCase() ||
        item.content?.toLowerCase() ||
        "",
      source: feed.name,
      location: feed.location || "any",
      score: 0,
      date: item.pubDate || new Date().toISOString(),
    }));
  } catch (error) {
    console.error(`Error fetching ${feed.name}:`, (error as Error).message);
    return [];
  }
}

export async function fetchAllRSS(sources: FeedSource[], maxItemsPerFeed: number = 40): Promise<Job[]> {
  const allJobs: Job[] = [];
  
  for (const feed of sources) {
    if (feed.type === "rss") {
      const jobs = await fetchRSSFeed(feed, maxItemsPerFeed);
      allJobs.push(...jobs);
    }
  }
  
  return allJobs;
}