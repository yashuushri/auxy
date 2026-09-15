"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { toast } from "sonner";
import {
  createDiscordAccount,
  defaultAvatar,
  getSessionUsername,
  getUser,
  isCustomPhoto,
  saveUser,
  setSessionUsername,
  withDefaultAvatar,
} from "@/lib/storage";
import {
  auth,
  signInWithGoogle,
  signOutUser,
  syncUserProfileToFirestore,
  fetchUserProfileFromFirestore,
} from "@/lib/firebase";
import type { UserAccount } from "@/lib/types";

type UserPatch = Partial<UserAccount> | ((current: UserAccount) => UserAccount);

type AuthContextValue = {
  ready: boolean;
  user: UserAccount | null;
  loginWithGoogle: () => Promise<void>;
  loginWithDiscord: () => Promise<void>;
  logout: () => void;
  updateUser: (patch: UserPatch) => void;
  // Fallbacks for legacy callers
  login?: (username?: string, password?: string) => Promise<void>;
  register?: (username?: string, password?: string, confirm?: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<UserAccount | null>(null);
  const saveTimer = useRef<number | null>(null);

  const queueCloudSync = useCallback((nextUser: UserAccount) => {
    if (!auth.currentUser || auth.currentUser.uid !== nextUser.id) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        await syncUserProfileToFirestore(nextUser);
      } catch (err) {
        console.warn("Deferred Firestore sync:", err);
      }
    }, 1000);
  }, []);

  // Firebase Auth State Listener & Initial Data Fetch
  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (cancelled) return;

      if (firebaseUser) {
        try {
          // 1. Attempt to fetch persisted profile from Firestore
          const remoteProfile = await fetchUserProfileFromFirestore(firebaseUser.uid);

          if (remoteProfile && !cancelled) {
            saveUser(remoteProfile);
            setSessionUsername(remoteProfile.username);
            setUser(remoteProfile);
            setReady(true);
            return;
          }

          // 2. First-time user setup
          const cleanUsername = (
            firebaseUser.displayName ||
            firebaseUser.email?.split("@")[0] ||
            `user_${firebaseUser.uid.slice(0, 6)}`
          )
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, "");

          const avatarUrl =
            firebaseUser.photoURL || defaultAvatar(cleanUsername);

          const initialUser: UserAccount = {
            id: firebaseUser.uid,
            discordId: firebaseUser.uid,
            username: cleanUsername,
            displayName: firebaseUser.displayName || cleanUsername,
            avatar: avatarUrl,
            bio: "",
            background: { kind: "preset", value: "#0b0b12" },
            volume: 80,
            playlists: [
              {
                id: "favorites",
                name: "Favorites",
                description: "My favorite tracks",
                isPublic: true,
                trackIds: [],
              },
            ],
            library: [],
            createdAt: Date.now(),
          };

          // Merge local cache if exists
          const local = getUser(cleanUsername);
          if (local) {
            if (local.library?.length) initialUser.library = local.library;
            if (local.playlists?.length) initialUser.playlists = local.playlists;
          }

          saveUser(initialUser);
          setSessionUsername(initialUser.username);
          setUser(initialUser);
          try {
            await syncUserProfileToFirestore(initialUser);
          } catch (err) {
            console.warn("Initial user sync deferred:", err);
          }
        } catch (err) {
          console.warn("Error initializing user from Firestore:", err);
          // Fallback to local session
          const savedUsername = getSessionUsername();
          if (savedUsername) {
            const local = getUser(savedUsername);
            if (local) setUser(withDefaultAvatar(local));
          }
        }
      } else {
        // Not signed in to Firebase, check for active local demo session
        const savedUsername = getSessionUsername();
        if (savedUsername) {
          const local = getUser(savedUsername);
          if (local) {
            setUser(withDefaultAvatar(local));
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      }

      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const loginWithGoogleHandler = useCallback(async () => {
    try {
      const { user: fbUser, error } = await signInWithGoogle();
      if (error) {
        toast.error(error.message || "Failed to sign in with Google");
        return;
      }
      if (fbUser) {
        toast.success(`Signed in as ${fbUser.displayName || fbUser.email}`);
      }
    } catch {
      toast.error("Google sign in was cancelled or failed");
    }
  }, []);

  const loginWithDiscordHandler = useCallback(async () => {
    // For Discord / Fast login, try Google sign-in with Firebase, or offer instant demo
    try {
      const { user: fbUser, error } = await signInWithGoogle();
      if (!error && fbUser) {
        toast.success(`Welcome ${fbUser.displayName || "back"}!`);
        return;
      }
    } catch {
      // Continue to demo account
    }

    // Instant local demo session fallback if popup is closed or user wants instant guest entry
    toast.info("Starting instant demo session.");
    const demoAccount = createDiscordAccount({
      id: "demo-user-123",
      discordId: "847294829472",
      username: "auxydemo",
      displayName: "Auxy Demo",
      avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=auxydemo",
    });
    saveUser(demoAccount);
    setSessionUsername(demoAccount.username);
    setUser(demoAccount);
  }, []);

  const logoutHandler = useCallback(async () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    setUser(null);
    setSessionUsername(null);
    await signOutUser();
    toast.success("Signed out");
  }, []);

  const updateUser = useCallback(
    (patch: UserPatch) => {
      setUser((current) => {
        if (!current) return current;
        const next =
          typeof patch === "function"
            ? patch(current)
            : { ...current, ...patch, username: current.username };
        const named = { ...next, username: current.username };
        const synced = isCustomPhoto(named.avatar)
          ? named
          : { ...named, avatar: defaultAvatar(named.displayName || named.username) };

        saveUser(synced);
        queueCloudSync(synced);
        return synced;
      });
    },
    [queueCloudSync]
  );

  const value = useMemo(
    () => ({
      ready,
      user,
      loginWithGoogle: loginWithGoogleHandler,
      loginWithDiscord: loginWithDiscordHandler,
      logout: logoutHandler,
      updateUser,
      login: loginWithGoogleHandler,
      register: loginWithGoogleHandler,
    }),
    [ready, user, loginWithGoogleHandler, loginWithDiscordHandler, logoutHandler, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
