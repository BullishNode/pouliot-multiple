import fs from 'fs';
import path from 'path';
import { PriceTick, DailyPrice, HourlyPrice } from '../types';

export class DataService {
  private static instance: DataService;
  private dailyPrices: DailyPrice[] = [];
  private hourlyPrices: HourlyPrice[] = [];
  private readonly DATA_DIR = path.join(process.cwd(), 'data');
  private readonly BOOTSTRAP_FILE = path.join(this.DATA_DIR, 'bootstrap.csv');

  private constructor() {
    this.loadBootstrapData();
  }

  static getInstance(): DataService {
    if (!DataService.instance) {
      DataService.instance = new DataService();
    }
    return DataService.instance;
  }

  private loadBootstrapData(): void {
    try {
      if (!fs.existsSync(this.DATA_DIR)) {
        fs.mkdirSync(this.DATA_DIR, { recursive: true });
        console.log('Created data directory');
        return;
      }

      if (fs.existsSync(this.BOOTSTRAP_FILE)) {
        const csvContent = fs.readFileSync(this.BOOTSTRAP_FILE, 'utf-8');
        const lines = csvContent.split('\n').filter(line => line.trim());
        
        // Skip header if present
        const dataLines = lines[0]?.includes('time,price') ? lines.slice(1) : lines;
        
        const ticks: PriceTick[] = [];
        
        dataLines.forEach((line, index) => {
          try {
            const [timeStr, priceStr] = line.split(',');
            const time = timeStr.trim();
            const price = parseFloat(priceStr.trim());
            
            // Validate price
            if (isNaN(price) || price <= 0) {
              console.warn(`Skipping invalid price at line ${index + 1}: ${priceStr}`);
              return;
            }
            
            // Handle different timestamp formats
            let isoTime: string;
            
            // Check if it's a Unix timestamp (seconds since epoch)
            if (/^\d+\.?\d*$/.test(time)) {
              const unixTime = parseFloat(time);
              // Check if it's seconds (10 digits) or milliseconds (13 digits)
              if (unixTime > 1000000000000) {
                // Milliseconds
                isoTime = new Date(unixTime).toISOString();
              } else {
                // Seconds
                isoTime = new Date(unixTime * 1000).toISOString();
              }
            } else {
              // Try to parse as ISO string
              const date = new Date(time);
              if (isNaN(date.getTime())) {
                console.warn(`Skipping invalid timestamp at line ${index + 1}: ${time}`);
                return;
              }
              isoTime = date.toISOString();
            }
            
            ticks.push({ time: isoTime, price });
          } catch (error) {
            console.warn(`Skipping malformed line ${index + 1}: ${line}`);
          }
        });

        if (ticks.length > 0) {
          this.processHistoricalTicks(ticks);
          console.log(`Loaded ${ticks.length} valid historical price ticks`);
        } else {
          console.log('No valid price ticks found in bootstrap CSV');
        }
      } else {
        console.log('No bootstrap CSV found. Historical data will be empty initially.');
      }
    } catch (error) {
      console.error('Error loading bootstrap data:', error);
    }
  }

  private processHistoricalTicks(ticks: PriceTick[]): void {
    // Group by UTC day and hour
    const dailyMap = new Map<string, number[]>();
    const hourlyMap = new Map<string, number[]>();

    ticks.forEach(tick => {
      try {
        const date = new Date(tick.time);
        if (isNaN(date.getTime())) {
          console.warn(`Skipping tick with invalid date: ${tick.time}`);
          return;
        }
        
        const dayKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
        const hourKey = date.toISOString().slice(0, 13) + ':00:00Z'; // YYYY-MM-DDTHH:00:00Z

        // Daily aggregation
        if (!dailyMap.has(dayKey)) dailyMap.set(dayKey, []);
        dailyMap.get(dayKey)!.push(tick.price);

        // Hourly aggregation
        if (!hourlyMap.has(hourKey)) hourlyMap.set(hourKey, []);
        hourlyMap.get(hourKey)!.push(tick.price);
      } catch (error) {
        console.warn(`Error processing tick: ${tick.time}, ${tick.price}`, error);
      }
    });

    // Convert to daily prices
    this.dailyPrices = Array.from(dailyMap.entries())
      .map(([date, prices]) => ({
        date,
        price: prices.reduce((sum, p) => sum + p, 0) / prices.length
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Convert to hourly prices
    this.hourlyPrices = Array.from(hourlyMap.entries())
      .map(([datetime, prices]) => ({
        datetime,
        price: prices.reduce((sum, p) => sum + p, 0) / prices.length
      }))
      .sort((a, b) => a.datetime.localeCompare(b.datetime));

    console.log(`Processed ${this.dailyPrices.length} daily prices and ${this.hourlyPrices.length} hourly prices`);
  }

  getDailyPrices(): DailyPrice[] {
    return [...this.dailyPrices];
  }

  getHourlyPrices(): HourlyPrice[] {
    return [...this.hourlyPrices];
  }

  getDailyPricesForPeriod(days: number): DailyPrice[] {
    return this.dailyPrices.slice(-days);
  }

  getHourlyPricesForPeriod(hours: number): HourlyPrice[] {
    return this.hourlyPrices.slice(-hours);
  }

  addPriceTick(tick: PriceTick): void {
    // Add to daily aggregation
    const dayKey = tick.time.split('T')[0];
    const existingDay = this.dailyPrices.find(d => d.date === dayKey);
    
    if (existingDay) {
      // Update existing day with new average
      const dayTicks = this.dailyPrices.filter(d => d.date === dayKey);
      const allPrices = [...dayTicks.map(d => d.price), tick.price];
      existingDay.price = allPrices.reduce((sum, p) => sum + p, 0) / allPrices.length;
    } else {
      // Add new day
      this.dailyPrices.push({
        date: dayKey,
        price: tick.price
      });
      this.dailyPrices.sort((a, b) => a.date.localeCompare(b.date));
    }

    // Add to hourly aggregation
    const hourKey = tick.time.slice(0, 13) + ':00:00Z';
    const existingHour = this.hourlyPrices.find(h => h.datetime === hourKey);
    
    if (existingHour) {
      // Update existing hour with new average
      const hourTicks = this.hourlyPrices.filter(h => h.datetime === hourKey);
      const allPrices = [...hourTicks.map(h => h.price), tick.price];
      existingHour.price = allPrices.reduce((sum, p) => sum + p, 0) / allPrices.length;
    } else {
      // Add new hour
      this.hourlyPrices.push({
        datetime: hourKey,
        price: tick.price
      });
      this.hourlyPrices.sort((a, b) => a.datetime.localeCompare(b.datetime));
    }
  }
}
