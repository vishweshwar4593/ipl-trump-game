import { useEffect, useRef } from "react";

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

function ResultScreen({ title, buttonText = "Back to Home", onBack, matchStats }) {
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
  if (matchStats) {
    const { cardsWon, cardsLost, statHistory = [], tournamentContext } = matchStats;

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