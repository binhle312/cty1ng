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

  // security.md §3, the XSS corpus: nothing in the text becomes an active element or attribute.
  it.each([
    ["an event handler on an image", '<img src="x" onerror="alert(1)">'],
    ["an event handler on a link", '<a href="https://a.test" onclick="alert(1)">a</a>'],
    ["an event handler on a block", '<div onmouseover="alert(1)">a</div>'],
    ["an event handler on the body", '<body onload="alert(1)">'],
    ["an SVG with onload", '<svg onload="alert(1)"></svg>'],
    ["an SVG with a script", "<svg><script>alert(1)</script></svg>"],
    ["an SVG image with onerror", '<svg><image href="x" onerror="alert(1)"/></svg>'],
    ["an SVG link", '<svg><a href="javascript:alert(1)"><text>a</text></a></svg>'],
    ["an iframe", '<iframe src="javascript:alert(1)"></iframe>'],
    ["a handler in a Markdown image's alt", '![x" onerror="alert(1)](https://a.test/a.png)'],
    ["a handler in a Markdown link's title", '[a](https://a.test "x" onclick="alert(1)")'],
    ["a javascript autolink", "<javascript:alert(1)>"],
    ["a javascript link in capitals", "[a](JaVaScRiPt:alert(1))"],
    ["a data link with an SVG", "[a](data:image/svg+xml,<svg onload=alert(1)>)"],
  ])("keeps %s inert", (_label, text) => {
    const { container } = render(<Markdown>{text}</Markdown>);
    expect(container.querySelector("script, svg, img, iframe, object, embed, style")).toBeNull();
    for (const element of container.querySelectorAll("*")) {
      for (const { name, value } of element.attributes) {
        expect(name.toLowerCase().startsWith("on"), name).toBe(false);
        expect(value.toLowerCase(), name).not.toMatch(/^\s*(javascript|data|vbscript):/);
      }
    }
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
