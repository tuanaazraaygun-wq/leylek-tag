import { activityFeed } from "@/lib/mock-data";

const toneClass = {
  cyan: "bg-cyan-300 shadow-cyan-300/40",
  violet: "bg-violet-400 shadow-violet-400/40",
  emerald: "bg-emerald-300 shadow-emerald-300/40",
};

export function ActivityFeed() {
  const loopedFeed = [...activityFeed, ...activityFeed];

  return (
    <div className="glass-panel overflow-hidden rounded-3xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Canlı hareket</p>
          <p className="text-xs text-slate-400">Anonim topluluk akışı</p>
        </div>
        <span className="flex items-center gap-2 rounded-full bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
          aktif
        </span>
      </div>

      <div className="relative h-64 overflow-hidden">
        <div className="absolute inset-x-0 top-0 animate-feed-slide space-y-3">
          {loopedFeed.map((item, index) => (
            <div
              key={`${item.id}-${index}`}
              className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"
            >
              <div className="flex gap-3">
                <span
                  className={`mt-1 h-2.5 w-2.5 rounded-full shadow-lg ${toneClass[item.tone]}`}
                />
                <div>
                  <p className="text-sm font-medium text-slate-100">{item.label}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.region}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
