#!/usr/bin/env node
// Precompute hourly (30d horizon) and daily (365d horizon) history with SMA, R (price/SMA), and percentile.
// Input: data/bootstrap_10min.csv (time,price)
// Output:
//  - data/history_365d.csv: date,price,sma,multiple,percentile
//  - data/history_30d_hourly.csv: datetime,price,sma,multiple,percentile

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

function floorTo10MinUTC(date) {
  const d = new Date(date);
  d.setUTCSeconds(0, 0);
  const m = d.getUTCMinutes();
  d.setUTCMinutes(Math.floor(m / 10) * 10);
  return d;
}

function simpleMovingAverage(arr, period) {
  if (arr.length < period) return NaN;
  let sum = 0;
  for (let i = arr.length - period; i < arr.length; i++) sum += arr[i];
  return sum / period;
}

function winsorize(data, lower = 1, upper = 99) {
  if (data.length === 0) return [];
  const sorted = [...data].sort((a, b) => a - b);
  const li = Math.floor((lower / 100) * data.length);
  const ui = Math.ceil((upper / 100) * data.length) - 1;
  const lo = sorted[li];
  const hi = sorted[ui];
  return data.map(v => (v < lo ? lo : v > hi ? hi : v));
}

function percentileOf(value, arr) {
  if (!arr.length) return NaN;
  const sorted = [...arr].sort((a, b) => a - b);
  let count = 0;
  for (let i = 0; i < sorted.length; i++) if (sorted[i] <= value) count++;
  return count / sorted.length;
}

async function readBootstrap(inputPath) {
  const rl = readline.createInterface({ input: fs.createReadStream(inputPath), crlfDelay: Infinity });
  const items = [];
  let headerSkipped = false;
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!headerSkipped && /time\s*,\s*price/i.test(trimmed)) { headerSkipped = true; continue; }
    const [t, p] = trimmed.split(',');
    if (!t || !p) continue;
    let d; try { d = parseTimeToDate(t); } catch { continue; }
    const price = parseFloat(p);
    if (!isFinite(price) || price <= 0) continue;
    items.push({ time: d.toISOString(), price });
  }
  return items;
}

function aggregate(items) {
  // aggregate to hourly and daily means
  const hourlyMap = new Map(); // ISO hour -> [prices]
  const dailyMap = new Map(); // YYYY-MM-DD -> [prices]
  for (const it of items) {
    const d = new Date(it.time);
    const hourKey = d.toISOString().slice(0, 13) + ':00:00Z';
    const dayKey = d.toISOString().split('T')[0];
    if (!hourlyMap.has(hourKey)) hourlyMap.set(hourKey, []);
    hourlyMap.get(hourKey).push(it.price);
    if (!dailyMap.has(dayKey)) dailyMap.set(dayKey, []);
    dailyMap.get(dayKey).push(it.price);
  }
  const hourly = Array.from(hourlyMap.entries()).map(([datetime, prices]) => ({ datetime, price: prices.reduce((a,b)=>a+b,0)/prices.length })).sort((a,b)=>a.datetime.localeCompare(b.datetime));
  const daily = Array.from(dailyMap.entries()).map(([date, prices]) => ({ date, price: prices.reduce((a,b)=>a+b,0)/prices.length })).sort((a,b)=>a.date.localeCompare(b.date));
  return { hourly, daily };
}

function computeSeries(series, period, keyTime) {
  const out = [];
  const prices = series.map(s => s.price);
  const periodForSigma = period; // use same length as SMA window
  for (let i = 0; i < series.length; i++) {
    const t = keyTime(series[i]);
    const price = series[i].price;
    if (i >= period) {
      const prior = prices.slice(i - period, i);
      const sma = simpleMovingAverage(prior, period);
      const multiple = !isNaN(sma) && sma > 0 ? price / sma : null;
      out.push({ t, price, sma: isNaN(sma) ? null : sma, multiple });
    } else {
      out.push({ t, price, sma: null, multiple: null });
    }
  }
  // Compute log(R) and rolling sigma of log(R) (using prior window)
  const logR = out.map(o => (typeof o.multiple === 'number' && o.multiple > 0 ? Math.log(o.multiple) : null));
  const rollSigma = out.map((_, i) => {
    if (i < periodForSigma) return null;
    const window = logR.slice(i - periodForSigma, i).filter(v => v != null);
    if (window.length < Math.max(10, Math.floor(periodForSigma * 0.5))) return null;
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    const variance = window.reduce((a, b) => a + (b - mean) * (b - mean), 0) / window.length;
    const sigma = Math.sqrt(Math.max(variance, 0));
    return sigma > 0 ? sigma : null;
  });

  // percentiles (winsorized) using data since 2015-01-01
  const CUTOFF = '2015-01-01T00:00:00Z';
  const base = out
    .filter(o => typeof o.multiple === 'number' && o.t >= CUTOFF)
    .map(o => o.multiple);
  const w = winsorize(base);
  let wi = 0;
  for (const o of out) {
    if (typeof o.multiple === 'number' && w.length > 0) {
      o.percentile = percentileOf(o.multiple, w) * 100;
      wi++;
    } else {
      o.percentile = null;
    }
  }

  // vol-adjusted percentile using z = log(R) / rolling_sigma(logR)
  const baseZ = out
    .map((o, i) => {
      if (o.t < CUTOFF) return null;
      const lr = logR[i];
      const sig = rollSigma[i];
      if (lr == null || sig == null) return null;
      return lr / sig;
    })
    .filter(v => v != null);
  const wZ = winsorize(baseZ);
  out.forEach((o, i) => {
    const lr = logR[i];
    const sig = rollSigma[i];
    if (lr != null && sig != null && wZ.length > 0) {
      const z = lr / sig;
      o.volAdjPercentile = percentileOf(z, wZ) * 100;
    } else {
      o.volAdjPercentile = null;
    }
  });
  return out;
}

async function main() {
  const input = process.argv[2] || path.join('data', 'bootstrap_10min.csv');
  const outDaily = process.argv[3] || path.join('data', 'history_365d.csv');
  const outHourly = process.argv[4] || path.join('data', 'history_30d_hourly.csv');
  if (!fs.existsSync(input)) {
    console.error('Input not found:', input);
    process.exit(1);
  }
  console.log('Reading', input);
  const items = await readBootstrap(input);
  console.log('Read rows:', items.length);
  const { hourly, daily } = aggregate(items);
  console.log('Hourly points:', hourly.length, 'Daily points:', daily.length);
  const s365 = computeSeries(daily, 365, d => `${d.date}T00:00:00Z`);
  const s30 = computeSeries(hourly, 30*24, d => d.datetime);
  const dailyCsv = ['date,price,sma,multiple,percentile,volAdjPercentile', ...s365.map(o => `${o.t.split('T')[0]},${o.price.toFixed(2)},${o.sma??''},${o.multiple??''},${o.percentile??''},${o.volAdjPercentile??''}`)].join('\n') + '\n';
  const hourlyCsv = ['datetime,price,sma,multiple,percentile,volAdjPercentile', ...s30.map(o => `${o.t},${o.price.toFixed(2)},${o.sma??''},${o.multiple??''},${o.percentile??''},${o.volAdjPercentile??''}`)].join('\n') + '\n';
  fs.writeFileSync(outDaily, dailyCsv);
  fs.writeFileSync(outHourly, hourlyCsv);
  console.log('Wrote', outDaily, 'and', outHourly);
}

main().catch(e => { console.error(e); process.exit(1); });


