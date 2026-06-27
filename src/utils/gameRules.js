const STAT_WEIGHTS = {
    runs: 0.85,
    matches: 0.75,
    hs: 0.8,
    battingAvg: 1.15,
    battingSR: 1.2,
    hundreds: 1.1,
    fifties: 1.0,
    wickets: 0.95,
    economy: 1.5,
    bowlingAvg: 1.4,
    bowlingSR: 1.35,
    catches: 1.0
};

const LOWER_BETTER = ["economy", "bowlingAvg", "bowlingSR"];
const battingStats = ["runs", "matches", "hs", "battingAvg", "battingSR", "hundreds", "fifties", "catches"];
const bowlingStats = ["wickets", "economy", "bowlingAvg", "bowlingSR"];

const SPINNERS = [
    "yuzvendra chahal", "rashid khan", "sunil narine", "ravichandran ashwin",
    "amit mishra", "piyush chawla", "harbhajan singh", "imran tahir",
    "krunal pandya", "ravindra jadeja", "axar patel", "varun chakravarthy",
    "kuldeep yadav", "maheesh theekshana", "murugan ashwin", "karn sharma",
    "k gowtham", "krishnappa gowtham", "lalit yadav", "mark watt", "shakib al hasan"
];

function getRoundStage(round) {
    const x = Math.sin(round * 724.3) * 10000;
    const rand = x - Math.floor(x);
    if (rand < 0.33) return "powerplay";
    if (rand < 0.66) return "middle";
    return "death";
}

function getPlayerRole(playerCard) {
    if (!playerCard) return "unknown";
    const nameLower = playerCard.name ? playerCard.name.trim().toLowerCase() : "";
    const wickets = playerCard.wickets ?? 0;
    const runs = playerCard.runs ?? 0;

    const isSpinner = SPINNERS.some(s => nameLower.includes(s));
    if (isSpinner) return "spinner";

    const isPace = wickets > 30 && runs < wickets * 15;
    if (isPace) return "pace";

    if (runs > 1000 || (playerCard.battingAvg ?? 0) > 24) return "batsman";

    return "allrounder";
}

const getNextWeather = (currentWeather, roundNumber) => {
    const rand = Math.random();
    if (currentWeather === "sunny") {
        if (rand < 0.70) return "sunny";
        if (rand < 0.90) return "windy";
        return "cloudy";
    }
    if (currentWeather === "cloudy") {
        if (rand < 0.60) return "cloudy";
        if (rand < 0.85) return "sunny";
        return "windy";
    }
    if (currentWeather === "windy") {
        if (roundNumber >= 5 && rand < 0.20) return "dew";
        if (rand < 0.60) return "windy";
        if (rand < 0.85) return "sunny";
        return "cloudy";
    }
    if (currentWeather === "dew") {
        if (rand < 0.70) return "dew";
        if (rand < 0.90) return "windy";
        return "cloudy";
    }
    return "sunny";
};

function getModifiedStat(playerCard, statKey, pitchCondition, weather, moisture, gameMode) {
    if (!playerCard) return 0;
    const originalValue = playerCard[statKey] ?? 0;
    if (gameMode && gameMode !== "time" && gameMode !== "battle") return originalValue;
    if (!pitchCondition || !weather || moisture === undefined || moisture === null) return originalValue;

    const role = getPlayerRole(playerCard);
    const runs = playerCard.runs ?? 0;
    const isPowerHitter = (playerCard.battingSR ?? 0) >= 130 && runs > 300;

    let multiplier = 1.0;

    if (role === "pace") {
        if (statKey === "wickets") {
            if (moisture >= 75) multiplier += 0.20;
            if (weather === "cloudy") multiplier += 0.15;
            if (weather === "dew") multiplier -= 0.15;
        }
        if (statKey === "economy") {
            if (weather === "cloudy") multiplier -= 0.10;
            if (weather === "dew") multiplier += 0.20;
        }
    }

    if (role === "spinner") {
        if (statKey === "wickets") {
            if (moisture < 25) multiplier += 0.30;
            else if (moisture < 50) multiplier += 0.15;
            if (weather === "sunny") multiplier += 0.10;
            if (weather === "dew") multiplier -= 0.25;
        }
        if (statKey === "economy") {
            if (moisture < 25) multiplier -= 0.15;
            if (weather === "dew") multiplier += 0.30;
        }
    }

    if (role === "batsman" || role === "allrounder") {
        if (statKey === "runs") {
            if (weather === "dew") multiplier += 0.15;
            if (weather === "windy" && isPowerHitter) multiplier += 0.15;
        }
        if (statKey === "battingSR") {
            if (moisture >= 75) multiplier -= 0.15;
            if (weather === "dew") multiplier += 0.10;
            if (weather === "windy" && isPowerHitter) multiplier += 0.15;
        }
        if (statKey === "battingAvg") {
            if (moisture < 25) multiplier -= 0.15;
        }
    }

    if (statKey === "wickets" || statKey === "runs" || statKey === "hs") {
        return Math.round(originalValue * multiplier);
    }

    if (["economy", "bowlingAvg", "bowlingSR", "battingAvg", "battingSR"].includes(statKey)) {
        const decimals = ["economy", "bowlingAvg", "battingAvg"].includes(statKey) ? 2 : 1;
        return Number((originalValue * multiplier).toFixed(decimals));
    }

    return originalValue;
}

module.exports = {
    STAT_WEIGHTS,
    LOWER_BETTER,
    battingStats,
    bowlingStats,
    SPINNERS,
    getRoundStage,
    getPlayerRole,
    getNextWeather,
    getModifiedStat
};
