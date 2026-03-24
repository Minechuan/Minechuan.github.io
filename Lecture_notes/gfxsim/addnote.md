# 如何新增《图形学与物理仿真》课程笔记

本手册说明如何在保持统一风格的前提下，新增双语笔记并挂载到首页。

## 1. 新建双语 Markdown 文件

每一讲使用同一个 `NoteID`，并创建两份文件：

- `YourNoteID.zh.md`
- `YourNoteID.en.md`

示例：

- `Lec2.zh.md`
- `Lec2.en.md`

`NoteID` 仅允许字母、数字、下划线、连字符。

## 2. 更新 NOTES 数组

编辑 `notes.js`，向 `NOTES` 追加一项：

```js
{
  id: "Lec2",
  titleZh: "第2讲 几何变换与约束动力学",
  titleEn: "Lec2 Geometric Transforms and Constrained Dynamics",
  summaryZh: "从矩阵变换过渡到约束系统，建立图形与仿真的统一状态描述。",
  updated: "2026-03-10"
}
```

首页会自动生成条目，默认跳转到：

`note.html?note=Lec2&lang=zh`

## 3. 一级标题独立渲染规则

每篇笔记建议首行写一级标题：

```md
# 第2讲 几何变换与约束动力学
```

系统会将这行一级标题抽离为页面大标题，正文中不重复显示。

## 4. 公式语法

行内公式：

```md
半隐式欧拉可写为 $\mathbf{v}_{t+\Delta t} = \mathbf{v}_t + \Delta t\,\mathbf{a}_t$。
```

块公式：

```md
$$
\mathbf{x}_{t+\Delta t} = \mathbf{x}_t + \Delta t\,\mathbf{v}_{t+\Delta t}
$$
```

## 5. 折叠备注语法（默认折叠）

基础语法：

```md
:::remark 标题
内容...
:::
```

支持类型与别名：

- `remark`（别名：`note`、`备注`）
- `tip`（别名：`hint`、`提示`）
- `warn`（别名：`warning`、`注意`）
- `error`（别名：`danger`、`错误`）

示例：

```md
:::tip 💡 观察轨迹再调参数
先确认积分步长对能量漂移的影响，再调阻尼和约束系数。
:::
```

## 6. 视觉元素迁移约定

跨课程迁移时，请不要复用当前站点的核心主视觉。

当前课程视觉元素候选为：

- 光栅像素采样方格
- 相空间轨迹线
- 碰撞法线箭头
- 关键帧插值曲线
- 粒子涡旋速度场
- 阴影体投影视锥

本课程选用的核心主视觉：`相空间轨迹线`。

迁移到新课程时，需要重新列候选并只选 1 个核心元素。

## 7. 本地预览与 GitHub Pages

若直接使用 `file://` 打开页面，浏览器会限制 `fetch` 读取 Markdown。

请在仓库根目录运行：

```bash
python -m http.server 8000
```

访问：

`http://localhost:8000/gfxsim/index.html`

部署到 GitHub Pages 后可直接访问对应子目录页面。
