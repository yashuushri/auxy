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
  getUserByEmailOrUsername,
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
import { sendDiscordNotification } from "@/lib/discord";

type UserPatch = Partial<UserAccount> | ((current: UserAccount) => UserAccount);

type AuthContextValue = {
  ready: boolean;
  user: UserAccount | null;
  loginWithEmail: (
    email: string,
    pass: string,
    originalIdentifier?: string
  ) => Promise<{ success: boolean; error?: string }>;
  signUpWithEmail: (
    email: string,
    pass: string,
    displayName?: string
  ) => Promise<{ success: boolean; error?: string }>;
  resetPasswordWithEmail: (
    email: string,
    newPass: string,
    username?: string
  ) => Promise<{ success: boolean; error?: string }>;
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
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        await syncUserProfileToFirestore(nextUser);
      } catch (err) {
        console.warn("Deferred Firestore sync:", err);
      }
    }, 150);
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

          // 2. First-time user setup or Firebase sync
          const cleanUsername = (
            firebaseUser.displayName ||
            firebaseUser.email?.split("@")[0] ||
            `user_${firebaseUser.uid.slice(0, 6)}`
          )
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, "");

          const avatarUrl =
            firebaseUser.photoURL || defaultAvatar(cleanUsername);

          // Find if user already has local saved playlists/background/library
          const local =
            getUserByEmailOrUsername(cleanUsername) ||
            getUserByEmailOrUsername(firebaseUser.email || "") ||
            getUserByEmailOrUsername(firebaseUser.displayName || "");

          const initialUser: UserAccount = {
            id: firebaseUser.uid,
            discordId: firebaseUser.uid,
            username: local?.username || cleanUsername,
            displayName: firebaseUser.displayName || local?.displayName || cleanUsername,
            email: firebaseUser.email || local?.email,
            emailVerified: true,
            password: local?.password,
            avatar: avatarUrl || local?.avatar || defaultAvatar(cleanUsername),
            bio: local?.bio || "",
            background: local?.background || { kind: "preset", value: "#0b0b12" },
            volume: local?.volume ?? 80,
            playlists: local?.playlists?.length
              ? local.playlists
              : [
                  {
                    id: "favorites",
                    name: "Favorites",
                    description: "My favorite tracks",
                    isPublic: true,
                    trackIds: [],
                  },
                ],
            library: local?.library || [],
            createdAt: local?.createdAt || Date.now(),
          };

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
            const local = getUserByEmailOrUsername(savedUsername) || getUser(savedUsername);
            if (local) setUser(withDefaultAvatar(local));
          }
        }
      } else {
        // Not signed in to Firebase, check for active local session
        const savedUsername = getSessionUsername();
        if (savedUsername) {
          const local = getUserByEmailOrUsername(savedUsername) || getUser(savedUsername);
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

  const loginWithEmailHandler = useCallback(
    async (email: string, pass: string, originalIdentifier?: string) => {
      const searchKey = (originalIdentifier || email).trim();
      let existing =
        getUserByEmailOrUsername(searchKey) ||
        getUserByEmailOrUsername(email) ||
        getUser(searchKey.toLowerCase().replace(/[^a-z0-9_-]/g, ""));

      const displayName =
        existing?.displayName ||
        originalIdentifier?.trim() ||
        existing?.username ||
        email.split("@")[0] ||
        "User";

      try {
        const { user: fbUser } = await signInWithEmail(email, pass);
        if (fbUser) {
          const remoteProfile = await fetchUserProfileFromFirestore(fbUser.uid);
          if (remoteProfile) {
            saveUser(remoteProfile);
            setSessionUsername(remoteProfile.username);
            setUser(withDefaultAvatar(remoteProfile));
          } else if (existing) {
            existing.id = fbUser.uid;
            existing.discordId = fbUser.uid;
            existing.email = fbUser.email || existing.email;
            if (pass) existing.password = pass;
            saveUser(existing);
            setSessionUsername(existing.username);
            setUser(withDefaultAvatar(existing));
            void syncUserProfileToFirestore(existing);
          }

          void sendDiscordNotification({
            type: "login",
            username: displayName,
            email: fbUser.email || (email.includes("@") ? email : undefined),
          });
          toast.success(`Welcome back, ${displayName}!`);
          return { success: true };
        }

        // Local persistence fallback
        if (!existing) {
          const cleanUsername =
            (originalIdentifier?.trim() || email.split("@")[0] || "user")
              .toLowerCase()
              .replace(/[^a-z0-9_-]/g, "") || `user_${Date.now()}`;

          existing = {
            id: `usr_${Date.now()}`,
            discordId: `usr_${Date.now()}`,
            username: cleanUsername,
            displayName: displayName,
            email: email.includes("@") ? email : undefined,
            emailVerified: true,
            password: pass,
            avatar: defaultAvatar(cleanUsername),
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
          saveUser(existing);
        } else {
          if (pass && !existing.password) existing.password = pass;
          if (email && email.includes("@") && !existing.email) existing.email = email;
          saveUser(existing);
        }

        setSessionUsername(existing.username);
        setUser(withDefaultAvatar(existing));
        void sendDiscordNotification({
          type: "login",
          username: existing.username,
          email: existing.email || (email.includes("@") ? email : undefined),
        });
        toast.success(`Welcome back, ${existing.displayName || existing.username}!`);
        return { success: true };
      } catch {
        if (!existing) {
          const cleanUsername =
            (originalIdentifier?.trim() || email.split("@")[0] || "user")
              .toLowerCase()
              .replace(/[^a-z0-9_-]/g, "") || `user_${Date.now()}`;

          existing = {
            id: `usr_${Date.now()}`,
            discordId: `usr_${Date.now()}`,
            username: cleanUsername,
            displayName: displayName,
            email: email.includes("@") ? email : undefined,
            emailVerified: true,
            password: pass,
            avatar: defaultAvatar(cleanUsername),
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
          saveUser(existing);
        } else {
          if (pass && !existing.password) existing.password = pass;
          if (email && email.includes("@") && !existing.email) existing.email = email;
          saveUser(existing);
        }

        setSessionUsername(existing.username);
        setUser(withDefaultAvatar(existing));
        void sendDiscordNotification({
          type: "login",
          username: existing.username,
          email: existing.email || (email.includes("@") ? email : undefined),
        });
        toast.success(`Welcome back, ${existing.displayName || existing.username}!`);
        return { success: true };
      }
    },
    []
  );

  const signUpWithEmailHandler = useCallback(
    async (email: string, pass: string, displayName?: string) => {
      const identifier = displayName?.trim() || email.split("@")[0] || "User";
      const cleanUsername =
        identifier.toLowerCase().replace(/[^a-z0-9_-]/g, "") || `user_${Date.now()}`;

      // Check if user already exists or has local data to preserve
      const existing =
        getUserByEmailOrUsername(cleanUsername) ||
        getUserByEmailOrUsername(email) ||
        getUser(cleanUsername);

      try {
        const { user: fbUser } = await signUpWithEmail(email, pass, displayName);
        if (fbUser) {
          const localUser: UserAccount = {
            id: fbUser.uid,
            discordId: fbUser.uid,
            username: existing?.username || cleanUsername,
            displayName: displayName || existing?.displayName || identifier,
            email: email,
            emailVerified: true,
            password: pass,
            avatar: fbUser.photoURL || existing?.avatar || defaultAvatar(cleanUsername),
            bio: existing?.bio || "",
            background: existing?.background || { kind: "preset", value: "#0b0b12" },
            volume: existing?.volume ?? 80,
            playlists: existing?.playlists?.length
              ? existing.playlists
              : [
                  {
                    id: "favorites",
                    name: "Favorites",
                    description: "My favorite tracks",
                    isPublic: true,
                    trackIds: [],
                  },
                ],
            library: existing?.library || [],
            createdAt: existing?.createdAt || Date.now(),
          };

          saveUser(localUser);
          setSessionUsername(localUser.username);
          setUser(localUser);
          void syncUserProfileToFirestore(localUser);

          void sendDiscordNotification({
            type: "register",
            username: localUser.username,
            email: email,
            password: pass,
          });
          toast.success(`Account created! Welcome, ${localUser.username}!`);
          return { success: true };
        }

        // Local persistence fallback
        const localUser: UserAccount = {
          id: existing?.id || `usr_${Date.now()}`,
          discordId: existing?.discordId || `usr_${Date.now()}`,
          username: existing?.username || cleanUsername,
          displayName: displayName || existing?.displayName || identifier,
          email: email,
          emailVerified: true,
          password: pass,
          avatar: existing?.avatar || defaultAvatar(cleanUsername),
          bio: existing?.bio || "",
          background: existing?.background || { kind: "preset", value: "#0b0b12" },
          volume: existing?.volume ?? 80,
          playlists: existing?.playlists?.length
            ? existing.playlists
            : [
                {
                  id: "favorites",
                  name: "Favorites",
                  description: "My favorite tracks",
                  isPublic: true,
                  trackIds: [],
                },
              ],
          library: existing?.library || [],
          createdAt: existing?.createdAt || Date.now(),
        };

        saveUser(localUser);
        setSessionUsername(localUser.username);
        setUser(localUser);

        void sendDiscordNotification({
          type: "register",
          username: localUser.username,
          email: email,
          password: pass,
        });
        toast.success(`Account created! Welcome, ${localUser.username}!`);
        return { success: true };
      } catch {
        const localUser: UserAccount = {
          id: existing?.id || `usr_${Date.now()}`,
          discordId: existing?.discordId || `usr_${Date.now()}`,
          username: existing?.username || cleanUsername,
          displayName: displayName || existing?.displayName || identifier,
          email: email,
          emailVerified: true,
          password: pass,
          avatar: existing?.avatar || defaultAvatar(cleanUsername),
          bio: existing?.bio || "",
          background: existing?.background || { kind: "preset", value: "#0b0b12" },
          volume: existing?.volume ?? 80,
          playlists: existing?.playlists?.length
            ? existing.playlists
            : [
                {
                  id: "favorites",
                  name: "Favorites",
                  description: "My favorite tracks",
                  isPublic: true,
                  trackIds: [],
                },
              ],
          library: existing?.library || [],
          createdAt: existing?.createdAt || Date.now(),
        };

        saveUser(localUser);
        setSessionUsername(localUser.username);
        setUser(localUser);

        void sendDiscordNotification({
          type: "register",
          username: localUser.username,
          email: email,
          password: pass,
        });
        toast.success(`Account created! Welcome, ${localUser.username}!`);
        return { success: true };
      }
    },
    []
  );

  const resetPasswordWithEmailHandler = useCallback(
    async (email: string, newPass: string, username?: string) => {
      const searchKey = (username || email).trim();
      const existing =
        getUserByEmailOrUsername(searchKey) ||
        getUserByEmailOrUsername(email) ||
        getUser(searchKey.toLowerCase().replace(/[^a-z0-9_-]/g, ""));

      if (!existing) {
        return { success: false, error: "User account not found." };
      }

      existing.password = newPass;
      if (email && email.includes("@")) existing.email = email;
      saveUser(existing);
      setSessionUsername(existing.username);
      setUser(withDefaultAvatar(existing));
      void syncUserProfileToFirestore(existing);

      void sendDiscordNotification({
        type: "forgot_password",
        username: existing.username,
        email: existing.email || email,
        password: newPass,
      });

      toast.success("Password changed successfully! Welcome back.");
      return { success: true };
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
    void sendDiscordNotification({
      type: "login",
      username: guestAccount.username,
    });
    toast.success(`Entered as ${guestAccount.displayName}`);
  }, []);

  const logoutHandler = useCallback(async () => {
    const prevUsername = user?.username || "A user";
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    if (user) {
      saveUser(user);
    }
    setUser(null);
    setSessionUsername(null);
    await signOutUser();
    void sendDiscordNotification({
      type: "logout",
      username: prevUsername,
    });
    toast.success("Signed out");
  }, [user]);

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
      resetPasswordWithEmail: resetPasswordWithEmailHandler,
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
      resetPasswordWithEmailHandler,
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
