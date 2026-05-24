import { useState } from "react";

function HomeScreen({
    setGameMode,
    rulesMode,
    setRulesMode,
    modeRules,
    setSelectedTime,
    setGameOver,
    isMuted,
    toggleMute,
    onResumeGame,
    setPlayStyle,
    user,
    isGuest,
    onSignOut
}) {
    const [selectedBaseMode, setSelectedBaseMode] = useState(null);
    const [showProfile, setShowProfile] = useState(false);

    const handleSelectPlayStyle = (style) => {
        setPlayStyle(style);
        setGameMode(selectedBaseMode);
        setSelectedBaseMode(null);
    };

    // ✅ FIX: parse once on mount — not on every render (e.g. profile dropdown toggle)
    const [savedState] = useState(() => {
        try {
            const str = localStorage.getItem("savedGameState");
            return str ? JSON.parse(str) : null;
        } catch {
            return null;
        }
    });

    // Derive display name
    const displayName = user?.displayName || (isGuest ? "Guest" : "Player");
    const avatarLetter = displayName.charAt(0).toUpperCase();

    return (
        <div className="home">

            {/* 🔊 Mute Button - top right */}
            <button
                className="mute-btn"
                onClick={toggleMute}
            >
                {isMuted ? "🔇" : "🔊"}
            </button>

            {/* 👤 Profile Widget - top left */}
            <div className="profile-widget">
                <button
                    className="profile-trigger"
                    onClick={() => setShowProfile(prev => !prev)}
                    aria-label="Profile menu"
                >
                    <div className="profile-avatar">{avatarLetter}</div>
                    <span className="profile-name">{displayName}</span>
                    <span className="profile-chevron">{showProfile ? "▲" : "▼"}</span>
                </button>

                {showProfile && (
                    <div className="profile-dropdown">
                        <div className="profile-dropdown-header">
                            <div className="profile-avatar-lg">{avatarLetter}</div>
                            <div>
                                <p className="profile-dropdown-name">{displayName}</p>
                                <p className="profile-dropdown-role">
                                    {isGuest ? "🎮 Guest Player" : "✅ Signed In"}
                                </p>
                            </div>
                        </div>
                        <div className="profile-dropdown-divider" />
                        {!isGuest && user ? (
                            <button
                                className="profile-signout-btn"
                                onClick={() => { setShowProfile(false); onSignOut(); }}
                            >
                                🚪 Sign Out
                            </button>
                        ) : (
                            <button
                                className="profile-signin-btn"
                                onClick={() => { setShowProfile(false); onSignOut(); }}
                            >
                                🔐 Go to Login
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Rules Modal */}
            {rulesMode && (
                <div className="modal-overlay">
                    <div className="modal rules-modal">
                        <div className="rules-header">
                            <h2>{modeRules[rulesMode].title}</h2>
                            <button className="close-icon-btn" onClick={() => setRulesMode(null)}>
                                ✕
                            </button>
                        </div>

                        <ul className="rules-list">
                            {modeRules[rulesMode].points.map((rule, index) => (
                                <li key={index}>{rule}</li>
                            ))}
                        </ul>

                        <div className="rules-footer">
                            <button className="close-btn" onClick={() => setRulesMode(null)}>
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Play Style Modal */}
            {selectedBaseMode && (
                <div className="modal-overlay">
                    <div className="modal" style={{ textAlign: 'center' }}>
                        <h2>Choose Play Style</h2>
                        <p style={{ marginBottom: '20px', color: '#666' }}>How would you like to play?</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <button className="play-btn" style={{ padding: '15px', fontSize: '18px' }} onClick={() => handleSelectPlayStyle('ai')}>🤖 Play vs AI</button>
                            <button className="play-btn" style={{ padding: '15px', fontSize: '18px', backgroundColor: '#9b59b6' }} onClick={() => handleSelectPlayStyle('local')}>🎮 Local Multiplayer</button>
                            <button className="play-btn" style={{ padding: '15px', fontSize: '18px', backgroundColor: '#e67e22' }} onClick={() => handleSelectPlayStyle('online')}>🌐 Play Online</button>
                            <button className="close-btn" style={{ marginTop: '10px' }} onClick={() => setSelectedBaseMode(null)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="home-main">
                <h1 className="home-title">🏏 IPL TRUMP CARDS</h1>

                {savedState && (
                    <button
                        className="home-btn"
                        onClick={() => onResumeGame(savedState)}
                        style={{ margin: '0 auto 30px auto', display: 'block', backgroundColor: '#FFD700', color: '#111', fontWeight: 'bold' }}
                    >
                        ▶️ Resume Saved Game
                    </button>
                )}

                <h2 className="home-subtitle">Modes</h2>

                <div className="modes-grid">

                    <div className="mode-card">
                        <div className="mode-icon">🏏</div>
                        <h3>Classic Mode</h3>
                        <span className="mode-tag">Standard Trump Match</span>
                        <p>Play the traditional trump card game.</p>
                        <div className="mode-actions">
                            <button className="play-btn" onClick={() => setSelectedBaseMode("classic")}>Play</button>
                            <button className="rules-btn" onClick={() => setRulesMode("classic")}>Rules</button>
                        </div>
                    </div>

                    <div className="mode-card">
                        <div className="mode-icon">⏱</div>
                        <h3>Time Mode</h3>
                        <span className="mode-tag">Fast Timed Challenge</span>
                        <p>Beat the AI before the timer runs out.</p>
                        <div className="mode-actions">
                            <button
                                className="play-btn"
                                onClick={() => {
                                    setSelectedBaseMode("time");
                                    setGameOver(false);
                                }}
                            >
                                Play
                            </button>
                            <button className="rules-btn" onClick={() => setRulesMode("time")}>Rules</button>
                        </div>
                    </div>

                    <div className="mode-card">
                        <div className="mode-icon">⚔️</div>
                        <h3>Battle Mode</h3>
                        <span className="mode-tag">HP Damage Duel</span>
                        <p>Use stat wins to damage AI HP.</p>
                        <div className="mode-actions">
                            <button className="play-btn" onClick={() => setSelectedBaseMode("battle")}>Play</button>
                            <button className="rules-btn" onClick={() => setRulesMode("battle")}>Rules</button>
                        </div>
                    </div>

                    <div className="mode-card">
                        <div className="mode-icon">👥</div>
                        <h3>Team Mode</h3>
                        <span className="mode-tag">Franchise vs Franchise</span>
                        <p>Select teams and battle team vs team.</p>
                        <div className="mode-actions">
                            <button className="play-btn" onClick={() => setSelectedBaseMode("team")}>Play</button>
                            <button className="rules-btn" onClick={() => setRulesMode("team")}>Rules</button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

export default HomeScreen;
