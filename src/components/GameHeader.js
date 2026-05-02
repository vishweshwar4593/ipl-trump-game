function GameHeader({
  round,
  isTimeMode,
  timeLeft,
  formatTime,
  isBattleMode,
  playerHP,
  aiHP,
  MAX_HP,
  handleHomeClick,
  turn,
  isMultiplayerMode,
  playStyle,
  onlineRole,
  isMuted,
  toggleMute
}) {
  return (
    <>

      <button className="home-btn" onClick={handleHomeClick} style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 100, width: 'auto', padding: '10px 20px' }}>
        Home
      </button>

      <button className="home-btn" onClick={toggleMute} style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 100, width: 'auto', padding: '10px', fontSize: '20px' }}>
        {isMuted ? "🔇" : "🔊"}
      </button>

      <div className="scoreboard">
        <h2>Round: {round}</h2>
        <h3>
          Turn:{" "}
          {playStyle === "online"
            ? (turn === "player" ? "You" : "Opponent")
            : turn === "player"
              ? "Player 1"
              : isMultiplayerMode
                ? "Player 2"
                : "AI"}
        </h3>

        {isTimeMode && (
          <h3 className={`timer ${timeLeft <= 30 ? "danger" : ""}`}>
            ⏱ Time Left: {formatTime(timeLeft)}
          </h3>
        )}

        {isBattleMode && (
          <div className="hp-container">
            <div className="hp-bar">
              <div
                className={`hp-fill player ${(playerHP / MAX_HP) < 0.25 ? 'low' : ''}`}
                style={{ width: `${(playerHP / MAX_HP) * 100}%` }}
              ></div>
            </div>
            <p>{isMultiplayerMode ? "🧑 Player 1" : "❤️ Player"}: {Math.round(playerHP)}</p>

            <div className="hp-bar">
              <div
                className={`hp-fill ai ${(aiHP / MAX_HP) < 0.25 ? 'low' : ''}`}
                style={{ width: `${(aiHP / MAX_HP) * 100}%` }}
              ></div>
            </div>
            <p>{isMultiplayerMode ? "🧑 Player 2" : "🤖 AI"}: {Math.round(aiHP)}</p>
          </div>
        )}


      </div>

    </>

  );
}

export default GameHeader;