import type { ActivityAction } from "@/app/api/activity-log/route";

export interface SendActivityLogParams {
  action: ActivityAction;
  title?: string;
  description?: string;
  user?: {
    username?: string;
    displayName?: string;
    email?: string;
    avatar?: string;
  } | null;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  metadata?: Record<string, string | number | boolean>;
}

// Client-side debounce cache to avoid duplicate spamming
const lastLogged = new Map<string, number>();
const DEBOUNCE_TIME_MS = 2500;

/**
 * Dispatch meaningful activity to the Discord Activity Webhook via the backend proxy.
 * This function NEVER accesses or writes to any database.
 */
export function sendActivityLog(params: SendActivityLogParams): void {
  if (typeof window === "undefined") return;

  try {
    const key = `${params.action}-${params.user?.username || "anon"}-${JSON.stringify(params.metadata || {})}`;
    const now = Date.now();
    const last = lastLogged.get(key);

    if (last && now - last < DEBOUNCE_TIME_MS) {
      return; // Skip duplicate rapid fire
    }
    lastLogged.set(key, now);

    // Clean old keys if map grows
    if (lastLogged.size > 100) {
      lastLogged.clear();
    }

    const payload = {
      action: params.action,
      title: params.title,
      description: params.description,
      user: params.user
        ? {
            username: params.user.username,
            displayName: params.user.displayName || params.user.username,
            email: params.user.email,
            avatar: params.user.avatar,
          }
        : undefined,
      fields: params.fields,
      metadata: params.metadata,
    };

    void fetch("/api/activity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Fire-and-forget; never block the application
    });
  } catch {
    // Non-blocking safety
  }
}
