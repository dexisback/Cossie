import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";

const localEnvPath = path.resolve(process.cwd(), ".env");

if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
} else {
  dotenv.config();
}

function ago(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000);
}

async function main() {
  const { prisma } = await import("@cossie/db");

  // Wipe in FK-safe order so the seed is idempotent.
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.toolExecutionLog.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.rule.deleteMany();
  await prisma.toolRiskOverride.deleteMany();
  await prisma.toolCatalog.deleteMany();

  // ---------- Rules ----------
  const rules = [
    {
      name: "Block Dangerous Commands",
      description: "Hard block destructive commands that can never be run.",
      type: "BLOCK_TOOL",
      priority: 1,
      enabled: true,
      config: { toolNames: ["delete_server", "drop_database"] },
    },
    {
      name: "Restart Server Approval",
      description: "Require human approval before restarting any server.",
      type: "REQUIRE_APPROVAL",
      priority: 10,
      enabled: true,
      config: { toolNames: ["restart_server"] },
    },
    {
      name: "Rollback Release Approval",
      description: "Rollbacks need manual authorization.",
      type: "REQUIRE_APPROVAL",
      priority: 15,
      enabled: true,
      config: { toolNames: ["rollback_release"] },
    },
    {
      name: "Deploy Release Approval",
      description: "Deployments require an approver to review the target + version.",
      type: "REQUIRE_APPROVAL",
      priority: 20,
      enabled: true,
      config: { toolNames: ["deploy_release"] },
    },
    {
      name: "Version Format Validation",
      description: "Enforce semantic versioning on deploy/rollback inputs.",
      type: "INPUT_VALIDATION",
      priority: 30,
      enabled: true,
      config: {
        toolNames: ["deploy_release", "rollback_release"],
        pattern: "^v?\\d+\\.\\d+\\.\\d+$",
      },
    },
    {
      name: "Daily Deployment Budget",
      description: "Cap the number of deployments allowed per day.",
      type: "BUDGET_LIMIT",
      priority: 40,
      enabled: true,
      config: { maxDeploymentsPerDay: 25 },
    },
    {
      name: "Suspicious Input Risk Escalation",
      description: "Escalate risk when arguments contain dangerous patterns.",
      type: "RISK_BASED",
      priority: 50,
      enabled: true,
      config: { patterns: ["rm -rf", "curl | sh", "; DROP TABLE"] },
    },
  ];

  await prisma.rule.createMany({ data: rules as any });

  // ---------- Tool Catalog ----------
  const catalog = [
    { toolName: "list_servers", description: "List all infrastructure servers and their current status.", serverId: "infra-mcp", risk: "LOW" },
    { toolName: "get_server_logs", description: "Retrieve recent logs for a given server.", serverId: "infra-mcp", risk: "LOW" },
    { toolName: "deploy_release", description: "Deploy a release to a server.", serverId: "infra-mcp", risk: "HIGH" },
    { toolName: "restart_server", description: "Restart a server.", serverId: "infra-mcp", risk: "HIGH" },
    { toolName: "rollback_release", description: "Rollback a deployment to a previous version.", serverId: "infra-mcp", risk: "CRITICAL" },
    { toolName: "context7:resolve-library-id", description: "Resolve a library name to its Context7 docs id.", serverId: "context7", risk: "LOW" },
    { toolName: "context7:get-library-docs", description: "Fetch documentation snippets for a library.", serverId: "context7", risk: "LOW" },
    { toolName: "context7:query-docs", description: "Run a semantic query against library documentation.", serverId: "context7", risk: "MEDIUM" },
  ];

  await prisma.toolCatalog.createMany({
    data: catalog.map((t) => ({
      toolName: t.toolName,
      description: t.description,
      serverId: t.serverId,
      inferredRisk: t.risk,
      finalRisk: t.risk,
      lastSeenAt: ago(5),
    })) as any,
  });

  // ---------- Tool Risk Overrides ----------
  await prisma.toolRiskOverride.createMany({
    data: [
      { toolName: "get_server_logs", riskLevel: "LOW" },
      { toolName: "deploy_release", riskLevel: "CRITICAL" },
    ] as any,
  });

  // ---------- Approvals ----------
  const pendingApprovals = await Promise.all([
    prisma.approval.create({
      data: {
        toolName: "restart_server",
        arguments: { serverId: "api-prod" },
        status: "PENDING",
        requestedAt: ago(3),
      },
    }),
    prisma.approval.create({
      data: {
        toolName: "deploy_release",
        arguments: { serverId: "worker-prod", version: "v2.4.1" },
        status: "PENDING",
        requestedAt: ago(12),
      },
    }),
    prisma.approval.create({
      data: {
        toolName: "rollback_release",
        arguments: { serverId: "staging", version: "v2.3.9" },
        status: "PENDING",
        requestedAt: ago(28),
      },
    }),
  ]);

  const approved = await prisma.approval.create({
    data: {
      toolName: "restart_server",
      arguments: { serverId: "worker-prod" },
      status: "APPROVED",
      requestedAt: ago(120),
      resolvedAt: ago(115),
      resolutionReason: "Scheduled maintenance window approved",
    },
  });

  const rejected = await prisma.approval.create({
    data: {
      toolName: "deploy_release",
      arguments: { serverId: "api-prod", version: "v2.5.0" },
      status: "REJECTED",
      requestedAt: ago(200),
      resolvedAt: ago(198),
      resolutionReason: "Version not ready for production",
    },
  });

  await prisma.approval.create({
    data: {
      toolName: "restart_server",
      arguments: { serverId: "staging" },
      status: "EXPIRED",
      requestedAt: ago(400),
      resolvedAt: ago(370),
      resolutionReason: "Approval expired",
    },
  });

  // ---------- Conversations + Messages ----------
  const convo1 = await prisma.conversation.create({
    data: {
      totalTokens: 1240,
      createdAt: ago(90),
      messages: {
        create: [
          { role: "USER", content: "Can you check the health of all our servers?", createdAt: ago(90) },
          { role: "ASSISTANT", content: "Sure, let me list the servers for you.", createdAt: ago(89) },
          { role: "TOOL", content: JSON.stringify([{ name: "api-prod", status: "healthy" }, { name: "worker-prod", status: "healthy" }]), createdAt: ago(89) },
          { role: "ASSISTANT", content: "All servers are healthy.", createdAt: ago(88) },
        ],
      },
    },
  });

  const convo2 = await prisma.conversation.create({
    data: {
      totalTokens: 860,
      createdAt: ago(60),
      messages: {
        create: [
          { role: "USER", content: "Deploy v2.4.1 to worker-prod please.", createdAt: ago(60) },
          { role: "ASSISTANT", content: "That deployment requires approval. I've queued it for review.", createdAt: ago(59) },
        ],
      },
    },
  });

  await prisma.conversation.create({
    data: {
      totalTokens: 2100,
      createdAt: ago(30),
      messages: {
        create: [
          { role: "USER", content: "Summarize the Context7 docs for the Neon Postgres library.", createdAt: ago(30) },
          { role: "TOOL", content: JSON.stringify({ library: "neon", docIds: ["neon/getting-started", "neon/connection"] }), createdAt: ago(29) },
          { role: "ASSISTANT", content: "Here's a summary of the Neon connection guide...", createdAt: ago(28) },
        ],
      },
    },
  });

  // ---------- Tool Execution Logs (audit trail) ----------
  await prisma.toolExecutionLog.createMany({
    data: [
      {
        conversationId: convo1.id,
        toolName: "list_servers",
        riskLevel: "LOW",
        arguments: {},
        decision: "ALLOW",
        reason: "Low-risk read-only tool",
        trace: { matchedRule: null, approvalId: null },
        executed: true,
        eventType: "TOOL_EXECUTION",
        createdAt: ago(89),
      },
      {
        conversationId: convo2.id,
        toolName: "deploy_release",
        riskLevel: "CRITICAL",
        arguments: { serverId: "worker-prod", version: "v2.4.1" },
        decision: "REQUIRE_APPROVAL",
        reason: "Matched 'Deploy Release Approval' rule",
        trace: { matchedRule: "Deploy Release Approval", approvalId: pendingApprovals[1].id },
        executed: false,
        eventType: "APPROVAL_CREATED",
        createdAt: ago(59),
      },
      {
        conversationId: null,
        toolName: "restart_server",
        riskLevel: "HIGH",
        arguments: { serverId: "api-prod" },
        decision: "REQUIRE_APPROVAL",
        reason: "Matched 'Restart Server Approval' rule",
        trace: { matchedRule: "Restart Server Approval", approvalId: pendingApprovals[0].id },
        executed: false,
        eventType: "APPROVAL_CREATED",
        createdAt: ago(3),
      },
      {
        conversationId: null,
        toolName: "rollback_release",
        riskLevel: "CRITICAL",
        arguments: { serverId: "staging", version: "v2.3.9" },
        decision: "REQUIRE_APPROVAL",
        reason: "Matched 'Rollback Release Approval' rule",
        trace: { matchedRule: "Rollback Release Approval", approvalId: pendingApprovals[2].id },
        executed: false,
        eventType: "APPROVAL_CREATED",
        createdAt: ago(28),
      },
      {
        conversationId: null,
        toolName: "restart_server",
        riskLevel: "HIGH",
        arguments: { serverId: "worker-prod" },
        decision: "ALLOW",
        reason: "Approved by administrator",
        trace: { matchedRule: "Restart Server Approval", approvalId: approved.id },
        executed: true,
        eventType: "APPROVAL_APPROVED",
        createdAt: ago(115),
      },
      {
        conversationId: null,
        toolName: "deploy_release",
        riskLevel: "CRITICAL",
        arguments: { serverId: "api-prod", version: "v2.5.0" },
        decision: "DENY",
        reason: "Rejected by administrator",
        trace: { matchedRule: "Deploy Release Approval", approvalId: rejected.id },
        executed: false,
        eventType: "APPROVAL_REJECTED",
        createdAt: ago(198),
      },
      {
        conversationId: null,
        toolName: "deploy_release",
        riskLevel: "HIGH",
        arguments: { serverId: "staging", version: "not-a-version" },
        decision: "VALIDATION_FAILED",
        reason: "Version does not match semantic versioning pattern",
        trace: { matchedRule: "Version Format Validation", approvalId: null },
        executed: false,
        eventType: "TOOL_EXECUTION",
        createdAt: ago(240),
      },
      {
        conversationId: null,
        toolName: "delete_server",
        riskLevel: "CRITICAL",
        arguments: { serverId: "api-prod" },
        decision: "DENY",
        reason: "Matched 'Block Dangerous Commands' rule",
        trace: { matchedRule: "Block Dangerous Commands", approvalId: null },
        executed: false,
        eventType: "TOOL_EXECUTION",
        createdAt: ago(300),
      },
      {
        conversationId: convo1.id,
        toolName: "context7:get-library-docs",
        riskLevel: "LOW",
        arguments: { libraryId: "/neon" },
        decision: "ALLOW",
        reason: "Low-risk read-only tool",
        trace: { matchedRule: null, approvalId: null },
        executed: true,
        eventType: "TOOL_EXECUTION",
        createdAt: ago(29),
      },
      {
        conversationId: convo1.id,
        toolName: "context7:query-docs",
        riskLevel: "MEDIUM",
        arguments: { query: "SELECT * FROM users WHERE id = '1; DROP TABLE users;--'" },
        decision: "DENY",
        reason: "Possible prompt injection / SQL injection pattern detected",
        trace: { matchedRule: "Suspicious Input Risk Escalation", approvalId: null },
        executed: false,
        eventType: "PROMPT_INJECTION",
        createdAt: ago(22),
      },
    ] as any,
  });

  const counts = {
    rules: await prisma.rule.count(),
    toolCatalog: await prisma.toolCatalog.count(),
    toolRiskOverride: await prisma.toolRiskOverride.count(),
    approvals: await prisma.approval.count(),
    toolExecutionLogs: await prisma.toolExecutionLog.count(),
    conversations: await prisma.conversation.count(),
    messages: await prisma.message.count(),
  };

  console.log("Seed complete:", counts);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
