import players from "./data/players.json";
import { useState, useEffect, useRef, useCallback } from "react";
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
import EmotePanel from "./components/EmotePanel";
import socket from "./socket";
import { useGameAudio } from "./hooks/useGameAudio";
import { useGameEngine } from "./hooks/useGameEngine";
import { useAuth } from "./context/AuthContext";
import TournamentMode from "./modes/TournamentMode";


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
  const [loginConflict, setLoginConflict] = useState(false);

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





  useEffect(() => {
    if (user && user.displayName) {
      const register = () => {
        socket.emit("registerUser", user.displayName);
      };

      // Register immediately if already connected
      if (socket.connected) {
        register();
      }

      // Re-register every time the socket connects/reconnects
      socket.on("connect", register);

      const handleLoginConflict = () => {
        setLoginConflict(true);
        logout();
      };

      socket.on("loginConflict", handleLoginConflict);

      return () => {
        socket.off("connect", register);
        socket.off("loginConflict", handleLoginConflict);
      };
    }
  }, [user, logout]);

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
  const [tournamentState, setTournamentState] = useState(() => {
    try {
      const str = localStorage.getItem("savedTournamentState");
      return str ? JSON.parse(str) : null;
    } catch {
      return null;
    }
  });

  const isBattleMode = gameMode === "battle";
  const isMultiplayerMode = playStyle === "local";
  const MAX_HP = 500;

  const {
    selectedStat, winner, round, animate,
    playerDeck, setPlayerDeck, aiDeck, setAiDeck,
    turn, drawPile, showPlayerCard, showAiCard,
    playerHP, aiHP, turnTimerKey, gameOver, setGameOver,
    player, ai, handleStatClick, TURN_TIMEOUT, pitchCondition,
    weather, moisture,
    playerSwapUsed,
    swapModalOpen, setSwapModalOpen,
    swapCandidates,
    swapAnnouncement,
    swapGraceActive,
    swapGraceTimeLeft,
    handleOpenPlayerSwap,
    executePlayerSwap,
    overAnnouncement,
    swapTimer
  } = useGameEngine({
    gameMode, playStyle, isBattleMode, isMultiplayerMode, playerTeam, aiTeam,
    playClick, playWin, playLose, playHit, MAX_HP, players, resumedGameState, onlineRole
  });

  const playerRef = useRef(null);
  const aiRef = useRef(null);
  const drawRef = useRef(null);
  const playerCardRef = useRef(null);
  const aiCardRef = useRef(null);

  // ✅ FIX: wrapped in useCallback — not recreated on every render
  const getMoveStyle = useCallback((fromRef, toRef) => {
    if (!fromRef.current || !toRef.current) return {};
    const from = fromRef.current.getBoundingClientRect();
    const to = toRef.current.getBoundingClientRect();
    const deltaX = to.left - from.left;
    const deltaY = to.top - from.top;
    return {
      transform: `translate(${deltaX}px, ${deltaY}px) scale(0.7)`,
      transition: "transform 0.8s ease"
    };
  }, []);

  // ✅ FIX: wrapped in useCallback — stable reference across renders
  const formatTime = useCallback((seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  }, []);

  // ✅ FIX: timeLeft removed from dep array — a single stable interval is created
  // for the duration of the game. The boundary check happens inside the setter
  // callback so it always reads the latest value without a stale closure.
  useEffect(() => {
    if (!isTimeMode || gameOver) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setGameOver(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isTimeMode, gameOver, setGameOver]);

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
    tournament: { title: "Tournament Rules", points: ["Select a franchise and campaign against the other 9 teams.", "Wins award 2 points on the Live Points Table. The other games are simulated in parallel.", "League matches feature 7 cards. Playoff matches feature 9 cards. The Grand Final features 11 cards.", "Finish in the Top 4 to qualify for the Playoffs (Q1, Eliminator, Q2, and Final) to claim the trophy!"] },
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

  const updateTournamentProgress = (isPlayerWin) => {
    if (!tournamentState) return;

    const state = { ...tournamentState };
    const { playerTeam, pointsTable, schedule, currentRoundIndex, stage, playoffs } = state;
    
    // Determine opponent team
    const oppTeam = aiTeam;
    if (!oppTeam) return;

    const TEAM_RATINGS_LOCAL = {
      "chennai super kings": 88,
      "mumbai indians": 87,
      "royal challengers bengaluru": 85,
      "kolkata knight riders": 86,
      "delhi capitals": 82,
      "sunrisers hyderabad": 84,
      "rajasthan royals": 84,
      "punjab kings": 80,
      "lucknow super giants": 81,
      "gujarat titans": 82
    };

    if (stage === "league") {
      // 1. Update standings for player match
      const pTable = { ...pointsTable };
      
      pTable[playerTeam].played += 1;
      pTable[oppTeam].played += 1;
      
      if (isPlayerWin) {
        pTable[playerTeam].won += 1;
        pTable[playerTeam].points += 2;
        pTable[oppTeam].lost += 1;
      } else {
        pTable[oppTeam].won += 1;
        pTable[oppTeam].points += 2;
        pTable[playerTeam].lost += 1;
      }

      // 2. Simulate the other 4 matches of this round
      const currentMatches = schedule[currentRoundIndex];
      currentMatches.forEach(match => {
        const isPlayerMatch = match.home === playerTeam || match.away === playerTeam;
        if (!isPlayerMatch) {
          // Simulate
          const ratingHome = TEAM_RATINGS_LOCAL[match.home.toLowerCase()] || 80;
          const ratingAway = TEAM_RATINGS_LOCAL[match.away.toLowerCase()] || 80;
          const probHome = ratingHome / (ratingHome + ratingAway);
          const homeWins = Math.random() < probHome;
          
          pTable[match.home].played += 1;
          pTable[match.away].played += 1;
          
          if (homeWins) {
            pTable[match.home].won += 1;
            pTable[match.home].points += 2;
            pTable[match.away].lost += 1;
          } else {
            pTable[match.away].won += 1;
            pTable[match.away].points += 2;
            pTable[match.home].lost += 1;
          }
        }
      });

      state.pointsTable = pTable;

      // 3. Advance round or transition to Playoffs
      if (currentRoundIndex < 8) {
        state.currentRoundIndex += 1;
      } else {
        // League finished! Check Top 4
        const sorted = Object.keys(pTable)
          .map(team => ({ name: team, ...pTable[team] }))
          .sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.won !== a.won) return b.won - a.won;
            return a.name.localeCompare(b.name);
          });
        
        const top4 = sorted.slice(0, 4).map(t => t.name);
        const playerIndex = top4.indexOf(playerTeam);
        
        if (playerIndex === -1) {
          // Player eliminated
          state.stage = "eliminated";
        } else {
          // Playoff assignments
          const [team1, team2, team3, team4] = top4;
          state.stage = "playoffs";
          state.playoffs = {
            q1: { home: team1, away: team2, played: false, winner: null, loser: null },
            elim: { home: team3, away: team4, played: false, winner: null },
            q2: { home: null, away: null, played: false, winner: null },
            final: { home: null, away: null, played: false, winner: null }
          };
        }
      }
    } else if (stage === "playoffs" && playoffs) {
      // Handle playoff match end
      const play = { ...playoffs };
      let activePlayoffKey = null;

      if (play.q1.home && !play.q1.played && (play.q1.home === playerTeam || play.q1.away === playerTeam)) {
        activePlayoffKey = "q1";
      } else if (play.elim.home && !play.elim.played && (play.elim.home === playerTeam || play.elim.away === playerTeam)) {
        activePlayoffKey = "elim";
      } else if (play.q2.home && !play.q2.played && (play.q2.home === playerTeam || play.q2.away === playerTeam)) {
        activePlayoffKey = "q2";
      } else if (play.final.home && !play.final.played && (play.final.home === playerTeam || play.final.away === playerTeam)) {
        activePlayoffKey = "final";
      }

      if (activePlayoffKey === "q1") {
        play.q1.played = true;
        if (isPlayerWin) {
          play.q1.winner = playerTeam;
          play.q1.loser = oppTeam;
        } else {
          play.q1.winner = oppTeam;
          play.q1.loser = playerTeam;
        }

        // Simulate Eliminator
        play.elim.played = true;
        const elimProb = (TEAM_RATINGS_LOCAL[play.elim.home.toLowerCase()] || 80) / ((TEAM_RATINGS_LOCAL[play.elim.home.toLowerCase()] || 80) + (TEAM_RATINGS_LOCAL[play.elim.away.toLowerCase()] || 80));
        const elimHomeWins = Math.random() < elimProb;
        play.elim.winner = elimHomeWins ? play.elim.home : play.elim.away;

        // Schedule Q2
        play.q2.home = play.q1.loser;
        play.q2.away = play.elim.winner;

      } else if (activePlayoffKey === "elim") {
        play.elim.played = true;
        if (isPlayerWin) {
          play.elim.winner = playerTeam;
        } else {
          play.elim.winner = oppTeam;
          state.stage = "eliminated"; // Player lost Eliminator -> eliminated
        }

        // Simulate Q1
        play.q1.played = true;
        const q1Prob = (TEAM_RATINGS_LOCAL[play.q1.home.toLowerCase()] || 80) / ((TEAM_RATINGS_LOCAL[play.q1.home.toLowerCase()] || 80) + (TEAM_RATINGS_LOCAL[play.q1.away.toLowerCase()] || 80));
        const q1HomeWins = Math.random() < q1Prob;
        if (q1HomeWins) {
          play.q1.winner = play.q1.home;
          play.q1.loser = play.q1.away;
        } else {
          play.q1.winner = play.q1.away;
          play.q1.loser = play.q1.home;
        }

        // Schedule Q2
        play.q2.home = play.q1.loser;
        play.q2.away = play.elim.winner;

      } else if (activePlayoffKey === "q2") {
        play.q2.played = true;
        if (isPlayerWin) {
          play.q2.winner = playerTeam;
          // Schedule Final
          play.final.home = play.q1.winner;
          play.final.away = playerTeam;
        } else {
          play.q2.winner = oppTeam;
          state.stage = "eliminated"; // Player lost Q2 -> eliminated
        }

      } else if (activePlayoffKey === "final") {
        play.final.played = true;
        if (isPlayerWin) {
          play.final.winner = playerTeam;
          state.stage = "champion";
        } else {
          play.final.winner = oppTeam;
          state.stage = "eliminated"; // Player lost Final -> eliminated
        }
      }

      // Check if we need to simulate Q2 (if player won Q1, they wait in the Final while Q2 is played by others)
      if (state.stage !== "eliminated" && state.stage !== "champion") {
        const isPlayerInQ2 = play.q2.home === playerTeam || play.q2.away === playerTeam;

        if (play.q2.home && !play.q2.played && !isPlayerInQ2) {
          play.q2.played = true;
          const q2Prob = (TEAM_RATINGS_LOCAL[play.q2.home.toLowerCase()] || 80) / ((TEAM_RATINGS_LOCAL[play.q2.home.toLowerCase()] || 80) + (TEAM_RATINGS_LOCAL[play.q2.away.toLowerCase()] || 80));
          const q2HomeWins = Math.random() < q2Prob;
          play.q2.winner = q2HomeWins ? play.q2.home : play.q2.away;
          
          // Schedule Final
          play.final.home = play.q1.winner;
          play.final.away = play.q2.winner;
        }
      }

      state.playoffs = play;
    }

    setTournamentState(state);
    localStorage.setItem("savedTournamentState", JSON.stringify(state));

    // Reset game match variables
    setPlayerTeam(null);
    setAiTeam(null);
    setIsOnlineGameStarted(false);
    setResumedGameState(null);
    localStorage.removeItem("savedGameState"); // Clear single game save since this match is done
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
    return (
      <>
        {loginConflict && (
          <div className="modal-overlay">
            <div className="modal" style={{ textAlign: "center", maxWidth: 360 }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>🚨</div>
              <h2 style={{ color: "#ff4b2b", margin: "0 0 8px" }}>Multiple Logins</h2>
              <p style={{ color: "#ccc", marginBottom: 24 }}>
                This account is already logged in on another device.
              </p>
              <button
                className="home-btn"
                style={{ width: "100%", background: "linear-gradient(135deg, #ff4b2b, #ff416c)", border: "none", color: "#fff", padding: "12px", borderRadius: "8px", fontWeight: "bold" }}
                onClick={() => setLoginConflict(false)}
              >
                OK
              </button>
            </div>
          </div>
        )}
        <LoginScreen onContinueAsGuest={() => setIsGuest(true)} />
      </>
    );
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

  if (gameMode === "tournament" && !aiTeam && (!isOnlineGameStarted || playStyle !== "online")) {
    return (
      <TournamentMode
        teams={teams}
        setGameMode={setGameMode}
        playStyle={playStyle}
        setPlayStyle={setPlayStyle}
        tournamentState={tournamentState}
        setTournamentState={setTournamentState}
        startMatch={(oppTeam, isOnline) => {
          setPlayerTeam(tournamentState.playerTeam);
          setAiTeam(oppTeam);
          if (isOnline) {
            setIsOnlineGameStarted(false);
          } else {
            // offline AI
          }
        }}
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
    if (gameMode === "tournament") {
      return (
        <ResultScreen 
          title={isPlayerWin ? "MATCH WON! 🎉" : "MATCH LOST! 😢"} 
          buttonText="Continue Standings" 
          onBack={() => updateTournamentProgress(isPlayerWin)} 
        />
      );
    }
    return <ResultScreen title={isPlayerWin ? "PLAYER WINS 🏆" : "AI WINS 😈"} buttonText="Back to Home" onBack={clearSaveAndGoHome} />;
  }

  if (playStyle === "online" && (playerDeck.length === 0 || aiDeck.length === 0)) {
    const isPlayerWin = aiDeck.length === 0;
    if (gameMode === "tournament") {
      return (
        <ResultScreen 
          title={isPlayerWin ? "YOU WIN MATCH! 🎉" : "YOU LOSE MATCH! 😢"} 
          buttonText="Continue Standings" 
          onBack={() => updateTournamentProgress(isPlayerWin)} 
        />
      );
    }
    return <ResultScreen title={isPlayerWin ? "YOU WIN 🏆" : "YOU LOSE 😢"} buttonText="Back to Home" onBack={clearSaveAndGoHome} />;
  }

  return (
    <div>
      {showConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Are you sure?</h2>
            <p>Your current game will be lost.</p>
            <div className="modal-actions" style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
              <button className="confirm-btn" onClick={confirmGoHome}>Yes</button>
              <button className="cancel-btn" onClick={cancelGoHome}>Cancel</button>
            </div>
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
          gameMode={gameMode}
          pitchCondition={pitchCondition}
          weather={weather}
          moisture={moisture}
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
            getMoveStyle={getMoveStyle}
            isTimeoutActive={selectedStat === null && !gameOver && !animate && !swapModalOpen}
            playStyle={playStyle}
            turnTimeout={TURN_TIMEOUT}
            pitchCondition={pitchCondition}
            round={round}
            weather={weather}
            moisture={moisture}
            playerSwapUsed={playerSwapUsed}
            swapModalOpen={swapModalOpen}
            setSwapModalOpen={setSwapModalOpen}
            swapCandidates={swapCandidates}
            swapAnnouncement={swapAnnouncement}
            swapGraceActive={swapGraceActive}
            swapGraceTimeLeft={swapGraceTimeLeft}
            handleOpenPlayerSwap={handleOpenPlayerSwap}
            executePlayerSwap={executePlayerSwap}
            overAnnouncement={overAnnouncement}
            swapTimer={swapTimer}
          />
        ) : (
          <div className="loading">Checking winner...</div>
        )}

        <EmotePanel 
          playStyle={playStyle} 
          roomId={localStorage.getItem("roomId")} 
        />
      </div>
    </div>
  );
}

export default App;