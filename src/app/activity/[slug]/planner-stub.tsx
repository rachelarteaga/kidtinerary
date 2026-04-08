"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function PlannerStub() {
  const { toast } = useToast();

  return (
    <Button
      variant="outline"
      onClick={() => toast("Planner is coming soon! Stay tuned.", "info")}
    >
      Add to Planner
    </Button>
  );
}
