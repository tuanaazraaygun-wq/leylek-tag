import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { SiteActionProvider } from "@/components/site-action-context";
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
        url: "/logo-leylek.svg",
        width: 160,
        height: 160,
        alt: "Leylek TAG logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Leylek TAG | Güvenli Yolculuk Paylaşımı",
    description:
      "Leylek TAG ile yolcu ve sürücüleri şeffaf teklif süreci ve QR doğrulama ile güvenli şekilde buluşturun.",
    images: ["/logo-leylek.svg"],
  },
  icons: {
    icon: "/logo-leylek.svg",
    shortcut: "/logo-leylek.svg",
    apple: "/logo-leylek.svg",
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
          <main className="min-w-0 overflow-x-hidden pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-0">
            {children}
          </main>
        </SiteActionProvider>
        <Footer />
      </body>
    </html>
  );
}
