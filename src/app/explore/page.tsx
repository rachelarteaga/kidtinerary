export const dynamic = "force-dynamic";

export default function ExplorePage() {
  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
      <h1 className="font-display font-extrabold text-4xl mb-4">Explore — coming soon</h1>
      <p className="text-ink-2 text-lg mb-2">
        We&apos;re building a verified camp directory.
      </p>
      <p className="text-ink-2">
        In the meantime, add camps directly from your{" "}
        <a href="/planner" className="text-ink hover:underline">planner</a>.
      </p>
    </main>
  );
}
