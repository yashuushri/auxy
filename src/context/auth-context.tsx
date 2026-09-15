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
import { DEFAULT_BACKGROUND } from "@/lib/backgrounds";
import {
  createAccount,
  defaultAvatar,
  getUser,
  isCustomPhoto,
  saveUser,
  wipeSiteData,
  withDefaultAvatar,
} from "@/lib/storage";
import { wipeRoomVideos } from "@/lib/room-media";
import type { RoomProfile, UserAccount } from "@/lib/types";

type UserPatch = Partial<UserAccount> | ((current: UserAccount) => UserAccount);

type AuthContextValue = {
  ready: boolean;
  user: UserAccount | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, confirm: string) => Promise<void>;
  logout: () => void;
  updateUser: (patch: UserPatch) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function readError(response: Response) {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error || "Could not continue";
  } catch {
    return "Could not continue";
  }
}

function toProfile(user: UserAccount): RoomProfile {
  return {
    displayName: user.displayName,
    avatar: user.avatar,
    background: user.background,
    playlists: user.playlists,
    library: user.library,
    volume: user.volume,
    createdAt: user.createdAt,
  };
}

function fromProfile(username: string, profile: RoomProfile): UserAccount {
  return withDefaultAvatar({
    username,
    passwordHash: "",
    salt: "",
    displayName: profile.displayName,
    avatar: profile.avatar,
    background: profile.background,
    playlists: profile.playlists,
    library: profile.library,
    volume: profile.volume,
    createdAt: profile.createdAt,
  });
}

function isSparseRoom(user: UserAccount) {
  const extraPlaylists = user.playlists.filter((playlist) => playlist.id !== "liked" && playlist.id !== "discover");
  const hasTracks =
    user.library.length > 0 || user.playlists.some((playlist) => playlist.trackIds.length > 0);
  const customBackground =
    user.background.value !== DEFAULT_BACKGROUND.value || user.background.kind === "upload" || user.background.kind === "url" || user.background.kind === "video";
  return !hasTracks && extraPlaylists.length === 0 && !customBackground && !isCustomPhoto(user.avatar);
}

async function pushRoom(user: UserAccount) {
  const response = await fetch("/api/auth/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile: toProfile(user) }),
  });
  if (!response.ok) throw new Error(await readError(response));
}

async function hydrateRoom(username: string, cloud: RoomProfile | null | undefined) {
  const local = getUser(username);
  const localUser = local ? withDefaultAvatar(local) : null;
  const cloudUser = cloud ? fromProfile(username, cloud) : null;

  if (cloudUser && !isSparseRoom(cloudUser)) {
    saveUser(cloudUser);
    return cloudUser;
  }
  if (localUser && !isSparseRoom(localUser)) {
    saveUser(localUser);
    await pushRoom(localUser).catch(() => undefined);
    return localUser;
  }
  if (cloudUser) {
    saveUser(cloudUser);
    return cloudUser;
  }
  const created = localUser ?? createAccount(username, "", "");
  saveUser(created);
  await pushRoom(created).catch(() => undefined);
  return created;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<UserAccount | null>(null);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, []);

  const queueCloudSave = useCallback((next: UserAccount) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void pushRoom(next).catch(() => undefined);
    }, 500);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      // Run wipeSiteData in background without blocking initial auth check
      try {
        const didWipe = wipeSiteData();
        if (didWipe) {
          void wipeRoomVideos().catch(() => undefined);
        }
      } catch {
        // Ignore storage errors
      }

      if (cancelled) return;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const response = await fetch("/api/auth/me", {
          cache: "no-store",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const data = (await response.json()) as { username?: string | null; profile?: RoomProfile | null };
        if (cancelled) return;
        if (data.username) {
          const profile = await hydrateRoom(data.username, data.profile);
          if (!cancelled) setUser(profile);
        } else {
          setUser(null);
        }
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) throw new Error(await readError(response));
    const data = (await response.json()) as { username: string; profile?: RoomProfile | null };
    const profile = await hydrateRoom(data.username, data.profile);
    setUser(profile);
  }, []);

  const register = useCallback(async (username: string, password: string, confirm: string) => {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, confirm }),
    });
    if (!response.ok) throw new Error(await readError(response));
    const data = (await response.json()) as { username: string };
    const profile = await hydrateRoom(data.username, null);
    setUser(profile);
  }, []);

  const logout = useCallback(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    setUser((current) => {
      if (current) void pushRoom(current).catch(() => undefined);
      return null;
    });
    void fetch("/api/auth/logout", { method: "POST" });
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
        if (
          synced.displayName === current.displayName &&
          synced.avatar === current.avatar &&
          synced.volume === current.volume &&
          synced.background.kind === current.background.kind &&
          synced.background.value === current.background.value &&
          synced.playlists === current.playlists &&
          synced.library === current.library
        ) {
          return current;
        }
        saveUser(synced);
        queueCloudSave(synced);
        return synced;
      });
    },
    [queueCloudSave]
  );

  const value = useMemo(
    () => ({ ready, user, login, register, logout, updateUser }),
    [ready, user, login, register, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
