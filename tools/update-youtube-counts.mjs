import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = resolve(siteRoot, "data", "channel-counts.json");
const force = process.argv.includes("--force");

const channels = {
  "@TakeNine": "https://www.youtube.com/@TakeNine",
  "@NineReacts": "https://www.youtube.com/@NineReacts",
  "@ninebloxs": "https://www.youtube.com/@ninebloxs",
  "@NineTakes": "https://www.youtube.com/@NineTakes",
  "@gordieGG": "https://www.youtube.com/@gordieGG",
  "@gordieyt": "https://www.youtube.com/@gordieyt",
  "@gordieTV": "https://www.youtube.com/@gordieTV",
  "@SuperiorRooster": "https://www.youtube.com/@SuperiorRooster",
  "@FrostyyVids": "https://www.youtube.com/@FrostyyVids/shorts",
  "@SuperiorBrawl": "https://www.youtube.com/@SuperiorBrawl"
};

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function decodeEntities(value) {
  return value
    .replace(/\\u0026/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractSubscriberText(html) {
  const decoded = decodeEntities(html);
  const patterns = [
    /"subscriberCountText"\s*:\s*\{\s*"simpleText"\s*:\s*"([^"]*subscribers?)"/i,
    /"subscriberCountText"\s*:\s*\{\s*"runs"\s*:\s*\[\s*\{\s*"text"\s*:\s*"([^"]*subscribers?)"/i
  ];

  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (match) return match[1].replace(/\s+/g, " ").trim();
  }

  return null;
}

function parseSubscriberText(value) {
  if (!value) return null;
  const match = value.replace(/,/g, "").match(/([\d.]+)\s*([KMB])?\s+subscribers?/i);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;

  const suffix = (match[2] || "").toUpperCase();
  if (suffix === "B") return amount * 1000000000;
  if (suffix === "M") return amount * 1000000;
  if (suffix === "K") return amount * 1000;
  return amount;
}

function looksLikeBadScrape(previousText, nextText) {
  const previous = parseSubscriberText(previousText);
  const next = parseSubscriberText(nextText);
  if (!previous || !next) return false;

  const changeRatio = Math.abs(next - previous) / previous;
  return changeRatio > 0.05;
}

async function fetchSubscriberText(url) {
  const response = await fetch(url, {
    headers: {
      "accept-language": "en-US,en;q=0.9",
      "user-agent": "Mozilla/5.0"
    }
  });

  if (!response.ok) {
    throw new Error(`YouTube returned ${response.status} for ${url}`);
  }

  const html = await response.text();
  const subscriberText = extractSubscriberText(html);
  if (!subscriberText) {
    throw new Error(`Could not find subscriber text for ${url}`);
  }

  return subscriberText;
}

async function main() {
  const existing = JSON.parse(await readFile(dataPath, "utf8"));
  const now = new Date();

  if (!force && existing.updatedAt && todayKey(new Date(existing.updatedAt)) === todayKey(now)) {
    console.log("Subscriber counts already updated today. Use --force to refresh anyway.");
    return;
  }

  const next = {
    updatedAt: now.toISOString(),
    channels: { ...existing.channels }
  };

  for (const [handle, url] of Object.entries(channels)) {
    try {
      const subscriberText = await fetchSubscriberText(url);
      const previousText = next.channels[handle] && next.channels[handle].subscriberText;
      if (looksLikeBadScrape(previousText, subscriberText)) {
        console.warn(`${handle}: keeping old count (${subscriberText} looked suspicious vs ${previousText})`);
        continue;
      }

      next.channels[handle] = {
        url,
        subscriberText,
        updatedAt: now.toISOString()
      };
      console.log(`${handle}: ${subscriberText}`);
    } catch (error) {
      next.channels[handle] = next.channels[handle] || { url, subscriberText: "", updatedAt: "" };
      console.warn(`${handle}: keeping old count (${error.message})`);
    }
  }

  await writeFile(dataPath, `${JSON.stringify(next, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
