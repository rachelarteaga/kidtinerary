"use client";

import { useState, useTransition } from "react";
import { toggleFavorite } from "@/lib/actions";
import { useToast } from "@/components/ui/toast";

interface FavoriteButtonProps {
  activityId: string;
  initialFavorited: boolean;
  className?: string;
}

export function FavoriteButton({
  activityId,
  initialFavorited,
  className = "",
}: FavoriteButtonProps) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const result = await toggleFavorite(activityId);
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      setFavorited(result.favorited ?? false);
      toast(
        result.favorited ? "Added to favorites" : "Removed from favorites",
        "success"
      );
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
      className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
        favorited
          ? "bg-sunset/15 text-sunset"
          : "bg-bark/5 text-driftwood hover:text-sunset hover:bg-sunset/10"
      } ${isPending ? "opacity-50" : ""} ${className}`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill={favorited ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}
