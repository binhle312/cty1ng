import type { ComponentProps } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Markdown from skills and bots is untrusted (security.md §2.2, AGENTS.md §5 rule 8). The M1
// plan's probe P2 found three gaps in react-markdown's defaults, and this wrapper closes them:
// - raw HTML stays off (no rehype-raw), so `<script>` or `<img>` in the text is never HTML;
// - only `http`, `https` and `mailto` links become links, with rel="noopener noreferrer"; every
//   other link (javascript:, data:, a relative path) is plain text;
// - images are never loaded: the alt text and the URL show instead;
// - a table cell's alignment is a class, not a `style` attribute, which the CSP blocks.

const SAFE_LINK = /^(https?:|mailto:)/i;

export function isSafeLink(href: string | undefined): href is string {
  return href !== undefined && SAFE_LINK.test(href.trim());
}

const ALIGN_CLASS: Record<string, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

// A rehype step: `align` on th and td becomes a class, before React would make it a style.
function alignToClass(node: HastNode): void {
  const properties = node.properties;
  const align = properties?.align;
  if (properties !== undefined && typeof align === "string") {
    const existing: unknown = properties.className;
    const classes = Array.isArray(existing) ? existing.filter((c) => typeof c === "string") : [];
    node.properties = Object.fromEntries([
      ...Object.entries(properties).filter(([key]) => key !== "align"),
      ["className", [...classes, ALIGN_CLASS[align] ?? ""]],
    ]);
  }
  node.children?.forEach(alignToClass);
}

function rehypeAlignToClass() {
  return alignToClass;
}

const components: Components = {
  a({ href, children }) {
    if (!isSafeLink(href)) return <span>{children}</span>;
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
  img({ alt, src }) {
    const url = typeof src === "string" ? src : "";
    return (
      <span className="text-on-surface-muted">
        [{alt === undefined || alt === "" ? "image" : alt}]{url === "" ? "" : ` ${url}`}
      </span>
    );
  },
};

export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: ComponentProps<"div">["className"];
}) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeAlignToClass]}
        components={components}
        // Links keep their URL as written; the `a` component decides what becomes a link.
        urlTransform={(url) => url}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
