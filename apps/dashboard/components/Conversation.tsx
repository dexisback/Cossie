"use client";

import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ChatMessage } from "./MessageBubble";

interface ConversationProps {
  messages: ChatMessage[];
  loading?: boolean;
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
        <strong key={key} className="font-semibold text-zinc-100">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("`") && part.endsWith("`") && part.length >= 2) {
      return (
        <code
          key={key}
          className="font-mono text-[11px] bg-white/[0.08] text-[#3ecf8e] px-1 py-0.5 rounded border border-white/[0.06]"
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
        <em key={key} className="italic text-zinc-200">
          {part.slice(1, -1)}
        </em>
      );
    }

    return <span key={key}>{part}</span>;
  });
}

function FormattedTerminalText({
  content,
  isUser,
}: {
  content: string;
  isUser: boolean;
}) {
  if (isUser) {
    return <span className="text-zinc-100 whitespace-pre-wrap">{content}</span>;
  }

  const lines = content.split("\n");

  return (
    <div className="space-y-1 text-white/70 min-w-0">
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <div key={lineIdx} className="h-1.5" />;
        }

        // Bullet point: "* ", "- ", "• "
        const bulletMatch = line.match(/^(\s*)([*•-]\s+)(.*)$/);
        if (bulletMatch) {
          const indent = bulletMatch[1].length;
          const body = bulletMatch[3];
          return (
            <div
              key={lineIdx}
              className="flex items-start gap-2"
              style={{ paddingLeft: `${Math.min(indent * 8, 32)}px` }}
            >
              <span className="shrink-0 select-none text-[#3ecf8e]/80 text-[10px] mt-0.5">
                ▪
              </span>
              <div className="min-w-0 flex-1 leading-relaxed">
                {formatInline(body, `line-${lineIdx}`)}
              </div>
            </div>
          );
        }

        // Numbered list: "1. "
        const numberMatch = line.match(/^(\s*)(\d+\.\s+)(.*)$/);
        if (numberMatch) {
          const indent = numberMatch[1].length;
          const num = numberMatch[2];
          const body = numberMatch[3];
          return (
            <div
              key={lineIdx}
              className="flex items-start gap-1.5"
              style={{ paddingLeft: `${Math.min(indent * 8, 32)}px` }}
            >
              <span className="shrink-0 select-none font-mono text-white/40 text-[11px]">
                {num}
              </span>
              <div className="min-w-0 flex-1 leading-relaxed">
                {formatInline(body, `line-${lineIdx}`)}
              </div>
            </div>
          );
        }

        // Heading: "### Heading" or "## Heading"
        const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
        if (headingMatch) {
          const body = headingMatch[2];
          return (
            <div
              key={lineIdx}
              className="font-semibold text-zinc-100 pt-1 pb-0.5 text-xs flex items-center gap-1.5"
            >
              <span className="text-[#3ecf8e]/70">#</span>
              {formatInline(body, `line-${lineIdx}`)}
            </div>
          );
        }

        // Regular line
        return (
          <div key={lineIdx} className="leading-relaxed">
            {formatInline(line, `line-${lineIdx}`)}
          </div>
        );
      })}
    </div>
  );
}

export function Conversation({ messages, loading }: ConversationProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, loading]);

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto px-6 py-5 space-y-3 text-xs scroll-smooth"
      style={{ scrollBehavior: "smooth" }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {messages.map((message) => {
          const isUser = message.role === "user";
          return (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", duration: 0.35, bounce: 0 }}
              className={`flex gap-2.5 leading-relaxed ${
                isUser ? "items-baseline" : "items-start"
              }`}
            >
              <span
                aria-hidden
                className={`shrink-0 select-none ${
                  isUser ? "text-[#3ecf8e]/80" : "text-white/25"
                }`}
              >
                {isUser ? "$" : "▪"}
              </span>
              <div className="min-w-0 flex-1">
                <FormattedTerminalText
                  content={message.content}
                  isUser={isUser}
                />
              </div>
            </motion.div>
          );
        })}

        {loading && (
          <motion.div
            className="flex items-center gap-2.5 leading-relaxed"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", duration: 0.35, bounce: 0 }}
          >
            <span aria-hidden className="shrink-0 select-none text-white/25">
              ▪
            </span>
            <span className="text-white/35">thinking</span>
            <span
              aria-hidden
              className="cursor-block inline-block h-3 w-[6px] bg-white/30"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
