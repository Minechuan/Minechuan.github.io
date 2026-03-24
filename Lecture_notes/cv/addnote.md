# 如何新增课程笔记（CV 模板）

本文档说明如何在本课程子站中新增笔记，并保证首页列表、双语切换、公式和备注框都可用。

## 1. 文件命名规则（双语）

每个笔记 ID 对应两份 Markdown：

- `<NoteID>.zh.md`
- `<NoteID>.en.md`

示例：

- `Lec2.zh.md`
- `Lec2.en.md`

`NoteID` 建议使用字母、数字、下划线、连字符，例如：`Lec2`、`proj_week1`。

## 2. 挂载到首页 NOTES 数组

在 `index.html` 中找到 `NOTES` 数组，新增一项：

```js
{
  id: "Lec2",
  titleZh: "第二讲：图像滤波与边缘",
  titleEn: "Lecture 2: Filtering and Edges",
  summaryZh: "介绍卷积、平滑、梯度与 Canny 思路。",
  updated: "2026-03-21",
}
```

首页列表会自动生成链接：

- `note.html?note=<id>&lang=zh`

## 3. 详情页参数说明

主模式：

- `note.html?note=<NoteID>&lang=zh`
- `note.html?note=<NoteID>&lang=en`

兼容模式（直接指定文件）：

- `note.html?file=addnote.md`

## 4. 一级标题规则

每篇 Markdown 的第一行建议是一级标题：

```md
# 第二讲：图像滤波与边缘
```

渲染器会将这行标题抽离为页面大标题，正文中不会重复显示。

## 5. 公式语法（MathJax）

行内公式：

```md
SIFT 的尺度空间常用 $L(x,y,\sigma)=G(x,y,\sigma)*I(x,y)$ 表达。
```

块公式：

```md
$$
\nabla I = \left[\frac{\partial I}{\partial x},\frac{\partial I}{\partial y}\right]
$$
```

## 6. 折叠备注语法

基础语法：

```md
:::remark 📝 术语备注
这里写备注内容。
:::
```

支持类型与别名：

- `remark`：别名 `note`、`备注`
- `tip`：别名 `hint`、`提示`
- `warn`：别名 `warning`、`注意`
- `error`：别名 `danger`、`错误`

示例：

```md
:::tip 💡 阅读建议
先看直观图，再看公式推导。
:::

:::warn ⚠️ 常见误区
不要把像素坐标系和相机坐标系混为一谈。
:::
```

## 7. 本地预览方式

不要直接双击 HTML（`file://`）预览，浏览器会限制 `fetch` 读取 Markdown。

请在课程目录上级运行：

```bash
python -m http.server 8000
```

然后访问：

```text
http://localhost:8000/cv/index.html
```

## 8. 迁移到其他课程

复制整个 `cv/` 目录并改名（如 `ml/`、`net/`），然后替换：

- 课程名称与描述（`index.html`）
- 主题配色（`style.css` 变量）
- `NOTES` 数组与 Markdown 内容
- 背景主视觉（保持“一个核心元素”原则）
