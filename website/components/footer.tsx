import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/container";

const footerLinks = [
  { href: "/sehir-ici", label: "Şehir İçi" },
  { href: "/muhabbet", label: "Leylek Teklifi" },
  { href: "/guvenlik", label: "Güvenlik" },
  { href: "/nasil-calisir", label: "Nasıl Çalışır" },
  { href: "/indir", label: "İndir" },
];

const legalLinks = [
  { href: "/gizlilik-politikasi", label: "Gizlilik Politikası" },
  { href: "/kullanim-sartlari", label: "Kullanım Şartları" },
  { href: "/kvkk", label: "KVKK" },
  { href: "/hesap-silme", label: "Hesap Silme" },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-slate-950/30 py-12">
      <Container className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="max-w-2xl">
          <Link href="/" className="inline-flex items-center gap-3" aria-label="Leylek TAG ana sayfa">
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
              <span className="block text-base font-black tracking-tight text-white">Leylek TAG</span>
              <span className="block text-xs font-medium text-cyan-100/70">Yolculuk topluluğu</span>
            </span>
          </Link>
          <p className="mt-5 text-sm leading-7 text-slate-300">
            Leylek TAG, yolcu ve sürücüleri karşılıklı teklif ve onay mantığıyla buluşturan, QR doğrulama destekli yolculuk eşleştirme platformudur.
          </p>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            Leylek TAG uygulama içinde ödeme tahsilatı yapmaz. Yolculuk ücreti, yolculuk sonunda taraflar arasında nakit olarak tamamlanır. Kart ile ödeme özelliği aktif değildir; ilerleyen süreçte uygun altyapı ile değerlendirilecektir.
          </p>
          <p className="mt-3 text-xs leading-6 text-slate-500">
            Bu web sitesi bilgilendirme ve erken erişim amacıyla hazırlanmıştır. Teklif oluşturma, karşılıklı onay ve QR ile yolculuk doğrulama adımları Leylek TAG mobil uygulamasında tamamlanır.
          </p>
        </div>
        <div className="flex flex-col gap-6 lg:items-end">
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
          <nav className="grid grid-cols-2 gap-3 text-sm text-slate-400 sm:flex sm:flex-wrap lg:max-w-md lg:justify-end" aria-label="Yasal">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-white/10 bg-white/[0.02] px-4 py-2 text-center transition hover:border-cyan-200/30 hover:text-cyan-100/90"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </Container>
    </footer>
  );
}
