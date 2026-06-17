(function () {
  const remarkAliases = {
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

  const remarkIcons = {
    remark: "📝",
    tip: "💡",
    warn: "⚠️",
    error: "⛔"
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }

  function safeUrl(url) {
    const trimmed = String(url).trim();
    if (/^(https?:|mailto:|#|\.{0,2}\/|[A-Za-z0-9_.-]+\.html)/.test(trimmed)) {
      return trimmed;
    }
    if (!trimmed.includes("..") && !trimmed.includes(":") && /^[A-Za-z0-9][A-Za-z0-9_./-]*$/.test(trimmed)) {
      return trimmed;
    }
    return "#";
  }

  function extractTitle(markdown) {
    const normalized = markdown.replace(/\r\n?/g, "\n");
    const lines = normalized.split("\n");
    if (lines[0] && /^#\s+/.test(lines[0])) {
      return {
        title: lines[0].replace(/^#\s+/, "").trim(),
        body: lines.slice(1).join("\n").replace(/^\n+/, "")
      };
    }
    return { title: "", body: normalized };
  }

  function isSpecialBlock(line) {
    return /^(#{1,6}\s+|```|\s*[-*_]{3,}\s*$|>\s?|:::\s*|\$\$\s*$|\s*([-*+]\s+|\d+\.\s+))/.test(line);
  }

  function renderInline(text) {
    const stash = [];
    let source = String(text);

    source = source.replace(/`([^`]+)`/g, (_, code) => {
      const token = `@@CODE${stash.length}@@`;
      stash.push(`<code>${escapeHtml(code)}</code>`);
      return token;
    });

    source = source.replace(/\$([^$\n]+)\$/g, (_, math) => {
      const token = `@@CODE${stash.length}@@`;
      stash.push(`\\(${escapeHtml(math.trim())}\\)`);
      return token;
    });

    source = escapeHtml(source);

    source = source.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, label, url) => {
      const token = `@@CODE${stash.length}@@`;
      stash.push(`<img src="${escapeAttr(safeUrl(url))}" alt="${label}" loading="lazy" />`);
      return token;
    });
    source = source.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
      const token = `@@CODE${stash.length}@@`;
      stash.push(`<a href="${escapeAttr(safeUrl(url))}">${label}</a>`);
      return token;
    });
    source = source.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    source = source.replace(/__([^_]+)__/g, "<strong>$1</strong>");
    source = source.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    source = source.replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");

    stash.forEach((html, index) => {
      source = source.replace(`@@CODE${index}@@`, html);
    });

    return source;
  }

  function renderList(lines, startIndex) {
    const ordered = /^\s*\d+\.\s+/.test(lines[startIndex]);
    const tag = ordered ? "ol" : "ul";
    const items = [];
    let index = startIndex;
    const pattern = ordered ? /^\s*\d+\.\s+/ : /^\s*[-*+]\s+/;

    while (index < lines.length && pattern.test(lines[index])) {
      items.push(`<li>${renderInline(lines[index].replace(pattern, "").trim())}</li>`);
      index += 1;
    }

    return { html: `<${tag}>${items.join("")}</${tag}>`, next: index };
  }

  function renderRemark(lines, startIndex) {
    const match = lines[startIndex].match(/^:::\s*([^\s]+)?\s*(.*)$/);
    const rawType = (match?.[1] || "remark").toLowerCase();
    const type = remarkAliases[rawType] || "remark";
    const fallbackTitle = {
      remark: "补充说明",
      tip: "提示",
      warn: "注意",
      error: "易错点"
    }[type];
    const title = (match?.[2] || fallbackTitle).trim();
    const body = [];
    let index = startIndex + 1;

    while (index < lines.length && !/^:::\s*$/.test(lines[index])) {
      body.push(lines[index]);
      index += 1;
    }
    if (index < lines.length && /^:::\s*$/.test(lines[index])) {
      index += 1;
    }

    const icon = title.startsWith(remarkIcons[type]) ? "" : remarkIcons[type];
    const inner = renderMarkdown(body.join("\n"));
    return {
      html: `
        <details class="remark-box remark-${type}">
          <summary>${icon ? `<span>${icon}</span>` : ""}${renderInline(title)}</summary>
          <div class="remark-content">${inner}</div>
        </details>
      `,
      next: index
    };
  }

  function renderMarkdown(markdown) {
    const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
    const output = [];
    let index = 0;

    while (index < lines.length) {
      const line = lines[index];

      if (!line.trim()) {
        index += 1;
        continue;
      }

      if (/^:::\s*/.test(line)) {
        const block = renderRemark(lines, index);
        output.push(block.html);
        index = block.next;
        continue;
      }

      if (/^```/.test(line)) {
        const lang = line.replace(/^```/, "").trim();
        const code = [];
        index += 1;
        while (index < lines.length && !/^```/.test(lines[index])) {
          code.push(lines[index]);
          index += 1;
        }
        index += index < lines.length ? 1 : 0;
        output.push(`<pre><code class="language-${escapeAttr(lang)}">${escapeHtml(code.join("\n"))}</code></pre>`);
        continue;
      }

      if (/^\$\$\s*$/.test(line.trim())) {
        const formula = [];
        index += 1;
        while (index < lines.length && !/^\$\$\s*$/.test(lines[index].trim())) {
          formula.push(lines[index]);
          index += 1;
        }
        index += index < lines.length ? 1 : 0;
        output.push(`<div class="math-block">\\[${escapeHtml(formula.join("\n").trim())}\\]</div>`);
        continue;
      }

      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        const level = heading[1].length;
        output.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`);
        index += 1;
        continue;
      }

      if (/^\s*[-*_]{3,}\s*$/.test(line)) {
        output.push("<hr />");
        index += 1;
        continue;
      }

      if (/^>\s?/.test(line)) {
        const quote = [];
        while (index < lines.length && /^>\s?/.test(lines[index])) {
          quote.push(lines[index].replace(/^>\s?/, ""));
          index += 1;
        }
        output.push(`<blockquote>${renderMarkdown(quote.join("\n"))}</blockquote>`);
        continue;
      }

      if (/^\s*([-*+]\s+|\d+\.\s+)/.test(line)) {
        const list = renderList(lines, index);
        output.push(list.html);
        index = list.next;
        continue;
      }

      const paragraph = [];
      while (index < lines.length && lines[index].trim() && !isSpecialBlock(lines[index])) {
        paragraph.push(lines[index].trim());
        index += 1;
      }
      output.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    }

    return output.join("\n");
  }

  window.CourseMarkdown = {
    escapeHtml,
    extractTitle,
    renderMarkdown
  };
})();
