import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { isSafeLink, Markdown } from "./markdown.tsx";

// security.md §2.2 and the M1 plan's probe P2: the cases that react-markdown's defaults got
// wrong.
const html = (text: string) => render(<Markdown>{text}</Markdown>).container.innerHTML;

describe("Markdown", () => {
  it("keeps raw HTML as text", () => {
    const out = html('Hi <script>alert(1)</script> <img src="https://x.test/a.png">');
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<img");
  });

  it("makes only http, https and mailto into links, with noopener noreferrer", () => {
    const { container } = render(
      <Markdown>
        {
          "[a](https://a.test) [b](http://b.test) [c](mailto:c@c.test) [d](javascript:alert(1)) [e](data:text/html,x) [f](./f.md)"
        }
      </Markdown>,
    );
    const links = [...container.querySelectorAll("a")];
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "https://a.test",
      "http://b.test",
      "mailto:c@c.test",
    ]);
    for (const link of links) expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(container.textContent).toContain("d");
    expect(container.innerHTML).not.toContain("javascript:");
  });

  it("never loads an image: it shows the alt text and the URL", () => {
    const { container } = render(<Markdown>{"![Logo](https://x.test/logo.png)"}</Markdown>);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("[Logo] https://x.test/logo.png");
  });

  it("aligns table cells with a class, never a style attribute", () => {
    const out = html("| a | b |\n| :-: | --: |\n| 1 | 2 |");
    expect(out).not.toContain("style=");
    expect(out).toContain('class="text-center"');
    expect(out).toContain('class="text-right"');
  });

  it("isSafeLink", () => {
    expect(isSafeLink(" HTTPS://a.test")).toBe(true);
    expect(isSafeLink("vbscript:x")).toBe(false);
    expect(isSafeLink(undefined)).toBe(false);
  });
});
