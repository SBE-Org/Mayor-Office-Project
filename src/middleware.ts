import { NextResponse, type NextRequest } from "next/server";

// Lightweight gate: real session validation happens server-side in requireActor().
export function middleware(req: NextRequest) {
  if (!req.cookies.get("smo_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = { matcher: ["/portal/:path*", "/staff/:path*"] };
