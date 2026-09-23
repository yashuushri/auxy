import { NextResponse } from "next/server";
import { syncAndFetchAllBackgrounds } from "@/lib/server-backgrounds";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const backgrounds = await syncAndFetchAllBackgrounds();

    return NextResponse.json(
      {
        success: true,
        backgrounds: backgrounds || [],
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  } catch (err) {
    console.error("Failed to fetch backgrounds:", err);
    return NextResponse.json(
      { success: true, backgrounds: [] },
      { status: 200 }
    );
  }
}

