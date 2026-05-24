import { createContext, useContext, useState, useEffect } from "react";
import { auth } from "../firebase";
import {
    signOut,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile,
    setPersistence,
    browserSessionPersistence
} from "firebase/auth";

const AuthContext = createContext(null);

// We store username as "username@ipltrump.app" internally for Firebase
const toEmail = (username) => `${username.trim().toLowerCase()}@ipltrump.app`;

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

    // Sign Up — creates new account, saves displayName as the username
    const signUpWithUsername = async (username, password) => {
        const email = toEmail(username);
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        // Save the original username as displayName so we can show it in the UI
        await updateProfile(credential.user, { displayName: username });
        // ✅ FIX: Do NOT manually call setUser here — creating a plain-object copy
        // of a Firebase User loses its prototype methods. onAuthStateChanged
        // will fire automatically and update state correctly.
        return credential.user;
    };

    // Login — signs in using the stored email derived from the username
    const signInWithUsername = (username, password) => {
        const email = toEmail(username);
        return signInWithEmailAndPassword(auth, email, password);
    };

    const logout = () => signOut(auth);

    return (
        <AuthContext.Provider value={{ user, signUpWithUsername, signInWithUsername, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
