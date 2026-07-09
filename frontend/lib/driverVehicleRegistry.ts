export type DriverVehicleKind = 'car' | 'motorcycle';

export type DriverVehicleRowState = 'approved' | 'pending' | 'add' | 'rejected';

export interface DriverVehicleRegistryRow {
  kind: DriverVehicleKind;
  state: DriverVehicleRowState;
  title: string;
  statusLabel: string;
  actionLabel: string | null;
  canApply: boolean;
}

export type DriverVehicleRegistrySnapshot = {
  approved_vehicle_kinds?: unknown;
  kyc_status?: unknown;
  pending_vehicle_kind?: unknown;
  rejection_reason?: string | null;
  kyc_vehicle_kind?: unknown;
};

const ALL_DRIVER_VEHICLE_KINDS: DriverVehicleKind[] = ['car', 'motorcycle'];

export function canonicalVehicleKind(value: unknown): DriverVehicleKind | null {
  if (value == null || value === '') return null;
  const s = String(value).trim().toLowerCase();
  if (s === 'car') return 'car';
  if (s === 'motorcycle' || s === 'motor' || s === 'moto') return 'motorcycle';
  return null;
}

function approvedVehicleKindsFromList(raw: unknown): DriverVehicleKind[] {
  let items: unknown[] = [];
  if (Array.isArray(raw)) {
    items = raw;
  } else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) items = parsed;
    } catch {
      /* ignore */
    }
  }
  const out: DriverVehicleKind[] = [];
  for (const item of items) {
    const k = canonicalVehicleKind(item);
    if (k && !out.includes(k)) out.push(k);
  }
  return out;
}

/** Onaylı sürücü araç türleri (backend _kyc_approved_vehicle_kinds_from_details ile hizalı). */
export function getApprovedDriverVehicleKinds(
  source: DriverVehicleRegistrySnapshot,
): DriverVehicleKind[] {
  const fromList = approvedVehicleKindsFromList(source.approved_vehicle_kinds);
  if (fromList.length > 0) return fromList;
  const kycStatus = String(source.kyc_status ?? '').trim().toLowerCase();
  if (kycStatus === 'approved') {
    const kycVk = canonicalVehicleKind(source.kyc_vehicle_kind);
    if (kycVk) return [kycVk];
  }
  return [];
}

export function getMissingDriverVehicleKinds(
  approved: DriverVehicleKind[],
): DriverVehicleKind[] {
  return ALL_DRIVER_VEHICLE_KINDS.filter((kind) => !approved.includes(kind));
}

export function getPendingDriverVehicleKind(
  source: DriverVehicleRegistrySnapshot,
): DriverVehicleKind | null {
  const kycStatus = String(source.kyc_status ?? '').trim().toLowerCase();
  if (kycStatus !== 'pending') return null;
  return (
    canonicalVehicleKind(source.pending_vehicle_kind) ??
    canonicalVehicleKind(source.kyc_vehicle_kind)
  );
}

export function vehicleKindTitle(kind: DriverVehicleKind): string {
  return kind === 'car' ? 'Araba' : 'Motor';
}

export function vehicleKindIcon(kind: DriverVehicleKind): 'car-outline' | 'bicycle-outline' {
  return kind === 'car' ? 'car-outline' : 'bicycle-outline';
}

export function vehicleKindAddLabel(kind: DriverVehicleKind): string {
  return kind === 'car' ? 'Araba kaydı ekle' : 'Motor kaydı ekle';
}

export function vehicleKindReapplyLabel(kind: DriverVehicleKind): string {
  return kind === 'car' ? 'Araba — yeniden başvur' : 'Motor — yeniden başvur';
}

function inferRejectedVehicleKind(input: {
  approved: DriverVehicleKind[];
  pending: DriverVehicleKind | null;
  kycStatus: string;
  rejectionReason: string | null;
  kycVehicleKind: DriverVehicleKind | null;
}): DriverVehicleKind | null {
  const reason = (input.rejectionReason || '').trim();
  if (!reason || input.pending) return null;

  const { kycStatus, kycVehicleKind, approved } = input;
  if (kycVehicleKind && !approved.includes(kycVehicleKind)) {
    if (kycStatus === 'rejected' || kycStatus === 'approved') {
      return kycVehicleKind;
    }
  }
  if (kycStatus === 'rejected' && kycVehicleKind) return kycVehicleKind;
  return null;
}

export function getDriverVehicleRegistryRows(
  snapshot: DriverVehicleRegistrySnapshot,
): DriverVehicleRegistryRow[] {
  const approved = getApprovedDriverVehicleKinds(snapshot);
  const pending = getPendingDriverVehicleKind(snapshot);
  const kycStatus = String(snapshot.kyc_status ?? '').trim().toLowerCase();
  const rejectedKind = inferRejectedVehicleKind({
    approved,
    pending,
    kycStatus,
    rejectionReason: snapshot.rejection_reason ?? null,
    kycVehicleKind: canonicalVehicleKind(snapshot.kyc_vehicle_kind),
  });

  return ALL_DRIVER_VEHICLE_KINDS.map((kind) => {
    let state: DriverVehicleRowState;
    if (approved.includes(kind)) {
      state = 'approved';
    } else if (pending === kind) {
      state = 'pending';
    } else if (rejectedKind === kind) {
      state = 'rejected';
    } else {
      state = 'add';
    }

    const title = vehicleKindTitle(kind);
    let statusLabel: string;
    let actionLabel: string | null = null;
    let canApply = false;

    switch (state) {
      case 'approved':
        statusLabel = 'Onaylı';
        break;
      case 'pending':
        statusLabel = 'İnceleniyor';
        break;
      case 'rejected':
        statusLabel = 'Reddedildi';
        actionLabel = vehicleKindReapplyLabel(kind);
        canApply = true;
        break;
      default:
        statusLabel = 'Kayıt yok';
        actionLabel = vehicleKindAddLabel(kind);
        canApply = true;
        break;
    }

    return { kind, state, title, statusLabel, actionLabel, canApply };
  });
}

export type DriverKycStatusResponse = {
  kyc_status?: string;
  approved_vehicle_kinds?: unknown;
  pending_vehicle_kind?: unknown;
  rejection_reason?: string | null;
};

export function mergeDriverVehicleRegistrySnapshot(
  status: DriverKycStatusResponse | null | undefined,
  driverDetails: Record<string, unknown> | null | undefined,
): DriverVehicleRegistrySnapshot {
  const dd = driverDetails ?? {};
  const rejectionFromDetails =
    typeof dd.kyc_rejection_reason === 'string' ? dd.kyc_rejection_reason : null;
  return {
    approved_vehicle_kinds: status?.approved_vehicle_kinds ?? dd.approved_vehicle_kinds,
    kyc_status: status?.kyc_status ?? dd.kyc_status,
    pending_vehicle_kind: status?.pending_vehicle_kind ?? dd.pending_vehicle_kind,
    rejection_reason: status?.rejection_reason ?? rejectionFromDetails,
    kyc_vehicle_kind: dd.kyc_vehicle_kind,
  };
}
