import { useState, useEffect, useCallback } from "react";
import { ref, get, set, remove } from "firebase/database";
import { database } from "../firebase";

export const TEAM_RATINGS = {
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

export function useTournamentCampaign({
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
}) {
  const [tournamentState, setTournamentState] = useState(() => {
    try {
      const str = localStorage.getItem("savedTournamentState");
      return str ? JSON.parse(str) : null;
    } catch {
      return null;
    }
  });

  const [activeTournamentMatch, setActiveTournamentMatch] = useState(null);
  const [tournamentHistory, setTournamentHistory] = useState([]);
  const [hallOfFame, setHallOfFame] = useState([]);

  // Cloud Sync: Fetch tournament saves and history on user login
  useEffect(() => {
    if (!user) {
      setTournamentState(null);
      setHallOfFame([]);
      setTournamentHistory([]);
      return;
    }

    const fetchCloudData = async () => {
      try {
        const tourRef = ref(database, `users/${user.uid}/savedTournamentState`);
        const tourSnap = await get(tourRef);
        if (tourSnap.exists()) {
          setTournamentState(tourSnap.val());
        } else {
          setTournamentState(null);
        }

        // Load Hall of Fame
        const hofRef = ref(database, `users/${user.uid}/hallOfFame`);
        const hofSnap = await get(hofRef);
        setHallOfFame(hofSnap.exists() ? (hofSnap.val() || []) : []);

        // Load Tournament History
        const historyRef = ref(database, `users/${user.uid}/tournamentHistory`);
        const historySnap = await get(historyRef);
        setTournamentHistory(historySnap.exists() ? (historySnap.val() || []) : []);
      } catch (err) {
        console.error("Error loading tournament data from Firebase RTDB:", err);
      }
    };

    fetchCloudData();
  }, [user]);

  // LocalStorage fallback for guest
  useEffect(() => {
    if (isGuest) {
      try {
        const tourStr = localStorage.getItem("savedTournamentState");
        setTournamentState(tourStr ? JSON.parse(tourStr) : null);

        const hofStr = localStorage.getItem("ipl_hall_of_fame");
        setHallOfFame(hofStr ? JSON.parse(hofStr) : []);

        const historyStr = localStorage.getItem("ipl_tournament_history");
        setTournamentHistory(historyStr ? JSON.parse(historyStr) : []);
      } catch (err) {
        console.error("Error loading LocalStorage tournament fallback for guest:", err);
      }
    }
  }, [isGuest]);

  // Helper: write a Hall of Fame entry when winning a tournament
  const writeHallOfFameEntry = useCallback((state) => {
    if (!state || state.stage !== "champion") return;
    const record = state.pointsTable?.[state.playerTeam];
    const entry = {
      team: state.playerTeam,
      date: new Date().toLocaleDateString("en-IN"),
      leagueRecord: record ? `${record.won}W-${record.lost}L` : "9W-0L",
      season: Date.now(),
    };
    const updated = [entry, ...hallOfFame].slice(0, 20); // keep last 20
    setHallOfFame(updated);
    if (user && !isGuest) {
      const hofRef = ref(database, `users/${user.uid}/hallOfFame`);
      set(hofRef, updated).catch(err => console.error("Error saving HoF:", err));
    } else {
      localStorage.setItem("ipl_hall_of_fame", JSON.stringify(updated));
    }
  }, [hallOfFame, user, isGuest]);

  // Helper: save tournament campaign history when it ends
  const saveTournamentHistoryEntry = useCallback((state) => {
    if (!state) return;
    let tournamentWinner = "Unknown";
    if (state.stage === "champion") {
      tournamentWinner = state.playerTeam;
    } else {
      const simMatch = (home, away) => {
        const ratingHome = TEAM_RATINGS[home.toLowerCase()] || 80;
        const ratingAway = TEAM_RATINGS[away.toLowerCase()] || 80;
        return Math.random() < (ratingHome / (ratingHome + ratingAway)) ? home : away;
      };

      if (state.playoffs) {
        const play = { ...state.playoffs };
        if (!play.q1.played) {
          play.q1.winner = simMatch(play.q1.home, play.q1.away);
          play.q1.loser = play.q1.winner === play.q1.home ? play.q1.away : play.q1.home;
          play.q1.played = true;
        }
        if (!play.elim.played) {
          play.elim.winner = simMatch(play.elim.home, play.elim.away);
          play.elim.played = true;
        }
        if (!play.q2.played) {
          const q2Home = play.q1.loser || play.q1.away;
          const q2Away = play.elim.winner || play.elim.away;
          play.q2.winner = simMatch(q2Home, q2Away);
          play.q2.played = true;
        }
        if (!play.final.played) {
          const finalHome = play.q1.winner || play.q1.home;
          const finalAway = play.q2.winner || play.q2.home;
          play.final.winner = simMatch(finalHome, finalAway);
          play.final.played = true;
        }
        tournamentWinner = play.final.winner;
      } else {
        const pTable = state.pointsTable;
        const sorted = Object.keys(pTable)
          .map(team => ({ name: team, ...pTable[team] }))
          .sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            const aNCD = a.ncd || 0;
            const bNCD = b.ncd || 0;
            if (bNCD !== aNCD) return bNCD - aNCD;
            if (b.won !== a.won) return b.won - a.won;
            return a.name.localeCompare(b.name);
          });
        
        const top4 = sorted.slice(0, 4).map(t => t.name);
        if (top4.length === 4) {
          const [t1, t2, t3, t4] = top4;
          const q1Winner = simMatch(t1, t2);
          const q1Loser = q1Winner === t1 ? t2 : t1;
          const elimWinner = simMatch(t3, t4);
          const q2Winner = simMatch(q1Loser, elimWinner);
          tournamentWinner = simMatch(q1Winner, q2Winner);
        } else {
          tournamentWinner = "Simulated Champion";
        }
      }
    }

    const record = state.pointsTable?.[state.playerTeam];
    const entry = {
      playerTeam: state.playerTeam,
      winner: tournamentWinner,
      stageReached: state.stage,
      leagueRecord: record ? `${record.won}W-${record.lost}L` : "0W-0L",
      date: new Date().toLocaleDateString("en-IN"),
      season: Date.now(),
    };

    const updated = [entry, ...tournamentHistory].slice(0, 50); // keep last 50
    setTournamentHistory(updated);
    if (user && !isGuest) {
      const historyRef = ref(database, `users/${user.uid}/tournamentHistory`);
      set(historyRef, updated).catch(err => console.error("Error saving tournament history:", err));
    } else {
      localStorage.setItem("ipl_tournament_history", JSON.stringify(updated));
    }
  }, [tournamentHistory, user, isGuest]);

  const updateTournamentProgress = useCallback((isPlayerWin) => {
    if (!tournamentState) return;

    const state = { ...tournamentState };
    const { playerTeam: globalPlayerTeam, pointsTable, stage, playoffs } = state;
    
    if (!activeTournamentMatch) return;

    if (stage === "league") {
      const { roundIndex, matchIndex } = activeTournamentMatch;
      const match = state.schedule[roundIndex][matchIndex];
      
      match.played = true;
      match.winner = isPlayerWin ? match.home : match.away;
      match.loser = isPlayerWin ? match.away : match.home;
      match.margin = isPlayerWin ? playerDeck.length : aiDeck.length;

      const pTable = { ...pointsTable };
      pTable[match.home].played += 1;
      pTable[match.away].played += 1;
      
      if (isPlayerWin) {
        pTable[match.home].won += 1;
        pTable[match.home].points += 2;
        pTable[match.home].ncd = (pTable[match.home].ncd || 0) + match.margin;
        pTable[match.away].lost += 1;
        pTable[match.away].ncd = (pTable[match.away].ncd || 0) - match.margin;
      } else {
        pTable[match.away].won += 1;
        pTable[match.away].points += 2;
        pTable[match.away].ncd = (pTable[match.away].ncd || 0) + match.margin;
        pTable[match.home].lost += 1;
        pTable[match.home].ncd = (pTable[match.home].ncd || 0) - match.margin;
      }

      state.pointsTable = pTable;

    } else if (stage === "playoffs" && playoffs) {
      const play = { ...playoffs };
      const { playoffKey } = activeTournamentMatch;
      const oppTeam = aiTeam;

      if (playoffKey === "q1") {
        play.q1.played = true;
        if (isPlayerWin) {
          play.q1.winner = playerTeam;
          play.q1.loser = oppTeam;
        } else {
          play.q1.winner = oppTeam;
          play.q1.loser = playerTeam;
        }

      } else if (playoffKey === "elim") {
        play.elim.played = true;
        if (isPlayerWin) {
          play.elim.winner = playerTeam;
        } else {
          play.elim.winner = oppTeam;
          if (playerTeam === globalPlayerTeam) {
            state.stage = "eliminated";
          }
        }

      } else if (playoffKey === "q2") {
        play.q2.played = true;
        if (isPlayerWin) {
          play.q2.winner = playerTeam;
          play.final.home = play.q1.winner;
          play.final.away = playerTeam;
        } else {
          play.q2.winner = oppTeam;
          if (playerTeam === globalPlayerTeam) {
            state.stage = "eliminated";
          }
        }

      } else if (playoffKey === "final") {
        play.final.played = true;
        if (isPlayerWin) {
          play.final.winner = playerTeam;
          if (playerTeam === globalPlayerTeam) {
            state.stage = "champion";
          } else {
            state.stage = "eliminated";
          }
        } else {
          play.final.winner = oppTeam;
          if (oppTeam === globalPlayerTeam) {
            state.stage = "champion";
          } else {
            state.stage = "eliminated";
          }
        }
      }

      // Check if both Q1 and Eliminator are resolved, then schedule Q2!
      if (play.q1.played && play.elim.played && !play.q2.played && !play.q2.home) {
        play.q2.home = play.q1.loser;
        play.q2.away = play.elim.winner;
      }

      // Check if Q2 is resolved, then schedule the Grand Final!
      if (play.q2.played && !play.final.played && !play.final.home) {
        play.final.home = play.q1.winner;
        play.final.away = play.q2.winner;
      }

      state.playoffs = play;
    }

    setTournamentState(state);
    if (user && !isGuest) {
      const tourRef = ref(database, `users/${user.uid}/savedTournamentState`);
      set(tourRef, state).catch(err => console.error("Error saving tournament to cloud:", err));
    } else {
      localStorage.setItem("savedTournamentState", JSON.stringify(state));
    }

    // Fire achievement checks
    const margin = isPlayerWin ? playerDeck.length : aiDeck.length;
    checkAndUnlock({
      type: "match_end",
      isWin: isPlayerWin,
      gameMode: "tournament",
      margin,
      timeLeft: 0,
      tournamentState: state,
      wasEverBehind,
      _user: user,
      _isGuest: isGuest,
    });

    if (state.stage === "champion") {
      writeHallOfFameEntry(state);
    }

    if (state.stage === "champion" || state.stage === "eliminated") {
      saveTournamentHistoryEntry(state);
    }

    // Reset game match variables
    setPlayerTeam(null);
    setAiTeam(null);
    setIsOnlineGameStarted(false);
    setResumedGameState(null);
    setSavedGameState(null);
    setActiveTournamentMatch(null);
    setPlayerDeck([]);
    setAiDeck([]);
    setPlayerFranchisePool([]);
    setAiFranchisePool([]);

    if (user && !isGuest) {
      const gameRef = ref(database, `users/${user.uid}/savedGameState`);
      remove(gameRef).catch(err => console.error("Error clearing cloud game save:", err));
    } else {
      localStorage.removeItem("savedGameState");
    }
  }, [
    tournamentState,
    activeTournamentMatch,
    playerDeck.length,
    aiDeck.length,
    user,
    isGuest,
    checkAndUnlock,
    wasEverBehind,
    aiTeam,
    playerTeam,
    setPlayerTeam,
    setAiTeam,
    setIsOnlineGameStarted,
    setResumedGameState,
    setSavedGameState,
    setPlayerDeck,
    setAiDeck,
    setPlayerFranchisePool,
    setAiFranchisePool,
    writeHallOfFameEntry,
    saveTournamentHistoryEntry
  ]);

  const simulateLeagueMatch = useCallback((roundIdx, matchIdx) => {
    if (!tournamentState) return;
    const state = { ...tournamentState };
    const match = state.schedule[roundIdx][matchIdx];

    const ratingHome = TEAM_RATINGS[match.home.toLowerCase()] || 80;
    const ratingAway = TEAM_RATINGS[match.away.toLowerCase()] || 80;
    const probHome = ratingHome / (ratingHome + ratingAway);
    const homeWins = Math.random() < probHome;

    match.played = true;
    match.winner = homeWins ? match.home : match.away;
    match.loser = homeWins ? match.away : match.home;
    match.margin = Math.floor(Math.random() * 5) + 1;

    const pTable = { ...state.pointsTable };
    pTable[match.home].played += 1;
    pTable[match.away].played += 1;

    if (homeWins) {
      pTable[match.home].won += 1;
      pTable[match.home].points += 2;
      pTable[match.home].ncd = (pTable[match.home].ncd || 0) + match.margin;
      pTable[match.away].lost += 1;
      pTable[match.away].ncd = (pTable[match.away].ncd || 0) - match.margin;
    } else {
      pTable[match.away].won += 1;
      pTable[match.away].points += 2;
      pTable[match.away].ncd = (pTable[match.away].ncd || 0) + match.margin;
      pTable[match.home].lost += 1;
      pTable[match.home].ncd = (pTable[match.home].ncd || 0) - match.margin;
    }
    state.pointsTable = pTable;

    setTournamentState(state);
    if (user && !isGuest) {
      const tourRef = ref(database, `users/${user.uid}/savedTournamentState`);
      set(tourRef, state).catch(err => console.error("Error saving simulated tournament to cloud:", err));
    } else {
      localStorage.setItem("savedTournamentState", JSON.stringify(state));
    }
  }, [tournamentState, user, isGuest]);

  const simulateAllRemainingMatches = useCallback(() => {
    if (!tournamentState) return;
    const state = { ...tournamentState };
    const roundMatches = state.schedule[state.currentRoundIndex];
    const pTable = { ...state.pointsTable };

    roundMatches.forEach(match => {
      const isPlayerMatch = match.home === state.playerTeam || match.away === state.playerTeam;
      if (!match.played && !isPlayerMatch) {
        const ratingHome = TEAM_RATINGS[match.home.toLowerCase()] || 80;
        const ratingAway = TEAM_RATINGS[match.away.toLowerCase()] || 80;
        const probHome = ratingHome / (ratingHome + ratingAway);
        const homeWins = Math.random() < probHome;

        match.played = true;
        match.winner = homeWins ? match.home : match.away;
        match.loser = homeWins ? match.away : match.home;
        match.margin = Math.floor(Math.random() * 5) + 1;

        pTable[match.home].played += 1;
        pTable[match.away].played += 1;

        if (homeWins) {
          pTable[match.home].won += 1;
          pTable[match.home].points += 2;
          pTable[match.home].ncd = (pTable[match.home].ncd || 0) + match.margin;
          pTable[match.away].lost += 1;
          pTable[match.away].ncd = (pTable[match.away].ncd || 0) - match.margin;
        } else {
          pTable[match.away].won += 1;
          pTable[match.away].points += 2;
          pTable[match.away].ncd = (pTable[match.away].ncd || 0) + match.margin;
          pTable[match.home].lost += 1;
          pTable[match.home].ncd = (pTable[match.home].ncd || 0) - match.margin;
        }
      }
    });

    state.pointsTable = pTable;
    setTournamentState(state);
    if (user && !isGuest) {
      const tourRef = ref(database, `users/${user.uid}/savedTournamentState`);
      set(tourRef, state).catch(err => console.error("Error saving simulated tournament to cloud:", err));
    } else {
      localStorage.setItem("savedTournamentState", JSON.stringify(state));
    }
  }, [tournamentState, user, isGuest]);

  const advanceTournamentRound = useCallback(() => {
    if (!tournamentState) return;
    const state = { ...tournamentState };

    if (state.currentRoundIndex < 8) {
      state.currentRoundIndex += 1;
    } else {
      const pTable = state.pointsTable;
      const sorted = Object.keys(pTable)
        .map(team => ({ name: team, ...pTable[team] }))
        .sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          const aNCD = a.ncd || 0;
          const bNCD = b.ncd || 0;
          if (bNCD !== aNCD) return bNCD - aNCD;
          if (b.won !== a.won) return b.won - a.won;
          return a.name.localeCompare(b.name);
        });

      const top4 = sorted.slice(0, 4).map(t => t.name);
      const playerIndex = top4.indexOf(state.playerTeam);

      if (playerIndex === -1) {
        state.stage = "eliminated";
        saveTournamentHistoryEntry(state);
      } else {
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

    setTournamentState(state);
    if (user && !isGuest) {
      const tourRef = ref(database, `users/${user.uid}/savedTournamentState`);
      set(tourRef, state).catch(err => console.error("Error saving advanced round to cloud:", err));
    } else {
      localStorage.setItem("savedTournamentState", JSON.stringify(state));
    }
  }, [tournamentState, user, isGuest, saveTournamentHistoryEntry]);

  const simulatePlayoffMatch = useCallback((matchKey) => {
    if (!tournamentState) return;
    const state = { ...tournamentState };
    const play = { ...state.playoffs };
    const match = play[matchKey];

    const ratingHome = TEAM_RATINGS[match.home.toLowerCase()] || 80;
    const ratingAway = TEAM_RATINGS[match.away.toLowerCase()] || 80;
    const probHome = ratingHome / (ratingHome + ratingAway);
    const homeWins = Math.random() < probHome;

    match.played = true;
    match.winner = homeWins ? match.home : match.away;
    if (matchKey === "q1") {
      match.loser = homeWins ? match.away : match.home;
    }

    const isPlayerMatch = match.home === state.playerTeam || match.away === state.playerTeam;
    const didPlayerLose = isPlayerMatch && (match.winner !== state.playerTeam);

    if (didPlayerLose) {
      if (matchKey === "elim" || matchKey === "q2" || matchKey === "final") {
        state.stage = "eliminated";
      }
    }

    if (matchKey === "final" && match.winner === state.playerTeam) {
      state.stage = "champion";
    }

    if (play.q1.played && play.elim.played && !play.q2.played && !play.q2.home) {
      play.q2.home = play.q1.loser;
      play.q2.away = play.elim.winner;
    }
    if (play.q2.played && !play.final.played && !play.final.home) {
      play.final.home = play.q1.winner;
      play.final.away = play.q2.winner;
    }

    state.playoffs = play;
    if (state.stage === "champion" || state.stage === "eliminated") {
      saveTournamentHistoryEntry(state);
      if (state.stage === "champion") {
        writeHallOfFameEntry(state);
      }
    }
    setTournamentState(state);
    if (user && !isGuest) {
      const tourRef = ref(database, `users/${user.uid}/savedTournamentState`);
      set(tourRef, state).catch(err => console.error("Error saving simulated playoff to cloud:", err));
    } else {
      localStorage.setItem("savedTournamentState", JSON.stringify(state));
    }
  }, [tournamentState, user, isGuest, saveTournamentHistoryEntry, writeHallOfFameEntry]);

  // Helper: compute matchStats for the result screen
  const buildMatchStats = useCallback((isPlayerWin) => ({
    cardsWon: playerDeck.length,
    cardsLost: aiDeck.length,
    statHistory,
    tournamentContext: tournamentState && activeTournamentMatch?.type === "league" ? {
      roundIndex: activeTournamentMatch.roundIndex,
      rank: (() => {
        if (!tournamentState.pointsTable) return null;
        const sorted = Object.keys(tournamentState.pointsTable)
          .sort((a, b) => tournamentState.pointsTable[b].points - tournamentState.pointsTable[a].points);
        return sorted.indexOf(tournamentState.playerTeam) + 1;
      })(),
      points: tournamentState.pointsTable?.[tournamentState.playerTeam]?.points ?? 0,
    } : null,
  }), [playerDeck.length, aiDeck.length, statHistory, tournamentState, activeTournamentMatch]);

  return {
    tournamentState,
    setTournamentState,
    activeTournamentMatch,
    setActiveTournamentMatch,
    tournamentHistory,
    setTournamentHistory,
    hallOfFame,
    setHallOfFame,
    updateTournamentProgress,
    simulateLeagueMatch,
    simulateAllRemainingMatches,
    advanceTournamentRound,
    simulatePlayoffMatch,
    buildMatchStats
  };
}
