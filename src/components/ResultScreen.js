import { useState, useEffect, useRef } from "react";
import { calculatePOTM, getPOTMReason } from "../utils/cricketEngine.js";

const STAT_LABELS = {
  runs: "Runs",
  matches: "Matches",
  hs: "High Score",
  battingAvg: "Bat Avg",
  battingSR: "Bat SR",
  hundreds: "100s",
  fifties: "50s",
  wickets: "Wickets",
  economy: "Economy",
  bowlingAvg: "Bowl Avg",
  bowlingSR: "Bowl SR",
  catches: "Catches",
};

const BATTING_STATS = new Set(["runs", "matches", "hs", "battingAvg", "battingSR", "hundreds", "fifties"]);
const BOWLING_STATS = new Set(["wickets", "economy", "bowlingAvg", "bowlingSR"]);

const generateSportscasterRecap = (statHistory, isWin, isDraw) => {
  if (!statHistory || statHistory.length === 0) return "";
  
  const pWinsEarly = statHistory.slice(0, 2).filter(r => r.result === "player").length;
  const pWinsLate = statHistory.slice(-2).filter(r => r.result === "player").length;
  const aiWinsMid = statHistory.slice(2, 5).filter(r => r.result === "ai").length;

  let recap = "";
  if (isWin) {
    recap += `🏆 A brilliant victory! `;
    if (pWinsEarly === 2) {
      recap += `You got off to a flying start, dominating the early rounds. `;
    }
    if (aiWinsMid >= 2) {
      recap += `Although the opponent fought back strongly in the middle stages, `;
    } else {
      recap += `You maintained steady control throughout the match, `;
    }
    if (pWinsLate >= 1) {
      recap += `and you finished strong in the death overs to seal the win.`;
    } else {
      recap += `holding on to your lead at the finish line.`;
    }
  } else if (isDraw) {
    recap += `🤝 It's a tie! A nail-biting encounter ends in a draw. `;
    recap += `Both sides matched each other round-for-round in a true battle of strategies.`;
  } else {
    recap += `😈 The opponent claimed the victory this time. `;
    if (pWinsEarly === 2) {
      recap += `You started strong in the opening rounds, but `;
    }
    if (aiWinsMid >= 2) {
      recap += `the opponent mounted a massive comeback in the middle overs, `;
    } else {
      recap += `the opponent slowly clawed their way back, `;
    }
    recap += `leaving your deck trailing at the end.`;
  }
  return recap;
};

const getMatchMVPs = (statHistory) => {
  const playerCardStats = {};
  const aiCardStats = {};
  
  statHistory.forEach(r => {
    if (r.playerCard) {
      if (!playerCardStats[r.playerCard]) playerCardStats[r.playerCard] = { wins: 0, maxVal: 0, stat: "" };
      if (r.result === "player") playerCardStats[r.playerCard].wins += 1;
      if (r.playerValue > playerCardStats[r.playerCard].maxVal) {
        playerCardStats[r.playerCard].maxVal = r.playerValue;
        playerCardStats[r.playerCard].stat = r.stat;
      }
    }
    if (r.aiCard) {
      if (!aiCardStats[r.aiCard]) aiCardStats[r.aiCard] = { wins: 0, maxVal: 0, stat: "" };
      if (r.result === "ai") aiCardStats[r.aiCard].wins += 1;
      if (r.aiValue > aiCardStats[r.aiCard].maxVal) {
        aiCardStats[r.aiCard].maxVal = r.aiValue;
        aiCardStats[r.aiCard].stat = r.stat;
      }
    }
  });

  let bestPlayerCard = null;
  let bestPlayerWins = -1;
  let bestPlayerVal = -1;
  for (const name in playerCardStats) {
    const { wins, maxVal } = playerCardStats[name];
    if (wins > bestPlayerWins || (wins === bestPlayerWins && maxVal > bestPlayerVal)) {
      bestPlayerWins = wins;
      bestPlayerVal = maxVal;
      bestPlayerCard = { name, wins, maxVal, stat: playerCardStats[name].stat };
    }
  }

  let bestAiCard = null;
  let bestAiWins = -1;
  let bestAiVal = -1;
  for (const name in aiCardStats) {
    const { wins, maxVal } = aiCardStats[name];
    if (wins > bestAiWins || (wins === bestAiWins && maxVal > bestAiVal)) {
      bestAiWins = wins;
      bestAiVal = maxVal;
      bestAiCard = { name, wins, maxVal, stat: aiCardStats[name].stat };
    }
  }

  return { playerMvp: bestPlayerCard, aiMvp: bestAiCard };
};

function ResultScreen({
  title,
  buttonText = "Back to Home",
  onBack,
  matchStats,
  gameMode,
  cricketScore,
  playerTeam,
  aiTeam,
  overHistory
}) {
  const [showSummary, setShowSummary] = useState(false);

  const isWin  = title.toLowerCase().includes("player wins") ||
                 title.toLowerCase().includes("player 1 wins") ||
                 title.toLowerCase().includes("player 2 wins") ||
                 title.toLowerCase().includes("you win") ||
                 title.toLowerCase().includes("match won");
  const isDraw = title.toLowerCase().includes("draw");

  const icon    = isWin ? "🏆" : isDraw ? "🤝" : "😈";
  const variant = isWin ? "result-win" : isDraw ? "result-draw" : "result-loss";

  /* simple particle burst on win */
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!isWin) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.5,
      r: Math.random() * 6 + 3,
      dx: (Math.random() - 0.5) * 4,
      dy: Math.random() * 3 + 1,
      color: ["#FFD700","#FF9900","#00FF88","#00CFFF","#FF6BFF"][Math.floor(Math.random() * 5)],
      alpha: 1,
    }));

    let frame;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.dx;
        p.y += p.dy;
        p.alpha -= 0.008;
        if (p.alpha < 0) p.alpha = 0;
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      if (particles.some(p => p.alpha > 0)) frame = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(frame);
  }, [isWin]);

  // Compute stat breakdown from statHistory
  let statsPanel = null;

  if (gameMode === "team" && overHistory && overHistory.length > 0) {
    const potm = calculatePOTM(overHistory);
    const potmReason = getPOTMReason(potm);
    const cricketWinner = title.toLowerCase().includes("you win") ? "player" : (title.toLowerCase().includes("ai wins") ? "ai" : "tie");
    const computedOversLimit = Math.max(...overHistory.map(o => o.overNumber));

    let marginText = "";
    if (cricketWinner === "tie") {
      marginText = "The match ended in a thrilling Tie! 🤝";
    } else {
      const finalScorePlayer = cricketScore?.player?.runs || 0;
      const finalScoreAi = cricketScore?.ai?.runs || 0;
      const playerWickets = cricketScore?.player?.wickets || 0;
      const aiWickets = cricketScore?.ai?.wickets || 0;
      
      const chasedTeam = overHistory.find(o => o.innings === 2)?.winner || null;
      const runsDiff = Math.abs(finalScorePlayer - finalScoreAi);
      
      if (cricketWinner === "player") {
        if (chasedTeam === "player") {
          const limit = computedOversLimit === 5 ? 5 : computedOversLimit === 10 ? 7 : 10;
          marginText = `🏆 ${playerTeam} won by ${limit - playerWickets} Wickets!`;
        } else {
          marginText = `🏆 ${playerTeam} won by ${runsDiff} Runs!`;
        }
      } else {
        if (chasedTeam === "ai") {
          const limit = computedOversLimit === 5 ? 5 : computedOversLimit === 10 ? 7 : 10;
          marginText = `🏆 ${aiTeam} won by ${limit - aiWickets} Wickets!`;
        } else {
          marginText = `🏆 ${aiTeam} won by ${runsDiff} Runs!`;
        }
      }
    }

    statsPanel = (
      <div className="cricket-results-panel" style={{ width: "100%", marginTop: "15px", color: "#fff", display: "flex", flexDirection: "column", gap: "20px" }}>
        
        {/* Margin Banner */}
        <div style={{ background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.3)", padding: "12px", borderRadius: "10px", fontWeight: "bold", color: "#ffd700", fontSize: "15px", textAlign: "center" }}>
          {marginText}
        </div>

        {/* Player of the Match */}
        {potm && (
          <div className="potm-card glass-card" style={{ background: "linear-gradient(135deg, rgba(255,215,0,0.15), rgba(0,0,0,0.6))", border: "1px solid #ffd700", padding: "15px", borderRadius: "14px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", boxShadow: "0 4px 15px rgba(0,0,0,0.4)" }}>
            <span style={{ fontSize: "10px", color: "#ffd700", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.15em" }}>🌟 Player of the Match</span>
            <h2 style={{ margin: 0, color: "#fff", fontSize: "20px" }}>{potm.name}</h2>
            <p style={{ margin: 0, fontSize: "13px", color: "#00ff88", fontWeight: "bold" }}>
              {potm.runs} Runs Scored &bull; {potm.wickets} Wickets Taken
            </p>
            <p style={{ margin: 0, fontSize: "12px", color: "#aaa", fontStyle: "italic", textAlign: "center" }}>
              "{potmReason}"
            </p>
          </div>
        )}

        {/* Innings Scorecard Collapse */}
        <div className="stats-summary-wrapper" style={{ width: "100%" }}>
          <button 
            className={`summary-toggle-btn ${showSummary ? "active" : ""}`}
            onClick={() => setShowSummary(!showSummary)}
            type="button"
            style={{ width: "100%", padding: "12px", display: "flex", justifyContent: "space-between", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", cursor: "pointer", fontSize: "14px" }}
          >
            <span>{showSummary ? "Hide Match Scorecard" : "Show Match Scorecard"}</span>
            <span className="arrow-icon">{showSummary ? "▲" : "▼"}</span>
          </button>

          <div className={`summary-collapse-container ${showSummary ? "expanded" : ""}`} style={{ display: showSummary ? "block" : "none", marginTop: "15px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              
              {/* Innings 1 Scorecard */}
              <div className="innings-card" style={{ background: "rgba(0,0,0,0.3)", borderRadius: "10px", padding: "15px", border: "1px solid rgba(255,255,255,0.05)" }}>
                <h3 style={{ margin: "0 0 10px 0", color: "#ffd700", textAlign: "left", fontSize: "14px" }}>
                  1st Innings: {overHistory.find(o => o.innings === 1)?.winner === "player" ? playerTeam : aiTeam} Scorecard
                </h3>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", color: "#aaa" }}>
                        <th style={{ padding: "6px" }}>Over</th>
                        <th style={{ padding: "6px" }}>Batter</th>
                        <th style={{ padding: "6px" }}>Bowler</th>
                        <th style={{ padding: "6px" }}>Stat</th>
                        <th style={{ padding: "6px", textAlign: "right" }}>Runs</th>
                        <th style={{ padding: "6px", textAlign: "right" }}>Wicket</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overHistory.filter(o => o.innings === 1).map((over, index) => (
                        <tr key={index} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                          <td style={{ padding: "6px", color: "#00cfff" }}>Over {over.overNumber}</td>
                          <td style={{ padding: "6px", fontWeight: "bold" }}>{over.battingPlayer}</td>
                          <td style={{ padding: "6px", color: "#ccc" }}>{over.bowlingPlayer}</td>
                          <td style={{ padding: "6px", color: "#aaa" }}>{STAT_LABELS[over.selectedStat] || over.selectedStat}</td>
                          <td style={{ padding: "6px", textAlign: "right", color: over.runs > 0 ? "#00ff88" : "#fff", fontWeight: over.runs > 0 ? "bold" : "normal" }}>{over.runs}</td>
                          <td style={{ padding: "6px", textAlign: "right", color: over.wicket > 0 ? "#ff4b2b" : "#aaa", fontWeight: over.wicket > 0 ? "bold" : "normal" }}>{over.wicket > 0 ? "W" : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Innings 2 Scorecard */}
              {overHistory.some(o => o.innings === 2) && (
                <div className="innings-card" style={{ background: "rgba(0,0,0,0.3)", borderRadius: "10px", padding: "15px", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <h3 style={{ margin: "0 0 10px 0", color: "#ffd700", textAlign: "left", fontSize: "14px" }}>
                    2nd Innings: {overHistory.find(o => o.innings === 2)?.winner === "player" ? playerTeam : aiTeam} Scorecard
                  </h3>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", color: "#aaa" }}>
                          <th style={{ padding: "6px" }}>Over</th>
                          <th style={{ padding: "6px" }}>Batter</th>
                          <th style={{ padding: "6px" }}>Bowler</th>
                          <th style={{ padding: "6px" }}>Stat</th>
                          <th style={{ padding: "6px", textAlign: "right" }}>Runs</th>
                          <th style={{ padding: "6px", textAlign: "right" }}>Wicket</th>
                        </tr>
                      </thead>
                      <tbody>
                        {overHistory.filter(o => o.innings === 2).map((over, index) => (
                          <tr key={index} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                            <td style={{ padding: "6px", color: "#00cfff" }}>Over {over.overNumber}</td>
                            <td style={{ padding: "6px", fontWeight: "bold" }}>{over.battingPlayer}</td>
                            <td style={{ padding: "6px", color: "#ccc" }}>{over.bowlingPlayer}</td>
                            <td style={{ padding: "6px", color: "#aaa" }}>{STAT_LABELS[over.selectedStat] || over.selectedStat}</td>
                            <td style={{ padding: "6px", textAlign: "right", color: over.runs > 0 ? "#00ff88" : "#fff", fontWeight: over.runs > 0 ? "bold" : "normal" }}>{over.runs}</td>
                            <td style={{ padding: "6px", textAlign: "right", color: over.wicket > 0 ? "#ff4b2b" : "#aaa", fontWeight: over.wicket > 0 ? "bold" : "normal" }}>{over.wicket > 0 ? "W" : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

      </div>
    );
  }

  if (matchStats) {
    const { cardsWon, cardsLost, statHistory = [], tournamentContext } = matchStats;

    const recapText = generateSportscasterRecap(statHistory, isWin, isDraw);
    const mvps = getMatchMVPs(statHistory);

    let totalRunsPlayer = 0;
    let totalRunsAi = 0;
    let totalWicketsPlayer = 0;
    let totalWicketsAi = 0;
    let hasBatting = false;
    let hasBowling = false;

    statHistory.forEach(r => {
      if (BATTING_STATS.has(r.stat)) {
        totalRunsPlayer += (r.playerValue || 0);
        totalRunsAi += (r.aiValue || 0);
        hasBatting = true;
      }
      if (BOWLING_STATS.has(r.stat)) {
        if (r.stat === "wickets") {
          totalWicketsPlayer += (r.playerValue || 0);
          totalWicketsAi += (r.aiValue || 0);
          hasBowling = true;
        }
      }
    });

    const statCounts = {};
    let battingCount = 0;
    let bowlingCount = 0;
    let fieldingCount = 0;
    let bestStatEntry = null;

    statHistory.forEach(({ stat, result }) => {
      statCounts[stat] = (statCounts[stat] || 0) + 1;
      if (BATTING_STATS.has(stat)) battingCount++;
      else if (BOWLING_STATS.has(stat)) bowlingCount++;
      else fieldingCount++; // catches

      if (result === "player" && (!bestStatEntry || statCounts[stat] > (statCounts[bestStatEntry] || 0))) {
        bestStatEntry = stat;
      }
    });

    // Most-used winning stat
    let mostUsedWinningStat = null;
    let mostUsedCount = 0;
    statHistory.filter(e => e.result === "player").forEach(({ stat }) => {
      const cnt = statHistory.filter(e => e.stat === stat && e.result === "player").length;
      if (cnt > mostUsedCount) { mostUsedCount = cnt; mostUsedWinningStat = stat; }
    });

    const totalRounds = statHistory.length;

    statsPanel = (
      <div className="match-stats-panel">
        <div className="stats-panel-title">📊 Match Summary</div>

        {/* Cards row */}
        <div className="stats-row-cards">
          <div className="stats-card-block win-block">
            <span className="stats-card-number">{cardsWon}</span>
            <span className="stats-card-label">Cards Won</span>
          </div>
          <div className="stats-divider-vert" />
          <div className="stats-card-block loss-block">
            <span className="stats-card-number">{cardsLost}</span>
            <span className="stats-card-label">Cards Lost</span>
          </div>
          <div className="stats-divider-vert" />
          <div className="stats-card-block neutral-block">
            <span className="stats-card-number">{totalRounds}</span>
            <span className="stats-card-label">Rounds</span>
          </div>
        </div>

        {/* Stat category breakdown */}
        {totalRounds > 0 && (
          <div className="stats-category-row">
            {battingCount > 0 && (
              <div className="stat-category-pill batting">
                🏏 Batting <strong>{battingCount}</strong>
              </div>
            )}
            {bowlingCount > 0 && (
              <div className="stat-category-pill bowling">
                🍒 Bowling <strong>{bowlingCount}</strong>
              </div>
            )}
            {fieldingCount > 0 && (
              <div className="stat-category-pill fielding">
                🧤 Fielding <strong>{fieldingCount}</strong>
              </div>
            )}
          </div>
        )}

        {/* Best stat */}
        {mostUsedWinningStat && (
          <div className="stats-best-stat">
            ⭐ Best Stat: <strong>{STAT_LABELS[mostUsedWinningStat] || mostUsedWinningStat}</strong>
            <span className="best-stat-wins"> ({mostUsedCount} win{mostUsedCount !== 1 ? "s" : ""})</span>
          </div>
        )}

        {/* Tournament context */}
        {tournamentContext && (
          <div className="stats-tournament-context">
            <span>📍 Round {tournamentContext.roundIndex + 1}/9</span>
            <span>🏅 Rank #{tournamentContext.rank}</span>
            <span>⭐ {tournamentContext.points} pts</span>
          </div>
        )}

        {/* Match Summary Toggle & Round Details */}
        {statHistory.length > 0 && (
          <div className="stats-summary-wrapper">
            <button 
              className={`summary-toggle-btn ${showSummary ? "active" : ""}`}
              onClick={() => setShowSummary(!showSummary)}
              type="button"
            >
              <span>{showSummary ? "Hide Match Summary" : "Show Match Summary"}</span>
              <span className="arrow-icon">{showSummary ? "▲" : "▼"}</span>
            </button>

            <div className={`summary-collapse-container ${showSummary ? "expanded" : ""}`}>
              <div className="summary-highlevel-container">
                {/* Commentary Recap Box */}
                <div className="recap-commentary-box">
                  <p>{recapText}</p>
                </div>

                {/* Match MVPs Row */}
                <div className="mvp-cards-row">
                  {mvps.playerMvp && (
                    <div className="mvp-card player-mvp">
                      <div className="mvp-badge">🎖️ YOUR MVP</div>
                      <div className="mvp-card-name">{mvps.playerMvp.name}</div>
                      <div className="mvp-stat-detail">
                        Won <strong>{mvps.playerMvp.wins}</strong> rounds | Max: <strong>{mvps.playerMvp.maxVal}</strong> ({STAT_LABELS[mvps.playerMvp.stat]})
                      </div>
                    </div>
                  )}
                  {mvps.aiMvp && (
                    <div className="mvp-card opponent-mvp">
                      <div className="mvp-badge">🎖️ OPPONENT MVP</div>
                      <div className="mvp-card-name">{mvps.aiMvp.name}</div>
                      <div className="mvp-stat-detail">
                        Won <strong>{mvps.aiMvp.wins}</strong> rounds | Max: <strong>{mvps.aiMvp.maxVal}</strong> ({STAT_LABELS[mvps.aiMvp.stat]})
                      </div>
                    </div>
                  )}
                </div>

                {/* Compare Stats Grid */}
                {(hasBatting || hasBowling) && (
                  <div className="comparison-stats-grid">
                    <div className="comparison-grid-title">📊 Team Comparisons</div>
                    {hasBatting && (
                      <div className="comparison-stat-row">
                        <span className="comp-label">Runs Scored</span>
                        <span className="comp-values">
                          {totalRunsPlayer} {totalRunsPlayer > totalRunsAi ? ">" : totalRunsPlayer < totalRunsAi ? "<" : "="} {totalRunsAi}
                        </span>
                      </div>
                    )}
                    {hasBowling && (
                      <div className="comparison-stat-row">
                        <span className="comp-label">Wickets Taken</span>
                        <span className="comp-values">
                          {totalWicketsPlayer} {totalWicketsPlayer > totalWicketsAi ? ">" : totalWicketsPlayer < totalWicketsAi ? "<" : "="} {totalWicketsAi}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`result-screen ${variant}`}>
      {isWin && <canvas ref={canvasRef} className="result-canvas" />}

      <div className="result-card">
        <div className="result-icon">{icon}</div>
        <h1 className="result-title">{title}</h1>
        <div className="result-divider" />
        {statsPanel}
        <button className="result-btn" onClick={onBack}>
          {buttonText}
        </button>
      </div>
    </div>
  );
}

export default ResultScreen;