"use client";

import dynamic from "next/dynamic";
import type { IntercityDashboard } from "@/lib/intercity-live-data";

const IntercityRealMap = dynamic(() => import("@/components/intercity-real-map"), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[560px] items-center justify-center rounded-[2rem] border border-white/10 bg-slate-950/80 text-sm font-semibold text-slate-400">
      Harita yükleniyor…
    </div>
  ),
});

type Props = {
  dashboard: IntercityDashboard;
};

export function IntercityRealMapLoader({ dashboard }: Props) {
  return <IntercityRealMap dashboard={dashboard} />;
}
