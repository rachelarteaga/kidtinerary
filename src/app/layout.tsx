import type { Metadata } from "next";
import { Figtree, Outfit } from "next/font/google";
import { Nav } from "@/components/layout/nav";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-figtree",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kidtinerary — Find camps & activities your kids will love",
  description:
    "Discover local camps, classes, and extracurricular activities for kids ages 3-12 in the Raleigh/Triangle area. Plan your schedule, track favorites, and never miss a registration deadline.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${figtree.variable} ${outfit.variable}`}
    >
      <body className="bg-surface text-ink font-sans antialiased">
        <ToastProvider>
          <Nav />
          <div className="pb-16 sm:pb-0">{children}</div>
        </ToastProvider>
      </body>
    </html>
  );
}
