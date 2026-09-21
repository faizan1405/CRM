import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getCrmSyncState } from "@/lib/crm-sync";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || (!session.id && !session.userId && !session.email)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const state = await getCrmSyncState();

    return NextResponse.json(
      {
        success: true,
        version: state.version,
        updatedAt: state.updatedAt,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to retrieve sync state",
      },
      { status: 500 }
    );
  }
}
