import { createContext, useContext, useState, useEffect } from "react";
import { auth } from "../firebase";
import {
    signOut,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile
} from "firebase/auth";

const AuthContext = createContext(null);

// We store username as "username@ipltrump.app" internally for Firebase
const toEmail = (username) => `${username.trim().toLowerCase()}@ipltrump.app`;

export function AuthProvider({ children }) {
    const [user, setUser] = useState(undefined); // undefined = loading, null = not signed in

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser ?? null);
        });
        return () => unsubscribe();
    }, []);

    // Sign Up — creates new account, saves displayName as the username
    const signUpWithUsername = async (username, password) => {
        const email = toEmail(username);
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        // Save the original username as displayName so we can show it in the UI
        await updateProfile(credential.user, { displayName: username });
        // Reload so user.displayName is immediately available
        await credential.user.reload();
        setUser({ ...credential.user, displayName: username });
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
