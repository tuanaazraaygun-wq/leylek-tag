import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
};

const variants = {
  primary:
    "bg-gradient-to-br from-[#00C6FF] to-[#0072FF] text-white shadow-lg shadow-cyan-500/25 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,198,255,0.4)] active:translate-y-0 active:scale-[0.96]",
  secondary:
    "border border-white/20 bg-white/5 text-white backdrop-blur-xl hover:bg-white/10 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.96]",
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
