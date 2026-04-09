"use client";

import { useState, useEffect, useRef, useCallback } from "react";

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
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced geocode-as-you-type
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

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    <div ref={containerRef} className="relative">
      {/* Pin icon */}
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-driftwood pointer-events-none z-10">
        {loading ? (
          // Small spinner
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
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onError?.(null);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        className={`w-full pl-9 pr-3 py-2 rounded-lg border border-driftwood/50 bg-cream/50 text-bark placeholder:text-driftwood text-sm focus:outline-none focus:border-sunset focus:ring-1 focus:ring-sunset/30 font-mono ${className}`}
      />

      {/* Suggestion dropdown */}
      {open && suggestion && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-cream border border-driftwood rounded-lg shadow-md overflow-hidden">
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault(); // prevent blur from firing before click
              handleSelect();
            }}
            className="w-full text-left px-3 py-2.5 font-mono text-xs text-bark hover:bg-bark/5 transition-colors"
          >
            {suggestion.formatted_address}
          </button>
        </div>
      )}
    </div>
  );
}
