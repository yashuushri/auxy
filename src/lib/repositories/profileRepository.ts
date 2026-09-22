import { getSupabase } from "@/lib/supabase";
import type { Background, ExploreUser } from "@/lib/types";

export function cleanUsername(username: string): string {
  return (username || "").trim().toLowerCase();
}

export interface ProfileRecord {
  id: string;
  username: string;
  display_name: string;
  avatar?: string;
  bio?: string;
  pronouns?: string;
  volume?: number;
  background_id?: string;
  background_metadata?: Background;
  created_at?: string;
  updated_at?: string;
}

export const profileRepository = {
  async getById(id: string): Promise<ProfileRecord | null> {
    const supabase = getSupabase();
    if (!supabase || !id) return null;
    const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    if (error) {
      console.warn("[ProfileRepository] getById error:", error.message);
      return null;
    }
    return data;
  },

  async getByUsername(username: string): Promise<ProfileRecord | null> {
    const supabase = getSupabase();
    if (!supabase || !username) return null;
    const clean = cleanUsername(username);
    const { data, error } = await supabase.from("profiles").select("*").eq("username", clean).maybeSingle();
    if (error) {
      console.warn("[ProfileRepository] getByUsername error:", error.message);
      return null;
    }
    return data;
  },

  async upsertProfile(profile: Partial<ProfileRecord> & { id: string; username: string }): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase || !profile.id) return false;
    const { error } = await supabase.from("profiles").upsert(
      {
        ...profile,
        username: cleanUsername(profile.username),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (error) {
      console.warn("[ProfileRepository] upsertProfile error:", error.message);
      return false;
    }
    return true;
  },

  async updateVolume(userId: string, volume: number): Promise<void> {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    try {
      await supabase.from("profiles").update({ volume, updated_at: new Date().toISOString() }).eq("id", userId);
    } catch (err) {
      console.warn("[ProfileRepository] updateVolume error:", err);
    }
  },

  async updateBio(userId: string, bio: string, pronouns?: string): Promise<void> {
    const supabase = getSupabase();
    if (!supabase || !userId) return;
    try {
      const update: Record<string, unknown> = { bio, updated_at: new Date().toISOString() };
      if (pronouns !== undefined) update.pronouns = pronouns;
      await supabase.from("profiles").update(update).eq("id", userId);
    } catch (err) {
      console.warn("[ProfileRepository] updateBio error:", err);
    }
  },

  async updateBackground(userId: string, background: Background): Promise<void> {
    const supabase = getSupabase();
    if (!supabase || !userId || !background) return;
    try {
      await supabase.from("profiles").update({
        background_id: background.value || "lava",
        background_metadata: background,
        updated_at: new Date().toISOString(),
      }).eq("id", userId);
    } catch (err) {
      console.warn("[ProfileRepository] updateBackground error:", err);
    }
  },

  async getExploreUsers(limit = 60): Promise<ExploreUser[]> {
    const supabase = getSupabase();
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar, bio, background_id, background_metadata, created_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (error || !data) return [];

      return data.map((row) => ({
        id: row.id,
        username: row.username,
        displayName: row.display_name || row.username,
        avatar: row.avatar || "",
        bio: row.bio || "",
        background: row.background_metadata || { kind: "preset", value: row.background_id || "lava" },
        joinedAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
        lastActive: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
      }));
    } catch (err) {
      console.warn("[ProfileRepository] getExploreUsers error:", err);
      return [];
    }
  },
};
