import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  getDocs,
  collection,
  query,
  where,
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";
import type { UserAccount, Playlist, Track, PublicProfile } from "@/lib/types";

// 1. Initialize Firebase App and Services
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// 2. Validate Connection to Firestore on Boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.warn("Please check your Firebase configuration: client is offline.");
    }
  }
}
if (typeof window !== "undefined") {
  void testConnection();
}

// 3. Error Handling Architecture
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// 4. Firebase Authentication Helpers
export async function signInWithGoogle(): Promise<{ user: FirebaseUser | null; error: Error | null }> {
  try {
    const res = await signInWithPopup(auth, googleProvider);
    return { user: res.user, error: null };
  } catch (err) {
    return { user: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export async function signOutUser(): Promise<void> {
  try {
    await firebaseSignOut(auth);
  } catch (err) {
    console.error("Error signing out of Firebase:", err);
  }
}

// 5. User Profile and Playlists Persistence in Firestore
export async function syncUserProfileToFirestore(user: UserAccount): Promise<boolean> {
  // Only authenticated Firebase users can write to Firestore.
  // Guest and demo accounts operate purely in client-side storage.
  if (!user.id || !auth.currentUser || auth.currentUser.uid !== user.id) {
    return false;
  }
  const userPath = `users/${user.id}`;

  try {
    // 1. Sync User Document
    let safeBg = user.background || { kind: "preset", value: "#0b0b12" };
    // Video must strictly be a URL link, never a heavy raw binary or base64 blob in database
    if (safeBg.kind === "video" && safeBg.value?.startsWith("data:")) {
      safeBg = { kind: "preset", value: "#0b0b12" };
    }

    await setDoc(
      doc(db, "users", user.id),
      {
        id: user.id,
        username: user.username.toLowerCase(),
        displayName: user.displayName,
        avatar: user.avatar,
        bio: user.bio || "",
        background: safeBg,
        volume: typeof user.volume === "number" ? user.volume : 80,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // 2. Sync Playlists & Tracks
    for (const pl of user.playlists) {
      const plPath = `playlists/${pl.id}`;
      try {
        await setDoc(
          doc(db, "playlists", pl.id),
          {
            id: pl.id,
            ownerId: user.id,
            name: pl.name,
            description: pl.description || "",
            cover: pl.cover || "",
            isPublic: pl.isPublic !== false,
            type: pl.type || (pl.youtubePlaylistId ? "youtube" : "native"),
            youtubePlaylistId: pl.youtubePlaylistId || "",
            trackIds: pl.trackIds || [],
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, plPath);
      }
    }

    // 3. Sync Tracks into Catalog
    if (user.library && user.library.length > 0) {
      for (const t of user.library) {
        if (!t.id || !t.youtubeId) continue;
        const trackPath = `tracks/${t.id}`;
        try {
          await setDoc(
            doc(db, "tracks", t.id),
            {
              id: t.id,
              youtubeId: t.youtubeId,
              title: t.title,
              artist: t.artist,
              album: t.album || "YouTube",
              cover: t.cover || `https://img.youtube.com/vi/${t.youtubeId}/hqdefault.jpg`,
              duration: t.duration || 0,
              url: t.url || `https://www.youtube.com/watch?v=${t.youtubeId}`,
            },
            { merge: true }
          );
        } catch (err) {
          // Tracks catalog write is best-effort
          console.warn(`Track write failed for ${trackPath}:`, err);
        }
      }
    }

    return true;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, userPath);
  }
}

export async function fetchUserProfileFromFirestore(userId: string): Promise<UserAccount | null> {
  if (!userId || !auth.currentUser || auth.currentUser.uid !== userId) {
    return null;
  }
  const userPath = `users/${userId}`;
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) return null;
    const userData = userDoc.data();

    // Fetch user playlists
    const playlistsQuery = query(
      collection(db, "playlists"),
      where("ownerId", "==", userId)
    );
    const plSnap = await getDocs(playlistsQuery);
    const playlists: Playlist[] = plSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: data.id || d.id,
        name: data.name,
        description: data.description,
        cover: data.cover,
        isPublic: data.isPublic !== false,
        type: data.type || "native",
        youtubePlaylistId: data.youtubePlaylistId,
        trackIds: data.trackIds || [],
      };
    });

    // Fetch tracks for all playlists
    const allTrackIds = Array.from(new Set(playlists.flatMap((p) => p.trackIds)));
    const library: Track[] = [];

    for (const tid of allTrackIds) {
      try {
        const tDoc = await getDoc(doc(db, "tracks", tid));
        if (tDoc.exists()) {
          const tData = tDoc.data();
          library.push({
            id: tData.id || tid,
            youtubeId: tData.youtubeId,
            title: tData.title,
            artist: tData.artist,
            album: tData.album || "YouTube",
            cover: tData.cover || `https://img.youtube.com/vi/${tData.youtubeId}/hqdefault.jpg`,
            duration: tData.duration || 0,
            url: tData.url || `https://www.youtube.com/watch?v=${tData.youtubeId}`,
            provider: "youtube",
            providerId: tData.youtubeId,
            sourceUrl: tData.url || `https://www.youtube.com/watch?v=${tData.youtubeId}`,
          });
        }
      } catch (err) {
        console.warn(`Could not fetch track ${tid}:`, err);
      }
    }

    return {
      id: userId,
      username: userData.username,
      displayName: userData.displayName || userData.username,
      avatar: userData.avatar,
      bio: userData.bio || "",
      background: userData.background || { kind: "preset", value: "#0b0b12" },
      volume: typeof userData.volume === "number" ? userData.volume : 80,
      playlists,
      library,
      createdAt: userData.createdAt ? new Date(userData.createdAt).getTime() : Date.now(),
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, userPath);
  }
}

export async function fetchPublicProfileFromFirestore(cleanUsername: string): Promise<PublicProfile | null> {
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("username", "==", cleanUsername));

  try {
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const userDoc = snap.docs[0];
    const userData = userDoc.data();
    const userId = userData.id || userDoc.id;

    // Fetch public playlists
    const plQuery = query(
      collection(db, "playlists"),
      where("ownerId", "==", userId),
      where("isPublic", "==", true)
    );
    const plSnap = await getDocs(plQuery);
    const publicPlaylists = [];

    for (const d of plSnap.docs) {
      const plData = d.data();
      const trackIds: string[] = plData.trackIds || [];
      const tracks: Track[] = [];

      for (const tid of trackIds) {
        try {
          const tDoc = await getDoc(doc(db, "tracks", tid));
          if (tDoc.exists()) {
            const tData = tDoc.data();
            tracks.push({
              id: tData.id || tid,
              youtubeId: tData.youtubeId,
              title: tData.title,
              artist: tData.artist,
              album: tData.album || "YouTube",
              cover: tData.cover || `https://img.youtube.com/vi/${tData.youtubeId}/hqdefault.jpg`,
              duration: tData.duration || 0,
              url: tData.url || `https://www.youtube.com/watch?v=${tData.youtubeId}`,
            });
          }
        } catch {
          // ignore single track error
        }
      }

      publicPlaylists.push({
        id: plData.id || d.id,
        name: plData.name,
        description: plData.description || "",
        cover: plData.cover || tracks[0]?.cover,
        trackCount: tracks.length,
        tracks,
      });
    }

    return {
      id: userId,
      username: userData.username,
      displayName: userData.displayName || userData.username,
      avatar: userData.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`,
      bio: userData.bio || "",
      starCount: 0,
      isStarred: false,
      playlists: publicPlaylists,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, "users");
  }
}
