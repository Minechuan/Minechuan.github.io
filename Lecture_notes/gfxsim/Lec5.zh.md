# 第5讲 流体仿真：欧拉管线、自由液面追踪与数值扩散控制

## 1. 控制方程视角：流体到底由什么方程主导？

本讲的核心动力学模型是 **Navier-Stokes 动量方程**：

$$
\rho\frac{D\mathbf{v}}{Dt}=\rho\left(\frac{\partial \mathbf{v}}{\partial t}+\mathbf{v}\cdot\nabla\mathbf{v}\right)=-\nabla p+\rho\mathbf{g}+\mu\nabla^2\mathbf{v}
$$

- 左侧：物质导数形式的加速度（拉格朗日视角）
- 右侧：压力、体力、粘性项（欧拉场算子）
- 工程含义：粒子法与网格法是同一连续体方程的两种等价观察方式。

![Navier-Stokes 的拉格朗日/欧拉解释](lec05_materials/navier_stokes_lagrangian_vs_eulerian.png)

:::remark 关键问题：为什么方程会写成“拉格朗日 + 欧拉”混合形式？
因为平流项更符合“跟着物质走”的拉格朗日直觉，而压力/粘性项在固定网格上离散更稳定、更高效。现代求解器通常把两者结合。
:::

## 2. 质量守恒与不可压约束

只写动量方程还不够，还必须满足质量守恒：

$$
\frac{\partial \rho}{\partial t}+\nabla\cdot(\rho\mathbf{v})=0
$$

对图形学常见的不可压近似（含烟雾常见做法）：

$$
\frac{D\rho}{Dt}=0\ \Rightarrow\ \nabla\cdot\mathbf{v}=0
$$

因此压力不仅是一个力项，更是把速度场投影到无散空间的约束机制。

:::tip 关键点
在图形流体中，压力投影首先是“满足不可压约束”的步骤，而不只是热力学意义上的压强演化。
:::

## 3. 两种视角与物质导数

连接拉格朗日与欧拉描述的桥梁是物质导数：

$$
\frac{D\mathbf{q}}{Dt}=\frac{\partial \mathbf{q}}{\partial t}+\mathbf{v}\cdot\nabla\mathbf{q}
$$

解释如下：

- $\frac{\partial \mathbf{q}}{\partial t}$：固定空间点上的局部变化
- $\mathbf{v}\cdot\nabla\mathbf{q}$：随流运动带来的输运变化

这正是后续算子分裂流程的理论起点。

## 4. 网格离散：有限差分基础

规则欧拉网格可存储标量场/向量场，并支持高效有限差分。

本讲反复使用的典型公式：

$$
\frac{f(t_0+\Delta t)-f(t_0-\Delta t)}{2\Delta t}\approx\frac{df(t_0)}{dt}+O(\Delta t^2)
$$

$$
\Delta f_{i,j}\approx\frac{f_{i-1,j}+f_{i+1,j}+f_{i,j-1}+f_{i,j+1}-4f_{i,j}}{h^2}
$$

边界条件决定了域外值如何处理：Dirichlet（定值）、Neumann（定法向导数）、Robin（线性组合）。

:::remark 关键问题：为什么拉普拉斯/泊松求解总强调边界条件？
因为边界决定方程是否有唯一且物理合理的解。在流体里，它直接决定开边界、固壁和流入流出行为。
:::

## 5. 为什么要用交错网格（MAC）

若所有量都放在单元中心，速度导数的离散会很别扭。MAC 网格通常设置为：

- $u$ 放在竖直面中心
- $v$ 放在水平面中心
- 压力与标量放在单元中心

这样离散散度与梯度更加匹配，也能抑制棋盘格伪影。

![交错网格中的速度布局](lec05_materials/staggered_grid_velocity_layout.png)

## 6. 不可压粘性流体的欧拉分裂流程

常见更新流程分成四个子问题：

1. 平流：$\frac{\partial \mathbf{u}}{\partial t}=-\mathbf{u}\cdot\nabla\mathbf{u}$
2. 外力加速：$\frac{\partial \mathbf{u}}{\partial t}=\mathbf{g}$（或其他体力）
3. 粘性/扩散：$\frac{\partial \mathbf{u}}{\partial t}=\frac{\mu}{\rho}\Delta\mathbf{u}$
4. 压力投影：$\frac{\partial \mathbf{u}}{\partial t}=-\frac{1}{\rho}\nabla p$ 且满足 $\nabla\cdot\mathbf{u}=0$

该流程模块化、工程实现友好，但每一步都会引入分裂误差。

## 7. 平流步骤：半拉格朗日回溯

直接欧拉离散平流项容易不稳定。半拉格朗日法通过反向追踪更新：

$$
\mathbf{x}_{\text{old}}=\mathbf{x}-\Delta t\,\mathbf{u}(\mathbf{x}),\qquad u_{i,j}^{\text{new}}=u(\mathbf{x}_{\text{old}})
$$

并配合插值（常见双线性/三线性；MAC 上还要做交错插值）。

![速度更新的半拉格朗日回溯](lec05_materials/semi_lagrangian_backtrace_u_component.png)

:::remark 关键问题：若回溯点落在流体域外怎么办？
若来自已知边界流入，用边界值；若由数值误差导致，则从最近有效流体状态外推。对新激活的流体网格也要执行相同平流更新。
:::

![半拉格朗日边界外推提示](lec05_materials/semi_lagrangian_boundary_extrapolation_note.png)

## 8. 数值扩散：稳定性的代价

半拉格朗日法“无条件稳定”，但会引入人工平滑。以 1D 为例，修正方程可写成：

$$
\frac{\partial q}{\partial t}+u\frac{\partial q}{\partial x}=\frac{u\Delta x}{2}\frac{\partial^2 q}{\partial x^2}
$$

右侧等效于额外扩散（数值粘性），会抹平小尺度涡结构。

:::tip 实战提醒
即便方法在稳定性意义下“无条件稳定”，CFL 仍会显著影响精度与误差传播。
:::

## 9. 粘性与压力投影

### 9.1 粘性/扩散步

一个常见显式模板：

$$
u_{i,j}^{\text{new}}=u_{i,j}+\frac{\mu}{\rho}\Delta t\,\frac{u_{i-1,j}+u_{i+1,j}+u_{i,j-1}+u_{i,j+1}-4u_{i,j}}{h^2}
$$

当 $\frac{\mu}{\rho}\Delta t$ 较大时，往往需要更小子步长或改用隐式方案。

### 9.2 投影步与泊松方程

$$
\mathbf{u}^{\text{new}}=\mathbf{u}^*-\frac{\Delta t}{\rho}\nabla p,
\qquad
\nabla\cdot\mathbf{u}^{\text{new}}=0
$$

可推出

$$
\nabla\cdot\nabla p=\frac{\rho}{\Delta t}\nabla\cdot\mathbf{u}^*
$$

在二维五点格式下：

$$
4p_{i,j}-p_{i-1,j}-p_{i+1,j}-p_{i,j-1}-p_{i,j+1}=\frac{\rho h}{\Delta t}\left(-u_{i+1,j}-v_{i,j+1}+u_{i,j}+v_{i,j}\right)
$$

![压力投影与泊松推导](lec05_materials/pressure_projection_poisson_derivation.png)

### 9.3 压力求解中的边界条件

- 自由液面/开边界：常用 Dirichlet 常压（通常设零表压）
- 固体边界：常用 Neumann 法向约束，并区分 no-stick/no-slip 的切向处理

![投影步骤中的压力边界条件](lec05_materials/pressure_projection_boundary_conditions.png)

:::remark 关键问题：为什么只在流体单元里解压力？
因为压力未知量用于修正流体速度。空气/空单元/固体单元主要通过边界条件影响流体方程，而不是作为同等自由度参与未知量求解。
:::

## 10. 自由液面追踪

在水体仿真里，仅更新不可压速度还不够，还要知道“哪里有水”。

![Marker 粒子与 Level Set 的追踪问题](lec05_materials/water_tracking_marker_vs_levelset.png)

两条主线：

- Marker 粒子：随流运动粒子，标记哪些网格是流体
- Level Set：用带符号距离函数 $\phi$ 表示界面

Level Set 关键方程：

$$
\frac{\partial \phi}{\partial t}=-\mathbf{u}\cdot\nabla\phi,
\qquad
\|\nabla\phi\|=1
$$

![带符号距离函数与重初始化](lec05_materials/level_set_signed_distance_and_reinit.png)

:::remark 关键问题：为什么 Level Set 会丢失细节？
因为平流与重初始化中的数值扩散会平滑高曲率细结构，时间久了薄片和小孔会被抹平甚至消失。
:::

## 11. 染料/烟雾近似与浮力

对烟雾类场景，常见近似是密度变化很小，但通过浮力保留可视效果：

$$
\frac{\partial \mathbf{u}}{\partial t}=-\mathbf{u}\cdot\nabla\mathbf{u}+\mathbf{g}+\mathbf{f}_{\text{buoyancy}}+\frac{\mu}{\rho}\Delta\mathbf{u}-\frac{1}{\rho}\nabla p,
\qquad
\frac{\partial c}{\partial t}=-\mathbf{u}\cdot\nabla c
$$

$$
\mathbf{f}_b=-\alpha c+\beta(T-T_{\text{amb}}),\qquad p=p'+\rho gH
$$

这样既保留不可压求解框架，又能模拟热羽流和浓度驱动上升。

## 12. 降低数值扩散：进阶方向

课程中提到的改进路线包括：

- 高阶平流（MacCormack、BFECC 等）
- Flow Map 与 Covector Advection
- Advection-Reflection（降低分裂导致的能量损失）
- Vorticity Confinement 与 Vortex Method

![Advection-reflection 的能量行为](lec05_materials/advection_reflection_energy_preserving_projection.png)

![Vorticity confinement 计算流程](lec05_materials/vorticity_confinement_pipeline.png)

Vorticity confinement 常见形式：

$$
\boldsymbol\omega=\nabla\times\mathbf{u},\qquad
\mathbf{N}=\frac{\nabla\|\boldsymbol\omega\|}{\|\nabla\|\boldsymbol\omega\|\|},\qquad
\mathbf{f}_{\text{conf}}=\varepsilon\Delta x(\mathbf{N}\times\boldsymbol\omega)
$$

![BiMocq2 多层映射思想](lec05_materials/bimocq2_multi_level_flow_mapping.png)

![Neural flow maps 作为前沿参考方向](lec05_materials/neural_flow_maps_reference.png)

## Exam Review

### A. 定义速查

- **物质导数**：$\frac{D}{Dt}=\frac{\partial}{\partial t}+\mathbf{v}\cdot\nabla$
- **不可压条件**：$\nabla\cdot\mathbf{u}=0$
- **投影步骤**：解压力泊松方程，再从中间速度中减去压力梯度
- **Level Set**：用带符号距离表示界面，$\phi=0$ 即液面

### B. 机制链（简答模板）

1. 从 Navier-Stokes 动量方程出发。
2. 分裂为平流、外力、扩散、投影四步。
3. 用半拉格朗日平流换取稳定性。
4. 解压力泊松方程以满足 $\nabla\cdot\mathbf{u}=0$。
5. 用 Marker 或 Level Set 更新自由液面。
6. 若细节衰减明显，再引入抗扩散技术。

### C. 常见误区

- 把物理粘性和数值扩散混为一谈。
- 组装压力方程时忽略边界条件。
- 把“稳定”误认为“高精度”。
- 在 Level Set 管线中忽视重初始化质量。

### D. 自检问题

- 你能从速度修正式和不可压约束推导出压力泊松方程吗？
- 你能解释为什么 MAC 布局能提升散度/梯度离散一致性吗？
- 你能各用一句话比较 Marker 粒子与 Level Set 吗？
- 你能说出至少两种降低半拉格朗日模糊的方法，并解释其直觉吗？
