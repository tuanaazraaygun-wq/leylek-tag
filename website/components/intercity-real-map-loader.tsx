"use client";

import dynamic from "next/dynamic";
import type { IntercityDashboard } from "@/lib/intercity-live-data";

const IntercityRealMap = dynamic(() => import("@/components/intercity-real-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded-[2rem] border border-white/10 bg-slate-950/80 text-sm font-semibold text-slate-400 sm:h-[460px] md:h-[520px] lg:h-[680px]">
      Harita yükleniyor…
    </div>
  ),
});

type Props = {
  dashboard: IntercityDashboard;
  dataMode?: "live" | "demo";
  activityHudFreshCycle?: number;
  liveSparse?: boolean;
};

export function IntercityRealMapLoader({
  dashboard,
  dataMode = "demo",
  activityHudFreshCycle = 0,
  liveSparse = false,
}: Props) {
  return (
    <IntercityRealMap
      dashboard={dashboard}
      dataMode={dataMode}
      activityHudFreshCycle={activityHudFreshCycle}
      liveSparse={liveSparse}
    />
  );
}
