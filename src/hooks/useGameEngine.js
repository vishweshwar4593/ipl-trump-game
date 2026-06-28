import { useState, useCallback, useEffect, useRef } from "react";
import socket from "../socket";
import { 
  getRoundStage, 
  getPlayerRole, 
  getModifiedStat, 
  getNextWeather, 
  LOWER_BETTER, 
  battingStats, 
  bowlingStats, 
  STAT_WEIGHTS 
} from "../utils/gameRules";
import { 
  CRICKET_CONFIG, 
  getNormalizedStat, 
  calculateOverRuns 
} from "../utils/cricketEngine";


const getClutchReplacementsScore = (card, gameMode, round, pitchCondition, weather, moisture) => {
  if (!card) return 0;
  let score = 0;
  const role = getPlayerRole(card);
  const runs = card.runs ?? 0;
  const wickets = card.wickets ?? 0;

  const stage = getRoundStage(round);
  const isPowerplay = stage === "powerplay";
  const isMiddleOvers = stage === "middle";
  const isDeathOvers = stage === "death";

  if (isPowerplay && role === "batsman") score += 100;
  if (isDeathOvers && role === "pace") score += 100;
  if (isMiddleOvers && (role === "allrounder" || role === "spinner")) score += 50;

  if (pitchCondition) {
    if (pitchCondition === "green" && role === "pace") score += 50;
    if (pitchCondition === "dusty" && role === "spinner") score += 50;
  }
  if (weather === "cloudy" && role === "pace") score += 30;
  if (weather === "dew" && (role === "batsman" || role === "allrounder")) score += 40;

  score += Math.max(runs / 100, wickets);
  return score;
};

export function getClutchReplacements(pool, gameMode, round, pitchCondition, weather, moisture) {
  if (!pool || pool.length === 0) return [];
  if (pool.length === 1) return [pool[0]];

  const scoredCards = pool.map(card => {
    const score = getClutchReplacementsScore(card, gameMode, round, pitchCondition, weather, moisture) + Math.random() * 15;
    return { card, score };
  });

  const sorted = scoredCards.sort((a, b) => b.score - a.score);
  return [sorted[0].card, sorted[1].card];
}

const shouldAISwap = (aiCard, roundNumber, pitchCondition, weather, moisture, aiSwapUsed, aiDeckLength) => {
  if (aiSwapUsed || aiDeckLength < 3 || !aiCard) return false;
  
  const role = getPlayerRole(aiCard);
  const isPace = role === "pace";
  const isSpinner = role === "spinner";
  const isBatsman = role === "batsman";
  
  const stage = getRoundStage(roundNumber);
  const isPowerplay = stage === "powerplay";
  const isDeathOvers = stage === "death";

  if (isDeathOvers && isBatsman) return true;
  if (isPowerplay && (isSpinner || isPace)) return true;

  if (pitchCondition) {
    if (pitchCondition === "green" && isSpinner) return true;
    if (pitchCondition === "dusty" && isPace) return true;
    if (weather === "dew" && isSpinner) return true;
  }

  const maxRuns = aiCard.runs ?? 0;
  const maxWickets = aiCard.wickets ?? 0;
  if (maxRuns < 500 && maxWickets < 15) return true;

  return false;
};

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
  TURN_TIMEOUT = 12000,
  players,
  resumedGameState,
  onlineRole,
  user,
  isGuest,
  showConfirm = false,
  tournamentStateRef
}) {
  const activeTournamentState = tournamentStateRef?.current;
  const [selectedStat, setSelectedStat] = useState(null);
  const [winner, setWinner] = useState(null);
  const [round, setRound] = useState(1);
  const [animate, setAnimate] = useState(false);
  const [playerDeck, setPlayerDeck] = useState([]);
  const [aiDeck, setAiDeck] = useState([]);
  const [playerFranchisePool, setPlayerFranchisePool] = useState([]);
  const [aiFranchisePool, setAiFranchisePool] = useState([]);
  const [turn, setTurn] = useState(null);
  const [drawPile, setDrawPile] = useState([]);
  const [superOverActive, setSuperOverActive] = useState(false);
  const [superOverBanner, setSuperOverBanner] = useState(false);
  const [showPlayerCard, setShowPlayerCard] = useState(false);
  const [showAiCard, setShowAiCard] = useState(false);
  const [playerHP, setPlayerHP] = useState(MAX_HP);
  const [aiHP, setAiHP] = useState(MAX_HP);
  const [turnTimerKey, setTurnTimerKey] = useState(0);
  const [playerSwapsLeft, setPlayerSwapsLeft] = useState(1);
  const playerSwapUsed = playerSwapsLeft <= 0; // backwards-compat alias
  const [aiSwapUsed, setAiSwapUsed] = useState(false);
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [swapCandidates, setSwapCandidates] = useState([]);
  const [swapAnnouncement, setSwapAnnouncement] = useState(null);
  const [swapGraceActive, setSwapGraceActive] = useState(true);
  const [swapGraceTimeLeft, setSwapGraceTimeLeft] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [pitchCondition, setPitchCondition] = useState(null);
  const [weather, setWeather] = useState(null);
  const [moisture, setMoisture] = useState(null);
  const [swapTimer, setSwapTimer] = useState(5);
  const [consecutiveTurns, setConsecutiveTurns] = useState(1);
  const [overAnnouncement, setOverAnnouncement] = useState(null);
  // Feature 3: stat history for post-match summary
  const [statHistory, setStatHistory] = useState([]);
  // Feature badges: track if player was ever behind (Survivor badge)
  const [wasEverBehind, setWasEverBehind] = useState(false);

  // Cricket States
  const [oversLimit, setOversLimit] = useState(5);
  const [currentInnings, setCurrentInnings] = useState(1);
  const [battingTeam, setBattingTeam] = useState(null);
  const [targetScore, setTargetScore] = useState(null);
  const [matchIntensity, setMatchIntensity] = useState(1.0);
  const [matchMomentum, setMatchMomentum] = useState(1.0);
  const [overSummary, setOverSummary] = useState("");
  const [overHistory, setOverHistory] = useState([]);
  const [cricketScore, setCricketScore] = useState({
    player: { runs: 0, wickets: 0, oversCompleted: 0 },
    ai: { runs: 0, wickets: 0, oversCompleted: 0 }
  });
  const [isInningsBreak, setIsInningsBreak] = useState(false);
  const [cricketWinner, setCricketWinner] = useState(null);

  const player = playerDeck[0];
  const ai = aiDeck[0];

  const showConfirmRef = useRef(showConfirm);
  useEffect(() => {
    showConfirmRef.current = showConfirm;
  }, [showConfirm]);

  // ✅ FIX 3: Keep a ref to drawPile so handleStatClick always reads the latest value
  // without needing it in the useCallback dependency array (avoids stale closure).
  const drawPileRef = useRef(drawPile);
  useEffect(() => { drawPileRef.current = drawPile; }, [drawPile]);

  useEffect(() => {
    if (playStyle === "online") return;
    if (gameMode !== "time" && gameMode !== "battle") {
      setPitchCondition(null);
      setWeather(null);
      setMoisture(null);
      return;
    }
    
    // Initialize on Round 1
    if (round === 1) {
      const initialWeathers = ["sunny", "cloudy", "windy"];
      const startWeather = initialWeathers[Math.floor(Math.random() * initialWeathers.length)];
      setWeather(startWeather);
      
      const startMoisture = startWeather === "sunny" ? 60 : startWeather === "windy" ? 70 : 85;
      setMoisture(startMoisture);
      
      const startPitch = startMoisture >= 75 ? "green" : startMoisture >= 50 ? "balanced" : startMoisture >= 25 ? "dry" : "dusty";
      setPitchCondition(startPitch);
      return;
    }
    
    // Transition on every subsequent round
    setWeather(prevWeather => {
      if (!prevWeather) return "sunny";
      const nextWeather = getNextWeather(prevWeather, round);
      
      let change = 0;
      if (prevWeather === "sunny") {
        change = -(10 + Math.floor(Math.random() * 9)); // Sunny dries -10 to -18
      } else if (prevWeather === "windy") {
        change = -(5 + Math.floor(Math.random() * 8)); // Windy dries -5 to -12
      } else if (prevWeather === "cloudy") {
        change = -(1 + Math.floor(Math.random() * 4)); // Cloudy dries -1 to -4
      } else if (prevWeather === "dew") {
        change = 6 + Math.floor(Math.random() * 9); // Dew increases +6 to +14
      }
      
      setMoisture(prevMoisture => {
        const baseMoisture = prevMoisture ?? 70;
        const nextMoisture = Math.min(Math.max(baseMoisture + change, 0), 100);
        
        const nextPitch = nextMoisture >= 75 ? "green" : nextMoisture >= 50 ? "balanced" : nextMoisture >= 25 ? "dry" : "dusty";
        setPitchCondition(nextPitch);
        
        return nextMoisture;
      });
      
      return nextWeather;
    });
  }, [round, gameMode, playStyle]);

  useEffect(() => {
    // Reset swap grace on every round increment
    setSwapGraceActive(true);
    setSwapGraceTimeLeft(1);
  }, [round]);

  useEffect(() => {
    if (!swapGraceActive) return;
    const interval = setInterval(() => {
      setSwapGraceTimeLeft(prev => {
        if (showConfirmRef.current) return prev;
        if (prev <= 1) {
          clearInterval(interval);
          setSwapGraceActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [swapGraceActive]);

  useEffect(() => {
    if (!gameMode) {
      setPlayerDeck([]);
      setAiDeck([]);
      setPlayerFranchisePool([]);
      setAiFranchisePool([]);
      setTurn(null);
      setRound(1);
      setSelectedStat(null);
      setWinner(null);
      setDrawPile([]);
      setPlayerHP(MAX_HP);
      setAiHP(MAX_HP);
      setPlayerSwapsLeft(1);
      setAiSwapUsed(false);
      setStatHistory([]);
      setWasEverBehind(false);
      setSwapModalOpen(false);
      setSwapCandidates([]);
      setSwapAnnouncement(null);
      setGameOver(false);
      setOverAnnouncement(null);
      setSuperOverActive(false);
      setSuperOverBanner(false);
      
      // Reset Cricket states
      setCurrentInnings(1);
      setBattingTeam(null);
      setTargetScore(null);
      setMatchIntensity(1.0);
      setMatchMomentum(1.0);
      setOverSummary("");
      setOverHistory([]);
      setCricketWinner(null);
      setIsInningsBreak(false);
      setCricketScore({
        player: { runs: 0, wickets: 0, oversCompleted: 0 },
        ai: { runs: 0, wickets: 0, oversCompleted: 0 }
      });
      return;
    }
    if (resumedGameState) {
      setPlayerDeck(resumedGameState.playerDeck);
      setAiDeck(resumedGameState.aiDeck);
      setPlayerFranchisePool(resumedGameState.playerFranchisePool || []);
      setAiFranchisePool(resumedGameState.aiFranchisePool || []);
      setTurn(resumedGameState.turn);
      setRound(resumedGameState.round);
      setPlayerHP(resumedGameState.playerHP);
      setAiHP(resumedGameState.aiHP);
      setPlayerSwapsLeft(resumedGameState.playerSwapUsed ? 0 : 1);
      setAiSwapUsed(resumedGameState.aiSwapUsed ?? false);
      setConsecutiveTurns(resumedGameState.consecutiveTurns ?? 1);
      setSelectedStat(null);
      setWinner(null);
      setDrawPile([]);
      return;
    }

    if (gameMode === "battle") {
      setPlayerHP(MAX_HP);
      setAiHP(MAX_HP);
    }

    // Set swap token count: always 1
    setPlayerSwapsLeft(1);

    if (playStyle === "online") {
      // Decks are injected by OnlineMode via setPlayerDeck/setAiDeck when the
      // "startGame" socket event fires. Toss is deferred to a separate effect
      // below so it only runs AFTER decks exist (prevents handleStatClick from
      // firing against undefined player/ai on the very first turn).
    } else if (gameMode === "team" && playStyle !== "online") {
      // Cricket Campaign: deck + toss is handled by the dedicated initCricketMatch
      // useEffect below, which fires after playerTeam/aiTeam state has propagated.
      // We only need to reset cricket state here — NOT set up decks or turn.
      setPlayerDeck([]);
      setAiDeck([]);
      setCurrentInnings(1);
      setBattingTeam(null);
      setTargetScore(null);
      setCricketScore({ player: { runs: 0, wickets: 0, oversCompleted: 0 }, ai: { runs: 0, wickets: 0, oversCompleted: 0 } });
      setCricketWinner(null);
      setIsInningsBreak(false);
      setGameOver(false);
      setTurn(null);
      return;
    } else if (gameMode === "tournament") {
      let deckLimit = 7;
      if (activeTournamentState && activeTournamentState.stage === "playoffs" && activeTournamentState.playoffs) {
        const play = activeTournamentState.stage === "playoffs" ? activeTournamentState.playoffs : null;
        if (play) {
          const isFinalActive = play.final && play.final.home && !play.final.played && 
            (play.final.home === playerTeam || play.final.away === playerTeam || 
             play.final.home === aiTeam || play.final.away === aiTeam);
          if (isFinalActive) {
            deckLimit = 11;
          } else {
            deckLimit = 9;
          }
        }
      }

      const playerPlayers = players.filter(p => p.team === playerTeam);
      const aiPlayers = players.filter(p => p.team === aiTeam);

      const shuffledPlayer = shuffle(playerPlayers);
      setPlayerDeck(shuffledPlayer.slice(0, deckLimit));
      setPlayerFranchisePool(shuffledPlayer.slice(deckLimit));

      const shuffledAi = shuffle(aiPlayers);
      setAiDeck(shuffledAi.slice(0, deckLimit));
      setAiFranchisePool(shuffledAi.slice(deckLimit));
    } else {
      const shuffled = shuffle(players);
      const half = Math.floor(shuffled.length / 2);
      setPlayerDeck(shuffled.slice(0, half));
      setAiDeck(shuffled.slice(half));
      setPlayerFranchisePool([]);
      setAiFranchisePool([]);
    }

    // Offline-only toss — we show the Toss screen first!
    if (playStyle !== "online") {
      setTurn("toss");
    }
    setRound(1);
    setSelectedStat(null);
    setWinner(null);
    setDrawPile([]);
    setConsecutiveTurns(1);
    setPlayerSwapsLeft(1);
    setAiSwapUsed(false);
    setStatHistory([]);
    setWasEverBehind(false);
    setSwapModalOpen(false);
    setSwapCandidates([]);
    setSwapAnnouncement(null);
    setGameOver(false);
    setOverAnnouncement(null);
    setSuperOverActive(false);
    setSuperOverBanner(false);
  // onlineRole intentionally removed — no longer used in this effect.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameMode, playerTeam, aiTeam, players, MAX_HP, resumedGameState, playStyle, tournamentStateRef, oversLimit]);

  // (Online starting turn is now initialized and set by OnlineMode on "startGame")

  // Cricket Campaign: when teams are set and mode is "team" (offline), init the cricket match.
  // This runs AFTER playerTeam/aiTeam state has propagated so initCricketMatch reads fresh values.
  useEffect(() => {
    if (gameMode !== "team" || playStyle === "online") return;
    if (!playerTeam || !aiTeam) return;
    const overs = (tournamentStateRef?.current?.oversLimit) ? tournamentStateRef.current.oversLimit : 5;
    initCricketMatch(overs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameMode, playerTeam, aiTeam, playStyle]);

  // Note: Auto-save logic has been removed to ensure standard matches are lost permanently when closing, refreshing, or going home. Tournament campaign saves remain preserved in their separate flow.

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
    if (gameMode === "tournament") {
      const stage = getRoundStage(round);
      if (stage === "powerplay") {
        statsPool = ["runs", "hs", "battingAvg", "battingSR", "hundreds", "fifties"];
      } else if (stage === "middle") {
        statsPool = ["matches", "catches"];
      } else {
        statsPool = ["wickets", "economy", "bowlingAvg", "bowlingSR"];
      }
    } else {
      if (playerType === "batsman") {
        statsPool = battingStats;
      } else if (playerType === "bowler") {
        statsPool = bowlingStats;
      } else {
        statsPool = [...battingStats, ...bowlingStats];
      }
    }

    let bestStat = null;
    let bestScore = -Infinity;

    statsPool.forEach(stat => {
      let value = getModifiedStat(playerObj, stat, pitchCondition, weather, moisture);
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
      if (gameMode === "team" || gameMode === "tournament") {
        return statsPool[Math.floor(Math.random() * statsPool.length)];
      }
      const fallbackStats = ["runs", "wickets", "catches"];
      return fallbackStats[Math.floor(Math.random() * fallbackStats.length)];
    }
    return bestStat;
  }, [gameMode, round, pitchCondition, weather, moisture]);

  // Cricket Helper Hooks
  const initCricketMatch = useCallback((formatOvers) => {
    setOversLimit(formatOvers);
    const intensity = 0.8 + (Math.random() * 0.4);
    setMatchIntensity(intensity);
    setMatchMomentum(CRICKET_CONFIG.MOMENTUM_FACTORS.STARTING);
    setOverHistory([]);
    setOverSummary("");
    setCricketWinner(null);
    setIsInningsBreak(false);
    setCurrentInnings(1);
    setRound(1);
    setTargetScore(null);
    setCricketScore({
      player: { runs: 0, wickets: 0, oversCompleted: 0 },
      ai: { runs: 0, wickets: 0, oversCompleted: 0 }
    });

    const playerPlayers = players.filter(p => p.team === playerTeam);
    const aiPlayers = players.filter(p => p.team === aiTeam);
    const shuffledPlayer = shuffle(playerPlayers);
    const shuffledAi = shuffle(aiPlayers);
    
    setPlayerDeck(shuffledPlayer.slice(0, formatOvers));
    setAiDeck(shuffledAi.slice(0, formatOvers));
    setPlayerFranchisePool(shuffledPlayer.slice(formatOvers));
    setAiFranchisePool(shuffledAi.slice(formatOvers));
    
    setTurn("toss");
    setGameOver(false);
  }, [playerTeam, aiTeam, players]);

  const startSecondInnings = useCallback(() => {
    const nextBat = battingTeam === "player" ? "ai" : "player";
    setBattingTeam(nextBat);
    setCurrentInnings(2);
    setRound(1);
    setTurn(nextBat);
    setIsInningsBreak(false);
    setMatchMomentum(CRICKET_CONFIG.MOMENTUM_FACTORS.STARTING);

    const playerPlayers = players.filter(p => p.team === playerTeam);
    const aiPlayers = players.filter(p => p.team === aiTeam);
    setPlayerDeck(shuffle(playerPlayers).slice(0, oversLimit));
    setAiDeck(shuffle(aiPlayers).slice(0, oversLimit));
  }, [battingTeam, players, playerTeam, aiTeam, oversLimit]);

const handleTurnTimeout = useCallback(() => {
    if (playStyle === "online") return;
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
        setConsecutiveTurns(1);
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
        setConsecutiveTurns(1);
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
        setConsecutiveTurns(1);
        setSelectedStat(null);
        setWinner(null);
        setAnimate(false);
        setRound(prev => prev + 1);
        setShowAiCard(false);
      }, 1500);
    }
  }, [player, ai, selectedStat, animate, gameOver, turn, isMultiplayerMode, playLose, playWin, playStyle]);

  const handleStatClick = useCallback((stat, isRemote = false) => {
    // In online mode, the local user is always "player". Block clicks if it's not their turn.
    if (playStyle === "online" && !isRemote && turn !== "player") return;

    if (playStyle === "online" && !isRemote) {
      const roomId = localStorage.getItem("roomId");
      socket.emit("playStat", { roomId, stat, roundNumber: round });
      return;
    }

    if (!player || !ai || gameOver) return;
    if (!isRemote && selectedStat !== null) return;

    playClick();

    const playerValue = getModifiedStat(player, stat, pitchCondition, weather, moisture);
    const aiValue = getModifiedStat(ai, stat, pitchCondition, weather, moisture);
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

    if (gameMode === "team" && playStyle !== "online") {
      const isPlayerBatting = battingTeam === "player";
      const batCard = isPlayerBatting ? player : ai;
      const bowlCard = isPlayerBatting ? ai : player;

      const pNorm = getNormalizedStat(player, stat);
      const aNorm = getNormalizedStat(ai, stat);
      const batNorm = isPlayerBatting ? pNorm : aNorm;
      const bowlNorm = isPlayerBatting ? aNorm : pNorm;

      // Also get raw stat values for a better run magnitude calculation
      const pRaw = getModifiedStat(player, stat, pitchCondition, weather, moisture) ?? 0;
      const aRaw = getModifiedStat(ai, stat, pitchCondition, weather, moisture) ?? 0;
      const batRaw = isPlayerBatting ? pRaw : aRaw;
      const bowlRaw = isPlayerBatting ? aRaw : pRaw;

      let roundResult = "dot";
      if (batNorm > bowlNorm) roundResult = "batting_win";
      else if (bowlNorm > batNorm) roundResult = "bowling_win";

      let runs = 0;
      let wicket = 0;
      let summaryText = "";

      if (roundResult === "batting_win") {
        // Use raw stat margin: difference as % of the larger value → gives proper 0-100 range
        const maxRaw = Math.max(batRaw, bowlRaw, 1);
        const winPct = ((batRaw - bowlRaw) / maxRaw) * 100;
        const baseRuns = calculateOverRuns(winPct, matchIntensity, matchMomentum);
        
        // Scale runs by the batsman's capability (strike rate) relative to standard T20 baseline (125)
        const batsmanSR = batCard.battingSR || 120;
        const srFactor = batsmanSR / 125;
        runs = Math.min(36, Math.max(0, Math.round(baseRuns * srFactor)));
        
        if (baseRuns > 0 && runs === 0) {
          runs = 1;
        }
        
        if (runs === 0) {
          summaryText = `🔒 Tight Over! ${batCard.name} vs ${bowlCard.name} – Dot Ball`;
        } else {
          summaryText = `🏏 ${batCard.name} defeated ${bowlCard.name} – ${runs} Runs`;
        }
      } else if (roundResult === "bowling_win") {
        wicket = 1;
        summaryText = `🔴 WICKET! ${bowlCard.name} dismissed ${batCard.name}`;
      } else {
        summaryText = `🤝 Dot Ball! Tense battle between ${batCard.name} and ${bowlCard.name}`;
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

      setOverSummary(summaryText);

      // Calculate momentum change
      let nextMomentum = matchMomentum;
      if (wicket > 0) {
        nextMomentum = Math.max(CRICKET_CONFIG.MOMENTUM_FACTORS.MIN, matchMomentum + CRICKET_CONFIG.MOMENTUM_FACTORS.WICKET_DOWN);
      } else if (runs > 0) {
        nextMomentum = Math.min(CRICKET_CONFIG.MOMENTUM_FACTORS.MAX, matchMomentum + CRICKET_CONFIG.MOMENTUM_FACTORS.WIN_UP);
      }
      setMatchMomentum(nextMomentum);

      const activeBat = battingTeam;
      const currentBatScore = cricketScore[activeBat].runs + runs;
      const currentBatWickets = cricketScore[activeBat].wickets + wicket;
      const currentBatOvers = cricketScore[activeBat].oversCompleted + 1;

      setCricketScore(prev => ({
        ...prev,
        [activeBat]: { runs: currentBatScore, wickets: currentBatWickets, oversCompleted: currentBatOvers }
      }));

      // Record detailed scorecard history
      setOverHistory(prev => [...prev, {
        overNumber: currentBatOvers,
        innings: currentInnings,
        runs,
        wicket,
        selectedStat: stat,
        winner: roundResult === "batting_win" ? activeBat : (roundResult === "bowling_win" ? (activeBat === "player" ? "ai" : "player") : "draw"),
        winningPercentage: roundResult === "batting_win" ? ((batNorm - bowlNorm) / batNorm) * 100 : 0,
        batNormalizedVal: batNorm,
        bowlNormalizedVal: bowlNorm,
        battingPlayer: batCard.name,
        bowlingPlayer: bowlCard.name,
        summary: summaryText
      }]);

      const wkLimit = CRICKET_CONFIG.WICKET_LIMITS[oversLimit] || 10;

      setTimeout(() => {
        setOverSummary("");

        if (currentInnings === 1) {
          const isAllOut = currentBatWickets >= wkLimit || currentBatOvers >= oversLimit;
          if (isAllOut) {
            setTargetScore(currentBatScore + 1);
            setIsInningsBreak(true);
          } else {
            setPlayerDeck(prev => [...prev.slice(1), prev[0]]);
            setAiDeck(prev => [...prev.slice(1), prev[0]]);
            setRound(prev => prev + 1);
          }
        } else {
          // Innings 2 Chasing
          const passedTarget = currentBatScore >= targetScore;
          const isChaseEnded = currentBatWickets >= wkLimit || currentBatOvers >= oversLimit || passedTarget;

          if (passedTarget) {
            setCricketWinner(activeBat);
            setGameOver(true);
          } else if (isChaseEnded) {
            if (currentBatScore === targetScore - 1) {
              setCricketWinner("tie");
            } else {
              setCricketWinner(activeBat === "player" ? "ai" : "player");
            }
            setGameOver(true);
          } else {
            setPlayerDeck(prev => [...prev.slice(1), prev[0]]);
            setAiDeck(prev => [...prev.slice(1), prev[0]]);
            setRound(prev => prev + 1);
          }
        }

        setSelectedStat(null);
        setWinner(null);
        setAnimate(false);
        setShowAiCard(false);
      }, 2500);
      return;
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

    // Feature 3: record stat used and round result with detailed values
    setStatHistory(prev => [...prev, {
      stat,
      result,
      playerCard: player.name,
      aiCard: ai.name,
      playerValue,
      aiValue
    }]);

    setTimeout(() => {
      if (result === "player") {
        // Feature badges: if AI had more cards before, player was behind
        // eslint-disable-next-line react-hooks/exhaustive-deps
        setWasEverBehind(prev => prev || aiDeck.length > playerDeck.length);
        if (isBattleMode) setAiHP(prev => Math.max(prev - damage, 0));
        if (gameMode === "team" || gameMode === "tournament") {
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
        if (gameMode === "team" || gameMode === "tournament") {
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
        if (gameMode === "team" || gameMode === "tournament") {
          setDrawPile([]);
          if (playerDeck.length === 1 && aiDeck.length === 1) {
            // Trigger Super Over!
            setSuperOverActive(true);
            setSuperOverBanner(true);

            // Pull next cards from pool or master list
            let nextPlayerCard = playerFranchisePool[0];
            let nextAiCard = aiFranchisePool[0];

            if (nextPlayerCard) {
              setPlayerFranchisePool(prev => prev.slice(1));
            } else {
              const teamCards = players.filter(p => p.team === playerTeam);
              nextPlayerCard = teamCards[Math.floor(Math.random() * teamCards.length)];
            }

            if (nextAiCard) {
              setAiFranchisePool(prev => prev.slice(1));
            } else {
              const teamCards = players.filter(p => p.team === aiTeam);
              nextAiCard = teamCards[Math.floor(Math.random() * teamCards.length)];
            }

            setTimeout(() => {
              setSuperOverBanner(false);
              setPlayerDeck([nextPlayerCard]);
              setAiDeck([nextAiCard]);

              setSelectedStat(null);
              setWinner(null);
              setAnimate(false);
              setShowAiCard(false);
              setRound(prev => prev + 1);
              setTurnTimerKey(prev => prev + 1);
            }, 5000);
            return;
          }
        } else {
          setDrawPile(prev => shuffle([...prev, player, ai]));
        }
        setPlayerDeck(prev => prev.slice(1));
        setAiDeck(prev => prev.slice(1));
      }

      // In offline team/tournament mode: remove any cross-team cards after captures
      // In online team/tournament mode: server already dealt pure team decks; captures are discarded
      // by the slice/no-push logic above, so no extra filter needed online
      if ((gameMode === "team" || gameMode === "tournament") && playStyle !== "online") {
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
      let nominalNextTurn = turn; // default for draw
      if (result === "player") nominalNextTurn = "player";
      else if (result === "ai") nominalNextTurn = "ai";

      if (nominalNextTurn === turn) {
        // Active player kept the turn. If consecutiveTurns is at 3, force shift the turn (Cricket "Over" Completed!)
        if (consecutiveTurns >= 3) {
          const shiftedTurn = turn === "player" ? "ai" : "player";
          setTurn(shiftedTurn);
          setConsecutiveTurns(1);

          const overMsg = isMultiplayerMode
            ? `🏏 Over Completed! Turn shifts to ${shiftedTurn === "player" ? "Player 1" : "Player 2"}`
            : playStyle === "online"
              ? `🏏 Over Completed! Turn shifts to ${shiftedTurn === "player" ? "You" : "Opponent"}`
              : `🏏 Over Completed! Turn shifts to ${shiftedTurn === "player" ? "You" : "AI"}`;
          setOverAnnouncement(overMsg);
          setTimeout(() => setOverAnnouncement(null), 4000);
        } else {
          setTurn(nominalNextTurn);
          setConsecutiveTurns(prev => prev + 1);
        }
      } else {
        // Turn naturally shifted to opponent
        setTurn(nominalNextTurn);
        setConsecutiveTurns(1);
      }
    }, 2000);
  }, [player, ai, selectedStat, isBattleMode, gameOver, gameMode, playStyle, playerTeam, aiTeam, playClick, playHit, playLose, playWin, turn, pitchCondition, weather, moisture, consecutiveTurns, isMultiplayerMode, round, playerDeck, aiDeck, playerFranchisePool, aiFranchisePool, players, battingTeam, cricketScore, currentInnings, matchIntensity, matchMomentum, oversLimit, targetScore]);
  // ✅ FIX 3: drawPile removed from deps — now read via drawPileRef to prevent stale closure

  // ✅ FIX 2: Keep a stable ref to the latest handleStatClick so the socket listener
  // can always call the freshest version without re-registering on every render.
  const handleStatClickRef = useRef(handleStatClick);
  useEffect(() => { handleStatClickRef.current = handleStatClick; }, [handleStatClick]);

  // Server-authoritative mid-game state synchronization
  useEffect(() => {
    if (playStyle !== "online") return;

    const handleStateUpdate = (update) => {
      if (update.playerDeck) setPlayerDeck(update.playerDeck);
      if (update.aiDeck) setAiDeck(update.aiDeck);
      if (update.playerFranchisePool) setPlayerFranchisePool(update.playerFranchisePool);
      if (update.aiFranchisePool) setAiFranchisePool(update.aiFranchisePool);
      if (update.playerHP !== undefined) setPlayerHP(update.playerHP);
      if (update.aiHP !== undefined) setAiHP(update.aiHP);
      if (update.turn) setTurn(update.turn);
      if (update.round !== undefined) setRound(update.round);
      if (update.consecutiveTurns !== undefined) setConsecutiveTurns(update.consecutiveTurns);
      if (update.drawPile) setDrawPile(update.drawPile);
      if (update.weather !== undefined) setWeather(update.weather);
      if (update.moisture !== undefined) setMoisture(update.moisture);
      if (update.pitchCondition !== undefined) setPitchCondition(update.pitchCondition);
      if (update.gameOver !== undefined) setGameOver(update.gameOver);
      if (update.playerSwapUsed !== undefined) setPlayerSwapsLeft(update.playerSwapUsed ? 0 : 1);
      if (update.aiSwapUsed !== undefined) setAiSwapUsed(update.aiSwapUsed);
    };

    socket.on("gameStateUpdate", handleStateUpdate);
    return () => {
      socket.off("gameStateUpdate", handleStateUpdate);
    };
  }, [playStyle]);

  const playWinRef = useRef(playWin);
  const playLoseRef = useRef(playLose);
  const playHitRef = useRef(playHit);
  useEffect(() => {
    playWinRef.current = playWin;
    playLoseRef.current = playLose;
    playHitRef.current = playHit;
  }, [playWin, playLose, playHit]);

  // Server-authoritative round resolution start (reveal card and play animations)
  useEffect(() => {
    if (playStyle !== "online") return;

    const handleResolutionStart = ({ stat, opponentCard, result, damage }) => {
      setAiDeck(prev => {
        if (!prev || prev.length === 0) return prev;
        return [opponentCard, ...prev.slice(1)];
      });

      setSelectedStat(stat);
      setShowPlayerCard(true);
      setShowAiCard(true);

      setTimeout(() => {
        setWinner(result);
        if (result === "player") {
          playWinRef.current();
          setTimeout(() => playHitRef.current(), 150);
        } else if (result === "ai") {
          playLoseRef.current();
          setTimeout(() => playHitRef.current(), 150);
        }
      }, 300);

      setTimeout(() => setAnimate(true), 500);

      setTimeout(() => {
        setSelectedStat(null);
        setWinner(null);
        setAnimate(false);
        setShowAiCard(false);
      }, 2000);
    };

    socket.on("roundResolutionStart", handleResolutionStart);
    return () => {
      socket.off("roundResolutionStart", handleResolutionStart);
    };
  }, [playStyle]);

  // Option B: Opponent swapped synchronization listener
  const handleOpponentSwapped = useCallback((selectedCandidate) => {
    if (playStyle === "online") {
      setSwapAnnouncement(`🔄 Opponent Tactical Swap: subbed in ${selectedCandidate.name}!`);
      setTimeout(() => setSwapAnnouncement(null), 4000);
      return;
    }
    setAiDeck(prevDeck => {
      if (!prevDeck || prevDeck.length === 0) return prevDeck;
      if (gameMode === "team" || gameMode === "tournament") {
        return [selectedCandidate, ...prevDeck.slice(1)];
      } else {
        const oldActive = prevDeck[0];
        const remaining = prevDeck.slice(1).filter(c => c.name !== selectedCandidate.name);
        const shuffledRemaining = [...remaining, oldActive].sort(() => Math.random() - 0.5);
        return [selectedCandidate, ...shuffledRemaining];
      }
    });
    setAiSwapUsed(true);
    
    // Trigger notification banner
    setSwapAnnouncement(`🔄 Opponent Tactical Swap: subbed in ${selectedCandidate.name}!`);
    setTimeout(() => setSwapAnnouncement(null), 4000);
  }, [gameMode, playStyle]);

  const handleOpponentSwappedRef = useRef(handleOpponentSwapped);
  useEffect(() => { handleOpponentSwappedRef.current = handleOpponentSwapped; }, [handleOpponentSwapped]);

  useEffect(() => {
    const handler = (candidate) => handleOpponentSwappedRef.current(candidate);
    socket.on("opponentSwapped", handler);
    return () => socket.off("opponentSwapped", handler);
  }, []);

  const handleOpenPlayerSwap = useCallback(() => {
    if (isMultiplayerMode || playerSwapsLeft <= 0 || playerDeck.length === 0 || turn !== "player" || selectedStat !== null || animate || gameOver) return;
    
    const pool = (gameMode === "team" || gameMode === "tournament") 
      ? playerFranchisePool 
      : playerDeck.slice(1);

    const candidates = getClutchReplacements(pool, gameMode, round, pitchCondition, weather, moisture);
    if (candidates.length < 1) return;
    setSwapCandidates(candidates);
    setSwapModalOpen(true);
  }, [isMultiplayerMode, playerSwapsLeft, playerDeck, playerFranchisePool, turn, selectedStat, animate, gameOver, gameMode, round, pitchCondition, weather, moisture]);

  const executePlayerSwap = useCallback((selectedCandidate) => {
    if (playerSwapsLeft <= 0 || playerDeck.length === 0 || !selectedCandidate) return;
    
    if (playStyle === "online") {
      const roomId = localStorage.getItem("roomId");
      socket.emit("playerSwapped", { roomId, selectedCandidate });
      setSwapModalOpen(false);
      
      const currentActiveCard = playerDeck[0];
      const discardMsg = (gameMode === "team" || gameMode === "tournament") ? " (Swapped card discarded)" : "";
      setSwapAnnouncement(`🔄 Tactical Swap: ${currentActiveCard.name} subbed for ${selectedCandidate.name}!${discardMsg}`);
      setTimeout(() => setSwapAnnouncement(null), 4000);
      return;
    }
    
    const currentActiveCard = playerDeck[0];
    const unselectedCandidate = swapCandidates.find(c => c.name !== selectedCandidate.name);
    
    if (gameMode === "team" || gameMode === "tournament") {
      setPlayerFranchisePool(prevPool => prevPool.filter(c => c.name !== selectedCandidate.name));
      setPlayerDeck(prevDeck => [selectedCandidate, ...prevDeck.slice(1)]);
    } else {
      const remainingDeck = playerDeck.slice(1).filter(c => c.name !== selectedCandidate.name && c.name !== (unselectedCandidate ? unselectedCandidate.name : ""));
      const shuffledRemaining = shuffle([...remainingDeck, currentActiveCard, unselectedCandidate].filter(Boolean));
      setPlayerDeck([selectedCandidate, ...shuffledRemaining]);
    }
    
    setPlayerSwapsLeft(prev => Math.max(0, prev - 1));
    setSwapModalOpen(false);
    
    const discardMsg = (gameMode === "team" || gameMode === "tournament") ? " (Swapped card discarded)" : "";
    setSwapAnnouncement(`🔄 Tactical Swap: ${currentActiveCard.name} subbed for ${selectedCandidate.name}!${discardMsg}`);
    setTimeout(() => setSwapAnnouncement(null), 4000);
  }, [playerSwapsLeft, playerDeck, swapCandidates, gameMode, playStyle]);

  // Hook A: Handle card visibility and key resets when the active turn transitions
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
    } else if (playStyle === "ai_vs_ai") {
      if (selectedStat === null) {
        // Spectator mode: show both cards!
        setShowPlayerCard(true);
        setShowAiCard(true);
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
  }, [turn, selectedStat, playStyle, isMultiplayerMode]);

  // Hook B: AI decision and selection play logic
  useEffect(() => {
    const isAITurn = (turn === "ai" && playStyle !== "online" && !isMultiplayerMode) ||
                     (turn === "player" && playStyle === "ai_vs_ai");

    if (
      isAITurn &&
      !selectedStat &&
      !gameOver &&
      !showConfirm &&
      !isInningsBreak
    ) {
      const activeCard = turn === "player" ? player : ai;
      if (!activeCard) return;

      // 1. AI waits for the 5-second swap grace period to finish
      if (swapGraceActive) {
        return;
      }

      // 2. Once the grace period is over, check if AI should swap
      const isPlayerTurn = turn === "player";
      const swapUsed = isPlayerTurn ? (playerSwapsLeft <= 0) : aiSwapUsed;
      const deck = isPlayerTurn ? playerDeck : aiDeck;
      const franchisePool = isPlayerTurn ? playerFranchisePool : aiFranchisePool;

      const shouldSwap = shouldAISwap(activeCard, round, pitchCondition, weather, moisture, swapUsed, deck.length);
      const pool = (gameMode === "team" || gameMode === "tournament") ? franchisePool : deck.slice(1);

      if (shouldSwap && pool.length > 0) {
        const candidates = getClutchReplacements(pool, gameMode, round, pitchCondition, weather, moisture);
        if (candidates.length >= 1) {
          const currentActive = activeCard;
          let selectedCandidate;

          if (gameMode === "team" || gameMode === "tournament") {
            selectedCandidate = candidates[0];
            if (isPlayerTurn) {
              setPlayerFranchisePool(prevPool => prevPool.filter(c => c.name !== selectedCandidate.name));
              setPlayerDeck(prevDeck => [selectedCandidate, ...prevDeck.slice(1)]);
            } else {
              setAiFranchisePool(prevPool => prevPool.filter(c => c.name !== selectedCandidate.name));
              setAiDeck(prevDeck => [selectedCandidate, ...prevDeck.slice(1)]);
            }
          } else {
            const score1 = getClutchReplacementsScore(candidates[0], gameMode, round, pitchCondition, weather, moisture);
            const score2 = candidates[1] ? getClutchReplacementsScore(candidates[1], gameMode, round, pitchCondition, weather, moisture) : -Infinity;

            selectedCandidate = score1 >= score2 ? candidates[0] : candidates[1];
            const unselectedCandidate = score1 >= score2 ? candidates[1] : candidates[0];

            if (isPlayerTurn) {
              const remainingDeck = playerDeck.slice(1).filter(c => c.name !== selectedCandidate.name && c.name !== (unselectedCandidate ? unselectedCandidate.name : ""));
              const shuffledRemaining = shuffle([...remainingDeck, currentActive, unselectedCandidate].filter(Boolean));
              setPlayerDeck([selectedCandidate, ...shuffledRemaining]);
            } else {
              const remainingDeck = aiDeck.slice(1).filter(c => c.name !== selectedCandidate.name && c.name !== (unselectedCandidate ? unselectedCandidate.name : ""));
              const shuffledRemaining = shuffle([...remainingDeck, currentActive, unselectedCandidate].filter(Boolean));
              setAiDeck([selectedCandidate, ...shuffledRemaining]);
            }
          }

          if (isPlayerTurn) {
            setPlayerSwapsLeft(prev => Math.max(0, prev - 1));
          } else {
            setAiSwapUsed(true);
          }

          const discardMsg = (gameMode === "team" || gameMode === "tournament") ? " (Swapped card discarded)" : "";
          const swapMsg = isPlayerTurn 
            ? `🔄 Team 1 Tactical Swap: ${currentActive.name} subbed for ${selectedCandidate.name}!${discardMsg}`
            : `🔄 Team 2 Tactical Swap: ${currentActive.name} subbed for ${selectedCandidate.name}!${discardMsg}`;
          
          setSwapAnnouncement(swapMsg);
          setTimeout(() => setSwapAnnouncement(null), 4500);

          setTurnTimerKey(prev => prev + 1);
          return;
        }
      }

      // 3. Play stat normally
      const bestStat = getBestStat(activeCard);
      const timer = setTimeout(() => {
        handleStatClick(bestStat);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [
    turn,
    player,
    ai,
    selectedStat,
    handleStatClick,
    isMultiplayerMode,
    gameOver,
    gameMode,
    getBestStat,
    playStyle,
    swapGraceActive,
    round,
    pitchCondition,
    weather,
    moisture,
    playerSwapsLeft,
    aiSwapUsed,
    playerDeck,
    aiDeck,
    playerFranchisePool,
    aiFranchisePool,
    showConfirm,
    isInningsBreak
  ]);

  const handleTurnTimeoutRef = useRef(handleTurnTimeout);
  useEffect(() => {
    handleTurnTimeoutRef.current = handleTurnTimeout;
  }, [handleTurnTimeout]);

  // Hook C: Turn timeout countdown timer execution
  useEffect(() => {
    if (playStyle === "online") return; // Disable local timeout timer in online mode
    const shouldRunTimeout = selectedStat === null && !gameOver && !!turn && !swapModalOpen && !showConfirm && !isInningsBreak;

    if (shouldRunTimeout) {
      const timeout = setTimeout(() => {
        handleTurnTimeoutRef.current();
      }, TURN_TIMEOUT);
      return () => clearTimeout(timeout);
    }
  }, [selectedStat, gameOver, turn, TURN_TIMEOUT, swapModalOpen, showConfirm, playStyle, isInningsBreak]);

  // Hook D: 5-Second Tactical Swap Timer Countdown
  useEffect(() => {
    if (!swapModalOpen || gameOver) return;

    setSwapTimer(5);

    const interval = setInterval(() => {
      setSwapTimer(prev => {
        if (showConfirmRef.current) return prev;
        if (prev <= 1) {
          clearInterval(interval);
          setSwapModalOpen(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [swapModalOpen, gameOver, setSwapModalOpen]);

  return {
    selectedStat, setSelectedStat,
    winner, setWinner,
    round, setRound,
    animate, setAnimate,
    playerDeck, setPlayerDeck,
    aiDeck, setAiDeck,
    playerFranchisePool, setPlayerFranchisePool,
    aiFranchisePool, setAiFranchisePool,
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
    TURN_TIMEOUT,
    pitchCondition, setPitchCondition,
    weather, setWeather,
    moisture, setMoisture,
    playerSwapUsed, playerSwapsLeft, setPlayerSwapsLeft,
    aiSwapUsed, setAiSwapUsed,
    swapModalOpen, setSwapModalOpen,
    swapCandidates, setSwapCandidates,
    swapAnnouncement, setSwapAnnouncement,
    swapGraceActive, setSwapGraceActive,
    swapGraceTimeLeft, setSwapGraceTimeLeft,
    handleOpenPlayerSwap,
    executePlayerSwap,
    consecutiveTurns, setConsecutiveTurns,
    overAnnouncement, setOverAnnouncement,
    swapTimer, setSwapTimer,
    statHistory,
    wasEverBehind,
    superOverActive,
    superOverBanner,
    
    // Cricket Returns
    oversLimit, setOversLimit,
    currentInnings, setCurrentInnings,
    battingTeam, setBattingTeam,
    targetScore, setTargetScore,
    matchIntensity, setMatchIntensity,
    matchMomentum, setMatchMomentum,
    overSummary, setOverSummary,
    overHistory, setOverHistory,
    cricketScore, setCricketScore,
    isInningsBreak, setIsInningsBreak,
    cricketWinner, setCricketWinner,
    initCricketMatch, startSecondInnings
  };
}
