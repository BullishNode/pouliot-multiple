export interface PriceTick {
  time: string; // ISO string
  price: number;
}

export interface DailyPrice {
  date: string; // YYYY-MM-DD
  price: number;
}

export interface HourlyPrice {
  datetime: string; // YYYY-MM-DDTHH:00:00Z
  price: number;
}

export interface PriceMultiple {
  multiple: number;
  percentile: number;
  higherThanPercent: number;
  label: string;
  sma: number;
  smaAsOfUTC: string;
  sampleSize: number;
  historicalAverage: number;
  countHigherInWindow: number;
  windowLength: number;
}

export interface PriceAnalysis {
  asOfUTC: string;
  currentPriceUSD: number;
  priceSource: string;
  priceAsOfUTC: string;
  horizons: {
    '365d': PriceMultiple;
    '30d': PriceMultiple;
  };
}

export type LabelType = 
  | 'Extreme dip'      // 0-10%
  | 'Very big dip'     // 10-20%
  | 'Big dip'          // 20-30%
  | 'Dip'              // 30-40%
  | 'Small dip'        // 40-50%
  | 'Around average'   // 50-60%
  | 'Small pump'       // 60-70%
  | 'Pump'             // 70-80%
  | 'Big pump'         // 80-90%
  | 'Extreme pump';    // 90-100%
