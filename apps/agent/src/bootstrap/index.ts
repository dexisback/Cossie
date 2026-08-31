import { discoverTools } from "./discover-tools.js";
import { loadRules } from "./load-rules.js";
import { startPolicySubscriber } from "../services/redis-subscriber.service.js";
import { approvalService } from "../services/approval.service.js";

// The database is remote (Neon over WebSocket). A transient network blip at
// startup must not kill the agent — retry each bootstrap step before giving up.
const BOOTSTRAP_RETRIES = 3;

async function withRetry<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= BOOTSTRAP_RETRIES) {
        throw err;
      }
      const delay = 2000 * attempt;
      console.warn(
        `[bootstrap] ${label} failed (attempt ${attempt}/${BOOTSTRAP_RETRIES}), retrying in ${delay}ms:`,
        err instanceof Error ? err.message : err
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export async function bootstrap() {
  await withRetry("loadRules", () => loadRules());

  await withRetry("discoverTools", () => discoverTools());
  console.log("before policy subscriber start")
  await withRetry("startPolicySubscriber", () => startPolicySubscriber());
    console.log("after policy subscriber start")
    await withRetry("expirePendingApprovals", () => approvalService.expirePending());
    console.log("approval expire checked")

}