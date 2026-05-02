import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/container";

const footerLinks = [
  { href: "/sehir-ici", label: "Hızlı Yolculuk" },
  { href: "/muhabbet", label: "Leylek Teklifi" },
  { href: "/sehirler-arasi", label: "Şehirler Arası" },
  { href: "/guvenlik", label: "Güvenlik" },
  { href: "/nasil-calisir", label: "Nasıl Çalışır" },
  { href: "/indir", label: "İndir" },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-slate-950/30 py-12">
      <Container className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="max-w-2xl">
          <Link href="/" className="inline-flex items-center gap-3" aria-label="Leylek Tag ana sayfa">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/10 shadow-md sm:h-12 sm:w-12">
              <Image
                src="/app-icon.png"
                alt=""
                width={48}
                height={48}
                className="h-full w-full object-cover opacity-95 [filter:drop-shadow(0_0_10px_rgba(0,198,255,0.35))]"
              />
            </span>
            <span>
              <span className="block text-base font-black tracking-tight text-white">Leylek Tag</span>
              <span className="block text-xs font-medium text-cyan-100/70">Yolculuk topluluğu</span>
            </span>
          </Link>
          <p className="mt-5 text-sm leading-7 text-slate-300">
            Leylek Tag, kullanıcıların aynı yöne giden yolculuklarını paylaşmasına ve masraf paylaşımı yapmasına yardımcı olan bir topluluk platformudur.
          </p>
          <p className="mt-3 text-xs leading-6 text-slate-500">
            Bu web sitesi bilgilendirme ve erken erişim amacıyla hazırlanmıştır. Canlı eşleşme ve ilan bağlantıları uygulama deneyimi içinde sunulacaktır.
          </p>
        </div>
        <nav className="grid grid-cols-2 gap-3 text-sm text-slate-300 sm:flex sm:flex-wrap lg:max-w-md lg:justify-end" aria-label="Alt menü">
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-center transition hover:border-cyan-200/40 hover:text-cyan-100"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </Container>
    </footer>
  );
}
