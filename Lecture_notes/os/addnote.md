# 如何新增课程笔记（OS 模板）

本文档用于协作者快速维护 `os/` 子站。

## 0) 设计约束（迁移时先看）

元素候选清单（与 OS 语义关联）：
1. PCB 状态迁移图
2. Trap/系统调用入口与返回路径
3. 页表层级
4. CPU 调度时间片轨道
5. 信号量等待队列
6. inode 目录树

当前模板只选 1 个核心主视觉：**CPU 调度时间片轨道**。
迁移到其他课程时，不要直接沿用本动效。请先重新列候选，再只选 1 个核心元素，确保课程间风格有明显差异。

## 1) 新增一讲笔记

以第 2 讲为例，需要创建两份文件：

- `Lec2.zh.md`
- `Lec2.en.md`

命名规则：`<NoteID>.zh.md` 与 `<NoteID>.en.md`，其中 `<NoteID>` 只能使用字母、数字、下划线、连字符。

## 2) 挂载到首页

编辑 `index.html` 中的 `NOTES` 数组，新增一项：

```js
{
  id: "Lec2",
  titleZh: "第 2 讲：...",
  titleEn: "Lecture 2: ...",
  summaryZh: "一句话摘要...",
  updated: "2026-04-17"
}
```

首页点击后默认进入：`note.html?note=Lec2&lang=zh`。

## 3) 一级标题规则

每份 Markdown 的第一行建议写一级标题：

```md
# 第 2 讲：标题
```

`note.html` 会把第一行一级标题单独渲染为页面大标题，正文中不会重复出现。

## 4) 公式语法（MathJax）

行内公式：

```md
时间片长度可记作 $q$。
```

块公式：

```md
$$
R = \frac{W}{S}
$$
```

## 5) 折叠备注语法（默认折叠）

统一语法：

```md
:::remark 标题
内容...
:::
```

支持类型与别名：

- `remark`：`note`、`备注`
- `tip`：`hint`、`提示`
- `warn`：`warning`、`注意`
- `error`：`danger`、`错误`

示例：

```md
:::tip 💡 复习建议
先看调度目标，再看算法细节。
:::

:::warning ⚠️ 常见误区
吞吐量高不等于响应时间短。
:::
```

## 6) 兼容访问模式

主模式（推荐）：

- `note.html?note=Lec1&lang=zh`
- `note.html?note=Lec1&lang=en`

兼容模式：

- `note.html?file=Lec1.zh.md`
- `note.html?file=addnote.md`

## 7) 本地预览

不要直接双击 `html` 使用 `file://` 预览。

在 `os/` 的上级目录执行：

```bash
python -m http.server 8000
```

然后访问：

```text
http://localhost:8000/os/index.html
```
