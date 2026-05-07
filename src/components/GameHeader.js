import { useAuth } from "../context/AuthContext";

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
  toggleMute,
  user
}) {
  const { logout } = useAuth();

  return (
    <>
      <button className="home-btn" onClick={handleHomeClick} style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 100, width: 'auto', padding: '10px 20px' }}>
        Home
      </button>

      {/* Mute button */}
      <button className="home-btn" onClick={toggleMute} style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 100, width: 'auto', padding: '10px', fontSize: '20px' }}>
        {isMuted ? "🔇" : "🔊"}
      </button>

      {/* User avatar chip */}
      {user ? (
        <div className="user-chip" title={`Signed in as ${user.displayName}`}>
          <img
            src={user.photoURL || "https://ui-avatars.com/api/?name=" + encodeURIComponent(user.displayName || "User") + "&background=ffd700&color=000"}
            alt="avatar"
            className="user-avatar"
          />
          <span className="user-name">{user.displayName?.split(" ")[0]}</span>
          <button className="user-logout-btn" onClick={logout} title="Sign out">⏏</button>
        </div>
      ) : (
        <div className="user-chip guest-chip">
          <span>👤 Guest</span>
        </div>
      )}

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