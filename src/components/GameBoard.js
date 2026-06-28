import Card from "./Card.js";
import { getPlayerRole } from "../utils/gameRules.js";
import teamLogos from "../data/teamLogos.js";
import { calculatePOTM } from "../utils/cricketEngine.js";

const FALLBACK_LOGO = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23cc2200'/><path d='M50 5 Q70 30 70 50 Q70 70 50 95 Q30 70 30 50 Q30 30 50 5Z' fill='%23aa1100'/><path d='M5 50 Q30 30 50 30 Q70 30 95 50 Q70 70 50 70 Q30 70 5 50Z' fill='%23aa1100'/><path d='M50 5 Q70 30 70 50 Q70 70 50 95' stroke='%23f5e6c8' stroke-width='2' fill='none'/><path d='M5 50 Q30 30 50 30 Q70 30 95 50' stroke='%23f5e6c8' stroke-width='2' fill='none'/></svg>`;

function GameBoard({
    playerRef,
    playerCardRef,
    player,
    animate,
    winner,
    aiCardRef,
    drawRef,
    getMoveStyle,
    handleStatClick,
    selectedStat,
    turn,
    showPlayerCard,
    playerDeck,
    drawPile,
    aiRef,
    ai,
    showAiCard,
    aiDeck,
    isMultiplayerMode,
    turnTimerKey,
    isTimeoutActive,
    gameMode,
    playStyle,
    turnTimeout,
    pitchCondition,
    round,
    weather,
    moisture,
    playerSwapUsed,
    playerSwapsLeft,
    swapModalOpen,
    setSwapModalOpen,
    swapCandidates,
    swapAnnouncement,
    swapGraceActive,
    swapGraceTimeLeft,
    handleOpenPlayerSwap,
    executePlayerSwap,
    overAnnouncement,
    swapTimer,
    playerTeam,
    aiTeam,
    playerFranchisePool,
    superOverBanner,
    
    // Cricket Props
    battingTeam,
    currentInnings,
    targetScore,
    oversLimit,
    cricketScore,
    overHistory,
    isInningsBreak,
    startSecondInnings,
    overSummary
}) {

    // ✅ ADD THIS LINE
    if (!player || !ai) return <h2>Loading...</h2>;
    return (
        <div className="board">
            {/* Ambient Particle FX (Time & Battle Modes) */}
            {pitchCondition && weather && (
                <div className={`ambient-particles weather-${weather}`}>
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="particle" style={{ left: `${15 + i * 15}%`, animationDelay: `${i * 0.8}s` }} />
                    ))}
                </div>
            )}

            {/* PLAYER SIDE */}
            <div className="player-area" ref={playerRef}>
                <Card
                    ref={playerCardRef}
                    player={player}
                    type="player"
                    isMultiplayerMode={isMultiplayerMode}
                    turnTimerKey={turnTimerKey}
                    showTimeoutGlow={isTimeoutActive && turn === "player" && !swapGraceActive}
                    turnTimeout={9000}
                    style={
                        animate
                            ? winner === "ai"
                                ? getMoveStyle(playerRef, aiRef)
                                : winner === "draw"
                                    ? getMoveStyle(playerRef, drawRef)
                                    : {}
                            : {}
                    }
                    onStatClick={handleStatClick}
                    winner={winner}
                    selectedStat={selectedStat}
                    animate={animate}
                    turn={turn}
                    showCard={showPlayerCard}
                    gameMode={gameMode}
                    playStyle={playStyle}
                    pitchCondition={pitchCondition}
                    round={round}
                    weather={weather}
                    moisture={moisture}
                    swapGraceActive={swapGraceActive}
                />
                <p>{playStyle === "ai_vs_ai" ? `${playerTeam} Cards` : "Player 1 Cards"}: {playerDeck.length}</p>
                
                {/* Swap Button */}
                {!isMultiplayerMode && (
                    <div className="swap-button-container">
                        <button
                            className={`swap-btn ${playerSwapUsed ? 'used' : ''}`}
                            onClick={handleOpenPlayerSwap}
                            disabled={
                                playerSwapUsed || 
                                ((gameMode === "tournament" || gameMode === "team") 
                                    ? (playerDeck.length === 0 || (playerFranchisePool && playerFranchisePool.length === 0))
                                    : playerDeck.length < 2) || 
                                turn !== "player" || 
                                selectedStat !== null || 
                                animate ||
                                playStyle === "ai_vs_ai"
                            }
                        >
                            {playerSwapUsed 
                                ? "❌ No Swaps Left" 
                                : gameMode === "tournament"
                                    ? `🔄 Tactical Swap ×${playerSwapsLeft ?? 1}`
                                    : "🔄 Tactical Swap"
                            }
                        </button>
                    </div>
                )}
            </div>


            {/* DRAW PILE (CENTER) */}
            <div className="draw-area" ref={drawRef}>
                <p>Draw Pile: {drawPile.length}</p>

                <div className="draw-stack">
                    {drawPile.slice(-5).map((_, index) => (
                        <div key={index} className="draw-card"></div>
                    ))}
                </div>
            </div>


            {/* OPPONENT SIDE */}
            <div className="ai-area" ref={aiRef}>
                <Card
                    ref={aiCardRef}
                    player={ai}
                    type="ai"
                    isMultiplayerMode={isMultiplayerMode}
                    turnTimerKey={turnTimerKey}
                    showTimeoutGlow={isTimeoutActive && turn === "ai" && isMultiplayerMode && !swapGraceActive}
                    turnTimeout={9000}
                    style={
                        animate
                            ? winner === "player"
                                ? getMoveStyle(aiRef, playerRef)
                                : winner === "draw"
                                    ? getMoveStyle(aiRef, drawRef)
                                    : {}
                            : {}
                    }
                    onStatClick={handleStatClick}
                    winner={winner}
                    selectedStat={selectedStat}
                    animate={animate}
                    turn={turn}
                    showCard={showAiCard}
                    gameMode={gameMode}
                    playStyle={playStyle}
                    pitchCondition={pitchCondition}
                    round={round}
                    weather={weather}
                    moisture={moisture}
                    swapGraceActive={swapGraceActive}
                />
                <p>{playStyle === "ai_vs_ai" ? `${aiTeam} Cards` : (isMultiplayerMode ? "Player 2 Cards" : playStyle === "online" ? "Opponent Cards" : "AI Cards")}: {aiDeck.length}</p>
            </div>

            {/* Announcement Toast */}
            {swapAnnouncement && (
                <div className="swap-announcement-toast animate-slide-in">
                    <div className="toast-icon">🔄</div>
                    <div className="toast-content">{swapAnnouncement}</div>
                </div>
            )}

            {/* Over Announcement Toast */}
            {overAnnouncement && (
                <div className="over-announcement-toast animate-slide-in">
                    <div className="toast-icon">🏏</div>
                    <div className="toast-content">{overAnnouncement}</div>
                </div>
            )}

            {/* Tactical Swap Fullscreen Overlay Modal */}
            {swapModalOpen && (
                <div className="swap-modal-overlay">
                    <div className="swap-modal animate-scale-up">
                        <h2>🔄 Tactical Swap</h2>
                        <div className="swap-timer-badge animate-pulse-glow">
                            ⏱️ Swap Selection Ends in: <strong>{swapTimer}s</strong>
                        </div>
                        <p className="swap-subtitle">
                            Select one matchup-scored candidate below to replace your active card. 
                            The other card and your old card will be reshuffled back into your deck.
                        </p>
                        
                        <div className="swap-candidates-container">
                            {swapCandidates.map((candidate, idx) => {
                                const role = getPlayerRole(candidate);
                                const teamKey = candidate.team?.trim().toLowerCase();
                                const logo = teamLogos[teamKey] || FALLBACK_LOGO;
                                
                                return (
                                    <div 
                                        key={idx} 
                                        className="swap-candidate-card glass-card animate-hover-glow"
                                        onClick={() => executePlayerSwap(candidate)}
                                    >
                                        <div className="candidate-header">
                                            <img src={logo} alt="team-logo" className="candidate-logo" />
                                            <h3>{candidate.name}</h3>
                                            <span className="candidate-role-badge">{role.toUpperCase()}</span>
                                        </div>
                                        <div className="candidate-stats">
                                            {role === "batsman" ? (
                                                <>
                                                    <div>🏏 Runs: <strong>{candidate.runs}</strong></div>
                                                    <div>⚡ Bat SR: <strong>{candidate.battingSR}</strong></div>
                                                    <div>📈 Bat Avg: <strong>{candidate.battingAvg}</strong></div>
                                                </>
                                            ) : role === "pace" || role === "spinner" ? (
                                                <>
                                                    <div>🍒 Wkts: <strong>{candidate.wickets}</strong></div>
                                                    <div>🛡️ Econ: <strong>{candidate.economy}</strong></div>
                                                    <div>⚡ Bowl SR: <strong>{candidate.bowlingSR}</strong></div>
                                                </>
                                            ) : (
                                                <>
                                                    <div>🏏 Runs: <strong>{candidate.runs}</strong></div>
                                                    <div>🍒 Wkts: <strong>{candidate.wickets}</strong></div>
                                                    <div>🛡️ Econ: <strong>{candidate.economy}</strong></div>
                                                </>
                                            )}
                                        </div>
                                        <button className="select-candidate-btn">Swap In</button>
                                    </div>
                                );
                            })}
                        </div>
                        
                        <button className="close-swap-modal-btn" onClick={() => setSwapModalOpen(false)}>
                            Keep Current Card
                        </button>
                    </div>
                </div>
            )}

            {/* Super Over Fullscreen Overlay Modal */}
            {superOverBanner && (
                <div className="super-over-overlay">
                    <div className="super-over-banner">
                        <h1 className="super-over-title">SUPER OVER</h1>
                        <p className="super-over-subtitle">Get Ready for the Ultimate Tiebreaker!</p>
                    </div>
                </div>
            )}

            {/* Over Commentary Banner */}
            {overSummary && (
              <div className="over-summary-banner animate-slide-in" style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "rgba(0, 0, 0, 0.85)", border: "2px solid #ffd700", padding: "20px 40px", borderRadius: "16px", color: "#fff", zIndex: 1000, textAlign: "center", boxShadow: "0 0 20px rgba(255, 215, 0, 0.4)", display: "flex", flexDirection: "column", gap: "8px", minWidth: "300px" }}>
                <div style={{ fontSize: "11px", color: "#ffd700", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.2em" }}>🏏 OVER COMMENTARY</div>
                <p style={{ margin: 0, fontSize: "18px", fontWeight: "bold" }}>{overSummary}</p>
              </div>
            )}

            {/* Innings Break Screen Overlay */}
            {isInningsBreak && battingTeam && (
              <div className="innings-break-overlay animate-fade-in" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0, 0, 0, 0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 2000 }}>
                <div className="innings-break-card animate-scale-up glass-card" style={{ background: "rgba(20, 20, 20, 0.95)", border: "2px solid rgba(255, 215, 0, 0.3)", padding: "30px", borderRadius: "20px", maxWidth: "450px", width: "90%", color: "#fff", textAlign: "center", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
                  <div style={{ fontSize: "11px", color: "#ff4b2b", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "15px" }}>🔴 LIVE MATCH CENTRE</div>
                  <h2 style={{ margin: "0 0 10px 0", color: "#aaa" }}>🏏 End of Innings 1</h2>
                  
                  <div style={{ margin: "25px 0", padding: "15px", background: "rgba(255,255,255,0.03)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <h1 style={{ margin: "0 0 10px 0", color: "#ffd700" }}>{battingTeam === "player" ? playerTeam : aiTeam}</h1>
                    <div style={{ fontSize: "40px", fontWeight: "bold", letterSpacing: "1px" }}>
                      {cricketScore[battingTeam].runs} / {cricketScore[battingTeam].wickets}
                    </div>
                    <p style={{ margin: "10px 0 0 0", color: "#aaa", fontSize: "14px" }}>
                      Overs played: {cricketScore[battingTeam].oversCompleted} / {oversLimit} &nbsp;&bull;&nbsp; CRR: {(cricketScore[battingTeam].runs / (cricketScore[battingTeam].oversCompleted || 1)).toFixed(2)}
                    </p>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", gap: "15px", margin: "20px 0" }}>
                    <div style={{ flex: 1, padding: "10px", background: "rgba(0,0,0,0.4)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <span style={{ fontSize: "10px", color: "#aaa", textTransform: "uppercase" }}>Highest Over Runs</span>
                      <h3 style={{ margin: "5px 0 0 0", color: "#00cfff" }}>
                        {overHistory.reduce((max, o) => o.runs > max ? o.runs : max, 0)} Runs
                      </h3>
                    </div>
                    <div style={{ flex: 1, padding: "10px", background: "rgba(0,0,0,0.4)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <span style={{ fontSize: "10px", color: "#aaa", textTransform: "uppercase" }}>Top Performer</span>
                      <h3 style={{ margin: "5px 0 0 0", color: "#00ff88", fontSize: "14px", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }} title={calculatePOTM(overHistory)?.name || "N/A"}>
                        {calculatePOTM(overHistory)?.name || "N/A"}
                      </h3>
                    </div>
                  </div>

                  <div style={{ margin: "25px 0", padding: "15px", background: "rgba(255, 215, 0, 0.08)", borderRadius: "12px", border: "1px solid rgba(255, 215, 0, 0.2)" }}>
                    <span style={{ fontSize: "12px", color: "#ffd700", textTransform: "uppercase", fontWeight: "bold", letterSpacing: "0.1em" }}>REQUIRED TO WIN</span>
                    <div style={{ fontSize: "32px", fontWeight: "bold", margin: "5px 0", color: "#fff" }}>
                      {targetScore} Runs
                    </div>
                    <p style={{ margin: 0, color: "#aaa", fontSize: "13px" }}>
                      Required Run Rate: {(targetScore / oversLimit).toFixed(2)}
                    </p>
                  </div>

                  <button className="play-btn proceed-btn" style={{ width: "100%", padding: "15px", fontSize: "18px", background: "#ffd700", color: "#111", fontWeight: "bold", border: "none", borderRadius: "10px", cursor: "pointer" }} onClick={startSecondInnings}>
                    Start Run Chase 🏏
                  </button>
                </div>
              </div>
            )}

        </div>

    );
}

export default GameBoard;

