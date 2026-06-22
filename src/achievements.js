// Achievement / Badge Definitions
// Each badge has: id, emoji, label, description, and an unlock check function.

export const ACHIEVEMENTS = [
  {
    id: "trophy_hunter",
    emoji: "🏆",
    label: "Trophy Hunter",
    description: "Win a full Tournament campaign.",
    check: ({ type, tournamentState }) =>
      type === "match_end" && tournamentState?.stage === "champion",
  },
  {
    id: "perfect_campaign",
    emoji: "🎯",
    label: "Perfect Campaign",
    description: "Win all 9 league matches in a Tournament.",
    check: ({ type, tournamentState }) => {
      if (type !== "match_end") return false;
      if (!tournamentState?.schedule) return false;
      // All 9 rounds must have every match played, and player team must have won every match
      const playerTeam = tournamentState.playerTeam;
      const schedule = tournamentState.schedule;
      const allRoundsComplete = schedule.length === 9 && schedule.every(round => round.every(m => m.played));
      if (!allRoundsComplete) return false;
      const playerMatches = schedule.flat().filter(m => m.home === playerTeam || m.away === playerTeam);
      return playerMatches.length === 9 && playerMatches.every(m => m.winner === playerTeam);
    },
  },
  {
    id: "dominator",
    emoji: "💥",
    label: "Dominator",
    description: "Win a match with a card margin of 3 or more.",
    check: ({ type, isWin, margin }) =>
      type === "match_end" && isWin && margin >= 3,
  },
  {
    id: "speed_demon",
    emoji: "⚡",
    label: "Speed Demon",
    description: "Win a Time Mode match with more than 60 seconds remaining.",
    check: ({ type, isWin, gameMode, timeLeft }) =>
      type === "match_end" && isWin && gameMode === "time" && timeLeft > 60,
  },
  {
    id: "hat_trick_hero",
    emoji: "🔥",
    label: "Hat-Trick Hero",
    description: "Win 3 consecutive league matches in a Tournament campaign.",
    check: ({ type, tournamentState }) => {
      if (type !== "match_end") return false;
      if (!tournamentState?.schedule || !tournamentState?.playerTeam) return false;
      const playerTeam = tournamentState.playerTeam;
      const allMatches = tournamentState.schedule.flat().filter(m => m.played && (m.home === playerTeam || m.away === playerTeam));
      let streak = 0;
      for (const m of allMatches) {
        if (m.winner === playerTeam) {
          streak++;
          if (streak >= 3) return true;
        } else {
          streak = 0;
        }
      }
      return false;
    },
  },
  {
    id: "survivor",
    emoji: "🛡️",
    label: "Survivor",
    description: "Win a Tournament match after being behind (opponent had more cards at some point).",
    check: ({ type, isWin, wasEverBehind }) =>
      type === "match_end" && isWin && wasEverBehind === true,
  },
];
