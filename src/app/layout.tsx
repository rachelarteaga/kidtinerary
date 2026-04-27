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
  title: "Kidtinerary — Every activity your kid does, in one place",
  description:
    "A personal catalog of every camp, class, lesson, and sport — past, present, and considering. With a text when it's time to sign up, pay, or show up.",
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
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
