"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { geocodeAddress } from "@/lib/geocode";
import { AddressStep } from "@/components/onboarding/address-step";
import { ChildStep } from "@/components/onboarding/child-step";
import { InterestsStep } from "@/components/onboarding/interests-step";
import type { Category } from "@/lib/constants";

type Step = "address" | "child" | "interests";

export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("address");
  const [address, setAddress] = useState("");
  const [child, setChild] = useState({ name: "", birthDate: "" });
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleAddressComplete(addr: string) {
    setAddress(addr);
    setStep("child");
  }

  async function handleChildComplete(c: { name: string; birthDate: string }) {
    setChild(c);
    setStep("interests");
  }

  async function handleInterestsComplete(interests: Category[]) {
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

    // Geocode address
    const geo = await geocodeAddress(address);

    // Update profile with address and location
    const profileUpdate = {
      address: geo ? geo.formatted_address : address,
      onboarding_completed: true,
    };

    const { error: profileError } = await supabase
      .from("profiles")
      .update(profileUpdate)
      .eq("id", user.id);

    if (profileError) {
      setError("Failed to save profile. Please try again.");
      return;
    }

    // Create child
    const { error: childError } = await supabase.from("children").insert({
      user_id: user.id,
      name: child.name,
      birth_date: child.birthDate,
      interests,
    });

    if (childError) {
      setError("Failed to save kid profile. Please try again.");
      return;
    }

    router.push("/");
  }

  const stepNumber = step === "address" ? 1 : step === "child" ? 2 : 3;

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Progress indicator */}
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
        {step === "interests" && (
          <InterestsStep
            childName={child.name}
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
