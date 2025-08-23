import { Router, Request, Response } from 'express';
import { PriceService } from '../services/priceService';
import { DataService } from '../services/dataService';
import { AnalysisService } from '../services/analysisService';

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

export default router;
