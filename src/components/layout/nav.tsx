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
  const [mobileOpen, setMobileOpen] = useState(false);

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

  // Close the mobile sheet on route change.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close on Escape.
  useEffect(() => {
    if (!mobileOpen) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mobileOpen]);

  if (shouldHide) return null;

  async function handleLogOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setMobileOpen(false);
    router.push("/");
    router.refresh();
  }

  const onPlannerPage = pathname === "/planner";

  return (
    <header className="sticky top-0 z-40 bg-hero border-b border-ink shadow-[0_3px_0_0_rgba(0,0,0,0.15)]">
      <div className="px-6 sm:px-8 lg:px-10 flex items-center justify-between py-[18px]">
        <Link href="/" className="font-display font-extrabold text-[24px] tracking-tight text-ink">
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

        <button
          type="button"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-sheet"
          onClick={() => setMobileOpen((v) => !v)}
          className="sm:hidden inline-flex items-center justify-center w-11 h-11 -mr-2 rounded-md text-ink"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            {mobileOpen ? (
              <>
                <line x1="5" y1="5" x2="19" y2="19" />
                <line x1="19" y1="5" x2="5" y2="19" />
              </>
            ) : (
              <>
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </>
            )}
          </svg>
        </button>
      </div>

      <div
        id="mobile-nav-sheet"
        className={`sm:hidden overflow-hidden transition-[max-height] duration-200 ease-out border-t border-ink/15 ${
          mobileOpen ? "max-h-[560px]" : "max-h-0 border-t-transparent"
        }`}
      >
        <div className="px-6 py-3">
          {NAV_LINKS.map(({ href, label, ...rest }) => {
            const comingSoon = "comingSoon" in rest ? rest.comingSoon : false;
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center justify-between min-h-[48px] py-2 font-sans text-[13px] uppercase tracking-widest text-ink ${
                  isActive ? "font-extrabold" : "font-semibold opacity-70"
                }`}
              >
                <span>{label}</span>
                {comingSoon ? (
                  <span
                    className="font-sans text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-[3px] border"
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
              </Link>
            );
          })}

          <div className="mt-2 pt-3 border-t border-dashed border-ink/25">
            {user ? (
              <>
                <div className="pb-2">
                  <p className="font-display font-extrabold text-sm text-ink leading-tight truncate">{user.name}</p>
                  <p className="font-sans text-[11px] font-medium text-ink-2 truncate">{user.email}</p>
                </div>
                <Link
                  href="/account/profile"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center min-h-[48px] py-2 font-sans text-[13px] font-medium text-ink"
                >
                  Edit profile
                </Link>
                <Link
                  href="/kids"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center min-h-[48px] py-2 font-sans text-[13px] font-medium text-ink"
                >
                  My kids
                </Link>
                <Link
                  href="/account/planners"
                  onClick={(e) => {
                    if (onPlannerPage) {
                      e.preventDefault();
                      setMobileOpen(false);
                      window.location.href = "/account/planners";
                      return;
                    }
                    setMobileOpen(false);
                  }}
                  className="flex items-center min-h-[48px] py-2 font-sans text-[13px] font-medium text-ink"
                >
                  My planners
                </Link>
                <button
                  type="button"
                  onClick={handleLogOut}
                  className="flex items-center w-full text-left min-h-[48px] py-2 font-sans text-[13px] font-medium text-[#ef8c8f]"
                >
                  Log out
                </button>
              </>
            ) : (
              <div className="flex gap-2 pt-1 pb-2">
                <Link
                  href="/auth/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 inline-flex items-center justify-center min-h-[48px] px-4 rounded-full border border-ink bg-surface text-ink font-sans text-[12px] font-bold uppercase tracking-widest"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/signup"
                  onClick={() => setMobileOpen(false)}
                  className="flex-1 inline-flex items-center justify-center min-h-[48px] px-4 rounded-full border border-ink bg-ink text-white font-sans text-[12px] font-bold uppercase tracking-widest"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
