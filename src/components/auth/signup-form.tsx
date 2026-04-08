"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/onboarding");
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

  return (
    <div className="w-full max-w-sm">
      <h1 className="font-serif text-3xl mb-2">Plan your kid&apos;s next adventure</h1>
      <p className="text-stone mb-8">Create your Kidtinerary account</p>

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

      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label
            htmlFor="signup-email"
            className="block font-mono text-[10px] uppercase tracking-widest text-stone mb-1"
          >
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-white border border-driftwood rounded-lg px-4 py-2.5 text-bark focus:outline-none focus:border-sunset transition-colors"
          />
        </div>
        <div>
          <label
            htmlFor="signup-password"
            className="block font-mono text-[10px] uppercase tracking-widest text-stone mb-1"
          >
            Password
          </label>
          <input
            id="signup-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full bg-white border border-driftwood rounded-lg px-4 py-2.5 text-bark focus:outline-none focus:border-sunset transition-colors"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Creating account..." : "Get Started"}
        </Button>
      </form>

      <p className="text-center text-stone text-sm mt-6">
        Already have an account?{" "}
        <a href="/auth/login" className="text-sunset hover:underline">
          Sign in
        </a>
      </p>
    </div>
  );
}
