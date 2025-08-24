import { Router, Request, Response } from 'express';
import { PriceService } from '../services/priceService';
import { DataService } from '../services/dataService';
import { AnalysisService } from '../services/analysisService';
import fs from 'fs';
import path from 'path';
import { simpleMovingAverage, calculatePercentile, winsorize } from '../utils/statistics';

const router = Router();

// GET /summary - Get current Bitcoin price analysis
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const priceService = PriceService.getInstance();
    const dataService = DataService.getInstance();
    const analysisService = AnalysisService.getInstance();

    // Fetch current price from Bull Bitcoin API
    const currentPriceTick = await priceService.getPriceWithRetry();
    
    // Add to data service for future analysis
    dataService.addPriceTick(currentPriceTick);

    // Get historical data
    const dailyPrices = dataService.getDailyPrices().map(d => d.price);
    const hourlyPrices = dataService.getHourlyPrices().map(h => h.price);

    // Perform analysis
    const analysis = await analysisService.analyzePrice(
      currentPriceTick.price,
      dailyPrices,
      hourlyPrices
    );

    res.json(analysis);
  } catch (error) {
    console.error('Error in /summary endpoint:', error);
    res.status(500).json({
      error: 'Failed to analyze Bitcoin price',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /health - Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Bitcoin Price Gauge'
  });
});

// GET /history - Historical price and multiple per horizon
router.get('/history', (req: Request, res: Response) => {
  try {
    // If precomputed history exists, serve it
    const historyDaily = path.join(process.cwd(), 'data', 'history_365d.csv');
    const historyHourly = path.join(process.cwd(), 'data', 'history_30d_hourly.csv');
    if (fs.existsSync(historyDaily) && fs.existsSync(historyHourly)) {
      const parseCsv = (csv: string) => {
        const lines = csv.split('\n').filter(l => l.trim());
        const dataLines = lines[0].toLowerCase().includes('date') || lines[0].toLowerCase().includes('datetime') ? lines.slice(1) : lines;
        const out: any[] = [];
        for (const line of dataLines) {
          const [t, price, sma, multiple, percentile, volAdjPercentile] = line.split(',');
          out.push({
            t: t.includes('T') ? t : `${t}T00:00:00Z`,
            price: parseFloat(price),
            multiple: multiple ? parseFloat(multiple) : null,
            percentile: percentile ? parseFloat(percentile) : null,
            volAdjPercentile: volAdjPercentile ? parseFloat(volAdjPercentile) : null
          });
        }
        return out;
      };
      const dailyCsv = fs.readFileSync(historyDaily, 'utf-8');
      const hourlyCsv = fs.readFileSync(historyHourly, 'utf-8');
      return res.json({ horizons: { '365d': parseCsv(dailyCsv), '30d': parseCsv(hourlyCsv) } });
    }

    const dataService = DataService.getInstance();

    const daily = dataService.getDailyPrices(); // { date: YYYY-MM-DD, price }
    // For historical charts we only need daily granularity

    // 365d using daily prices
    const period365 = 365;
    const points365: { t: string; price: number; multiple: number | null; percentile?: number }[] = [];
    if (daily.length > 0) {
      for (let i = 0; i < daily.length; i++) {
        const price = daily[i].price;
        const t = `${daily[i].date}T00:00:00Z`;
        if (i >= period365) {
          const prior = daily.slice(i - period365, i).map(d => d.price);
          const sma = simpleMovingAverage(prior, period365);
          const multiple = !isNaN(sma) && sma > 0 ? price / sma : null;
          points365.push({ t, price, multiple });
        } else {
          points365.push({ t, price, multiple: null });
        }
      }
    }

    // 30d using daily prices (one point per day)
    const period30d = 30;
    const points30: { t: string; price: number; multiple: number | null; percentile?: number }[] = [];
    if (daily.length > 0) {
      for (let i = 0; i < daily.length; i++) {
        const price = daily[i].price;
        const t = `${daily[i].date}T00:00:00Z`;
        if (i >= period30d) {
          const prior = daily.slice(i - period30d, i).map(d => d.price);
          const sma = simpleMovingAverage(prior, period30d);
          const multiple = !isNaN(sma) && sma > 0 ? price / sma : null;
          points30.push({ t, price, multiple });
        } else {
          points30.push({ t, price, multiple: null });
        }
      }
    }

    // Compute percentile of multiple within each horizon's distribution (winsorized)
    const cutoff = '2015-01-01T00:00:00Z';
    if (points365.length > 0) {
      const vals = points365.filter(p => p.t >= cutoff).map(p => p.multiple).filter((v): v is number => typeof v === 'number' && isFinite(v));
      const m365 = winsorize(vals);
      points365.forEach(p => { if (typeof p.multiple === 'number' && m365.length > 0) p.percentile = calculatePercentile(p.multiple, m365) * 100; });
    }
    if (points30.length > 0) {
      const vals = points30.filter(p => p.t >= cutoff).map(p => p.multiple).filter((v): v is number => typeof v === 'number' && isFinite(v));
      const m30 = winsorize(vals);
      points30.forEach(p => { if (typeof p.multiple === 'number' && m30.length > 0) p.percentile = calculatePercentile(p.multiple, m30) * 100; });
    }

    res.json({
      horizons: {
        '365d': points365,
        '30d': points30
      }
    });
  } catch (error) {
    console.error('Error in /history endpoint:', error);
    res.status(500).json({ error: 'Failed to build history series' });
  }
});

export default router;
