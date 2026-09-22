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
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
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

