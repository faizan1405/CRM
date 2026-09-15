"use server";

import { getSession } from "@/lib/auth";
import { getDailySalesBriefingData } from "@/features/daily-briefing/services/briefing-service";
import type {
  DailyBriefingPayload,
  DailyBriefingActionResult,
} from "@/features/daily-briefing/types";

class UserFacingError extends Error {}

async function requireAuthenticatedUser() {
  const session = await getSession();
  if (!session || typeof session.id !== "string") {
    throw new UserFacingError("You must be signed in to view the daily sales briefing.");
  }
  return session;
}

function cleanError(error: unknown): string {
  if (error instanceof UserFacingError) return error.message;
  if (error instanceof Error) return error.message;
  return "An unexpected error occurred loading the daily briefing.";
}

/**
 * Authenticated action to fetch real daily briefing data with cached AI summary.
 * Timezone: Asia/Kolkata.
 */
export async function getDailyBriefing(options?: {
  forceRefreshAi?: boolean;
}): Promise<DailyBriefingActionResult<DailyBriefingPayload>> {
  try {
    const session = await requireAuthenticatedUser();
    const data = await getDailySalesBriefingData({
      userId: session.id as string,
      forceRefreshAi: options?.forceRefreshAi,
    });
    return { success: true, data };
  } catch (error) {
    return { success: false, error: cleanError(error) };
  }
}

/**
 * Manually forces a refresh of today's AI briefing summary.
 */
export async function refreshDailyBriefingAi(): Promise<
  DailyBriefingActionResult<DailyBriefingPayload>
> {
  return getDailyBriefing({ forceRefreshAi: true });
}
