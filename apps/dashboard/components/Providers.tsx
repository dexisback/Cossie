"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, ReactNode, useEffect } from "react";
import { Toaster } from "sonner";

/**
 * Initialize session ID for rate limit tracking.
 * Each user gets a unique session ID stored in a cookie.
 */
function useSessionId() {
  useEffect(() => {
    // Check if session ID exists
    const cookies = document.cookie.split(";").map((c) => c.trim());
    const sessionCookie = cookies.find((c) => c.startsWith("sessionId="));

    if (!sessionCookie) {
      // Generate new session ID
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      // Set cookie: expires in 30 days
      const expires = new Date();
      expires.setDate(expires.getDate() + 30);
      document.cookie = `sessionId=${sessionId}; expires=${expires.toUTCString()}; path=/`;
    }
  }, []);
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: false,
        staleTime: 15_000,
        gcTime: 60_000,
      },
    },
  }));

  useSessionId();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}
