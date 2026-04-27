(function () {
  "use strict";

  const REMARK_ALIASES = {
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

  const DEFAULT_REMARK_TITLES = {
    remark: "📝 备注",
    tip: "💡 提示",
    warn: "⚠️ 注意",
    error: "⛔ 错误"
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function sanitizeUrl(url) {
    const text = String(url || "").trim();
    if (!text) {
      return "#";
    }
    if (/^javascript:/i.test(text)) {
      return "#";
    }
    return text;
  }

  function parseInline(input) {
    let text = String(input || "");
    const placeholders = [];

    function put(html) {
      const token = `@@TOKEN_${placeholders.length}@@`;
      placeholders.push(html);
      return token;
    }

    text = text.replace(/`([^`]+)`/g, function (_, code) {
      return put(`<code>${escapeHtml(code)}</code>`);
    });

    {
      let converted = "";
      let index = 0;
      while (index < text.length) {
        if (text[index] === "$" && text[index - 1] !== "\\") {
          let end = index + 1;
          while (end < text.length) {
            if (text[end] === "\n") {
              end = -1;
              break;
            }
            if (text[end] === "$" && text[end - 1] !== "\\") {
              break;
            }
            end += 1;
          }

          if (end > index + 1 && end < text.length) {
            const latex = text.slice(index + 1, end);
            const safeLatex = escapeHtml(latex);
            converted += put(`\\(${safeLatex}\\)`);
            index = end + 1;
            continue;
          }
        }
        converted += text[index];
        index += 1;
      }
      text = converted;
    }

    text = escapeHtml(text);

    text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, function (_, alt, url) {
      const safeAlt = alt;
      const safeUrl = escapeHtml(sanitizeUrl(url));
      return `<img src="${safeUrl}" alt="${safeAlt}" loading="lazy" class="md-image">`;
    });

    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, label, url) {
      const safeLabel = label;
      const safeUrl = escapeHtml(sanitizeUrl(url));
      return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>`;
    });

    text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");

    placeholders.forEach(function (html, index) {
      text = text.replace(`@@TOKEN_${index}@@`, html);
    });

    return text;
  }

  function normalizeRemarkType(rawType) {
    const key = String(rawType || "remark").trim().toLowerCase();
    return REMARK_ALIASES[key] || "remark";
  }

  function isBlockBoundary(line) {
    const trimmed = line.trim();
    return (
      trimmed === "" ||
      /^```/.test(trimmed) ||
      /^#{1,6}\s+/.test(trimmed) ||
      /^(-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed) ||
      /^\s*[-*+]\s+/.test(line) ||
      /^\s*\d+\.\s+/.test(line) ||
      /^\s*>\s?/.test(line) ||
      /^:::\S+/.test(trimmed) ||
      /^\$\$/.test(trimmed)
    );
  }

  function parseMarkdown(markdown, options) {
    const opts = Object.assign({ extractTitle: true }, options || {});
    const lines = String(markdown || "")
      .replace(/^\uFEFF/, "")
      .replace(/\r\n?/g, "\n")
      .split("\n");

    let extractedTitle = "";
    let startLine = 0;

    if (opts.extractTitle && lines.length > 0) {
      const firstLine = lines[0].trim();
      const match = firstLine.match(/^#\s+(.+)$/);
      if (match) {
        extractedTitle = match[1].trim();
        startLine = 1;
      }
    }

    const htmlParts = [];
    const paragraphBuffer = [];

    function flushParagraph() {
      if (paragraphBuffer.length === 0) {
        return;
      }
      const text = paragraphBuffer.join(" ");
      htmlParts.push(`<p>${parseInline(text)}</p>`);
      paragraphBuffer.length = 0;
    }

    let i = startLine;
    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed === "") {
        flushParagraph();
        i += 1;
        continue;
      }

      const remarkStart = trimmed.match(/^:::(\S+)(?:\s+(.*))?$/);
      if (remarkStart) {
        flushParagraph();
        const type = normalizeRemarkType(remarkStart[1]);
        const rawTitle = (remarkStart[2] || "").trim();
        const title = rawTitle || DEFAULT_REMARK_TITLES[type];

        i += 1;
        const blockLines = [];
        while (i < lines.length && lines[i].trim() !== ":::") {
          blockLines.push(lines[i]);
          i += 1;
        }
        if (i < lines.length && lines[i].trim() === ":::") {
          i += 1;
        }

        const inner = parseMarkdown(blockLines.join("\n"), { extractTitle: false }).bodyHtml;
        htmlParts.push(
          `<details class="remark remark--${type}"><summary>${parseInline(title)}</summary><div class="remark-inner">${inner}</div></details>`
        );
        continue;
      }

      if (/^```/.test(trimmed)) {
        flushParagraph();
        const lang = trimmed.replace(/^```/, "").trim();
        i += 1;
        const codeLines = [];
        while (i < lines.length && !/^```/.test(lines[i].trim())) {
          codeLines.push(lines[i]);
          i += 1;
        }
        if (i < lines.length) {
          i += 1;
        }
        const langClass = lang ? ` class="language-${escapeHtml(lang)}"` : "";
        htmlParts.push(`<pre><code${langClass}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        continue;
      }

      if (/^\$\$/.test(trimmed)) {
        flushParagraph();
        let latex = "";

        if (/^\$\$.+\$\$$/.test(trimmed)) {
          latex = trimmed.slice(2, -2).trim();
          i += 1;
        } else {
          i += 1;
          const latexLines = [];
          while (i < lines.length && lines[i].trim() !== "$$") {
            latexLines.push(lines[i]);
            i += 1;
          }
          if (i < lines.length && lines[i].trim() === "$$") {
            i += 1;
          }
          latex = latexLines.join("\n").trim();
        }

        htmlParts.push(`<div class="math-block">$$\n${escapeHtml(latex)}\n$$</div>`);
        continue;
      }

      const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        flushParagraph();
        const level = heading[1].length;
        htmlParts.push(`<h${level}>${parseInline(heading[2].trim())}</h${level}>`);
        i += 1;
        continue;
      }

      if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed)) {
        flushParagraph();
        htmlParts.push("<hr>");
        i += 1;
        continue;
      }

      if (/^\s*>\s?/.test(line)) {
        flushParagraph();
        const quoteLines = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          quoteLines.push(lines[i].replace(/^\s*>\s?/, ""));
          i += 1;
        }
        const inner = parseMarkdown(quoteLines.join("\n"), { extractTitle: false }).bodyHtml;
        htmlParts.push(`<blockquote>${inner}</blockquote>`);
        continue;
      }

      if (/^\s*[-*+]\s+/.test(line)) {
        flushParagraph();
        const items = [];
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
          const itemText = lines[i].replace(/^\s*[-*+]\s+/, "");
          items.push(`<li>${parseInline(itemText)}</li>`);
          i += 1;
        }
        htmlParts.push(`<ul>${items.join("")}</ul>`);
        continue;
      }

      if (/^\s*\d+\.\s+/.test(line)) {
        flushParagraph();
        const items = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          const itemText = lines[i].replace(/^\s*\d+\.\s+/, "");
          items.push(`<li>${parseInline(itemText)}</li>`);
          i += 1;
        }
        htmlParts.push(`<ol>${items.join("")}</ol>`);
        continue;
      }

      paragraphBuffer.push(line.trim());
      i += 1;

      while (i < lines.length && lines[i].trim() !== "" && !isBlockBoundary(lines[i])) {
        paragraphBuffer.push(lines[i].trim());
        i += 1;
      }
    }

    flushParagraph();

    return {
      title: extractedTitle,
      bodyHtml: htmlParts.join("\n")
    };
  }

  function isValidNoteId(noteId) {
    return /^[A-Za-z0-9_-]+$/.test(String(noteId || ""));
  }

  function isValidFileName(fileName) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.md$/.test(String(fileName || ""))) {
      return false;
    }
    return !String(fileName).includes("..");
  }

  function getCourseNameFromPath() {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      return parts[parts.length - 2];
    }
    if (parts.length === 1 && parts[0] !== "index.html" && parts[0] !== "note.html") {
      return parts[0];
    }
    return "os";
  }

  function buildLocalPreviewHint() {
    const course = getCourseNameFromPath();
    return {
      command: "python -m http.server 8000",
      url: `http://localhost:8000/${course}/index.html`
    };
  }

  window.MarkdownRenderer = {
    parseMarkdown,
    isValidNoteId,
    isValidFileName,
    buildLocalPreviewHint
  };
})();
