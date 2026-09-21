/**
 * Next.js Server Instrumentation
 * Automatically starts the background due follow-up push notification scheduler
 * when the server initializes in the Node.js runtime.
 */
export async function register() {
  // Background scheduler removed for Hostinger compatibility.
  // Use /api/cron/mobile-alerts via standard Cron instead.
}
