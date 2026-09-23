import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const AUXY_AVATAR_URL =
  "https://media.discordapp.net/attachments/1549376829301850142/1549454870254329896/images_4.jfif?ex=6aaac1cc&is=6aa9704c&hm=ecb5098326f6e7000234f9b227ecb83a2a8fa6fcb1d00365c0cd218ab8efbd7c&=&format=webp";

// In-memory rate limiting to protect against floods (No database used)
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const userRate = rateLimits.get(ip);
  if (!userRate || now > userRate.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (userRate.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  userRate.count += 1;
  return true;
}

export type ActivityAction =
  | "user_login"
  | "user_logout"
  | "user_register"
  | "room_started"
  | "listener_joined"
  | "listener_left"
  | "playlist_imported"
  | "playlist_created"
  | "audio_engine_changed"
  | "widget_toggled"
  | "custom_activity";

interface ActivityPayload {
  action: ActivityAction;
  title?: string;
  description?: string;
  user?: {
    username?: string;
    displayName?: string;
    email?: string;
    avatar?: string;
  };
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  metadata?: Record<string, string | number | boolean>;
}

// Color palettes for activity categories (Discord decimal color codes)
const ACTION_COLORS: Record<ActivityAction, number> = {
  user_login: 0x2ecc71, // Emerald Green
  user_logout: 0x95a5a6, // Gray
  user_register: 0x3498db, // Light Blue
  room_started: 0x9b59b6, // Purple
  listener_joined: 0xa855f7, // Vivid Purple
  listener_left: 0x64748b, // Slate
  playlist_imported: 0xe67e22, // Orange
  playlist_created: 0xf1c40f, // Gold
  audio_engine_changed: 0x06b6d4, // Cyan
  widget_toggled: 0xec4899, // Pink
  custom_activity: 0xffffff, // White
};

const ACTION_ICONS: Record<ActivityAction, string> = {
  user_login: "🟢",
  user_logout: "⚪",
  user_register: "✨",
  room_started: "📻",
  listener_joined: "🎧",
  listener_left: "👋",
  playlist_imported: "📥",
  playlist_created: "🎶",
  audio_engine_changed: "🎛️",
  widget_toggled: "🧩",
  custom_activity: "⚡",
};

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ ok: false, error: "Rate limit reached" }, { status: 429 });
    }

    // Prioritize dedicated Activity Discord Webhook, fallback gracefully if needed
    const webhookUrl =
      process.env.ACTIVITY_DISCORD_WEBHOOK_URL ||
      process.env.DISCORD_ACTIVITY_WEBHOOK_URL ||
      process.env.DISCORD_WEBHOOK_URL;

    if (!webhookUrl) {
      // Return ok silently so clients are never broken if webhook is unconfigured
      return NextResponse.json({ ok: true, notice: "Webhook URL not configured" });
    }

    const body: ActivityPayload = await req.json().catch(() => ({ action: "custom_activity" }));
    const { action, title, description, user, fields = [], metadata = {} } = body;

    const safeStr = (str: unknown, max = 200) => (typeof str === "string" ? str.slice(0, max) : "");
    const username = safeStr(user?.username) || "Anonymous";
    const displayName = safeStr(user?.displayName) || username;

    const timeFormatted =
      new Date().toLocaleString("en-US", {
        timeZone: "Asia/Kolkata",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: true,
      }) + " IST";

    const icon = ACTION_ICONS[action] || "⚡";
    const embedColor = ACTION_COLORS[action] || 0xffffff;

    // Generate clean embed title & description based on action type
    let embedTitle = title || `${icon} Activity: ${action.replace(/_/g, " ").toUpperCase()}`;
    let embedDesc = description || `User **${displayName}** (@${username}) performed an action.`;

    if (action === "room_started") {
      embedTitle = `📻 Listen Together Room Active`;
      embedDesc = `**${displayName}** (@${username}) is now broadcasting live in Listen Together.`;
    } else if (action === "listener_joined") {
      embedTitle = `🎧 Listener Joined Room`;
      const hostName = safeStr(metadata.hostUsername) || "Host";
      embedDesc = `**${displayName}** joined **@${hostName}**'s synchronized listening session.`;
    } else if (action === "listener_left") {
      embedTitle = `👋 Listener Left Room`;
      const hostName = safeStr(metadata.hostUsername) || "Host";
      embedDesc = `**${displayName}** left **@${hostName}**'s listening room.`;
    } else if (action === "playlist_imported") {
      embedTitle = `📥 Playlist Synchronized`;
      const count = metadata.trackCount || "Multiple";
      embedDesc = `**${displayName}** imported **${count} tracks** into Auxy OS.`;
    } else if (action === "widget_toggled") {
      const widgetName = safeStr(metadata.widgetName) || "Widget";
      const status = metadata.enabled ? "Active (Pinned)" : "Disabled";
      embedTitle = `🧩 Desktop Widget Toggled`;
      embedDesc = `**${displayName}** changed **${widgetName}** status to **${status}**.`;
    } else if (action === "audio_engine_changed") {
      const mode = safeStr(metadata.mode) || "4D Spatial";
      embedTitle = `🎛️ Audio Engine Configuration`;
      embedDesc = `**${displayName}** switched spatial acoustic mode to **${mode}**.`;
    } else if (action === "user_login") {
      embedTitle = `🟢 User Session Started`;
      embedDesc = `**${displayName}** (@${username}) signed in to Auxy OS.`;
    } else if (action === "user_logout") {
      embedTitle = `⚪ User Session Ended`;
      embedDesc = `**${displayName}** (@${username}) logged out.`;
    }

    // Build embed fields list
    const embedFields: Array<{ name: string; value: string; inline?: boolean }> = [];

    // Always include User field if available
    embedFields.push({
      name: "User",
      value: `${displayName} (\`@${username}\`)`,
      inline: true,
    });

    // Append custom fields
    if (Array.isArray(fields) && fields.length > 0) {
      for (const field of fields.slice(0, 8)) {
        if (field.name && field.value) {
          embedFields.push({
            name: safeStr(field.name, 100),
            value: safeStr(field.value, 300),
            inline: field.inline ?? true,
          });
        }
      }
    }

    // Append metadata as fields if not already populated
    for (const [key, val] of Object.entries(metadata)) {
      if (embedFields.length < 10 && val !== undefined && val !== null) {
        const formattedKey = key
          .replace(/([A-Z])/g, " $1")
          .replace(/_/g, " ")
          .trim();
        embedFields.push({
          name: formattedKey.charAt(0).toUpperCase() + formattedKey.slice(1),
          value: String(val).slice(0, 200),
          inline: true,
        });
      }
    }

    const discordPayload = {
      username: "Activity dc webhook",
      avatar_url: AUXY_AVATAR_URL,
      embeds: [
        {
          title: embedTitle,
          description: embedDesc,
          color: embedColor,
          fields: embedFields,
          footer: {
            text: `Auxy OS • ${timeFormatted}`,
          },
        },
      ],
    };

    // Forward to Discord directly via server-side fetch with abort controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(discordPayload),
      signal: controller.signal,
    }).catch((err) => {
      console.error("Activity webhook fetch failed:", err?.message);
      return null;
    });

    clearTimeout(timeoutId);

    if (response && !response.ok) {
      console.warn("Discord activity webhook status:", response.status);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Activity log processing failed:", error);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
