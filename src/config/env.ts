import dotenv from "dotenv";
import path from "path";
import fs from "fs";

const envPath = path.join(__dirname, "..", "..", ".env");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

export function getEnv(key: string, defaultValue: string = ""): string {
  return process.env[key] || defaultValue;
}

export function getLinkedInEmail(): string {
  return getEnv("LINKEDIN_EMAIL");
}

export function getLinkedInPassword(): string {
  return getEnv("LINKEDIN_PASSWORD");
}

export function getProxyUrl(): string {
  return getEnv("PROXY_URL");
}