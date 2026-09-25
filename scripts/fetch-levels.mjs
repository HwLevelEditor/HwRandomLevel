#!/usr/bin/env node
/**
 * Fetches live Happy Wheels levels from totaljerkface.com and writes
 * data/levels.json (id + publish date + play count + name) for GitHub Pages.
 *
 * Run locally: node scripts/fetch-levels.mjs
 * Or via .github/workflows/update-levels.yml
 */

import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "data", "levels.json");
const API = "https://totaljerkface.com/get_level.hw";

const QUERIES = [
  { sortby: "newest", uploaded: "anytime", pages: 12 },
  { sortby: "newest", uploaded: "month", pages: 4 },
  { sortby: "newest", uploaded: "week", pages: 2 },
  { sortby: "plays", uploaded: "anytime", pages: 10 },
  { sortby: "rating", uploaded: "anytime", pages: 8 },
  { sortby: "plays", uploaded: "month", pages: 3 },
  { sortby: "rating", uploaded: "month", pages: 3 },
];

const SEARCHES = [
  "the", "level", "easy", "hard", "parkour", "challenge",
  "impossible", "fun", "death", "race", "jump", "swing",
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function post(body) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${JSON.stringify(body)}`);
  }
  return res.text();
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return m ? m[1] : "";
}

/** @returns {{id:number, dp:string, ps:number, ln:string}[]} */
function parseLevels(xml) {
  const out = [];
  const re = /<lv\b([^>]*)>/g;
  let m;
  while ((m = re.exec(xml))) {
    const tag = m[1];
    const id = Number(attr(tag, "id"));
    if (!Number.isInteger(id) || id <= 0) continue;
    const ps = Number(attr(tag, "ps")) || 0;
    const dp = attr(tag, "dp") || "";
    const ln = attr(tag, "ln") || "";
    out.push({ id, dp, ps, ln });
  }
  return out;
}

function mergeLevel(map, level) {
  const prev = map.get(level.id);
  if (!prev) {
    map.set(level.id, level);
    return;
  }
  // Prefer newer metadata if play count is higher / date present
  map.set(level.id, {
    id: level.id,
    dp: level.dp || prev.dp,
    ps: Math.max(prev.ps, level.ps),
    ln: level.ln || prev.ln,
  });
}

async function collectGetAll(map, { sortby, uploaded, pages }) {
  for (let page = 1; page <= pages; page++) {
    const xml = await post({
      action: "get_all",
      sortby,
      uploaded,
      page: String(page),
    });
    const batch = parseLevels(xml);
    console.log(`get_all ${sortby}/${uploaded} p${page}: ${batch.length}`);
    if (!batch.length) break;
    for (const level of batch) mergeLevel(map, level);
    await sleep(250);
  }
}

async function collectSearch(map, term) {
  const xml = await post({
    action: "search_by_name",
    sterm: term,
    sortby: "plays",
    uploaded: "anytime",
    page: "1",
  });
  const batch = parseLevels(xml);
  console.log(`search "${term}": ${batch.length}`);
  for (const level of batch) mergeLevel(map, level);
  await sleep(250);
}

async function main() {
  const map = new Map();

  try {
    const prev = JSON.parse(await readFile(OUT, "utf8"));
    const prevCount = Array.isArray(prev.levels)
      ? prev.levels.length
      : Array.isArray(prev.ids)
        ? prev.ids.length
        : 0;
    console.log(`previous pool: ${prevCount}`);
  } catch {
    /* first run */
  }

  for (const q of QUERIES) {
    await collectGetAll(map, q);
  }

  for (const term of SEARCHES) {
    await collectSearch(map, term);
  }

  const levels = [...map.values()].sort((a, b) => a.id - b.id);
  const payload = {
    updatedAt: new Date().toISOString(),
    count: levels.length,
    maxId: levels.length ? levels[levels.length - 1].id : 0,
    minId: levels.length ? levels[0].id : 0,
    levels,
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload) + "\n", "utf8");
  console.log(`wrote ${OUT} (${payload.count} levels, max ${payload.maxId})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
