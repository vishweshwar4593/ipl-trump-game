import Card from "./Card.js";


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
    turnTimeout
}) {

    // ✅ ADD THIS LINE
    if (!player || !ai) return <h2>Loading...</h2>;
    return (
        <div className="board">

            {/* PLAYER SIDE */}
            <div className="player-area" ref={playerRef}>
                <Card
                    ref={playerCardRef}
                    player={player}
                    type="player"
                    isMultiplayerMode={isMultiplayerMode}
                    turnTimerKey={turnTimerKey}
                    showTimeoutGlow={isTimeoutActive && turn === "player"}
                    turnTimeout={turnTimeout}
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
                />
                <p>Player 1 Cards: {playerDeck.length}</p>
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
                    showTimeoutGlow={isTimeoutActive && turn === "ai" && isMultiplayerMode}
                    turnTimeout={turnTimeout}
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
                />
                <p>{isMultiplayerMode ? "Player 2 Cards" : playStyle === "online" ? "Opponent Cards" : "AI Cards"}: {aiDeck.length}</p>
            </div>

        </div>

    );
}

export default GameBoard;

