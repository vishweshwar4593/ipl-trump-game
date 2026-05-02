import { useState, useEffect } from "react";
import socket from "../socket";

function OnlineMode({
    gameMode,
    setGameMode,
    setPlayStyle,
    setIsOnlineGameStarted,
    setPlayerDeck,
    setAiDeck,
    setOnlineRole,
    setPlayerTeam,
    setAiTeam,
    teams = [],
}) {
    const isTeamMode = gameMode === "team";

// Shared state
    const [roomId, setRoomId] = useState("");
    const [isRoomCreated, setIsRoomCreated] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [socketError, setSocketError] = useState(null); // ✅ FIX: surface connection errors
    const [isCreatingRoom, setIsCreatingRoom] = useState(false); // Loading state for room creation

    // ✅ FIX: Listen for socket connection errors dispatched by socket.js
    useEffect(() => {
        const onSocketError = (e) => setSocketError(e.detail || "Could not connect to server");
        const onSocketOk = () => setSocketError(null);
        window.addEventListener("socket:connect_error", onSocketError);
        socket.on("connect", onSocketOk);
        return () => {
            window.removeEventListener("socket:connect_error", onSocketError);
            socket.off("connect", onSocketOk);
        };
    }, []);




    // Team-mode: creator flow
    const [creatorTeamPicked, setCreatorTeamPicked] = useState(null); // null = not picked yet
    const [creatorTeamConfirmed, setCreatorTeamConfirmed] = useState(false); // true after emit

    // Team-mode: joiner flow
    const [joinerPickingTeam, setJoinerPickingTeam] = useState(false);
    const [joinerWaitingForCreator, setJoinerWaitingForCreator] = useState(false);
    const [opponentTeam, setOpponentTeam] = useState(null); // creator's team, received by joiner

    // ✅ FIX: Joiner confirm step — mirrors creator UX, prevents mis-click game starts
    const [joinerTeamPicked, setJoinerTeamPicked] = useState(null);
    const [joinerTeamConfirmed, setJoinerTeamConfirmed] = useState(false);

// ── Socket listeners ────────────────────────────────────────────────────
    useEffect(() => {
        // Create handlers as named functions so we can properly remove them
        const handleRoomCreated = (id) => {
            setRoomId(id);
            setIsRoomCreated(true);
            localStorage.setItem("roomId", id);
        };

        const handleStartGame = (data) => {
            localStorage.setItem("playerDeck", JSON.stringify(data.playerDeck));
            localStorage.setItem("aiDeck", JSON.stringify(data.aiDeck));
            if (data.gameMode) setGameMode(data.gameMode);
            if (data.role) setOnlineRole(data.role);
            if (data.playerTeam) setPlayerTeam(data.playerTeam);
            if (data.aiTeam) setAiTeam(data.aiTeam);
            setPlayerDeck(data.playerDeck);
            setAiDeck(data.aiDeck);
            setIsOnlineGameStarted(true);
        };

        // Use socket.on() instead of socket.once() for reliability
        // We'll remove listeners in cleanup function
        socket.on("roomCreated", handleRoomCreated);
        socket.on("startGame", handleStartGame);

        // Joiner receives this when they should pick a team
        // "on" is correct here — it may need to re-fire if the state resets
        const onTeamSelectRequired = ({ creatorTeam }) => {
            setOpponentTeam(creatorTeam);
            setJoinerPickingTeam(true);
            setJoinerWaitingForCreator(false);
            setJoinerTeamPicked(null);   // reset any previous pick
            setJoinerTeamConfirmed(false);
        };
        socket.on("teamSelectRequired", onTeamSelectRequired);

        // Joiner receives this when creator hasn't picked yet
        const onWaitingForCreatorTeam = () => {
            setJoinerWaitingForCreator(true);
        };
        socket.on("waitingForCreatorTeam", onWaitingForCreatorTeam);

        const onErrorMessage = (msg) => {
            alert(msg);
        };
        socket.on("errorMessage", onErrorMessage);

        return () => {
            socket.off("roomCreated");
            socket.off("startGame");
            socket.off("teamSelectRequired", onTeamSelectRequired);
            socket.off("waitingForCreatorTeam", onWaitingForCreatorTeam);
            socket.off("errorMessage", onErrorMessage);
        };
    }, [setPlayerDeck, setAiDeck, setIsOnlineGameStarted, setGameMode, setOnlineRole, setPlayerTeam, setAiTeam]);

// ── Actions ─────────────────────────────────────────────────────────────
    const handleCreateRoom = () => {
        // Check if socket is connected
        if (!socket.connected) {
            alert("Cannot connect to server. Please make sure the server is running!");
            return;
        }
        
        // Show loading feedback
        setIsCreatingRoom(true);
        
        // Set a timeout to show error if no response
        const timeout = setTimeout(() => {
            setIsCreatingRoom(false);
            if (!isRoomCreated) {
                alert("Room creation timed out. Please try again or check if server is running.");
            }
        }, 5000);
        
        // Store timeout in ref to clear it later
        handleCreateRoom.timeout = timeout;
        socket.emit("createRoom", { gameMode });
    };
    
    // Clear timeout when room is created
    useEffect(() => {
        if (isRoomCreated && handleCreateRoom.timeout) {
            clearTimeout(handleCreateRoom.timeout);
            setIsCreatingRoom(false);
        }
    }, [isRoomCreated]);

    const handleCreatorConfirmTeam = () => {
        if (!creatorTeamPicked) return;
        const id = localStorage.getItem("roomId") || roomId;
        socket.emit("creatorSelectTeam", { roomId: id, team: creatorTeamPicked });
        setCreatorTeamConfirmed(true);
    };

    const handleJoinRoom = () => {
        if (!roomId.trim()) {
            alert("Enter Room Code");
            return;
        }
        socket.emit("joinRoom", roomId.trim().toUpperCase());
        localStorage.setItem("roomId", roomId.trim().toUpperCase());
    };

    // ✅ FIX: Split into pick + confirm (was immediate emit on click)
    const handleJoinerPickTeam = (team) => {
        setJoinerTeamPicked(team);
    };

    const handleJoinerConfirmTeam = () => {
        if (!joinerTeamPicked) return;
        const id = localStorage.getItem("roomId") || roomId;
        socket.emit("joinerSelectTeam", { roomId: id, joinerTeam: joinerTeamPicked });
        setJoinerTeamConfirmed(true);
    };

    const copyToClipboard = () => {
        if (roomId) {
            navigator.clipboard.writeText(roomId);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }
    };

    // ── Joiner: waiting for creator to pick team ─────────────────────────────
    if (joinerWaitingForCreator) {
        return (
            <div className="home">
                <div className="home-container">
                    <h1 style={{ fontSize: 30, marginBottom: 20 }}>⏳ Please Wait</h1>
                    <div className="waiting-room-card">
                        <div className="spinner-container" style={{ marginTop: 10 }}>
                            <div className="waiting-spinner" />
                        </div>
                        <p className="waiting-text" style={{ marginTop: 16, fontSize: 17 }}>
                            Waiting for the room creator to pick their team…
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // ── Joiner: pick from remaining teams ────────────────────────────────────
    if (joinerPickingTeam) {
        return (
            <div className="home">
                <div className="home-container">
                    <h1 style={{ fontSize: 28, marginBottom: 4 }}>🏏 Pick Your Team</h1>
                    <p style={{ color: "#aaa", marginBottom: 20 }}>
                        Opponent chose <strong style={{ color: "#ffd700" }}>{opponentTeam}</strong>
                    </p>
                    <div className="team-buttons">
                        {teams
                            .filter(t => t !== opponentTeam)
                            .map(team => (
                                <button
                                    key={team}
                                    className="home-btn"
                                    onClick={() => handleJoinerPickTeam(team)}
                                    style={{
                                        minWidth: 160,
                                        background: joinerTeamPicked === team
                                            ? "linear-gradient(135deg, #39ff88, #00cc66)"
                                            : undefined,
                                        color: joinerTeamPicked === team ? "#000" : undefined,
                                        border: joinerTeamPicked === team
                                            ? "2px solid #39ff88"
                                            : undefined,
                                    }}
                                    disabled={joinerTeamConfirmed}
                                >
                                    {team}
                                </button>
                            ))}
                    </div>

                    {/* ✅ FIX: Confirm button — joiner must confirm, no accidental immediate start */}
                    {joinerTeamPicked && !joinerTeamConfirmed && (
                        <button
                            className="home-btn"
                            onClick={handleJoinerConfirmTeam}
                            style={{ marginTop: 18, width: "100%", maxWidth: 260 }}
                        >
                            ✅ Confirm — {joinerTeamPicked}
                        </button>
                    )}

                    {joinerTeamConfirmed && (
                        <div style={{ marginTop: 20 }}>
                            <p style={{ color: "#39ff88", fontWeight: "bold", marginBottom: 8 }}>
                                Your team: {joinerTeamPicked} ✔
                            </p>
                            <div className="spinner-container" style={{ marginTop: 10 }}>
                                <div className="waiting-spinner" />
                            </div>
                            <p className="waiting-text" style={{ marginTop: 12 }}>Starting game…</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ── Creator: waiting room (with team picker if team mode) ────────────────
    if (isRoomCreated) {
        return (
            <div className="home">
                <div className="home-container">
                    <h1 style={{ textTransform: "capitalize", fontSize: 36, marginBottom: 24 }}>
                        Room Created! <span style={{ display: "inline-block", transform: "rotate(15deg)" }}>🎉</span>
                    </h1>

                    <div className="waiting-room-card">
                        <p className="share-text">Share this code with your friend</p>

                        <div className="room-code-glow">{roomId.split("").join(" ")}</div>

                        <button className="copy-code-btn" onClick={copyToClipboard}>
                            {isCopied ? "📋 COPIED! ✔" : "📋 COPY CODE"}
                        </button>

                        {/* ── Team mode: creator picks team while waiting ── */}
                        {isTeamMode && !creatorTeamConfirmed && (
                            <div style={{ marginTop: 24, width: "100%" }}>
                                <p style={{ color: "#9aa0a6", marginBottom: 14, fontSize: 15 }}>
                                    Pick your team while you wait:
                                </p>
                                <div className="team-buttons" style={{ justifyContent: "center", gap: 10 }}>
                                    {teams.map(team => (
                                        <button
                                            key={team}
                                            className="home-btn"
                                            onClick={() => setCreatorTeamPicked(team)}
                                            style={{
                                                minWidth: 140,
                                                fontSize: 13,
                                                padding: "10px 14px",
                                                background: creatorTeamPicked === team
                                                    ? "linear-gradient(135deg, #39ff88, #00cc66)"
                                                    : undefined,
                                                color: creatorTeamPicked === team ? "#000" : undefined,
                                                border: creatorTeamPicked === team
                                                    ? "2px solid #39ff88"
                                                    : undefined,
                                            }}
                                        >
                                            {team}
                                        </button>
                                    ))}
                                </div>

                                {creatorTeamPicked && (
                                    <button
                                        className="home-btn"
                                        onClick={handleCreatorConfirmTeam}
                                        style={{ marginTop: 18, width: "100%", maxWidth: 260 }}
                                    >
                                        ✅ Confirm — {creatorTeamPicked}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* ── Team mode: confirmed, now truly waiting ── */}
                        {isTeamMode && creatorTeamConfirmed && (
                            <div style={{ marginTop: 20 }}>
                                <p style={{ color: "#39ff88", fontWeight: "bold", marginBottom: 8 }}>
                                    Your team: {creatorTeamPicked} ✔
                                </p>
                            </div>
                        )}

                        {/* Spinner — non-team always; team only after team confirmed */}
                        {(!isTeamMode || creatorTeamConfirmed) && (
                            <>
                                <div className="spinner-container" style={{ marginTop: 24 }}>
                                    <div className="waiting-spinner" />
                                </div>
                                <p className="waiting-text">Waiting for opponent to join…</p>
                            </>
                        )}
                    </div>

                    <button
                        className="home-btn secondary"
                        onClick={() => { setIsRoomCreated(false); setRoomId(""); setCreatorTeamPicked(null); setCreatorTeamConfirmed(false); }}
                        style={{ marginTop: 30 }}
                    >
                        ← BACK
                    </button>
                </div>
            </div>
        );
    }

// ── Default: Create / Join screen ────────────────────────────────────────
    return (
        <div className="home">
            <div className="home-container">
                <h1 style={{ textTransform: "capitalize" }}>🌐 {gameMode || "Online"} Mode</h1>
                
                {/* Show socket error if any */}
                {socketError && (
                    <div style={{ 
                        background: "rgba(255, 60, 60, 0.2)", 
                        border: "1px solid #ff3c3c",
                        borderRadius: "12px", 
                        padding: "15px", 
                        marginBottom: "20px",
                        color: "#ff6b6b"
                    }}>
                        ⚠️ {socketError}
                        <br/>
                        <small style={{ color: "#aaa" }}>Make sure the server is running on port 5000</small>
                    </div>
                )}

<button 
                    className="home-btn" 
                    onClick={handleCreateRoom}
                    disabled={isCreatingRoom}
                    style={{ 
                        opacity: isCreatingRoom ? 0.7 : 1,
                        minWidth: "200px",
                        cursor: isCreatingRoom ? "wait" : "pointer"
                    }}
                >
                    {isCreatingRoom ? (
                        <>⏳ Creating Room...</>
                    ) : (
                        "Create Room"
                    )}
                </button>
                
                <input
                    type="text"
                    placeholder="Enter Room Code"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                    style={{
                        padding: "12px",
                        borderRadius: "12px",
                        margin: "10px",
                        width: "240px",
                        fontSize: "18px",
                        textAlign: "center",
                        border: "2px solid rgba(255, 255, 255, 0.2)",
                        background: "rgba(0,0,0,0.5)",
                        color: "white",
                        outline: "none",
                        letterSpacing: "3px",
                    }}
                />

                <button className="home-btn" onClick={handleJoinRoom}>
                    Join Room
                </button>

                <button
                    className="home-btn secondary"
                    onClick={() => { setGameMode(null); setPlayStyle(null); }}
                >
                    Back
                </button>
            </div>
        </div>
    );
}

export default OnlineMode;