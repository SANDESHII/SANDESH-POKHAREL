export interface OddsData {
  openingDraw: number;
  currentDraw: number;
  openingHome: number;
  currentHome: number;
  openingAway: number;
  currentAway: number;
}

/**
 * Calculates a dynamic rho (Dixon-Coles adjustment) based on market movements.
 * Significant drops in draw odds indicate a high probability of low-scoring tactical setups.
 */
export function calculateDynamicRho(odds: OddsData): number {
  const impliedOpeningDraw = 1 / (odds.openingDraw || 3.4);
  const impliedCurrentDraw = 1 / (odds.currentDraw || 3.4);
  const drawDrift = impliedCurrentDraw - impliedOpeningDraw;

  // Base rho is usually slightly negative for football as 0-0/1-1 are more common than Poisson predicts
  let rho = -0.05; 

  // Market signals: Smart money flowing toward the draw
  if (drawDrift > 0.03) {
    // If the draw probability increases by >3%, favor low-scoring correlation
    rho -= 0.12;
  } else if (drawDrift < -0.03) {
    // If market moves away from draw, reduce correlation
    rho += 0.05;
  }

  return Math.min(0.1, Math.max(-0.25, rho));
}

/**
 * Calculates the market sentiment strength (Confidence Vector adjustment)
 */
export function calculateMarketConfidence(odds: OddsData): number {
  if (!odds.openingHome || !odds.currentHome) return 0.85;

  const homeDrift = Math.abs((1 / odds.currentHome) - (1 / odds.openingHome));
  const awayDrift = Math.abs((1 / odds.currentAway) - (1 / odds.openingAway));
  
  // High volatility (drift) reduces our structural confidence
  const totalVolatility = homeDrift + awayDrift;
  return Math.max(0.65, 0.95 - (totalVolatility * 2));
}
