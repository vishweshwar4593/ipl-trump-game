const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

const PLAYERS_FILE_PATH = path.join(__dirname, "players.json");

// Gather all configured API keys for rotation
const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY_MAPPING,
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5
].filter(Boolean);

if (GEMINI_KEYS.length === 0) {
  console.error("Error: No Gemini API keys found in .env file!");
  process.exit(1);
}

let currentKeyIndex = 0;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function executePromptWithRotation(prompt) {
  let attempts = 0;
  while (attempts < GEMINI_KEYS.length) {
    const apiKey = GEMINI_KEYS[currentKeyIndex];
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-3.5-flash",
        generationConfig: { responseMimeType: "application/json" }
      });

      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      console.warn(`⚠️ API Key index ${currentKeyIndex} failed: ${err.message.substring(0, 100)}`);
      currentKeyIndex = (currentKeyIndex + 1) % GEMINI_KEYS.length;
      attempts++;
      console.log(`🔄 Rotating to API key index ${currentKeyIndex}...`);
      await sleep(2000); // Small pause before retry
    }
  }
  throw new Error("All configured Gemini API keys failed or hit rate limits.");
}

async function verifyAllPlayerTeams() {
  console.log("Reading players.json database...");
  if (!fs.existsSync(PLAYERS_FILE_PATH)) {
    console.error("Error: players.json not found!");
    return;
  }

  const players = JSON.parse(fs.readFileSync(PLAYERS_FILE_PATH, "utf8"));
  console.log(`Loaded ${players.length} players to verify.`);
  console.log(`Using Key Rotation with ${GEMINI_KEYS.length} keys loaded.`);

  const BATCH_SIZE = 45;
  const mismatches = [];

  for (let i = 0; i < players.length; i += BATCH_SIZE) {
    const batch = players.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(players.length / BATCH_SIZE);

    console.log(`\nVerifying Batch ${batchNum}/${totalBatches}...`);

    const playerNamesString = batch.map((p, idx) => `${idx + 1}. currently ${p.name} belongs to which ipl team`).join("\n");

    const prompt = `
      Retrieve the correct, official, current IPL franchise team (as of the current completed or ongoing IPL season in May 2026) by answering each of the following questions:
      
      CRITICAL INSTRUCTIONS:
      1. If a player is retired from all active IPL play or currently unsold (e.g. Suresh Raina, AB de Villiers, Lasith Malinga, Gautam Gambhir, Yuvraj Singh, Sachin Tendulkar, Shane Watson, Kieron Pollard), return their last/latest team franchise they played for. DO NOT return "Retired" or "Unsold" as their team under any circumstances.
      2. Choose strictly from the standard 10 teams:
         - "Royal Challengers Bengaluru"
         - "Chennai Super Kings"
         - "Mumbai Indians"
         - "Kolkata Knight Riders"
         - "Delhi Capitals"
         - "Sunrisers Hyderabad"
         - "Rajasthan Royals"
         - "Punjab Kings"
         - "Lucknow Super Giants"
         - "Gujarat Titans"
      3. Grounding Benchmarks:
         - Ravindra Jadeja belongs to "Chennai Super Kings".
         - Venkatesh Iyer belongs to "Royal Challengers Bengaluru".
         - Krunal Pandya belongs to "Royal Challengers Bengaluru".
         - Bhuvneshwar Kumar belongs to "Royal Challengers Bengaluru".
         - Rishabh Pant belongs to "Mumbai Indians".
         - Shreyas Iyer belongs to "Punjab Kings".
      
      Here is the list of questions:
      ${playerNamesString}

      Return only a valid JSON object matching this schema:
      {
        "verifications": [
          {
            "name": "Exact Player Name",
            "team": "Standard Team Name"
          }
        ]
      }
    `;

    try {
      const text = await executePromptWithRotation(prompt);
      const data = JSON.parse(text);

      if (data && Array.isArray(data.verifications)) {
        const verificationMap = new Map();
        data.verifications.forEach(v => {
          verificationMap.set(v.name.toLowerCase().trim(), v.team.trim());
        });

        batch.forEach(player => {
          const dbTeam = player.team.trim();
          const verifiedTeam = verificationMap.get(player.name.toLowerCase().trim());

          if (verifiedTeam && dbTeam.toLowerCase() !== verifiedTeam.toLowerCase()) {
            mismatches.push({
              name: player.name,
              dbTeam: dbTeam,
              verifiedTeam: verifiedTeam
            });
            console.log(`❌ Mismatch found: ${player.name} (DB: "${dbTeam}" vs Real: "${verifiedTeam}")`);
          } else {
            console.log(`✅ Correct: ${player.name} -> "${dbTeam}"`);
          }
        });
      }
    } catch (err) {
      console.error(`❌ Failed to verify batch ${batchNum}: ${err.message}`);
    }

    if (i + BATCH_SIZE < players.length) {
      console.log("Sleeping for 12 seconds to respect RPM safety limits...");
      await sleep(12000);
    }
  }

  console.log("\n==============================================");
  console.log("             VERIFICATION COMPLETE            ");
  console.log("==============================================\n");

  if (mismatches.length === 0) {
    console.log("🎉 SUCCESS: All 100% of player-team mappings are correct!");
  } else {
    console.log(`Found ${mismatches.length} team mismatches:`);
    console.log(JSON.stringify(mismatches, null, 2));

    // Ask if they want us to update their players.json
    console.log("To automatically apply these corrections to your players.json, let Antigravity know!");
  }
}

verifyAllPlayerTeams().catch(console.error);
