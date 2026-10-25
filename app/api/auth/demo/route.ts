import { NextResponse } from "next/server";
import { DEMO_PROFILE_ID, DEMO_USER_COOKIE } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEMO_USER_COOKIE, DEMO_PROFILE_ID, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  return response;
}
