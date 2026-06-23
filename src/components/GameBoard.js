import Card from "./Card.js";
import { getPlayerRole } from "../hooks/useGameEngine.js";
import teamLogos from "../data/teamLogos.js";

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
    playerFranchisePool
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

        </div>

    );
}

export default GameBoard;

