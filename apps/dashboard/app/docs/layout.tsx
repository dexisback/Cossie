import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { DocsRootProvider } from "@/components/DocsRootProvider";
import type { ReactNode } from "react";
import Link from "next/link";
import { source } from "@/lib/source";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsRootProvider
      search={{
        enabled: true,
      }}
      theme={{
        attribute: "class",
        defaultTheme: "dark",
        enableSystem: false,
        disableTransitionOnChange: true,
      }}
    >
      <DocsLayout
        tree={source.pageTree}
        nav={{ title: "Cossie Docs" }}
        sidebar={{
          footer: (
            <Link
              href="/"
              className="text-xs text-fd-muted-foreground transition-colors hover:text-fd-foreground"
            >
              ← Back to dashboard
            </Link>
          ),
        }}
      >
        {children}
      </DocsLayout>
    </DocsRootProvider>
  );
}
