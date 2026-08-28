"use client";

import { useEffect, useState } from "react";
import { Check, X, Clock } from "lucide-react";
import { toast } from "sonner";
import { ApprovalDetailsDrawer } from "./ApprovalDetailsDrawer";
import { api } from "../lib/api";

export function ApprovalQueueView() {
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [selectedApproval, setSelectedApproval] = useState<any | null>(null);

  async function fetchApprovals() {
    try {
      setLoading(true);
      const res = await api.get("/api/approvals");
      const data = await res.json();
      setApprovals(data);
    } catch (err) {
      setError("Failed to fetch approval queue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchApprovals();
  }, []);

  async function resolveApproval(id: string, action: "approve" | "reject") {
    try {
      setResolvingId(id);

      const res = await api.post(`/api/approvals/${id}/${action}`);

      if (res.ok) {
        setApprovals((prev) => prev.filter((a) => a.id !== id));
        if (action === "approve") {
          toast.success("Approval approved successfully.");
        } else {
          toast.success("Approval rejected.");
        }
      } else {
        toast.error(`Failed to resolve approval: ${action}`);
      }
    } catch (err) {
      toast.error("Error resolving approval");
    } finally {
      setResolvingId(null);
    }
  }

  if (loading && approvals.length === 0) {
    return (
      <div className="space-y-6">
        <div className="space-y-1.5">
          <div className="h-4 w-48 bg-muted/50 rounded animate-pulse" />
          <div className="h-3 w-80 bg-muted/30 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="p-4 rounded-xl border border-border/40 bg-card/25 space-y-3 animate-pulse"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-36 bg-muted/50 rounded" />
                <div className="h-5 w-20 bg-muted/30 rounded-full" />
              </div>
              <div className="h-3 w-56 bg-muted/30 rounded" />
              <div className="flex gap-2 pt-1">
                <div className="h-7 w-20 bg-muted/30 rounded-lg" />
                <div className="h-7 w-20 bg-muted/30 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          Action Approval Queue
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Review and approve or reject intercepted actions that require dynamic
          manual authorization.
        </p>
      </div>

      {approvals.length === 0 ? (
        <div className="text-center py-16 rounded-2xl app-glass">
          <ApprovalGateIcon />
          <h3 className="text-xs font-semibold text-foreground">All Clear!</h3>
          <p className="text-[11px] text-muted-foreground mt-1">
            No pending action approvals are currently in the queue.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {approvals.map((approval, index) => (
            <div
              key={approval.id}
              onClick={() => setSelectedApproval(approval)}
              className="p-4 rounded-lg border border-border/60 bg-card/60 hover:border-accent/50 hover:bg-card/80 cursor-pointer flex flex-col md:flex-row md:items-start justify-between gap-5 relative overflow-hidden group transition-[background-color,border-color] duration-200 ease-out"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="space-y-3 flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-foreground group-hover:text-accent transition-colors duration-200">
                    {approval.toolName}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 chip chip-warn text-[9px] font-medium uppercase tracking-wider"
                  >
                    <Clock size={10} />
                    {approval.status}
                  </span>
                  <span
                    className="text-[10px] text-muted-foreground font-mono"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    Req ID: {approval.id.slice(0, 8)}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] font-mono font-medium uppercase text-muted-foreground block mb-1">
                    Intercepted Parameters:
                  </span>
                  <pre
                    className="text-[10px] font-mono bg-background/50 border border-border/60 p-2.5 rounded-lg overflow-x-auto text-foreground max-h-32 shadow-sm"
                    style={{ boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.05)" }}
                  >
                    {JSON.stringify(approval.arguments, null, 2)}
                  </pre>
                </div>

                <div
                  className="text-[10px] text-muted-foreground font-mono"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  Requested at:{" "}
                  {new Date(approval.requestedAt).toLocaleString()}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end md:self-start z-10">
                <button
                  disabled={resolvingId === approval.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    resolveApproval(approval.id, "reject");
                  }}
                  className="px-4 py-2 border border-rose-500/20 hover:border-rose-500/40 bg-rose-500/5 hover:bg-rose-500/15 text-status-critical text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-[background-color,border-color,transform] duration-200 ease-out active:scale-[0.96]"
                >
                  <X size={14} />
                  Reject
                </button>
                <button
                  disabled={resolvingId === approval.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    resolveApproval(approval.id, "approve");
                  }}
                  className="app-btn-3d px-4 py-2 bg-accent text-accent-foreground text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-[opacity,transform] duration-200 ease-out active:scale-[0.96]"
                >
                  <Check size={14} />
                  Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedApproval && (
        <ApprovalDetailsDrawer
          approval={selectedApproval}
          onClose={() => setSelectedApproval(null)}
          onSuccess={() => {
            fetchApprovals();
          }}
        />
      )}
    </div>
  );
}

function ApprovalGateIcon() {
  return (
    <svg
      className="w-48 h-32 mx-auto mb-4"
      viewBox="0 0 150 95.6"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <style type="text/css">{`
          .cls-0 { fill: #21242C; }
          .cls-1 { fill: url(#SVGID_1_); }
          .cls-2 { fill: #181B23; }
          .cls-3 { fill: #2E313A; }
          .cls-4 { fill: none; stroke: #171A22; stroke-width: 0.16; stroke-miterlimit: 10; }
          .cls-5 { fill: url(#SVGID_2_); }
          .cls-6 { fill: none; stroke: #464A55; stroke-width: 0.25; stroke-linecap: round; stroke-linejoin: round; }
          .cls-7 { opacity: 0.3; fill: url(#SVGID_3_); }
          .cls-8 { fill: #FF841F; }
          .cls-9 { fill: #FF8B1E; }
          .cls-10 { fill: none; stroke: #FFBF63; stroke-width: 0.19; stroke-miterlimit: 10; }
          .cls-11 { fill: #FFAC5D; }
          .cls-12 { fill: none; stroke: #FFA43D; stroke-width: 0.19; stroke-linecap: round; stroke-miterlimit: 10; }
          .cls-13 { fill: #FEA047; }
          .cls-14 { opacity: 0.5; fill: url(#SVGID_4_); }
          .cls-15 { fill: #FFBA56; }
          .cls-16 { fill: none; stroke: #FFCF53; stroke-width: 0.19; stroke-linecap: round; stroke-linejoin: round; }
          .cls-17 { opacity: 0.5; fill: url(#SVGID_5_); }

          .animated-belt {
            stroke-dasharray: 4 4;
            animation: beltFlow 2s linear infinite;
          }
          .animated-floating-gate {
            animation: gateFloat 4s ease-in-out infinite;
          }
          .animated-shadow {
            animation: shadowPulse 4s ease-in-out infinite;
          }

          @keyframes beltFlow {
            from { stroke-dashoffset: 8; }
            to { stroke-dashoffset: 0; }
          }
          @keyframes gateFloat {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-3px); }
          }
          @keyframes shadowPulse {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 0.25; }
          }
        `}</style>
        <linearGradient
          id="SVGID_1_"
          x1="48.11"
          x2="97.64"
          y1="-23.21"
          y2="68.9"
          gradientTransform="matrix(1 0 0 -1 0 68)"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#15161B" offset="0" />
          <stop stopColor="#1B1E25" offset="1" />
        </linearGradient>
        <linearGradient
          id="SVGID_2_"
          x1="7.1"
          x2="143.1"
          y1="3.831"
          y2="3.831"
          gradientTransform="matrix(1 0 0 -1 0 68)"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#464A55" offset="0" />
          <stop stopColor="#585E69" offset="1" />
        </linearGradient>
        <radialGradient
          id="SVGID_3_"
          cx="-276.1"
          cy="768.4"
          r="17.99"
          gradientTransform="matrix(-1 0 0 .85 -199.3 -628)"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#DA7A39" offset="0" />
          <stop stopColor="#FD841F" stopOpacity="0" offset="1" />
        </radialGradient>
        <linearGradient
          id="SVGID_4_"
          x1="50.89"
          x2="100.1"
          y1="27.09"
          y2="27.09"
          gradientTransform="matrix(1 0 0 -1 0 68)"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FD841F" stopOpacity=".5" offset="0" />
          <stop stopColor="#FEA047" stopOpacity=".2" offset="1" />
        </linearGradient>
        <linearGradient
          id="SVGID_5_"
          x1="59.78"
          x2="78.73"
          y1="21.85"
          y2="21.85"
          gradientTransform="matrix(1 0 0 -1 0 68)"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#151720" offset="0" />
          <stop stopColor="#15161B" stopOpacity=".2" offset="1" />
        </linearGradient>
      </defs>
      <path
        className="cls-1"
        d="m143 37-0.1 4c0 0.6-0.4 1-0.9 1.2l-78.9 45.2c-1.1 0.6-2.4 0.6-3.4 0l-51.9-29-0.7-0.5v-4.4l81-46.1c1.1-0.5 2.5-0.4 3.5 0.1l50.4 28.3c0.6 0.2 1 0.8 1 1.2z"
      />
      <path
        className="cls-2"
        d="m62.6 87.6v-4.6h-3.4v4c1 0.6 2.4 0.9 3.4 0.6z"
      />
      <path
        className="cls-3"
        d="m142.1 37.9-79.2 44.9c-1.1 0.6-2.4 0.6-3.5 0.1l-51.6-28.5c-1-0.5-1-1.6 0-2.1l80.2-45.1c1.1-0.5 2.4-0.5 3.5 0.1l50.5 28.6c1.2 0.5 1.2 1.5 0.1 2z"
      />
      <path className="cls-4" d="m44.9 76.1-22.1-12.5 61.3-36.3 22.3 13.4" />
      <path
        className="cls-5"
        d="m62.9 82.8c-1.1 0.6-2.4 0.6-3.5 0.1l-51.6-28.5c-0.5-0.2-0.7-0.6-0.7-0.9s0.3 0.6 0.7 0.8l13 7.2c0.7 0.5 1.6 0.7 2.4 0.5l62.9-35.1 20.5 12.7 0.7 0.3 0.7 0.1-62.8 34.2v2.3l-22.4-12.9v0.2l36.7 22.1c1.1 0.5 2.4 0 3.2-0.3l79.4-47.1c0.5-0.3 0.9-0.9 0.9-1.2l-80.1 45.5z"
      />
      <path
        className="cls-6 animated-belt"
        d="m16.9 47.2 16 9m-15.7-9.1 15.7 9.1"
      />
      <path
        className="cls-4"
        d="m25 42.5 16.1 9.1m-16.5 0.2 23.3-13.1m-7.9-4.3 16.2 8.8m5.6-21.7 21.9 12.1m-15.3-16.1 16.6 8.4m-10.2-11.5 19.6 6.1m-8.2-4.5 4.9 3.3 2.7-0.9 2.8 0.9 8.5-4.5m9.5 21 8 4.2c0.2 0.1 0.2 0.5 0 0.6l-9.1 5.3-8.8-4.8"
      />
      <path
        className="cls-4"
        d="m40.4 42.8 8.5 4.5m19-30.4 9.3 4.7-7 4.1 7.5 4.1"
      />
      <path className="cls-6 animated-belt" d="m112.9 36.6 15.9 9" />
      <path className="cls-4" d="m132.3 29.9-1.1 0.9-1 3.4-9.6 5.1" />
      <path
        className="cls-6 animated-belt"
        d="m45.2 74.6 14.1 8c0.9 0.7 2.7 0.8 3.8 0.4l78.9-45c0.8-0.4 1-0.8 1-1.1"
      />
      <path className="cls-4" d="m55.8 68.4 2.6 1.5-0.8 0.3-4.7-0.3" />
      <path
        className="cls-4"
        d="m63.9 63.9 15.1 8.9m-14.9 0.5 15.8-8.9-8.6-4.5m0 8.6 15.5-8.2-8.1-4.6"
      />
      <path
        className="cls-4"
        d="m80.1 64.4 6.8 3.9m-6.9-7.9 14.3-4.4-7.9-4.4"
      />
      <polyline
        className="cls-4"
        points="87.2 60.3 94.6 64.3 102.1 60.2 94.8 56"
      />
      <path
        className="cls-17 animated-shadow"
        d="m69.1 53.9 10-6.3c0.5-0.2 0.4-1.3-0.7-1.8-0.9-0.5-9.4 4.8-10.4 4.8-0.9 0-6.5-2.8-7-3.2-1-0.6-1.9 0.8-1.1 1.9l6.9 4.2c0.6 0.4 1.6 0.8 2.3 0.4z"
      />
      <g className="animated-floating-gate">
        <path
          className="cls-7"
          d="m66.1 8.8 0.1 28.8 19.9 10.9c8.1-5.4 8.4-5.2 5.6-7.2v-24.6l-20.5-9.7-5.1 1.8z"
        />
        <path
          className="cls-8"
          d="m69.9 9.8-3.6 2 23.5 9.8 0.1 27.8 1.9-0.8v-28.3z"
        />
        <path
          className="cls-9"
          d="m66.3 11.8v27.6l2.7-1.5v-23.6l16.5 9.9v27.9l3.3-1.8 1-28.7z"
        />
        <path className="cls-10" d="m66.4 11.9 20.5 11.2v28.4" />
        <path
          className="cls-11"
          d="m69.1 40.7h4.2l5.1 2.9c0.7 0.4 0.6 1 0.1 1.2l-9.4 5.5c-0.6 0.3-1.7 0.3-2.3 0l-6.1-3.4c-0.4-0.1-0.4-0.9 0-1.1l8.4-5.1z"
        />
        <path
          className="cls-13"
          d="m69.1 40.7 4.1-0.1 5.3 3c0.5 0.3 0.5 0.8-0.1 1.1l-9.3 5.2c-0.5 0.7-1.5 0.1-2 0l-6.3-3c-0.4-0.3-0.4-1 0-1.2l8.3-5z"
        />
        <path
          className="cls-14"
          d="m66.1 37.6-43.3 24.5v1.6l61.2-27.5v-7.7l1.5 0.8v-1.3l-1.5-0.8z"
        />
        <path className="cls-9" d="m69.2 40.7 2.2 1.4 1.9-1.5z" />
        <path className="cls-12" d="m69 36.5-2.7 1.5" />
        <path className="cls-10" d="m89.9 47.5 1.7 1.3" />
        <path
          d="m71.1 9.2-2.1 1.2 20.9 11.2v26.3l1.8 0.9 0.1-28.5z"
          fill="#FC8928"
          opacity=".4"
        />
      </g>
    </svg>
  );
}
