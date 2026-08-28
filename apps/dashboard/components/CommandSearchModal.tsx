"use client";

import { useEffect, useState, useMemo } from "react";
import { Command } from "cmdk";
import * as Dialog from "@radix-ui/react-dialog";
import Fuse from "fuse.js";
import {
  Search,
  LayoutDashboard,
  ShieldCheck,
  Wrench,
  Server,
  ClipboardCheck,
  FileCode2,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { sound } from "./SoundSystem";
import { api } from "../lib/api";

interface CommandSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: any) => void;
}

interface SearchItem {
  id: string;
  title: string;
  description: string;
  category: "Navigation" | "Tools" | "Servers" | "Policies" | "Audit Logs";
  action: () => void;
}

export function CommandSearchModal({
  isOpen,
  onClose,
  onNavigate,
}: CommandSearchModalProps) {
  const [search, setSearch] = useState("");
  const [tools, setTools] = useState<any[]>([]);
  const [servers, setServers] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!hasMounted) return;
    if (isOpen) {
      sound.playModalOpen();
    } else {
      sound.playModalClose();
    }
  }, [isOpen, hasMounted]);

  useEffect(() => {
    async function fetchData() {
      try {
        const fetchJson = (path: string) =>
          api.get(path).then((r) => {
            if (!r.ok) throw new Error(`HTTP error! status: ${r.status}`);
            return r.json();
          });

        const [toolsRes, healthRes, rulesRes, logsRes] = await Promise.all([
          fetchJson("/api/tools"),
          fetchJson("/api/health"),
          fetchJson("/api/rules"),
          fetchJson("/api/logs"),
        ]);
        setTools(toolsRes || []);
        setServers(healthRes?.serversList || []);
        setRules(rulesRes || []);
        setLogs(logsRes || []);
      } catch (err) {
        console.error("Failed to load search index data", err);
      }
    }
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const searchItems = useMemo(() => {
    const items: SearchItem[] = [
      {
        id: "nav-overview",
        title: "Overview Dashboard",
        description:
          "View system overview metrics, runtime synchronization, and AI agent chat console.",
        category: "Navigation",
        action: () => onNavigate("overview"),
      },
      {
        id: "nav-policies",
        title: "Policies & Guards",
        description:
          "Configure block list tool rules, manual approval workflows, risk levels, and input validators.",
        category: "Navigation",
        action: () => onNavigate("policies"),
      },
      {
        id: "nav-catalog",
        title: "Tool Catalog",
        description:
          "Browse registered MCP tools, inspect actions, and override execution risk configurations.",
        category: "Navigation",
        action: () => onNavigate("catalog"),
      },
      {
        id: "nav-servers",
        title: "Connected MCP Servers",
        description:
          "Manage connected servers, inspect network transports, and refresh dynamic tool discovery.",
        category: "Navigation",
        action: () => onNavigate("servers"),
      },
      {
        id: "nav-approvals",
        title: "Approval Queue",
        description:
          "Inspect intercepted tool executions and dynamic manual authorization actions.",
        category: "Navigation",
        action: () => onNavigate("approvals"),
      },
      {
        id: "nav-logs",
        title: "Audit Trails",
        description:
          "Examine security logs, Policy Engine decisions, and execution timelines.",
        category: "Navigation",
        action: () => onNavigate("logs"),
      },
      {
        id: "nav-playground",
        title: "Prompt Security Playground",
        description:
          "Test prompt injection filters, security logs, and scan heuristics.",
        category: "Navigation",
        action: () => onNavigate("playground"),
      },
    ];

    for (let i = 0; i < tools.length; i++) {
      const t = tools[i];
      items.push({
        id: `tool-${t.id || t.toolName}`,
        title: `Tool: ${t.toolName}`,
        description:
          t.description ||
          `Exposed by server ${t.serverId}. Risk Level: ${t.finalRisk}.`,
        category: "Tools",
        action: () => onNavigate("catalog"),
      });
    }

    for (let i = 0; i < servers.length; i++) {
      const s = servers[i];
      items.push({
        id: `server-${s.id}`,
        title: `Server: ${s.name}`,
        description: `MCP server configured on transport ${s.transport}.`,
        category: "Servers",
        action: () => onNavigate("servers"),
      });
    }

    for (let i = 0; i < rules.length; i++) {
      const r = rules[i];
      items.push({
        id: `rule-${r.id}`,
        title: `Policy: ${r.name}`,
        description: `${r.description || "Active guardrail rule."} Type: ${r.type}. Status: ${r.enabled ? "Active" : "Disabled"}.`,
        category: "Policies",
        action: () => onNavigate("policies"),
      });
    }

    for (let i = 0; i < logs.length; i++) {
      const l = logs[i];
      items.push({
        id: `log-${l.id}`,
        title: `Audit: ${l.toolName} (${l.decision})`,
        description:
          l.reason || `Tool execution audit event of type ${l.eventType}.`,
        category: "Audit Logs",
        action: () => onNavigate("logs"),
      });
    }

    return items;
  }, [tools, servers, rules, logs, onNavigate]);

  const fuse = useMemo(() => {
    return new Fuse(searchItems, {
      keys: ["title", "description", "category"],
      threshold: 0.4,
    });
  }, [searchItems]);

  const filteredItems = useMemo(() => {
    if (!search) return searchItems;
    return fuse.search(search).map((res) => res.item);
  }, [search, searchItems, fuse]);

  function getCategoryIcon(category: string) {
    switch (category) {
      case "Navigation":
        return <LayoutDashboard size={14} className="text-accent" />;
      case "Tools":
        return <Wrench size={14} className="text-status-info" />;
      case "Servers":
        return <Server size={14} className="text-status-ok" />;
      case "Policies":
        return <ShieldCheck size={14} className="text-status-warn" />;
      case "Audit Logs":
        return <FileCode2 size={14} className="text-status-special" />;
      default:
        return <Search size={14} />;
    }
  }

  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchItem[]> = {
      Navigation: [],
      Tools: [],
      Servers: [],
      Policies: [],
      "Audit Logs": [],
    };
    for (let i = 0; i < filteredItems.length; i++) {
      const item = filteredItems[i];
      if (groups[item.category]) {
        groups[item.category].push(item);
      }
    }
    return groups;
  }, [filteredItems]);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-background/50 backdrop-blur-sm z-50 transition-[opacity,backdrop-filter] duration-200 ease-[cubic-bezier(0.2,0,0,1)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          style={{
            boxShadow:
              "0 0 0 1px rgba(0, 0, 0, 0.06), 0 4px 16px rgba(0, 0, 0, 0.08), 0 8px 32px rgba(0, 0, 0, 0.06)",
          }}
          className="fixed inset-0 flex items-center justify-center pointer-events-none z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        >
          <div
            className="w-full max-w-lg app-glass rounded-2xl overflow-hidden flex flex-col p-0 pointer-events-auto transition-[opacity] duration-200 ease-[cubic-bezier(0.2,0,0,1)]"
            style={{
              boxShadow:
                "0 0 0 1px rgba(0, 0, 0, 0.06), 0 4px 16px rgba(0, 0, 0, 0.08), 0 8px 32px rgba(0, 0, 0, 0.06)",
            }}
          >
            <Command className="w-full flex flex-col" label="Smart Search">
              <div
                style={{
                  boxShadow: "inset 0 -1px 0 0 rgba(0, 0, 0, 0.06)",
                }}
                className="flex items-center gap-2.5 px-4 bg-transparent"
              >
                <Search
                  size={14}
                  className="text-muted-foreground shrink-0 -mt-[1px]"
                />
                <Command.Input
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Search any page, tool, server, policy, or logs..."
                  className="w-full py-3.5 bg-transparent border-0 text-foreground text-xs font-semibold focus:outline-none placeholder:text-muted-foreground transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)]"
                />
              </div>

              <Command.List className="max-h-[340px] overflow-y-auto p-2 space-y-2">
                <Command.Empty className="py-8 text-center text-xs text-muted-foreground">
                  No matching results found.
                </Command.Empty>

                {Object.entries(groupedResults).map(([category, items]) => {
                  if (items.length === 0) return null;
                  return (
                    <Command.Group
                      key={category}
                      heading={category}
                      className="space-y-1"
                    >
                      <div className="px-3 py-1.5 text-[9px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
                        {category}
                      </div>
                      {items.map((item) => (
                        <Command.Item
                          key={item.id}
                          onSelect={() => {
                            sound.playTap();
                            item.action();
                            onClose();
                          }}
                          style={{
                            boxShadow: "0 0 0 1px transparent",
                          }}
                          className="flex items-center justify-between gap-3 px-3 py-2.5 min-h-[40px] rounded-xl text-xs text-foreground cursor-pointer select-none active:scale-[0.96] hover:bg-muted/40 hover:shadow-[0_0_0_1px_rgba(0,0,0,0.04)] aria-selected:bg-accent aria-selected:text-accent-foreground aria-selected:shadow-[0_0_0_1px_rgba(var(--accent-rgb),0.2),0_1px_2px_rgba(0,0,0,0.04)] transition-[transform,background-color,box-shadow,color] duration-150 ease-[cubic-bezier(0.2,0,0,1)] group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              style={{
                                boxShadow:
                                  "inset 0 0 0 1px rgba(0, 0, 0, 0.06)",
                              }}
                              className="p-1.5 bg-background rounded-lg shrink-0 min-h-[28px] min-w-[28px] flex items-center justify-center group-aria-selected:shadow-[inset_0_0_0_1px_rgba(var(--accent-rgb),0.2)] transition-[box-shadow] duration-150 ease-[cubic-bezier(0.2,0,0,1)]"
                            >
                              {getCategoryIcon(item.category)}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold block truncate">
                                {item.title}
                              </span>
                              <span className="text-[10px] text-muted-foreground block truncate group-aria-selected:text-accent-foreground/80 mt-0.5">
                                {item.description}
                              </span>
                            </div>
                          </div>
                          <ArrowRight
                            size={12}
                            className="opacity-0 scale-75 blur-[2px] group-hover:opacity-100 group-hover:scale-100 group-hover:blur-0 group-aria-selected:opacity-100 group-aria-selected:scale-100 group-aria-selected:blur-0 transition-[opacity,transform,filter] duration-150 ease-[cubic-bezier(0.2,0,0,1)] text-muted-foreground group-aria-selected:text-accent-foreground shrink-0"
                          />
                        </Command.Item>
                      ))}
                    </Command.Group>
                  );
                })}
              </Command.List>
            </Command>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
