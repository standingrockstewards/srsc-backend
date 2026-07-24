/**
 * Simple markdown renderer without external deps.
 * Handles: headings, bold, italic, code, blockquotes, tables, bullet lists, numbered lists,
 * checkboxes, horizontal rules, links, and paragraphs.
 */

const CREAM = "#F5F0EA";
const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";

function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold **text**
    const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*/s);
    // Italic *text*
    const italicMatch = remaining.match(/^(.*?)\*(.+?)\*/s);
    // Inline code `code`
    const codeMatch = remaining.match(/^(.*?)`([^`]+)`/s);
    // Link [text](url)
    const linkMatch = remaining.match(/^(.*?)\[([^\]]+)\]\(([^)]+)\)/s);

    // Find which match comes first
    const candidates = [
      { type: "bold", match: boldMatch, idx: boldMatch ? boldMatch[1].length : Infinity },
      { type: "italic", match: italicMatch, idx: italicMatch ? italicMatch[1].length : Infinity },
      { type: "code", match: codeMatch, idx: codeMatch ? codeMatch[1].length : Infinity },
      { type: "link", match: linkMatch, idx: linkMatch ? linkMatch[1].length : Infinity },
    ].sort((a, b) => a.idx - b.idx);

    const winner = candidates[0];
    if (winner.idx === Infinity || !winner.match) {
      // No more special syntax
      parts.push(remaining);
      break;
    }

    // Push text before the match
    if (winner.match[1]) parts.push(winner.match[1]);

    if (winner.type === "bold") {
      parts.push(<strong key={key++} style={{ color: CREAM, fontWeight: 700 }}>{parseInline(winner.match[2])}</strong>);
      remaining = remaining.slice(winner.match[1].length + winner.match[2].length + 4); // **x**
    } else if (winner.type === "italic") {
      parts.push(<em key={key++}>{parseInline(winner.match[2])}</em>);
      remaining = remaining.slice(winner.match[1].length + winner.match[2].length + 2); // *x*
    } else if (winner.type === "code") {
      parts.push(
        <code key={key++} style={{ background: "#252525", color: TERRACOTTA, padding: "1px 5px", borderRadius: 4, fontSize: "0.88em", fontFamily: "monospace" }}>
          {winner.match[2]}
        </code>
      );
      remaining = remaining.slice(winner.match[1].length + winner.match[2].length + 2); // `x`
    } else if (winner.type === "link") {
      parts.push(
        <a key={key++} href={winner.match[3]} target="_blank" rel="noopener noreferrer"
          style={{ color: TERRACOTTA, textDecoration: "underline" }}>
          {winner.match[2]}
        </a>
      );
      remaining = remaining.slice(winner.match[1].length + winner.match[2].length + winner.match[3].length + 4); // [x](y)
    }
  }

  return parts;
}

export function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Headings
    const h1 = line.match(/^# (.+)/);
    const h2 = line.match(/^## (.+)/);
    const h3 = line.match(/^### (.+)/);
    if (h1) {
      elements.push(
        <h1 key={key++} style={{ fontSize: "1.75rem", fontWeight: 700, color: CREAM, fontFamily: "'Playfair Display', serif", marginTop: "0.25rem", marginBottom: "1rem", lineHeight: 1.3 }}>
          {parseInline(h1[1])}
        </h1>
      );
      i++; continue;
    }
    if (h2) {
      elements.push(
        <h2 key={key++} style={{ fontSize: "1.25rem", fontWeight: 700, color: CREAM, fontFamily: "'Playfair Display', serif", marginTop: "1.75rem", marginBottom: "0.6rem", borderBottom: `1px solid #2a2a2a`, paddingBottom: "0.35rem" }}>
          {parseInline(h2[1])}
        </h2>
      );
      i++; continue;
    }
    if (h3) {
      elements.push(
        <h3 key={key++} style={{ fontSize: "1rem", fontWeight: 700, color: TERRACOTTA, marginTop: "1.25rem", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.04em", fontSize: "0.8rem" }}>
          {parseInline(h3[1])}
        </h3>
      );
      i++; continue;
    }

    // Horizontal rule
    if (line.match(/^---+$/)) {
      elements.push(<hr key={key++} style={{ border: "none", borderTop: "1px solid #2a2a2a", margin: "1.5rem 0" }} />);
      i++; continue;
    }

    // Blockquote
    if (line.startsWith(">")) {
      const bqLines: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        bqLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      elements.push(
        <blockquote key={key++} style={{
          borderLeft: `3px solid ${TERRACOTTA}`, margin: "1.25rem 0", padding: "0.75rem 1rem",
          background: "rgba(192,90,67,0.08)", borderRadius: "0 8px 8px 0",
        }}>
          {bqLines.map((bl, bi) => (
            <p key={bi} style={{ margin: 0, color: "#ccc", lineHeight: 1.6, fontSize: "0.95rem" }}>{parseInline(bl)}</p>
          ))}
        </blockquote>
      );
      continue;
    }

    // Table
    if (line.includes("|") && lines[i + 1]?.includes("|---")) {
      const headers = line.split("|").map(h => h.trim()).filter(Boolean);
      i += 2; // skip separator line
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|")) {
        rows.push(lines[i].split("|").map(c => c.trim()).filter(Boolean));
        i++;
      }
      elements.push(
        <div key={key++} style={{ overflowX: "auto", margin: "1rem 0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr>
                {headers.map((h, hi) => (
                  <th key={hi} style={{ padding: "8px 12px", textAlign: "left", background: "#1e1e1e", color: TERRACOTTA, fontWeight: 700, fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", border: "1px solid #2a2a2a" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} style={{ background: ri % 2 === 0 ? "#141414" : "#1a1a1a" }}>
                  {row.map((cell, ci) => (
                    <td key={ci} style={{ padding: "7px 12px", color: "#ccc", border: "1px solid #222" }}>
                      {parseInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Checkbox list item
    if (line.match(/^- \[[ x]\]/i)) {
      const checked = line.match(/^- \[x\]/i);
      const text = line.replace(/^- \[[ x]\]\s?/i, "");
      elements.push(
        <div key={key++} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.4rem" }}>
          <div style={{
            width: 16, height: 16, marginTop: 3, borderRadius: 3, flexShrink: 0,
            background: checked ? SAGE : "transparent",
            border: `1.5px solid ${checked ? SAGE : "#444"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {checked && <svg viewBox="0 0 12 12" width="9" height="9"><path d="M1 6l4 4 6-7" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </div>
          <span style={{ color: "#ccc", lineHeight: 1.6 }}>{parseInline(text)}</span>
        </div>
      );
      i++; continue;
    }

    // Unordered list
    if (line.match(/^[-*] /)) {
      const listItems: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*] /)) {
        listItems.push(lines[i].replace(/^[-*] /, ""));
        i++;
      }
      elements.push(
        <ul key={key++} style={{ margin: "0.5rem 0 0.75rem 0", paddingLeft: "1.25rem", listStyle: "none" }}>
          {listItems.map((item, idx) => (
            <li key={idx} style={{ color: "#ccc", lineHeight: 1.6, marginBottom: "0.25rem", display: "flex", gap: "0.5rem" }}>
              <span style={{ color: TERRACOTTA, flexShrink: 0, marginTop: "0.15rem" }}>•</span>
              <span>{parseInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (line.match(/^\d+\. /)) {
      const listItems: string[] = [];
      let num = 1;
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        listItems.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      elements.push(
        <ol key={key++} style={{ margin: "0.5rem 0 0.75rem 0", paddingLeft: 0, listStyle: "none" }}>
          {listItems.map((item, idx) => (
            <li key={idx} style={{ color: "#ccc", lineHeight: 1.6, marginBottom: "0.3rem", display: "flex", gap: "0.75rem" }}>
              <span style={{ color: TERRACOTTA, fontWeight: 700, flexShrink: 0, minWidth: "1.25rem" }}>{idx + 1}.</span>
              <span>{parseInline(item)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Empty line
    if (line.trim() === "") { i++; continue; }

    // Regular paragraph
    elements.push(
      <p key={key++} style={{ color: "#ccc", lineHeight: 1.7, marginBottom: "0.75rem", fontSize: "1rem" }}>
        {parseInline(line)}
      </p>
    );
    i++;
  }

  return <div style={{ maxWidth: "100%" }}>{elements}</div>;
}
