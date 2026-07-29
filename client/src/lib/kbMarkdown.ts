/**
 * client/src/lib/kbMarkdown.ts  (Brick 10k)
 *
 * Minimal safe Markdown → HTML renderer.
 * No external dependencies. Defense-in-depth sanitization:
 *   - Strips <script>, <iframe>, <object>, <embed> tags.
 *   - Strips on* event handler attributes.
 *   - Strips javascript: hrefs.
 *
 * Supports: headings, bold, italic, inline code, code blocks,
 * unordered/ordered lists, blockquotes, horizontal rules,
 * paragraphs, line breaks.
 */

/** Strip dangerous tags and attributes from an HTML string. */
function sanitize(html: string): string {
  return html
    // Strip script / iframe / object / embed / form tags (with content)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<(object|embed|form|base|meta|link)[^>]*>/gi, "")
    // Strip on* event handlers
    .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\s+on\w+\s*=\s*[^\s>]*/gi, "")
    // Strip javascript: hrefs
    .replace(/href\s*=\s*["']\s*javascript:[^"']*/gi, 'href="#"');
}

/** Convert Markdown string to safe HTML string. */
export function mdToHtml(md: string): string {
  if (!md || !md.trim()) return "<p><em>No content.</em></p>";

  let html = md
    // Fenced code blocks (``` lang ... ```)
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, _lang, code) => {
      const escaped = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<pre><code>${escaped}</code></pre>`;
    })
    // Inline code
    .replace(/`([^`\n]+)`/g, (_, code) => {
      const escaped = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<code>${escaped}</code>`;
    })
    // Headings (must come before bold/italic to avoid misparse)
    .replace(/^#### (.+)$/gm, "<h4>$1</h4>")
    .replace(/^### (.+)$/gm,  "<h3>$1</h3>")
    .replace(/^## (.+)$/gm,   "<h2>$1</h2>")
    .replace(/^# (.+)$/gm,    "<h1>$1</h1>")
    // Horizontal rule
    .replace(/^[-*_]{3,}$/gm, "<hr>")
    // Blockquote
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g,     "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g,         "<em>$1</em>")
    .replace(/_(.+?)_/g,           "<em>$1</em>")
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // Unordered lists — collect consecutive lines starting with - or *
    .replace(/((?:^[-*+] .+\n?)+)/gm, (block) => {
      const items = block.trim().split("\n").map((l) => `<li>${l.replace(/^[-*+] /, "")}</li>`).join("");
      return `<ul>${items}</ul>\n`;
    })
    // Ordered lists
    .replace(/((?:^\d+\. .+\n?)+)/gm, (block) => {
      const items = block.trim().split("\n").map((l) => `<li>${l.replace(/^\d+\. /, "")}</li>`).join("");
      return `<ol>${items}</ol>\n`;
    })
    // Paragraph breaks: two+ consecutive newlines
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      // Don't wrap block-level elements in <p>
      if (/^<(h[1-6]|ul|ol|li|blockquote|pre|hr)/.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .filter(Boolean)
    .join("\n");

  return sanitize(html);
}

/** Extract a plain-text excerpt from Markdown (for article card previews). */
export function mdExcerpt(md: string, maxLen = 140): string {
  if (!md) return "";
  const plain = md
    .replace(/```[\s\S]*?```/g, "")   // strip code blocks
    .replace(/`[^`]+`/g, "")          // strip inline code
    .replace(/^#{1,6} /gm, "")        // strip heading markers
    .replace(/\*\*(.+?)\*\*/g, "$1")  // strip bold
    .replace(/\*(.+?)\*/g, "$1")      // strip italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // strip links, keep text
    .replace(/^> /gm, "")             // strip blockquote markers
    .replace(/^[-*+] /gm, "")         // strip list markers
    .replace(/^\d+\. /gm, "")         // strip ordered list markers
    .replace(/\n+/g, " ")             // collapse newlines
    .trim();
  return plain.length > maxLen ? `${plain.slice(0, maxLen).trimEnd()}…` : plain;
}
