"use client";

import { useState, useEffect, useRef } from "react";
import { AnchoredPopover } from "@/components/ui/anchored-popover";

interface Suggestion {
  formatted_address: string;
  lat: number;
  lng: number;
}

interface AddressInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (formatted_address: string, lat: number, lng: number) => void;
  onError?: (error: string | null) => void;
  placeholder?: string;
  className?: string;
}

export function AddressInput({
  value,
  onChange,
  onSelect,
  onError,
  placeholder = "Your address or zip code",
  className = "",
}: AddressInputProps) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = value.trim();
    if (!trimmed || trimmed.length < 3) {
      setSuggestion(null);
      setOpen(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?address=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const geo = await res.json();
          setSuggestion({
            formatted_address: geo.formatted_address,
            lat: geo.lat,
            lng: geo.lng,
          });
          setOpen(true);
          onError?.(null);
        } else {
          setSuggestion(null);
          setOpen(false);
        }
      } catch {
        setSuggestion(null);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelect() {
    if (!suggestion) return;
    onChange(suggestion.formatted_address);
    onSelect(suggestion.formatted_address, suggestion.lat, suggestion.lng);
    setOpen(false);
    setSuggestion(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Enter" && open && suggestion) {
      e.preventDefault();
      handleSelect();
    }
  }

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none z-10">
        {loading ? (
          <svg
            className="w-4 h-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        )}
      </span>

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onError?.(null);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={`w-full pl-9 pr-3 py-2 rounded-lg border border-ink-3 bg-surface/50 text-ink placeholder:text-ink-3 text-sm focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink/30 font-sans ${className}`}
      />

      <AnchoredPopover
        anchorRef={inputRef}
        open={open && !!suggestion}
        onClose={() => setOpen(false)}
        align="stretch"
        offset={4}
        className="bg-surface border border-ink rounded-lg shadow-md overflow-hidden"
      >
        {suggestion && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              handleSelect();
            }}
            className="w-full text-left px-3 py-2.5 font-sans text-xs text-ink hover:bg-ink/5 transition-colors"
          >
            {suggestion.formatted_address}
          </button>
        )}
      </AnchoredPopover>
    </div>
  );
}
