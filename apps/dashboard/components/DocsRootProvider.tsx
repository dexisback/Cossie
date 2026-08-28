"use client";

import { RootProvider } from "fumadocs-ui/provider/next";
import type { ReactNode } from "react";

// next-themes (wrapped by fumadocs-ui's RootProvider) injects an inline
// <script> to apply the theme class before hydration. React 19.2 dev mode
// flags every script rendered inside a component even though the SSR path
// works as intended (pacocoursey/next-themes#385). Filter that exact
// false-positive in development; leave every other error untouched.
if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const first = args[0];
    if (
      typeof first === "string" &&
      first.includes("Encountered a script tag")
    ) {
      return;
    }
    originalError.apply(console, args);
  };
}

export function DocsRootProvider({
  children,
  ...props
}: Parameters<typeof RootProvider>[0]) {
  return <RootProvider {...props}>{children}</RootProvider>;
}
