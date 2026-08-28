"use client";

import { useState } from "react";
import { X, Copy, Check, Terminal, MessageSquare, Shield } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { RequestTimeline } from "./RequestTimeline";
import { sound } from "./SoundSystem";
import { api } from "../lib/api";
import { useQuery } from "@tanstack/react-query";

interface ApprovalDetailsDrawerProps {
  approval: any;
  onClose: () => void;
  onSuccess: () => void;
}

export function ApprovalDetailsDrawer({ approval, onClose, onSuccess }: ApprovalDetailsDrawerProps) {
  const [resolving, setResolving] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedArgs, setCopiedArgs] = useState(false);

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["logs", approval?.id],
    queryFn: () =>
      api.get(`/api/logs?approvalId=${approval.id}`).then((r) => {
        if (!r.ok) throw new Error("Failed to load logs");
        return r.json();
      }),
    enabled: !!approval?.id,
    staleTime: 30_000,
  });

  if (!approval) return null;

  const matchedLog = logs.find((l: any) => l.trace?.approvalId === approval.id);
  const riskLevel = matchedLog?.riskLevel || "MEDIUM";
  const matchedRule = matchedLog?.trace?.matchedRule || "Approval Required";
  const reason = matchedLog?.reason || "Approval required";

  async function copyToClipboard(text: string, isArgs: boolean) {
    try {
      await navigator.clipboard.writeText(text);
      if (isArgs) {
        setCopiedArgs(true);
        setTimeout(() => setCopiedArgs(false), 2000);
      } else {
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
      }
      toast.success("Copied to clipboard");
    } catch (err) {
      toast.error("Failed to copy");
    }
  }

  async function handleResolve(action: "approve" | "reject") {
    try {
      setResolving(true);
      const res = await api.post(`/api/approvals/${approval.id}/${action}`);

      if (res.ok) {
        sound.playSuccess();
        if (action === "approve") {
          toast.success("Approval approved successfully.");
        } else {
          toast.success("Approval rejected.");
        }
        onSuccess();
        onClose();
      } else {
        sound.playError();
        toast.error(`Failed to resolve approval: ${action}`);
      }
    } catch (err) {
      sound.playError();
      toast.error("Error communicating with server");
    } finally {
      setResolving(false);
    }
  }

  function getStatusBadge(status: string) {
    switch (status?.toUpperCase()) {
      case "PENDING":
        return "chip chip-warn";
      case "APPROVED":
        return "chip chip-ok";
      case "REJECTED":
        return "chip chip-critical";
      case "EXPIRED":
        return "bg-stone-500/10 text-stone-500 border border-stone-500/20";
      default:
        return "bg-muted text-muted-foreground border border-border";
    }
  }

  function getRiskBadge(risk: string) {
    switch (risk?.toUpperCase()) {
      case "LOW":
        return "chip chip-ok";
      case "MEDIUM":
        return "chip chip-info";
      case "HIGH":
        return "chip chip-warn";
      case "CRITICAL":
        return "chip chip-critical font-semibold";
      default:
        return "bg-muted text-muted-foreground border border-border";
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-background/40 backdrop-blur-sm transition-opacity"
        />

        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", mass: 1.2, stiffness: 180, damping: 20 }}
          className="relative w-full sm:max-w-md md:max-w-lg app-glass border-y-0 border-r-0 h-full flex flex-col shadow-2xl z-10 overflow-hidden"
        >
          <div className="h-16 border-b border-border bg-transparent flex items-center justify-between px-6 shrink-0">
            <h3 className="text-sm font-semibold text-foreground">Approval Details</h3>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-muted/60 text-muted-foreground rounded-lg cursor-pointer transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {logsLoading ? (
              <div className="space-y-6 animate-pulse">
                <div className="h-20 bg-muted rounded-2xl" />
                <div className="h-24 bg-muted rounded-2xl" />
                <div className="h-32 bg-muted rounded-2xl" />
                <div className="h-20 bg-muted rounded-2xl" />
              </div>
            ) : (
              <>
                <div className="bg-background/40 p-5 rounded-2xl border border-border space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-medium uppercase text-muted-foreground">Approval Status</span>
                    <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${getStatusBadge(approval.status)}`}>
                      {approval.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-medium uppercase text-muted-foreground">Created At</span>
                    <span className="text-xs text-foreground font-medium">
                      {new Date(approval.requestedAt || approval.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[10px] font-mono font-medium uppercase text-muted-foreground">Approval ID</span>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[160px]">
                        {approval.id}
                      </span>
                      <button
                        onClick={() => copyToClipboard(approval.id, false)}
                        className="p-1 border border-border hover:border-accent/40 bg-background/50 text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer"
                      >
                        {copiedId ? <Check size={10} className="text-status-ok" /> : <Copy size={10} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
                    Tool Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[9px] font-mono font-medium uppercase text-muted-foreground">Tool Name</span>
                      <p className="font-mono text-xs font-semibold text-foreground mt-0.5 truncate">{approval.toolName}</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-mono font-medium uppercase text-muted-foreground">Risk Level</span>
                      <div className="mt-0.5">
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-semibold uppercase tracking-wider border ${getRiskBadge(riskLevel)}`}>
                          {riskLevel}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[9px] font-mono font-medium uppercase text-muted-foreground">Matched Rule</span>
                      <p className="text-xs font-medium text-foreground mt-0.5">{matchedRule}</p>
                    </div>
                    <div>
                      <span className="text-[9px] font-mono font-medium uppercase text-muted-foreground">Reason</span>
                      <p className="text-xs font-medium text-foreground mt-0.5">{reason}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Arguments</h4>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(approval.arguments, null, 2), true)}
                      className="p-1 border border-border hover:border-accent/40 bg-background/50 text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer flex items-center gap-1 text-[9px] font-semibold"
                    >
                      {copiedArgs ? <Check size={10} className="text-status-ok" /> : <Copy size={10} />}
                      {copiedArgs ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <pre className="text-[10px] font-mono bg-background/50 border border-border p-3.5 rounded-xl overflow-x-auto text-foreground max-h-48 leading-relaxed">
                    {JSON.stringify(approval.arguments, null, 2)}
                  </pre>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Conversation</h4>
                  <div className="p-3 bg-background/30 border border-border rounded-xl flex items-start gap-2">
                    <MessageSquare size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground font-medium italic">
                      Conversation context unavailable.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Policy Decision</h4>
                  <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-2">
                    <div className="flex items-center gap-2">
                      <Shield size={14} className="text-status-warn" />
                      <span className="text-[10px] font-mono font-semibold uppercase text-status-warn">
                        Decision: REQUIRE_APPROVAL
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed font-semibold">
                      This tool execution matched an active approval rule and requires administrator authorization before execution.
                    </p>
                  </div>
                </div>

                <div className="border-t border-border pt-4">
                  <RequestTimeline 
                    targetLog={matchedLog || {
                      id: approval.id,
                      toolName: approval.toolName,
                      arguments: approval.arguments,
                      decision: "REQUIRE_APPROVAL",
                      riskLevel: "MEDIUM",
                      eventType: "APPROVAL_CREATED",
                      createdAt: approval.requestedAt || approval.createdAt,
                      trace: { approvalId: approval.id, matchedRule: "Approval Required" }
                    }} 
                    allLogs={logs} 
                  />
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
                    Audit Information
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created At</span>
                      <span className="font-medium text-foreground">
                        {new Date(approval.requestedAt || approval.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {approval.status !== "PENDING" && approval.resolvedAt && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Resolved At</span>
                        <span className="font-medium text-foreground">
                          {new Date(approval.resolvedAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {approval.resolutionReason && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Resolution Reason</span>
                        <span className="font-medium text-foreground">{approval.resolutionReason}</span>
                      </div>
                    )}
                  </div>
                </div>

                <details className="group border border-border rounded-xl bg-background/25 overflow-hidden">
                  <summary className="flex items-center justify-between p-3.5 text-xs font-semibold text-muted-foreground cursor-pointer select-none group-open:border-b group-open:border-border transition-colors hover:text-foreground">
                    <span className="flex items-center gap-1.5">
                      <Terminal size={14} />
                      Raw Metadata
                    </span>
                    <span className="text-[10px] font-mono uppercase bg-muted px-1.5 py-0.5 rounded text-muted-foreground tracking-wider font-medium">
                      Advanced
                    </span>
                  </summary>
                  <div className="p-3.5 bg-background/50">
                    <pre className="text-[9px] font-mono overflow-x-auto text-muted-foreground max-h-48 leading-relaxed">
                      {JSON.stringify(approval, null, 2)}
                    </pre>
                  </div>
                </details>
              </>
            )}
          </div>

          {approval.status?.toUpperCase() === "PENDING" && (
            <div className="p-6 bg-transparent border-t border-border flex items-center justify-end gap-3 shrink-0">
              <button
                disabled={resolving}
                onClick={() => handleResolve("reject")}
                className="px-5 py-2.5 border border-rose-500/20 hover:border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 text-status-critical text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-50 transition-colors"
              >
                Reject
              </button>
              <button
                disabled={resolving}
                onClick={() => handleResolve("approve")}
                className="app-btn-3d px-5 py-2.5 bg-accent text-accent-foreground text-xs font-semibold rounded-xl cursor-pointer disabled:opacity-50 transition-all"
              >
                Approve
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
