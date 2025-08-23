import { LabelType } from '../types';

export function getLabelFromPercentile(percentile: number): LabelType {
  if (percentile <= 0.1) return 'Extreme dip';
  if (percentile <= 0.2) return 'Very big dip';
  if (percentile <= 0.3) return 'Big dip';
  if (percentile <= 0.4) return 'Dip';
  if (percentile <= 0.5) return 'Small dip';
  if (percentile <= 0.6) return 'Around average';
  if (percentile <= 0.7) return 'Small pump';
  if (percentile <= 0.8) return 'Pump';
  if (percentile <= 0.9) return 'Big pump';
  return 'Extreme pump';
}

export function getLabelColor(label: LabelType): string {
  switch (label) {
    case 'Extreme dip':
    case 'Very big dip':
    case 'Big dip':
    case 'Dip':
    case 'Small dip':
      return '#10B981'; // Green for buying opportunities
    case 'Around average':
      return '#F59E0B'; // Yellow for neutral
    case 'Small pump':
    case 'Pump':
    case 'Big pump':
    case 'Extreme pump':
      return '#EF4444'; // Red for selling opportunities
    default:
      return '#6B7280'; // Gray for unknown
  }
}

export function getGaugeValue(percentile: number): number {
  // Convert percentile to a 0-100 scale for gauge display
  // 0% = 0, 50% = 50, 100% = 100
  return percentile * 100;
}
