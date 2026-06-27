const {
  getRoundStage,
  getPlayerRole,
  getNextWeather,
  getModifiedStat,
  STAT_WEIGHTS
} = require("./gameRules");

describe("Cricket Game Rules Utilities", () => {
  
  describe("getRoundStage", () => {
    test("returns correct stages deterministically", () => {
      // We expect the stages to be deterministic based on Math.sin formula
      expect(getRoundStage(1)).toBe("middle");
      expect(getRoundStage(2)).toBe("middle");
      expect(getRoundStage(3)).toBe("middle");
      expect(getRoundStage(6)).toBe("death");
      expect(getRoundStage(12)).toBe("powerplay");
    });
  });

  describe("getPlayerRole", () => {
    test("detects spinner from SPINNERS list", () => {
      const card = { name: "Yuzvendra Chahal", wickets: 150, runs: 100 };
      expect(getPlayerRole(card)).toBe("spinner");
    });

    test("detects spinner from case-insensitive name match", () => {
      const card = { name: "  Rashid Khan  ", wickets: 10, runs: 20 };
      expect(getPlayerRole(card)).toBe("spinner");
    });

    test("detects pace bowler based on wickets and runs threshold", () => {
      const card = { name: "Jasprit Bumrah", wickets: 145, runs: 50 }; // wickets > 30, runs (50) < 145 * 15 (2175)
      expect(getPlayerRole(card)).toBe("pace");
    });

    test("detects batsman based on runs threshold", () => {
      const card = { name: "Virat Kohli", wickets: 4, runs: 6500, battingAvg: 38.5 };
      expect(getPlayerRole(card)).toBe("batsman");
    });

    test("detects batsman based on battingAvg threshold even with low runs", () => {
      const card = { name: "Yashasvi Jaiswal", wickets: 0, runs: 500, battingAvg: 32.4 };
      expect(getPlayerRole(card)).toBe("batsman");
    });

    test("defaults to allrounder if thresholds not met", () => {
      const card = { name: "Generic Player", wickets: 15, runs: 400, battingAvg: 22.0 };
      expect(getPlayerRole(card)).toBe("allrounder");
    });

    test("handles null/undefined playerCard", () => {
      expect(getPlayerRole(null)).toBe("unknown");
      expect(getPlayerRole(undefined)).toBe("unknown");
    });
  });

  describe("getNextWeather", () => {
    test("returns a valid weather transition from sunny", () => {
      // Mock Math.random to verify specific transition paths
      const originalRandom = Math.random;
      
      Math.random = () => 0.5; // < 0.70 path
      expect(getNextWeather("sunny", 1)).toBe("sunny");

      Math.random = () => 0.8; // < 0.90 path
      expect(getNextWeather("sunny", 1)).toBe("windy");

      Math.random = () => 0.95; // default path
      expect(getNextWeather("sunny", 1)).toBe("cloudy");

      Math.random = originalRandom;
    });

    test("triggers dew option on windy only if round >= 5", () => {
      const originalRandom = Math.random;

      Math.random = () => 0.1; // < 0.20 path
      expect(getNextWeather("windy", 4)).toBe("windy"); // round < 5, ignores dew
      expect(getNextWeather("windy", 5)).toBe("dew"); // round >= 5, triggers dew

      Math.random = originalRandom;
    });
  });

  describe("getModifiedStat", () => {
    const paceCard = { name: "Jasprit Bumrah", wickets: 100, economy: 7.2 }; // pace
    const spinCard = { name: "Rashid Khan", wickets: 100, economy: 6.5 }; // spinner
    const batCard = { name: "Virat Kohli", runs: 1000, battingSR: 135, battingAvg: 40 }; // batsman, power hitter (SR >= 130, runs > 300)

    test("returns original value if no pitch/weather conditions present", () => {
      expect(getModifiedStat(paceCard, "wickets", null, "cloudy", 80)).toBe(100);
      expect(getModifiedStat(paceCard, "wickets", "green", null, 80)).toBe(100);
      expect(getModifiedStat(paceCard, "wickets", "green", "cloudy", null)).toBe(100);
    });

    test("returns original value if gameMode is not time or battle", () => {
      expect(getModifiedStat(paceCard, "wickets", "green", "cloudy", 80, "classic")).toBe(100);
      expect(getModifiedStat(paceCard, "wickets", "green", "cloudy", 80, "team")).toBe(100);
    });

    test("applies modifiers if gameMode is time or battle", () => {
      // Pace bowler under cloudy weather with wet pitch (moisture >= 75)
      // Wickets multiplier = 1 + 0.20 (wet) + 0.15 (cloudy) = 1.35
      expect(getModifiedStat(paceCard, "wickets", "green", "cloudy", 80, "time")).toBe(135);
      expect(getModifiedStat(paceCard, "wickets", "green", "cloudy", 80, "battle")).toBe(135);
    });

    test("calculates pace bowler modifications correctly", () => {
      // Wickets multiplier = 1 + 0.20 (wet) + 0.15 (cloudy) = 1.35
      expect(getModifiedStat(paceCard, "wickets", "green", "cloudy", 80)).toBe(135); // Math.round(100 * 1.35)

      // Wickets multiplier = 1 + 0.0 (dry) + 0.0 (sunny) - 0.15 (dew) = 0.85
      expect(getModifiedStat(paceCard, "wickets", "dry", "dew", 30)).toBe(85);

      // Economy multiplier = 1 - 0.10 (cloudy swing) = 0.90 (better control, economy decreases)
      expect(getModifiedStat(paceCard, "economy", "green", "cloudy", 60)).toBe(6.48); // (7.2 * 0.9).toFixed(2)

      // Economy multiplier = 1 + 0.20 (dew slip) = 1.20 (worse control, economy increases)
      expect(getModifiedStat(paceCard, "economy", "balanced", "dew", 60)).toBe(8.64);
    });

    test("calculates spin bowler modifications correctly", () => {
      // Wickets multiplier = 1 + 0.30 (moisture < 25) + 0.10 (sunny) = 1.40
      expect(getModifiedStat(spinCard, "wickets", "dusty", "sunny", 15)).toBe(140);

      // Wickets multiplier = 1 + 0.15 (moisture < 50) - 0.25 (dew) = 0.90
      expect(getModifiedStat(spinCard, "wickets", "dry", "dew", 35)).toBe(90);

      // Economy multiplier = 1 - 0.15 (moisture < 25) = 0.85 (better control)
      expect(getModifiedStat(spinCard, "economy", "dusty", "sunny", 10)).toBe(5.52); // (6.5 * 0.85).toFixed(2)

      // Economy multiplier = 1 + 0.30 (dew slip) = 1.30 (worse control)
      expect(getModifiedStat(spinCard, "economy", "balanced", "dew", 60)).toBe(8.45);
    });

    test("calculates batsman modifications correctly", () => {
      // Runs multiplier = 1 + 0.15 (dew bounce) = 1.15
      expect(getModifiedStat(batCard, "runs", "balanced", "dew", 60)).toBe(1150);

      // Runs multiplier = 1 + 0.15 (windy + power hitter) = 1.15
      expect(getModifiedStat(batCard, "runs", "balanced", "windy", 60)).toBe(1150);

      // Batting SR multiplier = 1 - 0.15 (moisture >= 75) = 0.85 (sticky pitch)
      expect(getModifiedStat(batCard, "battingSR", "green", "cloudy", 80)).toBe(114.8); // (135 * 0.85).toFixed(1)

      // Batting Avg multiplier = 1 - 0.15 (moisture < 25) = 0.85 (cracked pitch uneven bounce)
      expect(getModifiedStat(batCard, "battingAvg", "dusty", "sunny", 15)).toBe(34.0); // (40 * 0.85).toFixed(2)
    });
  });
});
