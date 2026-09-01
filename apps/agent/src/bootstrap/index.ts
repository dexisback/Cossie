import { discoverTools } from "./discover-tools.js";
import { loadRules } from "./load-rules.js";
import { startPolicySubscriber } from "../services/redis-subscriber.service.js";
import { approvalService } from "../services/approval.service.js";
import { warmupEmbedder } from "../services/local-embedder.js";

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

  void warmupEmbedder(); // non-blocking, lazy model load
}