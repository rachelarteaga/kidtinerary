"use client";

import { useState } from "react";
import { CATEGORIES, type Category } from "@/lib/constants";
import { Button } from "@/components/ui/button";

interface InterestsStepProps {
  childName: string;
  onComplete: (interests: Category[]) => void;
}

const CATEGORY_LABELS: Record<Category, { label: string; emoji: string }> = {
  sports: { label: "Sports", emoji: "⚽" },
  arts: { label: "Arts & Crafts", emoji: "🎨" },
  stem: { label: "STEM", emoji: "🔬" },
  nature: { label: "Nature", emoji: "🌿" },
  music: { label: "Music", emoji: "🎵" },
  theater: { label: "Theater", emoji: "🎭" },
  academic: { label: "Academic", emoji: "📚" },
  special_needs: { label: "Special Needs", emoji: "💛" },
  religious: { label: "Religious", emoji: "⛪" },
  swimming: { label: "Swimming", emoji: "🏊" },
  cooking: { label: "Cooking", emoji: "🍳" },
  language: { label: "Language", emoji: "🗣️" },
};

export function InterestsStep({ childName, onComplete }: InterestsStepProps) {
  const [selected, setSelected] = useState<Category[]>([]);

  function toggle(cat: Category) {
    setSelected((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  return (
    <div>
      <h2 className="font-display font-extrabold text-2xl mb-2">
        What does {childName} love?
      </h2>
      <p className="text-ink-2 mb-6">
        Pick as many as you&apos;d like. We&apos;ll use these to personalize recommendations.
      </p>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {CATEGORIES.map((cat) => {
          const { label, emoji } = CATEGORY_LABELS[cat];
          const isSelected = selected.includes(cat);
          return (
            <button
              key={cat}
              onClick={() => toggle(cat)}
              className={`flex flex-col items-center gap-1 p-4 rounded-2xl border transition-all ${
                isSelected
                  ? "border-ink bg-ink/5"
                  : "border-ink-3 bg-surface hover:border-ink-2"
              }`}
            >
              <span
                className="text-2xl"
                style={{ transform: "rotate(-3deg)", display: "inline-block" }}
              >
                {emoji}
              </span>
              <span className="font-sans text-[10px] uppercase tracking-wide text-ink-2">
                {label}
              </span>
            </button>
          );
        })}
      </div>
      <Button
        onClick={() => onComplete(selected)}
        disabled={selected.length === 0}
        className="w-full"
      >
        Start Exploring
      </Button>
    </div>
  );
}
