import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <p className="text-sm font-medium text-fd-muted-foreground">404</p>
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="max-w-sm text-sm text-fd-muted-foreground">
        This documentation page does not exist. Try the sidebar, search, or
        start from the introduction.
      </p>
      <Link
        href="/docs"
        className="mt-2 rounded-md border border-fd-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-fd-muted"
      >
        Back to documentation
      </Link>
    </div>
  );
}
