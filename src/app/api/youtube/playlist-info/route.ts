import { NextRequest, NextResponse } from "next/server";
import { cleanYouTubeTitle, generatePlaylistNameFromSong, getPrimaryArtist, parseYouTubeUrl } from "@/lib/youtube";

export const dynamic = "force-dynamic";

interface ExtractedTrack {
  videoId: string;
  title: string;
  artist: string;
  duration: number;
  cover: string;
}

function extractTracksAndContinuation(node: unknown): {
  tracks: ExtractedTrack[];
  nextContinuationToken?: string;
  playlistTitle?: string;
} {
  const tracks: ExtractedTrack[] = [];
  const seenIds = new Set<string>();
  let nextContinuationToken: string | undefined;
  let playlistTitle: string | undefined;

  const traverse = (obj: unknown) => {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      for (const item of obj) traverse(item);
      return;
    }

    const rec = obj as Record<string, unknown>;

    // Extract playlist title if available
    if (!playlistTitle && rec.playlistHeaderRenderer) {
      const phr = rec.playlistHeaderRenderer as Record<string, unknown>;
      const titleObj = phr.title as { simpleText?: string; runs?: Array<{ text?: string }> } | undefined;
      playlistTitle = titleObj?.simpleText || titleObj?.runs?.[0]?.text;
    }
    if (!playlistTitle && rec.header) {
      const h = rec.header as Record<string, unknown>;
      const titleObj = (h.playlistHeaderRenderer || h.musicPlaylistHeaderRenderer) as Record<string, unknown> | undefined;
      if (titleObj?.title) {
        const t = titleObj.title as { simpleText?: string; runs?: Array<{ text?: string }> };
        playlistTitle = t?.simpleText || t?.runs?.[0]?.text;
      }
    }
    if (!playlistTitle && rec.microformatDataRenderer) {
      const md = rec.microformatDataRenderer as Record<string, unknown>;
      if (typeof md.title === "string") playlistTitle = md.title;
    }

    // 1. Standard YouTube playlist video renderer
    if (rec.playlistVideoRenderer) {
      const pvr = rec.playlistVideoRenderer as Record<string, unknown>;
      const vid = pvr.videoId as string | undefined;

      if (vid && /^[A-Za-z0-9_-]{11}$/.test(vid) && !seenIds.has(vid)) {
        seenIds.add(vid);

        const titleObj = pvr.title as { runs?: Array<{ text?: string }>; simpleText?: string } | undefined;
        const rawVideoTitle = titleObj?.runs?.[0]?.text || titleObj?.simpleText || "";

        const bylineObj = pvr.shortBylineText as { runs?: Array<{ text?: string }>; simpleText?: string } | undefined;
        const rawArtist = bylineObj?.runs?.[0]?.text || bylineObj?.simpleText || "YouTube";

        const lengthSecStr = pvr.lengthSeconds as string | undefined;
        const duration = lengthSecStr ? parseInt(lengthSecStr, 10) || 0 : 0;

        const { title: cleanT, artist: cleanA } = rawVideoTitle
          ? cleanYouTubeTitle(rawVideoTitle)
          : { title: `Track ${tracks.length + 1}`, artist: rawArtist };

        const finalArtist = cleanA && cleanA !== "YouTube" ? cleanA : getPrimaryArtist(rawArtist);

        tracks.push({
          videoId: vid,
          title: cleanT || rawVideoTitle || `Track ${tracks.length + 1}`,
          artist: finalArtist || "YouTube",
          duration,
          cover: `https://img.youtube.com/vi/${vid}/hqdefault.jpg`,
        });
      }
    }

    // 2. Modern YouTube Lockup View Model (used in newest YouTube Web UI)
    if (rec.lockupViewModel) {
      const l = rec.lockupViewModel as Record<string, unknown>;
      const vid = l.contentId as string | undefined;

      if (vid && /^[A-Za-z0-9_-]{11}$/.test(vid) && !seenIds.has(vid)) {
        seenIds.add(vid);

        const metadata = l.metadata as Record<string, unknown> | undefined;
        const lockupMeta = metadata?.lockupMetadataViewModel as Record<string, unknown> | undefined;
        const titleObj = lockupMeta?.title as { content?: string } | undefined;
        const rawVideoTitle = titleObj?.content || "";

        let rawArtist = "YouTube";
        const contentMeta = lockupMeta?.metadata as Record<string, unknown> | undefined;
        const cmvm = contentMeta?.contentMetadataViewModel as Record<string, unknown> | undefined;
        const metadataRows = cmvm?.metadataRows as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(metadataRows) && metadataRows.length > 0) {
          const parts = metadataRows[0]?.metadataParts as Array<Record<string, unknown>> | undefined;
          if (Array.isArray(parts) && parts.length > 0) {
            const textObj = parts[0]?.text as { content?: string } | undefined;
            if (textObj?.content) rawArtist = textObj.content;
          }
        }

        const { title: cleanT, artist: cleanA } = rawVideoTitle
          ? cleanYouTubeTitle(rawVideoTitle)
          : { title: `Track ${tracks.length + 1}`, artist: rawArtist };

        const finalArtist = cleanA && cleanA !== "YouTube" ? cleanA : getPrimaryArtist(rawArtist);

        tracks.push({
          videoId: vid,
          title: cleanT || rawVideoTitle || `Track ${tracks.length + 1}`,
          artist: finalArtist || "YouTube",
          duration: 0,
          cover: `https://img.youtube.com/vi/${vid}/hqdefault.jpg`,
        });
      }
    }

    // 3. Compact video renderer
    if (rec.compactVideoRenderer) {
      const cvr = rec.compactVideoRenderer as Record<string, unknown>;
      const vid = cvr.videoId as string | undefined;

      if (vid && /^[A-Za-z0-9_-]{11}$/.test(vid) && !seenIds.has(vid)) {
        seenIds.add(vid);

        const titleObj = cvr.title as { runs?: Array<{ text?: string }>; simpleText?: string } | undefined;
        const rawVideoTitle = titleObj?.runs?.[0]?.text || titleObj?.simpleText || "";

        const bylineObj = (cvr.shortBylineText || cvr.longBylineText) as { runs?: Array<{ text?: string }>; simpleText?: string } | undefined;
        const rawArtist = bylineObj?.runs?.[0]?.text || bylineObj?.simpleText || "YouTube";

        const lengthSecStr = cvr.lengthText as { runs?: Array<{ text?: string }>; simpleText?: string } | undefined;
        const lengthText = lengthSecStr?.simpleText || lengthSecStr?.runs?.[0]?.text || "";
        let duration = 0;
        if (lengthText) {
          const parts = lengthText.split(":").map((p) => parseInt(p, 10) || 0);
          if (parts.length === 2) duration = parts[0] * 60 + parts[1];
          else if (parts.length === 3) duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
        }

        const { title: cleanT, artist: cleanA } = rawVideoTitle
          ? cleanYouTubeTitle(rawVideoTitle)
          : { title: `Track ${tracks.length + 1}`, artist: rawArtist };

        tracks.push({
          videoId: vid,
          title: cleanT || rawVideoTitle || `Track ${tracks.length + 1}`,
          artist: cleanA || getPrimaryArtist(rawArtist),
          duration,
          cover: `https://img.youtube.com/vi/${vid}/hqdefault.jpg`,
        });
      }
    }

    // 4. Playlist panel video renderer (used in YouTube Mixes, Radios, and watch playlists)
    if (rec.playlistPanelVideoRenderer) {
      const ppvr = rec.playlistPanelVideoRenderer as Record<string, unknown>;
      const vid = ppvr.videoId as string | undefined;

      if (vid && /^[A-Za-z0-9_-]{11}$/.test(vid) && !seenIds.has(vid)) {
        seenIds.add(vid);

        const titleObj = ppvr.title as { runs?: Array<{ text?: string }>; simpleText?: string } | undefined;
        const rawVideoTitle = titleObj?.runs?.[0]?.text || titleObj?.simpleText || "";

        const bylineObj = (ppvr.shortBylineText || ppvr.longBylineText) as { runs?: Array<{ text?: string }>; simpleText?: string } | undefined;
        const rawArtist = bylineObj?.runs?.[0]?.text || bylineObj?.simpleText || "YouTube";

        const lengthSecStr = ppvr.lengthText as { runs?: Array<{ text?: string }>; simpleText?: string } | undefined;
        const lengthText = lengthSecStr?.simpleText || lengthSecStr?.runs?.[0]?.text || "";
        let duration = 0;
        if (lengthText) {
          const parts = lengthText.split(":").map((p) => parseInt(p, 10) || 0);
          if (parts.length === 2) duration = parts[0] * 60 + parts[1];
          else if (parts.length === 3) duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
        }

        const { title: cleanT, artist: cleanA } = rawVideoTitle
          ? cleanYouTubeTitle(rawVideoTitle)
          : { title: `Track ${tracks.length + 1}`, artist: rawArtist };

        tracks.push({
          videoId: vid,
          title: cleanT || rawVideoTitle || `Track ${tracks.length + 1}`,
          artist: cleanA || getPrimaryArtist(rawArtist),
          duration,
          cover: `https://img.youtube.com/vi/${vid}/hqdefault.jpg`,
        });
      }
    }

    // 5. Music YouTube list item renderer (for music.youtube.com playlists)
    if (rec.musicResponsiveListItemRenderer) {
      const mrli = rec.musicResponsiveListItemRenderer as Record<string, unknown>;
      const navEndpoint = mrli.navigationEndpoint as Record<string, unknown> | undefined;
      const watchEndpoint = (navEndpoint?.watchEndpoint || mrli.playlistItemData) as Record<string, unknown> | undefined;
      const vid = watchEndpoint?.videoId as string | undefined;

      if (vid && /^[A-Za-z0-9_-]{11}$/.test(vid) && !seenIds.has(vid)) {
        seenIds.add(vid);

        let rawTitle = "";
        let rawArtist = "YouTube";
        const flexColumns = mrli.flexColumns as Array<Record<string, unknown>> | undefined;
        if (Array.isArray(flexColumns) && flexColumns.length > 0) {
          const col0 = flexColumns[0]?.musicResponsiveListItemFlexColumnRenderer as Record<string, unknown> | undefined;
          const text0 = col0?.text as { runs?: Array<{ text?: string }> } | undefined;
          rawTitle = text0?.runs?.[0]?.text || "";

          if (flexColumns.length > 1) {
            const col1 = flexColumns[1]?.musicResponsiveListItemFlexColumnRenderer as Record<string, unknown> | undefined;
            const text1 = col1?.text as { runs?: Array<{ text?: string }> } | undefined;
            rawArtist = text1?.runs?.[0]?.text || "YouTube";
          }
        }

        const { title: cleanT, artist: cleanA } = rawTitle
          ? cleanYouTubeTitle(rawTitle)
          : { title: `Track ${tracks.length + 1}`, artist: rawArtist };

        tracks.push({
          videoId: vid,
          title: cleanT || rawTitle || `Track ${tracks.length + 1}`,
          artist: cleanA || getPrimaryArtist(rawArtist),
          duration: 0,
          cover: `https://img.youtube.com/vi/${vid}/hqdefault.jpg`,
        });
      }
    }

    // Continuation token for loading subsequent batches of tracks
    if (!nextContinuationToken && rec.continuationItemRenderer) {
      const cir = rec.continuationItemRenderer as Record<string, unknown>;
      const endpoint = cir.continuationEndpoint as Record<string, unknown> | undefined;
      const cmd = endpoint?.continuationCommand as Record<string, unknown> | undefined;
      if (cmd?.token && typeof cmd.token === "string") {
        nextContinuationToken = cmd.token;
      }
    }

    for (const key of Object.keys(rec)) {
      if (key === "responseContext" || key === "trackingParams" || key === "frameworkUpdates") continue;
      traverse(rec[key]);
    }
  };

  traverse(node);
  return { tracks, nextContinuationToken, playlistTitle };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawInput =
      searchParams.get("url") || searchParams.get("playlistId") || searchParams.get("input") || "";

    if (!rawInput.trim()) {
      return NextResponse.json({ ok: false, error: "Missing playlist URL or ID" }, { status: 400 });
    }

    const trimmedInput = rawInput.trim();
    const parsed = parseYouTubeUrl(trimmedInput);

    let playlistId = "";
    let singleVideoId = "";

    if (parsed.type === "playlist") {
      playlistId = parsed.playlistId;
      singleVideoId = parsed.videoId || "";
    } else if (parsed.type === "video") {
      singleVideoId = parsed.videoId;
    } else {
      // Manual regex fallback on raw input
      const listMatch = trimmedInput.match(/[?&]list=([A-Za-z0-9_-]+)/);
      const vMatch = trimmedInput.match(
        /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{11})/
      );
      if (listMatch) {
        playlistId = listMatch[1];
        singleVideoId = vMatch?.[1] || "";
      } else if (vMatch) {
        singleVideoId = vMatch[1];
      } else if (/^[A-Za-z0-9_-]{11}$/.test(trimmedInput)) {
        singleVideoId = trimmedInput;
      } else if (/^[A-Za-z0-9_-]{10,}$/.test(trimmedInput)) {
        playlistId = trimmedInput;
      }
    }

    let playlistTitle = "";
    const allTracks: ExtractedTrack[] = [];
    const seenVideoIds = new Set<string>();

    const appendUniqueTracks = (newItems: ExtractedTrack[]) => {
      for (const t of newItems) {
        if (!seenVideoIds.has(t.videoId)) {
          seenVideoIds.add(t.videoId);
          allTracks.push(t);
        }
      }
    };

    // --- Strategy 1: If Mix (RD...) or watch URL, try Innertube Next API first ---
    if (playlistId && (playlistId.startsWith("RD") || singleVideoId)) {
      try {
        const nextBody: Record<string, unknown> = {
          context: {
            client: {
              clientName: "WEB",
              clientVersion: "2.20240101.00.00",
              hl: "en",
              gl: "US",
            },
          },
          playlistId,
        };
        if (singleVideoId) nextBody.videoId = singleVideoId;

        const nextRes = await fetch("https://www.youtube.com/youtubei/v1/next?prettyPrint=false", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "X-YouTube-Client-Name": "1",
            "X-YouTube-Client-Version": "2.20240101.00.00",
          },
          body: JSON.stringify(nextBody),
          cache: "no-store",
        });

        if (nextRes.ok) {
          const data = await nextRes.json();
          const pNext = extractTracksAndContinuation(data);
          appendUniqueTracks(pNext.tracks);
          if (pNext.playlistTitle) playlistTitle = pNext.playlistTitle;

          // Continuation for mix panels if available
          let continuationToken = pNext.nextContinuationToken;
          let pageCount = 1;
          while (continuationToken && pageCount < 10) {
            pageCount++;
            try {
              const contRes = await fetch("https://www.youtube.com/youtubei/v1/next?prettyPrint=false", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                  "X-YouTube-Client-Name": "1",
                  "X-YouTube-Client-Version": "2.20240101.00.00",
                },
                body: JSON.stringify({
                  context: {
                    client: {
                      clientName: "WEB",
                      clientVersion: "2.20240101.00.00",
                      hl: "en",
                      gl: "US",
                    },
                  },
                  continuation: continuationToken,
                }),
                cache: "no-store",
              });
              if (contRes.ok) {
                const contData = await contRes.json();
                const pCont = extractTracksAndContinuation(contData);
                appendUniqueTracks(pCont.tracks);
                continuationToken = pCont.nextContinuationToken;
                if (!pCont.tracks.length) break;
              } else {
                break;
              }
            } catch {
              break;
            }
          }
        }
      } catch (mixErr) {
        console.warn("[Playlist Info API] Innertube Next fetch failed:", mixErr);
      }
    }

    // --- Strategy 2: Innertube Browse API with full pagination (For standard playlists) ---
    if (playlistId) {
      try {
        const browseId = playlistId.startsWith("VL") ? playlistId : `VL${playlistId}`;
        
        // Page 1
        const innertubeRes = await fetch("https://www.youtube.com/youtubei/v1/browse?prettyPrint=false", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "X-YouTube-Client-Name": "1",
            "X-YouTube-Client-Version": "2.20240101.00.00",
          },
          body: JSON.stringify({
            context: {
              client: {
                clientName: "WEB",
                clientVersion: "2.20240101.00.00",
                hl: "en",
                gl: "US",
              },
            },
            browseId,
          }),
          cache: "no-store",
        });

        if (innertubeRes.ok) {
          const data = await innertubeRes.json();
          const p1 = extractTracksAndContinuation(data);
          appendUniqueTracks(p1.tracks);
          if (p1.playlistTitle && !playlistTitle) playlistTitle = p1.playlistTitle;

          let continuationToken = p1.nextContinuationToken;
          let pageCount = 1;

          // Fetch continuation pages (up to 20 pages = 2000 tracks)
          while (continuationToken && pageCount < 20) {
            pageCount++;
            try {
              const contRes = await fetch("https://www.youtube.com/youtubei/v1/browse?prettyPrint=false", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                  "X-YouTube-Client-Name": "1",
                  "X-YouTube-Client-Version": "2.20240101.00.00",
                },
                body: JSON.stringify({
                  context: {
                    client: {
                      clientName: "WEB",
                      clientVersion: "2.20240101.00.00",
                      hl: "en",
                      gl: "US",
                    },
                  },
                  continuation: continuationToken,
                }),
                cache: "no-store",
              });

              if (contRes.ok) {
                const contData = await contRes.json();
                const pNext = extractTracksAndContinuation(contData);
                const prevCount = allTracks.length;
                appendUniqueTracks(pNext.tracks);
                continuationToken = pNext.nextContinuationToken;
                if (allTracks.length === prevCount) break;
              } else {
                break;
              }
            } catch (contErr) {
              console.warn("[Playlist Info API] Continuation fetch failed:", contErr);
              break;
            }
          }
        }
      } catch (innertubeErr) {
        console.warn("[Playlist Info API] Innertube Strategy failed:", innertubeErr);
      }
    }

    // --- Strategy 2b: Complement with Next API if we have at least one track or playlistId ---
    if (playlistId && allTracks.length > 0) {
      try {
        const firstVid = allTracks[0]?.videoId;
        const nextBody: Record<string, unknown> = {
          context: {
            client: {
              clientName: "WEB",
              clientVersion: "2.20240101.00.00",
              hl: "en",
              gl: "US",
            },
          },
          playlistId,
        };
        if (firstVid) nextBody.videoId = firstVid;

        const nextRes = await fetch("https://www.youtube.com/youtubei/v1/next?prettyPrint=false", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "X-YouTube-Client-Name": "1",
            "X-YouTube-Client-Version": "2.20240101.00.00",
          },
          body: JSON.stringify(nextBody),
          cache: "no-store",
        });

        if (nextRes.ok) {
          const data = await nextRes.json();
          const pNext = extractTracksAndContinuation(data);
          appendUniqueTracks(pNext.tracks);
          if (pNext.playlistTitle && !playlistTitle) playlistTitle = pNext.playlistTitle;
        }
      } catch (compErr) {
        console.warn("[Playlist Info API] Complementary Next API fetch failed:", compErr);
      }
    }

    // --- Strategy 3: HTML Scraping with GDPR/Consent Bypass & Continuation ---
    if (playlistId && allTracks.length === 0) {
      try {
        const targetUrl =
          playlistId.startsWith("RD") && singleVideoId
            ? `https://www.youtube.com/watch?v=${singleVideoId}&list=${playlistId}`
            : `https://www.youtube.com/playlist?list=${playlistId}`;

        const pageRes = await fetch(targetUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            Cookie: "SOCS=CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg; CONSENT=YES+cb.20210328-17-p0.en+FX+478",
          },
          cache: "no-store",
        });

        if (pageRes.ok) {
          const html = await pageRes.text();

          const titleMatch = html.match(/<title>(.*?)<\/title>/);
          if (titleMatch && titleMatch[1]) {
            const rawTitle = titleMatch[1].replace(/- YouTube$/i, "").trim();
            if (rawTitle && !rawTitle.toLowerCase().includes("error 404") && !rawTitle.toLowerCase().includes("not found")) {
              if (!playlistTitle) playlistTitle = rawTitle;
            }
          }

          // Try parsing ytInitialData for complete song details
          const initMatch =
            html.match(/var ytInitialData\s*=\s*({.+?});<\/script>/) ||
            html.match(/window\["ytInitialData"\]\s*=\s*({.+?});/);

          if (initMatch && initMatch[1]) {
            try {
              const initJson = JSON.parse(initMatch[1]);
              const p = extractTracksAndContinuation(initJson);
              appendUniqueTracks(p.tracks);
              if (p.playlistTitle && !playlistTitle) playlistTitle = p.playlistTitle;

              // If there is a continuation token from HTML, fetch remaining tracks
              let continuationToken = p.nextContinuationToken;
              let pageCount = 1;

              while (continuationToken && pageCount < 10) {
                pageCount++;
                try {
                  const contRes = await fetch("https://www.youtube.com/youtubei/v1/browse?prettyPrint=false", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                    },
                    body: JSON.stringify({
                      context: {
                        client: {
                          clientName: "WEB",
                          clientVersion: "2.20240101.00.00",
                          hl: "en",
                          gl: "US",
                        },
                      },
                      continuation: continuationToken,
                    }),
                    cache: "no-store",
                  });

                  if (contRes.ok) {
                    const contData = await contRes.json();
                    const pNext = extractTracksAndContinuation(contData);
                    appendUniqueTracks(pNext.tracks);
                    continuationToken = pNext.nextContinuationToken;
                    if (!pNext.tracks.length) break;
                  } else {
                    break;
                  }
                } catch {
                  break;
                }
              }
            } catch (err) {
              console.warn("[Playlist Info API] JSON parse initMatch failed:", err);
            }
          }

          // Regex fallback on HTML
          if (allTracks.length === 0) {
            const rawMatches = Array.from(html.matchAll(/"videoId":"([A-Za-z0-9_-]{11})"/g)).map((m) => m[1]);
            for (const vid of rawMatches) {
              if (!seenVideoIds.has(vid)) {
                seenVideoIds.add(vid);
                allTracks.push({
                  videoId: vid,
                  title: `Track ${allTracks.length + 1}`,
                  artist: "YouTube",
                  duration: 0,
                  cover: `https://img.youtube.com/vi/${vid}/hqdefault.jpg`,
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn("[Playlist Info API] HTML fetch failed:", err);
      }
    }

    // --- Strategy 4: YouTube RSS Feed fallback ---
    if (playlistId && allTracks.length === 0) {
      try {
        const rssRes = await fetch(`https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`, {
          cache: "no-store",
        });
        if (rssRes.ok) {
          const xml = await rssRes.text();
          const rssTitleMatch = xml.match(/<title>([^<]+)<\/title>/);
          if (rssTitleMatch && rssTitleMatch[1] && !playlistTitle) {
            playlistTitle = rssTitleMatch[1].trim();
          }
          const matches = Array.from(xml.matchAll(/<yt:videoId>([^<]+)<\/yt:videoId>/g)).map((m) => m[1]);
          for (const vid of matches) {
            if (/^[A-Za-z0-9_-]{11}$/.test(vid) && !seenVideoIds.has(vid)) {
              seenVideoIds.add(vid);
              allTracks.push({
                videoId: vid,
                title: `Track ${allTracks.length + 1}`,
                artist: "YouTube",
                duration: 0,
                cover: `https://img.youtube.com/vi/${vid}/hqdefault.jpg`,
              });
            }
          }
        }
      } catch (err) {
        console.warn("[Playlist Info API] RSS fetch failed:", err);
      }
    }

    // --- Strategy 5: Fallback to Single Video ID if input was a single video ---
    if (allTracks.length === 0 && singleVideoId && /^[A-Za-z0-9_-]{11}$/.test(singleVideoId)) {
      seenVideoIds.add(singleVideoId);
      allTracks.push({
        videoId: singleVideoId,
        title: `Track 1`,
        artist: "YouTube",
        duration: 0,
        cover: `https://img.youtube.com/vi/${singleVideoId}/hqdefault.jpg`,
      });
    }

    if (allTracks.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No playable tracks found in this YouTube playlist. Please ensure the playlist is Public or Unlisted, or check the URL.",
          playlistId,
        },
        { status: 404 }
      );
    }

    const extractedVideoIds = allTracks.map((t) => t.videoId);

    // Fetch metadata for the first track to immediately name the playlist after the first song's first word
    let firstTrackTitle = allTracks[0]?.title || "";
    let firstTrackArtist = allTracks[0]?.artist || "YouTube";
    const firstVid = extractedVideoIds[0];

    if (!firstTrackTitle || firstTrackArtist === "YouTube" || firstTrackTitle.startsWith("Track ")) {
      try {
        const oembedRes = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${firstVid}&format=json`,
          { cache: "no-store" }
        );
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json();
          if (oembedData && oembedData.title) {
            const { title, artist } = cleanYouTubeTitle(oembedData.title);
            firstTrackTitle = title || oembedData.title;
            firstTrackArtist = getPrimaryArtist(artist === "YouTube" ? (oembedData.author_name || "YouTube") : artist);
            allTracks[0].title = firstTrackTitle;
            allTracks[0].artist = firstTrackArtist;
          }
        }
      } catch {
        // Fallback
      }
    }

    const suggestedPlaylistName = firstTrackTitle ? generatePlaylistNameFromSong(firstTrackTitle) : "";

    // If playlist title is missing or generic, use the suggested name from the first song's first word
    const isGenericTitle =
      !playlistTitle ||
      playlistTitle.toLowerCase().includes("undefined") ||
      playlistTitle.toLowerCase().includes("unknown") ||
      playlistTitle.toLowerCase().includes("youtube playlist") ||
      playlistTitle.toLowerCase().includes("error 404");

    const finalTitle = isGenericTitle
      ? (suggestedPlaylistName || "My Playlist")
      : playlistTitle;

    // Cap playlist tracks to maximum 100 as per specification
    const cappedTracks = allTracks.slice(0, 100);
    const cappedVideoIds = extractedVideoIds.slice(0, 100);

    return NextResponse.json({
      ok: true,
      playlistId: playlistId || `single-${firstVid}`,
      title: finalTitle,
      suggestedPlaylistName: suggestedPlaylistName || finalTitle,
      firstTrack: {
        videoId: firstVid,
        title: firstTrackTitle || `Track 1`,
        artist: firstTrackArtist,
        cover: `https://img.youtube.com/vi/${firstVid}/hqdefault.jpg`,
      },
      tracks: cappedTracks,
      videoIds: cappedVideoIds,
      count: cappedTracks.length,
    });
  } catch (err) {
    console.error("[Playlist Info API] Error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
