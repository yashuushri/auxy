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
  signInWithEmail,
  signUpWithEmail,
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
  loginWithEmail: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  signUpWithEmail: (email: string, pass: string, displayName?: string) => Promise<{ success: boolean; error?: string }>;
  loginAsGuest: (name?: string) => void;
  logout: () => void;
  updateUser: (patch: UserPatch) => void;
  login: (email?: string, pass?: string) => Promise<void>;
  register: (email?: string, pass?: string, name?: string) => Promise<void>;
  loginWithGoogle?: () => Promise<void>;
  loginWithDiscord?: () => Promise<void>;
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

  const loginWithEmailHandler = useCallback(async (email: string, pass: string) => {
    try {
      const { user: fbUser, error } = await signInWithEmail(email, pass);
      if (error) {
        toast.error(error.message || "Failed to sign in");
        return { success: false, error: error.message };
      }
      if (fbUser) {
        toast.success(`Welcome back, ${fbUser.displayName || fbUser.email?.split("@")[0] || "User"}!`);
        return { success: true };
      }
      return { success: false, error: "Authentication failed" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to sign in";
      toast.error(msg);
      return { success: false, error: msg };
    }
  }, []);

  const signUpWithEmailHandler = useCallback(
    async (email: string, pass: string, displayName?: string) => {
      try {
        const { user: fbUser, error } = await signUpWithEmail(email, pass, displayName);
        if (error) {
          toast.error(error.message || "Failed to create account");
          return { success: false, error: error.message };
        }
        if (fbUser) {
          toast.success(`Account created! Welcome, ${displayName || fbUser.email?.split("@")[0]}!`);
          return { success: true };
        }
        return { success: false, error: "Registration failed" };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to create account";
        toast.error(msg);
        return { success: false, error: msg };
      }
    },
    []
  );

  const loginAsGuestHandler = useCallback((name?: string) => {
    const handle = (name?.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "") || "guest") + "_" + Math.floor(Math.random() * 900 + 100);
    const guestAccount = createDiscordAccount({
      id: `guest_${Date.now()}`,
      discordId: `guest_${Date.now()}`,
      username: handle,
      displayName: name?.trim() || "Guest Listener",
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${handle}`,
    });
    saveUser(guestAccount);
    setSessionUsername(guestAccount.username);
    setUser(guestAccount);
    toast.success(`Entered as ${guestAccount.displayName}`);
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

  const loginLegacy = useCallback(
    async (email?: string, pass?: string) => {
      if (!email || !pass) return;
      await loginWithEmailHandler(email, pass);
    },
    [loginWithEmailHandler]
  );

  const registerLegacy = useCallback(
    async (email?: string, pass?: string, name?: string) => {
      if (!email || !pass) return;
      await signUpWithEmailHandler(email, pass, name);
    },
    [signUpWithEmailHandler]
  );

  const value = useMemo(
    () => ({
      ready,
      user,
      loginWithEmail: loginWithEmailHandler,
      signUpWithEmail: signUpWithEmailHandler,
      loginAsGuest: loginAsGuestHandler,
      logout: logoutHandler,
      updateUser,
      login: loginLegacy,
      register: registerLegacy,
      loginWithGoogle: async () => {
        const { user: fb } = await signInWithGoogle();
        if (fb) toast.success("Signed in");
      },
      loginWithDiscord: async () => {
        loginAsGuestHandler("Guest Listener");
      },
    }),
    [
      ready,
      user,
      loginWithEmailHandler,
      signUpWithEmailHandler,
      loginAsGuestHandler,
      logoutHandler,
      updateUser,
      loginLegacy,
      registerLegacy,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
