"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthCluster } from "@/components/layout/auth-cluster";
import { createClient } from "@/lib/supabase/client";

const NAV_LINKS = [
  { href: "/explore", label: "Explore", comingSoon: true },
  { href: "/planner", label: "Planner" },
] as const;

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  // Hide nav on auth and onboarding pages
  const hideOn = ["/auth", "/onboarding"];
  const shouldHide = hideOn.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (shouldHide) return;
    const supabase = createClient();

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!u) {
        setUser(null);
        return;
      }
      const name =
        (u.user_metadata?.full_name as string | undefined) ??
        (u.email ? u.email.split("@")[0] : "You");
      setUser({ name, email: u.email ?? "" });
    }

    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "USER_UPDATED" ||
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "TOKEN_REFRESHED"
      ) {
        loadUser();
      }
    });

    return () => subscription.unsubscribe();
  }, [shouldHide]);

  if (shouldHide) return null;

  async function handleLogOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 bg-hero border-b border-ink shadow-[0_3px_0_0_rgba(0,0,0,0.15)]">
      <div className="px-6 sm:px-8 lg:px-10 flex items-center justify-between py-[18px]">
        <Link href="/planner" className="font-display font-extrabold text-[24px] tracking-tight text-ink">
          kidtinerary
        </Link>

        <nav className="hidden sm:flex items-center gap-7">
          {NAV_LINKS.map(({ href, label, ...rest }) => {
            const comingSoon = "comingSoon" in rest ? rest.comingSoon : false;
            const isActive = pathname.startsWith(href);
            return (
              <span key={href} className="relative inline-block">
                <Link
                  href={href}
                  className={`font-sans text-[11px] uppercase tracking-widest text-ink py-1.5 ${
                    isActive ? "font-extrabold opacity-100" : "font-semibold opacity-55"
                  }`}
                >
                  {label}
                </Link>
                {comingSoon ? (
                  <span
                    className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-[calc(100%+2px)] px-1.5 py-0.5 rounded-[3px] border font-sans text-[8px] font-extrabold uppercase tracking-wider whitespace-nowrap"
                    style={{
                      color: "rgba(21,21,21,0.55)",
                      borderColor: "rgba(21,21,21,0.35)",
                      background: "rgba(255,255,255,0.25)",
                      letterSpacing: "0.1em",
                    }}
                  >
                    Coming soon!
                  </span>
                ) : null}
              </span>
            );
          })}
          <AuthCluster user={user} onLogOut={handleLogOut} />
        </nav>

        {/* Mobile nav — simplified, full-bleed at bottom */}
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-hero border-t border-ink flex justify-around py-2 z-40">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`font-sans text-[9px] uppercase tracking-wide text-ink px-3 py-1 ${
                  isActive ? "font-extrabold opacity-100" : "font-semibold opacity-55"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
