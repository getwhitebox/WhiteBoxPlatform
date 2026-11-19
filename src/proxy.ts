// =============================================================================
// Runs before every page request:
//   1. keeps the login session fresh (Supabase tokens expire hourly)
//   2. sends anyone who isn't logged in to the login page
//
// This is a first, fast check only. Every page also checks the login itself
// (src/lib/session.ts), and the database enforces the company walls.
// =============================================================================
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { checkSupabaseConfig, configProblemPage } from "@/lib/config";

// Pages anyone can open without logging in.
const PUBLIC_PATHS = ["/login", "/forgot-password", "/auth"];

export async function proxy(request: NextRequest) {
  // If a required setting is missing or malformed, say which one (by name).
  const problems = checkSupabaseConfig();
  if (problems.length > 0) {
    console.error("Configuration problems:", problems);
    return new NextResponse(configProblemPage(problems), {
      status: 503,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Verifies the login and refreshes it if needed. Must run before anything else.
  const { data } = await supabase.auth.getClaims();
  const loggedIn = Boolean(data?.claims?.sub);

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (!loggedIn && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on every page except static files and images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
