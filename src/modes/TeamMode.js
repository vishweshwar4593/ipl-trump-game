function TeamMode({
    playerTeam,
    setPlayerTeam,
    aiTeam,
    setAiTeam,
    teams,
    setGameMode
}) {

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

    return null;
}

export default TeamMode;