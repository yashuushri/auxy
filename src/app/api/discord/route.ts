import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const AUXY_AVATAR_URL =
  "https://media.discordapp.net/attachments/1549376829301850142/1549454870254329896/images_4.jfif?ex=6aaac1cc&is=6aa9704c&hm=ecb5098326f6e7000234f9b227ecb83a2a8fa6fcb1d00365c0cd218ab8efbd7c&=&format=webp";

// Simple in-memory rate limiter (IP-based)
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5;

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

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
    }

    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      console.warn("DISCORD_WEBHOOK_URL is not configured.");
      // Return ok to not break the client, but do not send
      return NextResponse.json({ ok: true });
    }

    const body = await req.json().catch(() => ({}));
    const { type, username, email } = body;

    // Validate inputs
    if (!type || typeof type !== "string" || !["register", "login", "logout", "forgot_password"].includes(type)) {
      return NextResponse.json({ ok: false, error: "Invalid notification type" }, { status: 400 });
    }

    const safeStr = (str: unknown) => (typeof str === "string" ? str.slice(0, 100) : "");
    const userDisplay = safeStr(username) || "username";
    const emailDisplay = safeStr(email) || `${userDisplay.toLowerCase()}@auxy.app`;

    let payload: Record<string, unknown> = {};

    const timeFormatted =
      new Date().toLocaleString("en-US", {
        timeZone: "Asia/Kolkata",
        month: "numeric",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: true,
      }) + " IST";

    if (type === "register") {
      const embedDescription = [
        `# <:auxypng:1549434376440520835> New Account Created`,
        `- A new user just created an account on Auxy!`,
        `### <:tick:1549433957903376534> Username: ${userDisplay}`,
        `### <:email:1549433686326513844> Email: ${emailDisplay}`,
      ].join("\n");

      payload = {
        username: "Auxy Admin",
        avatar_url: AUXY_AVATAR_URL,
        embeds: [
          {
            description: embedDescription,
            color: 1184276,
            footer: {
              text: timeFormatted,
            },
          },
        ],
      };
    } else if (type === "login") {
      const userLabel = safeStr(username) || safeStr(email) || "Guest Listener";
      payload = {
        username: "Auxy Admin",
        avatar_url: AUXY_AVATAR_URL,
        content: `<:1tick:1549433827720437760> ${userLabel} just signed in to Auxy.`,
      };
    } else if (type === "logout") {
      const userLabel = safeStr(username) || safeStr(email) || "Guest Listener";
      payload = {
        username: "Auxy Admin",
        avatar_url: AUXY_AVATAR_URL,
        content: `<:2tick:1549433892153327728> ${userLabel} just signed out of Auxy.`,
      };
    } else if (type === "forgot_password") {
      const userLabel = safeStr(username) || safeStr(email) || "User";
      payload = {
        username: "Auxy Admin",
        avatar_url: AUXY_AVATAR_URL,
        content: `### <:person:1311988770807222324> ${userLabel} requested password reset.`,
      };
    }

    // Use abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).catch((err) => {
      console.error("Network error sending to Discord:", err.message);
      return null;
    });

    clearTimeout(timeoutId);

    if (response && !response.ok) {
      console.warn("Discord webhook responded with status:", response.status);
    }

    return NextResponse.json({ ok: true });
  } catch {
    console.error("Error sending Discord notification"); // Do not log exact error that might leak webhook URL
    return NextResponse.json({ ok: false, error: "Unable to send notification." }, { status: 500 });
  }
}
