# 第1讲 渲染管线与时间积分基础

## 1. 为什么这一讲重要

计算机图形学不只是“把东西画出来”。在工程里，我们实际在做一个闭环：

1. 建立世界模型。
2. 模拟状态随时间演化。
3. 将更新后的状态渲染成可视结果。

一个稳定可用的模拟器通常由三个耦合模块构成：

1. 空间离散：决定如何表示世界状态。
2. 时间离散：决定如何推进时间。
3. 数值求解器：求解前两步带来的方程系统。

:::remark 关键问题：物理定律都已知，为什么还需要数值模拟？
因为真实系统通常包含无限自由度（连续介质、场、约束等）。定律本身已知，但解析解往往不可得。数值模拟的作用是把物理规律转成可计算的离散更新规则。
:::

## 2. 从物理模型到可计算状态

粒子层面的起点是牛顿定律：

$$
\mathbf{F} = m\mathbf{a}
$$

单粒子看似简单，但图形仿真系统往往是多粒子或连续场。于是我们把系统写成“状态 + 更新”的形式。

常见状态量：

- 位置 $\mathbf{x}$
- 速度 $\mathbf{v}$
- 力 $\mathbf{f}$
- 质量 $m$

对多粒子系统，常用堆叠向量和质量矩阵表示：

$$
\frac{d\mathbf{v}}{dt}=\mathbf{M}^{-1}\mathbf{f}
$$

## 3. 空间离散：表示方式的选择

### 3.1 主流表示

课程中强调的表示方式包括：

- 网格（Mesh，三角形/四面体）
- 粒子系统（Particle）
- 体素/规则网格（Grid）
- 混合表示（Hybrid）

![表示法优劣对比](lec01_materials/representation_tradeoff_table.png)

它们各有代价：

- Grid：结构规整、效率高，但边界处理和形状跟踪更难。
- Mesh：贴合边界、历史映射自然，但建网格和重网格成本高。
- Particle：结构简单、历史追踪友好，但空间积分和邻域处理较困难。

:::tip 关键问题：是不是应当全程只用一种表示？
通常不建议。图形仿真问题往往同时需要多种表示的优势，实际项目里混合方法非常常见。
:::

### 3.2 拉格朗日与欧拉视角

本讲的两个核心视角：

- **拉格朗日视角**：跟踪物质点，常对应 ODE 形式。
- **欧拉视角**：在固定空间位置观察场量，常对应 PDE 形式。

### 3.3 ODE 与 PDE 问题类型

一般 n 阶 ODE 形式：

$$
\mathbf{x}^{(n)} = f\big(t,\mathbf{x},\dot{\mathbf{x}},\ddot{\mathbf{x}},\ldots,\mathbf{x}^{(n-1)}\big)
$$

扩散方程（PDE）示例：

$$
\frac{\partial u}{\partial t} = \sum_{i=1}^{n}\frac{\partial^2u}{\partial x_i^2} = \nabla\cdot\nabla u = \Delta u
$$

可操作理解：

- ODE 通常以初值条件为主。
- PDE 既要初值，也要边界条件。

:::remark 关键问题：为什么 PDE 里边界条件如此关键？
因为 PDE 的未知量定义在空间域上。若不给边界条件，边界处演化并不封闭，数值问题会欠定或物理意义不完整。
:::

## 4. 几何与微积分基础

### 4.1 插值与重心坐标

插值在仿真中无处不在：网格采样、网格属性映射、跨表示传递等。

三角形重心坐标：

$$
\mathbf{p}=b_0\mathbf{x}_0+b_1\mathbf{x}_1+b_2\mathbf{x}_2,
\quad
b_i=\frac{A_i}{A},
\quad
b_0+b_1+b_2=1
$$

点在三角形内的判定：

$$
0<b_i<1\ (i=0,1,2),\ \text{且共面}
$$

![重心坐标示意](lec01_materials/barycentric_coordinates_geometry.png)

### 4.2 高频复用的微分算子

对标量场与向量场：

$$
\nabla f = \left(\frac{\partial f}{\partial x},\frac{\partial f}{\partial y},\frac{\partial f}{\partial z}\right)
$$

$$
\nabla\cdot\mathbf{f} = \frac{\partial f}{\partial x}+\frac{\partial g}{\partial y}+\frac{\partial h}{\partial z}
$$

$$
\nabla\times\mathbf{f} = \left(\frac{\partial h}{\partial y}-\frac{\partial g}{\partial z},\frac{\partial f}{\partial z}-\frac{\partial h}{\partial x},\frac{\partial g}{\partial x}-\frac{\partial f}{\partial y}\right)
$$

二阶量：

$$
\mathbf{H}=\mathbf{J}(\nabla f),
\quad
\Delta f=\nabla\cdot\nabla f = \operatorname{trace}(\mathbf{H})
$$

## 5. 时间积分：稳定性与精度

### 5.1 从连续积分到离散更新

基本积分关系：

$$
\mathbf{x}(t_n)-\mathbf{x}(t_{n-1}) = \int_{t_{n-1}}^{t_n}\mathbf{v}(t)\,dt
$$

$$
\mathbf{v}(t_n)-\mathbf{v}(t_{n-1}) = \frac{1}{m}\int_{t_{n-1}}^{t_n}\mathbf{f}(\mathbf{x}_p,t)\,dt
$$

时间积分器的本质就是对这些积分做近似。

### 5.2 显式欧拉（Explicit Euler）

$$
\mathbf{x}_{n+1}=\mathbf{x}_n+\mathbf{v}_n\Delta t,
\quad
\mathbf{v}_{n+1}=\mathbf{v}_n+\frac{1}{m}\mathbf{f}_n\Delta t
$$

在无阻尼弹簧模型

$$
m\frac{dv}{dt}=-kx,
\quad
\frac{dx}{dt}=v
$$

下，本讲强调：显式欧拉对振荡系统较脆弱，能量可能逐步发散。

![显式欧拉不稳定示意](lec01_materials/explicit_euler_unstable_spring.png)

### 5.3 隐式欧拉（Implicit Euler）

$$
\mathbf{x}_{n+1}=\mathbf{x}_n+\mathbf{v}_{n+1}\Delta t,
\quad
\mathbf{v}_{n+1}=\mathbf{v}_n+\frac{1}{m}\mathbf{f}_{n+1}\Delta t
$$

线性弹簧可整理为隐式方程：

$$
\mathbf{x}_{n+1}=\mathbf{x}_n+\mathbf{v}_n\Delta t-\frac{k}{m}\mathbf{x}_{n+1}\Delta t^2
$$

因此每步要解方程（或线性系统），但稳定性显著更好。

![隐式欧拉稳定示意](lec01_materials/implicit_euler_stable_spring.png)

:::remark 关键问题：为什么隐式欧拉更稳定？
因为力在“下一时刻状态”上评估，数值上会引入抑制高频放大的效果，对刚性系统更稳健。
:::

### 5.4 辛欧拉、中点法、RK、Leap-Frog

辛欧拉（半隐式欧拉）：

$$
\mathbf{v}_{n+1}=\mathbf{v}_n+\frac{1}{m}\mathbf{f}_n\Delta t,
\quad
\mathbf{x}_{n+1}=\mathbf{x}_n+\mathbf{v}_{n+1}\Delta t
$$

中点法：

$$
\mathbf{x}_{n+1}=\mathbf{x}_n+\mathbf{v}_{n+1/2}\Delta t,
\quad
\mathbf{v}_{n+1}=\mathbf{v}_n+\frac{1}{m}\mathbf{f}_{n+1/2}\Delta t
$$

RK4 紧凑形式：

$$
\mathbf{s}_{n+1}=\mathbf{s}_n+\frac{\Delta t}{6}(k_1+2k_2+2k_3+k_4)
$$

Leap-Frog（速度半步交错）：

$$
\mathbf{v}_{n+1/2}=\mathbf{v}_{n-1/2}+\mathbf{a}_n\Delta t,
\quad
\mathbf{x}_{n+1}=\mathbf{x}_n+\mathbf{v}_{n+1/2}\Delta t
$$

![Leap-Frog 时间交错](lec01_materials/leapfrog_time_staggering.png)

## 6. 如何评价积分器

本讲反复提出同一个评价框架：

1. 稳定性：误差/能量是否会随步进累积并放大。
2. 收敛性（一致性）：当 $h\to0$ 时误差是否趋于 0。
3. 精度阶：局部截断误差数量级，如 n 阶方法常见 $\mathcal{O}(h^{n+1})$。

课程中的典型结论：

- 显式欧拉局部截断误差：$\mathcal{O}(\Delta t^2)$（一阶方法）。
- 中点法局部截断误差：$\mathcal{O}(\Delta t^3)$（二阶方法）。

:::tip 关键问题：把欧拉法切很多子步，是否等价于高阶方法？
不等价。减小步长能改进结果，但在同等代价下，真正高阶方法通常有更好的误差-效率表现。
:::

## 7. 数值求解器在流程中的位置

离散化之后就会得到方程系统，求解器是落地关键。

线性系统常见方法：

- Jacobi / Gauss-Seidel
- 共轭梯度（含预条件变体）
- 多重网格

非线性系统常见方法：

- Newton
- Quasi-Newton / BFGS

含约束优化常见方法：

- 罚函数
- 投影修正
- 拉格朗日乘子 / 原始-对偶 / ADMM 类方法

没有一种求解器对所有问题都最优，需结合结构、条件数与精度目标选择。

## 8. 公式速查（与课件主线对应）

- $\mathbf{F}=m\mathbf{a}$
- $\mathbf{x}^{(n)} = f(t,\mathbf{x},\dot{\mathbf{x}},\ldots)$
- $\dfrac{\partial u}{\partial t}=\Delta u$
- $\nabla f$, $\nabla\cdot\mathbf{f}$, $\nabla\times\mathbf{f}$
- $\Delta f = \nabla\cdot\nabla f = \operatorname{trace}(\mathbf{H})$
- $\mathbf{p}=\sum_i b_i\mathbf{x}_i$, $b_i=A_i/A$
- 显式/隐式/辛欧拉更新式
- 中点法/RK4/Leap-Frog 更新式
- 截断误差阶：$\mathcal{O}(\Delta t^2)$、$\mathcal{O}(\Delta t^3)$

## 9. Exam Review

### 9.1 高频定义

- **空间离散**：把连续几何/场量转成有限可计算表示。
- **时间离散**：把连续时间演化转成离散更新步骤。
- **稳定性**：迭代过程中误差或能量增长是否受控。
- **一致性与收敛性**：步长减小时离散解是否逼近连续模型。

### 9.2 机制型答题清单

1. 先选表示（粒子/网格/规则网格/混合）。
2. 写控制方程（ODE/PDE + 初值/边界 + 约束）。
3. 选积分器（显式、隐式、辛、RK）。
4. 选求解器与收敛准则。
5. 用稳定性、收敛性和运行代价做验证。

### 9.3 简答模板

- 为什么刚性系统常用隐式法？
因为隐式更新在未来状态上评估力，稳定域更大，对大刚度更稳。

- 为什么流体常见欧拉视角？
因为固定空间网格便于表达场量演化与微分算子离散。

- 为什么显式欧拉在振荡问题上会失效？
因为相位与能量误差会逐步累积并可能放大。

### 9.4 易错点

- 把几何向量和堆叠状态向量混为一谈。
- PDE 问题忽略边界条件。
- 只看“画面像不像”，不做数值诊断。

### 9.5 交卷前自检

1. 是否清楚给出视角与空间表示？
2. 是否明确初值/边界/约束？
3. 是否用稳定性与精度解释积分器选择？
4. 是否说明线性/非线性求解器需求？
5. 是否给出至少一个定量误差或稳定性论据？
