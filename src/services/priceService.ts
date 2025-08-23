import axios from 'axios';
import { PriceTick } from '../types';

// Bull Bitcoin API endpoint
const BULL_BITCOIN_API = 'https://www.bullbitcoin.com/api/price';

export class PriceService {
  private static instance: PriceService;
  private lastFetch: number = 0;
  private cache: PriceTick | null = null;
  private readonly CACHE_DURATION = 30000; // 30 seconds

  private constructor() {}

  static getInstance(): PriceService {
    if (!PriceService.instance) {
      PriceService.instance = new PriceService();
    }
    return PriceService.instance;
  }

  async getCurrentPrice(): Promise<PriceTick> {
    const now = Date.now();
    
    // Return cached price if still valid
    if (this.cache && (now - this.lastFetch) < this.CACHE_DURATION) {
      return this.cache;
    }

    try {
      const payload = {
        id: "bitcoin-price-gauge",
        jsonrpc: "2.0",
        method: "getUserRate",
        params: {
          element: {
            fromCurrency: "BTC",
            toCurrency: "USD"
          }
        }
      };

      const response = await axios.post(BULL_BITCOIN_API, payload, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Extract price from response - Bull Bitcoin API returns price in cents
      const priceInCents = response.data.result?.element?.price;
      
      if (!priceInCents || typeof priceInCents !== 'number') {
        console.error('Unexpected API response structure:', response.data);
        throw new Error('Invalid price response from Bull Bitcoin API');
      }

      // Convert cents to dollars
      const priceInDollars = priceInCents / 100;

      const priceTick: PriceTick = {
        time: new Date().toISOString(),
        price: priceInDollars
      };

      this.cache = priceTick;
      this.lastFetch = now;
      
      return priceTick;
    } catch (error) {
      console.error('Failed to fetch price from Bull Bitcoin:', error);
      
      // Return cached price if available, even if expired
      if (this.cache) {
        return this.cache;
      }
      
      throw new Error('Failed to fetch current Bitcoin price');
    }
  }

  async getPriceWithRetry(maxRetries: number = 3): Promise<PriceTick> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.getCurrentPrice();
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
      }
    }
    throw new Error('Failed to fetch price after retries');
  }
}
