import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED = [
  "/", "/leads", "/orders", "/revenue", "/invoices",
  "/buyers", "/shipments", "/documents", "/calculator",
  "/suppliers", "/emails",
];

function isProtected(pathname: string): boolean {
  if (PROTECTED.includes(pathname)) return true;
  return PROTECTED.some(r => r !== "/" && pathname.startsWith(r + "/"));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── DEV bypass: skip auth so you can build without Supabase Auth set up ──────
  // Remove this block (or set ENABLE_AUTH=true in .env.local) before going live.
  if (process.env.ENABLE_AUTH !== "true") {
    return NextResponse.next();
  }

  // Always allow public routes
  if (
    pathname.startsWith("/portal") ||
    pathname.startsWith("/api/")   ||
    pathname.startsWith("/_next/") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (!isProtected(pathname)) {
    return NextResponse.next();
  }

  let res = NextResponse.next({ request: req });

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: ()      => req.cookies.getAll(),
          setAll: (toSet) => {
            toSet.forEach(({ name, value }) => req.cookies.set(name, value));
            res = NextResponse.next({ request: req });
            toSet.forEach(({ name, value, options }) =>
              res.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      const url = req.nextUrl.clone();
      url.pathname = "/portal";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
  } catch (err) {
    console.error("[middleware] auth check failed:", err);
    const url = req.nextUrl.clone();
    url.pathname = "/portal";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
