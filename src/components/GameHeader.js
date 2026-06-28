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
  aiTeam,
  
  // Cricket Props
  cricketScore,
  battingTeam,
  currentInnings,
  targetScore,
  oversLimit
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

        {/* Cricket Live Scorecard */}
        {gameMode === "team" && battingTeam && (
          <div className="cricket-scorecard-header animate-pop" style={{ background: "rgba(0,0,0,0.5)", padding: "15px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.15)", marginTop: "15px", color: "#fff", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center" }}>
              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: "11px", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.1em" }}>Batting Team</span>
                <h3 style={{ margin: "5px 0 0 0", color: "#ffd700" }}>{battingTeam === "player" ? playerTeam : aiTeam}</h3>
              </div>
              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: "11px", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.1em" }}>Score</span>
                <h1 style={{ margin: "5px 0 0 0", fontSize: "32px", fontWeight: "bold" }}>
                  {cricketScore[battingTeam].runs} / {cricketScore[battingTeam].wickets}
                </h1>
              </div>
              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: "11px", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.1em" }}>Overs</span>
                <h3 style={{ margin: "5px 0 0 0" }}>
                  {cricketScore[battingTeam].oversCompleted} / {oversLimit}
                </h3>
              </div>
              <div style={{ textAlign: "center" }}>
                <span style={{ fontSize: "11px", color: "#aaa", textTransform: "uppercase", letterSpacing: "0.1em" }}>CRR</span>
                <h3 style={{ margin: "5px 0 0 0", color: "#00aeff" }}>
                  {(cricketScore[battingTeam].runs / (cricketScore[battingTeam].oversCompleted || 1)).toFixed(2)}
                </h3>
              </div>
            </div>

            {currentInnings === 2 && targetScore && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: "10px", marginTop: "5px", fontSize: "13px" }}>
                <div>Target: <strong style={{ color: "#ffd700" }}>{targetScore}</strong></div>
                <div>Need <strong style={{ color: "#ff4b2b", fontSize: "15px" }}>{Math.max(0, targetScore - cricketScore[battingTeam].runs)}</strong> runs off <strong style={{ color: "#00aeff" }}>{(oversLimit - cricketScore[battingTeam].oversCompleted) * 6}</strong> balls</div>
                <div>
                  Required RR: <strong style={{ color: "#00cfff" }}>
                    {((targetScore - cricketScore[battingTeam].runs) / Math.max(0.1, oversLimit - cricketScore[battingTeam].oversCompleted)).toFixed(2)}
                  </strong>
                </div>
              </div>
            )}
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

        {gameMode === "tournament" && (
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