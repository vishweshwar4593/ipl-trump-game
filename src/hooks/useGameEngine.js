import { useState, useCallback, useEffect, useRef } from "react";
import socket from "../socket";
import { STAT_WEIGHTS } from "../App";

const LOWER_BETTER = ["economy", "bowlingAvg", "bowlingSR"];
const battingStats = ["runs", "matches", "hs", "battingAvg", "battingSR", "hundreds", "fifties", "catches"];
const bowlingStats = ["wickets", "economy", "bowlingAvg", "bowlingSR"];

function shuffle(array) {
  return [...array].sort(() => Math.random() - 0.5);
}

export function useGameEngine({
  gameMode,
  playStyle,
  isBattleMode,
  isMultiplayerMode,
  playerTeam,
  aiTeam,
  playClick,
  playWin,
  playLose,
  playHit,
  MAX_HP = 500,
  TURN_TIMEOUT = 15000,
  players,
  resumedGameState,
  onlineRole
}) {
  const [selectedStat, setSelectedStat] = useState(null);
  const [winner, setWinner] = useState(null);
  const [round, setRound] = useState(1);
  const [animate, setAnimate] = useState(false);
  const [playerDeck, setPlayerDeck] = useState([]);
  const [aiDeck, setAiDeck] = useState([]);
  const [turn, setTurn] = useState(null);
  const [drawPile, setDrawPile] = useState([]);
  const [showPlayerCard, setShowPlayerCard] = useState(false);
  const [showAiCard, setShowAiCard] = useState(false);
  const [playerHP, setPlayerHP] = useState(MAX_HP);
  const [aiHP, setAiHP] = useState(MAX_HP);
  const [turnTimerKey, setTurnTimerKey] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const player = playerDeck[0];
  const ai = aiDeck[0];

  // ✅ FIX 3: Keep a ref to drawPile so handleStatClick always reads the latest value
  // without needing it in the useCallback dependency array (avoids stale closure).
  const drawPileRef = useRef(drawPile);
  useEffect(() => { drawPileRef.current = drawPile; }, [drawPile]);

  useEffect(() => {
    if (!gameMode) return;
    // For offline team mode, wait until both teams are chosen locally.
    // For online team mode, teams arrive with startGame so skip this guard.
    if (gameMode === "team" && playStyle !== "online" && (!playerTeam || !aiTeam)) return;

    if (resumedGameState) {
      setPlayerDeck(resumedGameState.playerDeck);
      setAiDeck(resumedGameState.aiDeck);
      setTurn(resumedGameState.turn);
      setRound(resumedGameState.round);
      setPlayerHP(resumedGameState.playerHP);
      setAiHP(resumedGameState.aiHP);
      setSelectedStat(null);
      setWinner(null);
      setDrawPile([]);
      return;
    }

    if (gameMode === "battle") {
      setPlayerHP(MAX_HP);
      setAiHP(MAX_HP);
    }

    if (playStyle === "online") {
      // Decks are injected by OnlineMode via setPlayerDeck/setAiDeck when the
      // "startGame" socket event fires. Toss is deferred to a separate effect
      // below so it only runs AFTER decks exist (prevents handleStatClick from
      // firing against undefined player/ai on the very first turn).
    } else if (gameMode === "team") {
      const playerPlayers = players.filter(p => p.team === playerTeam);
      const aiPlayers = players.filter(p => p.team === aiTeam);
      setPlayerDeck(shuffle(playerPlayers));
      setAiDeck(shuffle(aiPlayers));
    } else {
      const shuffled = shuffle(players);
      const half = Math.floor(shuffled.length / 2);
      setPlayerDeck(shuffled.slice(0, half));
      setAiDeck(shuffled.slice(half));
    }

    // Offline-only toss — online toss is handled after decks arrive (see effect below).
    if (playStyle !== "online") {
      const tossWinner = Math.random() > 0.5 ? "player" : "ai";
      setTurn(tossWinner);
    }
    setRound(1);
    setSelectedStat(null);
    setWinner(null);
    setDrawPile([]);
  // onlineRole intentionally removed — no longer used in this effect.
  }, [gameMode, playerTeam, aiTeam, players, MAX_HP, resumedGameState, playStyle]);

  // ✅ FIX: Deferred online toss — only runs once both decks have been injected
  // by OnlineMode's "startGame" handler. Previously setTurn fired before
  // setPlayerDeck/setAiDeck, causing handleStatClick to run against undefined
  // player/ai on the first turn and potentially crashing or silently no-op'ing.
  useEffect(() => {
    if (playStyle !== "online") return;
    if (!playerDeck.length || !aiDeck.length) return; // decks not yet injected
    if (turn !== null) return;                        // toss already set — don't override mid-game
    const tossWinner = onlineRole === "creator" ? "player" : "ai";
    setTurn(tossWinner);
  }, [playStyle, playerDeck, aiDeck, turn, onlineRole]);

  // ✅ FIX 5: Auto-Save Logic — debounced 400ms to avoid blocking main thread during animations.
  // Also saves playStyle so resume correctly restores local/multiplayer games.
  useEffect(() => {
    if (!gameMode || playStyle === "online" || gameOver || selectedStat !== null) return;
    if (playerDeck.length === 0 || aiDeck.length === 0) return;

    const timer = setTimeout(() => {
      const saveData = {
        gameMode,
        playStyle,          // ✅ FIX 4: was missing — resume was always defaulting to "ai"
        isBattleMode,
        isMultiplayerMode,
        playerTeam,
        aiTeam,
        playerDeck,
        aiDeck,
        turn,
        round,
        playerHP,
        aiHP
      };
      localStorage.setItem("savedGameState", JSON.stringify(saveData));
    }, 400); // debounce — only write once the state has settled

    return () => clearTimeout(timer);
  }, [playerDeck, aiDeck, turn, round, playerHP, aiHP, gameMode, isBattleMode, isMultiplayerMode, playerTeam, aiTeam, gameOver, selectedStat, playStyle]);

  const getBestStat = useCallback((playerObj) => {
    if (!playerObj) return "runs";
    const runs = playerObj.runs ?? 0;
    const wickets = playerObj.wickets ?? 0;

    let playerType;
    if (runs > wickets * 20) {
      playerType = "batsman";
    } else if (wickets > runs / 50) {
      playerType = "bowler";
    } else {
      playerType = "allrounder";
    }

    let statsPool;
    if (playerType === "batsman") {
      statsPool = battingStats;
    } else if (playerType === "bowler") {
      statsPool = bowlingStats;
    } else {
      statsPool = [...battingStats, ...bowlingStats];
    }

    let bestStat = null;
    let bestScore = -Infinity;

    statsPool.forEach(stat => {
      let value = playerObj[stat] ?? 0;
      if (value === 0) return;

      let score;
      if (LOWER_BETTER.includes(stat)) {
        score = 1 / value;
        if (stat === "economy") score *= 2.5;
        if (stat === "bowlingAvg") score *= 2;
        if (stat === "bowlingSR") score *= 1.8;
      } else {
        score = Math.log(value + 1);
        if (stat === "battingSR") score *= 2.5;
        if (stat === "battingAvg") score *= 2.5;
        if (stat === "runs") score *= 1.7;
      }

      if (playerType === "batsman") score += Math.random() * 0.4;
      else if (playerType === "bowler") score += Math.random() * 0.3;
      else score += Math.random() * 0.5;

      if (score > bestScore) {
        bestScore = score;
        bestStat = stat;
      }
    });

    if (!bestStat) {
      const fallbackStats = ["runs", "wickets", "catches"];
      return fallbackStats[Math.floor(Math.random() * fallbackStats.length)];
    }
    return bestStat;
  }, []);

const handleTurnTimeout = useCallback(() => {
    if (!player || !ai || selectedStat !== null || animate || gameOver) return;

    // When player times out, their card goes to the opponent
    if (turn === "player") {
      setWinner("ai");
      setShowPlayerCard(true);
      setShowAiCard(true);
      setAnimate(true);
      
      // Play lose sound for timeout
      playLose();

      setTimeout(() => {
        // Remove player's current card and give it to AI (opponent gets the timed-out card)
        const timedOutCard = player;
        setPlayerDeck(prev => prev.slice(1));
        setAiDeck(prev => {
          const currentAiCard = prev[0];
          return [...prev.slice(1), currentAiCard, timedOutCard];
        });
        setDrawPile([]);
        setTurn("ai");
        setSelectedStat(null);
        setWinner(null);
        setAnimate(false);
        setRound(prev => prev + 1);
        setShowAiCard(false);
      }, 1500);
    } else if (isMultiplayerMode && turn === "ai") {
      // When AI/Player 2 times out in multiplayer, their card goes to player
      setWinner("player");
      setShowPlayerCard(true);
      setShowAiCard(true);
      setAnimate(true);
      
      // Play win sound for timeout (player gets opponent's card)
      playWin();

      setTimeout(() => {
        // Remove AI's current card and give it to player (player gets the timed-out card)
        const timedOutCard = ai;
        setAiDeck(prev => prev.slice(1));
        setPlayerDeck(prev => {
          const currentPlayerCard = prev[0];
          return [...prev.slice(1), currentPlayerCard, timedOutCard];
        });
        setDrawPile([]);
        setTurn("player");
        setSelectedStat(null);
        setWinner(null);
        setAnimate(false);
        setRound(prev => prev + 1);
        setShowAiCard(false);
      }, 1500);
    } else if (turn === "ai" && !isMultiplayerMode) {
      // When AI times out in offline mode, their card goes to player
      setWinner("player");
      setShowPlayerCard(true);
      setShowAiCard(true);
      setAnimate(true);
      
      // Play win sound for timeout (player gets AI's card)
      playWin();

      setTimeout(() => {
        // Remove AI's current card and give it to player
        const timedOutCard = ai;
        setAiDeck(prev => prev.slice(1));
        setPlayerDeck(prev => {
          const currentPlayerCard = prev[0];
          return [...prev.slice(1), currentPlayerCard, timedOutCard];
        });
        setDrawPile([]);
        setTurn("player");
        setSelectedStat(null);
        setWinner(null);
        setAnimate(false);
        setRound(prev => prev + 1);
        setShowAiCard(false);
      }, 1500);
    }
  }, [player, ai, selectedStat, animate, gameOver, turn, isMultiplayerMode, playLose, playWin]);

  const handleStatClick = useCallback((stat, isRemote = false) => {
    // In online mode, the local user is always "player". Block clicks if it's not their turn.
    if (playStyle === "online" && !isRemote && turn !== "player") return;

    if (playStyle === "online" && !isRemote) {
      const roomId = localStorage.getItem("roomId");
      socket.emit("playStat", { roomId, stat });
    }

    if (!player || !ai || gameOver) return;
    if (!isRemote && selectedStat !== null) return;

    playClick();

    const playerValue = player[stat];
    const aiValue = ai[stat];
    // ✅ FIX 3: Always read the latest drawPile via ref — avoids stale closure bug
    const currentDrawPile = drawPileRef.current;
    let damage = 0;

    if (isBattleMode && playerValue !== undefined && aiValue !== undefined) {
      const maxVal = Math.max(playerValue, aiValue, 1);
      const diff = Math.abs(playerValue - aiValue) / maxVal;
      const weight = STAT_WEIGHTS[stat] || 1;
      damage = diff * 100 * weight;
      damage = Math.max(damage, 8);
      damage = Math.round(damage);
    }

    let result;
    if (["economy", "bowlingAvg", "bowlingSR"].includes(stat)) {
      if (playerValue === 0 && aiValue > 0) result = "ai";
      else if (aiValue === 0 && playerValue > 0) result = "player";
      else if (playerValue === 0 && aiValue === 0) result = "draw";
      else {
        if (playerValue < aiValue) result = "player";
        else if (aiValue < playerValue) result = "ai";
        else result = "draw";
      }
    } else {
      if (playerValue > aiValue) result = "player";
      else if (aiValue > playerValue) result = "ai";
      else result = "draw";
    }

    setSelectedStat(stat);
    setShowPlayerCard(true);
    setShowAiCard(true);

    setTimeout(() => {
      setWinner(result);
      if (result === "player") {
        playWin();
        setTimeout(() => playHit(), 150);
      } else if (result === "ai") {
        playLose();
        setTimeout(() => playHit(), 150);
      }
    }, 300);

    setTimeout(() => setAnimate(true), 500);

    setTimeout(() => {
      if (result === "player") {
        if (isBattleMode) setAiHP(prev => Math.max(prev - damage, 0));
        if (gameMode === "team") {
          setPlayerDeck(prev => {
            const currentPlayerCard = prev[0];
            return [...prev.slice(1), currentPlayerCard];
          });
        } else {
          setPlayerDeck(prev => {
            const currentPlayerCard = prev[0];
            return [...prev.slice(1), currentPlayerCard, ai, ...currentDrawPile];
          });
        }
        setAiDeck(prev => prev.slice(1));
        setDrawPile([]);
      } else if (result === "ai") {
        if (isBattleMode) setPlayerHP(prev => Math.max(prev - damage, 0));
        if (gameMode === "team") {
          setAiDeck(prev => {
            const currentAiCard = prev[0];
            return [...prev.slice(1), currentAiCard];
          });
        } else {
          setAiDeck(prev => {
            const currentAiCard = prev[0];
            return [...prev.slice(1), currentAiCard, player, ...currentDrawPile];
          });
        }
        setPlayerDeck(prev => prev.slice(1));
        setDrawPile([]);
      } else {
        if (gameMode === "team") {
          setDrawPile([]);
        } else {
          setDrawPile(prev => shuffle([...prev, player, ai]));
        }
        setPlayerDeck(prev => prev.slice(1));
        setAiDeck(prev => prev.slice(1));
      }

      // In offline team mode: remove any cross-team cards after captures
      // In online team mode: server already dealt pure team decks; captures are discarded
      // by the slice/no-push logic above, so no extra filter needed online
      if (gameMode === "team" && playStyle !== "online") {
        setPlayerDeck(prev => prev.filter(p => p?.team === playerTeam));
        setAiDeck(prev => prev.filter(p => p?.team === aiTeam));
      }

      setSelectedStat(null);
      setWinner(null);
      setAnimate(false);
      setShowAiCard(false);
      setRound(prev => prev + 1);

      // The winner gets the next turn.
      // Each client stores THEMSELVES as "player", so result="player" always means local user won.
      if (result === "player") setTurn("player");
      else if (result === "ai") setTurn("ai");
      // draw: turn stays unchanged
    }, 2000);
  }, [player, ai, selectedStat, isBattleMode, gameOver, gameMode, playStyle, playerTeam, aiTeam, playClick, playHit, playLose, playWin, turn]);
  // ✅ FIX 3: drawPile removed from deps — now read via drawPileRef to prevent stale closure

  // ✅ FIX 2: Keep a stable ref to the latest handleStatClick so the socket listener
  // can always call the freshest version without re-registering on every render.
  const handleStatClickRef = useRef(handleStatClick);
  useEffect(() => { handleStatClickRef.current = handleStatClick; }, [handleStatClick]);

  // ✅ FIX 2: Register "bothPlayed" listener exactly ONCE.
  // Previously it re-registered every time handleStatClick changed (many deps),
  // causing multiple handlers to fire simultaneously for a single event.
  useEffect(() => {
    const handler = (stat) => handleStatClickRef.current(stat, true);
    socket.on("bothPlayed", handler);
    return () => socket.off("bothPlayed", handler); // ✅ remove only this specific handler
  }, []); // empty deps — intentional, handler ref keeps it fresh

  useEffect(() => {
    if (!turn) return;
    if (playStyle === "online") {
      if (selectedStat === null) {
        // Always show your own card, hide opponent's
        setShowPlayerCard(true);
        setShowAiCard(false);
        // Only increment timer on your own turn (turn=player means local user's turn)
        if (turn === "player") setTurnTimerKey(prev => prev + 1);
      }
    } else {
      if (turn === "player" && selectedStat === null) {
        setShowPlayerCard(true);
        setShowAiCard(false);
        setTurnTimerKey(prev => prev + 1);
      }
      if (turn === "ai" && selectedStat === null) {
        setShowPlayerCard(false);
        setShowAiCard(true);
        if (isMultiplayerMode) {
          setTurnTimerKey(prev => prev + 1);
        }
      }
    }

    if (
      playStyle !== "online" &&
      !isMultiplayerMode &&
      turn === "ai" &&
      !selectedStat &&
      ai &&
      !gameOver
    ) {
      const bestStat = getBestStat(ai);
      const timer = setTimeout(() => {
        handleStatClick(bestStat);
      }, 1000);
      return () => clearTimeout(timer);
    }

const shouldRunTimeout =
      selectedStat === null &&
      !gameOver &&
      // ✅ FIX: simplified — `turn === "ai"` already covers the multiplayer P2 case
      !!turn;

    if (shouldRunTimeout) {
      const timeout = setTimeout(() => {
        handleTurnTimeout();
      }, TURN_TIMEOUT);
      return () => clearTimeout(timeout);
    }
  }, [
    turn,
    ai,
    selectedStat,
    handleStatClick,
    isMultiplayerMode,
    gameOver,
    handleTurnTimeout,
    gameMode,
    getBestStat,
    TURN_TIMEOUT,
    playStyle
  ]);

  return {
    selectedStat, setSelectedStat,
    winner, setWinner,
    round, setRound,
    animate, setAnimate,
    playerDeck, setPlayerDeck,
    aiDeck, setAiDeck,
    turn, setTurn,
    drawPile, setDrawPile,
    showPlayerCard, setShowPlayerCard,
    showAiCard, setShowAiCard,
    playerHP, setPlayerHP,
    aiHP, setAiHP,
    turnTimerKey, setTurnTimerKey,
    gameOver, setGameOver,
    player, ai,
    handleStatClick,
    handleTurnTimeout,
    getBestStat,
    TURN_TIMEOUT
  };
}
