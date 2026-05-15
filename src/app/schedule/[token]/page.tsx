import { notFound, redirect } from "next/navigation";
import { fetchSharedPlannerByToken } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
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

  // Identify the viewer (if any) and whether they've already saved this share.
  const supabase = (await createClient()) as any;
  const { data: { user } } = await supabase.auth.getUser();

  let isSaved = false;
  if (user) {
    const { data } = await supabase
      .from("saved_shares")
      .select("id")
      .eq("user_id", user.id)
      .eq("share_id", result.shareId)
      .maybeSingle();
    isSaved = !!data;
  }

  const isOwner = !!user && user.id === result.ownerId;

  return (
    <SharedPlannerView
      token={result.token}
      shareId={result.shareId}
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
      viewerState={{
        isAuthenticated: !!user,
        isOwner,
        isSaved,
        saveCount: result.saveCount,
      }}
    />
  );
}
