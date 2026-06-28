export const CRICKET_CONFIG = {
  GLOBAL_MULTIPLIER: 0.22,
  WICKET_LIMITS: { 5: 5, 10: 7, 20: 10 },
  PITCH_INTENSITY_RANGES: {
    BOWLING_FRIENDLY: { max: 0.93, label: "Bowling Friendly 🟢" },
    BALANCED: { max: 1.07, label: "Balanced Pitch 🟡" },
    BATTING_PARADISE: { max: 1.20, label: "Batting Paradise 🔴" }
  },
  MOMENTUM_FACTORS: {
    STARTING: 1.0,
    MIN: 0.70,
    MAX: 1.30,
    WIN_UP: 0.05,
    WICKET_DOWN: -0.15
  },
  NORMALIZATION_CONSTANTS: {
    matches: 250,
    runs: 8500,
    hs: 150,
    battingAvg: 60,
    battingSR: 220,
    hundreds: 10,
    fifties: 60,
    wickets: 200,
    bowlingAvg: 15,
    economy: 5.5,
    bowlingSR: 10,
    catches: 120
  }
};

export const LOWER_BETTER = ["economy", "bowlingAvg", "bowlingSR"];

/**
 * Returns pitch category name based on intensity value
 */
export function getPitchType(intensity) {
  if (intensity <= CRICKET_CONFIG.PITCH_INTENSITY_RANGES.BOWLING_FRIENDLY.max) {
    return CRICKET_CONFIG.PITCH_INTENSITY_RANGES.BOWLING_FRIENDLY.label;
  }
  if (intensity <= CRICKET_CONFIG.PITCH_INTENSITY_RANGES.BALANCED.max) {
    return CRICKET_CONFIG.PITCH_INTENSITY_RANGES.BALANCED.label;
  }
  return CRICKET_CONFIG.PITCH_INTENSITY_RANGES.BATTING_PARADISE.label;
}

/**
 * Normalizes a player's statistic, guarding against division by zero.
 */
export function getNormalizedStat(playerCard, statKey) {
  if (!playerCard) return 0;
  const value = playerCard[statKey] ?? 0;
  const constant = CRICKET_CONFIG.NORMALIZATION_CONSTANTS[statKey] || 1;

  if (LOWER_BETTER.includes(statKey)) {
    if (value <= 0) return 0.0;
    return Number((constant / value).toFixed(4));
  } else {
    return Number((value / constant).toFixed(4));
  }
}

/**
 * Calculates runs scored in an over based on winning percentage and match intensity
 */
export function calculateOverRuns(winningPercentage, matchIntensity, matchMomentum) {
  if (winningPercentage < 5.0) return 0; // Dot Ball
  
  const overRandomFactor = 0.97 + (Math.random() * 0.06); // ±3% Randomness
  const rawRuns = winningPercentage * CRICKET_CONFIG.GLOBAL_MULTIPLIER * matchIntensity * matchMomentum * overRandomFactor;
  
  return Math.min(36, Math.max(1, Math.round(rawRuns)));
}

/**
 * Calculates POTM using a weighted formula:
 * Score = Runs * 1.0 + Wickets * 25.0 + Wins * 5.0 + Impact Bonus (runs >= 20 or wickets >= 2)
 */
export function calculatePOTM(overHistory) {
  const contributions = {};

  overHistory.forEach(over => {
    // Batsman stats
    if (over.battingPlayer) {
      const name = over.battingPlayer;
      if (!contributions[name]) contributions[name] = { runs: 0, wickets: 0, wins: 0 };
      contributions[name].runs += over.runs;
      if (over.runs > 0) contributions[name].wins += 1;
    }
    // Bowler stats
    if (over.bowlingPlayer) {
      const name = over.bowlingPlayer;
      if (!contributions[name]) contributions[name] = { runs: 0, wickets: 0, wins: 0 };
      contributions[name].wickets += over.wicket;
      if (over.wicket > 0) contributions[name].wins += 1;
    }
  });

  let bestPlayer = null;
  let maxScore = -1;

  for (const name in contributions) {
    const c = contributions[name];
    let score = (c.runs * 1.0) + (c.wickets * 25.0) + (c.wins * 5.0);
    
    // Impact Bonus
    if (c.runs >= 20 || c.wickets >= 2) {
      score += 15.0;
    }

    if (score > maxScore) {
      maxScore = score;
      bestPlayer = { name, ...c, score };
    }
  }

  return bestPlayer;
}

/**
 * Generates a realistic sportscaster summary sentence explaining why the player won POTM
 */
export function getPOTMReason(potm) {
  if (!potm) return "A solid team effort.";
  if (potm.runs >= 20 && potm.wickets >= 1) {
    return `An outstanding all-round display with ${potm.runs} runs and ${potm.wickets} wickets!`;
  }
  if (potm.wickets >= 2) {
    return `A lethal bowling performance, picking up ${potm.wickets} crucial wickets!`;
  }
  if (potm.runs >= 25) {
    return `A dominant batting display, smashing ${potm.runs} runs to lead the team!`;
  }
  if (potm.runs > 0 && potm.wickets > 0) {
    return `Contributed value in both innings with ${potm.runs} runs and ${potm.wickets} wicket.`;
  }
  if (potm.wickets > 0) {
    return `Kept the batsman in check, picking up ${potm.wickets} wicket(s) under pressure.`;
  }
  if (potm.runs > 0) {
    return `Played a crucial knock of ${potm.runs} runs to keep the scoreboard ticking.`;
  }
  return "Showed great game awareness and tactical precision.";
}
