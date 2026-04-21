"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ChildStepProps {
  onComplete: (child: { name: string; birthDate: string }) => void;
}

export function ChildStep({ onComplete }: ChildStepProps) {
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");

  return (
    <div>
      <h2 className="font-display font-extrabold text-2xl mb-2">Tell us about your kid</h2>
      <p className="text-ink-2 mb-6">
        We&apos;ll find age-appropriate activities just for them.
      </p>
      <div className="space-y-4 mb-6">
        <div>
          <label
            htmlFor="childName"
            className="block font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-1"
          >
            First Name
          </label>
          <input
            id="childName"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Emma"
            className="w-full bg-surface border border-ink rounded-lg px-4 py-2.5 text-ink focus:outline-none focus:border-ink transition-colors"
          />
        </div>
        <div>
          <label
            htmlFor="birthDate"
            className="block font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-1"
          >
            Birthday
          </label>
          <input
            id="birthDate"
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            className="w-full bg-surface border border-ink rounded-lg px-4 py-2.5 text-ink focus:outline-none focus:border-ink transition-colors"
          />
        </div>
      </div>
      <Button
        onClick={() => onComplete({ name, birthDate })}
        disabled={name.trim().length === 0 || birthDate.length === 0}
        className="w-full"
      >
        Next
      </Button>
    </div>
  );
}
