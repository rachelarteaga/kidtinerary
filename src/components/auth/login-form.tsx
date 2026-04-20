"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const supabase = createClient();

  async function handleEmailLogin(e: React.FormEvent) {
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
        <h1 className="font-serif text-3xl mb-2">Check your email</h1>
        <p className="text-stone mb-6">
          We sent a sign-in link to <span className="text-bark font-medium">{email}</span>.
          Click it to finish signing in.
        </p>
        <button
          onClick={() => {
            setSent(false);
            setEmail("");
          }}
          className="font-mono text-[10px] uppercase tracking-widest text-sunset hover:underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="font-serif text-3xl mb-2">Welcome back</h1>
      <p className="text-stone mb-8">Sign in to your Kidtinerary account</p>

      <button
        onClick={handleGoogleLogin}
        className="w-full border border-driftwood rounded-full py-2.5 px-4 font-mono text-xs uppercase tracking-widest hover:border-bark transition-colors mb-6"
      >
        Continue with Google
      </button>

      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 h-px bg-driftwood" />
        <span className="font-mono text-[10px] uppercase tracking-widest text-stone">
          or
        </span>
        <div className="flex-1 h-px bg-driftwood" />
      </div>

      <form onSubmit={handleEmailLogin} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block font-mono text-[10px] uppercase tracking-widest text-stone mb-1"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-white border border-driftwood rounded-lg px-4 py-2.5 text-bark focus:outline-none focus:border-sunset transition-colors"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Sending link..." : "Email me a sign-in link"}
        </Button>
      </form>

      <p className="text-center text-stone text-sm mt-6">
        Don&apos;t have an account?{" "}
        <a href="/auth/signup" className="text-sunset hover:underline">
          Sign up
        </a>
      </p>
    </div>
  );
}
