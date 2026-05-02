import React, { forwardRef } from "react";
import teamLogos from "../data/teamLogos";
import back from "../assets/back.png";

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



const Card = forwardRef(({ player, type, onStatClick, winner, selectedStat, animate, turn, showCard, move, style, isMultiplayerMode, turnTimerKey, showTimeoutGlow, gameMode, playStyle }, ref) => {

  if (!player) return null;
  const teamKey = player?.team?.trim().toLowerCase();
  const logo = teamLogos[teamKey] || teamLogos["chennai super kings"];
  const borderColor = teamColors[teamKey] || "#FFD700";


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
            x="3"
            y="3"
            width="294"
            height="414"
            rx="20"
            ry="20"
          />
          <rect
            className="timeout-border-progress"
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
            {statsList.map((stat) => (
              <div
                key={stat.key}
                className={`stat 
  ${selectedStat === stat.key ? "active" : ""} 
  ${selectedStat && selectedStat !== stat.key ? "dim" : ""}
  ${(playStyle === "online"
                    ? (type === "player" && turn === "player")
                    : (
                      (type === "player" && turn === "player") ||
                      (isMultiplayerMode && type === "ai" && turn === "ai")
                    )
                  ) && !selectedStat
                    ? "clickable"
                    : "disabled-stat"
                  }`}
                onClick={() => {
                  const isPlayer1Turn = type === "player" && turn === "player";
                  const isPlayer2Turn = isMultiplayerMode && type === "ai" && turn === "ai";

                  if (
                    (playStyle === "online"
                      ? isPlayer1Turn
                      : (isPlayer1Turn || isPlayer2Turn)
                    ) &&
                    !selectedStat
                  ) {
                    onStatClick(stat.key);
                  }
                }}
              >
                <div className="label">{stat.label}</div>
                <div className="value">{player[stat.key] ?? "-"}</div>
              </div>
            ))}
          </div>

          <div className="footer">
            {type === "player"
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