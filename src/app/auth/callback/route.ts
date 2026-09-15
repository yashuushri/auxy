import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const next = searchParams.get("next") || "/";
  return NextResponse.redirect(`${origin}${next}`);
}
