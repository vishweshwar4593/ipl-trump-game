import React, { useState, useEffect } from "react";
import teamLogos from "../data/teamLogos";

const FALLBACK_LOGO = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23cc2200'/><path d='M50 5 Q70 30 70 50 Q70 70 50 95 Q30 70 30 50 Q30 30 50 5Z' fill='%23aa1100'/><path d='M5 50 Q30 30 50 30 Q70 30 95 50 Q70 70 50 70 Q30 70 5 50Z' fill='%23aa1100'/><path d='M50 5 Q70 30 70 50 Q70 70 50 95' stroke='%23f5e6c8' stroke-width='2' fill='none'/><path d='M5 50 Q30 30 50 30 Q70 30 95 50' stroke='%23f5e6c8' stroke-width='2' fill='none'/></svg>`;

// Generate standard round robin schedule using Circle Method
function generateSchedule(teams) {
  const schedule = [];
  const tempTeams = [...teams];
  const n = tempTeams.length;
  
  for (let round = 0; round < n - 1; round++) {
    const roundMatches = [];
    for (let i = 0; i < n / 2; i++) {
      const home = tempTeams[i];
      const away = tempTeams[n - 1 - i];
      roundMatches.push({ home, away });
    }
    schedule.push(roundMatches);
    // rotate teams keeping the first one constant
    tempTeams.splice(1, 0, tempTeams.pop());
  }
  return schedule;
}

function TournamentMode({
  teams,
  setGameMode,
  playStyle,
  setPlayStyle,
  tournamentState,
  setTournamentState,
  startMatch,
  simulateLeagueMatch,
  simulateAllRemainingMatches,
  advanceTournamentRound,
  simulatePlayoffMatch,
  hallOfFame = []
}) {
  const [activeTab, setActiveTab] = useState("table");
  const [resetContext, setResetContext] = useState(null); // null | "active_reset" | "new_campaign"
  const [autoAdvance, setAutoAdvance] = useState(false);

  // Auto-Advance: after player completes match, sim remaining + advance round automatically
  useEffect(() => {
    if (!autoAdvance || !tournamentState || tournamentState.stage !== "league") return;
    const { schedule, currentRoundIndex, playerTeam } = tournamentState;
    if (!schedule || !schedule[currentRoundIndex]) return;
    const roundMatches = schedule[currentRoundIndex];
    const playerMatch = roundMatches.find(m => m.home === playerTeam || m.away === playerTeam);
    // Player match must be completed, but not all matches done yet
    if (!playerMatch || !playerMatch.played) return;
    const allDone = roundMatches.every(m => m.played);
    if (allDone) {
      // Auto-advance to next round after a brief delay
      const t = setTimeout(() => advanceTournamentRound(), 800);
      return () => clearTimeout(t);
    } else {
      // Simulate remaining matches, then advance
      const t = setTimeout(() => {
        simulateAllRemainingMatches();
      }, 600);
      return () => clearTimeout(t);
    }
  }, [tournamentState, autoAdvance, advanceTournamentRound, simulateAllRemainingMatches]);

  // Load state on mount if it exists, otherwise trigger franchise selection
  const selectFranchise = (team) => {
    // Generate fresh schedule
    const allFranchises = [...teams];
    const generatedSchedule = generateSchedule(allFranchises);
    
    // Initialize points table
    const initialTable = {};
    teams.forEach(t => {
      initialTable[t] = { played: 0, won: 0, lost: 0, points: 0, ncd: 0 };
    });

    const newState = {
      playerTeam: team,
      pointsTable: initialTable,
      schedule: generatedSchedule,
      currentRoundIndex: 0, // 0 to 8 (9 rounds total)
      stage: "league", // "league", "playoffs", "champion", "eliminated"
      playoffs: null
    };

    setTournamentState(newState);
    localStorage.setItem("savedTournamentState", JSON.stringify(newState));
  };

  const handleResetActive = () => {
    setResetContext("active_reset");
  };

  const handleResetNew = () => {
    setResetContext("new_campaign");
  };

  const confirmReset = () => {
    setTournamentState(null);
    localStorage.removeItem("savedTournamentState");
    setResetContext(null);
  };

  // Helper to render watch / play / simulate playoff match actions with lock checks
  const renderPlayoffButtons = (matchKey, match) => {
    if (!match || !match.home || !match.away || match.played) return null;
    
    let isUnlocked = true;
    if (matchKey === "elim") {
      isUnlocked = playoffs.q1.played;
    } else if (matchKey === "q2") {
      isUnlocked = playoffs.elim.played;
    } else if (matchKey === "final") {
      isUnlocked = playoffs.q2.played;
    }

    const isPlayerMatch = match.home === playerTeam || match.away === playerTeam;
    if (isPlayerMatch) {
      return (
        <button 
          className="play-btn" 
          style={{ padding: "6px 12px", fontSize: "12px", width: "auto", margin: 0, height: "auto" }}
          onClick={() => handleStartPlayoffMatch(matchKey, "ai")}
          disabled={!isUnlocked}
        >
          {isUnlocked ? "🏏 Play" : "🔒 Locked"}
        </button>
      );
    } else {
      return (
        <div style={{ display: "flex", gap: "6px" }}>
          <button 
            className="play-btn" 
            style={{ padding: "6px 12px", fontSize: "12px", width: "auto", margin: 0, height: "auto" }}
            onClick={() => handleStartPlayoffMatch(matchKey, "ai_vs_ai")}
            disabled={!isUnlocked}
          >
            🤖 Watch
          </button>
          <button 
            className="rules-btn" 
            style={{ padding: "6px 12px", fontSize: "12px", width: "auto", margin: 0, height: "auto", borderColor: isUnlocked ? "#ffd700" : "#444", color: isUnlocked ? "#ffd700" : "#666" }}
            onClick={() => simulatePlayoffMatch(matchKey)}
            disabled={!isUnlocked}
          >
            ⚡ Sim
          </button>
        </div>
      );
    }
  };

  // If no team is selected, show franchise selector
  if (!tournamentState || !tournamentState.playerTeam) {
    return (
      <div className="home">
        <div className="home-container" style={{ maxWidth: 850 }}>
          <h1>Road to the Trophy</h1>
          <p style={{ color: "#ccc", fontSize: "16px", marginBottom: "20px" }}>
            Select your franchise to start the 9-match Campaign Tournament!
          </p>

          <div className="team-buttons" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "12px", width: "100%" }}>
            {teams.map(team => {
              const teamKey = team.trim().toLowerCase();
              const logo = teamLogos[teamKey] || FALLBACK_LOGO;
              return (
                <button
                  key={team}
                  className="home-btn"
                  onClick={() => selectFranchise(team)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "15px",
                    padding: "16px 20px",
                    fontSize: "16px",
                    justifyContent: "flex-start",
                    textAlign: "left"
                  }}
                >
                  <img src={logo} alt={team} style={{ width: "32px", height: "32px", objectFit: "contain" }} />
                  {team}
                </button>
              );
            })}
          </div>

          <button
            className="home-btn secondary"
            onClick={() => setGameMode(null)}
            style={{ marginTop: "24px", minWidth: "160px" }}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const { playerTeam, pointsTable, schedule, currentRoundIndex, stage, playoffs } = tournamentState;

  // Find player's next match in schedule for active league round
  let currentRoundMatches = [];
  let playerMatch = null;
  
  if (stage === "league" && schedule && schedule[currentRoundIndex]) {
    currentRoundMatches = schedule[currentRoundIndex];
    playerMatch = currentRoundMatches.find(
      m => m.home === playerTeam || m.away === playerTeam
    );
  }

  const opponentTeam = playerMatch 
    ? (playerMatch.home === playerTeam ? playerMatch.away : playerMatch.home)
    : null;

  const playerMatchIndex = playerMatch ? currentRoundMatches.indexOf(playerMatch) : -1;
  const isPlayerMatchUnlocked = playerMatchIndex === 0 || (currentRoundMatches[playerMatchIndex - 1] && currentRoundMatches[playerMatchIndex - 1].played);

  // Sort teams for points table
  const sortedStandings = Object.keys(pointsTable)
    .map(team => ({
      name: team,
      ...pointsTable[team]
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const aNCD = a.ncd || 0;
      const bNCD = b.ncd || 0;
      if (bNCD !== aNCD) return bNCD - aNCD;
      if (b.won !== a.won) return b.won - a.won;
      return a.name.localeCompare(b.name);
    });

  // Calculate current rank of player
  const playerRank = sortedStandings.findIndex(t => t.name === playerTeam) + 1;

  const handleStartMatch = (teamA, teamB, modeStyle, matchInfo) => {
    startMatch(teamA, teamB, modeStyle, matchInfo);
  };

  const handleStartPlayoffMatch = (playoffKey, modeStyle) => {
    const playoffMatch = playoffs[playoffKey];
    // Always pass the campaign's playerTeam as teamA so the game engine
    // correctly assigns cards — regardless of whether they are home or away.
    const isPlayerHome = playoffMatch.home === playerTeam;
    const teamA = isPlayerHome ? playoffMatch.home : playoffMatch.away;
    const teamB = isPlayerHome ? playoffMatch.away : playoffMatch.home;
    startMatch(teamA, teamB, modeStyle, { type: "playoff", playoffKey });
  };

  return (
    <div className="home" style={{ overflowY: "auto", padding: "20px 10px" }}>
      {resetContext !== null && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div style={{ fontSize: "52px", marginBottom: "12px" }}>
              {resetContext === "new_campaign" ? "🏏" : "🚨"}
            </div>
            <h2>{resetContext === "new_campaign" ? "Start New Campaign?" : "Reset Active Campaign?"}</h2>
            <p style={{ color: "#ccc", marginBottom: "24px", fontSize: "15px", lineHeight: "1.5" }}>
              {resetContext === "new_campaign" 
                ? "Are you ready to start a fresh new season? Your previous tournament standings and stats will be cleared, and you will return to the franchise selection menu."
                : "Are you sure you want to reset your active campaign? All your current standings, playoff schedule, and match progress will be permanently lost."}
            </p>
            <div className="modal-actions" style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
              <button 
                className="confirm-btn" 
                style={{ 
                  background: resetContext === "new_campaign" ? "linear-gradient(135deg, #ffd700, #ff8c00)" : "linear-gradient(135deg, #ff4b2b, #ff416c)", 
                  border: "none", 
                  color: resetContext === "new_campaign" ? "#04050d" : "#fff", 
                  padding: "12px 24px", 
                  borderRadius: "10px", 
                  fontWeight: "bold", 
                  cursor: "pointer" 
                }}
                onClick={confirmReset}
              >
                {resetContext === "new_campaign" ? "Yes, Start New" : "Yes, Reset"}
              </button>
              <button 
                className="cancel-btn" 
                style={{ padding: "12px 24px", borderRadius: "10px", fontWeight: "bold", cursor: "pointer" }}
                onClick={() => setResetContext(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="home-container" style={{ maxWidth: 900, background: "rgba(10,10,25,0.85)", padding: "30px", borderRadius: "20px", border: "1px solid rgba(255,255,255,0.08)" }}>
        
        {/* Banner Headers */}
        <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "15px", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <img 
              src={teamLogos[playerTeam.trim().toLowerCase()] || FALLBACK_LOGO} 
              alt={playerTeam} 
              style={{ width: "56px", height: "56px", objectFit: "contain", filter: "drop-shadow(0 0 10px rgba(255,215,0,0.4))" }} 
            />
            <div style={{ textAlign: "left" }}>
              <h2 style={{ margin: 0, color: "#fff", fontSize: "24px" }}>{playerTeam}</h2>
              <p style={{ margin: "4px 0 0 0", color: "#ffd700", fontWeight: "bold" }}>
                Rank #{playerRank} | {pointsTable[playerTeam].points} PTS ({pointsTable[playerTeam].won}W - {pointsTable[playerTeam].lost}L | NCD: {(pointsTable[playerTeam].ncd || 0) > 0 ? `+${pointsTable[playerTeam].ncd}` : pointsTable[playerTeam].ncd || 0})
              </p>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <span className="mode-tag" style={{ fontSize: "14px", padding: "8px 16px" }}>
              🏆 Campaign Tournament
            </span>
          </div>
        </div>

        {/* Dynamic Screen Stage Layouts */}
        {stage === "champion" ? (
          <div style={{ padding: "40px 10px", textAlign: "center" }}>
            <div style={{ fontSize: "80px", marginBottom: "20px", animation: "pulseTimer 1.5s infinite" }}>🏆</div>
            <h1 style={{ color: "#ffd700", fontSize: "38px", margin: "0 0 10px 0" }}>CHAMPIONS!</h1>
            <p style={{ fontSize: "18px", color: "#fff", maxWidth: "600px", margin: "0 auto 30px auto", lineHeight: "1.6" }}>
              Congratulations! You led **{playerTeam}** to victory in the Grand Final and claimed the coveted IPL Trophy! Your name is etched in glory!
            </p>
            <button className="play-btn" style={{ minWidth: "220px", padding: "16px" }} onClick={handleResetNew}>
              Play Another Season
            </button>
          </div>
        ) : stage === "eliminated" ? (
          <div style={{ padding: "40px 10px", textAlign: "center" }}>
            <div style={{ fontSize: "70px", marginBottom: "20px" }}>💔</div>
            <h1 style={{ color: "#ff4d4d", fontSize: "32px", margin: "0 0 10px 0" }}>Season Ended</h1>
            <p style={{ fontSize: "16px", color: "#ccc", maxWidth: "550px", margin: "0 auto 30px auto", lineHeight: "1.6" }}>
              Your franchise finished outside the Top 4 or was knocked out during the Playoffs. Keep refining your strategy and try again next season!
            </p>
            <div style={{ display: "flex", gap: "15px", justifyContent: "center" }}>
              <button className="play-btn" style={{ minWidth: "180px" }} onClick={handleResetNew}>
                New Campaign
              </button>
              <button className="rules-btn" style={{ minWidth: "180px" }} onClick={() => setGameMode(null)}>
                Exit to Home
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Nav Tabs */}
            <div style={{ display: "flex", gap: "10px", width: "100%", marginBottom: "20px", background: "rgba(255,255,255,0.03)", padding: "6px", borderRadius: "10px", flexWrap: "wrap" }}>
              <button 
                className={`rules-btn ${activeTab === "table" ? "active" : ""}`}
                style={{ flex: 1, border: "none", margin: 0, padding: "12px", minWidth: "80px", background: activeTab === "table" ? "linear-gradient(135deg, #ffcc00, #ff9900)" : "transparent", color: activeTab === "table" ? "#000" : "#fff" }}
                onClick={() => setActiveTab("table")}
              >
                📊 Points Table
              </button>
              <button 
                className={`rules-btn ${activeTab === "schedule" ? "active" : ""}`}
                style={{ flex: 1, border: "none", margin: 0, padding: "12px", minWidth: "80px", background: activeTab === "schedule" ? "linear-gradient(135deg, #ffcc00, #ff9900)" : "transparent", color: activeTab === "schedule" ? "#000" : "#fff" }}
                onClick={() => setActiveTab("schedule")}
              >
                📅 Matches
              </button>
              <button 
                className={`rules-btn ${activeTab === "playoffs" ? "active" : ""}`}
                style={{ flex: 1, border: "none", margin: 0, padding: "12px", minWidth: "80px", background: activeTab === "playoffs" ? "linear-gradient(135deg, #ffcc00, #ff9900)" : "transparent", color: activeTab === "playoffs" ? "#000" : "#fff" }}
                onClick={() => setActiveTab("playoffs")}
                disabled={stage === "league"}
              >
                🏁 Playoffs
              </button>
              <button 
                className={`rules-btn ${activeTab === "hof" ? "active" : ""}`}
                style={{ flex: 1, border: "none", margin: 0, padding: "12px", minWidth: "80px", background: activeTab === "hof" ? "linear-gradient(135deg, #ffd700, #ff8c00)" : "transparent", color: activeTab === "hof" ? "#000" : "#ffd700" }}
                onClick={() => setActiveTab("hof")}
              >
                🏆 HoF
              </button>
            </div>

            {/* Content Tabs */}
            {activeTab === "table" && (
              <div style={{ width: "100%", maxHeight: "380px", overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "15px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.15)", color: "#aaa" }}>
                      <th style={{ padding: "12px 8px" }}>Pos</th>
                      <th style={{ padding: "12px 8px" }}>Franchise</th>
                      <th style={{ padding: "12px 8px", textAlign: "center" }}>P</th>
                      <th style={{ padding: "12px 8px", textAlign: "center" }}>W</th>
                      <th style={{ padding: "12px 8px", textAlign: "center" }}>L</th>
                      <th style={{ padding: "12px 8px", textAlign: "center" }}>NCD</th>
                      <th style={{ padding: "12px 8px", textAlign: "center" }}>PTS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStandings.map((team, idx) => {
                      const isSelf = team.name === playerTeam;
                      return (
                        <tr 
                          key={team.name} 
                          style={{ 
                            borderBottom: "1px solid rgba(255,255,255,0.06)", 
                            background: isSelf ? "rgba(255,215,0,0.1)" : "transparent",
                            boxShadow: isSelf ? "inset 0 0 10px rgba(255,215,0,0.1)" : "none",
                            fontWeight: isSelf ? "bold" : "normal"
                          }}
                        >
                          <td style={{ padding: "12px 8px" }}>
                            {idx < 4 ? <span style={{ color: "#39ff88", fontWeight: "bold" }}>{idx + 1}</span> : idx + 1}
                          </td>
                          <td style={{ padding: "12px 8px", display: "flex", alignItems: "center", gap: "10px" }}>
                            <img 
                              src={teamLogos[team.name.trim().toLowerCase()] || FALLBACK_LOGO} 
                              alt={team.name} 
                              style={{ width: "24px", height: "24px", objectFit: "contain" }} 
                            />
                            <span style={{ color: isSelf ? "#ffd700" : "#fff" }}>{team.name}</span>
                          </td>
                          <td style={{ padding: "12px 8px", textAlign: "center" }}>{team.played}</td>
                          <td style={{ padding: "12px 8px", textAlign: "center" }}>{team.won}</td>
                          <td style={{ padding: "12px 8px", textAlign: "center" }}>{team.lost}</td>
                          <td style={{ padding: "12px 8px", textAlign: "center", color: (team.ncd || 0) > 0 ? "#39ff88" : (team.ncd || 0) < 0 ? "#ff4d4d" : "#aaa" }}>
                            {(team.ncd || 0) > 0 ? `+${team.ncd}` : team.ncd || 0}
                          </td>
                          <td style={{ padding: "12px 8px", textAlign: "center", color: isSelf ? "#ffd700" : "#39ff88", fontWeight: "bold" }}>
                            {team.points}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ marginTop: "12px", fontSize: "12px", color: "#888", textAlign: "left" }}>
                  * Green highlighted positions (Top 4) qualify for the Playoff stages.
                </div>
              </div>
            )}

            {activeTab === "schedule" && (
              <div style={{ width: "100%", maxHeight: "380px", overflowY: "auto", textAlign: "left" }}>
                {stage === "playoffs" ? (
                  <div style={{ padding: "20px", textAlign: "center", background: "rgba(255,255,255,0.02)", borderRadius: "10px" }}>
                    <p style={{ margin: 0, fontSize: "16px" }}>
                      🎉 League Stages Finished! Head over to the **Playoffs Bracket** tab to play your next match.
                    </p>
                  </div>
                ) : (
                  <div>
                    <h3 style={{ margin: "0 0 10px 0", color: "#ffd700" }}>Round {currentRoundIndex + 1} of 9 Schedule</h3>
                    <div style={{ display: "grid", gap: "10px" }}>
                      {currentRoundMatches.map((match, idx) => {
                        const isPlayerMatch = match.home === playerTeam || match.away === playerTeam;
                        const isUnlocked = idx === 0 || currentRoundMatches[idx - 1].played;
                        return (
                          <div 
                            key={idx}
                            style={{ 
                              display: "flex", 
                              justifyContent: "space-between", 
                              alignItems: "center", 
                              padding: "12px 16px", 
                              background: isPlayerMatch ? "rgba(255,215,0,0.08)" : "rgba(255,255,255,0.02)",
                              border: isPlayerMatch ? "1px solid rgba(255,215,0,0.3)" : "1px solid rgba(255,255,255,0.05)",
                              borderRadius: "10px",
                              opacity: isUnlocked || match.played ? 1.0 : 0.4
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "32%" }}>
                              <img src={teamLogos[match.home.trim().toLowerCase()] || FALLBACK_LOGO} style={{ width: "24px", height: "24px", objectFit: "contain" }} alt="" />
                              <span style={{ fontWeight: match.home === playerTeam ? "bold" : "normal", fontSize: "14px" }}>{match.home}</span>
                            </div>
                            
                            <div style={{ textAlign: "center", width: "36%" }}>
                              {match.played ? (
                                <div style={{ fontSize: "12px", color: "#39ff88", fontWeight: "bold" }}>
                                  Winner: {match.winner} (by {match.margin} cards)
                                </div>
                              ) : isPlayerMatch ? (
                                <span style={{ fontSize: "12px", color: isUnlocked ? "#ffd700" : "#888", fontWeight: "bold" }}>
                                  {isUnlocked ? "⏳ Next up for you!" : "🔒 Locked"}
                                </span>
                              ) : (
                                <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                                  <button 
                                    className="play-btn" 
                                    style={{ padding: "4px 10px", fontSize: "11px", width: "auto", margin: 0, height: "auto" }}
                                    onClick={() => handleStartMatch(match.home, match.away, "ai_vs_ai", { type: "league", roundIndex: currentRoundIndex, matchIndex: idx })}
                                    disabled={!isUnlocked}
                                  >
                                    🤖 Watch
                                  </button>
                                  <button 
                                    className="rules-btn" 
                                    style={{ padding: "4px 10px", fontSize: "11px", width: "auto", margin: 0, height: "auto", borderColor: isUnlocked ? "#ffd700" : "#444", color: isUnlocked ? "#ffd700" : "#666" }}
                                    onClick={() => simulateLeagueMatch(currentRoundIndex, idx)}
                                    disabled={!isUnlocked}
                                  >
                                    ⚡ Sim
                                  </button>
                                </div>
                              )}
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "flex-end", width: "32%" }}>
                              <span style={{ fontWeight: match.away === playerTeam ? "bold" : "normal", fontSize: "14px" }}>{match.away}</span>
                              <img src={teamLogos[match.away.trim().toLowerCase()] || FALLBACK_LOGO} style={{ width: "24px", height: "24px", objectFit: "contain" }} alt="" />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                      {currentRoundMatches.every(m => m.played) ? (
                        <button 
                          className="play-btn" 
                          style={{ padding: "12px 24px", minWidth: "180px" }}
                          onClick={advanceTournamentRound}
                        >
                          {currentRoundIndex < 8 ? "Next Round ➡️" : "Proceed to Playoffs 🏆"}
                        </button>
                      ) : (
                        <button 
                          className="rules-btn" 
                          style={{ padding: "12px 24px", minWidth: "220px", borderColor: "#ffd700", color: "#ffd700", margin: 0 }}
                          onClick={simulateAllRemainingMatches}
                        >
                          ⚡ Simulate Remaining Matches
                        </button>
                      )}
                      {/* Auto-Advance Toggle */}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", color: "#aaa" }}>
                        <span>⚡ Auto-Advance After My Match</span>
                        <button
                          onClick={() => setAutoAdvance(prev => !prev)}
                          style={{
                            width: "44px", height: "24px", borderRadius: "12px", border: "none", cursor: "pointer",
                            background: autoAdvance ? "#39ff88" : "rgba(255,255,255,0.15)",
                            position: "relative", transition: "background 0.3s", flexShrink: 0
                          }}
                          title={autoAdvance ? "Auto-Advance ON" : "Auto-Advance OFF"}
                        >
                          <span style={{
                            position: "absolute", top: "3px",
                            left: autoAdvance ? "23px" : "3px",
                            width: "18px", height: "18px", borderRadius: "50%",
                            background: "#fff", transition: "left 0.3s"
                          }} />
                        </button>
                        <span style={{ color: autoAdvance ? "#39ff88" : "#666", fontWeight: "bold", fontSize: "11px" }}>
                          {autoAdvance ? "ON" : "OFF"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "hof" && (
              <div style={{ width: "100%", maxHeight: "380px", overflowY: "auto", textAlign: "left" }}>
                <h3 style={{ color: "#ffd700", margin: "0 0 16px 0" }}>🏆 Hall of Fame — Champion Campaigns</h3>
                {hallOfFame.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 20px", color: "#666" }}>
                    <div style={{ fontSize: "60px", marginBottom: "16px", filter: "grayscale(1)" }}>🏆</div>
                    <p style={{ fontSize: "15px" }}>No champions yet. Win a Tournament to be immortalised here!</p>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: "12px" }}>
                    {hallOfFame.map((entry, idx) => {
                      const teamKey = entry.team?.trim().toLowerCase();
                      const logo = teamLogos[teamKey] || FALLBACK_LOGO;
                      return (
                        <div key={idx} style={{
                          display: "flex", alignItems: "center", gap: "16px",
                          padding: "14px 18px",
                          background: idx === 0 ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.03)",
                          border: idx === 0 ? "1px solid rgba(255,215,0,0.4)" : "1px solid rgba(255,255,255,0.06)",
                          borderRadius: "12px"
                        }}>
                          <div style={{ fontSize: "24px", minWidth: "32px", textAlign: "center" }}>
                            {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`}
                          </div>
                          <img src={logo} alt={entry.team} style={{ width: "36px", height: "36px", objectFit: "contain" }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: "bold", color: idx === 0 ? "#ffd700" : "#fff", fontSize: "15px" }}>{entry.team}</div>
                            <div style={{ fontSize: "12px", color: "#aaa", marginTop: "2px" }}>
                              {entry.leagueRecord} league record · {entry.date}
                            </div>
                          </div>
                          <div style={{ fontSize: "22px" }}>🏆</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === "playoffs" && playoffs && (
              <div style={{ width: "100%", maxHeight: "380px", overflowY: "auto", textAlign: "left" }}>
                <h3 style={{ color: "#ffd700", margin: "0 0 15px 0" }}>Playoffs Tournament Bracket</h3>
                
                <div style={{ display: "grid", gap: "12px" }}>
                  {/* Qualifier 1 */}
                  <div style={{ padding: "14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontWeight: "bold", color: "#ffd700" }}>Qualifier 1 (1st vs 2nd)</span>
                      <span>{playoffs.q1.played ? "✅ Complete" : (playoffs.q1.home ? renderPlayoffButtons("q1", playoffs.q1) : "⏳ Scheduled")}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>{playoffs.q1.home} vs {playoffs.q1.away}</span>
                      {playoffs.q1.winner && <span style={{ color: "#39ff88", fontWeight: "bold" }}>Winner: {playoffs.q1.winner}</span>}
                    </div>
                  </div>

                  {/* Eliminator */}
                  <div style={{ padding: "14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", opacity: playoffs.q1.played ? 1.0 : 0.4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontWeight: "bold", color: "#ffd700" }}>Eliminator (3rd vs 4th)</span>
                      <span>{playoffs.elim.played ? "✅ Complete" : (playoffs.elim.home ? renderPlayoffButtons("elim", playoffs.elim) : "⏳ Scheduled")}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>{playoffs.elim.home} vs {playoffs.elim.away}</span>
                      {playoffs.elim.winner && <span style={{ color: "#39ff88", fontWeight: "bold" }}>Winner: {playoffs.elim.winner}</span>}
                    </div>
                  </div>

                  {/* Qualifier 2 */}
                  <div style={{ padding: "14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px", opacity: playoffs.elim.played ? 1.0 : 0.4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontWeight: "bold", color: "#ffd700" }}>Qualifier 2 (Q1 Loser vs Elim Winner)</span>
                      <span>{playoffs.q2.played ? "✅ Complete" : (playoffs.q2.home ? renderPlayoffButtons("q2", playoffs.q2) : "🔒 Awaiting Matches")}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>{playoffs.q2.home || "???"} vs {playoffs.q2.away || "???"}</span>
                      {playoffs.q2.winner && <span style={{ color: "#39ff88", fontWeight: "bold" }}>Winner: {playoffs.q2.winner}</span>}
                    </div>
                  </div>

                  {/* Grand Final */}
                  <div style={{ padding: "14px", background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.15)", borderRadius: "10px", opacity: playoffs.q2.played ? 1.0 : 0.4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontWeight: "bold", color: "#ffd700" }}>Grand Final (Q1 Winner vs Q2 Winner)</span>
                      <span>{playoffs.final.played ? "🏆 Finished" : (playoffs.final.home ? renderPlayoffButtons("final", playoffs.final) : "🔒 Awaiting Bracket")}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>{playoffs.final.home || "???"} vs {playoffs.final.away || "???"}</span>
                      {playoffs.final.winner && <span style={{ color: "#ffd700", fontWeight: "bold" }}>Champion: {playoffs.final.winner}</span>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Next Match / Action Footer Panel */}
            <div style={{ marginTop: "24px", padding: "20px", background: "rgba(255,255,255,0.03)", borderRadius: "15px", border: "1px solid rgba(255,255,255,0.05)" }}>
              {stage === "league" ? (
                playerMatch && !playerMatch.played ? (
                  <div>
                    <h3 style={{ margin: "0 0 10px 0" }}>Next League Match: Round {currentRoundIndex + 1}</h3>
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "20px", marginBottom: "20px" }}>
                      <div style={{ textAlign: "center" }}>
                        <img src={teamLogos[playerTeam.toLowerCase()] || FALLBACK_LOGO} style={{ width: "40px", height: "40px" }} alt="" />
                        <p style={{ margin: "4px 0 0 0", fontWeight: "bold" }}>{playerTeam}</p>
                      </div>
                      <div style={{ fontSize: "20px", fontWeight: "bold", color: "#888" }}>VS</div>
                      <div style={{ textAlign: "center" }}>
                        <img src={teamLogos[opponentTeam.toLowerCase()] || FALLBACK_LOGO} style={{ width: "40px", height: "40px" }} alt="" />
                        <p style={{ margin: "4px 0 0 0", fontWeight: "bold" }}>{opponentTeam}</p>
                      </div>
                    </div>
                    <p style={{ margin: "0 0 20px 0", color: "#ccc", fontSize: "14px" }}>
                      🔥 League Round: contested over **7 cards**!
                    </p>
                    <div style={{ display: "flex", gap: "12px", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                      {!isPlayerMatchUnlocked && (
                        <p style={{ color: "#ff4d4d", fontSize: "14px", margin: "0 0 10px 0", fontWeight: "bold" }}>
                          🔒 Please resolve the preceding matches in the Schedule tab to unlock your match!
                        </p>
                      )}
                      <button 
                        className="play-btn" 
                        style={{ padding: "14px 28px", fontSize: "15px" }} 
                        onClick={() => handleStartMatch(playerTeam, opponentTeam, "ai", { type: "league", roundIndex: currentRoundIndex, matchIndex: playerMatchIndex })}
                        disabled={!isPlayerMatchUnlocked}
                      >
                        {isPlayerMatchUnlocked ? "🤖 Play vs AI Match" : "🔒 Match Locked"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: "center" }}>
                    <h3 style={{ margin: "0 0 10px 0", color: "#ffd700" }}>Round {currentRoundIndex + 1} Player Match Complete</h3>
                    <p style={{ color: "#ccc", marginBottom: "20px" }}>
                      You have finished your match. Please resolve or simulate the other fixtures of this round to continue.
                    </p>
                    {!currentRoundMatches.every(m => m.played) && (
                      <button 
                        className="play-btn" 
                        style={{ padding: "12px 24px" }}
                        onClick={simulateAllRemainingMatches}
                      >
                        ⚡ Simulate Remaining Matches
                      </button>
                    )}
                  </div>
                )
              ) : (
                <div>
                  {/* Playoff matchup evaluator */}
                  {(() => {
                    // Check if player has an active playoff match
                    let activePlayoffKey = null;
                    if (playoffs.q1.home && !playoffs.q1.played && (playoffs.q1.home === playerTeam || playoffs.q1.away === playerTeam)) {
                      activePlayoffKey = "q1";
                    } else if (playoffs.elim.home && !playoffs.elim.played && (playoffs.elim.home === playerTeam || playoffs.elim.away === playerTeam)) {
                      activePlayoffKey = "elim";
                    } else if (playoffs.q2.home && !playoffs.q2.played && (playoffs.q2.home === playerTeam || playoffs.q2.away === playerTeam)) {
                      activePlayoffKey = "q2";
                    } else if (playoffs.final.home && !playoffs.final.played && (playoffs.final.home === playerTeam || playoffs.final.away === playerTeam)) {
                      activePlayoffKey = "final";
                    }

                    if (activePlayoffKey) {
                      const match = playoffs[activePlayoffKey];
                      const opponent = match.home === playerTeam ? match.away : match.home;
                      const cardCount = activePlayoffKey === "final" ? 11 : 9;
                      const matchName = activePlayoffKey === "q1" ? "Qualifier 1" : activePlayoffKey === "elim" ? "Eliminator" : activePlayoffKey === "q2" ? "Qualifier 2" : "Grand Final";
                      
                      let isPlayoffMatchUnlocked = true;
                      if (activePlayoffKey === "elim") {
                        isPlayoffMatchUnlocked = playoffs.q1.played;
                      } else if (activePlayoffKey === "q2") {
                        isPlayoffMatchUnlocked = playoffs.elim.played;
                      } else if (activePlayoffKey === "final") {
                        isPlayoffMatchUnlocked = playoffs.q2.played;
                      }

                      return (
                        <div>
                          <h3 style={{ margin: "0 0 10px 0", color: "#ffd700" }}>Playoffs: {matchName}</h3>
                          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "20px", marginBottom: "20px" }}>
                            <div>
                              <img src={teamLogos[playerTeam.toLowerCase()] || FALLBACK_LOGO} style={{ width: "40px", height: "40px" }} alt="" />
                              <p style={{ margin: "4px 0 0 0", fontWeight: "bold" }}>{playerTeam}</p>
                            </div>
                            <div style={{ fontSize: "20px", fontWeight: "bold", color: "#ffd700" }}>VS</div>
                            <div>
                              <img src={teamLogos[opponent.toLowerCase()] || FALLBACK_LOGO} style={{ width: "40px", height: "40px" }} alt="" />
                              <p style={{ margin: "4px 0 0 0", fontWeight: "bold" }}>{opponent}</p>
                            </div>
                          </div>
                          <p style={{ margin: "0 0 20px 0", color: "#ccc", fontSize: "14px" }}>
                            ⚡ High Stakes: contested over **{cardCount} cards**!
                          </p>
                          <div style={{ display: "flex", gap: "12px", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                            {!isPlayoffMatchUnlocked && (
                              <p style={{ color: "#ff4d4d", fontSize: "14px", margin: "0 0 10px 0", fontWeight: "bold" }}>
                                🔒 Please resolve the preceding matches in the Playoffs Bracket tab to unlock your match!
                              </p>
                            )}
                            <button 
                              className="play-btn" 
                              style={{ padding: "14px 28px", fontSize: "15px" }} 
                              onClick={() => handleStartPlayoffMatch(activePlayoffKey, "ai")}
                              disabled={!isPlayoffMatchUnlocked}
                            >
                              {isPlayoffMatchUnlocked ? "🤖 Play vs AI Match" : "🔒 Match Locked"}
                            </button>
                          </div>
                        </div>
                      );
                    } else {
                      // Player has no scheduled match. Are they eliminated or waiting?
                      if (stage === "playoffs") {
                        return (
                          <div style={{ textAlign: "center" }}>
                            <h3 style={{ margin: "0 0 10px 0", color: "#ffd700" }}>Playoffs Match Awaiting</h3>
                            <p style={{ color: "#ccc", margin: 0 }}>
                              You are waiting for the other playoff matches to resolve. Head over to the **Playoffs Bracket** tab to simulate or watch them.
                            </p>
                          </div>
                        );
                      }
                      return (
                        <p style={{ margin: 0, color: "#ccc" }}>
                          ℹ️ You have been eliminated from the playoffs. View the standings/bracket above, or reset to start over!
                        </p>
                      );
                    }
                  })()}
                </div>
              )}
            </div>
          </>
        )}

        {/* Global Reset buttons */}
        <div style={{ display: "flex", width: "100%", justifyContent: "space-between", marginTop: "30px" }}>
          <button 
            className="home-btn secondary" 
            style={{ minWidth: "140px", margin: 0 }}
            onClick={() => setGameMode(null)}
          >
            Exit to Menu
          </button>
          <button 
            className="rules-btn" 
            style={{ border: "1px solid rgba(255,75,75,0.4)", color: "#ff4d4d", minWidth: "140px" }}
            onClick={handleResetActive}
          >
            🚨 Reset Campaign
          </button>
        </div>

      </div>
    </div>
  );
}

export default TournamentMode;
