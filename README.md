# Bitcoin Price Gauge

A real-time Bitcoin price analysis tool that uses the **Price Multiple (R-multiple)** to determine if Bitcoin is currently in a dip or pump phase compared to historical trends.

## What it does

The app analyzes Bitcoin's current price relative to its moving averages over two time horizons:
- **30 days**: Uses hourly data for short-term analysis
- **365 days**: Uses daily data for long-term analysis

For each horizon, it calculates:
- **Price Multiple**: Current price ÷ Moving Average
- **Label**: One of 10 human-readable labels from "Very big dip" to "Extreme pump"
- **Percentile**: How the current multiple ranks historically
- **SMA**: The Simple Moving Average used for calculations

## Features

- 🚀 **Real-time analysis**: Fetches live price from Bull Bitcoin API
- 📊 **Visual gauge**: Shows market position with an intuitive gauge display
- 🏷️ **10 clear labels**: From "Very big dip" to "Extreme pump"
- 📈 **Dual horizons**: 30-day (hourly) and 365-day (daily) analysis
- 🔄 **Historical context**: Percentile rankings based on historical data
- 💾 **Data persistence**: Loads bootstrap data and maintains price history

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd bitcoin-price-gauge
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Start the server**
   ```bash
   npm start
   ```

## Development

For development with auto-reload:
```bash
npm run dev
```

## Data Setup

### Bootstrap Data
Place your historical price data in `data/bootstrap.csv` with the format:
```csv
time,price
2023-01-01T00:00:00Z,16500.50
2023-01-01T00:05:00Z,16501.25
...
```

The app will automatically load this data on startup and use it for historical analysis.

### Data Format
- **time**: ISO 8601 timestamp (UTC)
- **price**: Bitcoin price in USD

## API Endpoints

### GET `/api/summary`
Returns the current Bitcoin price analysis.

**Response:**
```json
{
  "asOfUTC": "2025-01-22T12:34:56Z",
  "currentPriceUSD": 61234.56,
  "priceSource": "BullBitcoin Index USD",
  "priceAsOfUTC": "2025-01-22T12:34:56Z",
  "horizons": {
    "365d": {
      "multiple": 0.94,
      "percentile": 0.18,
      "higherThanPercent": 0.16,
      "label": "Big dip",
      "sma": 65245.10,
      "smaAsOfUTC": "2025-01-22T00:00:00Z",
      "sampleSize": 365
    },
    "30d": {
      "multiple": 1.07,
      "percentile": 0.65,
      "higherThanPercent": 0.62,
      "label": "Pump",
      "sma": 57321.93,
      "smaAsOfUTC": "2025-01-22T12:00:00Z",
      "sampleSize": 720
    }
  }
}
```

### GET `/api/health`
Health check endpoint.

## Label System

The app uses 10 static labels based on Price Multiple values:

| Multiple Range | Label | Color | Meaning |
|----------------|-------|-------|---------|
| < 0.6 | Very big dip | 🟢 Green | Extreme undervaluation |
| 0.6 - 0.75 | Big dip | 🟢 Green | Significant undervaluation |
| 0.75 - 0.85 | Dip | 🟢 Green | Moderate undervaluation |
| 0.85 - 0.95 | Small dip | 🟢 Green | Slight undervaluation |
| 0.95 - 1.05 | Around average | 🟡 Yellow | Near trend |
| 1.05 - 1.15 | Small pump | 🔴 Red | Slight overvaluation |
| 1.15 - 1.25 | Pump | 🔴 Red | Moderate overvaluation |
| 1.25 - 1.5 | Big pump | 🔴 Red | Significant overvaluation |
| 1.5 - 2.0 | Very big pump | 🔴 Red | Extreme overvaluation |
| > 2.0 | Extreme pump | 🔴 Red | Bubble territory |

## How it works

1. **Data Collection**: Fetches current price from Bull Bitcoin API
2. **Aggregation**: Converts 5-minute ticks to hourly and daily averages
3. **Moving Averages**: Calculates trailing SMAs (excluding current period)
4. **Price Multiple**: Computes R = Current Price ÷ SMA
5. **Historical Context**: Ranks current R against historical R values
6. **Labeling**: Maps R to one of 10 human-readable labels
7. **Display**: Updates UI with analysis results and visual gauge

## Technical Details

- **Backend**: Node.js + Express + TypeScript
- **Frontend**: Vanilla JavaScript + Tailwind CSS
- **Data Source**: Bull Bitcoin Public API
- **Storage**: In-memory with CSV bootstrap loading
- **Architecture**: Singleton services with dependency injection

## Configuration

Environment variables:
- `PORT`: Server port (default: 3000)

## Troubleshooting

### No historical data
- Ensure `data/bootstrap.csv` exists with proper format
- Check console for data loading messages

### API errors
- Verify Bull Bitcoin API is accessible
- Check network connectivity
- Review console error messages

### Gauge not updating
- Refresh the page
- Check browser console for JavaScript errors
- Verify API endpoint is responding

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Disclaimer

This tool is for informational purposes only. It does not constitute financial advice. Always do your own research before making investment decisions.
