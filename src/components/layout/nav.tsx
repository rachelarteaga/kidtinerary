"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/planner", label: "Planner" },
  { href: "/favorites", label: "Favorites" },
  { href: "/kids", label: "My Kids" },
] as const;

export function Nav() {
  const pathname = usePathname();

  // Hide nav on auth and onboarding pages
  const hideOn = ["/auth", "/onboarding"];
  if (hideOn.some((p) => pathname.startsWith(p))) return null;

  return (
    <header className="sticky top-0 z-40 bg-cream/95 backdrop-blur-sm border-b border-driftwood/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        <Link href="/explore" className="flex items-center gap-2">
          <span className="font-serif text-xl text-bark">Kidtinerary</span>
        </Link>

        <nav className="hidden sm:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`px-3 py-2 rounded-lg font-mono text-xs uppercase tracking-widest transition-colors ${
                  isActive
                    ? "bg-bark/8 text-bark"
                    : "text-stone hover:text-bark hover:bg-bark/5"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/submit">
            <Button variant="outline" className="hidden sm:inline-flex text-[10px] px-4 py-2">
              Submit a Camp
            </Button>
          </Link>
        </div>

        {/* Mobile nav */}
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-cream border-t border-driftwood/50 flex justify-around py-2 z-40">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1 font-mono text-[9px] uppercase tracking-wide ${
                  isActive ? "text-sunset" : "text-stone"
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
