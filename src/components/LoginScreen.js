import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";

function LoginScreen({ onContinueAsGuest, onAuthSuccess }) {
    const {
        signInWithEmail,
        signInWithGoogle,
        sendValidationLink,
        isEmailLink,
        completeEmailLinkSignIn,
        setPasswordForUser,
        updateUserProfile,
        resetPasswordByEmail,
        logout
    } = useAuth();

    const [mode, setMode] = useState("login"); // "login" | "signup" | "forgot-password" | "set-password"
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Check if redirect link exists in URL on mount
    useEffect(() => {
        const checkLink = async () => {
            const currentUrl = window.location.href;
            if (isEmailLink(currentUrl)) {
                setLoading(true);
                setError(null);
                setSuccess(null);
                try {
                    // Temporarily block App.js from redirecting
                    sessionStorage.setItem("settingPassword", "true");

                    let savedEmail = window.localStorage.getItem("emailForSignIn");
                    if (!savedEmail) {
                        savedEmail = window.prompt("Please confirm your email address:");
                    }
                    if (savedEmail) {
                        await completeEmailLinkSignIn(savedEmail, currentUrl);
                        // Clean URL query parameters
                        window.history.replaceState({}, document.title, window.location.origin);
                        setMode("set-password");
                        setSuccess("Email verified successfully! Please set a password for your account.");
                    } else {
                        sessionStorage.removeItem("settingPassword");
                        setError("Verification cancelled. Email confirmation is required.");
                    }
                } catch (err) {
                    console.error("Sign in with link error:", err);
                    sessionStorage.removeItem("settingPassword");
                    setError("Failed to verify the sign-in link. It may have expired or already been used.");
                } finally {
                    setLoading(false);
                }
            }
        };
        checkLink();
    }, [isEmailLink, completeEmailLinkSignIn]);

    const getFriendlyError = (code) => {
        switch (code) {
            case "auth/email-already-in-use": return "An account already exists with this email.";
            case "auth/user-not-found": return "No account found with this email.";
            case "auth/wrong-password": return "Incorrect password. Please try again.";
            case "auth/invalid-credential": return "Incorrect email or password.";
            case "auth/weak-password": return "Password must be at least 6 characters.";
            case "auth/too-many-requests": return "Too many attempts. Please wait a moment.";
            default: return "Something went wrong. Please try again.";
        }
    };

    const validateEmailFormat = (emailStr) => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        // 1. FORGOT PASSWORD MODE
        if (mode === "forgot-password") {
            if (!validateEmailFormat(email)) {
                setError("Please enter a valid email address.");
                return;
            }
            setLoading(true);
            try {
                await resetPasswordByEmail(email);
                setSuccess("A password reset link has been sent to your email!");
            } catch (err) {
                console.error("Password reset error:", err);
                setError(getFriendlyError(err.code));
            } finally {
                setLoading(false);
            }
            return;
        }

        // 2. SIGN UP MODE (Sends email link)
        if (mode === "signup") {
            if (!validateEmailFormat(email)) {
                setError("Please enter a valid email address.");
                return;
            }
            setLoading(true);
            try {
                // Save email to localStorage so it can be verified automatically on click
                window.localStorage.setItem("emailForSignIn", email);
                await sendValidationLink(email);
                setSuccess("A verification link has been sent to your email! Click it to set your password.");
            } catch (err) {
                console.error("Send validation link error:", err);
                setError(getFriendlyError(err.code));
            } finally {
                setLoading(false);
            }
            return;
        }

        // 3. SET PASSWORD MODE (Passwordless completion)
        if (mode === "set-password") {
            if (password.length < 6) {
                setError("Password must be at least 6 characters.");
                return;
            }
            if (password !== confirmPassword) {
                setError("Passwords do not match.");
                return;
            }
            setLoading(true);
            try {
                // Set the password
                await setPasswordForUser(password);
                
                // Automatically set Display Name to their email prefix
                const userEmail = window.localStorage.getItem("emailForSignIn") || email;
                const displayName = userEmail.split("@")[0];
                await updateUserProfile(displayName);

                // Log out immediately so the user has to login manually
                await logout();

                // Clean up sessionStorage
                sessionStorage.removeItem("settingPassword");
                sessionStorage.removeItem("justSignedUp");

                // Prefill details and switch back to login mode
                setMode("login");
                setEmail(userEmail);
                setPassword("");
                setConfirmPassword("");
                setSuccess("Account created successfully! Please enter your password to login. 🚀");

                window.localStorage.removeItem("emailForSignIn");
            } catch (err) {
                console.error("Set password error:", err);
                setError("Failed to set password. Please sign in again or reset password.");
            } finally {
                setLoading(false);
            }
            return;
        }

        // 4. LOGIN MODE (Normal login)
        if (mode === "login") {
            if (!validateEmailFormat(email)) {
                setError("Please enter a valid email address.");
                return;
            }
            if (password.length < 6) {
                setError("Password must be at least 6 characters.");
                return;
            }
            setLoading(true);
            try {
                await signInWithEmail(email, password);
            } catch (err) {
                console.error("Sign in error:", err);
                setError(getFriendlyError(err.code));
            } finally {
                setLoading(false);
            }
        }
    };

    const switchMode = (newMode) => {
        setMode(newMode);
        setError(null);
        setSuccess(null);
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setShowPassword(false);
        setShowConfirmPassword(false);
    };

    const handleGoogleSignIn = async () => {
        setError(null);
        setSuccess(null);
        setLoading(true);
        try {
            await signInWithGoogle();
        } catch (err) {
            console.error("Google auth error:", err);
            setError("Google sign-in failed. Please try again.");
        } finally {
            setLoading(false);
        }
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

                {/* Mode Toggle (only show for standard login/signup) */}
                {(mode === "login" || mode === "signup") && (
                    <div className="auth-toggle">
                        <button
                            className={`auth-tab ${mode === "login" ? "active" : ""}`}
                            onClick={() => switchMode("login")}
                            type="button"
                        >
                            Login
                        </button>
                        <button
                            className={`auth-tab ${mode === "signup" ? "active" : ""}`}
                            onClick={() => switchMode("signup")}
                            type="button"
                        >
                            Sign Up
                        </button>
                    </div>
                )}

                {/* Mode Headers */}
                {mode === "set-password" && (
                    <h2 className="auth-step-title">🔒 Set Password</h2>
                )}
                {mode === "forgot-password" && (
                    <h2 className="auth-step-title">🔑 Recover Password</h2>
                )}

                {/* Form */}
                <form className="auth-form" onSubmit={handleSubmit} noValidate>
                    
                    {/* Email Input (Show on Login, Signup, Forgot Password) */}
                    {mode !== "set-password" && (
                        <div className="auth-field">
                            <label className="auth-label">✉️ Email Address</label>
                            <input
                                className="auth-input"
                                type="email"
                                placeholder="e.g. virat@gmail.com"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    setError(null);
                                    setSuccess(null);
                                }}
                                autoComplete="email"
                                disabled={loading}
                            />
                        </div>
                    )}

                    {/* Password Input (Show on Login, Set Password) */}
                    {(mode === "login" || mode === "set-password") && (
                        <div className="auth-field">
                            <label className="auth-label">🔒 Password</label>
                            <div className="password-input-container">
                                <input
                                    className="auth-input"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Min. 6 characters"
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        setError(null);
                                        setSuccess(null);
                                    }}
                                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    className="password-toggle-btn"
                                    onClick={() => setShowPassword(!showPassword)}
                                    title={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? "🙈" : "👁️"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Confirm Password Input (Show on Set Password) */}
                    {mode === "set-password" && (
                        <div className="auth-field">
                            <label className="auth-label">🔒 Confirm Password</label>
                            <div className="password-input-container">
                                <input
                                    className="auth-input"
                                    type={showConfirmPassword ? "text" : "password"}
                                    placeholder="Re-enter your password"
                                    value={confirmPassword}
                                    onChange={(e) => {
                                        setConfirmPassword(e.target.value);
                                        setError(null);
                                        setSuccess(null);
                                    }}
                                    autoComplete="new-password"
                                    disabled={loading}
                                />
                                <button
                                    type="button"
                                    className="password-toggle-btn"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    title={showConfirmPassword ? "Hide password" : "Show password"}
                                >
                                    {showConfirmPassword ? "🙈" : "👁️"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Error & Success Messages */}
                    {error && <p className="login-error">⚠️ {error}</p>}
                    {success && <p className="login-success">✅ {success}</p>}

                    {/* Forgot Password Link (Only on Login) */}
                    {mode === "login" && (
                        <div style={{ textAlign: "right", marginTop: "-6px" }}>
                            <span 
                                className="auth-switch-link" 
                                style={{ fontSize: 13 }}
                                onClick={() => switchMode("forgot-password")}
                            >
                                Forgot Password?
                            </span>
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        className="auth-submit-btn"
                        type="submit"
                        disabled={loading}
                    >
                        {loading ? (
                            <><span className="login-spinner" /> Processing...</>
                        ) : (
                            mode === "login" ? "🚀 Login" : 
                            mode === "signup" ? "✉️ Send Verification Link" : 
                            mode === "set-password" ? "🎉 Save & Play" : "🔑 Send Reset Email"
                        )}
                    </button>
                </form>

                {/* Google Sign-In (Hide during Password creation) */}
                {mode !== "set-password" && (
                    <>
                        <button
                            className="google-btn"
                            onClick={handleGoogleSignIn}
                            disabled={loading}
                            type="button"
                        >
                            <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                            </svg>
                            <span>Sign in with Google</span>
                        </button>

                        {/* Divider */}
                        <div className="or-divider">
                            <span className="or-line" />
                            <span className="or-text">or</span>
                            <span className="or-line" />
                        </div>
                    </>
                )}

                {/* Guest Play */}
                <button className="guest-btn" onClick={onContinueAsGuest} type="button">
                    🎮 Play as Guest
                </button>

                {/* Mode Switch Helper Note */}
                <p className="login-note">
                    {mode === "login" && (
                        <>Don't have an account? <span className="auth-switch-link" onClick={() => switchMode("signup")}>Sign Up</span></>
                    )}
                    {mode === "signup" && (
                        <>Already have an account? <span className="auth-switch-link" onClick={() => switchMode("login")}>Login</span></>
                    )}
                    {mode === "forgot-password" && (
                        <>Remembered password? <span className="auth-switch-link" onClick={() => switchMode("login")}>Back to Login</span></>
                    )}
                    {mode === "set-password" && (
                        <>Need help? <span className="auth-switch-link" onClick={() => switchMode("signup")}>Start Over</span></>
                    )}
                </p>
            </div>
        </div>
    );
}

export default LoginScreen;
