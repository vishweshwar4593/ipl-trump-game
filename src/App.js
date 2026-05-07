import players from "./data/players.json";
import { useState, useEffect, useRef } from "react";
import classicBg from "./assets/classic-bg.png";
import battleBg from "./assets/battle-bg.png";
import timeBg from "./assets/time-bg.png";
import HomeScreen from "./components/HomeScreen";
import TeamMode from "./modes/TeamMode";
import TimeMode from "./modes/TimeMode";
import ResultScreen from "./components/ResultScreen";
import GameHeader from "./components/GameHeader";
import GameBoard from "./components/GameBoard";
import OnlineMode from "./modes/OnlineMode";
import LoginScreen from "./components/LoginScreen";
import socket from "./socket";
import { useGameAudio } from "./hooks/useGameAudio";
import { useGameEngine } from "./hooks/useGameEngine";
import { useAuth } from "./context/AuthContext";


export const STAT_WEIGHTS = {
  runs: 0.85,
  matches: 0.75,
  hs: 0.8,
  battingAvg: 1.15,
  battingSR: 1.2,
  hundreds: 1.1,
  fifties: 1.0,
  wickets: 0.95,
  economy: 1.5,
  bowlingAvg: 1.4,
  bowlingSR: 1.35,
  catches: 1.0
};

function App() {
  const { isMuted, toggleMute, playClick, playWin, playLose, playHit } = useGameAudio();
  const { user, logout } = useAuth();
  const [isGuest, setIsGuest] = useState(false);

  const handleSignOut = async () => {
    await logout();
    setIsGuest(false);
    setGameMode(null);
    setPlayStyle(null);
    setGameOver(false);
    setIsOnlineGameStarted(false);
    setPlayerTeam(null);
    setAiTeam(null);
    setResumedGameState(null);
    setOnlineRole(null);
    localStorage.removeItem("savedGameState");
  };

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [gameMode, setGameMode] = useState(null);
  const [playStyle, setPlayStyle] = useState(null);
  const [onlineRole, setOnlineRole] = useState(null);
  const [isOnlineGameStarted, setIsOnlineGameStarted] = useState(false);
  const isTimeMode = gameMode === "time";
  const [timeLeft, setTimeLeft] = useState(120);
  const [selectedTime, setSelectedTime] = useState(null);
  const [rulesMode, setRulesMode] = useState(null);
  const [playerTeam, setPlayerTeam] = useState(null);
  const [aiTeam, setAiTeam] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [resumedGameState, setResumedGameState] = useState(null);
  const [opponentLeft, setOpponentLeft] = useState(false);

  const isBattleMode = gameMode === "battle";
  const isMultiplayerMode = playStyle === "local";
  const MAX_HP = 500;

  const {
    selectedStat, winner, round, animate,
    playerDeck, setPlayerDeck, aiDeck, setAiDeck,
    turn, drawPile, showPlayerCard, showAiCard,
    playerHP, aiHP, turnTimerKey, gameOver, setGameOver,
    player, ai, handleStatClick
  } = useGameEngine({
    gameMode, playStyle, isBattleMode, isMultiplayerMode, playerTeam, aiTeam,
    playClick, playWin, playLose, playHit, MAX_HP, players, resumedGameState, onlineRole
  });

  const playerRef = useRef(null);
  const aiRef = useRef(null);
  const drawRef = useRef(null);
  const playerCardRef = useRef(null);
  const aiCardRef = useRef(null);

  const getMoveStyle = (fromRef, toRef) => {
    if (!fromRef.current || !toRef.current) return {};

    const from = fromRef.current.getBoundingClientRect();
    const to = toRef.current.getBoundingClientRect();

    const deltaX = to.left - from.left;
    const deltaY = to.top - from.top;

    return {
      transform: `translate(${deltaX}px, ${deltaY}px) scale(0.7)`,
      transition: "transform 0.8s ease"
    };
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  };

  useEffect(() => {
    if (!isTimeMode || gameOver) return;
    if (timeLeft <= 0) {
      setGameOver(true);
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, isTimeMode, gameOver, setGameOver]);

  useEffect(() => {
    if (gameMode === "time" && selectedTime) {
      setTimeLeft(selectedTime);
      setGameOver(false);
    }
  }, [gameMode, selectedTime, setGameOver]);

  // Listen for opponent disconnect in online games
  useEffect(() => {
    if (playStyle !== "online") return;
    const onPlayerLeft = () => setOpponentLeft(true);
    socket.on("playerLeft", onPlayerLeft);
    return () => socket.off("playerLeft", onPlayerLeft); // ✅ remove only this specific handler
  }, [playStyle]);

  const modeRules = {
    classic: { title: "Classic Mode Rules", points: ["Choose one stat from your top player card.", "Your stat is compared with the AI’s top card.", "Higher value wins the round.", "Winner collects both cards and draw pile cards.", "Game ends when one side gets all cards."] },
    time: { title: "Time Mode Rules", points: ["Play against AI within a fixed time limit.", "Choose stats quickly before time runs out.", "Winner is decided by number of cards when time ends.", "Fast decisions are important in this mode."] },
    battle: { title: "Battle Mode Rules", points: ["Both Player and AI start with HP.", "Winning a stat deals damage to opponent HP.", "Big stat difference causes more damage.", "Reduce opponent HP to zero to win."] },
    team: { title: "Team Mode Rules", points: ["Choose your IPL team and opponent team.", "Only players from selected teams are used.", "Winning keeps your card in rotation.", "Draws discard both cards.", "Last team standing wins."] },
    multiplayer: { title: "Multiplayer Mode Rules", points: ["Player 1 and Player 2 play on the same device.", "Only the current player's card is shown before selecting a stat.", "Choose one stat from your top card.", "Higher stat wins the round and takes both cards.", "Winner gets the next turn.", "Game ends when one player gets all cards."] },
    online: { title: "Online Multiplayer Rules", points: ["Play against another player online.", "Join using a room code.", "Turns are synced in real-time.", "Higher stat wins the round.", "Winner collects cards.", "Game ends when one player gets all cards."] }
  };

  const teams = [...new Set(players.map(p => p.team))];

  const handleHomeClick = () => setShowConfirm(true);
  const confirmGoHome = () => {
    setShowConfirm(false);
    setGameMode(null);
    setPlayStyle(null);
    setGameOver(false);
    setIsOnlineGameStarted(false);
    setPlayerTeam(null);
    setAiTeam(null);
    setResumedGameState(null);
    setOnlineRole(null);
    localStorage.removeItem("savedGameState");
  };
  const cancelGoHome = () => setShowConfirm(false);

  const onResumeGame = (savedState) => {
    setResumedGameState(savedState);
    setPlayerTeam(savedState.playerTeam);
    setAiTeam(savedState.aiTeam);
    setGameMode(savedState.gameMode);
    setPlayStyle(savedState.playStyle || "ai");
  };

  const clearSaveAndGoHome = () => {
    localStorage.removeItem("savedGameState");
    setResumedGameState(null);
    setGameMode(null);
    setPlayStyle(null);
    setOnlineRole(null);
  };

  // Show login screen if not signed in and not playing as guest
  // user===undefined means auth is still loading; null means not signed in
  if (user === undefined) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a1a', color: '#fff', fontSize: 24 }}>⏳ Loading...</div>;
  }

  if (!user && !isGuest) {
    return <LoginScreen onContinueAsGuest={() => setIsGuest(true)} />;
  }

  if (!gameMode || !playStyle) {
    return (
      <HomeScreen
        setGameMode={(mode) => {
          setResumedGameState(null); // Ensure fresh start
          setGameMode(mode);
        }}
        setPlayStyle={setPlayStyle}
        rulesMode={rulesMode}
        setRulesMode={setRulesMode}
        modeRules={modeRules}
        setSelectedTime={setSelectedTime}
        setGameOver={setGameOver}
        isMuted={isMuted}
        toggleMute={toggleMute}
        onResumeGame={onResumeGame}
        user={user}
        isGuest={isGuest}
        onSignOut={handleSignOut}
      />
    );
  }

  if (gameMode === "team" && (!playerTeam || !aiTeam) && playStyle !== "online") {
    return (
      <TeamMode
        playerTeam={playerTeam}
        setPlayerTeam={setPlayerTeam}
        aiTeam={aiTeam}
        setAiTeam={setAiTeam}
        teams={teams}
        setGameMode={setGameMode}
      />
    );
  }

  if (gameMode === "time" && !selectedTime) {
    return (
      <TimeMode
        setSelectedTime={setSelectedTime}
        setGameMode={setGameMode}
      />
    );
  }

  if (playStyle === "online" && !isOnlineGameStarted) {
    return (
      <OnlineMode
        gameMode={gameMode}
        setGameMode={setGameMode}
        setPlayStyle={setPlayStyle}
        setIsOnlineGameStarted={setIsOnlineGameStarted}
        setPlayerDeck={setPlayerDeck}
        setAiDeck={setAiDeck}
        setOnlineRole={setOnlineRole}
        setPlayerTeam={setPlayerTeam}
        setAiTeam={setAiTeam}
        teams={teams}
      />
    );
  }

  if (!turn) return <h2>Loading...</h2>;

  if (isTimeMode && gameOver) {
    let resultTitle = "";
    if (playerDeck.length > aiDeck.length)
      resultTitle = playStyle === "online" ? "YOU WIN 🏆" : "PLAYER WINS 🏆 (Time Mode)";
    else if (aiDeck.length > playerDeck.length)
      resultTitle = playStyle === "online" ? "YOU LOSE 😢" : "AI WINS 😈 (Time Mode)";
    else resultTitle = "DRAW 🤝 (Time Mode)";
    return <ResultScreen title={resultTitle} buttonText="Back to Home" onBack={clearSaveAndGoHome} />;
  }

  if (isBattleMode && playerHP <= 0)
    return <ResultScreen title={playStyle === "online" ? "YOU LOSE 😢" : "AI WINS 😈 (Battle Mode)"} buttonText="Back" onBack={clearSaveAndGoHome} />;
  if (isBattleMode && aiHP <= 0)
    return <ResultScreen title={playStyle === "online" ? "YOU WIN 🏆" : "PLAYER WINS 🏆 (Battle Mode)"} buttonText="Back" onBack={clearSaveAndGoHome} />;

  if (playStyle !== "online" && (playerDeck.length === 0 || aiDeck.length === 0)) {
    const isPlayerWin = aiDeck.length === 0;
    return <ResultScreen title={isPlayerWin ? "PLAYER WINS 🏆" : "AI WINS 😈"} buttonText="Back to Home" onBack={clearSaveAndGoHome} />;
  }

  if (playStyle === "online" && (playerDeck.length === 0 || aiDeck.length === 0)) {
    const isPlayerWin = aiDeck.length === 0;
    return <ResultScreen title={isPlayerWin ? "YOU WIN 🏆" : "YOU LOSE 😢"} buttonText="Back to Home" onBack={clearSaveAndGoHome} />;
  }

  return (
    <div>
      {showConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Are you sure?</h2>
            <p>Your current game will be lost.</p>
            <button onClick={confirmGoHome}>Yes</button>
            <button onClick={cancelGoHome}>Cancel</button>
          </div>
        </div>
      )}

      {opponentLeft && (
        <div className="modal-overlay">
          <div className="modal" style={{ textAlign: "center", maxWidth: 360 }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>👋</div>
            <h2 style={{ color: "#ffd700", margin: "0 0 8px" }}>Opponent Left</h2>
            <p style={{ color: "#ccc", marginBottom: 24 }}>
              Your opponent has disconnected from the game.
            </p>
            <button
              className="home-btn"
              style={{ width: "100%" }}
              onClick={() => { setOpponentLeft(false); confirmGoHome(); }}
            >
              Back to Home
            </button>
          </div>
        </div>
      )}

      <div
        className="game"
        style={{
          backgroundImage: gameMode === "classic" ? `url(${classicBg})` : gameMode === "battle" ? `url(${battleBg})` : gameMode === "time" ? `url(${timeBg})` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat"
        }}
      >
        <GameHeader
          round={round}
          isTimeMode={isTimeMode}
          timeLeft={timeLeft}
          formatTime={formatTime}
          isBattleMode={isBattleMode}
          playerHP={playerHP}
          aiHP={aiHP}
          MAX_HP={MAX_HP}
          handleHomeClick={handleHomeClick}
          turn={turn}
          isMultiplayerMode={isMultiplayerMode}
          playStyle={playStyle}
          onlineRole={onlineRole}
          isMuted={isMuted}
          toggleMute={toggleMute}
          user={user}
        />

        {player && ai ? (
          <GameBoard
            playerRef={playerRef}
            playerCardRef={playerCardRef}
            player={player}
            animate={animate}
            winner={winner}
            aiCardRef={aiCardRef}
            drawRef={drawRef}
            ai={ai}
            showPlayerCard={showPlayerCard}
            showAiCard={showAiCard}
            aiRef={aiRef}
            turn={turn}
            gameMode={gameMode}
            isMultiplayerMode={isMultiplayerMode}
            turnTimerKey={turnTimerKey}
            playerDeck={playerDeck}
            aiDeck={aiDeck}
            drawPile={drawPile}
            selectedStat={selectedStat}
            handleStatClick={handleStatClick}
            isMobile={isMobile}
            getMoveStyle={getMoveStyle}
            isTimeoutActive={selectedStat === null && !gameOver && !animate}
            playStyle={playStyle}
          />
        ) : (
          <div className="loading">Checking winner...</div>
        )}
      </div>
    </div>
  );
}

export default App;