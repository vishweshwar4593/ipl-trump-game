import React, { forwardRef } from "react";
import teamLogos from "../data/teamLogos";
import back from "../assets/back.png";
import { getModifiedStat, getRoundStage } from "../hooks/useGameEngine";

// ✅ FIX: neutral cricket ball SVG used as fallback instead of silently
// showing another team's (CSK) logo for unrecognised team names
const FALLBACK_LOGO = `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%23cc2200'/><path d='M50 5 Q70 30 70 50 Q70 70 50 95 Q30 70 30 50 Q30 30 50 5Z' fill='%23aa1100'/><path d='M5 50 Q30 30 50 30 Q70 30 95 50 Q70 70 50 70 Q30 70 5 50Z' fill='%23aa1100'/><path d='M50 5 Q70 30 70 50 Q70 70 50 95' stroke='%23f5e6c8' stroke-width='2' fill='none'/><path d='M5 50 Q30 30 50 30 Q70 30 95 50' stroke='%23f5e6c8' stroke-width='2' fill='none'/></svg>`;


const teamColors = {
  "mumbai indians": "rgba(0, 75, 160, 0.6)",
  "chennai super kings": "rgba(255, 215, 0, 0.6)",
  "royal challengers bengaluru": "rgba(218, 24, 24, 0.6)",
  "kolkata knight riders": "rgba(58, 34, 93, 0.6)",
  "delhi capitals": "rgba(23, 68, 155, 0.6)",
  "sunrisers hyderabad": "rgba(255, 130, 42, 0.6)",
  "rajasthan royals": "rgba(234, 26, 133, 0.6)",
  "punjab kings": "rgba(237, 27, 36, 0.6)",
  "lucknow super giants": "rgba(0, 174, 239, 0.6)",
  "gujarat titans": "rgba(100, 100, 100, 0.6)"
};

const teamGlowColors = {
  "mumbai indians": "#004ba0",              // Deep Blue
  "chennai super kings": "#ffd700",         // Yellow
  "royal challengers bengaluru": "#ff1818",  // Red
  "kolkata knight riders": "#703893",       // Purple
  "delhi capitals": "#17449b",              // Blue (Blue & Red themed)
  "sunrisers hyderabad": "#ff822a",         // Orange
  "rajasthan royals": "#ea1a85",            // Pink (Pink & Blue themed)
  "punjab kings": "#a30f14",                // Deep Crimson / Red
  "gujarat titans": "#1b3b6f",              // Navy Blue (Navy & Gold themed)
  "lucknow super giants": "#39ff88"         // Lush Green
};



const Card = forwardRef(({ player, type, onStatClick, winner, selectedStat, animate, turn, showCard, move, style, isMultiplayerMode, turnTimerKey, showTimeoutGlow, gameMode, playStyle, turnTimeout = 20000, pitchCondition, round, weather, moisture, swapGraceActive }, ref) => {

  const stage = getRoundStage(round);
  const isPowerplay = stage === "powerplay";
  const isMiddleOvers = stage === "middle";
  const isDeathOvers = stage === "death";

  const isStatEligible = (key) => {
    if (gameMode !== "team" && gameMode !== "tournament") return true;
    if (isPowerplay) {
      return ['runs', 'hs', 'battingAvg', 'battingSR', 'hundreds', 'fifties'].includes(key);
    }
    if (isMiddleOvers) {
      return ['matches', 'catches'].includes(key);
    }
    if (isDeathOvers) {
      return ['wickets', 'economy', 'bowlingAvg', 'bowlingSR'].includes(key);
    }
    return true;
  };

  if (!player) return null;
  const teamKey = player?.team?.trim().toLowerCase();
  const logo = teamLogos[teamKey] || FALLBACK_LOGO; // ✅ FIX: neutral fallback, not CSK
  const borderColor = teamColors[teamKey] || "#FFD700";
  const glowColor = teamGlowColors[teamKey] || "#39ff88";


  const statsList = [
    { key: "matches", label: "Matches" },
    { key: "runs", label: "Runs" },
    { key: "hs", label: "HS" },
    { key: "battingAvg", label: "Avg" },
    { key: "battingSR", label: "SR" },
    { key: "hundreds", label: "100s" },
    { key: "fifties", label: "50s" },
    { key: "wickets", label: "Wkts" },
    { key: "economy", label: "Econ" },
    { key: "bowlingAvg", label: "Bowl Avg" },
    { key: "bowlingSR", label: "Bowl SR" },
    { key: "catches", label: "Catches" }
  ];

  if (!showCard) {
    return (
      <div
        ref={ref}
        className={`card ${move || ""}`}
        style={style}
      >
        <div className="card-inner">
          <div className="card-front">
            <div className="card-back-center">
              <img src={back} alt="IPL Logo" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    // ✅ FIX: key on a Fragment forces remount of the whole card when turnTimerKey changes,
    // correctly resetting CSS animations. Previously key was on a non-list div (ignored by React).
    <React.Fragment key={turnTimerKey}>
    <div
      ref={ref}
      className={`card ${move || ""} ${winner === type ? "win" : ""} ${showTimeoutGlow ? "timeout-glow" : ""}`}
      style={{
        ...style,
        border: `2px solid ${borderColor}`,
        boxShadow: (
          winner === type
            ? `0 0 12px ${borderColor}, 0 0 25px ${borderColor}`
            : `0 0 8px ${borderColor}`
        )
      }}
    >

      {showTimeoutGlow && (
        <svg className="timeout-border-svg" viewBox="0 0 300 420" preserveAspectRatio="none">
          <rect
            className="timeout-border-track"
            style={{ stroke: `${glowColor}22` }}
            x="3"
            y="3"
            width="294"
            height="414"
            rx="20"
            ry="20"
          />
          <rect
            className="timeout-border-progress"
            style={{
              animationDuration: `${turnTimeout / 1000}s`,
              stroke: glowColor,
              filter: `drop-shadow(0 0 6px ${glowColor}) drop-shadow(0 0 12px ${glowColor})`
            }}
            x="3"
            y="3"
            width="294"
            height="414"
            rx="20"
            ry="20"
          />
        </svg>
      )}

      <div className="card-inner">

        {/* FRONT */}
        <div className="card-front">

          <div
            className="card-bg"
            style={{ backgroundImage: `url(${logo})` }}
          ></div>

          <div className="header">
            <img src={logo} alt="logo" />
            <h2>{player.name}</h2>
            <div className="team">{player?.team}</div>
          </div>

          <div className="stats">
            {statsList.map((stat) => {
              const eligible = isStatEligible(stat.key);
              const isLowerBetter = ["economy", "bowlingAvg", "bowlingSR"].includes(stat.key);

              const originalVal = player[stat.key] ?? 0;
              const modifiedVal = getModifiedStat(player, stat.key, pitchCondition, weather, moisture);
              
              let statStyle = {};
              let arrow = null;

              if (pitchCondition) {
                if (modifiedVal !== originalVal) {
                  const isImproved = isLowerBetter ? (modifiedVal < originalVal) : (modifiedVal > originalVal);
                  if (isImproved) {
                    statStyle = { color: "#39ff88", textShadow: "0 0 8px rgba(57, 255, 136, 0.4)" };
                    arrow = <span style={{ marginLeft: "4px", fontSize: "12px" }}>▲</span>;
                  } else {
                    statStyle = { color: "#ff4b2b", textShadow: "0 0 8px rgba(255, 75, 43, 0.4)" };
                    arrow = <span style={{ marginLeft: "4px", fontSize: "12px" }}>▼</span>;
                  }
                }
              }

              const isUserTurn = playStyle === "ai_vs_ai"
                ? false
                : playStyle === "online"
                  ? (type === "player" && turn === "player")
                  : (
                    (type === "player" && turn === "player") ||
                    (isMultiplayerMode && type === "ai" && turn === "ai")
                  );

              const isClickable = isUserTurn && !selectedStat && eligible && !swapGraceActive;

              return (
                <div
                  key={stat.key}
                  className={`stat 
                    ${selectedStat === stat.key ? "active" : ""} 
                    ${selectedStat && selectedStat !== stat.key ? "dim" : ""}
                    ${isClickable ? "clickable" : eligible ? "disabled-stat" : "locked-stat"}`}
                  onClick={() => {
                    if (isClickable) {
                      onStatClick(stat.key);
                    }
                  }}
                >
                  <div className="label">{stat.label}</div>
                  <div className="value" style={statStyle}>
                    {modifiedVal ?? "-"}
                    {arrow}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="footer">
            {playStyle === "ai_vs_ai"
              ? (turn === type ? `${player?.team} Turn` : "Wait...")
              : type === "player"
                ? turn === "player"
                  ? isMultiplayerMode
                    ? "Player 1 Turn"
                    : "Your Turn"
                  : "Wait..."
                : turn === "ai"
                  ? isMultiplayerMode
                    ? "Player 2 Turn"
                    : playStyle === "online"
                      ? "Opponent's Turn"
                      : "AI Thinking..."
                  : "Waiting..."
            }
          </div>

        </div>

      </div>
    </div>
    </React.Fragment>
  );
});

export default Card;