import { notFound, redirect } from "next/navigation";
import { fetchSharedPlannerByToken } from "@/lib/queries";
import { SharedPlannerView } from "@/components/planner/shared-planner-view";

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
    <SharedPlannerView
      token={result.token}
      plannerName={result.plannerName}
      plannerStart={result.plannerStart}
      plannerEnd={result.plannerEnd}
      ownerDisplayName={result.ownerDisplayName}
      kids={result.kids}
      entries={result.entries}
      blocks={result.blocks}
      filters={{
        kidIds: result.kidIds,
        includeCost: result.includeCost,
        includePersonalBlockDetails: result.includePersonalBlockDetails,
      }}
      colorByActivityId={result.colorByActivityId}
    />
  );
}
