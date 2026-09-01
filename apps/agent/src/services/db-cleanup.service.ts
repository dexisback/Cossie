import { db } from "@cossie/db";

/**
 * Periodically delete old audit logs to prevent database storage exhaustion.
 * Keeps only the last 7 days of logs.
 */
export class DbCleanupService {
  /**
   * Delete audit logs older than 7 days.
   * Run this daily via cron or on startup.
   */
  async cleanupOldLogs(): Promise<{ deleted: number }> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    try {
      const deleted = await db.auditLog.deleteMany({
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
    try {
      const count = await db.auditLog.count();
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
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    try {
      const deleted = await db.auditLog.deleteMany({
        where: {
          eventType,
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
