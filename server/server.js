const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const players = require("./players.json"); // ✅ local copy, safe for deployment
const { initCron } = require("./cronScheduler");

// Initialize Firebase Admin SDK
const admin = require("firebase-admin");
let firebaseAdminReady = false;

if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            })
        });
        firebaseAdminReady = true;
        console.log("[Firebase Admin] Initialized successfully using environment variables.");
    } catch (err) {
        console.error("[Firebase Admin] Initialization failed:", err.message);
    }
} else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
        admin.initializeApp({
            credential: admin.credential.applicationDefault()
        });
        firebaseAdminReady = true;
        console.log("[Firebase Admin] Initialized successfully using GOOGLE_APPLICATION_CREDENTIALS.");
    } catch (err) {
        console.error("[Firebase Admin] Initialization failed from credentials file:", err.message);
    }
} else {
    if (process.env.NODE_ENV === "production") {
        console.error("[Firebase Admin] FATAL: Firebase credentials are missing in production! Crashing start.");
        process.exit(1);
    } else {
        console.warn("[Firebase Admin] WARNING: Firebase credentials not found. Running in development fallback mode.");
    }
}

const app = express();
const server = http.createServer(app);

// ✅ FIX: Restrict CORS to the deployed frontend URL.
// Set ALLOWED_ORIGIN env var on Render. Falls back to localhost for local dev.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "http://localhost:3000";
const isProd = process.env.NODE_ENV === "production";

const io = new Server(server, {
    cors: {
        origin: isProd ? ALLOWED_ORIGIN : "*",
        methods: ["GET", "POST"]
    }
});

// ✅ FIX: Health-check route so Render doesn't mark the server as unhealthy
app.get("/", (req, res) => res.send("IPL Trump Server OK"));

const VALID_STATS = [
    "runs", "matches", "hs", "battingAvg", "battingSR",
    "hundreds", "fifties", "wickets", "economy",
    "bowlingAvg", "bowlingSR", "catches"
];

const battingStats = ["runs", "matches", "hs", "battingAvg", "battingSR", "hundreds", "fifties", "catches"];
const bowlingStats = ["wickets", "economy", "bowlingAvg", "bowlingSR"];

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

const SPINNERS = [
  "yuzvendra chahal", "rashid khan", "sunil narine", "ravichandran ashwin", 
  "amit mishra", "piyush chawla", "harbhajan singh", "imran tahir", 
  "krunal pandya", "ravindra jadeja", "axar patel", "varun chakravarthy", 
  "kuldeep yadav", "maheesh theekshana", "murugan ashwin", "karn sharma",
  "k gowtham", "krishnappa gowtham", "lalit yadav", "mark watt", "shakib al hasan"
];

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

function getModifiedStat(playerCard, statKey, pitchCondition, weather, moisture, gameMode) {
  if (!playerCard) return 0;
  const originalValue = playerCard[statKey] ?? 0;
  if (gameMode !== "time" && gameMode !== "battle") return originalValue;
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

function transitionWeather(game) {
  if (game.gameMode !== "time" && game.gameMode !== "battle") return;
  const prevWeather = game.weather || "sunny";
  const nextWeather = getNextWeather(prevWeather, game.round);
  
  let change = 0;
  if (prevWeather === "sunny") {
    change = -(10 + Math.floor(Math.random() * 9));
  } else if (prevWeather === "windy") {
    change = -(5 + Math.floor(Math.random() * 8));
  } else if (prevWeather === "cloudy") {
    change = -(1 + Math.floor(Math.random() * 4));
  } else if (prevWeather === "dew") {
    change = 6 + Math.floor(Math.random() * 9);
  }
  
  const baseMoisture = game.moisture ?? 70;
  const nextMoisture = Math.min(Math.max(baseMoisture + change, 0), 100);
  const nextPitch = nextMoisture >= 75 ? "green" : nextMoisture >= 50 ? "balanced" : nextMoisture >= 25 ? "dry" : "dusty";
  
  game.weather = nextWeather;
  game.moisture = nextMoisture;
  game.pitchCondition = nextPitch;
}

function getRoundStage(round) {
  const x = Math.sin(round * 724.3) * 10000;
  const rand = x - Math.floor(x);
  if (rand < 0.33) return "powerplay";
  if (rand < 0.66) return "middle";
  return "death";
}

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

const rooms = {};     // roomId → [socketId1, socketId2]
const roomModes = {}; // tracks whether a room is "classic", "time", or "team"
const roomDeckLimits = {}; // tracks roomId -> deckLimit for tournament
const roomTeams = {}; // tracks { creatorTeam, joinerTeam }
const socketRoomCount = {}; // socketId → number of rooms created
const activeUsers = {}; // tracks uid -> socket.id to prevent concurrent logins
const MAX_ROOMS_PER_SOCKET = 5;

const games = {}; // roomId -> gameState

function deleteRoom(roomId) {
    delete rooms[roomId];
    delete roomModes[roomId];
    delete roomDeckLimits[roomId];
    delete roomTeams[roomId];
    const game = games[roomId];
    if (game && game.disconnectTimeout) {
        clearTimeout(game.disconnectTimeout);
    }
    delete games[roomId];
    console.log(`Room ${roomId} deleted (empty)`);
}

function maskDeck(deck, revealTopCard) {
    if (!deck || deck.length === 0) return [];
    return deck.map((card, index) => {
        if (index === 0) {
            return revealTopCard ? card : { name: "Hidden Card" };
        }
        return {};
    });
}

function maskReserve(reserve) {
    if (!reserve) return [];
    return reserve.map(() => ({}));
}

function emitGameStateUpdate(roomId) {
    const game = games[roomId];
    if (!game) return;

    const creatorSocketId = rooms[roomId][0];
    const joinerSocketId = rooms[roomId][1];

    const creatorGameOver = game.creatorDeck.length === 0 || game.joinerDeck.length === 0 || (game.gameMode === "battle" && (game.creatorHP <= 0 || game.joinerHP <= 0));
    const joinerGameOver = creatorGameOver;

    if (creatorSocketId) {
        io.to(creatorSocketId).emit("gameStateUpdate", {
            playerDeck: game.creatorDeck,
            aiDeck: maskDeck(game.joinerDeck, game.isResolving),
            playerFranchisePool: game.creatorReserve,
            aiFranchisePool: maskReserve(game.joinerReserve),
            playerHP: game.creatorHP,
            aiHP: game.joinerHP,
            turn: game.turn === "creator" ? "player" : "ai",
            round: game.round,
            consecutiveTurns: game.consecutiveTurns,
            drawPile: game.drawPile,
            weather: game.weather,
            moisture: game.moisture,
            pitchCondition: game.pitchCondition,
            gameOver: creatorGameOver,
            playerSwapUsed: game.creatorSwapUsed,
            aiSwapUsed: game.joinerSwapUsed,
        });
    }

    if (joinerSocketId) {
        io.to(joinerSocketId).emit("gameStateUpdate", {
            playerDeck: game.joinerDeck,
            aiDeck: maskDeck(game.creatorDeck, game.isResolving),
            playerFranchisePool: game.joinerReserve,
            aiFranchisePool: maskReserve(game.creatorReserve),
            playerHP: game.joinerHP,
            aiHP: game.creatorHP,
            turn: game.turn === "joiner" ? "player" : "ai",
            round: game.round,
            consecutiveTurns: game.consecutiveTurns,
            drawPile: game.drawPile,
            weather: game.weather,
            moisture: game.moisture,
            pitchCondition: game.pitchCondition,
            gameOver: joinerGameOver,
            playerSwapUsed: game.joinerSwapUsed,
            aiSwapUsed: game.creatorSwapUsed,
        });
    }
}

function dealDecks(roomId) {
    const gameMode = roomModes[roomId];
    const { creatorTeam, joinerTeam } = roomTeams[roomId] || {};

    let deck1, deck2;
    if ((gameMode === "team" || gameMode === "tournament") && creatorTeam && joinerTeam) {
        deck1 = shuffle(players.filter(p => p.team === creatorTeam));
        deck2 = shuffle(players.filter(p => p.team === joinerTeam));
    } else {
        const shuffled = shuffle(players);
        const half = Math.floor(shuffled.length / 2);
        deck1 = shuffled.slice(0, half);
        deck2 = shuffled.slice(half);
    }

    let creatorDeck = deck1;
    let joinerDeck = deck2;
    let creatorReserve = [];
    let joinerReserve = [];

    if (gameMode === "tournament") {
        const deckLimit = roomDeckLimits[roomId] || 7;
        creatorDeck = deck1.slice(0, deckLimit);
        creatorReserve = deck1.slice(deckLimit);
        joinerDeck = deck2.slice(0, deckLimit);
        joinerReserve = deck2.slice(deckLimit);
    }

    const turn = Math.random() > 0.5 ? "creator" : "joiner";

    let weather = null;
    let moisture = null;
    let pitchCondition = null;
    if (gameMode === "time" || gameMode === "battle") {
        const initialWeathers = ["sunny", "cloudy", "windy"];
        weather = initialWeathers[Math.floor(Math.random() * initialWeathers.length)];
        moisture = weather === "sunny" ? 60 : weather === "windy" ? 70 : 85;
        pitchCondition = moisture >= 75 ? "green" : moisture >= 50 ? "balanced" : moisture >= 25 ? "dry" : "dusty";
    }

    const creatorSocket = io.sockets.sockets.get(rooms[roomId][0]);
    const joinerSocket = io.sockets.sockets.get(rooms[roomId][1]);
    const creatorUid = creatorSocket ? creatorSocket.uid : null;
    const joinerUid = joinerSocket ? joinerSocket.uid : null;

    games[roomId] = {
        creatorDeck,
        joinerDeck,
        creatorReserve,
        joinerReserve,
        creatorHP: 500,
        joinerHP: 500,
        turn,
        round: 1,
        consecutiveTurns: 1,
        drawPile: [],
        weather,
        moisture,
        pitchCondition,
        isResolving: false,
        gameMode,
        creatorTeam,
        joinerTeam,
        creatorSwapUsed: false,
        joinerSwapUsed: false,
        creatorDisconnected: false,
        joinerDisconnected: false,
        disconnectTimeout: null,
        creatorUid,
        joinerUid,
    };

    io.to(rooms[roomId][0]).emit("startGame", {
        role: "creator",
        playerDeck: creatorDeck,
        aiDeck: maskDeck(joinerDeck, false),
        gameMode,
        playerTeam: creatorTeam || null,
        aiTeam: joinerTeam || null,
        initialWeather: weather,
        initialMoisture: moisture,
        initialPitchCondition: pitchCondition,
        startingTurn: turn === "creator" ? "player" : "ai",
    });

    io.to(rooms[roomId][1]).emit("startGame", {
        role: "joiner",
        playerDeck: joinerDeck,
        aiDeck: maskDeck(creatorDeck, false),
        gameMode,
        playerTeam: joinerTeam || null,
        aiTeam: creatorTeam || null,
        initialWeather: weather,
        initialMoisture: moisture,
        initialPitchCondition: pitchCondition,
        startingTurn: turn === "joiner" ? "player" : "ai",
    });

    console.log(`Game started in room ${roomId} | mode: ${gameMode} | ${creatorTeam} vs ${joinerTeam}`);
}

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("registerUser", async (data) => {
        if (!data || typeof data !== "object") return;
        const { uid, displayName, token } = data;
        if (!uid || !displayName) return;

        let verifiedUid = uid;

        if (token) {
            if (firebaseAdminReady) {
                try {
                    const decodedToken = await admin.auth().verifyIdToken(token);
                    verifiedUid = decodedToken.uid;
                } catch (err) {
                    console.error(`[Security] ID Token verification failed for ${displayName}:`, err.message);
                    socket.emit("errorMessage", "Session verification failed. Please log in again.");
                    return;
                }
            } else {
                if (process.env.NODE_ENV === "production") {
                    console.error(`[Security] Token verification requested in production, but Firebase Admin is not initialized!`);
                    socket.emit("errorMessage", "Server security misconfiguration. Please contact support.");
                    return;
                } else {
                    console.warn(`[Security] Development bypass: trusting UID ${uid} because Firebase Admin is not ready.`);
                }
            }
        } else {
            // Guest session validation
            if (!uid.startsWith("guest_")) {
                console.error(`[Security] Unauthenticated user ${displayName} attempted to register with non-guest UID ${uid}`);
                socket.emit("errorMessage", "Invalid session UID");
                return;
            }
        }

        if (activeUsers[verifiedUid] && activeUsers[verifiedUid] !== socket.id) {
            const oldSocketId = activeUsers[verifiedUid];
            const oldSocket = io.sockets.sockets.get(oldSocketId);
            if (oldSocket) {
                console.log(`[Security] Kicking old session for ${displayName} (${verifiedUid}) in favor of new socket ${socket.id}`);
                oldSocket.emit("loginConflict");
                oldSocket.disconnect(true);
            }
        }
        activeUsers[verifiedUid] = socket.id;
        socket.uid = verifiedUid;
        socket.username = displayName;
        console.log(`User registered: ${displayName} (${verifiedUid})`);
    });

    socket.on("createRoom", (data) => {
        if (socketRoomCount[socket.id] >= MAX_ROOMS_PER_SOCKET) {
            socket.emit("errorMessage", "Too many rooms created. Please refresh and try again.");
            return;
        }

        let roomId;
        do {
            roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        } while (rooms[roomId]);

        rooms[roomId] = [socket.id];
        roomModes[roomId] = data?.gameMode || "classic";
        roomDeckLimits[roomId] = data?.deckLimit || 7;
        roomTeams[roomId] = { creatorTeam: null, joinerTeam: null };
        socketRoomCount[socket.id] = (socketRoomCount[socket.id] || 0) + 1;

        socket.join(roomId);
        socket.emit("roomCreated", roomId);
        console.log(`Room created: ${roomId} | mode: ${data?.gameMode}`);
    });

    socket.on("creatorSelectTeam", ({ roomId, team }) => {
        if (!rooms[roomId] || !roomTeams[roomId]) return;
        if (rooms[roomId][0] !== socket.id) return; // Verify sender is creator
        if (games[roomId]) return; // Game already started
        roomTeams[roomId].creatorTeam = team;
        console.log(`Room ${roomId}: creator picked team "${team}"`);

        if (rooms[roomId].length === 2) {
            io.to(rooms[roomId][1]).emit("teamSelectRequired", { creatorTeam: team });
        }
    });

    socket.on("joinRoom", (data) => {
        const roomId = typeof data === "string" ? data : data?.roomId;
        const deckLimit = typeof data === "string" ? 7 : data?.deckLimit;

        if (rooms[roomId] && rooms[roomId].length === 1) {
            rooms[roomId].push(socket.id);
            socket.join(roomId);

            roomDeckLimits[roomId] = deckLimit;
            const gameMode = roomModes[roomId];

            if (gameMode === "team") {
                const creatorTeam = roomTeams[roomId]?.creatorTeam;
                if (creatorTeam) {
                    socket.emit("teamSelectRequired", { creatorTeam });
                } else {
                    socket.emit("waitingForCreatorTeam");
                }
            } else {
                dealDecks(roomId);
            }

            console.log(`Room joined: ${roomId}`);
        } else {
            socket.emit("errorMessage", "Room not found or full");
        }
    });

    socket.on("joinerSelectTeam", ({ roomId, joinerTeam }) => {
        if (!rooms[roomId] || !roomTeams[roomId]) return;
        if (rooms[roomId][1] !== socket.id) return; // Verify sender is joiner
        if (games[roomId]) return; // Game already started
        roomTeams[roomId].joinerTeam = joinerTeam;
        console.log(`Room ${roomId}: joiner picked team "${joinerTeam}"`);
        dealDecks(roomId);
    });

    socket.on("playStat", ({ roomId, stat, roundNumber }) => {
        const game = games[roomId];
        if (!game) return;

        // State and role validations
        if (game.isResolving) return;
        if (game.creatorDeck.length === 0 || game.joinerDeck.length === 0) return;
        if (game.gameMode === "battle" && (game.creatorHP <= 0 || game.joinerHP <= 0)) return;
        if (roundNumber !== game.round) return;

        const socketIndex = rooms[roomId].indexOf(socket.id);
        if (socketIndex === -1) return;
        const playerRole = socketIndex === 0 ? "creator" : "joiner";
        if (game.turn !== playerRole) return;

        if (game.gameMode === "team" || game.gameMode === "tournament") {
            const stage = getRoundStage(game.round);
            const isPowerplay = stage === "powerplay";
            const isMiddle = stage === "middle";
            const isDeath = stage === "death";
            
            const isBatting = battingStats.includes(stat);
            const isBowling = bowlingStats.includes(stat);
            const isUtility = stat === "matches" || stat === "catches";

            if (isPowerplay && !isBatting) return;
            if (isMiddle && !isUtility) return;
            if (isDeath && !isBowling) return;
        } else {
            if (!VALID_STATS.includes(stat)) return;
        }

        game.isResolving = true;

        const creatorCard = game.creatorDeck[0];
        const joinerCard = game.joinerDeck[0];
        const creatorSocketId = rooms[roomId][0];
        const joinerSocketId = rooms[roomId][1];

        const playerValue = getModifiedStat(creatorCard, stat, game.pitchCondition, game.weather, game.moisture, game.gameMode);
        const aiValue = getModifiedStat(joinerCard, stat, game.pitchCondition, game.weather, game.moisture, game.gameMode);
        
        let result;
        if (["economy", "bowlingAvg", "bowlingSR"].includes(stat)) {
            if (playerValue === 0 && aiValue > 0) result = "joiner";
            else if (aiValue === 0 && playerValue > 0) result = "creator";
            else if (playerValue === 0 && aiValue === 0) result = "draw";
            else {
                if (playerValue < aiValue) result = "creator";
                else if (aiValue < playerValue) result = "joiner";
                else result = "draw";
            }
        } else {
            if (playerValue > aiValue) result = "creator";
            else if (aiValue > playerValue) result = "joiner";
            else result = "draw";
        }

        let damage = 0;
        if (game.gameMode === "battle" && playerValue !== undefined && aiValue !== undefined) {
            const maxVal = Math.max(playerValue, aiValue, 1);
            const diff = Math.abs(playerValue - aiValue) / maxVal;
            const weight = STAT_WEIGHTS[stat] || 1;
            damage = Math.max(Math.round(diff * 100 * weight), 8);
        }

        if (creatorSocketId) {
            io.to(creatorSocketId).emit("roundResolutionStart", {
                stat,
                opponentCard: joinerCard,
                result: result === "creator" ? "player" : result === "joiner" ? "ai" : "draw",
                damage
            });
        }
        if (joinerSocketId) {
            io.to(joinerSocketId).emit("roundResolutionStart", {
                stat,
                opponentCard: creatorCard,
                result: result === "joiner" ? "player" : result === "creator" ? "ai" : "draw",
                damage
            });
        }

        const originalCreatorCard = game.creatorDeck[0];
        const originalJoinerCard = game.joinerDeck[0];

        if (result === "creator") {
            if (game.gameMode === "battle") game.joinerHP = Math.max(game.joinerHP - damage, 0);
            if (game.gameMode === "team" || game.gameMode === "tournament") {
                game.creatorDeck = [...game.creatorDeck.slice(1), originalCreatorCard];
            } else {
                game.creatorDeck = [...game.creatorDeck.slice(1), originalCreatorCard, originalJoinerCard, ...game.drawPile];
            }
            game.joinerDeck = game.joinerDeck.slice(1);
            game.drawPile = [];
        } else if (result === "joiner") {
            if (game.gameMode === "battle") game.creatorHP = Math.max(game.creatorHP - damage, 0);
            if (game.gameMode === "team" || game.gameMode === "tournament") {
                game.joinerDeck = [...game.joinerDeck.slice(1), originalJoinerCard];
            } else {
                game.joinerDeck = [...game.joinerDeck.slice(1), originalJoinerCard, originalCreatorCard, ...game.drawPile];
            }
            game.creatorDeck = game.creatorDeck.slice(1);
            game.drawPile = [];
        } else {
            if (game.gameMode === "team" || game.gameMode === "tournament") {
                game.drawPile = [];
            } else {
                game.drawPile = shuffle([...game.drawPile, originalCreatorCard, originalJoinerCard]);
            }
            game.creatorDeck = game.creatorDeck.slice(1);
            game.joinerDeck = game.joinerDeck.slice(1);
        }

        let nominalNextTurn = game.turn;
        if (result === "creator") nominalNextTurn = "creator";
        else if (result === "joiner") nominalNextTurn = "joiner";

        if (nominalNextTurn === game.turn) {
            if (game.consecutiveTurns >= 3) {
                game.turn = game.turn === "creator" ? "joiner" : "creator";
                game.consecutiveTurns = 1;
            } else {
                game.consecutiveTurns += 1;
            }
        } else {
            game.turn = nominalNextTurn;
            game.consecutiveTurns = 1;
        }

        game.round += 1;
        transitionWeather(game);

        setTimeout(() => {
            game.isResolving = false;
            emitGameStateUpdate(roomId);
        }, 2200);
    });

    socket.on("playerSwapped", ({ roomId, selectedCandidate }) => {
        const game = games[roomId];
        if (!game) return;

        if (game.isResolving) return;
        if (game.creatorDeck.length === 0 || game.joinerDeck.length === 0) return;
        if (game.gameMode === "battle" && (game.creatorHP <= 0 || game.joinerHP <= 0)) return;

        const socketIndex = rooms[roomId].indexOf(socket.id);
        if (socketIndex === -1) return;
        const playerRole = socketIndex === 0 ? "creator" : "joiner";
        if (game.turn !== playerRole) return;

        const isCreator = playerRole === "creator";
        if (isCreator && game.creatorSwapUsed) return;
        if (!isCreator && game.joinerSwapUsed) return;

        const reserve = isCreator ? game.creatorReserve : game.joinerReserve;
        const candidate = reserve.find(c => c.name === selectedCandidate.name);
        if (!candidate) return; // Verify selected card is in their reserve pool

        if (isCreator) {
            const currentActive = game.creatorDeck[0];
            game.creatorReserve = game.creatorReserve.filter(c => c.name !== candidate.name);
            if (game.gameMode === "team" || game.gameMode === "tournament") {
                game.creatorDeck = [candidate, ...game.creatorDeck.slice(1)];
            } else {
                const unselected = game.creatorReserve.find(c => c.name !== candidate.name);
                const remaining = game.creatorDeck.slice(1).filter(c => c.name !== candidate.name && c.name !== (unselected ? unselected.name : ""));
                game.creatorDeck = [candidate, ...shuffle([...remaining, currentActive, unselected].filter(Boolean))];
            }
            game.creatorSwapUsed = true;
        } else {
            const currentActive = game.joinerDeck[0];
            game.joinerReserve = game.joinerReserve.filter(c => c.name !== candidate.name);
            if (game.gameMode === "team" || game.gameMode === "tournament") {
                game.joinerDeck = [candidate, ...game.joinerDeck.slice(1)];
            } else {
                const unselected = game.joinerReserve.find(c => c.name !== candidate.name);
                const remaining = game.joinerDeck.slice(1).filter(c => c.name !== candidate.name && c.name !== (unselected ? unselected.name : ""));
                game.joinerDeck = [candidate, ...shuffle([...remaining, currentActive, unselected].filter(Boolean))];
            }
            game.joinerSwapUsed = true;
        }

        io.to(roomId).emit("opponentSwapped", candidate);
        emitGameStateUpdate(roomId);
    });

    socket.on("reconnectRoom", async (data) => {
        if (!data || typeof data !== "object") return;
        const { roomId, uid, displayName, token } = data;
        const game = games[roomId];
        if (!game) {
            socket.emit("errorMessage", "Game session expired or not found");
            return;
        }

        let verifiedUid = uid;

        if (token) {
            if (firebaseAdminReady) {
                try {
                    const decodedToken = await admin.auth().verifyIdToken(token);
                    verifiedUid = decodedToken.uid;
                } catch (err) {
                    console.error(`[Security] ID Token verification failed for reconnecting user ${displayName}:`, err.message);
                    socket.emit("errorMessage", "Reconnect verification failed.");
                    return;
                }
            } else {
                if (process.env.NODE_ENV === "production") {
                    console.error(`[Security] Token verification requested on reconnect in production, but Firebase Admin is not initialized!`);
                    socket.emit("errorMessage", "Security configuration error");
                    return;
                }
            }
        } else {
            // Guest session
            if (!uid.startsWith("guest_")) {
                socket.emit("errorMessage", "Invalid reconnect UID");
                return;
            }
        }

        let role = null;
        if (game.creatorUid === verifiedUid) {
            role = "creator";
            rooms[roomId][0] = socket.id;
        } else if (game.joinerUid === verifiedUid) {
            role = "joiner";
            rooms[roomId][1] = socket.id;
        } else {
            console.warn(`[Security] Unauthorized reconnect attempt by ${displayName} (${verifiedUid}) in room ${roomId}`);
            socket.emit("errorMessage", "Unauthorized room access");
            return;
        }

        socket.uid = verifiedUid;
        socket.username = displayName;
        activeUsers[verifiedUid] = socket.id;

        socket.join(roomId);
        if (role === "creator") {
            game.creatorDisconnected = false;
        } else {
            game.joinerDisconnected = false;
        }

        if (!game.creatorDisconnected && !game.joinerDisconnected) {
            if (game.disconnectTimeout) {
                clearTimeout(game.disconnectTimeout);
                game.disconnectTimeout = null;
            }
            io.to(roomId).emit("opponentReconnected", { playerRole: role });
        }

        socket.emit("startGame", {
            role,
            playerDeck: role === "creator" ? game.creatorDeck : game.joinerDeck,
            aiDeck: maskDeck(role === "creator" ? game.joinerDeck : game.creatorDeck, false),
            gameMode: game.gameMode,
            playerTeam: role === "creator" ? game.creatorTeam : game.joinerTeam,
            aiTeam: role === "creator" ? game.joinerTeam : game.creatorTeam,
            isReconnect: true
        });

        emitGameStateUpdate(roomId);
        console.log(`User reconnected: ${displayName} (${verifiedUid}) in room ${roomId} as ${role}`);
    });

    socket.on("sendEmote", ({ roomId, emote }) => {
        if (!rooms[roomId]) return;
        if (!rooms[roomId].includes(socket.id)) return;
        socket.to(roomId).emit("receiveEmote", emote);
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);

        if (socket.uid && activeUsers[socket.uid] === socket.id) {
            delete activeUsers[socket.uid];
        }

        const affectedRooms = Object.keys(rooms).filter(
            roomId => rooms[roomId] && rooms[roomId].includes(socket.id)
        );

        affectedRooms.forEach(roomId => {
            if (!rooms[roomId]) return;

            const socketIndex = rooms[roomId].indexOf(socket.id);
            const playerRole = socketIndex === 0 ? "creator" : "joiner";
            const game = games[roomId];

            if (game) {
                if (playerRole === "creator") {
                    game.creatorDisconnected = true;
                } else {
                    game.joinerDisconnected = true;
                }

                socket.to(roomId).emit("opponentDisconnected", {
                    playerRole,
                    timeLeft: 45
                });

                if (game.disconnectTimeout) {
                    clearTimeout(game.disconnectTimeout);
                }
                game.disconnectTimeout = setTimeout(() => {
                    io.to(roomId).emit("playerLeft");
                    deleteRoom(roomId);
                }, 45000);
            } else {
                rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);
                if (rooms[roomId].length === 0) {
                    deleteRoom(roomId);
                } else {
                    io.to(roomId).emit("playerLeft");
                }
            }
        });

        delete socketRoomCount[socket.id];
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    // Start the automatic stats updater cron job
    initCron();
});