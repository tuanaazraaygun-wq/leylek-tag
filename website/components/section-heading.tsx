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
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-100/85 sm:text-[11px]">{eyebrow}</p>
      <h2 className="mt-3 text-[1.45rem] font-bold leading-snug tracking-tight text-white sm:mt-3.5 sm:text-[1.75rem] lg:text-[2rem]">
        {title}
      </h2>
      <p className="mt-3 text-[13px] leading-relaxed text-slate-300/95 sm:text-sm sm:leading-relaxed">{description}</p>
    </div>
  );
}
