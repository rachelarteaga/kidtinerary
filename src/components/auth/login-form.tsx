"use client";

// Magic-link sign-in is intentionally disabled.
// To re-enable: configure a custom domain + Resend SMTP in Supabase Auth
// settings, then restore this file from git history (commit prior to
// "disable magic link for now"). The handler shape hasn't changed.

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/planner`,
      },
    });
    if (error) setError(error.message);
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="font-display font-extrabold text-3xl mb-2">Welcome back</h1>
      <p className="text-ink-2 mb-8">Sign in to your Kidtinerary account</p>

      <button
        onClick={handleGoogleLogin}
        className="w-full border border-ink rounded-full py-2.5 px-4 font-sans text-xs uppercase tracking-widest hover:border-ink transition-colors"
      >
        Continue with Google
      </button>

      {error && (
        <p className="text-sm text-[#ef8c8f] mt-4">{error}</p>
      )}

      <p className="text-center text-ink-2 text-sm mt-8">
        Don&apos;t have an account?{" "}
        <a href="/auth/signup" className="text-ink hover:underline">
          Sign up
        </a>
      </p>
    </div>
  );
}
