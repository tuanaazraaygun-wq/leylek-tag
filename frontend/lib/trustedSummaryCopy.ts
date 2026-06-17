import {
  formatTrustStructuralSubtitle,
  formatTrustedReadyPresenceLine,
} from './trustedHubCopy';
import type { TrustedSummaryResponse } from './trustedNetworkApi';

export function formatPassengerTrustedCardSubtitle(
  summary: TrustedSummaryResponse,
): string {
  const structural = formatTrustStructuralSubtitle(
    'passenger',
    {
      active: summary.active_count,
      incoming: summary.incoming_pending_count,
      outgoing: summary.outgoing_pending_count,
    },
    'dashboard',
  );

  const presence = formatTrustedReadyPresenceLine(summary.online_trusted_count);
  if (presence) {
    return `${structural} · ${presence}`;
  }

  return structural;
}

export function formatDriverTrustedHeaderSubtitle(
  summary: TrustedSummaryResponse,
): string {
  return formatTrustStructuralSubtitle(
    'driver',
    {
      active: summary.active_count,
      incoming: summary.incoming_pending_count,
      outgoing: summary.outgoing_pending_count,
    },
    'dashboard',
  );
}
