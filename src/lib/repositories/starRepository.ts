import { getSupabase } from "@/lib/supabase";

export const starRepository = {
  async getUserStars(userId: string): Promise<string[]> {
    const supabase = getSupabase();
    if (!supabase || !userId) return [];
    try {
      const { data, error } = await supabase
        .from("stars")
        .select("starred_user_id")
        .eq("user_id", userId);
      if (error || !data) return [];
      return data.map((r) => r.starred_user_id);
    } catch (err) {
      console.warn("[StarRepository] getUserStars error:", err);
      return [];
    }
  },

  async addStar(userId: string, targetUserId: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase || !userId || !targetUserId) return false;
    try {
      const { error } = await supabase.from("stars").upsert(
        {
          user_id: userId,
          starred_user_id: targetUserId,
          created_at: new Date().toISOString(),
        },
        { onConflict: "user_id,starred_user_id" }
      );
      return !error;
    } catch (err) {
      console.warn("[StarRepository] addStar error:", err);
      return false;
    }
  },

  async removeStar(userId: string, targetUserId: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase || !userId || !targetUserId) return false;
    try {
      const { error } = await supabase
        .from("stars")
        .delete()
        .eq("user_id", userId)
        .eq("starred_user_id", targetUserId);
      return !error;
    } catch (err) {
      console.warn("[StarRepository] removeStar error:", err);
      return false;
    }
  },

  async isStarred(userId: string, targetUserId: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase || !userId || !targetUserId) return false;
    try {
      const { data } = await supabase
        .from("stars")
        .select("created_at")
        .eq("user_id", userId)
        .eq("starred_user_id", targetUserId)
        .maybeSingle();
      return !!data;
    } catch {
      return false;
    }
  },
};
