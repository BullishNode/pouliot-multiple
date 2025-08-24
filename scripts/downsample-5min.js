#!/usr/bin/env node
/*
  Downsample time,price CSV from 1-minute to 5-minute buckets.
  Usage:
    node scripts/downsample-5min.js [inputCSV] [outputCSV]
  Defaults:
    inputCSV = data/bootstrap.csv
    outputCSV = data/bootstrap_5min.csv
*/
const fs = require('fs');
const path = require('path');
const readline = require('readline');

function parseTimeToDate(timeStr) {
  const numeric = /^\d+\.?\d*$/.test(timeStr.trim());
  if (numeric) {
    const unix = parseFloat(timeStr);
    const ms = unix > 1000000000000 ? unix : unix * 1000; // ms if 13 digits
    return new Date(ms);
  }
  const d = new Date(timeStr);
  if (isNaN(d.getTime())) throw new Error(`Invalid time: ${timeStr}`);
  return d;
}

function floorTo5MinUTC(date) {
  const d = new Date(date);
  d.setUTCSeconds(0, 0);
  const m = d.getUTCMinutes();
  const floored = Math.floor(m / 5) * 5;
  d.setUTCMinutes(floored);
  return d;
}

async function downsample(inputPath, outputPath) {
  if (!fs.existsSync(inputPath)) {
    console.error(`Input not found: ${inputPath}`);
    process.exit(1);
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(inputPath),
    crlfDelay: Infinity
  });

  const bucketMap = new Map(); // iso -> { sum, count }
  let lines = 0;
  let skipped = 0;
  let headerSkipped = false;

  for await (const line of rl) {
    lines++;
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!headerSkipped && /time\s*,\s*price/i.test(trimmed)) {
      headerSkipped = true;
      continue;
    }
    const [t, p] = trimmed.split(',');
    if (!t || !p) { skipped++; continue; }
    let date;
    try { date = parseTimeToDate(t); } catch { skipped++; continue; }
    const price = parseFloat(p);
    if (!isFinite(price) || price <= 0) { skipped++; continue; }
    const bucket = floorTo5MinUTC(date).toISOString();
    const agg = bucketMap.get(bucket) || { sum: 0, count: 0 };
    agg.sum += price;
    agg.count += 1;
    bucketMap.set(bucket, agg);
  }

  const rows = Array.from(bucketMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([iso, agg]) => `${iso},${(agg.sum / agg.count).toFixed(2)}`);

  const outDir = path.dirname(outputPath);
  fs.mkdirSync(outDir, { recursive: true });
  const content = ['time,price', ...rows].join('\n') + '\n';
  fs.writeFileSync(outputPath, content);

  console.log(`Downsample complete.`);
  console.log(`Input lines: ${lines} (skipped ${skipped})`);
  console.log(`Buckets written: ${rows.length}`);
  console.log(`Output: ${outputPath}`);
}

(async () => {
  const input = process.argv[2] || path.join('data', 'bootstrap.csv');
  const output = process.argv[3] || path.join('data', 'bootstrap_5min.csv');
  await downsample(input, output).catch(err => {
    console.error(err);
    process.exit(1);
  });
})();




