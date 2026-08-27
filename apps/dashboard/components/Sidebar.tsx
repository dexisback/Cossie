"use client";

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

export type TabType =
  | "overview"
  | "policies"
  | "catalog"
  | "approvals"
  | "logs"
  | "playground"
  | "servers"
  | "demo";

interface SidebarProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
}

export function Sidebar({ activeTab, onChangeTab }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const menuItems = [
    { id: "overview" as const, label: "Overview" },
    { id: "policies" as const, label: "Policies" },
    { id: "catalog" as const, label: "Tool Catalog" },
    { id: "servers" as const, label: "MCP Servers" },
    { id: "approvals" as const, label: "Approval Queue" },
    { id: "logs" as const, label: "Audit Logs" },
    { id: "playground" as const, label: "Prompt Security" },
    { id: "demo" as const, label: "Demo Guide" },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.036,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -6, filter: "blur(2px)" },
    show: {
      opacity: 1,
      x: 0,
      filter: "blur(0px)",
      transition: {
        type: "spring" as const,
        mass: 1.2,
        stiffness: 180,
        damping: 20,
      },
    },
  };

  return (
    <motion.aside
      animate={{ width: isCollapsed ? 56 : 192 }}
      transition={{ type: "spring", mass: 1.2, stiffness: 180, damping: 20 }}
      className="h-screen border-r border-border bg-card/75 backdrop-blur-md flex flex-col shrink-0 relative z-30"
    >
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-4 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card shadow-sm hover:bg-muted/80 transition-colors cursor-pointer text-muted-foreground hover:text-foreground"
      >
        {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      <div className="h-14 flex items-center px-4 border-b border-border overflow-hidden select-none shrink-0">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Cossie Logo"
            className="h-7 w-7 object-contain rounded shadow-sm shrink-0"
          />
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15 }}
            >
              <h1 className="text-base font-medium tracking-tight text-foreground leading-none">
                Cossie
              </h1>
            </motion.div>
          )}
        </div>
      </div>

      <motion.nav
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="flex-1 px-3 py-4 space-y-2 overflow-y-auto no-scrollbar"
      >
        {menuItems.map((item, idx) => {
          const isActive = activeTab === item.id;

          return (
            <motion.button
              key={item.id}
              variants={itemVariants}
              whileTap={{ scale: 0.96 }}
              onClick={() => onChangeTab(item.id)}
              className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm transition-all duration-180 ease-out cursor-pointer group relative outline-none ${
                isActive
                  ? "bg-accent text-accent-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -8, filter: "blur(1px)" }}
                  animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  transition={{
                    type: "spring",
                    mass: 1.2,
                    stiffness: 180,
                    damping: 20,
                    delay: idx * 0.03,
                  }}
                  className="truncate"
                >
                  {item.label}
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </motion.nav>

      {isCollapsed ? (
        <div className="px-2 pb-3 shrink-0 flex justify-center">
          <button
            onClick={() => {
              onChangeTab("policies");
              setTimeout(() => {
                const event = new CustomEvent("open-new-policy-modal");
                window.dispatchEvent(event);
              }, 80);
            }}
            className="h-8 w-8 flex items-center justify-center bg-accent text-accent-foreground rounded-lg hover:opacity-90 active:scale-[0.97] transition-all cursor-pointer shadow-sm"
            title="New Policy"
          >
            <Plus size={14} />
          </button>
        </div>
      ) : (
        <div className="px-3 pb-3 shrink-0">
          <button
            onClick={() => {
              onChangeTab("policies");
              setTimeout(() => {
                const event = new CustomEvent("open-new-policy-modal");
                window.dispatchEvent(event);
              }, 80);
            }}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-accent text-accent-foreground rounded-lg text-xs font-semibold hover:opacity-90 active:scale-[0.97] transition-all cursor-pointer shadow-sm uppercase tracking-wider font-mono text-[9px]"
          >
            <Plus size={11} />
            <span>New Policy</span>
          </button>
        </div>
      )}
    </motion.aside>
  );
}
