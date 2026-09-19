"use client";

import React from "react";
import { motion } from "framer-motion";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
};

interface MessageBubbleProps {
  message: ChatMessage;
  index?: number;
}

function formatInline(text: string, keyPrefix: string): React.ReactNode[] {
  const regex = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*]+\*|_[^_]+_)/g;
  const parts = text.split(regex);

  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (!part) return null;

    if (
      (part.startsWith("**") && part.endsWith("**") && part.length >= 4) ||
      (part.startsWith("__") && part.endsWith("__") && part.length >= 4)
    ) {
      return (
        <strong key={key} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={key}
          className="font-mono text-[11px] bg-muted/60 text-accent px-1 py-0.5 rounded border border-border/50"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (
      (part.startsWith("*") && part.endsWith("*") && part.length >= 2) ||
      (part.startsWith("_") && part.endsWith("_") && part.length >= 2)
    ) {
      return (
        <em key={key} className="italic text-foreground/90">
          {part.slice(1, -1)}
        </em>
      );
    }

    return <span key={key}>{part}</span>;
  });
}

export function MessageBubble({ message, index = 0 }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <motion.div
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: "spring",
        duration: 0.3,
        bounce: 0,
        delay: index * 0.08,
      }}
    >
      <div
        className={`max-w-[85%] px-4 py-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap transition-shadow duration-200 ${
          isUser
            ? "bg-accent text-accent-foreground rounded-tr-sm shadow-[0_1px_2px_rgba(0,0,0,0.05),0_2px_8px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.06)]"
            : "bg-muted/40 text-foreground border border-border rounded-tl-sm shadow-[0_1px_2px_rgba(0,0,0,0.03),0_2px_6px_rgba(0,0,0,0.04)]"
        }`}
      >
        <div className="text-wrap-pretty">
          {isUser ? message.content : formatInline(message.content, message.id)}
        </div>
      </div>
    </motion.div>
  );
}

