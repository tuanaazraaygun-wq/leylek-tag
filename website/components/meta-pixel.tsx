"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef } from "react";

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";

function isAdminOrSupportPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === "/support" ||
    pathname.startsWith("/support/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  );
}

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
    __leylekMetaPixelInit?: boolean;
  }
}

function trackPageView(): void {
  if (typeof window.fbq !== "function") return;
  window.fbq("track", "PageView");
}

function ensurePixelInit(): void {
  if (typeof window.fbq !== "function" || window.__leylekMetaPixelInit) return;
  window.fbq("init", META_PIXEL_ID);
  window.__leylekMetaPixelInit = true;
}

export function MetaPixel() {
  const pathname = usePathname();
  const scriptReadyRef = useRef(false);
  const lastTrackedPathRef = useRef<string | null>(null);

  const skipPageView = isAdminOrSupportPath(pathname);

  const trackForPath = (path: string | null) => {
    if (!scriptReadyRef.current || isAdminOrSupportPath(path)) return;
    const key = path ?? "";
    if (lastTrackedPathRef.current === key) return;
    lastTrackedPathRef.current = key;
    ensurePixelInit();
    trackPageView();
  };

  useEffect(() => {
    if (!META_PIXEL_ID || skipPageView) return;
    trackForPath(pathname);
  }, [pathname, skipPageView]);

  if (!META_PIXEL_ID) {
    return null;
  }

  const handleScriptReady = () => {
    scriptReadyRef.current = true;
    trackForPath(pathname);
  };

  return (
    <>
      <Script id="meta-pixel-fbq-stub" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
          n.push=n;n.loaded=!0;n.version='2.0';n.queue=[]}(window,document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
        `}
      </Script>
      <Script
        id="meta-pixel-fbevents"
        src="https://connect.facebook.net/en_US/fbevents.js"
        strategy="afterInteractive"
        onReady={handleScriptReady}
      />
    </>
  );
}
