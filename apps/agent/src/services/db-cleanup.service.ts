/**
 * Database cleanup service for preventing storage exhaustion.
 * Keeps only the last 7 days of logs.
 * 
 * NOTE: This service requires DATABASE_URL to be set.
 * In test environments without DATABASE_URL, operations are no-ops.
 */

let prisma: any = null;

// Lazy-load prisma only when DATABASE_URL is available
function getPrisma() {
  if (prisma !== null) return prisma;
  
  // Skip in test environment or when DATABASE_URL not set
  if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
    prisma = false; // Mark as unavailable
    return null;
  }

  try {
    const { prisma: client } = require("@cossie/db");
    prisma = client;
    return prisma;
  } catch (error) {
    console.warn("[db-cleanup] Failed to load Prisma client:", error);
    prisma = false;
    return null;
  }
}

export class DbCleanupService {
  /**
   * Delete audit logs older than 7 days.
   * Run this daily via cron or on startup.
   */
  async cleanupOldLogs(): Promise<{ deleted: number }> {
    const db = getPrisma();
    if (!db) {
      return { deleted: 0 };
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    try {
      const deleted = await db.toolExecutionLog.deleteMany({
        where: {
          createdAt: {
            lt: sevenDaysAgo,
          },
        },
      });

      console.log(
        `[db-cleanup] Deleted ${deleted.count} audit logs older than 7 days`
      );
      return { deleted: deleted.count };
    } catch (error) {
      console.warn("[db-cleanup] Failed to cleanup old logs:", error);
      return { deleted: 0 };
    }
  }

  /**
   * Get current audit log count (for monitoring).
   */
  async getLogCount(): Promise<number> {
    const db = getPrisma();
    if (!db) return 0;

    try {
      const count = await db.toolExecutionLog.count();
      return count;
    } catch {
      return 0;
    }
  }

  /**
   * Manual cleanup by event type (e.g., delete old PROMPT_INJECTION logs).
   */
  async cleanupByEventType(
    eventType: string,
    daysOld: number
  ): Promise<{ deleted: number }> {
    const db = getPrisma();
    if (!db) {
      return { deleted: 0 };
    }

    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    try {
      const deleted = await db.toolExecutionLog.deleteMany({
        where: {
          eventType: eventType as any,
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      console.log(
        `[db-cleanup] Deleted ${deleted.count} ${eventType} logs older than ${daysOld} days`
      );
      return { deleted: deleted.count };
    } catch (error) {
      console.warn("[db-cleanup] Cleanup failed:", error);
      return { deleted: 0 };
    }
  }
}

export const dbCleanupService = new DbCleanupService();
