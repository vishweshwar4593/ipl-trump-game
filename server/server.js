const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const players = require("./players.json"); // ✅ local copy, safe for deployment
const { initCron } = require("./cronScheduler");

const app = express();
const server = http.createServer(app);

// ✅ FIX: Restrict CORS to the deployed frontend URL.
// Set ALLOWED_ORIGIN env var on Render. Falls back to localhost for local dev.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "http://localhost:3000";

const io = new Server(server, {
    cors: {
        origin: ALLOWED_ORIGIN,
        methods: ["GET", "POST"]
    }
});

// ✅ FIX: Health-check route so Render doesn't mark the server as unhealthy
app.get("/", (req, res) => res.send("IPL Trump Server OK"));

// ✅ FIX: Allowlist of valid stat keys — rejects any fabricated stat from clients
const VALID_STATS = [
    "runs", "matches", "hs", "battingAvg", "battingSR",
    "hundreds", "fifties", "wickets", "economy",
    "bowlingAvg", "bowlingSR", "catches"
];

const rooms = {};     // roomId → [socketId1, socketId2]
const roomModes = {}; // tracks whether a room is "classic", "time", or "team"
const roomTeams = {}; // tracks { creatorTeam, joinerTeam }
const socketRoomCount = {}; // socketId → number of rooms created
const activeUsers = {}; // tracks username -> socket.id to prevent concurrent logins
const MAX_ROOMS_PER_SOCKET = 5;

// Helper: cleanly remove a room and all associated metadata
function deleteRoom(roomId) {
    delete rooms[roomId];
    delete roomModes[roomId];
    delete roomTeams[roomId];
    console.log(`Room ${roomId} deleted (empty)`);
}

// Helper: deal decks to both players once both teams are known
function dealDecks(roomId) {
    const gameMode = roomModes[roomId];
    const { creatorTeam, joinerTeam } = roomTeams[roomId] || {};

    let deck1, deck2;
    if (gameMode === "team" && creatorTeam && joinerTeam) {
        deck1 = players.filter(p => p.team === creatorTeam);
        deck2 = players.filter(p => p.team === joinerTeam);
    } else {
        const shuffled = [...players].sort(() => Math.random() - 0.5);
        const half = Math.floor(shuffled.length / 2);
        deck1 = shuffled.slice(0, half);
        deck2 = shuffled.slice(half);
    }

    // Creator gets deck1, their own team context
    io.to(rooms[roomId][0]).emit("startGame", {
        role: "creator",
        playerDeck: deck1,
        aiDeck: deck2,
        gameMode,
        playerTeam: creatorTeam || null,
        aiTeam: joinerTeam || null,
    });

    // Joiner gets deck2, mirrored team context
    io.to(rooms[roomId][1]).emit("startGame", {
        role: "joiner",
        playerDeck: deck2,
        aiDeck: deck1,
        gameMode,
        playerTeam: joinerTeam || null,
        aiTeam: creatorTeam || null,
    });

    console.log(`Game started in room ${roomId} | mode: ${gameMode} | ${creatorTeam} vs ${joinerTeam}`);
}

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // ────────────────────────────────────
    // USER REGISTRATION (Concurrent Login Prevention)
    // ────────────────────────────────────
    socket.on("registerUser", (username) => {
        // If this username is already active on a different socket, reject it
        if (activeUsers[username] && activeUsers[username] !== socket.id) {
            console.log(`[Security] Concurrent login attempt for ${username}. Rejecting socket ${socket.id}`);
            socket.emit("loginConflict");
        } else {
            // Register this socket as the active device for the user
            activeUsers[username] = socket.id;
            socket.username = username; // attach to socket for cleanup on disconnect
        }
    });

    // ────────────────────────────────────
    // CREATE ROOM
    // ────────────────────────────────────
    socket.on("createRoom", (data) => {
        // ✅ FIX: Rate-limit room creation per socket to prevent memory exhaustion DoS
        if (socketRoomCount[socket.id] >= MAX_ROOMS_PER_SOCKET) {
            socket.emit("errorMessage", "Too many rooms created. Please refresh and try again.");
            return;
        }

        // Guarantee unique room codes
        let roomId;
        do {
            roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        } while (rooms[roomId]);

        rooms[roomId] = [socket.id];
        roomModes[roomId] = data?.gameMode || "classic";
        roomTeams[roomId] = { creatorTeam: null, joinerTeam: null };
        socketRoomCount[socket.id] = (socketRoomCount[socket.id] || 0) + 1;

        socket.join(roomId);
        socket.emit("roomCreated", roomId);
        console.log(`Room created: ${roomId} | mode: ${data?.gameMode}`);
    });

    // ────────────────────────────────────
    // CREATOR SELECTS TEAM (after room creation, inside waiting room)
    // ────────────────────────────────────
    socket.on("creatorSelectTeam", ({ roomId, team }) => {
        if (!rooms[roomId] || !roomTeams[roomId]) return;
        roomTeams[roomId].creatorTeam = team;
        console.log(`Room ${roomId}: creator picked team "${team}"`);

        // If joiner already joined and is waiting → notify them now
        if (rooms[roomId].length === 2) {
            io.to(rooms[roomId][1]).emit("teamSelectRequired", { creatorTeam: team });
        }
    });

    // ────────────────────────────────────
    // JOIN ROOM
    // ────────────────────────────────────
    socket.on("joinRoom", (roomId) => {
        if (rooms[roomId] && rooms[roomId].length === 1) {
            rooms[roomId].push(socket.id);
            socket.join(roomId);

            const gameMode = roomModes[roomId];

            if (gameMode === "team") {
                const creatorTeam = roomTeams[roomId]?.creatorTeam;
                if (creatorTeam) {
                    // Creator already picked — joiner can pick now
                    socket.emit("teamSelectRequired", { creatorTeam });
                } else {
                    // Creator hasn't picked yet — joiner waits
                    socket.emit("waitingForCreatorTeam");
                }
            } else {
                // Non-team modes: deal immediately
                dealDecks(roomId);
            }

            console.log(`Room joined: ${roomId}`);
        } else {
            socket.emit("errorMessage", "Room not found or full");
        }
    });

    // ────────────────────────────────────
    // JOINER SELECTS TEAM
    // ────────────────────────────────────
    socket.on("joinerSelectTeam", ({ roomId, joinerTeam }) => {
        if (!rooms[roomId] || !roomTeams[roomId]) return;
        roomTeams[roomId].joinerTeam = joinerTeam;
        console.log(`Room ${roomId}: joiner picked team "${joinerTeam}"`);
        dealDecks(roomId);
    });

    // ────────────────────────────────────
    // STAT PLAY (relay to opponent)
    // ────────────────────────────────────
    socket.on("playStat", ({ roomId, stat }) => {
        // ✅ FIX: Validate stat against allowlist before relaying.
        // Prevents cheating clients from injecting fake/invalid stat strings.
        if (!VALID_STATS.includes(stat)) {
            console.warn(`[Security] Invalid stat "${stat}" from socket ${socket.id} — rejected.`);
            return;
        }
        socket.to(roomId).emit("bothPlayed", stat);
    });

    // ────────────────────────────────────
    // EMOTES / CHAT
    // ────────────────────────────────────
    socket.on("sendEmote", ({ roomId, emote }) => {
        // Broadcast the emote to the opponent in the same room
        socket.to(roomId).emit("receiveEmote", emote);
    });

    // ────────────────────────────────────
    // DISCONNECT
    // ────────────────────────────────────
    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);

        // Remove from active users map
        if (socket.username && activeUsers[socket.username] === socket.id) {
            delete activeUsers[socket.username];
        }

        // ✅ FIX: Collect affected roomIds first, then process them.
        // Previously the loop mutated `rooms` while iterating it, creating a
        // race condition when two sockets disconnected simultaneously.
        const affectedRooms = Object.keys(rooms).filter(
            roomId => rooms[roomId] && rooms[roomId].includes(socket.id)
        );

        affectedRooms.forEach(roomId => {
            if (!rooms[roomId]) return; // already cleaned up by a parallel disconnect

            rooms[roomId] = rooms[roomId].filter(id => id !== socket.id);

            if (rooms[roomId].length > 0) {
                // Notify remaining player(s) that their opponent left
                io.to(roomId).emit("playerLeft");
            } else {
                // Room is now empty — clean up all associated state atomically
                deleteRoom(roomId);
            }
        });

        // Clean up rate-limit counter
        delete socketRoomCount[socket.id];
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    // Start the automatic stats updater cron job
    initCron();
});