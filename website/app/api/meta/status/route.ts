import { NextResponse } from "next/server";

import { getMetaGrowthStatus } from "@/lib/meta/status";
import { verifyKycAdminRequest } from "@/lib/kyc-admin-auth";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" as const };

export async function GET(request: Request) {
  const identity = await verifyKycAdminRequest(request);
  if (identity instanceof NextResponse) {
    return identity;
  }

  const status = getMetaGrowthStatus();

  return NextResponse.json(
    {
      success: true,
      status,
      fetchedAt: new Date().toISOString(),
    },
    { headers: NO_STORE },
  );
}
