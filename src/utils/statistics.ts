export function simpleMovingAverage(prices: number[], period: number): number {
  if (prices.length < period) return NaN;
  
  const sum = prices.slice(-period).reduce((acc, price) => acc + price, 0);
  return sum / period;
}

export function winsorize(data: number[], lowerPercentile: number = 1, upperPercentile: number = 99): number[] {
  if (data.length === 0) return [];
  
  const sorted = [...data].sort((a, b) => a - b);
  const lowerIndex = Math.floor((lowerPercentile / 100) * data.length);
  const upperIndex = Math.ceil((upperPercentile / 100) * data.length) - 1;
  
  const lowerBound = sorted[lowerIndex];
  const upperBound = sorted[upperIndex];
  
  return data.map(value => {
    if (value < lowerBound) return lowerBound;
    if (value > upperBound) return upperBound;
    return value;
  });
}

export function calculatePercentile(value: number, data: number[]): number {
  if (data.length === 0) return NaN;
  
  const sorted = [...data].sort((a, b) => a - b);
  const index = sorted.findIndex(x => x >= value);
  
  if (index === -1) return 1.0; // Value is greater than all data
  if (index === 0) return 0.0; // Value is less than or equal to all data
  
  // Count how many values are <= the target value
  let count = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] <= value) count++;
  }
  
  return count / sorted.length;
}

export function calculateHigherThanPercent(value: number, data: number[]): number {
  if (data.length === 0) return NaN;
  
  const sorted = [...data].sort((a, b) => a - b);
  const index = sorted.findIndex(x => x > value);
  
  if (index === -1) return 1.0; // Value is greater than or equal to all data
  if (index === 0) return 0.0; // Value is less than all data
  
  return index / sorted.length;
}
