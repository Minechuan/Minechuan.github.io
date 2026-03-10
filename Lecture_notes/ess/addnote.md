# Electrical and Servicing Systems 笔记维护手册

本模板可直接部署到 GitHub Pages。维护重点是 `notes.js` 内的 `NOTES` 数组与双语 Markdown 文件。

## 1. 新增一讲笔记

1. 新建中文文件：`<NoteID>.zh.md`
2. 新建英文文件：`<NoteID>.en.md`
3. 两个文件必须使用同一个 `NoteID`，例如：
   - `Lec2.zh.md`
   - `Lec2.en.md`
4. 在 `notes.js` 的 `NOTES` 数组新增一条记录：

```js
{
  id: "Lec2",
  titleZh: "第2讲 维护流程、故障定位与仪表使用",
  titleEn: "Lec2 Servicing Workflow, Fault Isolation, and Meter Usage",
  summaryZh: "理解维护闭环步骤，并掌握万用表测量中的安全边界。",
  updated: "2026-03-11"
}
```

## 2. 路由规则

- 主模式：`note.html?note=<NoteID>&lang=zh|en`
- 兼容模式：`note.html?file=<filename.md>`
- 首页列表默认链接中文版本：`lang=zh`

## 3. 一级标题规则

每个 Markdown 的第一行请使用一级标题：

```md
# 第2讲 维护流程、故障定位与仪表使用
```

系统会把这行标题抽离为页面大标题，正文中不会重复显示。

## 4. 公式写法（MathJax）

- 行内公式：`$P = UI$`
- 块公式：

```md
$$
R_{eq} = \left(\sum_{k=1}^{n} \frac{1}{R_k}\right)^{-1}
$$
```

## 5. 备注折叠语法（默认折叠）

支持如下结构：

```md
:::remark 📝 现场记录
这里写备注内容。
:::
```

支持类型与别名：

- `remark`：`note`、`备注`
- `tip`：`hint`、`提示`
- `warn`：`warning`、`注意`
- `error`：`danger`、`错误`

## 6. 本地预览

浏览器直接双击打开是 `file://` 协议，`fetch` 会被限制。请使用本地 HTTP 服务：

```bash
python -m http.server 8000
```

然后访问：

`http://localhost:8000/ess/index.html`

## 7. 迁移到其他课程

1. 修改 `notes.js` 中课程信息与 `NOTES` 数组
2. 按课程语义替换 `style.css` 配色和主视觉
3. 替换 Markdown 内容
4. 保留一门课只使用一个核心视觉元素的原则，避免模板化换皮
