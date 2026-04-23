import { type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "dark" | "outline" | "nature" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-ink text-ink-inverse border border-ink hover:bg-[#333]",
  dark: "bg-ink text-ink-inverse border border-ink hover:bg-[#333]",
  outline: "bg-surface text-ink border border-ink hover:bg-disabled",
  nature: "bg-[#d8f0e6] text-ink border border-ink hover:bg-[#5fc39c]",
  ghost: "bg-transparent text-ink border-0 hover:bg-ink/5",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`rounded-full font-sans text-xs uppercase tracking-widest font-bold px-6 py-2.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
