"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  MinusCircle,
  User,
  Shield,
  Cpu,
  Scale,
  Zap,
  ArrowRight,
} from "lucide-react";

interface TimelineNode {
  title: string;
  timestamp: string;
  status: "Completed" | "Current" | "Skipped" | "Failed" | "Pending";
  icon: "user" | "shield" | "cpu" | "policy" | "decision" | "clock" | "play" | "chat";
  details: Record<string, any>;
}

interface RequestTimelineProps {
  targetLog?: any;
  allLogs?: any[];
  livePrompt?: string | null;
  isLiveRunning?: boolean;
}

export function RequestTimeline({
  targetLog,
  allLogs = [],
  livePrompt,
  isLiveRunning,
}: RequestTimelineProps) {
  const [expandedNodeIndex, setExpandedNodeIndex] = useState<number | null>(null);

  // ── LIVE RUNNING IN-FLIGHT STATE ──────────────────────────────────────
  if (isLiveRunning) {
    const liveStages: TimelineNode[] = [
      {
        title: "User Prompt",
        timestamp: new Date().toISOString(),
        status: "Completed",
        icon: "user",
        details: {
          "Input Mode": "Live Terminal / Scenario Run",
          "Prompt": livePrompt || "Executing request...",
        },
      },
      {
        title: "Prompt Security Scan",
        timestamp: new Date().toISOString(),
        status: "Current",
        icon: "shield",
        details: {
          "Status": "ANALYZING",
          "Analysis": "Scanning patterns, embeddings, and prompt guardrails...",
        },
      },
      {
        title: "LLM Reasoning & Function Selection",
        timestamp: new Date().toISOString(),
        status: "Pending",
        icon: "cpu",
        details: {
          "Status": "AWAITING_MODEL",
          "Info": "Model reasoning about which MCP tool to invoke...",
        },
      },
      {
        title: "Policy Evaluation",
        timestamp: new Date().toISOString(),
        status: "Pending",
        icon: "policy",
        details: {
          "Status": "AWAITING_POLICY",
          "Info": "Will evaluate proposed tool against active security rules.",
        },
      },
      {
        title: "Decision Authorization",
        timestamp: new Date().toISOString(),
        status: "Pending",
        icon: "decision",
        details: {
          "Status": "PENDING",
          "Info": "Determines ALLOW, DENY, or REQUIRE_APPROVAL.",
        },
      },
      {
        title: "Tool Execution (MCP)",
        timestamp: new Date().toISOString(),
        status: "Pending",
        icon: "play",
        details: {
          "Status": "PENDING",
          "Info": "Executes on MCP server only if permitted by policy.",
        },
      },
      {
        title: "Assistant Responded",
        timestamp: new Date().toISOString(),
        status: "Pending",
        icon: "chat",
        details: {
          "Status": "PENDING",
          "Info": "Final sanitized response delivered to console.",
        },
      },
    ];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3 shrink-0">
          <div className="flex flex-col gap-0.5">
            <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              Request Journey
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono bg-accent/15 text-accent border border-accent/25 animate-pulse">
                LIVE RUNNING
              </span>
            </h4>
            <p className="text-[10px] text-muted-foreground">
              Tracing current AI request in real-time.
            </p>
          </div>
        </div>

        <div className="relative pl-6 space-y-6">
          {liveStages.map((stage, idx) => {
            const isProcessed = stage.status === "Completed" || stage.status === "Failed";
            const isCurrent = stage.status === "Current";
            const isExpanded = expandedNodeIndex === idx;
            const firstDetail = Object.values(stage.details)[0] || "";

            return (
              <div key={idx} className="relative z-10 pl-6 pb-2 last:pb-0">
                {idx < liveStages.length - 1 && (
                  <div
                    className={`absolute left-[-19.5px] top-[14px] bottom-[-30px] w-[1px] z-0 transition-colors duration-200 ${
                      isProcessed ? "bg-[#3ecf8e]/60" : isCurrent ? "bg-accent/60" : "bg-white/10"
                    }`}
                  />
                )}

                <span
                  className={`absolute left-[-24px] top-[4px] h-2.5 w-2.5 rounded-none z-10 transition-all duration-200 ${
                    isProcessed
                      ? "bg-[#3ecf8e] scale-110"
                      : isCurrent
                      ? "bg-accent animate-pulse scale-125 ring-2 ring-accent/40"
                      : "bg-white/15"
                  }`}
                />

                <div className="space-y-1">
                  <span className="text-[9px] font-mono text-muted-foreground/75 uppercase tracking-wider block">
                    // STEP 0{idx + 1}
                  </span>

                  <div
                    onClick={() => setExpandedNodeIndex(isExpanded ? null : idx)}
                    className="flex items-center justify-between gap-2 group cursor-pointer"
                  >
                    <h4
                      className={`text-sm font-bold leading-snug tracking-tight ${
                        isCurrent
                          ? "text-accent"
                          : isProcessed
                          ? "text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {stage.title}
                    </h4>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded-sm border font-medium shrink-0 ${
                        isCurrent
                          ? "text-accent bg-accent/15 border-accent/30 animate-pulse"
                          : isProcessed
                          ? "text-[#3ecf8e] bg-[#3ecf8e]/10 border-[#3ecf8e]/20"
                          : "text-muted-foreground/50 bg-white/5 border-white/5"
                      }`}
                    >
                      {isCurrent ? "processing..." : stage.status === "Completed" ? "done" : "pending"}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {typeof firstDetail === "object" ? JSON.stringify(firstDetail) : String(firstDetail)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── EMPTY STATE (CLEAN REFRESH / NO RUNS YET) ─────────────────────────
  if (!targetLog) {
    return (
      <div className="space-y-4">
        <div className="border-b border-border pb-3">
          <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
            Request Journey
          </h4>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Visual trace timeline of the AI request lifecycle.
          </p>
        </div>
        <div className="app-hatch rounded-lg border border-dashed border-border/70 py-10 flex flex-col items-center justify-center gap-1">
          <p className="text-[10px] text-muted-foreground bg-background px-2 py-0.5">
            No requests traced yet
          </p>
          <p className="text-[9px] text-muted-foreground/60 bg-background px-2">
            Run a prompt or test scenario to trace its live lifecycle here.
          </p>
        </div>
      </div>
    );
  }

  // ── BUILD SCENARIO-SPECIFIC COMPLETED TRACE STAGES ────────────────────
  const stages: TimelineNode[] = [];
  const logTime = targetLog.createdAt || new Date().toISOString();
  const isPromptInjection =
    targetLog.eventType === "PROMPT_INJECTION" ||
    targetLog.toolName === "PROMPT_SECURITY" ||
    targetLog.toolName === "Prompt Injection";

  const isConversational =
    targetLog.eventType === "CONVERSATION" ||
    targetLog.toolName === "Direct Response" ||
    targetLog.toolName === "Conversation";

  // CASE 1: PROMPT INJECTION EVENT (Hard Block or Warning)
  if (isPromptInjection) {
    const isBlocked = targetLog.decision === "DENY";

    stages.push({
      title: "User Prompt",
      timestamp: logTime,
      status: "Completed",
      icon: "user",
      details: {
        "Input Mode": "AI Chat Console",
        "Prompt": targetLog.prompt || targetLog.arguments?.prompt || targetLog.arguments?.message || "Adversarial prompt test",
        "Action Type": "Security Verification",
      },
    });

    stages.push({
      title: "Prompt Security Scan",
      timestamp: logTime,
      status: isBlocked ? "Failed" : "Completed",
      icon: "shield",
      details: {
        "Status": isBlocked ? "CRITICAL THREAT DETECTED" : "SUSPICIOUS (MONITORED)",
        "Reason": targetLog.reason || "Prompt injection signature detected",
        "Layer": targetLog.trace?.layer ? `Layer 2/3 (${targetLog.trace.layer})` : "In-Memory Embeddings & Heuristics",
        "Enforcement": isBlocked ? "Hard Block (never reached model)" : "Warning injected into model context",
      },
    });

    stages.push({
      title: "LLM Reasoning & Function Selection",
      timestamp: logTime,
      status: isBlocked ? "Skipped" : "Completed",
      icon: "cpu",
      details: {
        "Status": isBlocked ? "Skipped (Halted at Security Boundary)" : "Executed with safety context",
      },
    });

    stages.push({
      title: "Policy Evaluation",
      timestamp: logTime,
      status: isBlocked ? "Skipped" : "Completed",
      icon: "policy",
      details: {
        "Status": isBlocked ? "Skipped (Bypassed due to critical input block)" : "Evaluated",
      },
    });

    stages.push({
      title: isBlocked ? "Decision: DENY (BLOCKED)" : "Decision: ALLOW (WARNED)",
      timestamp: logTime,
      status: isBlocked ? "Failed" : "Completed",
      icon: "decision",
      details: {
        "Verdict": isBlocked ? "DENY (Prompt Security Guard)" : "ALLOW",
        "Action Taken": isBlocked ? "Request blocked before tool loop" : "Monitored in audit logs",
      },
    });

    stages.push({
      title: "Tool Execution (MCP)",
      timestamp: logTime,
      status: "Skipped",
      icon: "play",
      details: {
        "Execution": "None (No external tools executed)",
      },
    });

    stages.push({
      title: "Assistant Responded",
      timestamp: logTime,
      status: "Completed",
      icon: "chat",
      details: {
        "Response": isBlocked ? "Safety refusal delivered to console" : "Response generated with constraints",
      },
    });
  }

  // CASE 2: DIRECT CONVERSATIONAL PROMPT (No tools invoked)
  else if (isConversational) {
    stages.push({
      title: "User Prompt",
      timestamp: logTime,
      status: "Completed",
      icon: "user",
      details: {
        "Input Mode": "Direct Conversation",
        "Prompt": targetLog.prompt || "User greeting / conversational query",
      },
    });

    stages.push({
      title: "Prompt Security Scan",
      timestamp: logTime,
      status: "Completed",
      icon: "shield",
      details: {
        "Status": "CLEAN",
        "Analysis": "Passed input safety scanner without incident",
      },
    });

    stages.push({
      title: "Gemini Reasoning",
      timestamp: logTime,
      status: "Completed",
      icon: "cpu",
      details: {
        "Mode": "Direct Response (No tool call required)",
      },
    });

    stages.push({
      title: "Policy Evaluation",
      timestamp: logTime,
      status: "Skipped",
      icon: "policy",
      details: {
        "Status": "No tool requested — policy evaluation bypassed",
      },
    });

    stages.push({
      title: "Output Guard (DLP)",
      timestamp: logTime,
      status: "Completed",
      icon: "shield",
      details: {
        "Status": "CLEAN (No secret leakage or system prompt disclosure)",
      },
    });

    stages.push({
      title: "Assistant Responded",
      timestamp: logTime,
      status: "Completed",
      icon: "chat",
      details: {
        "Status": "Natural language response delivered to terminal",
      },
    });
  }

  // CASE 3: STANDARD TOOL EXECUTION / POLICY BLOCKS / APPROVALS
  else {
    const isApproval = targetLog.decision === "REQUIRE_APPROVAL" || targetLog.eventType === "APPROVAL_CREATED";
    const isDeny = targetLog.decision === "DENY" || targetLog.decision === "VALIDATION_FAILED";
    const isAllow = targetLog.decision === "ALLOW";

    // 1. User Prompt
    stages.push({
      title: "User Prompt",
      timestamp: logTime,
      status: "Completed",
      icon: "user",
      details: {
        "Action Type": targetLog.eventType || "TOOL_REQUEST",
        "Tool Target": targetLog.toolName || "Infrastructure Action",
      },
    });

    // 2. Prompt Security Scan
    stages.push({
      title: "Prompt Security Scan",
      timestamp: logTime,
      status: "Completed",
      icon: "shield",
      details: {
        "Status": "CLEAN",
        "Analysis": "No prompt injection or adversarial patterns detected",
      },
    });

    // 3. Gemini Function Selection
    stages.push({
      title: "Gemini Generated Function Call",
      timestamp: logTime,
      status: "Completed",
      icon: "cpu",
      details: {
        "Selected Tool": targetLog.toolName || "tool",
        "Parameters": targetLog.arguments || {},
      },
    });

    // 4. Policy Evaluation
    const matchedRule = targetLog.matchedRule || targetLog.trace?.matchedRule || "Security Rule Guardrail";
    stages.push({
      title: "Policy Evaluation",
      timestamp: logTime,
      status: "Completed",
      icon: "policy",
      details: {
        "Evaluated Policy": matchedRule,
        "Risk Level": targetLog.riskLevel || (isDeny ? "CRITICAL" : isApproval ? "HIGH" : "LOW"),
        "Reason": targetLog.reason || "Evaluated against active rule cache",
      },
    });

    // 5. Decision Authorization
    stages.push({
      title: `Decision: ${targetLog.decision}`,
      timestamp: logTime,
      status: isDeny ? "Failed" : "Completed",
      icon: "decision",
      details: {
        "Outcome": targetLog.decision,
        "Action Taken": isApproval
          ? "Paused tool loop and routed for administrator authorization"
          : isDeny
          ? "Blocked by active policy rule (zero side effects)"
          : "Cleared for immediate MCP tool execution",
      },
    });

    // 6. Approval Handling (if approval)
    if (isApproval) {
      const approvalId = targetLog.approvalId || targetLog.trace?.approvalId;
      const resolvedLog = allLogs.find(
        (l) =>
          approvalId &&
          (l.approvalId === approvalId || l.trace?.approvalId === approvalId) &&
          (l.eventType === "APPROVAL_APPROVED" || l.eventType === "APPROVAL_REJECTED")
      );

      let approvalState: "Completed" | "Current" | "Failed" = "Current";
      let outcome = "PENDING_APPROVAL";
      let resolvedTime = "";

      if (resolvedLog) {
        approvalState = resolvedLog.eventType === "APPROVAL_APPROVED" ? "Completed" : "Failed";
        outcome = resolvedLog.eventType === "APPROVAL_APPROVED" ? "APPROVED by Admin" : "REJECTED by Admin";
        resolvedTime = resolvedLog.createdAt;
      }

      stages.push({
        title: "Approval Interception",
        timestamp: logTime,
        status: approvalState,
        icon: "clock",
        details: {
          "Approval ID": approvalId || "Pending Ticket",
          "Authorization Status": outcome,
          "Note": resolvedTime
            ? `Resolved at ${new Date(resolvedTime).toLocaleTimeString()}`
            : "Waiting for administrator action in Approvals queue",
        },
      });

      stages.push({
        title: "Tool Execution (MCP)",
        timestamp: resolvedTime || logTime,
        status: approvalState === "Completed" ? "Completed" : approvalState === "Failed" ? "Skipped" : "Pending",
        icon: "play",
        details: {
          "Tool Name": targetLog.toolName,
          "Executed": approvalState === "Completed" ? "Yes (Executed upon approval)" : "No",
          "Status": approvalState === "Completed" ? "Success" : approvalState === "Failed" ? "Skipped (Rejected)" : "Awaiting approval decision",
        },
      });
    } else {
      // Normal Execution or Deny
      stages.push({
        title: "Tool Execution (MCP)",
        timestamp: logTime,
        status: isAllow ? "Completed" : "Skipped",
        icon: "play",
        details: {
          "Tool Name": targetLog.toolName,
          "Status": isAllow ? "Executed successfully via MCP server" : "Skipped (Blocked by policy guardrails)",
        },
      });
    }

    // 7. Assistant Responded
    stages.push({
      title: "Assistant Responded",
      timestamp: logTime,
      status: "Completed",
      icon: "chat",
      details: {
        "Status": isApproval
          ? "Approval ticket details returned to console"
          : isDeny
          ? "Policy refusal message rendered to console"
          : "Synthesized tool response rendered to console",
      },
    });
  }

  function getStatusStyle(status: TimelineNode["status"]) {
    switch (status) {
      case "Completed":
        return {
          marker: "bg-[#3ecf8e]",
          text: "text-foreground font-bold",
          badge: "text-[#3ecf8e] bg-[#3ecf8e]/10 border-[#3ecf8e]/20",
          badgeText: "completed",
          line: "bg-[#3ecf8e]/60",
        };
      case "Failed":
        return {
          marker: "bg-rose-500",
          text: "text-rose-400 font-bold",
          badge: "text-rose-400 bg-rose-500/10 border-rose-500/20",
          badgeText: "blocked",
          line: "bg-rose-500/60",
        };
      case "Current":
        return {
          marker: "bg-accent animate-pulse scale-125 ring-2 ring-accent/40",
          text: "text-accent font-bold",
          badge: "text-accent bg-accent/15 border-accent/30 animate-pulse",
          badgeText: "awaiting approval",
          line: "bg-accent/60",
        };
      case "Skipped":
        return {
          marker: "bg-white/20",
          text: "text-muted-foreground/60 font-medium",
          badge: "text-muted-foreground/60 bg-white/5 border-white/10",
          badgeText: "skipped",
          line: "bg-white/10",
        };
      case "Pending":
      default:
        return {
          marker: "bg-white/15",
          text: "text-muted-foreground/40",
          badge: "text-muted-foreground/40 bg-white/5 border-white/5",
          badgeText: "pending",
          line: "bg-white/10",
        };
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 border-b border-border pb-3 shrink-0">
        <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
          Request Journey
        </h4>
        <p className="text-[10px] text-muted-foreground">
          Visual trace timeline of the AI request lifecycle.
        </p>
      </div>

      <div className="relative pl-6 space-y-6">
        {stages.map((stage, idx) => {
          const style = getStatusStyle(stage.status);
          const isExpanded = expandedNodeIndex === idx;
          const firstDetail = Object.values(stage.details)[0] || "";

          return (
            <div key={idx} className="relative z-10 pl-6 pb-2 last:pb-0">
              {idx < stages.length - 1 && (
                <div
                  className={`absolute left-[-19.5px] top-[14px] bottom-[-30px] w-[1px] z-0 transition-colors duration-200 ${style.line}`}
                />
              )}

              <span
                className={`absolute left-[-24px] top-[4px] h-2.5 w-2.5 rounded-none z-10 transition-all duration-200 ${style.marker}`}
              />

              <div className="space-y-1">
                <span className="text-[9px] font-mono text-muted-foreground/75 uppercase tracking-wider block">
                  // STEP 0{idx + 1}
                </span>

                <div
                  onClick={() => setExpandedNodeIndex(isExpanded ? null : idx)}
                  className="flex items-center justify-between gap-2 group cursor-pointer"
                >
                  <h4 className={`text-sm leading-snug tracking-tight ${style.text}`}>
                    {stage.title}
                  </h4>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded-sm border font-medium shrink-0 ${style.badge}`}
                  >
                    {style.badgeText}
                  </span>
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {typeof firstDetail === "object" ? JSON.stringify(firstDetail) : String(firstDetail)}
                </p>

                {isExpanded && (
                  <div className="mt-2 p-3 bg-background/50 border border-border rounded-sm space-y-1.5 text-[9px] animate-in slide-in-from-top-1 duration-150">
                    <h5 className="text-[9px] font-mono font-bold uppercase text-muted-foreground">
                      Stage Details
                    </h5>
                    <div className="space-y-1">
                      {Object.entries(stage.details).map(([key, val]) => (
                        <div
                          key={key}
                          className="flex justify-between gap-4 border-b border-border/20 pb-1 last:border-0 last:pb-0"
                        >
                          <span className="text-muted-foreground font-medium">{key}</span>
                          <span className="font-mono text-foreground break-all text-right">
                            {typeof val === "object" ? JSON.stringify(val, null, 2) : String(val)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
