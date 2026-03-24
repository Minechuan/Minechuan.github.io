(function () {
  const NOTE_ID_RE = /^[A-Za-z0-9_-]+$/;
  const FILE_RE = /^(?!\.)(?!.*\.\.)[A-Za-z0-9._-]+\.md$/;

  const REMARK_TYPE_MAP = {
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
    "错误": "error",
  };

  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeAttr(text) {
    return escapeHtml(String(text || ""))
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeRemarkType(rawType) {
    const key = String(rawType || "remark").trim().toLowerCase();
    return REMARK_TYPE_MAP[key] || "remark";
  }

  function protectMath(content) {
    const tokens = [];
    const replaced = content.replace(/\$\$[\s\S]+?\$\$|\$(?!\s)[^$\n]+?\$(?!\w)/g, (m) => {
      const idx = tokens.push(m) - 1;
      return `@@MATH_${idx}@@`;
    });
    return { replaced, tokens };
  }

  function restoreMath(content, tokens) {
    return content.replace(/@@MATH_(\d+)@@/g, (_, i) => {
      const raw = tokens[Number(i)] || "";
      // Keep TeX delimiters visible to MathJax while preventing HTML parsing
      // from treating fragments like "<k" as tags.
      return escapeHtml(raw);
    });
  }

  function parseInline(raw) {
    if (!raw) return "";
    const { replaced, tokens } = protectMath(raw);
    let s = escapeHtml(replaced);

    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    s = s.replace(/!\[([^\]]*?)\]\(([^)\s]+)\)/g, (m, alt, src) => `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" loading="lazy">`);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) => {
      const safeHref = escapeAttr(href);
      const safeLabel = label;
      if (/^https?:\/\//i.test(href)) {
        return `<a href="${safeHref}" target="_blank" rel="noreferrer">${safeLabel}</a>`;
      }
      return `<a href="${safeHref}">${safeLabel}</a>`;
    });

    return restoreMath(s, tokens);
  }

  function extractTitle(md) {
    const lines = md.replace(/\r\n/g, "\n").split("\n");
    let title = "";
    let bodyStart = 0;

    for (let i = 0; i < lines.length; i += 1) {
      const t = lines[i].trim();
      if (!t) continue;
      const m = t.match(/^#\s+(.+)$/);
      if (m) {
        title = m[1].trim();
        bodyStart = i + 1;
      }
      break;
    }

    return {
      title,
      body: lines.slice(bodyStart).join("\n"),
    };
  }

  function parseMarkdown(md, options) {
    const opts = options || {};
    const src = (md || "").replace(/\r\n/g, "\n");
    let content = src;
    let title = "";

    if (opts.extractTitle) {
      const extracted = extractTitle(src);
      title = extracted.title;
      content = extracted.body;
    }

    const lines = content.split("\n");
    const out = [];

    let i = 0;
    let inCode = false;
    let codeLang = "";
    let codeBuf = [];
    let paraBuf = [];
    let listMode = "";

    function flushParagraph() {
      if (!paraBuf.length) return;
      out.push(`<p>${parseInline(paraBuf.join(" "))}</p>`);
      paraBuf = [];
    }

    function closeList() {
      if (!listMode) return;
      out.push(listMode === "ol" ? "</ol>" : "</ul>");
      listMode = "";
    }

    function openList(mode) {
      if (listMode === mode) return;
      closeList();
      out.push(mode === "ol" ? "<ol>" : "<ul>");
      listMode = mode;
    }

    while (i < lines.length) {
      const line = lines[i];
      const trim = line.trim();

      const remarkMatch = trim.match(/^:::\s*([^\s]+)(?:\s+(.*))?$/);
      if (!inCode && remarkMatch) {
        flushParagraph();
        closeList();

        const rType = normalizeRemarkType(remarkMatch[1]);
        const rTitle = parseInline(remarkMatch[2] || "展开备注");
        const inner = [];

        i += 1;
        while (i < lines.length && lines[i].trim() !== ":::") {
          inner.push(lines[i]);
          i += 1;
        }

        const innerHtml = parseMarkdown(inner.join("\n"), { extractTitle: false }).html;
        out.push(
          `<details class="remark remark-type-${rType}"><summary>${rTitle}</summary><div class="remark-body">${innerHtml}</div></details>`
        );

        i += 1;
        continue;
      }

      const codeFenceMatch = trim.match(/^```\s*([A-Za-z0-9_-]+)?\s*$/);
      if (codeFenceMatch) {
        flushParagraph();
        closeList();

        if (!inCode) {
          inCode = true;
          codeLang = codeFenceMatch[1] || "";
          codeBuf = [];
        } else {
          const cls = codeLang ? ` class="language-${escapeHtml(codeLang)}"` : "";
          out.push(`<pre><code${cls}>${escapeHtml(codeBuf.join("\n"))}</code></pre>`);
          inCode = false;
          codeLang = "";
          codeBuf = [];
        }

        i += 1;
        continue;
      }

      if (inCode) {
        codeBuf.push(line);
        i += 1;
        continue;
      }

      if (!trim) {
        flushParagraph();
        closeList();
        i += 1;
        continue;
      }

      if (/^---+$/.test(trim)) {
        flushParagraph();
        closeList();
        out.push("<hr>");
        i += 1;
        continue;
      }

      const headingMatch = trim.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        flushParagraph();
        closeList();
        const level = headingMatch[1].length;
        out.push(`<h${level}>${parseInline(headingMatch[2])}</h${level}>`);
        i += 1;
        continue;
      }

      const quoteMatch = trim.match(/^>\s?(.*)$/);
      if (quoteMatch) {
        flushParagraph();
        closeList();
        out.push(`<blockquote>${parseInline(quoteMatch[1])}</blockquote>`);
        i += 1;
        continue;
      }

      const olMatch = trim.match(/^(\d+)\.\s+(.+)$/);
      if (olMatch) {
        flushParagraph();
        openList("ol");
        out.push(`<li>${parseInline(olMatch[2])}</li>`);
        i += 1;
        continue;
      }

      const ulMatch = trim.match(/^[-*]\s+(.+)$/);
      if (ulMatch) {
        flushParagraph();
        openList("ul");
        out.push(`<li>${parseInline(ulMatch[1])}</li>`);
        i += 1;
        continue;
      }

      paraBuf.push(trim);
      i += 1;
    }

    flushParagraph();
    closeList();

    return {
      title,
      html: out.join("\n"),
    };
  }

  function isValidNoteId(noteId) {
    return NOTE_ID_RE.test(String(noteId || ""));
  }

  function isValidFileName(fileName) {
    return FILE_RE.test(String(fileName || ""));
  }

  function noteFileFromId(noteId, lang) {
    return `${noteId}.${lang}.md`;
  }

  window.NoteRenderer = {
    parseMarkdown,
    isValidNoteId,
    isValidFileName,
    noteFileFromId,
  };
})();



