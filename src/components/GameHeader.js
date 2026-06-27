import { useAuth } from "../context/AuthContext";
import { getRoundStage } from "../utils/gameRules";

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
  isMuted,
  toggleMute,
  user,
  gameMode,
  pitchCondition,
  weather,
  moisture,
  playerTeam,
  aiTeam
}) {
  // logout is available if needed in future; mid-game we route through handleHomeClick
  const { logout } = useAuth(); // eslint-disable-line no-unused-vars

  return (
    <>
      <div className="game-header-actions" style={{ position: 'absolute', top: '10px', left: '10px', right: '10px', display: 'flex', justifyContent: 'space-between', zIndex: 100, pointerEvents: 'none', boxSizing: 'border-box' }}>
        <button 
          className="home-btn" 
          onClick={handleHomeClick} 
          style={{ pointerEvents: 'auto', width: 'auto', padding: '10px 20px' }}
        >
          Home
        </button>

        <div style={{ display: 'flex', gap: '10px', pointerEvents: 'auto' }}>
          {/* Fullscreen button */}
          <button 
            className="home-btn fullscreen-btn" 
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => {
                  console.log("Error enabling fullscreen:", err);
                });
              } else {
                document.exitFullscreen();
              }
            }} 
            style={{ width: 'auto', padding: '10px', fontSize: '20px' }}
            title="Toggle Fullscreen"
          >
            📺
          </button>

          {/* Mute button */}
          <button 
            className="home-btn" 
            onClick={toggleMute} 
            style={{ width: 'auto', padding: '10px', fontSize: '20px' }}
          >
            {isMuted ? "🔇" : "🔊"}
          </button>
        </div>
      </div>



      <div className="scoreboard">
        <h2>Round: {round}</h2>
        <h3>
          Turn:{" "}
          {playStyle === "ai_vs_ai"
            ? (turn === "player" ? playerTeam : aiTeam)
            : playStyle === "online"
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

        {/* Tactical Feature Banners */}
        {(gameMode === "time" || gameMode === "battle") && pitchCondition && (
          <div className="pitch-banner glass-banner animate-pop" style={{ borderRadius: '50px', padding: '8px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 'bold' }}>
              <span>Weather: {weather === "sunny" ? "Sunny ☀" : weather === "cloudy" ? "Cloudy 🌧" : weather === "windy" ? "Windy 💨" : "Heavy Dew 🌫"}</span>
              <span style={{ opacity: 0.3 }}>|</span>
              <span>Moisture: {moisture}% ({moisture >= 75 ? "Wet" : moisture >= 50 ? "Fresh" : moisture >= 25 ? "Dry" : "Cracked"})</span>
              <span style={{ opacity: 0.3 }}>|</span>
              <span>Pitch: {pitchCondition === "green" ? "Fresh Green 🟢" : pitchCondition === "balanced" ? "Balanced 🟡" : pitchCondition === "dry" ? "Dry Surface 🟠" : "Cracked Dusty 🔴"}</span>
            </div>
          </div>
        )}

        {(gameMode === "team" || gameMode === "tournament") && (
          <div className="phase-banner glass-banner animate-pop">
            {(getRoundStage(round) === "powerplay") && (
              <span style={{ color: "#ffd700" }}>⚡ Powerplay: Batting Stats Only</span>
            )}
            {(getRoundStage(round) === "middle") && (
              <span style={{ color: "#00aeff" }}>🌀 Middle Overs: Matches & Catches Only</span>
            )}
            {(getRoundStage(round) === "death") && (
              <span style={{ color: "#ff4b2b" }}>💀 Death Overs: Bowling Stats Only</span>
            )}
          </div>
        )}
      </div>

    </>

  );
}

export default GameHeader;