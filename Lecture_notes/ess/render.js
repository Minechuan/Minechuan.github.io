const REMARK_ALIAS_TO_TYPE = {
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
  let content = text
    .replace(/\$([^$\n]+?)\$/g, (all) => {
      const tokenIndex = mathTokens.push(all) - 1;
      return `@@MATH_${tokenIndex}@@`;
    });

  content = escapeHtml(content)
    .replace(/!\[([^\]]*?)\]\(([^\s)]+)\)/g, (all, alt, src) => {
      return `<img src=\"${src}\" alt=\"${alt}\" loading=\"lazy\">`;
    })
    .replace(/`([^`]+?)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+?)\*/g, "<em>$1</em>")
    .replace(/\[([^\]]+?)\]\(([^\s)]+)\)/g, (all, label, href) => {
      if (/^https?:\/\//i.test(href)) {
        return `<a href=\"${href}\" target=\"_blank\" rel=\"noopener noreferrer\">${label}</a>`;
      }
      return `<a href=\"${href}\">${label}</a>`;
    });

  return content.replace(/@@MATH_(\d+)@@/g, (all, index) => mathTokens[Number(index)] || "");
}

function flushParagraph(paragraphBuffer, htmlParts) {
  if (!paragraphBuffer.length) {
    return;
  }
  htmlParts.push(`<p>${parseInline(paragraphBuffer.join(" "))}</p>`);
  paragraphBuffer.length = 0;
}

function flushList(listState, htmlParts) {
  if (!listState.items.length) {
    return;
  }
  const tag = listState.ordered ? "ol" : "ul";
  const items = listState.items.map((item) => `<li>${parseInline(item)}</li>`).join("");
  htmlParts.push(`<${tag}>${items}</${tag}>`);
  listState.items = [];
  listState.ordered = false;
}

export function extractTitle(markdownText) {
  const lines = markdownText.replace(/\r\n/g, "\n").split("\n");
  let index = 0;

  while (index < lines.length && lines[index].trim() === "") {
    index += 1;
  }

  const firstLine = lines[index] || "";
  const titleMatch = firstLine.match(/^#\s+(.+)$/);

  if (titleMatch) {
    lines.splice(index, 1);
    while (index < lines.length && lines[index].trim() === "") {
      lines.splice(index, 1);
    }

    return {
      title: titleMatch[1].trim(),
      body: lines.join("\n")
    };
  }

  return {
    title: "Untitled Note",
    body: markdownText
  };
}

export function renderMarkdown(markdownText) {
  const lines = markdownText.replace(/\r\n/g, "\n").split("\n");
  const htmlParts = [];
  const paragraphBuffer = [];
  const listState = { ordered: false, items: [] };

  let inCode = false;
  let codeLang = "";
  let codeLines = [];

  let inMathBlock = false;
  let mathLines = [];

  let inRemark = false;
  let remarkType = "remark";
  let remarkTitle = "Remark";
  let remarkBody = [];

  function flushRemark() {
    const bodyHtml = renderMarkdown(remarkBody.join("\n"));
    htmlParts.push(
      `<details class=\"remark-box ${remarkType}\"><summary>${parseInline(remarkTitle)}</summary><div class=\"remark-content\">${bodyHtml}</div></details>`
    );
    inRemark = false;
    remarkType = "remark";
    remarkTitle = "Remark";
    remarkBody = [];
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (inRemark) {
      if (/^:::\s*$/.test(line.trim())) {
        flushParagraph(paragraphBuffer, htmlParts);
        flushList(listState, htmlParts);
        flushRemark();
      } else {
        remarkBody.push(line);
      }
      continue;
    }

    if (inMathBlock) {
      if (/^\s*\$\$\s*$/.test(line)) {
        htmlParts.push(`<div class=\"math-block\">$$\n${mathLines.join("\n")}\n$$</div>`);
        inMathBlock = false;
        mathLines = [];
      } else {
        mathLines.push(line);
      }
      continue;
    }

    const remarkStart = line.match(/^:::\s*([^\s]+)\s*(.*)$/);
    if (!inCode && remarkStart) {
      flushParagraph(paragraphBuffer, htmlParts);
      flushList(listState, htmlParts);

      const sourceType = (remarkStart[1] || "remark").trim().toLowerCase();
      remarkType = REMARK_ALIAS_TO_TYPE[sourceType] || "remark";
      const defaultTitles = {
        remark: "📝 Remark",
        tip: "💡 Tip",
        warn: "⚠️ Warning",
        error: "⛔ Error"
      };
      remarkTitle = remarkStart[2] ? remarkStart[2].trim() : defaultTitles[remarkType];
      inRemark = true;
      continue;
    }

    if (/^\s*\$\$\s*$/.test(line) && !inCode) {
      flushParagraph(paragraphBuffer, htmlParts);
      flushList(listState, htmlParts);
      inMathBlock = true;
      mathLines = [];
      continue;
    }

    if (line.startsWith("```")) {
      flushParagraph(paragraphBuffer, htmlParts);
      flushList(listState, htmlParts);

      if (!inCode) {
        inCode = true;
        codeLang = line.slice(3).trim();
        codeLines = [];
      } else {
        const classAttr = codeLang ? ` class=\"language-${escapeHtml(codeLang)}\"` : "";
        htmlParts.push(`<pre><code${classAttr}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
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
      flushParagraph(paragraphBuffer, htmlParts);
      flushList(listState, htmlParts);
      continue;
    }

    if (/^\s*---+\s*$/.test(line)) {
      flushParagraph(paragraphBuffer, htmlParts);
      flushList(listState, htmlParts);
      htmlParts.push("<hr>");
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph(paragraphBuffer, htmlParts);
      flushList(listState, htmlParts);
      const level = heading[1].length;
      htmlParts.push(`<h${level}>${parseInline(heading[2].trim())}</h${level}>`);
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph(paragraphBuffer, htmlParts);
      flushList(listState, htmlParts);
      htmlParts.push(`<blockquote>${parseInline(quote[1])}</blockquote>`);
      continue;
    }

    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph(paragraphBuffer, htmlParts);
      if (!listState.items.length) {
        listState.ordered = true;
      }
      if (!listState.ordered) {
        flushList(listState, htmlParts);
        listState.ordered = true;
      }
      listState.items.push(ordered[1]);
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    if (unordered) {
      flushParagraph(paragraphBuffer, htmlParts);
      if (!listState.items.length) {
        listState.ordered = false;
      }
      if (listState.ordered) {
        flushList(listState, htmlParts);
        listState.ordered = false;
      }
      listState.items.push(unordered[1]);
      continue;
    }

    paragraphBuffer.push(line.trim());
  }

  if (inCode) {
    const classAttr = codeLang ? ` class=\"language-${escapeHtml(codeLang)}\"` : "";
    htmlParts.push(`<pre><code${classAttr}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  }

  if (inMathBlock) {
    htmlParts.push(`<div class=\"math-block\">$$\n${mathLines.join("\n")}\n$$</div>`);
  }

  if (inRemark) {
    flushRemark();
  }

  flushParagraph(paragraphBuffer, htmlParts);
  flushList(listState, htmlParts);

  return htmlParts.join("\n");
}
