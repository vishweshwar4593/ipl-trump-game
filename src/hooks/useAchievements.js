import { useState, useEffect, useCallback } from "react";
import { ref, get, set } from "firebase/database";
import { database } from "../firebase";
import { ACHIEVEMENTS } from "../achievements";

const LOCAL_KEY = "ipl_achievements";

function loadFromLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveToLocal(unlocked) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(unlocked));
  } catch {}
}

/**
 * useAchievements hook
 *
 * Returns:
 *  - unlockedIds: Set of unlocked achievement IDs
 *  - newToast: { id, emoji, label } | null — a badge that was JUST unlocked
 *  - dismissToast: () => void
 *  - checkAndUnlock: (eventObj) => void — call after every match result
 */
export function useAchievements({ user, isGuest }) {
  const [unlockedIds, setUnlockedIds] = useState({});
  const [newToast, setNewToast] = useState(null);

  // Load on mount / user change
  useEffect(() => {
    if (!user && !isGuest) return;

    if (user && !isGuest) {
      // Load from Firebase
      const achRef = ref(database, `users/${user.uid}/achievements`);
      get(achRef)
        .then(snap => {
          if (snap.exists()) {
            setUnlockedIds(snap.val());
          } else {
            setUnlockedIds({});
          }
        })
        .catch(() => setUnlockedIds(loadFromLocal()));
    } else {
      // Guest: localStorage
      setUnlockedIds(loadFromLocal());
    }
  }, [user, isGuest]);

  const persistUnlocked = useCallback((updated, currentUser, guest) => {
    if (currentUser && !guest) {
      const achRef = ref(database, `users/${currentUser.uid}/achievements`);
      set(achRef, updated).catch(err =>
        console.error("Error saving achievements:", err)
      );
    } else {
      saveToLocal(updated);
    }
  }, []);

  /**
   * checkAndUnlock — call with event data after each match result.
   * eventObj shape:
   * {
   *   type: "match_end",
   *   isWin: bool,
   *   gameMode: string,
   *   margin: number,          // cards difference
   *   timeLeft: number,        // only for time mode
   *   tournamentState: object, // full snapshot after update
   *   wasEverBehind: bool,     // tracked in App.js
   * }
   */
  const checkAndUnlock = useCallback((eventObj) => {
    setUnlockedIds(prev => {
      let updated = { ...prev };
      let justUnlocked = null;

      for (const badge of ACHIEVEMENTS) {
        if (updated[badge.id]) continue; // already unlocked
        try {
          if (badge.check(eventObj)) {
            updated[badge.id] = { unlockedAt: Date.now() };
            justUnlocked = badge;
            break; // Only one toast at a time; subsequent ones shown on next events
          }
        } catch {
          // silently skip errors in badge checks
        }
      }

      if (justUnlocked) {
        persistUnlocked(updated, eventObj._user, eventObj._isGuest);
        setNewToast(justUnlocked);
      }

      return updated;
    });
  }, [persistUnlocked]);

  const dismissToast = useCallback(() => setNewToast(null), []);

  // Automatically dismiss the achievement toast after 4 seconds
  useEffect(() => {
    if (newToast) {
      const timer = setTimeout(() => {
        setNewToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [newToast]);

  return { unlockedIds, newToast, dismissToast, checkAndUnlock };
}
