import React, { useState } from "react";
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
  startMatch // App.js trigger: startMatch(opponentTeam, isOnline)
}) {
  const [activeTab, setActiveTab] = useState("table");
  const [resetContext, setResetContext] = useState(null); // null | "active_reset" | "new_campaign"

  // Load state on mount if it exists, otherwise trigger franchise selection
  const selectFranchise = (team) => {
    // Generate fresh schedule
    const allFranchises = [...teams];
    const generatedSchedule = generateSchedule(allFranchises);
    
    // Initialize points table
    const initialTable = {};
    teams.forEach(t => {
      initialTable[t] = { played: 0, won: 0, lost: 0, points: 0 };
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

  // Sort teams for points table
  const sortedStandings = Object.keys(pointsTable)
    .map(team => ({
      name: team,
      ...pointsTable[team]
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.won !== a.won) return b.won - a.won;
      return a.name.localeCompare(b.name);
    });

  // Calculate current rank of player
  const playerRank = sortedStandings.findIndex(t => t.name === playerTeam) + 1;

  const handleStartMatch = (playStyleOverride) => {
    setPlayStyle(playStyleOverride);
    startMatch(opponentTeam, playStyleOverride === "online");
  };

  const handleStartPlayoffMatch = (matchKey, playStyleOverride) => {
    setPlayStyle(playStyleOverride);
    const playoffMatch = playoffs[matchKey];
    const playoffOpponent = playoffMatch.home === playerTeam ? playoffMatch.away : playoffMatch.home;
    startMatch(playoffOpponent, playStyleOverride === "online");
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
                Rank #{playerRank} | {pointsTable[playerTeam].points} PTS ({pointsTable[playerTeam].won}W - {pointsTable[playerTeam].lost}L)
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
            <div style={{ display: "flex", gap: "10px", width: "100%", marginBottom: "20px", background: "rgba(255,255,255,0.03)", padding: "6px", borderRadius: "10px" }}>
              <button 
                className={`rules-btn ${activeTab === "table" ? "active" : ""}`}
                style={{ flex: 1, border: "none", margin: 0, padding: "12px", background: activeTab === "table" ? "linear-gradient(135deg, #ffcc00, #ff9900)" : "transparent", color: activeTab === "table" ? "#000" : "#fff" }}
                onClick={() => setActiveTab("table")}
              >
                📊 Points Table
              </button>
              <button 
                className={`rules-btn ${activeTab === "schedule" ? "active" : ""}`}
                style={{ flex: 1, border: "none", margin: 0, padding: "12px", background: activeTab === "schedule" ? "linear-gradient(135deg, #ffcc00, #ff9900)" : "transparent", color: activeTab === "schedule" ? "#000" : "#fff" }}
                onClick={() => setActiveTab("schedule")}
              >
                📅 Matches / Schedule
              </button>
              <button 
                className={`rules-btn ${activeTab === "playoffs" ? "active" : ""}`}
                style={{ flex: 1, border: "none", margin: 0, padding: "12px", background: activeTab === "playoffs" ? "linear-gradient(135deg, #ffcc00, #ff9900)" : "transparent", color: activeTab === "playoffs" ? "#000" : "#fff" }}
                onClick={() => setActiveTab("playoffs")}
                disabled={stage === "league"}
              >
                🏁 Playoffs Bracket
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
                              borderRadius: "10px"
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "40%" }}>
                              <img src={teamLogos[match.home.trim().toLowerCase()] || FALLBACK_LOGO} style={{ width: "24px", height: "24px", objectFit: "contain" }} alt="" />
                              <span style={{ fontWeight: match.home === playerTeam ? "bold" : "normal" }}>{match.home}</span>
                            </div>
                            <div style={{ color: "#aaa", fontWeight: "bold" }}>vs</div>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "flex-end", width: "40%" }}>
                              <span style={{ fontWeight: match.away === playerTeam ? "bold" : "normal" }}>{match.away}</span>
                              <img src={teamLogos[match.away.trim().toLowerCase()] || FALLBACK_LOGO} style={{ width: "24px", height: "24px", objectFit: "contain" }} alt="" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
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
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ fontWeight: "bold", color: "#ffd700" }}>Qualifier 1 (1st vs 2nd)</span>
                      <span>{playoffs.q1.played ? "✅ Complete" : "⏳ Scheduled"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>{playoffs.q1.home} vs {playoffs.q1.away}</span>
                      {playoffs.q1.winner && <span style={{ color: "#39ff88", fontWeight: "bold" }}>Winner: {playoffs.q1.winner}</span>}
                    </div>
                  </div>

                  {/* Eliminator */}
                  <div style={{ padding: "14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ fontWeight: "bold", color: "#ffd700" }}>Eliminator (3rd vs 4th)</span>
                      <span>{playoffs.elim.played ? "✅ Complete" : "⏳ Scheduled"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>{playoffs.elim.home} vs {playoffs.elim.away}</span>
                      {playoffs.elim.winner && <span style={{ color: "#39ff88", fontWeight: "bold" }}>Winner: {playoffs.elim.winner}</span>}
                    </div>
                  </div>

                  {/* Qualifier 2 */}
                  <div style={{ padding: "14px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ fontWeight: "bold", color: "#ffd700" }}>Qualifier 2 (Q1 Loser vs Elim Winner)</span>
                      <span>{playoffs.q2.played ? "✅ Complete" : playoffs.q2.home ? "⏳ Scheduled" : "🔒 Awaiting Matches"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>{playoffs.q2.home || "???"} vs {playoffs.q2.away || "???"}</span>
                      {playoffs.q2.winner && <span style={{ color: "#39ff88", fontWeight: "bold" }}>Winner: {playoffs.q2.winner}</span>}
                    </div>
                  </div>

                  {/* Grand Final */}
                  <div style={{ padding: "14px", background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.15)", borderRadius: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ fontWeight: "bold", color: "#ffd700" }}>Grand Final (Q1 Winner vs Q2 Winner)</span>
                      <span>{playoffs.final.played ? "🏆 Finished" : playoffs.final.home ? "⏳ Scheduled" : "🔒 Awaiting Bracket"}</span>
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
                  <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                    {playStyle === "online" ? (
                      <button className="play-btn" style={{ padding: "14px 28px", fontSize: "15px", backgroundColor: "#e67e22" }} onClick={() => handleStartMatch("online")}>
                        🌐 Play Online Match
                      </button>
                    ) : (
                      <button className="play-btn" style={{ padding: "14px 28px", fontSize: "15px" }} onClick={() => handleStartMatch("ai")}>
                        🤖 Play vs AI Match
                      </button>
                    )}
                  </div>
                </div>
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
                          <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                            {playStyle === "online" ? (
                              <button className="play-btn" style={{ padding: "14px 28px", fontSize: "15px", backgroundColor: "#e67e22" }} onClick={() => handleStartPlayoffMatch(activePlayoffKey, "online")}>
                                🌐 Play Online Match
                              </button>
                            ) : (
                              <button className="play-btn" style={{ padding: "14px 28px", fontSize: "15px" }} onClick={() => handleStartPlayoffMatch(activePlayoffKey, "ai")}>
                                🤖 Play vs AI Match
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <p style={{ margin: 0, color: "#ccc" }}>
                          ℹ️ You have been eliminated from the playoffs. View the bracket above, or reset to start over!
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
