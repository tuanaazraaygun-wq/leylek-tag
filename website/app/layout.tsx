import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Footer } from "@/components/footer";
import { SiteSupportPanel } from "@/components/site-support-panel";
import { Navbar } from "@/components/navbar";
import { SiteActionProvider } from "@/components/site-action-context";
import { BRANDING_PATHS } from "@/lib/branding-assets";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const inter = Inter({
  subsets: ["latin-ext"],
  display: "swap",
});

const siteUrl = new URL("https://leylektag.com");

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: "Leylek TAG | Güvenli Yolculuk Paylaşımı Topluluğu",
    template: "%s | Leylek TAG",
  },
  description:
    "Leylek TAG, yolcu ve sürücüleri karşılıklı teklif ve onay mantığıyla buluşturan, QR doğrulama destekli yolculuk eşleştirme platformudur.",
  keywords: [
    "Leylek TAG",
    "yolculuk paylaşımı",
    "masraf paylaşımı",
    "güvenli eşleşme",
    "aynı yöne gidenler",
    "Leylek Teklifi",
    "boş koltuk paylaşımı",
  ],
  applicationName: "Leylek TAG",
  authors: [{ name: "Leylek TAG" }],
  creator: "Leylek TAG",
  publisher: "Leylek TAG",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: "/",
    siteName: "Leylek TAG",
    title: "Leylek TAG | Güvenli Yolculuk Paylaşımı Topluluğu",
    description:
      "Leylek TAG ile karşılıklı teklif ve onayla güvenli eşleşme; QR doğrulama ile kontrollü yolculuk akışı.",
    images: [
      {
        url: BRANDING_PATHS.ogImage,
        width: 1200,
        height: 630,
        alt: "Leylek TAG",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Leylek TAG | Güvenli Yolculuk Paylaşımı",
    description:
      "Leylek TAG ile yolcu ve sürücüleri şeffaf teklif süreci ve QR doğrulama ile güvenli şekilde buluşturun.",
    images: [BRANDING_PATHS.ogImage],
  },
  icons: {
    icon: [
      { url: BRANDING_PATHS.icon192, sizes: "192x192", type: "image/png" },
      { url: BRANDING_PATHS.icon512, sizes: "512x512", type: "image/png" },
    ],
    shortcut: BRANDING_PATHS.favicon,
    apple: BRANDING_PATHS.appleTouch,
  },
};

export const viewport: Viewport = {
  themeColor: "#0072FF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className={inter.className}>
        <Navbar />
        <SiteActionProvider>
          <main className="relative z-[1] min-w-0 overflow-x-hidden pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-0">
            {children}
          </main>
        </SiteActionProvider>
        <Footer />
        <SiteSupportPanel />
      </body>
    </html>
  );
}
