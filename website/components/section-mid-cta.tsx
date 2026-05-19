import { ButtonLink } from "@/components/button-link";
import { Container } from "@/components/container";

export function SectionMidCta() {
  return (
    <div className="border-y border-white/[0.08] bg-[linear-gradient(90deg,rgba(34,211,238,0.07)_0%,transparent_50%,rgba(139,92,246,0.065)_100%)] py-9 sm:py-10">
      <Container>
        <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-4">
          <ButtonLink href="/indir" className="w-full sm:w-auto sm:min-w-[200px]">
            Eşleşmeyi başlat
          </ButtonLink>
          <ButtonLink href="/muhabbet" variant="secondary" className="w-full sm:w-auto sm:min-w-[200px]">
            İlk teklifini oluştur
          </ButtonLink>
        </div>
      </Container>
    </div>
  );
}
