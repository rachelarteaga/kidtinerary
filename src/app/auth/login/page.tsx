import { LoginForm } from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <LoginForm />
    </main>
  );
}
