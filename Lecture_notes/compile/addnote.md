# 如何新增课程笔记

本目录是一个可部署到 GitHub Pages 的静态课程笔记子站。新增内容时通常只需要改首页的 `NOTES` 数组，并添加成对的 Markdown 文件。

## 视觉元素候选清单

为避免把任意课程都做成同一种模板，编译原理站点先列出与学科强相关的视觉元素：

- 抽象语法树 / 推导树
- 词法 token 流
- 语法产生式
- 编译器流水线
- 控制流图
- 寄存器干涉图

本模板只选择 **抽象语法树 / 推导树** 作为核心视觉元素。它贯穿首页 Hero 与详情页侧栏，其他元素只作为文字内容出现，不再叠加“代码雨”“关键词漂浮”等通用动效。

## 新增一讲

1. 选择一个稳定的 NoteID，例如 `Lec2`、`Syntax` 或 `IR1`。
2. 在当前目录新增两份文件：
   - `Lec2.zh.md`
   - `Lec2.en.md`
3. 打开 `index.html`，在 `NOTES` 数组中追加一条配置：

```js
{
  id: "Lec2",
  titleZh: "Lec2：词法分析",
  titleEn: "Lec2: Lexical Analysis",
  summaryZh: "DFA、正则表达式与最长匹配规则。",
  updated: "2026-06-16"
}
```

首页会自动生成卡片，默认链接到：

```text
note.html?note=Lec2&lang=zh
```

## Markdown 标题规则

每份笔记的第一行建议使用一级标题：

```md
# Lec2：词法分析
```

详情页会把第一行 `# ...` 抽离为页面大标题，正文中不会重复显示该标题。

## 双语命名规则

主模式使用：

```text
note.html?note=<NoteID>&lang=zh
note.html?note=<NoteID>&lang=en
```

对应文件必须是：

```text
<NoteID>.zh.md
<NoteID>.en.md
```

兼容模式也可直接打开单个 Markdown 文件：

```text
note.html?file=addnote.md
```

出于安全考虑，文件名只能包含字母、数字、点、下划线和连字符，并且必须以 `.md` 结尾。

## 公式语法

行内公式使用单个美元符号：

```md
FIRST(E) = { id, ( }
```

写成 Markdown 时：

```md
行内公式示例：$FIRST(E) = \{ id, ( \}$。
```

块公式使用双美元符号单独成行：

```md
$$
E \rightarrow E + T \mid T
$$
```

页面使用 MathJax CDN 渲染公式。部署到 GitHub Pages 后会自动加载。

## 折叠备注

备注默认折叠，语法如下：

```md
:::tip 💡 实践建议
先写出文法，再考虑 parser 的实现方式。
:::
```

支持的类型与别名：

- `remark`，别名：`note`、`备注`
- `tip`，别名：`hint`、`提示`
- `warn`，别名：`warning`、`注意`
- `error`，别名：`danger`、`错误`

四种备注会使用不同但统一的颜色主题。标题中可以使用少量 emoji，例如 📝、💡、⚠️、⛔。

## 本地预览

不要直接用 `file://` 打开页面，因为浏览器会限制 `fetch` 读取本地 Markdown 文件。

请在仓库根目录运行：

```bash
python -m http.server 8000
```

然后访问：

```text
http://localhost:8000/compile/index.html
```

如果这个目录迁移为其他课程，例如 `db/` 或 `ml/`，访问地址也要同步替换目录名。
