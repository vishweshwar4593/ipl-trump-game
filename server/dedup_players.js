const fs = require("fs");
const path = require("path");

const SERVER_PLAYERS_PATH = path.join(__dirname, "players.json");
const FRONTEND_PLAYERS_PATH = path.join(__dirname, "../src/data/players.json");

function dedupPlayers() {
  console.log("Checking for duplicate players in database...");
  
  if (!fs.existsSync(SERVER_PLAYERS_PATH)) {
    console.error("Error: players.json not found!");
    return;
  }
  
  const players = JSON.parse(fs.readFileSync(SERVER_PLAYERS_PATH, "utf8"));
  console.log(`Current player count: ${players.length}`);
  
  const seenNames = new Map();
  const dedupedList = [];
  let duplicatesCount = 0;
  
  for (const player of players) {
    const nameKey = player.name.trim().toLowerCase();
    if (seenNames.has(nameKey)) {
      duplicatesCount++;
      const existing = seenNames.get(nameKey);
      console.log(`❌ Duplicate found: "${player.name}"`);
      console.log(`   - Existing entry team: "${existing.team}" (Matches: ${existing.matches})`);
      console.log(`   - Duplicate entry team: "${player.team}" (Matches: ${player.matches})`);
      
      // If the duplicate has more matches, we keep it instead of the existing one
      if ((player.matches || 0) > (existing.matches || 0)) {
        seenNames.set(nameKey, player);
      }
    } else {
      seenNames.set(nameKey, player);
    }
  }
  
  const finalPlayersList = Array.from(seenNames.values());
  console.log(`\nScan complete:`);
  console.log(`* Duplicates found & resolved: ${duplicatesCount}`);
  console.log(`* Final unique players count: ${finalPlayersList.length}`);
  
  if (duplicatesCount > 0) {
    const outputJson = JSON.stringify(finalPlayersList, null, 2);
    fs.writeFileSync(SERVER_PLAYERS_PATH, outputJson, "utf8");
    console.log(`Successfully updated ${SERVER_PLAYERS_PATH}`);
    
    if (fs.existsSync(path.dirname(FRONTEND_PLAYERS_PATH))) {
      fs.writeFileSync(FRONTEND_PLAYERS_PATH, outputJson, "utf8");
      console.log(`Successfully updated ${FRONTEND_PLAYERS_PATH}`);
    }
    console.log("🎉 Parity synced successfully to frontend!");
  } else {
    console.log("🎉 Perfect! No duplicate player entries found in players.json.");
  }
}

dedupPlayers();
