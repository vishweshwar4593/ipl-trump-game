import React, { useState, useEffect, useRef } from "react";
import teamLogos from "../data/teamLogos.js";
import { getPitchType } from "../utils/cricketEngine.js";

const FALLBACK_LOGO = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23cc2200'/><path d='M50 5 Q70 30 70 50 Q70 70 50 95 Q30 70 30 50 Q30 30 50 5Z' fill='%23aa1100'/><path d='M5 50 Q30 30 50 30 Q70 30 95 50 Q70 70 50 70 Q30 70 5 50Z' fill='%23aa1100'/><path d='M50 5 Q70 30 70 50 Q70 70 50 95' stroke='%23f5e6c8' stroke-width='2' fill='none'/><path d='M5 50 Q30 30 50 30 Q70 30 95 50' stroke='%23f5e6c8' stroke-width='2' fill='none'/></svg>`;

function TossScreen({
  playStyle,
  onlineRole,
  tossCaller,
  playerTeam,
  aiTeam,
  socket,
  onTossComplete,
  gameMode,
  matchIntensity
}) {
  const [phase, setPhase] = useState("guess"); // guess | spinning | result | done
  const [coinResult, setCoinResult] = useState(null);
  const [tossWinner, setTossWinner] = useState(null); // "player" | "ai"
  const [decision, setDecision] = useState(null); // "play" | "receive"
  const [timeLeft, setTimeLeft] = useState(10);

  const isOnline = playStyle === "online";
  const isCaller = !isOnline || onlineRole === tossCaller;

  const timerRef = useRef(null);

  // Initialize and run the 10-second timer for active phases
  useEffect(() => {
    // Timer only ticks if the local player has an action to take
    const requiresAction = 
      (phase === "guess" && isCaller) || 
      (phase === "result" && tossWinner === "player");

    if (!requiresAction) {
      setTimeLeft(10);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    setTimeLeft(10);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, tossWinner, isCaller]);

  // Handle Socket Events for Online Mode
  useEffect(() => {
    if (!isOnline || !socket) return;

    const onTossResult = (data) => {
      // data: { result: "heads" | "tails", winner: "creator" | "joiner" }
      setCoinResult(data.result);
      const won = data.winner === onlineRole;
      setTossWinner(won ? "player" : "ai");
      setPhase("spinning");

      // Stop spinning after 1.8 seconds animation
      setTimeout(() => {
        setPhase("result");
      }, 1800);
    };

    const onTossDecision = (data) => {
      // data: { decision: "play" | "receive" }
      setDecision(data.decision);
      // Brief delay before final callback
      setTimeout(() => {
        const turn = data.startingTurn; // sent by server when decision is processed
        onTossComplete(turn);
      }, 1500);
    };

    socket.on("tossResult", onTossResult);
    socket.on("tossDecisionBroadcast", onTossDecision);

    return () => {
      socket.off("tossResult", onTossResult);
      socket.off("tossDecisionBroadcast", onTossDecision);
    };
  }, [isOnline, socket, onlineRole, onTossComplete]);

  // If local player isn't caller in online mode, show waiting state
  useEffect(() => {
    if (isOnline && !isCaller && phase === "guess") {
      setPhase("guess"); // just stay in guess waiting phase
    }
  }, [isOnline, isCaller, phase]);

  const handleTimeout = () => {
    if (phase === "guess" && isCaller) {
      const autoGuess = Math.random() > 0.5 ? "heads" : "tails";
      handleGuess(autoGuess);
    } else if (phase === "result" && tossWinner === "player") {
      handleDecision(gameMode === "team" ? "bat" : "play");
    }
  };

  const handleGuess = (guess) => {
    if (isOnline) {
      // Online mode: Emits the guess to the server
      socket.emit("tossCall", { choice: guess });
    } else {
      // Offline mode: Simulate toss results locally
      const result = Math.floor(Math.random() * 2) === 0 ? "heads" : "tails";
      setCoinResult(result);
      const won = guess === result;
      console.log(`[Toss Screen] Offline toss guess: "${guess}" | Result: "${result}" | Player won: ${won}`);
      setTossWinner(won ? "player" : "ai");
      setPhase("spinning");

      setTimeout(() => {
        setPhase("result");
        // If AI won offline, let AI make a decision automatically
        if (!won) {
          const aiChoice = gameMode === "team"
            ? (Math.floor(Math.random() * 2) === 0 ? "bat" : "bowl")
            : (Math.floor(Math.random() * 2) === 0 ? "play" : "receive");
          setDecision(aiChoice);
        }
      }, 1800);
    }
  };

  const handleDecision = (choice) => {
    setDecision(choice);

    if (isOnline) {
      socket.emit("tossDecision", { decision: choice });
    } else {
      // For offline: trigger final callback after a brief delay
      setTimeout(() => {
        if (gameMode === "team") {
          const playerBatsFirst = (tossWinner === "player" && choice === "bat") || (tossWinner === "ai" && choice === "bowl");
          onTossComplete(playerBatsFirst ? "player" : "ai", choice);
        } else {
          let finalTurn = "player";
          if (tossWinner === "player") {
            finalTurn = choice === "play" ? "player" : "ai";
          } else {
            // AI won, decision tells us what AI wants to do
            finalTurn = decision === "play" ? "ai" : "player";
          }
          onTossComplete(finalTurn);
        }
      }, 1500);
    }
  };

  const handleAiProceed = () => {
    if (gameMode === "team") {
      const playerBatsFirst = decision === "bowl"; // AI bowl -> Player bat; AI bat -> AI bat
      onTossComplete(playerBatsFirst ? "player" : "ai", decision);
    } else {
      const finalTurn = decision === "play" ? "ai" : "player";
      onTossComplete(finalTurn);
    }
  };

  return (
    <div className="toss-screen-overlay">
      <div className="toss-container">
        {/* Header Section */}
        <h2 className="toss-title">🪙 Match Coin Toss</h2>

        {gameMode === "team" && matchIntensity && (
          <div className="pitch-info-badge animate-pulse-glow" style={{ margin: "10px auto", padding: "8px 16px", borderRadius: "20px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", width: "fit-content", fontWeight: "bold", color: "#ffd700", textAlign: "center" }}>
            🌱 Pitch Condition: <strong>{getPitchType(matchIntensity)}</strong>
          </div>
        )}
        
        <div className="toss-teams-row">
          <div className="toss-team">
            <img src={teamLogos[playerTeam.toLowerCase()] || FALLBACK_LOGO} alt={playerTeam} className="toss-logo" />
            <span>{playerTeam}</span>
          </div>
          <span className="toss-vs">VS</span>
          <div className="toss-team">
            <img src={teamLogos[aiTeam.toLowerCase()] || FALLBACK_LOGO} alt={aiTeam} className="toss-logo" />
            <span>{aiTeam}</span>
          </div>
        </div>

        <div className="toss-card">
          {/* Persistent Coin Wrapper to prevent remounting and allow smooth animations */}
          <div className="coin-wrapper">
            <div className={`coin ${
              phase === "spinning" 
                ? `spinning-${coinResult}` 
                : phase === "result" 
                  ? `landed-${coinResult}` 
                  : ""
            }`}>
              <div className="coin-face heads">🪙</div>
              <div className="coin-face tails">🏆</div>
            </div>
            <div className={`coin-shadow ${phase === "spinning" ? "animating" : ""}`}></div>
          </div>

          {/* Phase 1: Call Selection */}
          {phase === "guess" && (
            <>
              {isCaller ? (
                <>
                  <h3 className="toss-instructions">Select Heads or Tails</h3>
                  <div className="toss-timer-badge">⏱️ {timeLeft}s remaining</div>
                  <div className="toss-buttons-row">
                    <button className="toss-btn option-btn" onClick={() => handleGuess("heads")}>
                      🪙 Heads
                    </button>
                    <button className="toss-btn option-btn" onClick={() => handleGuess("tails")}>
                      🪙 Tails
                    </button>
                  </div>
                </>
              ) : (
                <div className="toss-waiting">
                  <div className="toss-spinner-ring"></div>
                  <p>Opponent is calling the toss...</p>
                </div>
              )}
            </>
          )}

          {/* Phase 2: Coin Flipping Status */}
          {phase === "spinning" && (
            <p className="toss-status-text">Flipping the coin...</p>
          )}

          {/* Phase 3: Outcome and Preference Decisions */}
          {phase === "result" && (
            <>
              <h4 className="toss-outcome-title">It's {coinResult?.toUpperCase()}!</h4>

              {tossWinner === "player" ? (
                decision ? (
                  <div className="toss-decision-announcement">
                    <p className="success-text">🎉 You won the toss!</p>
                    <p>You chose to <strong>{gameMode === "team" ? (decision === "bat" ? "Bat First 🏏" : "Bowl First 🍒") : (decision === "play" ? "Play First" : "Receive First")}</strong></p>
                  </div>
                ) : (
                  <>
                    <p className="success-text">🎉 You won the Toss! Choose your preference:</p>
                    <div className="toss-timer-badge">⏱️ {timeLeft}s remaining</div>
                    {gameMode === "team" ? (
                      <div className="toss-buttons-row">
                        <button className="toss-btn action-btn select-play-btn" onClick={() => handleDecision("bat")}>
                          🏏 Bat First
                        </button>
                        <button className="toss-btn action-btn select-receive-btn" onClick={() => handleDecision("bowl")}>
                          🍒 Bowl First
                        </button>
                      </div>
                    ) : (
                      <div className="toss-buttons-row">
                        <button className="toss-btn action-btn select-play-btn" onClick={() => handleDecision("play")}>
                          🏏 Play First
                        </button>
                        <button className="toss-btn action-btn select-receive-btn" onClick={() => handleDecision("receive")}>
                          🥎 Receive First
                        </button>
                      </div>
                    )}
                  </>
                )
              ) : (
                // AI or Opponent Won
                isOnline ? (
                  decision ? (
                    <div className="toss-decision-announcement">
                      <p className="error-text">😢 Opponent won the toss!</p>
                      <p>Opponent chose to <strong>{gameMode === "team" ? (decision === "bat" ? "Bat First" : "Bowl First") : (decision === "play" ? "Play First" : "Receive First")}</strong></p>
                    </div>
                  ) : (
                    <div className="toss-waiting">
                      <div className="toss-spinner-ring"></div>
                      <p>Opponent is choosing their preference...</p>
                    </div>
                  )
                ) : (
                  // Local AI Won
                  <div className="toss-decision-announcement">
                    <p className="error-text">😢 AI won the toss!</p>
                    <p>AI chose to <strong>{gameMode === "team" ? (decision === "bat" ? "Bat First" : "Bowl First") : (decision === "play" ? "Play First" : "Receive First")}</strong></p>
                    <button className="play-btn" style={{ marginTop: "20px" }} onClick={handleAiProceed}>
                      ⚡ Start Match
                    </button>
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default TossScreen;
