import { createContext, useContext, useState, useEffect } from "react";
import { auth } from "../firebase";
import {
    signOut,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    updateProfile,
    setPersistence,
    browserSessionPersistence,
    GoogleAuthProvider,
    signInWithPopup,
    sendSignInLinkToEmail,
    isSignInWithEmailLink,
    signInWithEmailLink,
    updatePassword,
    sendPasswordResetEmail
} from "firebase/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(undefined); // undefined = loading, null = not signed in

    useEffect(() => {
        // Force the session to expire when the browser/tab is closed
        setPersistence(auth, browserSessionPersistence)
            .then(() => {
                const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
                    setUser(firebaseUser ?? null);
                });
                return () => unsubscribe();
            })
            .catch((error) => {
                console.error("Auth persistence error:", error);
            });
    }, []);

    // Login with real Email + Password
    const signInWithEmail = (email, password) => {
        return signInWithEmailAndPassword(auth, email, password);
    };

    // Google Sign-In — signs in using Google provider pop-up
    const signInWithGoogle = () => {
        const provider = new GoogleAuthProvider();
        return signInWithPopup(auth, provider);
    };

    // Send Verification/Login link to Email
    const sendValidationLink = (email) => {
        const actionCodeSettings = {
            url: window.location.origin, // Redirects back to our home page
            handleCodeInApp: true
        };
        return sendSignInLinkToEmail(auth, email, actionCodeSettings);
    };

    // Check if the current URL is an email sign-in link
    const isEmailLink = (href) => {
        return isSignInWithEmailLink(auth, href);
    };

    // Complete authentication using email sign-in link
    const completeEmailLinkSignIn = (email, href) => {
        return signInWithEmailLink(auth, email, href);
    };

    // Set or update the password of the currently logged-in user
    const setPasswordForUser = (newPassword) => {
        if (!auth.currentUser) return Promise.reject(new Error("No user is logged in."));
        return updatePassword(auth.currentUser, newPassword);
    };

    // Update display name (profile nickname)
    const updateUserProfile = (displayName) => {
        if (!auth.currentUser) return Promise.reject(new Error("No user is logged in."));
        return updateProfile(auth.currentUser, { displayName });
    };

    // Send Password Reset Link to Email
    const resetPasswordByEmail = (email) => {
        return sendPasswordResetEmail(auth, email);
    };

    const logout = () => signOut(auth);

    return (
        <AuthContext.Provider value={{
            user,
            signInWithEmail,
            signInWithGoogle,
            sendValidationLink,
            isEmailLink,
            completeEmailLinkSignIn,
            setPasswordForUser,
            updateUserProfile,
            resetPasswordByEmail,
            logout
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
