"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { geocodeAddress } from "@/lib/geocode";
import { AddressStep } from "@/components/onboarding/address-step";
import { ChildStep, type KidDraft } from "@/components/onboarding/child-step";
import { InterestsStep } from "@/components/onboarding/interests-step";
import type { Category } from "@/lib/constants";

type Step = "address" | "child" | "interests";

export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("address");
  const [address, setAddress] = useState("");
  const [kids, setKids] = useState<KidDraft[]>([]);
  const [interestsByKid, setInterestsByKid] = useState<Category[][]>([]);
  const [interestsIndex, setInterestsIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleAddressComplete(addr: string) {
    setAddress(addr);
    setStep("child");
  }

  function handleChildComplete(addedKids: KidDraft[]) {
    setKids(addedKids);
    setInterestsByKid([]);
    setInterestsIndex(0);
    setStep("interests");
  }

  async function handleInterestsComplete(interests: Category[]) {
    const updatedInterests = [...interestsByKid, interests];
    const nextIndex = interestsIndex + 1;

    if (nextIndex < kids.length) {
      setInterestsByKid(updatedInterests);
      setInterestsIndex(nextIndex);
      return;
    }

    setError(null);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createClient() as any;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/auth/login");
      return;
    }

    const geo = await geocodeAddress(address);

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        address: geo ? geo.formatted_address : address,
        onboarding_completed: true,
      })
      .eq("id", user.id);

    if (profileError) {
      setError("Failed to save profile. Please try again.");
      return;
    }

    const childRows = kids.map((kid, i) => ({
      user_id: user.id,
      name: kid.name,
      birth_date: kid.birthDate,
      interests: updatedInterests[i],
    }));

    const { error: childError } = await supabase.from("children").insert(childRows);

    if (childError) {
      setError("Failed to save kid profiles. Please try again.");
      return;
    }

    router.push("/planner");
  }

  const stepNumber = step === "address" ? 1 : step === "child" ? 2 : 3;
  const currentKid = step === "interests" ? kids[interestsIndex] : null;

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`h-1 flex-1 rounded-full transition-colors ${
                n <= stepNumber ? "bg-ink" : "bg-ink-3"
              }`}
            />
          ))}
        </div>

        {step === "address" && (
          <AddressStep onComplete={handleAddressComplete} />
        )}
        {step === "child" && <ChildStep onComplete={handleChildComplete} />}
        {step === "interests" && currentKid && (
          <InterestsStep
            key={interestsIndex}
            childName={currentKid.name}
            onComplete={handleInterestsComplete}
          />
        )}

        {error && (
          <p className="text-sm text-[#ef8c8f] mt-4">{error}</p>
        )}
      </div>
    </main>
  );
}
