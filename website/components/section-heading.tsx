type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
  align?: "left" | "center";
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
}: SectionHeadingProps) {
  return (
    <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100/85 sm:text-sm">{eyebrow}</p>
      <h2 className="mt-4 text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl lg:text-[2.75rem]">{title}</h2>
      <p className="mt-4 text-base leading-relaxed text-white/80">{description}</p>
    </div>
  );
}
