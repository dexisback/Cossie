"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ChatMessage } from "./MessageBubble";

interface ConversationProps {
  messages: ChatMessage[];
  loading?: boolean;
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
              <p
                className={`whitespace-pre-wrap text-wrap-pretty min-w-0 ${
                  isUser ? "text-zinc-100" : "text-white/70"
                }`}
              >
                {message.content}
              </p>
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
