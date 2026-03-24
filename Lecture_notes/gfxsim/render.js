const REMARK_ALIAS = {
  remark: "remark",
  note: "remark",
  "备注": "remark",
  tip: "tip",
  hint: "tip",
  "提示": "tip",
  warn: "warn",
  warning: "warn",
  "注意": "warn",
  error: "error",
  danger: "error",
  "错误": "error"
};

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseInline(text) {
  const mathTokens = [];

  let safe = text
    .replace(/\$\$([\s\S]+?)\$\$/g, (full) => {
      const idx = mathTokens.push(full) - 1;
      return `@@MATH_${idx}@@`;
    })
    .replace(/\$([^$\n]+?)\$/g, (full) => {
      const idx = mathTokens.push(full) - 1;
      return `@@MATH_${idx}@@`;
    });

  safe = escapeHtml(safe)
    .replace(/`([^`]+?)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+?)\*/g, "<em>$1</em>")
    .replace(/!\[([^\]]*?)\]\(([^\s)]+)\)/g, (full, alt, src) => {
      const safeSrc = escapeHtml(src);
      const safeAlt = escapeHtml(alt || "");
      return `<img src="${safeSrc}" alt="${safeAlt}" loading="lazy">`;
    })
    .replace(/\[([^\]]+?)\]\(([^\s)]+)\)/g, (full, label, href) => {
      const safeHref = escapeHtml(href);
      const safeLabel = escapeHtml(label);
      if (/^https?:\/\//i.test(href)) {
        return `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>`;
      }
      return `<a href="${safeHref}">${safeLabel}</a>`;
    });

  return safe.replace(/@@MATH_(\d+)@@/g, (full, idx) => mathTokens[Number(idx)] || "");
}

function flushParagraph(paragraph, out) {
  if (!paragraph.length) {
    return;
  }
  out.push(`<p>${parseInline(paragraph.join(" "))}</p>`);
  paragraph.length = 0;
}

function flushList(listState, out) {
  if (!listState.items.length) {
    return;
  }
  const tag = listState.ordered ? "ol" : "ul";
  out.push(`<${tag}>${listState.items.map((item) => `<li>${parseInline(item)}</li>`).join("")}</${tag}>`);
  listState.items = [];
  listState.ordered = false;
}

export function extractTitle(markdownText) {
  const normalized = markdownText.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  let cursor = 0;
  while (cursor < lines.length && lines[cursor].trim() === "") {
    cursor += 1;
  }

  const match = lines[cursor] ? lines[cursor].match(/^#\s+(.+)$/) : null;
  if (!match) {
    return { title: "Untitled Note", body: normalized };
  }

  lines.splice(cursor, 1);
  while (cursor < lines.length && lines[cursor].trim() === "") {
    lines.splice(cursor, 1);
  }

  return {
    title: match[1].trim(),
    body: lines.join("\n")
  };
}

export function renderMarkdown(markdownText) {
  const lines = markdownText.replace(/\r\n/g, "\n").split("\n");
  const out = [];

  const paragraph = [];
  const listState = { ordered: false, items: [] };

  let inCode = false;
  let codeLang = "";
  let codeLines = [];

  let inRemark = false;
  let remarkType = "remark";
  let remarkTitle = "📝 Remark";
  let remarkLines = [];

  function flushRemark() {
    const inner = renderMarkdown(remarkLines.join("\n"));
    out.push(
      `<details class="remark-box ${remarkType}"><summary>${parseInline(remarkTitle)}</summary><div class="remark-content">${inner}</div></details>`
    );
    inRemark = false;
    remarkType = "remark";
    remarkTitle = "📝 Remark";
    remarkLines = [];
  }

  for (const line of lines) {
    if (inRemark) {
      if (/^:::\s*$/.test(line.trim())) {
        flushParagraph(paragraph, out);
        flushList(listState, out);
        flushRemark();
        continue;
      }
      remarkLines.push(line);
      continue;
    }

    const remarkStart = line.match(/^:::\s*([^\s]+)\s*(.*)$/);
    if (!inCode && remarkStart) {
      flushParagraph(paragraph, out);
      flushList(listState, out);
      const alias = (remarkStart[1] || "remark").trim().toLowerCase();
      remarkType = REMARK_ALIAS[alias] || "remark";
      const defaultTitle = {
        remark: "📝 Remark",
        tip: "💡 Tip",
        warn: "⚠️ Warning",
        error: "⛔ Error"
      }[remarkType];
      remarkTitle = remarkStart[2] ? remarkStart[2].trim() : defaultTitle;
      inRemark = true;
      continue;
    }

    if (line.startsWith("```")) {
      flushParagraph(paragraph, out);
      flushList(listState, out);
      if (!inCode) {
        inCode = true;
        codeLang = line.slice(3).trim();
        codeLines = [];
      } else {
        const langClass = codeLang ? ` class="language-${escapeHtml(codeLang)}"` : "";
        out.push(`<pre><code${langClass}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        inCode = false;
        codeLang = "";
        codeLines = [];
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (/^\s*$/.test(line)) {
      flushParagraph(paragraph, out);
      flushList(listState, out);
      continue;
    }

    if (/^\s*---+\s*$/.test(line)) {
      flushParagraph(paragraph, out);
      flushList(listState, out);
      out.push("<hr>");
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph(paragraph, out);
      flushList(listState, out);
      const level = heading[1].length;
      out.push(`<h${level}>${parseInline(heading[2].trim())}</h${level}>`);
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph(paragraph, out);
      flushList(listState, out);
      out.push(`<blockquote>${parseInline(quote[1])}</blockquote>`);
      continue;
    }

    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph(paragraph, out);
      if (!listState.items.length) {
        listState.ordered = true;
      }
      if (!listState.ordered) {
        flushList(listState, out);
        listState.ordered = true;
      }
      listState.items.push(ordered[1]);
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    if (unordered) {
      flushParagraph(paragraph, out);
      if (!listState.items.length) {
        listState.ordered = false;
      }
      if (listState.ordered) {
        flushList(listState, out);
        listState.ordered = false;
      }
      listState.items.push(unordered[1]);
      continue;
    }

    paragraph.push(line.trim());
  }

  if (inCode) {
    const langClass = codeLang ? ` class="language-${escapeHtml(codeLang)}"` : "";
    out.push(`<pre><code${langClass}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }

  if (inRemark) {
    flushRemark();
  }

  flushParagraph(paragraph, out);
  flushList(listState, out);

  return out.join("\n");
}
