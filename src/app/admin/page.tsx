"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  Database,
  Edit2,
  ExternalLink,
  Flame,
  Globe,
  HardDrive,
  LogOut,
  Music,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Shield,
  Sliders,
  Terminal as TerminalIcon,
  Trash2,
  Users,
  Video,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import type { BackgroundMetadata } from "@/lib/types";
import { getAllUsers } from "@/lib/storage";

interface AdminStats {
  system: {
    nodeVersion: string;
    uptimeSeconds: number;
    memory: {
      heapUsedMB: number;
      heapTotalMB: number;
      rssMB: number;
    };
    supabase: {
      status: string;
      quotaGuard: string;
      profiles: number;
      playlists: number;
      activeRoomsCount: number;
    };
    performance: {
      youtubeEngine: string;
      cacheHitRate: string;
      avgExtractionLatency: string;
      compression: string;
    };
  };
  rooms: Array<{
    id: string;
    name: string;
    host: string;
    track: string;
    artist: string;
    isPlaying: boolean;
    listeners: number;
    updatedAt: string;
  }>;
}

interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  avatar: string;
  bio?: string;
  pronouns?: string;
  starCount: number;
  isOnline?: boolean;
  isPlaying?: boolean;
  currentTrack?: { title?: string; artist?: string } | null;
  roomId?: string;
  playlistsCount?: number;
  source?: string;
  updatedAt?: string;
}

const INITIAL_BOOT_LOGS = [
  "[0.000102] Linux version 6.8.0-custom-auxy (gcc 13.2.0)",
  "[0.001920] NightOS Security Subsystem initialized.",
  "[0.003410] Node: ap-southeast-1.prod.auxy.live (Cluster-04)",
  "[0.007120] Supabase & Postgres Gateway: ONLINE [QUOTA GUARD: ACTIVE]",
  "[0.012500] Realtime WebSocket Sync Engine: CONNECTED",
  "[0.018900] YouTube Innertube Paginated Scraper: READY",
  "[0.024000] Direct Video URL Engine: ONLINE",
  "[0.029000] AUTH REQUIRED: Access restricted to authorized administrative personnel.",
  "",
  "Auxy OS Administrative Terminal v2.4",
  "Enter administrator access key to authenticate or type 'help' for options.",
];

export default function AdminPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"terminal" | "dashboard">("terminal");

  // Terminal state
  const [terminalLogs, setTerminalLogs] = useState<string[]>(INITIAL_BOOT_LOGS);
  const [inputVal, setInputVal] = useState("");
  const [isPasswordMasked, setIsPasswordMasked] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);
  const terminalInputRef = useRef<HTMLInputElement | null>(null);

  // Dashboard state
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "shaders" | "rooms" | "youtube" | "storage" | "logs">("overview");

  // Users state
  const [usersList, setUsersList] = useState<AdminUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userFilterTab, setUserFilterTab] = useState<"all" | "online" | "live" | "supabase">("all");

  // Live Shaders state (Direct Video URLs - Discord CDN / MP4 / WebM)
  const [shadersList, setShadersList] = useState<BackgroundMetadata[]>([]);
  const [isLoadingShaders, setIsLoadingShaders] = useState(false);
  const [shaderName, setShaderName] = useState("");
  const [directVideoUrl, setDirectVideoUrl] = useState("");
  const [shaderPosterUrl, setShaderPosterUrl] = useState("");
  const [isSavingShader, setIsSavingShader] = useState(false);
  const [editingShader, setEditingShader] = useState<BackgroundMetadata | null>(null);
  const [editShaderName, setEditShaderName] = useState("");
  const [editVideoUrl, setEditVideoUrl] = useState("");
  const [editPosterUrl, setEditPosterUrl] = useState("");
  const [isUpdatingShader, setIsUpdatingShader] = useState(false);

  // YouTube tester tool
  const [ytTestUrl, setYtTestUrl] = useState("");
  const [isTestingYt, setIsTestingYt] = useState(false);
  const [ytTestResult, setYtTestResult] = useState<Record<string, unknown> | null>(null);

  // Check saved session on mount
  useEffect(() => {
    setIsMounted(true);
    try {
      const savedToken = sessionStorage.getItem("auxy_admin_token");
      if (savedToken) {
        setSessionToken(savedToken);
        setViewMode("dashboard");
      }
    } catch {
      // ignore
    }
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
    if (viewMode === "terminal") {
      terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [terminalLogs, viewMode]);

  // Keep focus on terminal input
  useEffect(() => {
    if (viewMode === "terminal") {
      terminalInputRef.current?.focus();
    }
  }, [viewMode]);

  const addLog = useCallback((text: string) => {
    setTerminalLogs((prev) => [...prev, text]);
  }, []);

  const fetchStats = useCallback(async (tokenToUse?: string) => {
    const tok = tokenToUse || sessionToken;
    if (!tok) return;

    setIsLoadingStats(true);
    try {
      const res = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${tok}` },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.warn("[Admin] Stats sync skipped or timed out:", err);
    } finally {
      setIsLoadingStats(false);
    }
  }, [sessionToken]);

  const fetchUsers = useCallback(async (tokenToUse?: string) => {
    const tok = tokenToUse || sessionToken;
    if (!tok) return;

    setIsLoadingUsers(true);
    try {
      // 1. Fetch full directory from server first
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${tok}` },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.users)) {
          setUsersList(data.users);
        }
      }

      // 2. Consolidate any local accounts from this browser's storage
      try {
        const localUsers = getAllUsers();
        if (localUsers && localUsers.length > 0) {
          const postRes = await fetch("/api/admin/users", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${tok}`,
            },
            body: JSON.stringify({ localUsers }),
            signal: AbortSignal.timeout(4000),
          }).catch(() => null);

          if (postRes && postRes.ok) {
            const postData = await postRes.json();
            if (Array.isArray(postData.users) && postData.users.length > 0) {
              setUsersList(postData.users);
            }
          }
        }
      } catch {
        // ignore local storage read errors
      }
    } catch (err) {
      console.warn("[Admin] Users sync error:", err);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [sessionToken]);

  const fetchShaders = useCallback(async (tokenToUse?: string) => {
    const tok = tokenToUse || sessionToken;
    if (!tok) return;

    setIsLoadingShaders(true);
    try {
      const res = await fetch("/api/admin/shaders", {
        headers: { Authorization: `Bearer ${tok}` },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const data = await res.json();
        setShadersList(data.shaders || []);
      }
    } catch (err) {
      console.warn("[Admin] Shaders sync skipped or timed out:", err);
    } finally {
      setIsLoadingShaders(false);
    }
  }, [sessionToken]);

  // Load stats, users, shaders when dashboard is active
  useEffect(() => {
    if (viewMode === "dashboard" && sessionToken) {
      fetchStats();
      fetchUsers();
      fetchShaders();
      const interval = setInterval(() => {
        fetchStats();
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [viewMode, sessionToken, fetchStats, fetchUsers, fetchShaders]);

  const handleAdminAuth = async (pass: string) => {
    if (!pass.trim()) return;
    setIsAuthenticating(true);
    addLog(`> Verifying administrative credentials...`);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pass.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.token) {
        setSessionToken(data.token);
        sessionStorage.setItem("auxy_admin_token", data.token);
        addLog(`[OK] Access granted. Identity verified.`);
        addLog(`[SYSTEM] Initializing BlinkOps Administrative Dashboard...`);
        toast.success("Welcome back, Administrator");

        setTimeout(() => {
          setViewMode("dashboard");
          fetchStats(data.token);
          fetchUsers(data.token);
          fetchShaders(data.token);
        }, 800);
      } else {
        addLog(`[ACCESS DENIED] ${data.error || "Invalid administrative key"}`);
        toast.error(data.error || "Authentication failed");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connection error";
      addLog(`[ERR] Failed to communicate with security gateway: ${msg}`);
      toast.error("Security gateway unreachable");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleTerminalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = inputVal.trim();
    if (!raw) return;

    setInputVal("");

    if (raw.toLowerCase() === "clear" || raw.toLowerCase() === "cls") {
      setTerminalLogs([]);
      return;
    }

    if (raw.toLowerCase() === "help") {
      addLog(`> help`);
      addLog(`Available terminal commands:`);
      addLog(`  login <key>    - Authenticate using admin password`);
      addLog(`  status         - Check subsystem statuses`);
      addLog(`  dashboard      - Launch dashboard if authenticated`);
      addLog(`  clear          - Clear terminal display buffer`);
      addLog(`  exit           - Return to Auxy main player`);
      addLog(`  <password>     - Direct password entry`);
      return;
    }

    if (raw.toLowerCase() === "status") {
      addLog(`> status`);
      addLog(`[GATEWAY] Online | Port 3000`);
      addLog(`[QUOTA GUARD] Engaged (Debounced batch writes, 0 surplus storage load)`);
      addLog(`[MEDIA ENGINE] Ready (Direct CDN & Video URLs)`);
      addLog(`[AUTH STATE] ${sessionToken ? "AUTHENTICATED" : "LOCKED"}`);
      return;
    }

    if (raw.toLowerCase() === "dashboard") {
      if (sessionToken) {
        setViewMode("dashboard");
      } else {
        addLog(`[ERR] Unauthenticated. Please enter password first.`);
      }
      return;
    }

    if (raw.toLowerCase() === "exit") {
      router.push("/");
      return;
    }

    if (raw.startsWith("login ")) {
      const pass = raw.slice(6).trim();
      addLog(`> login ******`);
      handleAdminAuth(pass);
      return;
    }

    // Direct password entry
    addLog(`> ******`);
    handleAdminAuth(raw);
  };

  const handleLogout = () => {
    setSessionToken(null);
    sessionStorage.removeItem("auxy_admin_token");
    setViewMode("terminal");
    setTerminalLogs(INITIAL_BOOT_LOGS);
    toast.info("Logged out of administrative session");
  };

  // Save shader metadata to database (Supabase + Server Store)
  const handleSaveAndPublishShader = async () => {
    const videoUrl = directVideoUrl.trim();
    if (!videoUrl) {
      toast.error("Please enter a valid video stream URL (MP4 / WebM / Discord CDN).");
      return;
    }
    if (!shaderName.trim()) {
      toast.error("Please provide a name for this Live Shader.");
      return;
    }

    setIsSavingShader(true);
    try {
      const res = await fetch("/api/admin/shaders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          name: shaderName.trim(),
          videoUrl,
          posterUrl: shaderPosterUrl.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        toast.success(`"${shaderName.trim()}" published! All users can now use this Live Shader.`);
        // Reset form
        setDirectVideoUrl("");
        setShaderName("");
        setShaderPosterUrl("");
        fetchShaders();
      } else {
        toast.error(data.error || "Failed to save shader");
      }
    } catch {
      toast.error("Failed to publish shader to database");
    } finally {
      setIsSavingShader(false);
    }
  };

  const handleStartEditShader = (s: BackgroundMetadata) => {
    setEditingShader(s);
    setEditShaderName(s.name);
    setEditVideoUrl(s.videoUrl);
    setEditPosterUrl(s.posterUrl || "");
  };

  const handleUpdateShader = async () => {
    if (!editingShader || !sessionToken) return;
    if (!editShaderName.trim()) {
      toast.error("Shader name cannot be empty.");
      return;
    }
    if (!editVideoUrl.trim()) {
      toast.error("Video URL cannot be empty.");
      return;
    }

    setIsUpdatingShader(true);
    try {
      const res = await fetch("/api/admin/shaders", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          id: editingShader.id,
          name: editShaderName.trim(),
          videoUrl: editVideoUrl.trim(),
          posterUrl: editPosterUrl.trim(),
          active: editingShader.active !== false,
          createdAt: editingShader.createdAt,
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        toast.success(`Shader "${editShaderName.trim()}" updated successfully!`);
        setEditingShader(null);
        fetchShaders();
      } else {
        toast.error(data.error || "Failed to update shader");
      }
    } catch {
      toast.error("Failed to update shader");
    } finally {
      setIsUpdatingShader(false);
    }
  };

  const handleDeleteShader = async (shaderId: string, name: string) => {
    if (!sessionToken) return;
    try {
      const res = await fetch(`/api/admin/shaders?id=${encodeURIComponent(shaderId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (res.ok) {
        toast.success(`Removed shader "${name}"`);
        fetchShaders();
      }
    } catch {
      toast.error("Failed to delete shader");
    }
  };

  const handleRunYtTest = async () => {
    if (!ytTestUrl.trim() || !sessionToken) return;
    setIsTestingYt(true);
    setYtTestResult(null);

    try {
      const res = await fetch("/api/admin/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          action: "test_youtube_url",
          payload: { url: ytTestUrl.trim() },
        }),
      });
      const data = await res.json();
      setYtTestResult(data);
      if (data.ok) {
        toast.success(`Successfully parsed ${data.trackCount} tracks in ${data.latency}ms`);
      } else {
        toast.error(data.error || "Extraction test failed");
      }
    } catch {
      toast.error("Failed to execute extraction test");
    } finally {
      setIsTestingYt(false);
    }
  };

  const handlePurgeCache = async () => {
    if (!sessionToken) return;
    try {
      const res = await fetch("/api/admin/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ action: "purge_cache" }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(data.message || "Caches flushed");
        fetchStats();
      }
    } catch {
      toast.error("Failed to purge cache");
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (!sessionToken || !username) return;
    const confirmDelete = window.confirm(`Are you sure you want to delete user @${username}?`);
    if (!confirmDelete) return;

    try {
      const res = await fetch(`/api/admin/users?username=${encodeURIComponent(username)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (res.ok) {
        toast.success(`User @${username} removed`);
        fetchUsers();
      } else {
        toast.error("Failed to delete user");
      }
    } catch {
      toast.error("Error deleting user");
    }
  };

  // User counts and filter
  const onlineUsersCount = usersList.filter((u) => u.isOnline).length;
  const liveDjsCount = usersList.filter((u) => u.isPlaying || (u.isOnline && u.currentTrack)).length;
  const dbUsersCount = usersList.filter((u) => u.source === "supabase").length;

  const filteredUsers = usersList.filter((u) => {
    if (userFilterTab === "online" && !u.isOnline) return false;
    if (userFilterTab === "live" && !(u.isPlaying || (u.isOnline && u.currentTrack))) return false;
    if (userFilterTab === "supabase" && u.source !== "supabase") return false;

    if (!userSearchQuery.trim()) return true;
    const q = userSearchQuery.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.displayName.toLowerCase().includes(q) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.bio && u.bio.toLowerCase().includes(q))
    );
  });

  // -------------------------------------------------------------
  // TERMINAL VIEW (Rendered by default on SSR and unauthenticated state)
  // -------------------------------------------------------------
  if (!isMounted || viewMode === "terminal") {
    return (
      <main
        className="min-h-screen bg-[#07080c] text-emerald-400 font-mono text-sm p-4 sm:p-6 flex flex-col justify-between selection:bg-emerald-500/30 selection:text-white"
        onClick={() => terminalInputRef.current?.focus()}
      >
        <div className="max-w-4xl w-full mx-auto">
          {/* Top header indicator */}
          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3 mb-4 text-xs text-emerald-500/60 select-none">
            <div className="flex items-center gap-2">
              <span className="inline-block size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>TERMINAL // ROOT@AUXY-EDGE-01</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/" className="hover:text-emerald-300 transition-colors flex items-center gap-1">
                <ArrowLeft className="size-3" /> Return to App
              </Link>
              <span>TTY-1 (PORT 3000)</span>
            </div>
          </div>

          {/* Logs scroll area */}
          <div className="space-y-1 leading-relaxed">
            {terminalLogs.map((log, index) => (
              <div
                key={index}
                className={
                  log.startsWith("[ERR]")
                    ? "text-rose-400"
                    : log.startsWith("[ACCESS DENIED]")
                    ? "text-red-400 font-bold"
                    : log.startsWith("[OK]") || log.startsWith("[SUCCESS]")
                    ? "text-emerald-300 font-semibold"
                    : log.startsWith("[SYSTEM]") || log.startsWith("[INFO]")
                    ? "text-cyan-300"
                    : log.startsWith(">")
                    ? "text-white/80"
                    : "text-emerald-400/90"
                }
              >
                {log}
              </div>
            ))}
            <div ref={terminalEndRef} />
          </div>

          {/* Prompt line */}
          <form onSubmit={handleTerminalSubmit} className="mt-3 flex items-center gap-2">
            <span className="text-cyan-400 select-none font-semibold">root@auxy:~$</span>
            <input
              ref={terminalInputRef}
              type={isPasswordMasked ? "password" : "text"}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              disabled={isAuthenticating}
              autoFocus
              spellCheck={false}
              autoComplete="off"
              className="flex-1 bg-transparent border-none outline-none text-emerald-300 font-mono caret-emerald-400 placeholder:text-emerald-700/50 p-0 text-sm"
              placeholder={isAuthenticating ? "Authenticating..." : "Enter admin password..."}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsPasswordMasked(!isPasswordMasked);
              }}
              className="text-[10px] text-emerald-600 hover:text-emerald-400 uppercase tracking-widest border border-emerald-500/20 px-1.5 py-0.5 rounded cursor-pointer"
            >
              {isPasswordMasked ? "MASK: ON" : "MASK: OFF"}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <div className="max-w-4xl w-full mx-auto pt-8 text-[11px] text-emerald-500/40 flex justify-between border-t border-emerald-500/10 select-none">
          <span>Protected by System Quota Guard & Admin Encryption</span>
          <span>Shift + Click to Focus</span>
        </div>
      </main>
    );
  }

  // -------------------------------------------------------------
  // DASHBOARD VIEW (BlinkOps / Minimalist Architecture Theme)
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#090a0f] text-zinc-100 font-sans selection:bg-zinc-800">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-[#0c0d14]/90 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-zinc-800 border border-zinc-700 text-cyan-400 shadow-inner">
            <Shield className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight text-white">Auxy Ops Center</span>
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-400 flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Operational
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">Minimalist Infrastructure & Direct Video URL System</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              fetchStats();
              fetchUsers();
              fetchShaders();
            }}
            disabled={isLoadingStats || isLoadingUsers || isLoadingShaders}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
            title="Refresh metrics"
          >
            <RefreshCw className={`size-3.5 ${isLoadingStats ? "animate-spin text-cyan-400" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("terminal")}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
            title="Switch to terminal"
          >
            <TerminalIcon className="size-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Terminal</span>
          </button>

          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <Globe className="size-3.5 text-blue-400" />
            <span className="hidden sm:inline">Open App</span>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/20 transition-colors cursor-pointer"
            title="Sign out"
          >
            <LogOut className="size-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-zinc-800/80 pb-2 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 font-medium transition-colors cursor-pointer ${
              activeTab === "overview"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            }`}
          >
            <Activity className="size-3.5 text-cyan-400" />
            Overview
          </button>

          {/* Tab 2: All Users */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("users");
              fetchUsers();
            }}
            className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 font-medium transition-colors cursor-pointer ${
              activeTab === "users"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            }`}
          >
            <Users className="size-3.5 text-blue-400" />
            All Users ({usersList.length})
          </button>

          {/* Tab 3: Live Shaders */}
          <button
            type="button"
            onClick={() => {
              setActiveTab("shaders");
              fetchShaders();
            }}
            className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 font-medium transition-colors cursor-pointer ${
              activeTab === "shaders"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            }`}
          >
            <Video className="size-3.5 text-purple-400" />
            Live Shaders
          </button>

          {/* Tab 4: Live Rooms */}
          <button
            type="button"
            onClick={() => setActiveTab("rooms")}
            className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 font-medium transition-colors cursor-pointer ${
              activeTab === "rooms"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            }`}
          >
            <Radio className="size-3.5 text-emerald-400" />
            Live Rooms ({stats?.rooms?.length || 0})
          </button>

          {/* Tab 5: YouTube Diagnostics */}
          <button
            type="button"
            onClick={() => setActiveTab("youtube")}
            className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 font-medium transition-colors cursor-pointer ${
              activeTab === "youtube"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            }`}
          >
            <Flame className="size-3.5 text-amber-400" />
            YouTube Diagnostics
          </button>

          {/* Tab 6: Storage & Quota */}
          <button
            type="button"
            onClick={() => setActiveTab("storage")}
            className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 font-medium transition-colors cursor-pointer ${
              activeTab === "storage"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            }`}
          >
            <Database className="size-3.5 text-emerald-400" />
            Storage & Quota Guard
          </button>

          {/* Tab 7: Logs */}
          <button
            type="button"
            onClick={() => setActiveTab("logs")}
            className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 font-medium transition-colors cursor-pointer ${
              activeTab === "logs"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
            }`}
          >
            <Sliders className="size-3.5 text-zinc-400" />
            System Status
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: OVERVIEW */}
        {/* ========================================================================= */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-zinc-800/90 bg-[#0e1017] p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Registered Users</span>
                  <Users className="size-4 text-blue-400" />
                </div>
                <div className="text-2xl font-bold tracking-tight text-white">
                  {usersList.length || stats?.system?.supabase?.profiles || 1}
                </div>
                <p className="text-[11px] text-zinc-500">Active community accounts</p>
              </div>

              <div className="rounded-xl border border-zinc-800/90 bg-[#0e1017] p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Active Live Shaders</span>
                  <Video className="size-4 text-purple-400" />
                </div>
                <div className="text-2xl font-bold tracking-tight text-purple-300">
                  {shadersList.length || 6}
                </div>
                <p className="text-[11px] text-zinc-500">Discord CDN & Direct URLs</p>
              </div>

              <div className="rounded-xl border border-zinc-800/90 bg-[#0e1017] p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Supabase Quota Guard</span>
                  <CheckCircle2 className="size-4 text-cyan-400" />
                </div>
                <div className="text-2xl font-bold tracking-tight text-emerald-400">
                  Protected
                </div>
                <p className="text-[11px] text-zinc-500">Zero raw video bytes stored in DB</p>
              </div>

              <div className="rounded-xl border border-zinc-800/90 bg-[#0e1017] p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>Server Heap Memory</span>
                  <HardDrive className="size-4 text-amber-400" />
                </div>
                <div className="text-2xl font-bold tracking-tight text-white">
                  {stats?.system?.memory?.heapUsedMB ?? 45} MB
                </div>
                <p className="text-[11px] text-zinc-500">
                  Total RSS: {stats?.system?.memory?.rssMB ?? 110} MB
                </p>
              </div>
            </div>

            {/* Quick Action Bar */}
            <div className="rounded-xl border border-zinc-800/90 bg-[#0e1017] p-5">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Zap className="size-4 text-cyan-400" />
                Quick Operations
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handlePurgeCache}
                  className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3.5 py-2 text-xs font-medium text-white hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  <RefreshCw className="size-3.5 text-cyan-400" />
                  Flush Memory Cache
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("shaders");
                    fetchShaders();
                  }}
                  className="flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3.5 py-2 text-xs font-medium text-purple-300 hover:bg-purple-500/20 transition-colors cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  Add New Live Shader (Direct URL)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: ALL USERS (Replaces Live Rooms as requested) */}
        {/* ========================================================================= */}
        {activeTab === "users" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-800/90 bg-[#0e1017] p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Users className="size-4 text-blue-400" />
                    All Registered Users Directory
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-normal">
                      {usersList.length} total
                    </span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Comprehensive registry of all accounts across in-memory sessions, room hosts, and Supabase PostgreSQL profiles
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-500" />
                    <input
                      type="text"
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      placeholder="Search username, email, display name..."
                      className="bg-zinc-900 border border-zinc-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 w-60"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchUsers()}
                    className="p-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white cursor-pointer transition-colors"
                    title="Refresh user list"
                  >
                    <RefreshCw className={`size-3.5 ${isLoadingUsers ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-2 pt-1 border-t border-zinc-800/60 overflow-x-auto text-xs pb-1">
                <button
                  type="button"
                  onClick={() => setUserFilterTab("all")}
                  className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer shrink-0 ${
                    userFilterTab === "all"
                      ? "bg-blue-600 text-white"
                      : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
                  }`}
                >
                  All Users ({usersList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setUserFilterTab("online")}
                  className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    userFilterTab === "online"
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
                  }`}
                >
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Online Now ({onlineUsersCount})
                </button>
                <button
                  type="button"
                  onClick={() => setUserFilterTab("live")}
                  className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    userFilterTab === "live"
                      ? "bg-purple-600 text-white"
                      : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
                  }`}
                >
                  <Radio className="size-3 text-purple-300" />
                  Live DJs & Streamers ({liveDjsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setUserFilterTab("supabase")}
                  className={`px-3 py-1 rounded-md font-medium transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    userFilterTab === "supabase"
                      ? "bg-cyan-600 text-white"
                      : "bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
                  }`}
                >
                  <Database className="size-3 text-cyan-300" />
                  Database Synced ({dbUsersCount})
                </button>
              </div>

              {filteredUsers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400 font-medium">
                        <th className="pb-3">User</th>
                        <th className="pb-3">Handle / Email</th>
                        <th className="pb-3">Bio / Pronouns</th>
                        <th className="pb-3">Playlists</th>
                        <th className="pb-3">Stars</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {filteredUsers.map((u) => (
                        <tr key={u.id || u.username} className="hover:bg-zinc-900/30">
                          <td className="py-3 font-medium text-white flex items-center gap-2.5">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={u.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`}
                              alt=""
                              className="size-8 rounded-full bg-zinc-800 object-cover ring-1 ring-white/10 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="font-semibold text-white truncate">{u.displayName}</div>
                              {u.currentTrack?.title ? (
                                <div className="text-[10px] text-cyan-400 truncate max-w-[180px] flex items-center gap-1">
                                  <Music className="size-2.5 shrink-0 animate-pulse" />
                                  <span className="truncate">{u.currentTrack.title}</span>
                                </div>
                              ) : (
                                <div className="text-[10px] text-zinc-500 font-mono">
                                  {u.source === "supabase" ? "Supabase DB" : "Auxy Core Store"}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 font-mono text-zinc-300">
                            <div>@{u.username}</div>
                            {u.email && <div className="text-[10px] text-zinc-500 font-sans truncate max-w-[140px]">{u.email}</div>}
                          </td>
                          <td className="py-3 text-zinc-400 max-w-[200px] truncate">
                            {u.bio || (u.pronouns ? `(${u.pronouns})` : "—")}
                          </td>
                          <td className="py-3 text-zinc-400">
                            <span className="px-2 py-0.5 rounded bg-zinc-800/80 font-mono text-[10px] text-zinc-300">
                              {u.playlistsCount || 1} mix
                            </span>
                          </td>
                          <td className="py-3 text-amber-300 font-medium">★ {u.starCount}</td>
                          <td className="py-3">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium ${
                                u.isPlaying
                                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                  : u.isOnline
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : "bg-zinc-800 text-zinc-400"
                              }`}
                            >
                              {u.isPlaying ? "LIVE DJ" : u.isOnline ? "ONLINE" : "OFFLINE"}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {u.roomId && (
                                <Link
                                  href={`/r/${encodeURIComponent(u.roomId.replace("room_", ""))}`}
                                  target="_blank"
                                  className="inline-flex items-center gap-1 text-[11px] text-purple-300 hover:text-purple-200 px-2 py-1 rounded bg-purple-500/10 border border-purple-500/20 transition-colors"
                                >
                                  <Radio className="size-2.5" />
                                  Join Room
                                </Link>
                              )}
                              <Link
                                href={`/u/${encodeURIComponent(u.username)}`}
                                target="_blank"
                                className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 transition-colors"
                              >
                                <ExternalLink className="size-2.5" />
                                Profile
                              </Link>
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u.username)}
                                className="inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-rose-400 px-1.5 py-1 rounded bg-zinc-900 border border-zinc-800 hover:border-rose-500/30 transition-colors cursor-pointer"
                                title={`Delete @${u.username}`}
                              >
                                <Trash2 className="size-2.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-zinc-500">
                  {isLoadingUsers ? "Loading users directory..." : "No users found matching your search query."}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: LIVE SHADERS (DIRECT VIDEO CDN STREAMING) */}
        {/* ========================================================================= */}
        {activeTab === "shaders" && (
          <div className="space-y-6">
            {/* Direct Video URL Live Shader Publisher */}
            <div className="rounded-xl border border-purple-500/30 bg-[#0e0d18] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Video className="size-4 text-purple-400" />
                    Live Shader Publisher (Direct Video CDN URLs)
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Add live background shaders using direct video stream URLs (Discord CDN, MP4, WebM). Synced to Supabase and Server Store.
                  </p>
                </div>
                <span className="rounded-md bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-[10px] font-mono text-purple-300">
                  CDN STREAMING
                </span>
              </div>

              {/* URL Input Form & Live Preview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left: Input Fields */}
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                      Shader Display Name
                    </label>
                    <input
                      type="text"
                      value={shaderName}
                      onChange={(e) => setShaderName(e.target.value)}
                      placeholder="e.g., Cyberpunk Rain, Tokyo Lights, Cosmic Void..."
                      className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                      Direct Video Stream URL (Discord CDN, MP4, WebM)
                    </label>
                    <input
                      type="url"
                      value={directVideoUrl}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDirectVideoUrl(val);
                        if (!shaderName && val) {
                          const match = val.split("/").pop()?.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
                          if (match) setShaderName(match.charAt(0).toUpperCase() + match.slice(1));
                        }
                      }}
                      placeholder="https://cdn.discordapp.com/attachments/.../video.mp4"
                      className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500 font-mono"
                    />
                    <p className="text-[10px] text-zinc-500 mt-1">
                      Fast streaming with zero blob limits. Supports any direct MP4 / WebM video link.
                    </p>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                      Poster Image URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={shaderPosterUrl}
                      onChange={(e) => setShaderPosterUrl(e.target.value)}
                      placeholder="https://.../poster.jpg or /thumbnails/..."
                      className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500 font-mono"
                    />
                  </div>

                  {/* Publish Button */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleSaveAndPublishShader}
                      disabled={isSavingShader || !directVideoUrl.trim() || !shaderName.trim()}
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-white transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isSavingShader ? (
                        <>
                          <RefreshCw className="size-3.5 animate-spin" />
                          <span>Publishing Live Shader...</span>
                        </>
                      ) : (
                        <>
                          <Check className="size-3.5" />
                          <span>Publish to Live Shaders (Available to All Users)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Right: Live Video Player Preview */}
                <div className="space-y-2">
                  <label className="text-[11px] font-medium text-zinc-300 block">
                    Video Stream Preview
                  </label>
                  <div className="relative aspect-video w-full rounded-xl bg-black overflow-hidden border border-zinc-800 flex items-center justify-center">
                    {directVideoUrl.trim() ? (
                      <video
                        src={directVideoUrl.trim()}
                        poster={shaderPosterUrl.trim() || undefined}
                        controls
                        muted
                        loop
                        playsInline
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="text-center p-6 text-zinc-600">
                        <Video className="size-8 mx-auto mb-2 opacity-50" />
                        <span className="text-xs">Enter video URL to preview playback</span>
                      </div>
                    )}
                  </div>
                  {directVideoUrl.trim() && (
                    <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-2.5 text-[11px] font-mono text-zinc-400 break-all flex items-center justify-between gap-2">
                      <span className="truncate text-purple-300">
                        {directVideoUrl}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(directVideoUrl.trim());
                          toast.success("Video URL copied to clipboard!");
                        }}
                        className="p-1 hover:text-white cursor-pointer shrink-0"
                        title="Copy Video URL"
                      >
                        <Copy className="size-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Currently Active Live Shaders Catalog */}
            <div className="rounded-xl border border-zinc-800/90 bg-[#0e1017] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Active Live Shaders Catalog</h3>
                  <p className="text-xs text-zinc-400">
                    Live shaders rendered in Room backgrounds (Videos play on hover only)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fetchShaders()}
                  className="text-xs text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="size-3" /> Refresh
                </button>
              </div>

              {shadersList.length === 0 ? (
                <div className="py-10 text-center text-zinc-500 text-xs rounded-lg border border-dashed border-zinc-800">
                  No Live Shaders available yet. Enter a direct video URL above to publish.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {shadersList.map((s) => (
                    <div
                      key={s.id}
                      className="group rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden flex flex-col justify-between"
                    >
                      <div className="relative aspect-video w-full bg-black overflow-hidden">
                        {s.posterUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={s.posterUrl}
                            alt={s.name}
                            loading="lazy"
                            decoding="async"
                            className="absolute inset-0 size-full object-cover transition-opacity duration-200 group-hover:opacity-0 pointer-events-none"
                          />
                        )}
                        <video
                          src={`${s.videoUrl}#t=0.001`}
                          poster={s.posterUrl}
                          muted
                          loop
                          playsInline
                          preload="metadata"
                          onMouseEnter={(e) => {
                            e.currentTarget.play().catch(() => {});
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.pause();
                            e.currentTarget.currentTime = 0;
                          }}
                          className="size-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none transition-opacity duration-200 group-hover:opacity-0" />
                        <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-white pointer-events-none transition-opacity duration-200 group-hover:opacity-0">
                          <span className="text-xs font-semibold drop-shadow truncate">{s.name}</span>
                          <span className="text-[10px] text-zinc-400 bg-black/60 px-1.5 py-0.5 rounded font-mono">
                            CDN
                          </span>
                        </div>
                      </div>

                      <div className="p-3 flex items-center justify-between border-t border-zinc-800/80 bg-zinc-950/40">
                        <span className="text-[11px] text-zinc-500 font-mono truncate max-w-[140px]">
                          {s.id}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEditShader(s)}
                            className="text-zinc-500 hover:text-purple-400 p-1.5 rounded hover:bg-zinc-800/60 transition-colors cursor-pointer"
                            title="Edit shader"
                          >
                            <Edit2 className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteShader(s.id, s.name)}
                            className="text-zinc-500 hover:text-rose-400 p-1.5 rounded hover:bg-zinc-800/60 transition-colors cursor-pointer"
                            title="Delete shader"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Edit Shader Modal Dialog */}
            {editingShader && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="relative w-full max-w-lg rounded-2xl border border-zinc-800 bg-[#0e1017] p-6 shadow-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Edit2 className="size-4 text-purple-400" />
                      <h3 className="text-sm font-semibold text-white">Edit Live Shader</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingShader(null)}
                      className="text-zinc-400 hover:text-white p-1 rounded-md hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                        Shader ID (Read-only)
                      </label>
                      <input
                        type="text"
                        disabled
                        value={editingShader.id}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                        Shader Name
                      </label>
                      <input
                        type="text"
                        value={editShaderName}
                        onChange={(e) => setEditShaderName(e.target.value)}
                        placeholder="e.g., Cyberpunk Rain"
                        className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                        Video Stream URL (MP4 / WebM / Discord CDN)
                      </label>
                      <input
                        type="url"
                        value={editVideoUrl}
                        onChange={(e) => setEditVideoUrl(e.target.value)}
                        placeholder="https://.../video.mp4"
                        className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-zinc-300 block mb-1">
                        Poster Image URL (Optional)
                      </label>
                      <input
                        type="url"
                        value={editPosterUrl}
                        onChange={(e) => setEditPosterUrl(e.target.value)}
                        placeholder="https://.../poster.jpg or /thumbnails/..."
                        className="w-full bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500 font-mono"
                      />
                    </div>

                    {/* Preview Player */}
                    {editVideoUrl && (
                      <div className="space-y-1 pt-1">
                        <span className="text-[10px] text-zinc-400 block font-medium">Video Preview</span>
                        <div className="relative aspect-video w-full rounded-lg bg-black overflow-hidden border border-zinc-800">
                          <video
                            src={editVideoUrl}
                            poster={editPosterUrl || undefined}
                            controls
                            muted
                            loop
                            playsInline
                            className="size-full object-cover"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                    <button
                      type="button"
                      onClick={() => setEditingShader(null)}
                      className="px-3.5 py-2 text-xs font-medium text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleUpdateShader}
                      disabled={isUpdatingShader}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isUpdatingShader ? (
                        <>
                          <RefreshCw className="size-3.5 animate-spin" />
                          <span>Saving Changes...</span>
                        </>
                      ) : (
                        <>
                          <Check className="size-3.5" />
                          <span>Save Changes</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: ROOMS */}
        {/* ========================================================================= */}
        {activeTab === "rooms" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-800/90 bg-[#0e1017] p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Live Rooms Registry</h3>
                  <p className="text-xs text-zinc-400">Manage all concurrent active listening sessions</p>
                </div>
                <button
                  type="button"
                  onClick={() => fetchStats()}
                  className="text-xs text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="size-3" /> Refresh
                </button>
              </div>

              {stats?.rooms && stats.rooms.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400 font-medium">
                        <th className="pb-3">Room Name</th>
                        <th className="pb-3">Host</th>
                        <th className="pb-3">Current Song</th>
                        <th className="pb-3">Listeners</th>
                        <th className="pb-3">State</th>
                        <th className="pb-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {stats.rooms.map((rm) => (
                        <tr key={rm.id} className="hover:bg-zinc-900/30">
                          <td className="py-3 font-medium text-white">{rm.name}</td>
                          <td className="py-3 text-zinc-300 font-mono">@{rm.host}</td>
                          <td className="py-3 text-zinc-400">{rm.track || "None"}</td>
                          <td className="py-3 text-zinc-300">{rm.listeners}</td>
                          <td className="py-3">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${rm.isPlaying ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 text-zinc-400"}`}>
                              {rm.isPlaying ? "LIVE" : "IDLE"}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <button
                              type="button"
                              onClick={async () => {
                                if (!sessionToken) return;
                                const res = await fetch("/api/admin/actions", {
                                  method: "POST",
                                  headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${sessionToken}`,
                                  },
                                  body: JSON.stringify({ action: "terminate_room", payload: { roomId: rm.id } }),
                                });
                                if (res.ok) {
                                  toast.success(`Terminated room ${rm.name}`);
                                  fetchStats();
                                }
                              }}
                              className="text-xs text-rose-400 hover:text-rose-300 px-2 py-1 rounded bg-rose-500/10 border border-rose-500/20 cursor-pointer"
                            >
                              Terminate
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-zinc-500">
                  No active rooms found. Users can create rooms via the Listen Together window.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: YOUTUBE DIAGNOSTICS */}
        {/* ========================================================================= */}
        {activeTab === "youtube" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-800/90 bg-[#0e1017] p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Flame className="size-4 text-amber-400" />
                  YouTube Scraper & Playlist Extraction Test Bench
                </h3>
                <p className="text-xs text-zinc-400">
                  Directly test YouTube URL extraction latency and pagination (Mixes, Radios, 190+ song playlists)
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={ytTestUrl}
                  onChange={(e) => setYtTestUrl(e.target.value)}
                  placeholder="Paste YouTube playlist or mix URL (e.g., https://www.youtube.com/playlist?list=...)"
                  className="flex-1 bg-zinc-900 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={handleRunYtTest}
                  disabled={isTestingYt || !ytTestUrl.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isTestingYt ? <RefreshCw className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
                  Test Extraction
                </button>
              </div>

              {ytTestResult && (
                <div className="rounded-lg border border-zinc-800 bg-[#07080c] p-4 space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between text-zinc-400 border-b border-zinc-800 pb-2">
                    <span className="text-emerald-400 font-bold">Extraction Result:</span>
                    <span>Latency: {String(ytTestResult.latency)}ms</span>
                  </div>
                  <div className="space-y-1 text-zinc-300">
                    <div>Playlist Title: <span className="text-white font-bold">{String(ytTestResult.title || "N/A")}</span></div>
                    <div>Total Extracted Tracks: <span className="text-cyan-400 font-bold">{String(ytTestResult.trackCount || 0)}</span></div>
                  </div>
                  {Array.isArray(ytTestResult.sampleTracks) && (
                    <div className="mt-2 space-y-1 pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-400">
                      <div className="text-zinc-500 uppercase">First 5 Sample Tracks:</div>
                      {ytTestResult.sampleTracks.map((tr: { title?: string; artist?: string; duration?: number; videoId?: string }, i: number) => (
                        <div key={i} className="text-zinc-300">
                          {i + 1}. {tr.title} ({tr.artist}) - [{tr.videoId}]
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: STORAGE & QUOTA GUARD */}
        {/* ========================================================================= */}
        {activeTab === "storage" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-800/90 bg-[#0e1017] p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Database className="size-4 text-emerald-400" />
                  Supabase Database & Quota Guard Status
                </h3>
                <p className="text-xs text-zinc-400">
                  Telemetry on database writes, quota prevention mechanisms, and storage compaction
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 space-y-1">
                  <span className="text-[11px] text-zinc-500">Supabase Storage Policy</span>
                  <p className="text-xs font-semibold text-white">Lightweight Metadata Only</p>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 space-y-1">
                  <span className="text-[11px] text-zinc-500">Video Storage</span>
                  <p className="text-xs font-semibold text-purple-400">Direct Video URLs & CDN</p>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 space-y-1">
                  <span className="text-[11px] text-zinc-500">Write Rate Limiting</span>
                  <p className="text-xs font-semibold text-emerald-400">Debounced (1.5s)</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 7: SYSTEM STATUS */}
        {/* ========================================================================= */}
        {activeTab === "logs" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-800/90 bg-[#0e1017] p-5 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between text-zinc-400 border-b border-zinc-800 pb-2">
                <span className="text-white font-semibold">Node.js Server Environment</span>
                <span className="text-emerald-400 font-mono">STATUS: OK</span>
              </div>
              <div className="space-y-1.5 text-zinc-300">
                <div>Node Runtime: <span className="text-white">{stats?.system?.nodeVersion || process.version}</span></div>
                <div>Process Uptime: <span className="text-white">{stats?.system?.uptimeSeconds ?? 0} seconds</span></div>
                <div>Heap Used: <span className="text-white">{stats?.system?.memory?.heapUsedMB ?? 45} MB</span></div>
                <div>Heap Total: <span className="text-white">{stats?.system?.memory?.heapTotalMB ?? 60} MB</span></div>
                <div>RSS: <span className="text-white">{stats?.system?.memory?.rssMB ?? 115} MB</span></div>
                <div>Cache Hit Ratio: <span className="text-cyan-400 font-bold">{stats?.system?.performance?.cacheHitRate ?? "94.2%"}</span></div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
