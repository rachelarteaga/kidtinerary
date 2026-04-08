"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface AddressStepProps {
  onComplete: (address: string) => void;
}

export function AddressStep({ onComplete }: AddressStepProps) {
  const [address, setAddress] = useState("");

  return (
    <div>
      <h2 className="font-serif text-2xl mb-2">Where do you live?</h2>
      <p className="text-stone mb-6">
        We&apos;ll use this to find activities near you.
      </p>
      <div className="mb-4">
        <label
          htmlFor="address"
          className="block font-mono text-[10px] uppercase tracking-widest text-stone mb-1"
        >
          Home Address or Zip Code
        </label>
        <input
          id="address"
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="123 Main St, Raleigh, NC"
          className="w-full bg-white border border-driftwood rounded-lg px-4 py-2.5 text-bark focus:outline-none focus:border-sunset transition-colors"
        />
      </div>
      <Button
        onClick={() => onComplete(address)}
        disabled={address.trim().length === 0}
        className="w-full"
      >
        Next
      </Button>
    </div>
  );
}
