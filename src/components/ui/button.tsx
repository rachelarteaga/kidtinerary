import { type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "dark" | "outline" | "nature" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-sunset text-white hover:bg-sunset/90",
  dark: "bg-bark text-cream hover:bg-bark/90",
  outline: "bg-transparent text-bark border border-driftwood hover:border-bark",
  nature: "bg-meadow text-white hover:bg-meadow/90",
  ghost: "bg-bark/5 text-bark hover:bg-bark/10",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`rounded-full font-mono text-xs uppercase tracking-widest px-6 py-2.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
