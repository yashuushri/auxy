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
import { getSupabase } from "@/lib/supabase";
import {
  normalizeAndSyncUserProfileToSupabase,
  fetchUserProfileFromSupabase,
} from "@/lib/supabase-db";
import type { UserAccount } from "@/lib/types";
import { sendDiscordNotification } from "@/lib/discord";
import { sendActivityLog } from "@/lib/activity-logger";

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
        if (typeof window !== "undefined" && nextUser?.username) {
          // Send lightweight profile representation to explore endpoint
          void fetch("/api/explore", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(nextUser),
          }).catch(() => {});
        }
        await normalizeAndSyncUserProfileToSupabase(nextUser);
      } catch (err) {
        console.warn("Deferred Supabase sync:", err);
      }
    }, 1500);
  }, []);

  // Initial Data Fetch from localStorage + Supabase sync
  useEffect(() => {
    let cancelled = false;

    // Fast-path: Check local session immediately so app renders with 0ms delay
    try {
      const savedUsername = getSessionUsername();
      if (savedUsername) {
        const local = getUserByEmailOrUsername(savedUsername) || getUser(savedUsername);
        if (local) {
          const userWithAvatar = withDefaultAvatar(local);
          setUser(userWithAvatar);
          // Register with server store
          if (typeof window !== "undefined") {
            void fetch("/api/explore", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(userWithAvatar),
            }).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.warn("Fast-path local session check error:", err);
    } finally {
      // Unblock UI immediately
      setReady(true);
    }

    // Background asynchronous sync with Supabase
    async function syncRemoteSession() {
      const supabase = getSupabase();
      if (supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user && !cancelled) {
            const suUser = session.user;
            const metadata = suUser.user_metadata || {};
            const discordUsername =
              metadata.custom_claims?.global_name ||
              metadata.full_name ||
              metadata.user_name ||
              suUser.email?.split("@")[0] ||
              "user";
            const cleanU = discordUsername.toLowerCase().replace(/[^a-z0-9_-]/g, "");
            const avatarUrl = metadata.avatar_url || defaultAvatar(cleanU);

            const remote = await fetchUserProfileFromSupabase(cleanU);
            if (remote && !cancelled) {
              saveUser(remote);
              setSessionUsername(remote.username);
              setUser(withDefaultAvatar(remote));
              return;
            } else if (!cancelled) {
              const newAcc: UserAccount = {
                id: suUser.id,
                discordId: metadata.provider_id || suUser.id,
                username: cleanU,
                displayName: metadata.full_name || discordUsername,
                email: suUser.email,
                emailVerified: true,
                avatar: avatarUrl,
                bio: "",
                background: { kind: "preset", value: "lava" },
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
              saveUser(newAcc);
              setSessionUsername(newAcc.username);
              setUser(withDefaultAvatar(newAcc));
              void normalizeAndSyncUserProfileToSupabase(newAcc);
              return;
            }
          }
        } catch (e) {
          console.warn("Supabase auth session check:", e);
        }
      }

      const savedUsername = getSessionUsername();
      if (!savedUsername) return;

      // Handle legacy/buggy username migration
      const lookupKey = savedUsername === "dealuphymindgmailcom" ? "aman" : savedUsername;

      let local = getUserByEmailOrUsername(lookupKey) || getUser(lookupKey);
      if (!local && !cancelled) {
        try {
          const res = await fetch("/api/auth/lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier: lookupKey }),
          });
          const data = await res.json();
          if (data.ok && data.found && data.user && !cancelled) {
            local = data.user;
            saveUser(local);
            setSessionUsername(local.username);
            setUser(withDefaultAvatar(local));
          }
        } catch (e) {
          console.warn("Failed to fetch session profile from server", e);
        }
      } else if (local && !cancelled) {
        if (savedUsername !== local.username) {
          setSessionUsername(local.username);
        }
        setUser(withDefaultAvatar(local));
        try {
          const remoteProfile = await fetchUserProfileFromSupabase(
            local.username || local.email || savedUsername
          );
          if (remoteProfile && !cancelled) {
            saveUser(remoteProfile);
            setUser(withDefaultAvatar(remoteProfile));
          }
        } catch (err) {
          console.warn("Failed to sync profile on load", err);
        }
      }
    }

    void syncRemoteSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const loginWithEmailHandler = useCallback(
    async (email: string, pass: string, originalIdentifier?: string) => {
      const searchKey = (originalIdentifier || email).trim();
      let existing: UserAccount | null =
        getUserByEmailOrUsername(searchKey) ||
        getUserByEmailOrUsername(email);

      // 1. Fetch from server lookup API
      if (!existing) {
        try {
          const res = await fetch("/api/auth/lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier: searchKey || email, password: pass }),
          });
          const data = await res.json();
          if (data.ok && data.found && data.user) {
            existing = data.user;
          }
        } catch (e) {
          console.warn("Could not lookup user from server:", e);
        }
      }

      // 2. Fetch from Supabase fallback
      if (!existing) {
        try {
          existing = await fetchUserProfileFromSupabase(email);
        } catch (e) {
          console.warn("Could not fetch remote profile", e);
        }
      }

      if (!existing) {
        return {
          success: false,
          error: "No account found with this email or username. Please check your credentials or register.",
        };
      }

      // If user had a password recorded and passed a password, verify
      if (pass && existing.password && existing.password !== pass) {
        return {
          success: false,
          error: "Incorrect password. Please try again.",
        };
      }

      if (email && email.includes("@")) existing.email = email;
      if (pass) existing.password = pass;

      saveUser(existing);
      setSessionUsername(existing.username);
      setUser(withDefaultAvatar(existing));
      void normalizeAndSyncUserProfileToSupabase(existing, true);

      // Keep explore/server-store in sync
      try {
        void fetch("/api/explore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(existing),
        });
      } catch {}

      const userDisplayName = existing.displayName || existing.username;

      void sendDiscordNotification({
        type: "login",
        username: existing.username,
        email: existing.email || email,
      });

      // Activity log to Discord (zero database calls)
      sendActivityLog({
        action: "user_login",
        user: existing,
        metadata: {
          username: existing.username,
          displayName: userDisplayName,
        },
      });

      toast.success(`Welcome back, ${userDisplayName}!`);
      return { success: true };
    },
    []
  );

  const signUpWithEmailHandler = useCallback(
    async (email: string, pass: string, name?: string) => {
      const cleanEmail = email.trim().toLowerCase();
      const rawName = name?.trim() || "";
      if (!rawName) {
        return { success: false, error: "Please enter a valid username." };
      }
      const cleanUsername = rawName.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!cleanUsername) {
        return { success: false, error: "Username can only contain letters and numbers." };
      }

      const existing =
        getUserByEmailOrUsername(cleanEmail) || getUserByEmailOrUsername(cleanUsername);

      if (existing) {
        return { success: false, error: "An account with this username or email already exists." };
      }

      const displayName = rawName || cleanUsername;

      try {
          const localUser: UserAccount = {
            id: `usr_${Date.now()}`,
            discordId: `usr_${Date.now()}`,
            username: cleanUsername,
            displayName: displayName,
            email: cleanEmail,
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

          saveUser(localUser);
          setSessionUsername(localUser.username);
          setUser(localUser);
          void normalizeAndSyncUserProfileToSupabase(localUser, true);

          try {
            void fetch("/api/explore", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(localUser),
            });
          } catch {}

          void sendDiscordNotification({
            type: "register",
            username: localUser.username,
            email: cleanEmail,
          });

          sendActivityLog({
            action: "user_register",
            user: localUser,
            metadata: {
              username: localUser.username,
              displayName: localUser.displayName || localUser.username,
            },
          });

          toast.success(`Account created! Welcome, ${localUser.username}!`);
          return { success: true };

      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return { success: false, error: errorMessage };
      }
    },
    []
  );

  const resetPasswordWithEmailHandler = useCallback(
    async (email: string, newPass: string, username?: string) => {
      const searchKey = (username || email).trim();
      let existing =
        getUserByEmailOrUsername(searchKey) ||
        getUserByEmailOrUsername(email);

      if (!existing) {
        try {
          const res = await fetch("/api/auth/lookup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier: searchKey || email }),
          });
          const data = await res.json();
          if (data.ok && data.found && data.user) {
            existing = data.user;
          }
        } catch {}
      }

      if (!existing) {
        return { success: false, error: "User account not found." };
      }

      existing.password = newPass;
      if (email && email.includes("@")) existing.email = email;
      
      saveUser(existing);
      setSessionUsername(existing.username);
      setUser(withDefaultAvatar(existing));
      void normalizeAndSyncUserProfileToSupabase(existing, true);

      try {
        void fetch("/api/explore", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(existing),
        });
      } catch {}

      void sendDiscordNotification({
        type: "forgot_password",
        username: existing.username,
        email: existing.email || email,
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
    void normalizeAndSyncUserProfileToSupabase(guestAccount, true);

    void sendDiscordNotification({
      type: "login",
      username: guestAccount.username,
    });

    sendActivityLog({
      action: "user_login",
      user: guestAccount,
      metadata: {
        username: guestAccount.username,
        isGuest: true,
      },
    });

    toast.success(`Entered as ${guestAccount.displayName}`);
  }, []);

  const logoutHandler = useCallback(async () => {
    const prevUsername = user?.username || "A user";
    const prevUser = user;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    if (user) {
      saveUser(user);
    }
    setUser(null);
    setSessionUsername(null);

    const supabase = getSupabase();
    if (supabase) {
      void supabase.auth.signOut();
    }
    
    void sendDiscordNotification({
      type: "logout",
      username: prevUsername,
    });

    if (prevUser) {
      sendActivityLog({
        action: "user_logout",
        user: prevUser,
      });
    }

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
        try {
          const supabase = getSupabase();
          if (!supabase) {
            toast.error("Supabase client not available.");
            return;
          }
          const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
            },
          });
          if (error) {
            console.warn("Supabase Google OAuth error:", error);
            toast.error("Google sign in could not be initiated.");
          }
        } catch (err) {
          console.warn("Google sign in issue:", err);
          toast.error("Google sign in could not be completed.");
        }
      },
      loginWithDiscord: async () => {
        try {
          const supabase = getSupabase();
          if (!supabase) {
            loginAsGuestHandler("Guest Listener");
            return;
          }
          const { error } = await supabase.auth.signInWithOAuth({
            provider: "discord",
            options: {
              redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
            },
          });
          if (error) {
            console.warn("Supabase Discord OAuth error:", error);
            loginAsGuestHandler("Guest Listener");
          }
        } catch (err) {
          console.warn("Discord login error:", err);
          loginAsGuestHandler("Guest Listener");
        }
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
