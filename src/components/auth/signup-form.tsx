"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: true,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSent(true);
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) setError(error.message);
  }

  if (sent) {
    return (
      <div className="w-full max-w-sm text-center">
        <h1 className="font-display font-extrabold text-3xl mb-2">Check your email</h1>
        <p className="text-ink-2 mb-6">
          We sent a sign-in link to <span className="text-ink font-medium">{email}</span>.
          Click it to finish creating your account.
        </p>
        <button
          onClick={() => {
            setSent(false);
            setEmail("");
          }}
          className="font-sans text-[10px] uppercase tracking-widest text-ink hover:underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="font-display font-extrabold text-3xl mb-2">Plan your kid&apos;s next adventure</h1>
      <p className="text-ink-2 mb-8">Create your Kidtinerary account</p>

      <button
        onClick={handleGoogleLogin}
        className="w-full border border-ink rounded-full py-2.5 px-4 font-sans text-xs uppercase tracking-widest hover:border-ink transition-colors mb-6"
      >
        Continue with Google
      </button>

      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 h-px bg-ink" />
        <span className="font-sans text-[10px] uppercase tracking-widest text-ink-2">
          or
        </span>
        <div className="flex-1 h-px bg-ink" />
      </div>

      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label
            htmlFor="signup-email"
            className="block font-sans text-[10px] uppercase tracking-widest text-ink-2 mb-1"
          >
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-surface border border-ink rounded-lg px-4 py-2.5 text-ink focus:outline-none focus:border-ink transition-colors"
          />
        </div>

        {error && (
          <p className="text-sm text-[#ef8c8f]">{error}</p>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Sending link..." : "Email me a sign-in link"}
        </Button>
      </form>

      <p className="text-center text-ink-2 text-sm mt-6">
        Already have an account?{" "}
        <a href="/auth/login" className="text-ink hover:underline">
          Sign in
        </a>
      </p>
    </div>
  );
}
