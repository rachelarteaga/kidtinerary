import { notFound, redirect } from "next/navigation";
import { fetchSharedPlannerByToken } from "@/lib/queries";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function SharedSchedulePage({ params }: PageProps) {
  const { token } = await params;
  const result = await fetchSharedPlannerByToken(token);

  if (result.type === "notfound") {
    notFound();
  }

  if (result.type === "camp") {
    redirect(`/camps/${result.campId}?share=${result.token}`);
  }

  // type === "planner"
  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-6">
        <p className="font-sans text-[10px] uppercase tracking-widest text-ink-2 font-semibold">Shared · view-only</p>
        <h1 className="font-display font-extrabold text-4xl mt-1">{result.plannerName}</h1>
        <p className="text-ink-2 mt-1">
          {result.kids.length} kid{result.kids.length === 1 ? "" : "s"}
        </p>
      </header>
      <div className="rounded-lg border border-ink-3 bg-surface p-6">
        <p className="font-sans text-sm text-ink-2">
          Public planner view is being set up. This placeholder renders until Task 3.7d lands the full grid.
        </p>
      </div>
    </main>
  );
}
