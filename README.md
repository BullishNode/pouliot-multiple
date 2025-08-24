# Bitcoin Price Gauge – Logic and Methodology

This app answers: Is Bitcoin currently dipping or pumping relative to its trend? It does so by comparing price to trailing moving averages, and by ranking today’s deviation against history.

## Horizons and Data Aggregation

- 30 days (short‑term): computed on hourly averages
- 365 days (long‑term): computed on daily averages

Historical raw ticks are downsampled to 10‑minute buckets for repository size, then aggregated to hourly/daily series for analysis and charts.

### Data files in `data/`

- `bootstrap_10min.csv` – 10‑minute ticks used as the raw source to build hourly/daily series
- `history_30d_hourly.csv` – precomputed hourly series with derived metrics
- `history_365d.csv` – precomputed daily series with derived metrics

Columns in precomputed history files:

```
time,price,sma,multiple,percentile,volAdjPercentile
```

- `time`: ISO UTC timestamp for the sample (start of hour/day)
- `price`: aggregated average price at `time`
- `sma`: trailing Simple Moving Average (window matches the horizon; current period excluded)
- `multiple`: Price Multiple R = price ÷ sma
- `percentile`: percentile rank of current R within the winsorized historical R distribution (baseline since 2015‑01‑01)
- `volAdjPercentile`: percentile rank of z = log(R) ÷ rolling σ(log R) (σ window = SMA window), baseline since 2015, winsorized

## Core Algorithms

1) Simple Moving Average (SMA)
- Window lengths: 30 days (hourly samples → 30×24), 365 days (daily samples → 365)
- Excludes the current sample when computing the trailing average

2) Price Multiple (R)
- R = price ÷ SMA
- Interprets the magnitude of deviation from trend (e.g., R = 1.10 ≈ 10% above trend)

3) Winsorization
- To reduce outlier impact, historical distributions are winsorized at the 1st and 99th percentiles before ranking

4) Percentile (Raw)
- Baseline population: historical R values since 2015‑01‑01 for the selected horizon
- Output: percentile of the current R within that winsorized distribution

5) Volatility‑adjusted Percentile
- Compute log(R) for each historical point
- Compute rolling σ(log R) over the same window as the SMA (30d or 365d)
- z‑score: z = log(R) ÷ rolling σ(log R)
- Rank today’s z within the winsorized z distribution since 2015
- Interpretation: makes different volatility regimes comparable

## Labels

Labels are assigned from percentile bands of the selected analysis type (Raw or Vol‑adjusted):

- 0–10%: Extreme dip
- 10–20%: Very big dip
- 20–30%: Big dip
- 30–40%: Dip
- 40–50%: Small dip
- 50–60%: Around average
- 60–70%: Small pump
- 70–80%: Pump
- 80–90%: Big pump
- 90–100%: Extreme pump

## API

### GET `/api/summary`
Current analysis for both horizons. Includes price, SMA, R, raw percentile, historical average, counts over the recent window, and (when available) the latest vol‑adjusted percentile (via history cache).

### GET `/api/history`
Historical series for both horizons. Prefers precomputed CSVs; if absent, computes on the fly from `bootstrap_10min.csv`.

Response shape (per horizon):

```
{
  horizons: {
    "365d": [ { t, price, sma, multiple, percentile, volAdjPercentile }, ... ],
    "30d":  [ { t, price, sma, multiple, percentile, volAdjPercentile }, ... ]
  }
}
```

### GET `/api/health`
Simple health status.

## Price Source

- Live price: Bull Bitcoin Index USD (fetched server‑side)
- Historical: repository CSVs listed above

## Frontend Visualization

- Dual‑axis charts per horizon:
  - Price (left axis) and Multiple (right axis)
  - Price (left axis) and Percentile (right axis; Raw or Vol‑adjusted via UI)
- Interactive zoom presets (All time, 4 years, Last year, Last month) and synchronized panning/zooming
- Reference lines for current Multiple and current Percentile
- Download button to export the currently selected horizon’s history as CSV

## Architecture

- Node.js + Express + TypeScript backend
- Singleton services:
  - `DataService` – loads CSVs, builds hourly/daily aggregates
  - `AnalysisService` – computes SMA, R, percentiles, and vol‑adjusted metrics
- Frontend: vanilla JS with Chart.js + chartjs‑plugin‑zoom

## Repository Size Considerations

GitHub’s 100 MB file limit is respected by downsampling raw ticks to 10‑minute (`bootstrap_10min.csv`) and by publishing compact precomputed history files. The app prefers the precomputed files for fast startup and consistent results.

## Disclaimer

This tool analyzes historical deviations from trend. It is not a prediction model and is not financial advice.
