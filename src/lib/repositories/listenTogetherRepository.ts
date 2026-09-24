import { getSupabase } from "@/lib/supabase";
import { isTableMissingError } from "@/lib/supabase-db";
import type { Room, RoomRequest } from "@/lib/types";

export const listenTogetherRepository = {
  async getRoom(roomId: string): Promise<Room | null> {
    const supabase = getSupabase();
    if (!supabase || !roomId) return null;
    try {
      const { data, error } = await supabase
        .from("listen_together_rooms")
        .select("*")
        .eq("room_id", roomId)
        .maybeSingle();

      if (error || !data) return null;

      return {
        id: data.room_id,
        name: data.name || `${data.host_username || "Host"}'s Room`,
        hostId: data.host_id,
        hostUsername: data.host_username || data.host_id,
        hostDisplayName: data.host_display_name,
        hostAvatar: data.host_avatar,
        isPlaying: !!data.is_playing,
        position: data.current_seek_time || 0,
        participantCount: 1,
        listenTogetherEnabled: data.enabled !== false,
        privacy: data.privacy === "friends" ? "friends" : "public",
        autoAccept: !!data.auto_accept,
        createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
        updatedAt: data.updated_at ? new Date(data.updated_at).getTime() : Date.now(),
      };
    } catch (err) {
      if (!isTableMissingError(err)) {
        console.warn("[ListenTogetherRepository] getRoom error:", err);
      }
      return null;
    }
  },

  async upsertRoom(room: {
    roomId: string;
    hostId: string;
    hostUsername: string;
    enabled?: boolean;
    privacy?: "public" | "friends";
    autoAccept?: boolean;
  }): Promise<void> {
    const supabase = getSupabase();
    if (!supabase || !room.roomId) return;
    try {
      await supabase.from("listen_together_rooms").upsert(
        {
          room_id: room.roomId,
          host_id: room.hostId,
          host_username: room.hostUsername,
          enabled: room.enabled !== false,
          privacy: room.privacy || "public",
          auto_accept: !!room.autoAccept,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "room_id" }
      );
    } catch (err) {
      if (!isTableMissingError(err)) {
        console.warn("[ListenTogetherRepository] upsertRoom error:", err);
      }
    }
  },

  async updateRoomSettings(
    roomId: string,
    settings: { enabled?: boolean; privacy?: "public" | "friends"; autoAccept?: boolean }
  ): Promise<void> {
    const supabase = getSupabase();
    if (!supabase || !roomId) return;
    try {
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (settings.enabled !== undefined) update.enabled = settings.enabled;
      if (settings.privacy !== undefined) update.privacy = settings.privacy;
      if (settings.autoAccept !== undefined) update.auto_accept = settings.autoAccept;

      await supabase.from("listen_together_rooms").update(update).eq("room_id", roomId);
    } catch (err) {
      if (!isTableMissingError(err)) {
        console.warn("[ListenTogetherRepository] updateRoomSettings error:", err);
      }
    }
  },

  async getRequests(roomId: string): Promise<RoomRequest[]> {
    const supabase = getSupabase(true);
    if (!supabase || !roomId) return [];
    try {
      const { data, error } = await supabase
        .from("listen_together_requests")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false });

      if (error || !data) return [];

      return data.map((r) => ({
        id: r.id,
        roomId: r.room_id,
        userId: r.user_id || r.requester_id || r.username,
        username: r.username || r.requester_username || r.user_id,
        displayName: r.display_name || r.requester_display_name || r.username,
        avatar: r.avatar || r.requester_avatar || "",
        status: (r.status === "rejected" ? "declined" : r.status) as "pending" | "accepted" | "declined",
        createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
      }));
    } catch (err) {
      if (!isTableMissingError(err)) {
        console.warn("[ListenTogetherRepository] getRequests error:", err);
      }
      return [];
    }
  },

  async createRequest(req: {
    id: string;
    roomId: string;
    userId: string;
    username: string;
    displayName: string;
    avatar?: string;
  }): Promise<void> {
    const supabase = getSupabase(true);
    if (!supabase || !req.id || !req.roomId) return;
    try {
      const now = new Date().toISOString();
      const { error: insErr } = await supabase.from("listen_together_requests").upsert(
        {
          id: req.id,
          room_id: req.roomId,
          user_id: req.userId,
          username: req.username,
          display_name: req.displayName,
          avatar: req.avatar || "",
          status: "pending",
          created_at: now,
          updated_at: now,
        },
        { onConflict: "id" }
      );

      if (insErr && (insErr.code === "42703" || insErr.message?.includes("column"))) {
        await supabase.from("listen_together_requests").upsert(
          {
            id: req.id,
            room_id: req.roomId,
            requester_id: req.userId,
            requester_username: req.username,
            requester_display_name: req.displayName,
            requester_avatar: req.avatar || "",
            status: "pending",
            created_at: now,
            updated_at: now,
          },
          { onConflict: "id" }
        );
      }
    } catch (err) {
      if (!isTableMissingError(err)) {
        console.warn("[ListenTogetherRepository] createRequest error:", err);
      }
    }
  },

  async updateRequestStatus(requestId: string, status: "accepted" | "declined"): Promise<void> {
    const supabase = getSupabase(true);
    if (!supabase || !requestId) return;
    try {
      const dbStatus = status === "declined" ? "declined" : status;
      await supabase
        .from("listen_together_requests")
        .update({ status: dbStatus, updated_at: new Date().toISOString() })
        .eq("id", requestId);
    } catch (err) {
      if (!isTableMissingError(err)) {
        console.warn("[ListenTogetherRepository] updateRequestStatus error:", err);
      }
    }
  },
};
