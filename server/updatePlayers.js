const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Load environment variables from the root .env file
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const PLAYERS_FILE_PATH = path.join(__dirname, "players.json");
const STATUS_FILE_PATH = path.join(__dirname, "last-update.json");
const FRONTEND_PLAYERS_PATH = path.join(__dirname, "../src/data/players.json");

// Helper to delay execution to prevent hitting API limits
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ──────────────────────────────────────────────────────────
// 1. GATHER ALL CONFIGURED GEMINI API KEYS
// ──────────────────────────────────────────────────────────
const GEMINI_KEYS = [
    process.env.GEMINI_API_KEY_1,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5
].filter(Boolean); // Filters out any key that isn't defined or is blank

let currentKeyIndex = 0; // Starts at the first key

console.log(`🔑 Gemini Key Rotation Engine: Loaded ${GEMINI_KEYS.length} API Keys.`);

// ──────────────────────────────────────────────────────────
// 2. DYNAMIC GEMINI KEY-ROTATION EXECUTOR
// ──────────────────────────────────────────────────────────
async function executeGeminiPromptWithRotation(prompt) {
    if (GEMINI_KEYS.length === 0) {
        throw new Error("CRITICAL: No Gemini API keys are configured in your .env file!");
    }

    let attempts = 0;
    while (attempts < GEMINI_KEYS.length) {
        const apiKey = GEMINI_KEYS[currentKeyIndex];
        const keyNumber = currentKeyIndex + 1;

        try {
            // Initialize Gemini client with the current rotated key
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: "gemini-3.5-flash",
                generationConfig: { responseMimeType: "application/json" }
            });

            const result = await model.generateContent(prompt);
            const text = result.response.text();
            
            // Validate that the output is indeed a parseable JSON object
            JSON.parse(text);
            return text; // Success!

        } catch (error) {
            console.warn(`⚠️ Warning: Gemini Key #${keyNumber} failed: ${error.message.substring(0, 120)}...`);
            
            // Rotate to the next key in line (round-robin)
            currentKeyIndex = (currentKeyIndex + 1) % GEMINI_KEYS.length;
            console.log(`🔄 Rotating to Gemini API Key #${currentKeyIndex + 1} for next attempt...`);
            
            attempts++;
            // Small pause before retrying with the next key
            await sleep(1000);
        }
    }

    throw new Error("❌ CRITICAL: All 5 Google Gemini API keys failed or exhausted their daily quotas!");
}

// ──────────────────────────────────────────────────────────
// 3. DEFINE ALPHABET RANGES (7-6-7-6 SPLIT)
// ──────────────────────────────────────────────────────────
const RANGES = [
    {
        name: "A to G", // 7 letters: A, B, C, D, E, F, G
        letters: ["A", "B", "C", "D", "E", "F", "G"],
        promptRange: "whose first names start with the letters A, B, C, D, E, F, or G"
    },
    {
        name: "H to M", // 6 letters: H, I, J, K, L, M
        letters: ["H", "I", "J", "K", "L", "M"],
        promptRange: "whose first names start with the letters H, I, J, K, L, or M"
    },
    {
        name: "N to T", // 7 letters: N, O, P, Q, R, S, T
        letters: ["N", "O", "P", "Q", "R", "S", "T"],
        promptRange: "whose first names start with the letters N, O, P, Q, R, S, or T"
    },
    {
        name: "U to Z", // 6 letters: U, V, W, X, Y, Z
        letters: ["U", "V", "W", "X", "Y", "Z"],
        promptRange: "whose first names start with the letters U, V, W, X, Y, or Z"
    }
];

// Helper to safely parse numbers with defaults
// Strict curated overrides to protect critical player franchise mappings from AI hallucinations
const STRICTOR_TEAM_MAPPING = {
    "Ravindra Jadeja": "Chennai Super Kings",
    "R Jadeja": "Chennai Super Kings"
};

const parseNumber = (val) => {
    const num = Number(val);
    return isNaN(num) ? 0 : num;
};

// Helper to convert stats from various formats into exact players.json schema
function mapAndCleanStats(stat, playerDetails) {
    const name = stat.name || playerDetails.name;
    const team = stat.team || playerDetails.team;
    const matches = parseNumber(stat.matches);
    const runs = parseNumber(stat.runs);
    const hs = parseNumber(stat.hs);
    const battingAvg = parseNumber(stat.battingAvg || stat.battingAverage);
    const battingSR = parseNumber(stat.battingSR || stat.battingStrikeRate || stat["batting strikerate"] || stat["batting strike rate"]);
    const hundreds = parseNumber(stat.hundreds);
    const fifties = parseNumber(stat.fifties);
    const wickets = parseNumber(stat.wickets);
    const bowlingAvg = parseNumber(stat.bowlingAvg || stat.bowlingAverage);
    const economy = parseNumber(stat.economy);
    const bowlingSR = parseNumber(stat.bowlingSR || stat.bowlingStrikeRate || stat["bowling strikerate"] || stat["bowling strike rate"]);
    const catches = parseNumber(stat.catches);

    return {
        name,
        team,
        matches,
        runs,
        hs,
        battingAvg,
        battingSR,
        hundreds,
        fifties,
        wickets,
        bowlingAvg,
        economy,
        bowlingSR,
        catches
    };
}

async function resolveTeamsWithDedicatedMappingKey(playersList) {
    const mappingKey = process.env.GEMINI_API_KEY_MAPPING;
    if (!mappingKey) {
        console.warn("⚠️ Warning: GEMINI_API_KEY_MAPPING is not configured. Skipping dedicated team mapping phase.");
        return;
    }

    console.log("\n🛰️ Phase 1.5: Resolving 100% accurate player-team mappings using dedicated API key...");
    const BATCH_SIZE = 45; // Increased from 10 to 45 to protect daily project quotas (fewer API requests total)
    const teamMap = new Map();

    for (let i = 0; i < playersList.length; i += BATCH_SIZE) {
        const batch = playersList.slice(i, i + BATCH_SIZE);
        const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(playersList.length / BATCH_SIZE);

        console.log(`[Mapping Batch ${batchIndex}/${totalBatches}] Querying teams for: ${batch.map(p => p.name).join(", ")}`);

        const playerNamesString = batch.map((p, idx) => `${idx + 1}. currently ${p.name} belongs to which ipl team`).join("\n");

        const prompt = `
          Retrieve the correct, official, current latest Indian Premier League (IPL) franchise team (as of the current completed or ongoing IPL season in May 2026) by answering each of the following questions:
          ${playerNamesString}

          CRITICAL DIRECTIONS:
          1. Return ONLY the current/latest team franchise for each player as of May 2026. Do not list historical teams they played for in the past.
          2. If a player is retired from all active IPL play or currently unsold (e.g. Suresh Raina, AB de Villiers, Lasith Malinga, Gautam Gambhir, Yuvraj Singh, Sachin Tendulkar), return their last/latest team franchise they played for (e.g., Chennai Super Kings, Royal Challengers Bengaluru, Mumbai Indians). DO NOT return "Retired" or "Unsold" as their team under any circumstances.
          3. Grounding Benchmarks:
             - Ravindra Jadeja plays for "Chennai Super Kings".
             - Bhuvneshwar Kumar plays for "Royal Challengers Bengaluru".
             - Yuzvendra Chahal plays for "Punjab Kings".
             - Rishabh Pant plays for "Delhi Capitals".
             - Glenn Maxwell plays for "Punjab Kings".
             - Rohit Sharma plays for "Mumbai Indians".
             - Virat Kohli plays for "Royal Challengers Bengaluru".

          You must return only a valid JSON object matching the following schema. Return raw JSON.

          JSON Schema:
          {
            "mappings": [
              {
                "name": "Exact Player Name",
                "team": "Current Latest IPL Team Franchise"
              }
            ]
          }
        `;

        try {
            const genAI = new GoogleGenerativeAI(mappingKey);
            const model = genAI.getGenerativeModel({
                model: "gemini-3.5-flash",
                generationConfig: { responseMimeType: "application/json" }
            });

            const result = await model.generateContent(prompt);
            const text = result.response.text();
            const data = JSON.parse(text);

            if (data && Array.isArray(data.mappings)) {
                data.mappings.forEach(m => {
                    teamMap.set(m.name.toLowerCase().trim(), m.team.trim());
                    console.log(`  🎯 ${m.name} -> ${m.team}`);
                });
            }
        } catch (error) {
            console.warn(`  ⚠️ Dedicated mapping key failed: ${error.message.substring(0, 120)}...`);
            console.log("  🔄 Falling back to Gemini Key Rotation Engine for this mapping batch...");
            try {
                const responseText = await executeGeminiPromptWithRotation(prompt);
                const data = JSON.parse(responseText);
                if (data && Array.isArray(data.mappings)) {
                    data.mappings.forEach(m => {
                        teamMap.set(m.name.toLowerCase().trim(), m.team.trim());
                        console.log(`  🎯 ${m.name} -> ${m.team}`);
                    });
                }
            } catch (rotError) {
                console.error(`  ❌ Failed mapping batch ${batchIndex} on rotated keys as well:`, rotError.message);
            }
        }

        // Delay to protect rate limits on the mapping key (15s for safety on larger batches)
        if (i + BATCH_SIZE < playersList.length) {
            await sleep(15000);
        }
    }

    // Apply the resolved teams to playersList
    playersList.forEach(player => {
        const resolvedTeam = teamMap.get(player.name.toLowerCase().trim());
        if (resolvedTeam) {
            player.team = resolvedTeam;
        }
    });

    console.log("✅ Dedicated team mappings resolution phase complete!\n");
}

async function runUpdate() {
    console.log("\n==============================================");
    console.log("   IPL STATS ROTATION UPDATER (GEMINI ONLY)");
    console.log("==============================================\n");

    // Read current player cards database to preserve existing custom fields
    let existingPlayersMap = new Map();
    try {
        if (fs.existsSync(PLAYERS_FILE_PATH)) {
            const existingData = JSON.parse(fs.readFileSync(PLAYERS_FILE_PATH, "utf8"));
            existingData.forEach(p => {
                existingPlayersMap.set(p.name, p);
            });
        }
    } catch (e) {
        console.warn("⚠️ Warning: Could not parse existing players.json, starting fresh.");
    }

    let allDiscoveredPlayers = [];

    // ──────────────────────────────────────────────────────────
    // PHASE 1: DISCOVER PLAYERS IN ALL 4 ALPHABETICAL GROUPS
    // ──────────────────────────────────────────────────────────
    for (const range of RANGES) {
        console.log(`\n🔍 [Group ${range.name}] Searching players starting A-Z using Google Gemini...`);
        
        const discoverPrompt = `
          Provide a highly comprehensive list of as many active or legendary IPL cricket players as possible (aim for at least 40-50 players) ${range.promptRange} who have played a minimum of 25 matches in their IPL career.
          For each player, you must provide:
          1. Their full name (name).
          2. Their most recent/latest IPL team franchise they played for, or are currently signed with (team). Do not list historical teams they played for in the past, only their latest/current team.
          
          You must return only a valid JSON object matching the following schema. Return raw JSON.
          
          JSON Schema:
          {
            "players": [
              {
                "name": "Player Name",
                "team": "Latest IPL Team"
              }
            ]
          }
        `;

        try {
            const responseText = await executeGeminiPromptWithRotation(discoverPrompt);
            const data = JSON.parse(responseText);
            if (data && Array.isArray(data.players)) {
                console.log(`✅ [Group ${range.name}] Discovered ${data.players.length} players!`);
                allDiscoveredPlayers = allDiscoveredPlayers.concat(data.players);
            } else {
                console.warn(`⚠️ [Group ${range.name}] Discovery returned invalid array structure.`);
            }
        } catch (error) {
            console.error(`❌ [Group ${range.name}] Discovery failed on all rotated keys:`, error.message);
            console.log("Falling back to local players in this range...");
            existingPlayersMap.forEach(player => {
                const firstLetter = player.name.trim().charAt(0).toUpperCase();
                if (range.letters.includes(firstLetter)) {
                    allDiscoveredPlayers.push({ name: player.name, team: player.team });
                }
            });
        }

        // Delay to protect quotas (5 RPM limit safe zone)
        await sleep(12000);
    }

    // ──────────────────────────────────────────────────────────
    // PRESERVATION MERGING (COMBINE DISCOVERED AND EXISTING)
    // ──────────────────────────────────────────────────────────
    console.log("\n📦 Merging discovered data with existing player file...");
    let allPlayersMap = new Map();

    // 1. Populate existing players first (No player is ever deleted!)
    existingPlayersMap.forEach((player, name) => {
        allPlayersMap.set(name, player);
    });

    // 2. Merge discovered players. If new, add them. If existing, preserve their manually assigned/curated team.
    allDiscoveredPlayers.forEach(discovered => {
        if (allPlayersMap.has(discovered.name)) {
            const existing = allPlayersMap.get(discovered.name);
            allPlayersMap.set(discovered.name, {
                ...existing,
                team: existing.team || discovered.team // Keep existing team, only use discovered if missing
            });
        } else {
            console.log(`🆕 Found brand new missing player: ${discovered.name} (${discovered.team})`);
            allPlayersMap.set(discovered.name, {
                name: discovered.name,
                team: discovered.team,
                matches: 0, // 0 triggers stats retrieval in Phase 2
                runs: 0,
                hs: 0,
                battingAvg: 0,
                battingSR: 0,
                hundreds: 0,
                fifties: 0,
                wickets: 0,
                bowlingAvg: 0,
                economy: 0,
                bowlingSR: 0,
                catches: 0
            });
        }
    });

    const playersToProcess = Array.from(allPlayersMap.values());
    console.log(`📊 Merge Complete! Total database cards to check/update: ${playersToProcess.length}`);

    // Resolve teams using dedicated GEMINI_API_KEY_MAPPING key
    await resolveTeamsWithDedicatedMappingKey(playersToProcess);

    // ──────────────────────────────────────────────────────────
    // PHASE 2: BATCH STATS EXTRACTION WITH KEY ROTATION
    // ──────────────────────────────────────────────────────────
    console.log("\n📊 Phase 2: Updating statistics in high-efficiency batches of 45...");
    
    const finalPlayersList = [];
    const BATCH_SIZE = 45; // Increased from 10 to 45 to reduce request count and protect daily quotas

    for (let i = 0; i < playersToProcess.length; i += BATCH_SIZE) {
        const batch = playersToProcess.slice(i, i + BATCH_SIZE);
        const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(playersToProcess.length / BATCH_SIZE);

        console.log(`\n[Batch ${batchIndex}/${totalBatches}] Processing stats for: ${batch.map(p => p.name).join(", ")}`);

        // We query all players in the batch to keep stats 100% fresh and up-to-date
        const playersToQuery = batch; 

        console.log(`🔗 Routing stats completion for Batch ${batchIndex} to Google Gemini (Active Key #${currentKeyIndex + 1})...`);

        const playerNamesString = playersToQuery.map((p, idx) => `${idx + 1}. ${p.name}`).join("\n");

        const statsPrompt = `
          Retrieve the official, up-to-date COMPLETE CUMULATIVE CAREER Indian Premier League (IPL) statistics up to the end of the most recent completed or ongoing IPL season as of May 2026 for the following ${playersToQuery.length} cricket players:
          ${playerNamesString}

          CRITICAL DIRECTIONS:
          1. The current date is May 2026. The statistics must represent the player's CUMULATIVE CAREER AGGREGATES across ALL IPL seasons combined, up to May 2026 (including the completed 2024 and 2025 seasons and the current/just-completed 2026 season). Do not return statistics from a single season or outdated historical snapshots from several years ago.
          2. As a benchmark, as of May 25, 2026, Virat Kohli has played exactly 282 matches, scored exactly 9,243 cumulative career runs, and hit exactly 9 centuries.
          3. ACCURACY REQUIREMENT: Do not round up or fabricate centuries or runs. Virat Kohli has exactly 9 centuries, so return 9 centuries for Virat Kohli. Similarly, do not round up or estimate for any other players. If a player has never hit an IPL century (e.g. MS Dhoni, Ravindra Jadeja, Kieron Pollard), return exactly 0 for hundreds. All statistics must represent precise, official cumulative career aggregates.

          You must return a valid JSON object containing a "stats" array with exactly ${playersToQuery.length} objects, in the same order as listed above.
          If any stat is unknown or not applicable (e.g., if they are a pure batsman and don't bowl, or vice-versa), return 0 for those numeric fields. Do not include any conversational text or markdown formatting, just return raw JSON.

          JSON Schema:
          {
            "stats": [
              {
                "name": "Exact Player Name",
                "matches": number,
                "runs": number,
                "hs": number,
                "battingAvg": number,
                "battingSR": number (batting strike rate),
                "hundreds": number,
                "fifties": number,
                "wickets": number,
                "bowlingAvg": number (bowling average),
                "economy": number,
                "bowlingSR": number (bowling strike rate),
                "catches": number
              }
            ]
          }
        `;

        try {
            const responseText = await executeGeminiPromptWithRotation(statsPrompt);
            const data = JSON.parse(responseText);

            if (data && Array.isArray(data.stats)) {
                const freshStatsMap = new Map();
                data.stats.forEach(stat => {
                    const cleaned = mapAndCleanStats(stat, stat);
                    freshStatsMap.set(cleaned.name.toLowerCase(), cleaned);
                });

                batch.forEach(player => {
                    const freshStat = freshStatsMap.get(player.name.toLowerCase());
                    const originalCard = existingPlayersMap.get(player.name) || {};

                    if (freshStat) {
                        // Apply match count filter (double check 25 match rule)
                        if (freshStat.matches < 25) {
                            console.log(`⚠️ Skipped ${player.name}: Only played ${freshStat.matches} matches.`);
                            return;
                        }

                        // Save and merge cleanly
                        finalPlayersList.push({
                            ...player,
                            ...freshStat,
                            ...originalCard, // Keep any manual custom properties
                            name: player.name,
                            team: STRICTOR_TEAM_MAPPING[player.name] || player.team || originalCard.team,
                            matches: freshStat.matches,
                            runs: freshStat.runs,
                            hs: freshStat.hs,
                            battingAvg: freshStat.battingAvg,
                            battingSR: freshStat.battingSR,
                            hundreds: freshStat.hundreds,
                            fifties: freshStat.fifties,
                            wickets: freshStat.wickets,
                            bowlingAvg: freshStat.bowlingAvg,
                            economy: freshStat.economy,
                            bowlingSR: freshStat.bowlingSR,
                            catches: freshStat.catches
                        });
                        console.log(`✅ Stats successfully updated for ${player.name}`);
                    } else {
                        // Keep their existing card untouched if not returned by Gemini
                        finalPlayersList.push(player);
                    }
                });
            } else {
                console.error(`❌ Batch ${batchIndex} response did not contain stats array.`);
                batch.forEach(p => finalPlayersList.push(p));
            }
        } catch (error) {
            console.error(`❌ Failed to extract stats for Batch ${batchIndex} using Gemini Key Rotation:`, error.message);
            // On error, fall back to preserving all players in this batch using their cached data
            batch.forEach(p => finalPlayersList.push(p));
        }

        // Delay between batch requests to respect free quotas (15s for safety on larger batches)
        if (i + BATCH_SIZE < playersToProcess.length) {
            await sleep(15000);
        }
    }

    // ──────────────────────────────────────────────────────────
    // PHASE 4: SAVE UPDATED DATABASE
    // ──────────────────────────────────────────────────────────
    try {
        fs.writeFileSync(PLAYERS_FILE_PATH, JSON.stringify(finalPlayersList, null, 2), "utf8");
        
        // Automatically sync to frontend copy for complete database parity
        try {
            const frontendDir = path.dirname(FRONTEND_PLAYERS_PATH);
            if (fs.existsSync(frontendDir)) {
                fs.writeFileSync(FRONTEND_PLAYERS_PATH, JSON.stringify(finalPlayersList, null, 2), "utf8");
                console.log("🎉 SUCCESS: Synchronized updated players database to frontend (src/data/players.json)!");
            }
        } catch (feErr) {
            console.warn("⚠️ Warning: Could not synchronize automatically to frontend players directory:", feErr.message);
        }
        
        console.log("\n==============================================");
        console.log("🎉 SUCCESS: All players' stats have been successfully updated! 🎉");
        console.log(`Saved ${finalPlayersList.length} high-quality player cards to players.json.`);
        console.log("==============================================\n");

        // Record the last update timestamp
        const statusData = {
            lastUpdated: new Date().toISOString()
        };
        fs.writeFileSync(STATUS_FILE_PATH, JSON.stringify(statusData, null, 2), "utf8");
        console.log("🎉 SUCCESS: Update timestamp recorded in last-update.json.");
        return true;
    } catch (error) {
        console.error("❌ Failed to write final players.json or status file:", error);
        return false;
    }
}

// Allow running directly via "npm run update-stats"
if (require.main === module) {
    runUpdate().catch(console.error);
}

module.exports = { runUpdate };
