import { AuthForm } from "@/components/auth-form";

export const metadata = {
  title: "Login - RPG Asset Platform",
  description: "Entre ou crie sua conta na plataforma RPG Asset.",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-background relative overflow-hidden">
      {/* Subtle background glow */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
      >
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-primary/[0.04] blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-[300px] w-[300px] rounded-full bg-accent/[0.03] blur-3xl" />
      </div>

      <div className="relative z-10 w-full">
        <AuthForm />
      </div>
    </main>
  );
}
