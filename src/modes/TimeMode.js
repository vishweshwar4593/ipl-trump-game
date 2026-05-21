function TimeMode({
    setSelectedTime,
    setGameMode
}) {
    return (
        <div className="home">

            <div className="home-container">
                <h1>⏱ Select Time</h1>

                <button className="home-btn" onClick={() => setSelectedTime(120)}>
                    2 Minutes
                </button>

                <button className="home-btn" onClick={() => setSelectedTime(240)}>
                    4 Minutes
                </button>

                <button className="home-btn" onClick={() => setSelectedTime(360)}>
                    6 Minutes
                </button>

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

export default TimeMode;