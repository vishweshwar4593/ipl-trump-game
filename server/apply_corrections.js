const fs = require("fs");
const path = require("path");

const SERVER_PLAYERS_PATH = path.join(__dirname, "players.json");
const FRONTEND_PLAYERS_PATH = path.join(__dirname, "../src/data/players.json");

const corrections = [
  {
    "name": "Shardul Thakur",
    "verifiedTeam": "Chennai Super Kings"
  },
  {
    "name": "Washington Sundar",
    "verifiedTeam": "Gujarat Titans"
  },
  {
    "name": "Devdutt Padikkal",
    "verifiedTeam": "Royal Challengers Bengaluru"
  },
  {
    "name": "T Natarajan",
    "verifiedTeam": "Sunrisers Hyderabad"
  },
  {
    "name": "Mukesh Kumar",
    "verifiedTeam": "Chennai Super Kings"
  },
  {
    "name": "Marcus Stoinis",
    "verifiedTeam": "Punjab Kings"
  },
  {
    "name": "Aiden Markram",
    "verifiedTeam": "Sunrisers Hyderabad"
  },
  {
    "name": "Avesh Khan",
    "verifiedTeam": "Lucknow Super Giants"
  },
  {
    "name": "Deepak Hooda",
    "verifiedTeam": "Rajasthan Royals"
  },
  {
    "name": "Faf du Plessis",
    "verifiedTeam": "Delhi Capitals"
  },
  {
    "name": "Kagiso Rabada",
    "verifiedTeam": "Gujarat Titans"
  },
  {
    "name": "Liam Livingstone",
    "verifiedTeam": "Royal Challengers Bengaluru"
  },
  {
    "name": "Mohammad Shami",
    "verifiedTeam": "Sunrisers Hyderabad"
  },
  {
    "name": "Prasidh Krishna",
    "verifiedTeam": "Rajasthan Royals"
  },
  {
    "name": "Quinton de Kock",
    "verifiedTeam": "Lucknow Super Giants"
  },
  {
    "name": "Rahul Tripathi",
    "verifiedTeam": "Sunrisers Hyderabad"
  },
  {
    "name": "Tushar Deshpande",
    "verifiedTeam": "Rajasthan Royals"
  },
  {
    "name": "Tim David",
    "verifiedTeam": "Royal Challengers Bengaluru"
  },
  {
    "name": "Venkatesh Iyer",
    "verifiedTeam": "Royal Challengers Bengaluru"
  },
  {
    "name": "Wanindu Hasaranga",
    "verifiedTeam": "Sunrisers Hyderabad"
  }
];

function applyCorrections() {
  console.log("Applying team corrections to player databases...");
  
  if (!fs.existsSync(SERVER_PLAYERS_PATH)) {
    console.error("Error: players.json not found!");
    return;
  }
  
  const players = JSON.parse(fs.readFileSync(SERVER_PLAYERS_PATH, "utf8"));
  const correctionsMap = new Map();
  corrections.forEach(c => correctionsMap.set(c.name.toLowerCase().trim(), c.verifiedTeam));
  
  let updatedCount = 0;
  players.forEach(player => {
    const key = player.name.toLowerCase().trim();
    if (correctionsMap.has(key)) {
      const oldTeam = player.team;
      const newTeam = correctionsMap.get(key);
      player.team = newTeam;
      console.log(`Updated ${player.name}: "${oldTeam}" -> "${newTeam}"`);
      updatedCount++;
    }
  });
  
  const outputJson = JSON.stringify(players, null, 2);
  fs.writeFileSync(SERVER_PLAYERS_PATH, outputJson, "utf8");
  console.log(`Successfully updated ${SERVER_PLAYERS_PATH}`);
  
  if (fs.existsSync(path.dirname(FRONTEND_PLAYERS_PATH))) {
    fs.writeFileSync(FRONTEND_PLAYERS_PATH, outputJson, "utf8");
    console.log(`Successfully updated ${FRONTEND_PLAYERS_PATH}`);
  }
  
  console.log(`\n🎉 Success! Applied all 20 dynamic team corrections.`);
}

applyCorrections();
