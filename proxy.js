import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { homePathForEmail, isAdminEmail } from "@/lib/auth/roles";

export async function proxy(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  function redirectTo(path) {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  const isPanelArea = pathname === "/panel" || pathname.startsWith("/panel/");
  const isKayit = pathname === "/kayit" || pathname.startsWith("/kayit/");
  const isGiris = pathname === "/giris" || pathname === "/login";

  if (!user && (isAdminArea || isPanelArea)) {
    return redirectTo("/giris");
  }

  if (!user && pathname === "/login") {
    return redirectTo("/giris");
  }

  if (user && isGiris) {
    return redirectTo(homePathForEmail(user.email));
  }

  if (user && isKayit && isAdminEmail(user.email)) {
    return redirectTo("/admin");
  }

  if (user && isAdminArea && !isAdminEmail(user.email)) {
    return redirectTo("/panel");
  }

  if (user && isPanelArea && isAdminEmail(user.email)) {
    return redirectTo("/admin");
  }

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/panel/:path*",
    "/giris",
    "/login",
    "/kayit",
    "/kayit/:path*",
  ],
};
