import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Hit = {
  id: string;
  duration?: number;
  title?: string;
};

function pickBest(hits: Hit[]) {
  const usable = hits.filter((hit) => hit.id && hit.id.length === 11);
  const full = usable.filter((hit) => !hit.duration || hit.duration >= 90);
  return full[0] ?? usable[0] ?? null;
}

async function fromPiped(query: string): Promise<Hit[]> {
  const hosts = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.reallyaweso.me",
  ];
  for (const host of hosts) {
    try {
      const res = await fetch(
        `${host}/search?q=${encodeURIComponent(query)}&filter=videos`,
        { headers: { Accept: "application/json" }, cache: "no-store" }
      );
      if (!res.ok) continue;
      const data = (await res.json()) as {
        items?: Array<{ url?: string; duration?: number; title?: string; type?: string }>;
      };
      const items = data.items ?? [];
      return items
        .filter((item) => item.type === "stream" || item.url?.includes("watch?v="))
        .map((item) => ({
          id: (item.url ?? "").replace("/watch?v=", "").slice(0, 11),
          duration: item.duration,
          title: item.title,
        }));
    } catch {
      /* try next host */
    }
  }
  return [];
}

async function fromInvidious(query: string): Promise<Hit[]> {
  const hosts = ["https://inv.nadeko.net", "https://invidious.nerdvpn.de"];
  for (const host of hosts) {
    try {
      const res = await fetch(
        `${host}/api/v1/search?q=${encodeURIComponent(query)}&type=video`,
        { headers: { Accept: "application/json" }, cache: "no-store" }
      );
      if (!res.ok) continue;
      const data = (await res.json()) as Array<{
        videoId?: string;
        lengthSeconds?: number;
        title?: string;
        type?: string;
      }>;
      if (!Array.isArray(data)) continue;
      return data
        .filter((item) => item.type === "video" || item.videoId)
        .map((item) => ({
          id: item.videoId ?? "",
          duration: item.lengthSeconds,
          title: item.title,
        }));
    } catch {
      /* try next host */
    }
  }
  return [];
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json({ youtubeId: null }, { status: 400 });
  }

  const searches = [
    `${query} official audio`,
    `${query} lyrics`,
    query,
  ];

  for (const term of searches) {
    const piped = await fromPiped(term);
    const best = pickBest(piped);
    if (best) return NextResponse.json({ youtubeId: best.id, duration: best.duration ?? null });
    const invidious = await fromInvidious(term);
    const backup = pickBest(invidious);
    if (backup) return NextResponse.json({ youtubeId: backup.id, duration: backup.duration ?? null });
  }

  return NextResponse.json({ youtubeId: null });
}
