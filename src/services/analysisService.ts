import { PriceAnalysis, PriceMultiple, PriceTick } from '../types';
import { getLabelFromPercentile } from '../utils/labels';
import { 
  simpleMovingAverage, 
  winsorize, 
  calculatePercentile, 
  calculateHigherThanPercent 
} from '../utils/statistics';

export class AnalysisService {
  private static instance: AnalysisService;

  private constructor() {}

  static getInstance(): AnalysisService {
    if (!AnalysisService.instance) {
      AnalysisService.instance = new AnalysisService();
    }
    return AnalysisService.instance;
  }

  async analyzePrice(
    currentPrice: number,
    dailyPrices: number[],
    hourlyPrices: number[]
  ): Promise<PriceAnalysis> {
    const now = new Date();
    const nowISO = now.toISOString();

    // Calculate 365-day analysis (daily granularity)
    const analysis365d = this.calculateHorizonAnalysis(
      currentPrice,
      dailyPrices,
      365,
      'daily',
      now
    );

    // Calculate 30-day analysis (hourly granularity)
    const analysis30d = this.calculateHorizonAnalysis(
      currentPrice,
      hourlyPrices,
      30 * 24, // 30 days * 24 hours
      'hourly',
      now
    );

    return {
      asOfUTC: nowISO,
      currentPriceUSD: currentPrice,
      priceSource: 'BullBitcoin Index USD',
      priceAsOfUTC: nowISO,
      horizons: {
        '365d': analysis365d,
        '30d': analysis30d
      }
    };
  }

  private calculateHorizonAnalysis(
    currentPrice: number,
    historicalPrices: number[],
    period: number,
    granularity: 'daily' | 'hourly',
    now: Date
  ): PriceMultiple {
    if (historicalPrices.length < period) {
      // Not enough data, return default values
      return {
        multiple: NaN,
        percentile: NaN,
        higherThanPercent: NaN,
        label: 'Around average',
        sma: NaN,
        smaAsOfUTC: now.toISOString(),
        sampleSize: historicalPrices.length,
        historicalAverage: NaN,
        countHigherInWindow: 0,
        windowLength: period
      };
    }

    // Get the last N periods (excluding current period)
    const priorPrices = historicalPrices.slice(-period);
    
    // Calculate SMA using prior periods only
    const sma = simpleMovingAverage(priorPrices, period);
    
    if (isNaN(sma) || sma === 0) {
      return {
        multiple: NaN,
        percentile: NaN,
        higherThanPercent: NaN,
        label: 'Around average',
        sma: NaN,
        smaAsOfUTC: now.toISOString(),
        sampleSize: historicalPrices.length,
        historicalAverage: NaN,
        countHigherInWindow: 0,
        windowLength: period
      };
    }

    // Calculate Price Multiple
    const multiple = currentPrice / sma;

    // Calculate historical multiples for this horizon
    const historicalMultiples: number[] = [];
    
    // For each historical period, calculate what the multiple would have been
    for (let i = 0; i < historicalPrices.length - period; i++) {
      const price = historicalPrices[i + period]; // Price at period i
      const priorSMA = simpleMovingAverage(historicalPrices.slice(i, i + period), period);
      
      if (!isNaN(priorSMA) && priorSMA > 0) {
        historicalMultiples.push(price / priorSMA);
      }
    }

    if (historicalMultiples.length === 0) {
      return {
        multiple,
        percentile: NaN,
        higherThanPercent: NaN,
        label: 'Around average', // Default label when no historical data
        sma,
        smaAsOfUTC: now.toISOString(),
        sampleSize: historicalPrices.length,
        historicalAverage: NaN,
        countHigherInWindow: 0,
        windowLength: period
      };
    }

    // Winsorize historical multiples
    const winsorizedMultiples = winsorize(historicalMultiples);

    // Calculate historical average
    const historicalAverage = winsorizedMultiples.reduce((sum, val) => sum + val, 0) / winsorizedMultiples.length;

    // Calculate percentiles
    const percentile = calculatePercentile(multiple, winsorizedMultiples);
    const higherThanPercent = calculateHigherThanPercent(multiple, winsorizedMultiples);

    // Compute window-only multiples (last `period` samples) with trailing SMA and no lookahead
    const windowMultiples: number[] = [];
    for (let i = historicalPrices.length - period; i < historicalPrices.length; i++) {
      const start = i - period;
      if (start < 0) continue;
      const windowPrior = historicalPrices.slice(start, i);
      const wSMA = simpleMovingAverage(windowPrior, period);
      if (!isNaN(wSMA) && wSMA > 0) {
        windowMultiples.push(historicalPrices[i] / wSMA);
      }
    }
    const countHigherInWindow = windowMultiples.filter(m => m > multiple).length;

    // Get label
    const label = getLabelFromPercentile(percentile);

    // Calculate SMA timestamp
    let smaAsOfUTC: string;
    if (granularity === 'daily') {
      // For daily, SMA is based on prior days, so it's as of the start of current day
      const smaDate = new Date(now);
      smaDate.setUTCHours(0, 0, 0, 0);
      smaAsOfUTC = smaDate.toISOString();
    } else {
      // For hourly, SMA is based on prior hours, so it's as of the start of current hour
      const smaDate = new Date(now);
      smaDate.setUTCMinutes(0, 0, 0);
      smaAsOfUTC = smaDate.toISOString();
    }

    return {
      multiple,
      percentile,
      higherThanPercent,
      label,
      sma,
      smaAsOfUTC,
      sampleSize: historicalPrices.length,
      historicalAverage,
      countHigherInWindow,
      windowLength: windowMultiples.length
    };
  }
}
