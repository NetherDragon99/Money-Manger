/**
 * chartColors.ts
 * High-contrast, vibrant, OLED-optimized color generation and largest-remainder
 * rounding for charts and category breakdowns.
 */

export const CURATED_CHART_PALETTE: readonly string[] = [
  '#3b82f6', // blue-500
  '#ef4444', // red-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#8b5cf6', // purple-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#14b8a6', // teal-500
  '#6366f1', // indigo-500
  '#84cc16', // lime-500
  '#d946ef', // fuchsia-500
  '#0ea5e9', // sky-500
  '#e11d48', // rose-600
  '#22c55e', // green-500
  '#eab308', // yellow-500
  '#a855f7', // violet-500
  '#f43f5e', // rose-500
  '#2dd4bf', // teal-400
  '#4f46e5', // indigo-600
  '#fb923c', // orange-400
  '#a3e635', // lime-400
  '#38bdf8', // sky-400
  '#c084fc', // purple-400
];

/**
 * Returns a distinct, non-repeating color for any index.
 * Uses a curated OLED palette first; beyond that, generates hues using the golden angle
 * (137.508 deg) with alternating lightness and saturation to ensure high perceptual distinction.
 */
export function getCategoryChartColor(index: number, totalCount?: number): string {
  if (index < CURATED_CHART_PALETTE.length && (!totalCount || totalCount <= CURATED_CHART_PALETTE.length)) {
    return CURATED_CHART_PALETTE[index];
  }

  // Golden angle distribution for arbitrarily many categories without repeating
  const goldenAngle = 137.507764;
  const hue = Math.round((index * goldenAngle) % 360);

  // Vary lightness and saturation in 3-cycle phases for maximum contrast on dark backgrounds
  const phase = Math.floor(index / CURATED_CHART_PALETTE.length) % 3;
  let saturation = 75;
  let lightness = 56;
  if (phase === 1) {
    saturation = 85;
    lightness = 64;
  } else if (phase === 2) {
    saturation = 70;
    lightness = 48;
  }

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Computes integer percentages using the Largest-Remainder Method (Hare-Niemeyer method).
 * Guarantees that the resulting percentages sum to EXACTLY targetSum (default 100),
 * and every category with amount > 0 receives at least 1% when n <= targetSum.
 */
export function computeLargestRemainderPercentages(
  amounts: number[],
  totalAmount: number,
  targetSum = 100
): number[] {
  if (totalAmount <= 0 || amounts.length === 0) {
    return amounts.map(() => 0);
  }

  const n = amounts.length;
  if (n === 1) {
    return [targetSum];
  }

  const raw = amounts.map((amt) => (amt / totalAmount) * targetSum);
  const floors = raw.map((r) => Math.floor(r));
  const remainders = raw.map((r, i) => ({
    rem: r - floors[i],
    amt: amounts[i],
    index: i,
  }));

  let currentSum = floors.reduce((a, b) => a + b, 0);
  const diff = targetSum - currentSum;

  // Sort descending by fractional remainder; break ties by larger original amount, then lower index
  remainders.sort((a, b) => {
    if (Math.abs(b.rem - a.rem) > 1e-6) {
      return b.rem - a.rem;
    }
    return b.amt - a.amt;
  });

  const result = [...floors];
  for (let i = 0; i < diff && i < remainders.length; i++) {
    result[remainders[i].index] += 1;
  }

  // If there are categories with amount > 0 that received 0% because their quota was < 0.5%,
  // and total active categories n <= targetSum:
  // Borrow 1% from the largest category so EVERY active category has a visible arc and percentage
  if (n <= targetSum) {
    for (let i = 0; i < n; i++) {
      if (amounts[i] > 0 && result[i] === 0) {
        let maxIdx = -1;
        let maxVal = 1;
        for (let j = 0; j < n; j++) {
          if (result[j] > maxVal) {
            maxVal = result[j];
            maxIdx = j;
          }
        }
        if (maxIdx !== -1) {
          result[maxIdx] -= 1;
          result[i] += 1;
        }
      }
    }
  }

  return result;
}
