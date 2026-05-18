import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
};

const variants = {
  primary:
    "bg-gradient-to-br from-[#00C6FF] to-[#0072FF] text-white shadow-[0_16px_52px_-14px_rgba(0,198,255,0.55),0_0_42px_-20px_rgba(0,114,255,0.22)] ring-1 ring-cyan-300/25 hover:-translate-y-0.5 hover:shadow-[0_22px_60px_-12px_rgba(0,198,255,0.58),0_0_56px_-18px_rgba(0,198,255,0.28)] active:translate-y-0 active:scale-[0.975]",
  secondary:
    "border border-white/[0.12] bg-white/[0.038] text-white/95 shadow-none backdrop-blur-xl hover:border-white/[0.2] hover:bg-white/[0.06] hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] active:translate-y-0 active:scale-[0.975]",
  ghost:
    "border border-transparent text-white/80 hover:-translate-y-0.5 hover:bg-white/10 hover:text-white active:translate-y-0 active:scale-[0.96]",
};

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={`ripple-bg tap-highlight relative inline-flex min-h-[48px] cursor-pointer items-center justify-center overflow-hidden rounded-full px-6 py-3.5 text-sm font-bold transition-all duration-300 ease-out hover:brightness-110 sm:min-h-[44px] ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </Link>
  );
}
