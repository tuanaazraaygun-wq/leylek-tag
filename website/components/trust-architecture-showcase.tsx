"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScreenshotLightbox } from "@/components/screenshot-lightbox";
import { IPAD_SHOWCASE_SLIDES } from "@/lib/app-screenshot-slides";
import { IPAD_SHOWCASE_IMAGE_HEIGHT, IPAD_SHOWCASE_IMAGE_WIDTH } from "@/lib/branding-assets";

const AUTOPLAY_MS = 7_000;

const trustLayers = [
  {
    title: "Kontrollü çift onaylı eşleşme",
    body: "İki taraf netleşmeden süreç ilerlemez.",
  },
  {
    title: "Rota ve teklif şeffaflığı",
    body: "Güzergâh ve teklif çerçevesi iki tarafta aynı görünür.",
  },
  {
    title: "QR doğrulama",
    body: "Biniş ve bitiş adımları kontrollü teyit edilir.",
  },
  {
    title: "Güven katmanı bildirimi",
    body: "Durum güncellemeleri şeffaf akışta izlenir.",
  },
  {
    title: "Minimum veri paylaşımı",
    body: "Gereksiz kişisel detay yayılımı sınırlanır.",
  },
] as const;

export function TrustArchitectureShowcase() {
  const slides = IPAD_SHOWCASE_SLIDES;
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const hoverPausedRef = useRef(false);

  const activeSlide = slides[activeIndex] ?? slides[0];
  const imgW = activeSlide.imageWidth ?? IPAD_SHOWCASE_IMAGE_WIDTH;
  const imgH = activeSlide.imageHeight ?? IPAD_SHOWCASE_IMAGE_HEIGHT;

  useEffect(() => {
    if (slides.length < 2) return;
    const id = window.setInterval(() => {
      if (hoverPausedRef.current || lightboxOpen) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      setActiveIndex((i) => (i + 1) % slides.length);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [lightboxOpen, slides.length]);

  const openLightbox = useCallback(() => setLightboxOpen(true), []);
  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  const vitrinPanel = (
    <div
      className="relative w-full min-w-0 lg:col-start-1 lg:row-start-1"
      onMouseEnter={() => {
        hoverPausedRef.current = true;
      }}
      onMouseLeave={() => {
        hoverPausedRef.current = false;
      }}
    >
      <div className="rounded-2xl border border-white/[0.1] bg-gradient-to-b from-white/[0.04] to-transparent p-3 shadow-[0_20px_60px_-32px_rgba(0,114,255,0.35)] ring-1 ring-cyan-400/[0.08] sm:p-4">
        <p className="mb-2 text-center text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200/70">
          App Store · iPad vitrin
        </p>
        <button
          type="button"
          onClick={openLightbox}
          className="group relative mx-auto block w-full max-w-[min(100%,36rem)] cursor-zoom-in overflow-hidden rounded-xl border border-white/[0.1] bg-[#070d14] shadow-inner transition hover:border-cyan-400/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400/60 lg:max-w-none"
          aria-label={`${activeSlide.alt} — büyüt`}
        >
          <div className="relative aspect-[2752/2064] w-full">
            <Image
              key={activeSlide.src}
              src={activeSlide.src}
              alt={activeSlide.alt}
              width={imgW}
              height={imgH}
              className="h-full w-full object-contain object-center transition-opacity duration-500"
              sizes="(max-width: 1024px) 92vw, 560px"
              unoptimized
              priority={activeIndex === 0}
              loading={activeIndex === 0 ? undefined : "lazy"}
            />
          </div>
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-3 pb-3 pt-8 text-left text-[11px] font-semibold text-white opacity-0 transition group-hover:opacity-100">
            Büyütmek için tıkla
          </span>
        </button>
        <p className="mt-3 text-center text-[11px] font-medium leading-relaxed text-slate-400 sm:text-xs">
          {activeSlide.caption}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          {slides.map((s, index) => (
            <button
              key={s.src}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === activeIndex
                  ? "w-5 bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.4)]"
                  : "w-1.5 bg-white/25 hover:bg-white/45"
              }`}
              aria-label={`Ekran ${index + 1}${index === activeIndex ? " (aktif)" : ""}`}
              aria-current={index === activeIndex ? true : undefined}
            />
          ))}
        </div>
        <p className="mt-2 text-center text-[10px] font-medium text-slate-500">
          {slides.length} iPad ekranı · otomatik vitrin
        </p>
      </div>
    </div>
  );

  const trustCards = (
    <ul className="flex min-w-0 flex-col gap-2 sm:gap-2.5 lg:col-start-2 lg:row-start-1">
      {trustLayers.map(({ title, body }) => (
        <li key={title}>
          <article className="rounded-xl border border-white/[0.09] bg-white/[0.035] px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm transition hover:border-cyan-400/20 sm:px-4 sm:py-3">
            <h3 className="text-[12.5px] font-bold leading-snug tracking-tight text-white sm:text-[13px]">{title}</h3>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-400">{body}</p>
          </article>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <header className="mb-5 max-w-3xl md:mb-6">
        <p className="text-[10px] font-black uppercase tracking-[0.32em] text-cyan-200/75 sm:text-[11px]">
          güven mimarisi
        </p>
        <h2 className="mt-2 text-xl font-black leading-tight tracking-tight text-white sm:text-2xl lg:text-[1.65rem]">
          Kontrollü eşleşme ve doğrulanmış güven katmanları
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
          App Store ile uyumlu{" "}
          <span className="font-semibold text-cyan-100/90">10 premium iPad ekranı</span> — yatay vitrin ve güven
          katmanları bir arada.
        </p>
      </header>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,0.58fr)_minmax(0,0.42fr)] lg:gap-7 xl:gap-8">
        {vitrinPanel}
        {trustCards}
      </div>

      <ScreenshotLightbox
        open={lightboxOpen}
        slides={slides}
        activeIndex={activeIndex}
        onClose={closeLightbox}
        onSelectIndex={setActiveIndex}
      />
    </>
  );
}
