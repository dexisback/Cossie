"use client";

import { useEffect, useState } from "react";
import {
  Search,
  X,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { ApprovalDetailsDrawer } from "./ApprovalDetailsDrawer";
import { api } from "../lib/api";
import { RequestTimeline } from "./RequestTimeline";

function formatToolName(toolName: string): { title: string; category: string } {
  if (!toolName) return { title: "Unknown Tool", category: "System Tool" };
  if (toolName.includes(":")) {
    const [cat, act] = toolName.split(":");
    const title = act
      .split(/[_-]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    const category = cat.charAt(0).toUpperCase() + cat.slice(1) + " Tool";
    return { title, category };
  }
  const title = toolName
    .split(/[_-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return { title, category: "System Tool" };
}

export function AuditLogsView() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [viewingApproval, setViewingApproval] = useState<any | null>(null);

  async function fetchLogs() {
    try {
      setLoading(true);
      const res = await api.get("/api/logs");
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      setError("Failed to fetch logs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(
    (log) =>
      log.toolName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.reason &&
        log.reason.toLowerCase().includes(searchQuery.toLowerCase())) ||
      log.decision.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  function getDecisionTextColor(decision: string) {
    switch (decision) {
      case "ALLOW":
        return "text-status-ok";
      case "DENY":
        return "text-status-critical";
      case "REQUIRE_APPROVAL":
        return "text-status-warn";
      default:
        return "text-muted-foreground";
    }
  }

  function getRiskTextColor(risk: string) {
    switch (risk) {
      case "LOW":
        return "text-status-ok";
      case "MEDIUM":
        return "text-status-info";
      case "HIGH":
        return "text-status-warn";
      case "CRITICAL":
        return "text-status-critical";
      default:
        return "text-muted-foreground";
    }
  }

  if (loading && logs.length === 0) {
    return (
      <div className="space-y-8 max-w-7xl mx-auto animate-pulse">
        <div className="space-y-1.5">
          <div className="h-5 w-44 bg-muted/50 rounded" />
          <div className="h-3 w-96 bg-muted/30 rounded" />
        </div>

        <div className="flex items-center gap-2 p-1.5 rounded-xl border border-border/50 bg-card/30">
          <div className="h-7 flex-1 max-w-md bg-muted/30 rounded-lg" />
          <div className="h-7 w-20 bg-muted/20 rounded-lg" />
          <div className="h-7 w-16 bg-muted/20 rounded-lg" />
          <div className="h-7 w-16 bg-muted/20 rounded-lg" />
          <div className="ml-auto h-5 w-14 bg-muted/20 rounded-md" />
        </div>

        <div className="border border-border/50 rounded-xl overflow-hidden bg-card/30">
          <div className="grid grid-cols-6 gap-4 px-4 py-3 border-b border-border/40 bg-muted/10">
            {[
              "Timestamp",
              "Tool Name",
              "Risk Level",
              "Decision",
              "Status",
              "",
            ].map((_, i) => (
              <div key={i} className="h-2.5 bg-muted/40 rounded w-3/4" />
            ))}
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-6 gap-4 px-4 py-3.5 border-b border-border/30 last:border-0"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="h-3 bg-muted/30 rounded w-5/6" />
              <div className="h-3 bg-muted/40 rounded w-4/5" />
              <div className="h-3 bg-muted/25 rounded w-1/2" />
              <div className="h-3 bg-muted/25 rounded w-3/5" />
              <div className="h-3 bg-muted/25 rounded w-2/5" />
              <div className="h-3 bg-muted/20 rounded w-1/3 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-1.5 pb-2">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Guardrail Audit Logs
        </h2>
        <p className="text-xs text-muted-foreground">
          Review and audit the historical logs of all tool requests, risk
          assessments, and policy executions.
        </p>
      </div>

      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-1.5 rounded-xl border border-border/80 bg-card/30">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={13}
            />
            <input
              type="text"
              placeholder="Search logs by tool, action, or decision..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-4 py-1.5 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent transition-[border-color,box-shadow] duration-200 ease-out"
            />
          </div>

          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/60 bg-card text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-[color,background-color,border-color] duration-180 ease-out active:scale-[0.96]">
              <span>Status</span>
              <ChevronDown size={10} className="opacity-60" />
            </button>
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/60 bg-card text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-[color,background-color,border-color] duration-180 ease-out active:scale-[0.96]">
              <span>Risk</span>
              <ChevronDown size={10} className="opacity-60" />
            </button>
            <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/60 bg-card text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-[color,background-color,border-color] duration-180 ease-out active:scale-[0.96]">
              <span>Date</span>
              <ChevronDown size={10} className="opacity-60" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-center shrink-0">
          <span className="text-[10px] text-muted-foreground bg-muted/40 border border-border/80 px-2 py-0.5 rounded-md font-mono font-medium">
            {filteredLogs.length} {filteredLogs.length === 1 ? "log" : "logs"}
          </span>
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <div className="text-center py-20 border border-border rounded-2xl bg-card/35 backdrop-blur-sm">
          <ShieldAlert
            className="mx-auto text-muted-foreground mb-3"
            size={24}
          />
          <p className="text-xs text-muted-foreground">
            No audit logs matching filters found.
          </p>
        </div>
      ) : (
        <div className="border border-border/80 rounded-xl overflow-hidden bg-card/45 backdrop-blur-sm shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border/70 bg-muted/30 text-muted-foreground font-mono font-medium uppercase tracking-wider text-[9px] select-none">
                <th className="p-4 font-semibold">Timestamp</th>
                <th className="p-4 font-semibold">Tool Name</th>
                <th className="p-4 font-semibold">Risk Level</th>
                <th className="p-4 font-semibold">Decision</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 text-right font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredLogs.map((log, index) => {
                const toolInfo = formatToolName(log.toolName);
                return (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-muted/25 transition-[background-color] duration-180 ease-out align-middle cursor-pointer group"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <td
                      className="p-4 text-muted-foreground font-mono text-[10px] whitespace-nowrap"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="p-4 truncate max-w-xs border-l border-border/30">
                      <div className="flex flex-col min-w-[120px]">
                        <span className="font-semibold text-foreground text-xs leading-normal group-hover:text-accent transition-colors duration-180">
                          {toolInfo.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground mt-0.5 leading-none">
                          {toolInfo.category}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 border-l border-border/30">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide ${getRiskTextColor(log.riskLevel)} bg-current/10`}
                      >
                        {log.riskLevel || "N/A"}
                      </span>
                    </td>
                    <td className="p-4 border-l border-border/30">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide ${getDecisionTextColor(log.decision)} bg-current/10`}
                      >
                        {log.decision}
                      </span>
                    </td>
                    <td className="p-4 border-l border-border/30">
                      <span
                        className={`inline-flex items-center gap-1.5 font-medium text-[11px] ${
                          log.executed
                            ? "text-status-ok"
                            : "text-status-critical"
                        }`}
                      >
                        {log.executed ? (
                          <>
                            <CheckCircle2 size={12} className="opacity-90" />
                            <span>Executed</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle size={12} className="opacity-90" />
                            <span>Blocked</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td
                      className="p-4 text-right border-l border-border/30"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted/85 border border-border/60 hover:border-border rounded-md transition-[color,background-color,border-color,transform] duration-180 ease-out active:scale-[0.96] cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-card border border-border/80 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6 border-b border-border/50 pb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Log Inspector
                </h3>
                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                  ID: {selectedLog.id}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 hover:bg-muted/60 text-muted-foreground rounded-lg cursor-pointer transition-[background-color,transform] duration-180 ease-out active:scale-[0.96]"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-5 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-background/40 p-4 rounded-xl border border-border/85">
                <div>
                  <span className="text-[9px] font-mono font-bold uppercase text-muted-foreground">
                    Tool
                  </span>
                  <p className="font-semibold text-foreground mt-0.5 truncate">
                    {formatToolName(selectedLog.toolName).title}
                  </p>
                </div>
                <div>
                  <span className="text-[9px] font-mono font-bold uppercase text-muted-foreground">
                    Risk Level
                  </span>
                  <p
                    className={`font-semibold text-xs mt-0.5 ${getRiskTextColor(selectedLog.riskLevel)}`}
                  >
                    {selectedLog.riskLevel || "N/A"}
                  </p>
                </div>
                <div>
                  <span className="text-[9px] font-mono font-bold uppercase text-muted-foreground">
                    Decision
                  </span>
                  <p
                    className={`font-semibold text-xs mt-0.5 uppercase tracking-wide ${getDecisionTextColor(selectedLog.decision)}`}
                  >
                    {selectedLog.decision}
                  </p>
                </div>
                <div>
                  <span className="text-[9px] font-mono font-bold uppercase text-muted-foreground">
                    Executed
                  </span>
                  <p
                    className={`font-semibold mt-0.5 ${selectedLog.executed ? "text-status-ok" : "text-status-critical"}`}
                  >
                    {selectedLog.executed ? "Yes" : "No (Blocked)"}
                  </p>
                </div>
              </div>

              {selectedLog.reason && (
                <div className="p-4 bg-muted/20 border border-border/80 rounded-xl">
                  <span className="text-[9px] font-mono font-bold uppercase text-muted-foreground block mb-1">
                    Decision Reason
                  </span>
                  <p className="text-foreground leading-relaxed font-medium">
                    {selectedLog.reason}
                  </p>
                </div>
              )}

              <div>
                <span className="text-[9px] font-mono font-bold uppercase text-muted-foreground block mb-1.5">
                  Request Arguments
                </span>
                <pre className="font-mono text-[10px] bg-background/50 border border-border/80 p-4 rounded-xl overflow-x-auto text-foreground max-h-48 leading-normal no-scrollbar">
                  {JSON.stringify(selectedLog.arguments, null, 2)}
                </pre>
              </div>

              {selectedLog.trace && (
                <div>
                  <span className="text-[9px] font-mono font-bold uppercase text-muted-foreground block mb-1.5">
                    Execution Trace / Output
                  </span>
                  <pre className="font-mono text-[10px] bg-background/50 border border-border/80 p-4 rounded-xl overflow-x-auto text-foreground max-h-48 leading-normal no-scrollbar">
                    {JSON.stringify(selectedLog.trace, null, 2)}
                  </pre>
                </div>
              )}

              <div className="border-t border-border/50 pt-4">
                <RequestTimeline targetLog={selectedLog} allLogs={logs} />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[10px] text-muted-foreground border-t border-border/50 pt-4">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  {selectedLog.conversationId && (
                    <div>
                      Conversation:{" "}
                      <span
                        className="font-mono text-foreground"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {selectedLog.conversationId}
                      </span>
                    </div>
                  )}
                  <div>
                    Logged At:{" "}
                    <span className="text-foreground">
                      {new Date(selectedLog.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
                {selectedLog.trace?.approvalId && (
                  <button
                    onClick={() => {
                      const approvalObj = {
                        id: selectedLog.trace.approvalId,
                        toolName: selectedLog.toolName,
                        arguments: selectedLog.arguments,
                        status:
                          selectedLog.eventType === "APPROVAL_APPROVED"
                            ? "APPROVED"
                            : selectedLog.eventType === "APPROVAL_REJECTED"
                              ? "REJECTED"
                              : "PENDING",
                        requestedAt: selectedLog.createdAt,
                        resolvedAt:
                          selectedLog.eventType === "APPROVAL_APPROVED" ||
                          selectedLog.eventType === "APPROVAL_REJECTED"
                            ? selectedLog.createdAt
                            : undefined,
                        resolutionReason:
                          selectedLog.eventType === "APPROVAL_REJECTED"
                            ? "Rejected by administrator"
                            : selectedLog.eventType === "APPROVAL_APPROVED"
                              ? "Approved by administrator"
                              : undefined,
                      };
                      setViewingApproval(approvalObj);
                    }}
                    className="px-3 py-1.5 border border-accent/20 hover:border-accent/40 bg-accent/5 hover:bg-accent/10 text-accent text-[10px] font-semibold rounded-lg cursor-pointer transition-[background-color,border-color,transform] duration-180 ease-out active:scale-[0.96]"
                  >
                    View Approval Details
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {viewingApproval && (
        <ApprovalDetailsDrawer
          approval={viewingApproval}
          onClose={() => setViewingApproval(null)}
          onSuccess={() => {
            fetchLogs();
          }}
        />
      )}
    </div>
  );
}
