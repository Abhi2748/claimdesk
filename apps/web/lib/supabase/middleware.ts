import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/signup/check-email";
  const isMfaRoute = pathname === "/mfa";
  const isProtectedRoute =
    pathname.startsWith("/cases") ||
    pathname.startsWith("/lab") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/review") ||
    isMfaRoute;

  let needsMfa = false;
  if (user) {
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    needsMfa = aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2";
  }

  if (!user && isProtectedRoute && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && needsMfa && !isMfaRoute && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/mfa";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = needsMfa ? "/mfa" : "/cases";
    return NextResponse.redirect(url);
  }

  if (user && !needsMfa && isMfaRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/cases";
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/cases";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
