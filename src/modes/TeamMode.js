import React, { useState } from "react";

function TeamMode({
    playerTeam,
    setPlayerTeam,
    aiTeam,
    setAiTeam,
    teams,
    setGameMode,
    setOversLimit,
    onStartMatch
}) {
    const [formatSelected, setFormatSelected] = useState(false);

    if (!playerTeam) {
        return (
            <div className="home">
                <div className="home-container">
                    <h1>Select Your Team</h1>

                    <div className="team-buttons">
                        {teams.map(team => (
                            <button
                                key={team}
                                className="home-btn"
                                onClick={() => {
                                    setPlayerTeam(team);
                                }}
                            >
                                {team}
                            </button>
                        ))}
                    </div>

                    <button
                        className="home-btn secondary"
                        onClick={() => setGameMode(null)}
                    >
                        Back
                    </button>
                </div>
            </div>
        );
    }

    if (playerTeam && !aiTeam) {
        return (
            <div className="home">
                <div className="home-container">
                    <h1>Select Opponent Team</h1>

                    <div className="team-buttons">
                        {teams
                            .filter(team => team !== playerTeam)
                            .map(team => (
                                <button
                                    key={team}
                                    className="home-btn"
                                    onClick={() => setAiTeam(team)}
                                >
                                    {team}
                                </button>
                            ))}
                    </div>

                    <button
                        className="home-btn secondary"
                        onClick={() => setPlayerTeam(null)}
                    >
                        Back
                    </button>
                </div>
            </div>
        );
    }

    if (playerTeam && aiTeam && !formatSelected) {
        return (
            <div className="home">
                <div className="home-container">
                    <h1>Select Match Format</h1>
                    <p style={{ marginBottom: "20px", color: "#aaa" }}>
                        Choose the duration of your franchise T20 match
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "15px", margin: "20px 0" }}>
                        <button 
                            className="play-btn" 
                            onClick={() => { 
                                setOversLimit(5); 
                                setFormatSelected(true); 
                                onStartMatch(5);
                            }}
                        >
                            🏏 5 Overs (5 Wickets Limit)
                        </button>
                        <button 
                            className="play-btn" 
                            onClick={() => { 
                                setOversLimit(10); 
                                setFormatSelected(true); 
                                onStartMatch(10);
                            }}
                        >
                            🏏 10 Overs (7 Wickets Limit)
                        </button>
                        <button 
                            className="play-btn" 
                            onClick={() => { 
                                setOversLimit(20); 
                                setFormatSelected(true); 
                                onStartMatch(20);
                            }}
                        >
                            🏏 20 Overs (10 Wickets Limit)
                        </button>
                    </div>
                    <button 
                        className="home-btn secondary" 
                        onClick={() => setAiTeam(null)}
                    >
                        Back
                    </button>
                </div>
            </div>
        );
    }

    return null;
}

export default TeamMode;