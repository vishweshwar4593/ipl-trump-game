import players from "./data/players.json";
import { useState, useEffect, useRef, useCallback } from "react";
import classicBg from "./assets/classic-bg.png";
import battleBg from "./assets/battle-bg.png";
import timeBg from "./assets/time-bg.png";
import HomeScreen from "./components/HomeScreen";
import TimeMode from "./modes/TimeMode";
import ResultScreen from "./components/ResultScreen";
import GameHeader from "./components/GameHeader";
import GameBoard from "./components/GameBoard";
import OnlineMode from "./modes/OnlineMode";
import TossScreen from "./components/TossScreen";
import LoginScreen from "./components/LoginScreen";
import EmotePanel from "./components/EmotePanel";
import socket from "./socket";
import { useGameAudio } from "./hooks/useGameAudio";
import { useGameEngine } from "./hooks/useGameEngine";
import { useAuth } from "./context/AuthContext";
import TournamentMode from "./modes/TournamentMode";
import { ref, get, remove } from "firebase/database";
import { database } from "./firebase";
import { useAchievements } from "./hooks/useAchievements";

// Modals
import LoginConflictModal from "./components/modals/LoginConflictModal";
import ExitConfirmationModal from "./components/modals/ExitConfirmationModal";
import ReconnectModal from "./components/modals/ReconnectModal";
import OpponentLeftModal from "./components/modals/OpponentLeftModal";

// Custom Tournament Campaign Hook
import { useTournamentCampaign, TEAM_RATINGS } from "./hooks/useTournamentCampaign";

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
  const { user: authUser, logout } = useAuth();
  const [user, setUser] = useState(undefined);
  const [isGuest, setIsGuest] = useState(false);
  const [loginConflict, setLoginConflict] = useState(false);
  const tournamentStateRef = useRef(null);


  // Generate or retrieve persistent guest UID
  const [guestUid] = useState(() => {
    let id = localStorage.getItem("guestUid");
    if (!id) {
      id = "guest_" + Math.random().toString(36).substring(2, 15);
      localStorage.setItem("guestUid", id);
    }
    return id;
  });

  const clientUid = user ? user.uid : (isGuest ? guestUid : null);
  const clientDisplayName = user ? user.displayName : (isGuest ? "Guest" : null);

  useEffect(() => {
    if (authUser === undefined) {
      setUser(undefined);
      return;
    }
    if (authUser === null) {
      setUser(null);
      sessionStorage.removeItem("justSignedUp");
      sessionStorage.removeItem("settingPassword");
      return;
    }

    if (sessionStorage.getItem("settingPassword") === "true") {
      setUser(null);
      return;
    }

    if (sessionStorage.getItem("justSignedUp") === "true") {
      const timer = setTimeout(() => {
        setUser(authUser);
        sessionStorage.removeItem("justSignedUp");
      }, 2500);
      return () => clearTimeout(timer);
    } else {
      setUser(authUser);
    }
  }, [authUser]);

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
    setSavedGameState(null);
    setTournamentState(null);
    localStorage.removeItem("savedGameState");
  };


  useEffect(() => {
    if (clientUid && clientDisplayName) {
      const register = async () => {
        let token = null;
        if (user) {
          try {
            token = await user.getIdToken(true);
          } catch (err) {
            console.error("Error fetching Firebase ID token:", err);
          }
        }
        socket.emit("registerUser", { uid: clientUid, displayName: clientDisplayName, token });
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
  }, [clientUid, clientDisplayName, user, logout]);



  const [savedGameState, setSavedGameState] = useState(null);

  // Achievement system
  const { unlockedIds, newToast, dismissToast, checkAndUnlock } = useAchievements({ user, isGuest });

  // Asynchronously fetch cloud saves from Firebase Realtime Database on user login
  useEffect(() => {
    if (!user) {
      setSavedGameState(null);
      return;
    }

    const fetchCloudData = async () => {
      try {
        const gameRef = ref(database, `users/${user.uid}/savedGameState`);
        const gameSnap = await get(gameRef);
        if (gameSnap.exists()) {
          // Stale mid-game saves are cleared to avoid resume options
          remove(gameRef).catch(err => console.error("Error clearing cloud save:", err));
        }
        setSavedGameState(null);
      } catch (err) {
        console.error("Error loading data from Firebase Realtime Database:", err);
      }
    };

    fetchCloudData();
  }, [user]);

  // Load from LocalStorage fallback if player plays as a guest
  useEffect(() => {
    if (isGuest) {
      try {
        localStorage.removeItem("savedGameState");
        setSavedGameState(null);
      } catch (err) {
        console.error("Error loading LocalStorage fallback for guest:", err);
      }
    }
  }, [isGuest]);

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
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [disconnectTimeLeft, setDisconnectTimeLeft] = useState(45);
  const disconnectTimerRef = useRef(null);
  const [hasUnlockedAchievementsForMatch, setHasUnlockedAchievementsForMatch] = useState(false);
  const [tossCaller, setTossCaller] = useState(null);

  const isBattleMode = gameMode === "battle";
  const isMultiplayerMode = playStyle === "local";
  const MAX_HP = 500;

  const {
    selectedStat, winner, round, animate,
    playerDeck, setPlayerDeck, aiDeck, setAiDeck,
    turn, setTurn, drawPile, showPlayerCard, showAiCard,
    playerHP, aiHP, turnTimerKey, gameOver, setGameOver,
    player, ai, handleStatClick, TURN_TIMEOUT, pitchCondition, setPitchCondition,
    weather, setWeather, moisture, setMoisture,
    playerSwapUsed, playerSwapsLeft,
    swapModalOpen, setSwapModalOpen,
    swapCandidates,
    swapAnnouncement,
    swapGraceActive,
    swapGraceTimeLeft,
    handleOpenPlayerSwap,
    executePlayerSwap,
    overAnnouncement,
    swapTimer,
    statHistory,
    wasEverBehind,
    playerFranchisePool,
    setPlayerFranchisePool,
    setAiFranchisePool,
    superOverBanner,
    
    // Cricket States & Functions
    oversLimit,
    currentInnings,
    battingTeam, setBattingTeam,
    targetScore,
    matchIntensity,
    overSummary,
    overHistory,
    cricketScore,
    isInningsBreak,
    cricketWinner,
    startSecondInnings
  } = useGameEngine({
    gameMode, playStyle, isBattleMode, isMultiplayerMode, playerTeam, aiTeam,
    playClick, playWin, playLose, playHit, MAX_HP, players, resumedGameState, onlineRole,
    user, isGuest, showConfirm, tournamentStateRef
  });

  // Tournament Hook containing campaign simulation states and functions
  const {
    tournamentState,
    setTournamentState,
    activeTournamentMatch,
    setActiveTournamentMatch,
    tournamentHistory,
    hallOfFame,
    updateTournamentProgress,
    simulateLeagueMatch,
    simulatePrecedingMatches,
    simulateAllRemainingMatches,
    advanceTournamentRound,
    simulatePlayoffMatch,
    buildMatchStats
  } = useTournamentCampaign({
    user,
    isGuest,
    checkAndUnlock,
    playerDeck,
    aiDeck,
    wasEverBehind,
    playerTeam,
    setPlayerTeam,
    aiTeam,
    setAiTeam,
    setIsOnlineGameStarted,
    setResumedGameState,
    setSavedGameState,
    setPlayerDeck,
    setAiDeck,
    setPlayerFranchisePool,
    setAiFranchisePool,
    statHistory
  });

  tournamentStateRef.current = tournamentState;

  const isGameplayActive = !!(
    gameMode && 
    (gameMode !== "time" || selectedTime) && 
    (gameMode !== "team" || (playerTeam && aiTeam)) && 
    (playStyle !== "online" || isOnlineGameStarted) &&
    (gameMode !== "tournament" || aiTeam) &&
    !gameOver &&
    playerHP > 0 &&
    aiHP > 0 &&
    playerDeck && playerDeck.length > 0 &&
    aiDeck && aiDeck.length > 0
  );

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

  // Reset achievements checked flag when a new game starts (both decks have cards)
  useEffect(() => {
    if (playerDeck && playerDeck.length > 0 && aiDeck && aiDeck.length > 0) {
      setHasUnlockedAchievementsForMatch(false);
    }
  }, [playerDeck, aiDeck]);

  // Check achievements once at the end of a match
  useEffect(() => {
    if (hasUnlockedAchievementsForMatch) return;

    // Condition 1: Time Mode game over
    if (isTimeMode && gameOver) {
      const isPlayerWin = playerDeck.length > aiDeck.length;
      if (isPlayerWin) {
        checkAndUnlock({
          type: "match_end",
          isWin: true,
          gameMode: "time",
          margin: playerDeck.length - aiDeck.length,
          timeLeft,
          tournamentState: null,
          wasEverBehind,
          _user: user,
          _isGuest: isGuest
        });
      }
      setHasUnlockedAchievementsForMatch(true);
      return;
    }

    // Condition 2: Battle Mode game over
    if (isBattleMode) {
      if (playerHP <= 0) {
        checkAndUnlock({
          type: "match_end",
          isWin: false,
          gameMode: "battle",
          margin: 0,
          timeLeft: 0,
          tournamentState: null,
          wasEverBehind,
          _user: user,
          _isGuest: isGuest
        });
        setHasUnlockedAchievementsForMatch(true);
        return;
      }
      if (aiHP <= 0) {
        checkAndUnlock({
          type: "match_end",
          isWin: true,
          gameMode: "battle",
          margin: 0,
          timeLeft: 0,
          tournamentState: null,
          wasEverBehind,
          _user: user,
          _isGuest: isGuest
        });
        setHasUnlockedAchievementsForMatch(true);
        return;
      }
    }

    // Condition 3: Regular offline match ended (deck size 0)
    if (playStyle !== "online" && gameMode && gameMode !== "tournament" && (playerDeck.length === 0 || aiDeck.length === 0)) {
      const isPlayerWin = aiDeck.length === 0;
      checkAndUnlock({
        type: "match_end",
        isWin: isPlayerWin,
        gameMode,
        margin: Math.abs(playerDeck.length - aiDeck.length),
        timeLeft: 0,
        tournamentState: null,
        wasEverBehind,
        _user: user,
        _isGuest: isGuest
      });
      setHasUnlockedAchievementsForMatch(true);
      return;
    }

    // Condition 4: Regular online match ended (deck size 0)
    if (playStyle === "online" && gameMode && gameMode !== "tournament" && (playerDeck.length === 0 || aiDeck.length === 0)) {
      const isPlayerWin = aiDeck.length === 0;
      checkAndUnlock({
        type: "match_end",
        isWin: isPlayerWin,
        gameMode,
        margin: Math.abs(playerDeck.length - aiDeck.length),
        timeLeft: 0,
        tournamentState: null,
        wasEverBehind,
        _user: user,
        _isGuest: isGuest
      });
      setHasUnlockedAchievementsForMatch(true);
      return;
    }
  }, [
    hasUnlockedAchievementsForMatch,
    isTimeMode,
    gameOver,
    playerDeck?.length,
    aiDeck?.length,
    timeLeft,
    isBattleMode,
    playerHP,
    aiHP,
    playStyle,
    gameMode,
    wasEverBehind,
    user,
    isGuest,
    checkAndUnlock
  ]);

  // ✅ FIX: timeLeft removed from dep array — a single stable interval is created
  // for the duration of the game. The boundary check happens inside the setter
  // callback so it always reads the latest value without a stale closure.
  useEffect(() => {
    if (!isTimeMode || gameOver || showConfirm) return;
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
  }, [isTimeMode, gameOver, setGameOver, showConfirm]);

  useEffect(() => {
    if (gameMode === "time" && selectedTime) {
      setTimeLeft(selectedTime);
      setGameOver(false);
    }
  }, [gameMode, selectedTime, setGameOver]);

  // Reconnect warning countdown timer
  useEffect(() => {
    if (opponentDisconnected) {
      disconnectTimerRef.current = setInterval(() => {
        setDisconnectTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(disconnectTimerRef.current);
            setOpponentDisconnected(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (disconnectTimerRef.current) {
        clearInterval(disconnectTimerRef.current);
      }
    }
    return () => {
      if (disconnectTimerRef.current) {
        clearInterval(disconnectTimerRef.current);
      }
    };
  }, [opponentDisconnected]);

  // Listen for online opponent drop/reconnect events
  useEffect(() => {
    if (playStyle !== "online") return;

    const onOpponentDisconnected = (data) => {
      setOpponentDisconnected(true);
      if (data && data.timeLeft) {
        setDisconnectTimeLeft(data.timeLeft);
      } else {
        setDisconnectTimeLeft(45);
      }
    };

    const onOpponentReconnected = () => {
      setOpponentDisconnected(false);
    };

    const onPlayerLeft = () => {
      setOpponentDisconnected(false);
      setOpponentLeft(true);
    };

    socket.on("opponentDisconnected", onOpponentDisconnected);
    socket.on("opponentReconnected", onOpponentReconnected);
    socket.on("playerLeft", onPlayerLeft);

    return () => {
      socket.off("opponentDisconnected", onOpponentDisconnected);
      socket.off("opponentReconnected", onOpponentReconnected);
      socket.off("playerLeft", onPlayerLeft);
    };
  }, [playStyle]);

  // Handle automatic room reconnection on socket connect/reconnect
  useEffect(() => {
    if (playStyle !== "online") return;

    const handleReconnect = async () => {
      const roomId = localStorage.getItem("roomId");
      if (roomId && clientUid && clientDisplayName) {
        let token = null;
        if (user) {
          try {
            token = await user.getIdToken(true);
          } catch (err) {
            console.error("Error fetching ID token for reconnect:", err);
          }
        }
        socket.emit("reconnectRoom", { roomId, uid: clientUid, displayName: clientDisplayName, token });
      }
    };

    if (socket.connected) {
      handleReconnect();
    }

    socket.on("connect", handleReconnect);
    return () => {
      socket.off("connect", handleReconnect);
    };
  }, [playStyle, clientUid, clientDisplayName, user]);

  // Auto-enter fullscreen and landscape lock ONLY when active gameplay board starts
  useEffect(() => {
    if (isGameplayActive) {
      // Only target mobile/tablet viewports
      if (window.innerWidth <= 1100) {
        const elem = document.documentElement;
        if (!document.fullscreenElement) {
          elem.requestFullscreen().catch(err => {
            console.log("Active gameplay auto-fullscreen failed:", err);
          });
        }
        if (window.screen && window.screen.orientation && window.screen.orientation.lock) {
          window.screen.orientation.lock("landscape").catch(err => {
            console.log("Active gameplay orientation lock failed:", err);
          });
        }
      }
    } else {
      // Automatically exit fullscreen and restore orientation when returning to menus
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(err => {
          console.log("Exiting fullscreen failed:", err);
        });
      }
      if (window.screen && window.screen.orientation && window.screen.orientation.unlock) {
        try {
          window.screen.orientation.unlock();
        } catch (err) {
          console.log("Orientation unlock failed:", err);
        }
      }
    }
  }, [isGameplayActive]);

  // Intercept physical/gesture back button and show confirmation modal during active card gameplay on mobile
  useEffect(() => {
    if (!isGameplayActive) return;

    // Push dummy state to intercept browser back actions
    window.history.pushState({ gameplay: true }, "");

    const handlePopState = (event) => {
      // Re-push the state to prevent navigation
      window.history.pushState({ gameplay: true }, "");
      
      // Trigger the standard confirmation modal
      setShowConfirm(true);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isGameplayActive]);

  // Listen for browser fullscreen exit (including via Android/iOS back key/gesture) to trigger confirmation modal instantly
  useEffect(() => {
    if (!isGameplayActive) return;

    const handleFullscreenChange = () => {
      // If the user exited fullscreen while gameplay is still active, show the confirmation warning only on mobile
      if (window.innerWidth <= 1100 && !document.fullscreenElement) {
        setShowConfirm(true);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
      document.removeEventListener("MSFullscreenChange", handleFullscreenChange);
    };
  }, [isGameplayActive]);

  const modeRules = {
    classic: { title: "Classic Mode Rules", points: ["Choose one stat from your top player card.", "Your stat is compared with the AI’s top card.", "Higher value wins the round.", "Winner collects both cards and draw pile cards.", "Game ends when one side gets all cards."] },
    time: { title: "Time Mode Rules", points: ["Play against AI within a fixed time limit.", "Choose stats quickly before time runs out.", "Winner is decided by number of cards when time ends.", "Fast decisions are important in this mode."] },
    battle: { title: "Battle Mode Rules", points: ["Both Player and AI start with HP.", "Winning a stat deals damage to opponent HP.", "Big stat difference causes more damage.", "Reduce opponent HP to zero to win."] },
    team: { title: "IPL T20 Cricket Campaign Rules", points: ["Select your team and play a full T20 Cricket Simulator campaign against 9 other franchises.", "Choose your overs duration: 5, 10, or 20 overs per match.", "Simulate real cricket matches with Coin Toss, Overs, Wickets, Targets, and Run Rate Chasing.", "Compare card statistics to score runs or take wickets.", "Finish in the Top 4 to enter the Playoffs and win the IPL Trophy!"] },
    tournament: { title: "IPL Classic Tournament Rules", points: ["Select your team and campaign against the other 9 franchises in classic card-capturing matches.", "League matches feature 7 cards. Playoff matches feature 9 cards. The Grand Final features 11 cards.", "Compare stats and win cards to defeat the AI deck.", "Finish in the Top 4 to qualify for the Playoffs (Q1, Eliminator, Q2, and Final) to claim the trophy!"] },
    multiplayer: { title: "Multiplayer Mode Rules", points: ["Player 1 and Player 2 play on the same device.", "Only the current player's card is shown before selecting a stat.", "Choose one stat from your top card.", "Higher stat wins the round and takes both cards.", "Winner gets the next turn.", "Game ends when one player gets all cards."] },
    online: { title: "Online Multiplayer Rules", points: ["Play against another player online.", "Join using a room code.", "Turns are synced in real-time.", "Higher stat wins the round.", "Winner collects cards.", "Game ends when one player gets all cards."] }
  };

  const teams = [...new Set(players.map(p => p.team))];

  const handleHomeClick = () => setShowConfirm(true);
  const confirmGoHome = () => {
    setShowConfirm(false);

    // If we are exiting an active campaign match, record it as a loss (or simulate if spectator)
    if (!!activeTournamentMatch && aiTeam) {
      if (playStyle === "ai_vs_ai") {
        const ratingHome = TEAM_RATINGS[playerTeam.toLowerCase()] || 80;
        const ratingAway = TEAM_RATINGS[aiTeam.toLowerCase()] || 80;
        const homeWins = Math.random() < (ratingHome / (ratingHome + ratingAway));
        updateTournamentProgress(homeWins);
      } else {
        updateTournamentProgress(false);
      }
      return;
    }

    const roomId = localStorage.getItem("roomId");
    if (roomId) {
      socket.emit("leaveRoom", { roomId });
      localStorage.removeItem("roomId");
    }

    setGameMode(null);
    setPlayStyle(null);
    setGameOver(false);
    setIsOnlineGameStarted(false);
    setPlayerTeam(null);
    setAiTeam(null);
    setResumedGameState(null);
    setOnlineRole(null);
    setSavedGameState(null);
    if (user && !isGuest) {
      const gameRef = ref(database, `users/${user.uid}/savedGameState`);
      remove(gameRef).catch(err => console.error("Error clearing cloud save:", err));
    } else {
      localStorage.removeItem("savedGameState");
    }
  };
  const cancelGoHome = () => {
    setShowConfirm(false);
    // Request fullscreen and orientation lock again since they chose to stay in the match
    if (window.innerWidth <= 1100) {
      const elem = document.documentElement;
      if (!document.fullscreenElement) {
        elem.requestFullscreen().catch(err => {
          console.log("Re-enabling fullscreen failed:", err);
        });
      }
      if (window.screen && window.screen.orientation && window.screen.orientation.lock) {
        window.screen.orientation.lock("landscape").catch(err => {
          console.log("Re-locking orientation failed:", err);
        });
      }
    }
  };

  const onResumeGame = (savedState) => {
    setResumedGameState(savedState);
    setPlayerTeam(savedState.playerTeam);
    setAiTeam(savedState.aiTeam);
    setGameMode(savedState.gameMode);
    setPlayStyle(savedState.playStyle || "ai");
  };



  const clearSaveAndGoHome = () => {
    const roomId = localStorage.getItem("roomId");
    if (roomId) {
      socket.emit("leaveRoom", { roomId });
      localStorage.removeItem("roomId");
    }

    setSavedGameState(null);
    if (user && !isGuest) {
      const gameRef = ref(database, `users/${user.uid}/savedGameState`);
      remove(gameRef).catch(err => console.error("Error clearing cloud save:", err));
    } else {
      localStorage.removeItem("savedGameState");
    }
    setResumedGameState(null);
    setGameMode(null);
    setPlayStyle(null);
    setOnlineRole(null);
    setGameOver(false);
    setIsOnlineGameStarted(false);
    setPlayerTeam(null);
    setAiTeam(null);
    setPlayerDeck([]);
    setAiDeck([]);
    setPlayerFranchisePool([]);
    setAiFranchisePool([]);
  };

  // Show login screen if not signed in and not playing as guest
  // user===undefined means auth is still loading; null means not signed in
  if (user === undefined) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a1a', color: '#fff', fontSize: 24 }}>⏳ Loading...</div>;
  }

  if (!user && !isGuest) {
    return (
      <>
        <LoginConflictModal isOpen={loginConflict} onClose={() => setLoginConflict(false)} />
        <LoginScreen 
          onContinueAsGuest={() => setIsGuest(true)} 
          onAuthSuccess={(finalUser) => setUser(finalUser)}
        />
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
        savedGameState={savedGameState}
        unlockedIds={unlockedIds}
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
        setTurn={setTurn}
        setWeather={setWeather}
        setMoisture={setMoisture}
        setPitchCondition={setPitchCondition}
        setPlayerFranchisePool={setPlayerFranchisePool}
        setAiFranchisePool={setAiFranchisePool}
        setTossCaller={setTossCaller}
        teams={teams}
      />
    );
  }

  if ((gameMode === "tournament" || gameMode === "team") && !aiTeam && (!isOnlineGameStarted || playStyle !== "online")) {
    return (
      <TournamentMode
        teams={teams}
        setGameMode={setGameMode}
        gameMode={gameMode}
        playStyle={playStyle}
        setPlayStyle={setPlayStyle}
        tournamentState={tournamentState}
        setTournamentState={setTournamentState}
        startMatch={(teamA, teamB, modeStyle, matchInfo) => {
          setPlayerTeam(teamA);
          setAiTeam(teamB);
          setPlayStyle(modeStyle);
          setActiveTournamentMatch(matchInfo);
        }}
        simulateLeagueMatch={simulateLeagueMatch}
        simulatePrecedingMatches={simulatePrecedingMatches}
        simulateAllRemainingMatches={simulateAllRemainingMatches}
        advanceTournamentRound={advanceTournamentRound}
        simulatePlayoffMatch={simulatePlayoffMatch}
        hallOfFame={hallOfFame}
        tournamentHistory={tournamentHistory}
      />
    );
  }

  if (!turn) return <h2>Loading...</h2>;

  if (isTimeMode && gameOver) {
    let resultTitle = "";
    const isPlayerWin = playerDeck.length > aiDeck.length;
    if (playerDeck.length > aiDeck.length)
      resultTitle = playStyle === "online" ? "YOU WIN 🏆" : "PLAYER WINS 🏆 (Time Mode)";
    else if (aiDeck.length > playerDeck.length)
      resultTitle = playStyle === "online" ? "YOU LOSE 😢" : "AI WINS 😈 (Time Mode)";
    else resultTitle = "DRAW 🤝 (Time Mode)";
    return <ResultScreen title={resultTitle} buttonText="Back to Home" onBack={clearSaveAndGoHome} matchStats={buildMatchStats(isPlayerWin)} />;
  }

  if (isBattleMode && playerHP <= 0) {
    return <ResultScreen title={playStyle === "online" ? "YOU LOSE 😢" : "AI WINS 😈 (Battle Mode)"} buttonText="Back" onBack={clearSaveAndGoHome} matchStats={buildMatchStats(false)} />;
  }
  if (isBattleMode && aiHP <= 0) {
    return <ResultScreen title={playStyle === "online" ? "YOU WIN 🏆" : "PLAYER WINS 🏆 (Battle Mode)"} buttonText="Back" onBack={clearSaveAndGoHome} matchStats={buildMatchStats(true)} />;
  }

  if (gameMode === "team" && playStyle !== "online" && (gameOver || cricketWinner)) {
    const isPlayerWin = cricketWinner === "player";
    const isCampaign = !!activeTournamentMatch;
    let title = "";
    if (cricketWinner === "tie") title = "MATCH TIED! 🤝";
    else title = isPlayerWin ? "YOU WIN! 🏆" : "AI WINS! 😈";

    return (
      <ResultScreen
        title={title}
        buttonText={isCampaign ? "Continue Standings" : "Back to Home"}
        onBack={isCampaign ? () => {
          const runDiff = Math.abs(cricketScore.player.runs - cricketScore.ai.runs);
          updateTournamentProgress(isPlayerWin, runDiff);
        } : clearSaveAndGoHome}
        gameMode="team"
        cricketScore={cricketScore}
        playerTeam={playerTeam}
        aiTeam={aiTeam}
        overHistory={overHistory}
      />
    );
  }

  if (playStyle !== "online" && (playerDeck.length === 0 || aiDeck.length === 0)) {
    const isPlayerWin = aiDeck.length === 0;
    if (gameMode === "tournament") {
      const isSpectator = playStyle === "ai_vs_ai";
      const winTitle = isSpectator ? `${playerTeam} WINS! 🏆` : "MATCH WON! 🎉";
      const loseTitle = isSpectator ? `${aiTeam} WINS! 🏆` : "MATCH LOST! 😢";
      return (
        <ResultScreen 
          title={isPlayerWin ? winTitle : loseTitle} 
          buttonText="Continue Standings" 
          onBack={() => updateTournamentProgress(isPlayerWin)}
          matchStats={!isSpectator ? buildMatchStats(isPlayerWin) : undefined}
        />
      );
    }
    return <ResultScreen title={isPlayerWin ? "PLAYER WINS 🏆" : "AI WINS 😈"} buttonText="Back to Home" onBack={clearSaveAndGoHome} matchStats={buildMatchStats(isPlayerWin)} />;
  }

  if (playStyle === "online" && (playerDeck.length === 0 || aiDeck.length === 0)) {
    const isPlayerWin = aiDeck.length === 0;
    if (gameMode === "tournament") {
      return (
        <ResultScreen 
          title={isPlayerWin ? "YOU WIN MATCH! 🎉" : "YOU LOSE MATCH! 😢"} 
          buttonText="Continue Standings" 
          onBack={() => updateTournamentProgress(isPlayerWin)}
          matchStats={buildMatchStats(isPlayerWin)}
        />
      );
    }
    return <ResultScreen title={isPlayerWin ? "YOU WIN 🏆" : "YOU LOSE 😢"} buttonText="Back to Home" onBack={clearSaveAndGoHome} matchStats={buildMatchStats(isPlayerWin)} />;
  }

  return (
    <div>
      <ExitConfirmationModal 
        isOpen={showConfirm} 
        gameMode={gameMode} 
        aiTeam={aiTeam} 
        onConfirm={confirmGoHome} 
        onCancel={cancelGoHome} 
      />

      <ReconnectModal 
        isOpen={opponentDisconnected} 
        timeLeft={disconnectTimeLeft} 
      />

      <OpponentLeftModal 
        isOpen={opponentLeft} 
        onClose={() => { setOpponentLeft(false); confirmGoHome(); }} 
      />

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
          playerTeam={playerTeam}
          aiTeam={aiTeam}
          cricketScore={cricketScore}
          battingTeam={battingTeam}
          currentInnings={currentInnings}
          targetScore={targetScore}
          oversLimit={oversLimit}
        />

        {player && ai ? (
          turn === "toss" ? (
            <TossScreen
              playStyle={playStyle}
              onlineRole={onlineRole}
              tossCaller={tossCaller}
              playerTeam={playerTeam || "Player"}
              aiTeam={aiTeam || "Opponent"}
              socket={socket}
              gameMode={gameMode}
              matchIntensity={matchIntensity}
              onTossComplete={(finalTurn, tossDecision) => {
                setTurn(finalTurn);
                if (gameMode === "team") {
                  setBattingTeam(finalTurn);
                }
              }}
            />
          ) : (
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
              playerSwapsLeft={playerSwapsLeft}
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
              playerTeam={playerTeam}
              aiTeam={aiTeam}
              playerFranchisePool={playerFranchisePool}
              superOverBanner={superOverBanner}
              
              battingTeam={battingTeam}
              currentInnings={currentInnings}
              targetScore={targetScore}
              oversLimit={oversLimit}
              cricketScore={cricketScore}
              overHistory={overHistory}
              isInningsBreak={isInningsBreak}
              startSecondInnings={startSecondInnings}
              overSummary={overSummary}
            />
          )
        ) : (
          <div className="loading">Checking winner...</div>
        )}

        <EmotePanel 
          playStyle={playStyle} 
          roomId={localStorage.getItem("roomId")} 
        />
      </div>

      {/* Achievement Badge Toast */}
      {newToast && (
        <div className="achievement-toast" onClick={dismissToast}>
          <div className="achievement-toast-icon">{newToast.emoji}</div>
          <div className="achievement-toast-body">
            <div className="achievement-toast-title">Achievement Unlocked!</div>
            <div className="achievement-toast-label">{newToast.label}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;