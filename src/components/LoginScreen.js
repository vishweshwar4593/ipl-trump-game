import { useAuth } from "../context/AuthContext";
import { useState } from "react";

function LoginScreen({ onContinueAsGuest }) {
    const { signUpWithUsername, signInWithUsername } = useAuth();

    const [mode, setMode] = useState("login"); // "login" | "signup"
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const isLogin = mode === "login";

    const getFriendlyError = (code) => {
        switch (code) {
            case "auth/email-already-in-use": return "Username already taken. Try a different one.";
            case "auth/user-not-found": return "No account found with that username.";
            case "auth/wrong-password": return "Incorrect password. Please try again.";
            case "auth/invalid-credential": return "Incorrect username or password.";
            case "auth/weak-password": return "Password must be at least 6 characters.";
            case "auth/too-many-requests": return "Too many attempts. Please wait a moment.";
            default: return "Something went wrong. Please try again.";
        }
    };

    const validateUsername = (name) => /^[a-zA-Z0-9_]{3,20}$/.test(name);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (!validateUsername(username)) {
            setError("Username must be 3–20 characters: letters, numbers, underscores only.");
            return;
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }
        if (!isLogin && password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);
        try {
            if (isLogin) {
                await signInWithUsername(username, password);
            } else {
                await signUpWithUsername(username, password);
                setSuccess(`Welcome, ${username}! Account created 🎉`);
            }
        } catch (err) {
            setError(getFriendlyError(err.code));
        } finally {
            setLoading(false);
        }
    };

    const switchMode = () => {
        setMode(isLogin ? "signup" : "login");
        setError(null);
        setSuccess(null);
        setUsername("");
        setPassword("");
        setConfirmPassword("");
    };

    return (
        <div className="login-screen">
            <div className="decorative-glow g1"></div>
            <div className="decorative-glow g2"></div>
            <div className="login-container">
                {/* Logo */}
                <div className="login-logo">🏏</div>
                <h1 className="login-title">IPL TRUMP CARDS</h1>
                <p className="login-subtitle">The Ultimate Cricket Card Battle</p>

                {/* Mode Toggle */}
                <div className="auth-toggle">
                    <button
                        className={`auth-tab ${isLogin ? "active" : ""}`}
                        onClick={() => !isLogin && switchMode()}
                        type="button"
                    >
                        Login
                    </button>
                    <button
                        className={`auth-tab ${!isLogin ? "active" : ""}`}
                        onClick={() => isLogin && switchMode()}
                        type="button"
                    >
                        Sign Up
                    </button>
                </div>

                {/* Form */}
                <form className="auth-form" onSubmit={handleSubmit} noValidate>
                    {/* Username */}
                    <div className="auth-field">
                        <label className="auth-label">👤 Username</label>
                        <input
                            className="auth-input"
                            type="text"
                            placeholder="e.g. cricket_king"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            autoComplete="username"
                            maxLength={20}
                            disabled={loading}
                        />
                    </div>

                    {/* Password */}
                    <div className="auth-field">
                        <label className="auth-label">🔒 Password</label>
                        <input
                            className="auth-input"
                            type="password"
                            placeholder="Min. 6 characters"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete={isLogin ? "current-password" : "new-password"}
                            disabled={loading}
                        />
                    </div>

                    {/* Confirm Password (Signup only) */}
                    {!isLogin && (
                        <div className="auth-field">
                            <label className="auth-label">🔒 Confirm Password</label>
                            <input
                                className="auth-input"
                                type="password"
                                placeholder="Re-enter your password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                autoComplete="new-password"
                                disabled={loading}
                            />
                        </div>
                    )}

                    {/* Error */}
                    {error && <p className="login-error">⚠️ {error}</p>}
                    {success && <p className="login-success">✅ {success}</p>}

                    {/* Submit Button */}
                    <button
                        className="auth-submit-btn"
                        type="submit"
                        disabled={loading}
                    >
                        {loading ? (
                            <><span className="login-spinner" /> {isLogin ? "Logging in..." : "Creating account..."}</>
                        ) : (
                            isLogin ? "🚀 Login" : "🎉 Create Account"
                        )}
                    </button>
                </form>

                {/* Divider */}
                <div className="or-divider">
                    <span className="or-line" />
                    <span className="or-text">or</span>
                    <span className="or-line" />
                </div>

                {/* Guest */}
                <button className="guest-btn" onClick={onContinueAsGuest} type="button">
                    🎮 Play as Guest
                </button>

                <p className="login-note">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <span className="auth-switch-link" onClick={switchMode}>
                        {isLogin ? "Sign Up" : "Login"}
                    </span>
                </p>
            </div>
        </div>
    );
}

export default LoginScreen;
