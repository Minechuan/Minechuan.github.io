# 第9讲 弹簧-质点系统：显式/隐式欧拉与能量最小化

## 1. 全局图景

本讲把弹簧-质点系统的完整仿真链条串起来：

1. 空间离散：粒子 + 弹簧。
2. 时间离散：显式欧拉 vs 隐式欧拉。
3. 数值求解：把隐式欧拉改写成最小化问题，再用 Newton 类方法求解。

最核心结论是：

- **"Implicit Euler = energy minimization"**。
- 一旦写成最小化形式，稳定性和求解器设计都会更清楚。

## 2. 空间离散：粒子系统与弹簧势能

### 2.1 粒子状态表示

每个粒子保存以下状态/参数：

- 位置 $\mathbf{x}$
- 速度 $\mathbf{v}$
- 力计算器/力输出 $\mathbf{f}$
- 质量 $m$

完整粒子系统就是“所有粒子在时间上的集合”。

![Particle state and system layout](lec09_materials/particle_state_and_system_layout.png)

### 2.2 弹簧能量与成对力

对连接粒子 $i,j$ 的一根弹簧：

$$
\mathbf{x}_{ij}=\mathbf{x}_j-\mathbf{x}_i,
\qquad
E_{ij}=\frac{1}{2}k\left(\lVert\mathbf{x}_{ij}\rVert-l_0\right)^2
$$

从 $j$ 作用到 $i$ 的弹簧力：

$$
\mathbf{f}_{ij}=k\left(\lVert\mathbf{x}_{ij}\rVert-l_0\right)\frac{\mathbf{x}_{ij}}{\lVert\mathbf{x}_{ij}\rVert}=-\mathbf{f}_{ji}
$$

粒子 $i$ 的总受力：

$$
\mathbf{f}_i=\sum_{j\in N(i)}\mathbf{f}_{ij}+\mathbf{f}_i^{ext}
$$

![Spring energy force and total force](lec09_materials/spring_energy_force_and_total_force.png)

:::remark 关键问题（原意复述）：为什么 $\mathbf{f}_{ij}=-\mathbf{f}_{ji}$ 这么重要？
因为内部成对反对称能保证系统内部动量一致性。这个对称性一旦被破坏，就会出现“凭空产生净内力”的数值伪影。
:::

## 3. 时间离散：显式欧拉基线

### 3.1 从积分形式到显式更新

显式欧拉采用左端点近似：

$$
\mathbf{x}(t_n)-\mathbf{x}(t_{n-1})=\int_{t_{n-1}}^{t_n}\mathbf{v}(t)\,dt\approx \mathbf{v}(t_{n-1})\Delta t
$$

$$
\mathbf{v}(t_n)-\mathbf{v}(t_{n-1})=\frac{1}{m}\int_{t_{n-1}}^{t_n}\mathbf{f}(t)\,dt\approx \frac{1}{m}\mathbf{f}(t_{n-1})\Delta t
$$

于是常见更新式是

$$
\mathbf{x}(t_{n+1})=\mathbf{x}(t_n)+\mathbf{v}(t_n)\Delta t,
\qquad
\mathbf{v}(t_{n+1})=\mathbf{v}(t_n)+\frac{1}{m}\mathbf{f}(t_n)\Delta t
$$

### 3.2 显式模拟循环

每个时间步 $t_n\to t_{n+1}$：

1. 用当前位置计算弹簧力。
2. 用当前速度更新位置。
3. 用当前力更新速度。

该方法简单快速，但对刚性系统的精度/稳定性有限。

![Explicit vs implicit Euler comparison](lec09_materials/explicit_vs_implicit_euler_comparison.png)

:::remark 关键问题（原句）："We know this is very inaccurate..." 为什么？
因为力依赖位置，而显式欧拉用的是旧状态的力。对刚性弹簧，截断误差会被迅速放大，$\Delta t$ 不够小时很容易能量爆炸。
:::

## 4. 隐式欧拉：从更新公式到优化问题

### 4.1 隐式方程

隐式欧拉把力评估放到下一时刻：

$$
\mathbf{x}(t_{n+1})=\mathbf{x}(t_n)+\mathbf{v}(t_{n+1})\Delta t,
\qquad
\mathbf{v}(t_{n+1})=\mathbf{v}(t_n)+\frac{1}{m}\mathbf{f}(t_{n+1})\Delta t
$$

把所有粒子拼成块向量，并记 $h=\Delta t$：

$$
\mathbf{x}_{n+1}=\mathbf{x}_n+h\mathbf{v}_{n+1},
\qquad
\mathbf{v}_{n+1}=\mathbf{v}_n+h\mathbf{M}^{-1}\mathbf{f}(\mathbf{x}_{n+1})
$$

![Implicit Euler substitution pipeline](lec09_materials/implicit_euler_substitution_pipeline.png)

### 4.2 外力/内力拆分与 $\mathbf{y}$ 定义

把速度式代回位置式：

$$
\mathbf{x}_{n+1}=\mathbf{x}_n+h\mathbf{v}_n+h^2\mathbf{M}^{-1}\mathbf{f}_{ext}+h^2\mathbf{M}^{-1}\mathbf{f}_{int}(\mathbf{x}_{n+1})
$$

定义

$$
\mathbf{y}=\mathbf{x}_n+h\left(\mathbf{v}_n+h\mathbf{M}^{-1}\mathbf{f}_{ext}\right)
$$

得到

$$
\mathbf{x}_{n+1}=\mathbf{y}+h^2\mathbf{M}^{-1}\mathbf{f}_{int}(\mathbf{x}_{n+1})
$$

### 4.3 改写为能量最小化

利用 $\mathbf{f}_{int}(\mathbf{x})=-dE(\mathbf{x})/d\mathbf{x}$，定义

$$
g(\mathbf{x})=\frac{1}{2h^2}\lVert\mathbf{x}-\mathbf{y}\rVert_\mathbf{M}^2+E(\mathbf{x}),
\qquad
\lVert\mathbf{x}\rVert_\mathbf{M}^2=\mathbf{x}^T\mathbf{M}\mathbf{x}
$$

则求解隐式欧拉等价于

$$
\mathbf{x}_{n+1}=\arg\min_{\mathbf{x}} g(\mathbf{x})
$$

这就是本讲关键句：

- **"Implicit Euler = energy minimization"**
- **"Stable under any timestep size"**（数值意义上的无条件稳定）

![Implicit Euler energy minimization derivation](lec09_materials/implicit_euler_energy_minimization_derivation.png)

:::remark 关键问题（原意复述）：为什么最小化形式会更稳定？
$\frac{1}{2h^2}\lVert\mathbf{x}-\mathbf{y}\rVert_\mathbf{M}^2$ 提供了惯性正则，$E(\mathbf{x})$ 负责弹性约束。两者平衡后，不再像显式外推那样容易在刚性条件下失稳。
:::

## 5. 数值求解：Newton 与主要瓶颈

### 5.1 Newton 迭代

我们要解

$$
\mathbf{x}_{n+1}=\arg\min_{\mathbf{x}} g(\mathbf{x})
$$

使用 Newton 更新：

$$
\mathbf{x}_{k+1}=\mathbf{x}_k-\mathbf{H}(g)^{-1}\nabla g
$$

### 5.2 计算开销来源

讲义强调三件事：

- 每次迭代都要构建 Hessian：$\mathbf{H}(g)\in\mathbb{R}^{3n\times 3n}$。
- 每次迭代都要解大型线性方程。
- 还要做 line search 防止 overshoot。

因此主要瓶颈正是：

- **"Solve Matrix equation at every step (main bottleneck)"**。

![Newton solver Hessian and line search](lec09_materials/newton_solver_hessian_and_line_search.png)

### 5.3 求解器版图

没有“对所有问题都最优”的单一求解器：

- 非线性系统：Newton、Quasi-Newton、BFGS。
- 线性/二次子问题：Jacobi/Gauss-Seidel、Conjugate Gradient、Multigrid。

![Nonlinear and linear solver landscape](lec09_materials/nonlinear_and_linear_solver_landscape.png)

:::remark 关键问题（原意复述）：为什么不存在通用最优求解器？
不同问题的稀疏结构、条件数、非线性强度、精度需求都不同。求解器选择本质是鲁棒性、内存、并行性和收敛速度之间的工程权衡。
:::

## 6. 结果与应用

### 6.1 隐式欧拉在 cloth/rod 上的结果

在 cloth/rod 示例中，隐式积分通常能在更大步长下保持稳定表现。

![Implicit Euler results cloth and rod](lec09_materials/implicit_euler_results_cloth_and_rod.png)

### 6.2 弹簧-质点不只用于布料

弹簧-质点思想也广泛用于软体车辆等形变驱动场景。

![Soft-body spring-mass vehicle example](lec09_materials/soft_body_spring_mass_vehicle_example.png)

## 7. 附录数学：导数与装配

### 7.1 Gradient/Hessian 基础

对标量函数 $f(\mathbf{x})$：

$$
\nabla f(\mathbf{x})=
\begin{bmatrix}
\partial f/\partial x\\
\partial f/\partial y\\
\partial f/\partial z
\end{bmatrix},
\qquad
\mathbf{H}=\mathbf{J}(\nabla f(\mathbf{x}))
$$

### 7.2 单根弹簧的力与切线刚度

两点弹簧 $\mathbf{x}_{01}=\mathbf{x}_0-\mathbf{x}_1$：

$$
E(\mathbf{x})=\frac{k}{2}(\lVert\mathbf{x}_{01}\rVert-L)^2,
\qquad
\mathbf{f}(\mathbf{x})=-\nabla E(\mathbf{x})=
\begin{bmatrix}
\mathbf{f}_e\\-\mathbf{f}_e
\end{bmatrix}
$$

$$
\mathbf{f}_e=-k(\lVert\mathbf{x}_{01}\rVert-L)\frac{\mathbf{x}_{01}}{\lVert\mathbf{x}_{01}\rVert}
$$

$$
\mathbf{H}(\mathbf{x})=
\begin{bmatrix}
\mathbf{H}_e & -\mathbf{H}_e\\
-\mathbf{H}_e & \mathbf{H}_e
\end{bmatrix}
$$

$$
\mathbf{H}_e=k\frac{\mathbf{x}_{01}\mathbf{x}_{01}^T}{\lVert\mathbf{x}_{01}\rVert^2}+k\left(1-\frac{L}{\lVert\mathbf{x}_{01}\rVert}\right)\left(\mathbf{I}-\frac{\mathbf{x}_{01}\mathbf{x}_{01}^T}{\lVert\mathbf{x}_{01}\rVert^2}\right)
$$

![Gradient Hessian and spring derivatives](lec09_materials/gradient_hessian_and_spring_derivatives.png)

### 7.3 仿真中的全局装配形式

实际求解里：

$$
\nabla g(\mathbf{x}^{(k)})=\frac{1}{h^2}\mathbf{M}(\mathbf{x}^{(k)}-\mathbf{y})-\mathbf{f}(\mathbf{x}^{(k)}),
\qquad
\frac{\partial^2g(\mathbf{x}^{(k)})}{\partial\mathbf{x}^2}=\frac{1}{h^2}\mathbf{M}+\mathbf{H}(\mathbf{x}^{(k)})
$$

$$
\mathbf{H}(\mathbf{x})=\sum_{e=\{i,j\}}
\begin{bmatrix}
\mathbf{H}_e & -\mathbf{H}_e\\
-\mathbf{H}_e & \mathbf{H}_e
\end{bmatrix}
$$

![Spring-mass gradient Hessian assembly](lec09_materials/spring_mass_gradient_hessian_assembly.png)

:::remark 关键问题（原意复述）：为什么全局 Hessian 是 $\begin{bmatrix}\mathbf{H}_e&-\mathbf{H}_e\\-\mathbf{H}_e&\mathbf{H}_e\end{bmatrix}$ 这种块？
一根弹簧只耦合两个端点，所以二阶导天然对应“自项为正、交叉项为负”的 2x2 块结构。把所有弹簧叠加后就是稀疏对称全局矩阵。
:::

## 8. Exam Review

### A. 必须精确定义的概念

- **Particle state**：单粒子 $(\mathbf{x},\mathbf{v},\mathbf{f},m)$。
- **Spring energy**：$E_{ij}=\frac{1}{2}k(\lVert\mathbf{x}_{ij}\rVert-l_0)^2$。
- **Implicit Euler**：在下一时刻状态上评估力。
- **Energy minimization form**：$\mathbf{x}_{n+1}=\arg\min g(\mathbf{x})$。
- **Newton step**：$\mathbf{x}_{k+1}=\mathbf{x}_k-\mathbf{H}^{-1}\nabla g$。

### B. 机制链（简答模板）

1. 用粒子位置建立弹簧能量与弹簧力。
2. 显式欧拉实现简单，但刚性系统下需极小 $\Delta t$ 才稳定。
3. 把隐式欧拉改写成关于 $\mathbf{x}_{n+1}$ 的非线性方程。
4. 再把该方程改写成最小化 $g(\mathbf{x})$。
5. 用 Newton + line search + 线性方程求解器完成每步更新。

### C. 常见误区

- 混淆 $\mathbf{f}_{int}$ 与 $\nabla E$ 的符号约定。
- 以为隐式欧拉“没有代价”：它是用更重的求解换更稳的步长。
- 忽略 line search，导致 Newton 过冲或发散。
- 把 Hessian 当稠密矩阵处理，忽略其稀疏块结构。

### D. 自检问题

- 你能从隐式欧拉推到 $\mathbf{x}_{n+1}=\mathbf{y}+h^2\mathbf{M}^{-1}\mathbf{f}_{int}(\mathbf{x}_{n+1})$ 吗？
- 你能解释为什么它等价于最小化 $\frac{1}{2h^2}\lVert\mathbf{x}-\mathbf{y}\rVert_\mathbf{M}^2+E(\mathbf{x})$ 吗？
- 你能写出一个 Newton 更新并指出两个主要计算瓶颈吗？
- 你能解释 $g(\mathbf{x})$ 中惯性项和弹性项的物理意义吗？
- 你能重建单根弹簧的 $\mathbf{H}_e$ 并说明全局装配吗？

:::remark 自检参考答案
1. 把 $\mathbf{v}_{n+1}=\mathbf{v}_n+h\mathbf{M}^{-1}\mathbf{f}(\mathbf{x}_{n+1})$ 代入 $\mathbf{x}_{n+1}=\mathbf{x}_n+h\mathbf{v}_{n+1}$，再拆分 $\mathbf{f}=\mathbf{f}_{ext}+\mathbf{f}_{int}(\mathbf{x}_{n+1})$，并定义 $\mathbf{y}=\mathbf{x}_n+h(\mathbf{v}_n+h\mathbf{M}^{-1}\mathbf{f}_{ext})$。

2. 可得方程 $\mathbf{x}-\mathbf{y}-h^2\mathbf{M}^{-1}\mathbf{f}_{int}(\mathbf{x})=0$。代入 $\mathbf{f}_{int}(\mathbf{x})=-dE/d\mathbf{x}$，这正是 $g(\mathbf{x})=\frac{1}{2h^2}\lVert\mathbf{x}-\mathbf{y}\rVert_\mathbf{M}^2+E(\mathbf{x})$ 的一阶最优条件。

3. Newton 更新是 $\mathbf{x}_{k+1}=\mathbf{x}_k-\mathbf{H}(g)^{-1}\nabla g$。两大瓶颈是：Hessian 装配，以及线性方程求解。

4. $\frac{1}{2h^2}\lVert\mathbf{x}-\mathbf{y}\rVert_\mathbf{M}^2$ 约束新状态接近惯性预测；$E(\mathbf{x})$ 惩罚弹性形变。

5. 单根弹簧贡献块是 $\begin{bmatrix}\mathbf{H}_e&-\mathbf{H}_e\\-\mathbf{H}_e&\mathbf{H}_e\end{bmatrix}$。对所有弹簧求和即可得到稀疏全局 Hessian。
:::
