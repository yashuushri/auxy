// Server and client admin identification for Auxy
export const ADMIN_EMAIL = "gamertechtech63@gmail.com";

export function isAdmin(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}
