import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
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
    default: "Leylek Tag | Güvenli Yolculuk Paylaşımı Topluluğu",
    template: "%s | Leylek Tag",
  },
  description:
    "Leylek Tag; yolculuk paylaşımı, şehirler arası yol paylaşımı, masraf paylaşımı ve güvenli eşleşme için geliştirilen modern topluluk platformudur.",
  keywords: [
    "Leylek Tag",
    "yolculuk paylaşımı",
    "şehirler arası yol paylaşımı",
    "masraf paylaşımı",
    "güvenli eşleşme",
    "aynı yöne gidenler",
    "Leylek Muhabbeti",
    "boş koltuk paylaşımı",
  ],
  applicationName: "Leylek Tag",
  authors: [{ name: "Leylek Tag" }],
  creator: "Leylek Tag",
  publisher: "Leylek Tag",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: "/",
    siteName: "Leylek Tag",
    title: "Leylek Tag | Güvenli Yolculuk Paylaşımı Topluluğu",
    description:
      "Aynı yöne gidenler için yolculuk paylaşımı, masraf paylaşımı ve güvenli eşleşme deneyimini keşfet.",
    images: [
      {
        url: "/logo-leylek.svg",
        width: 160,
        height: 160,
        alt: "Leylek Tag logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Leylek Tag | Güvenli Yolculuk Paylaşımı",
    description:
      "Leylek Tag ile aynı yöne gidenler, yolculuk paylaşımı ve masraf paylaşımı için güvenli eşleşme deneyimi yaşar.",
    images: ["/logo-leylek.svg"],
  },
  icons: {
    icon: "/logo-leylek.svg",
    shortcut: "/logo-leylek.svg",
    apple: "/logo-leylek.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#07111f",
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
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
