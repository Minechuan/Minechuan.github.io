# 第4讲 约束动力学：拉格朗日乘子、接触与互补问题

## 1. 为什么仿真必须处理约束

这一讲把很多图形仿真任务统一为“约束动力学”问题：

- 我们仍然从初值出发推进时间演化；
- 我们仍然满足物理方程（ODE/PDE）；
- 还必须同时满足几何/接触条件，比如等式约束 $h(\mathbf{q})=0$ 和不等式约束 $g(\mathbf{q})\ge 0$。

换句话说，仿真质量不只取决于积分器，还取决于约束处理是否稳定且物理一致。

:::remark 关键问题：为什么不能先按无约束系统积分，再在最后“修一下”？
因为很多约束本身就是力学结构（关节、不可穿透、不可伸长）。如果求解阶段忽略它们，后处理会带来漂移、震荡和非物理能量注入。
:::

## 2. 核心视角：问题形式与数值工具

课程给出的统一视角是：

1. 状态变量：$\mathbf{q}=(\mathbf{x}_1,\mathbf{x}_2,\ldots)$。
2. 物理方程：$f_{\mathrm{ODE}}(\mathbf{q},\dot{\mathbf{q}},\mathbf{f},t)=0$（或 PDE 形式）。
3. 约束方程：等式 + 不等式。

常见求解后端包括：

- 线性方程组方法（LU、Cholesky、CG/PCG）
- 非线性方法（Newton、拟牛顿）
- 约束优化与互补问题求解

因此，约束动力学本质上是“建模 + 求解器设计”的联合问题。

## 3. Penalty 方法：软约束

**Penalty 方法**通过附加恢复力把系统拉回可行域。

![Penalty 约束与恢复力](lec04_materials/penalty_method_constraint_and_force.png)

对一个简单的等式型条件：

$$
C(\mathbf{x})=(\mathbf{x}_1+\mathbf{r}_1)-(\mathbf{x}_2+\mathbf{r}_2)=\mathbf{0}
$$

常见惩罚力写法：

$$
\mathbf{f}_p=-k\big((\mathbf{x}_2+\mathbf{r}_2)-(\mathbf{x}_1+\mathbf{r}_1)\big),\qquad
m\mathbf{a}=\mathbf{f}+\mathbf{f}_p
$$

优缺点非常典型：

- 接入简单，改造成本低
- 需要调参（刚度 $k$）
- $k$ 过大导致系统变硬，时间步受限
- 只能减小约束误差，不能严格为零

:::remark 关键问题：Penalty 已经很常用，为什么还要学硬约束？
因为高精度关节和持续接触常要求几何误差接近零，Penalty 往往在稳定性和精度之间做折中。
:::

## 4. 拉格朗日乘子法：硬约束

课程随后把约束力作为未知反力来解。

### 4.1 隐式曲面与梯度

可行流形写作：

$$
g(\mathbf{x})=0
$$

![约束隐式曲面与梯度](lec04_materials/constraint_implicit_surface_gradient.png)

梯度给出流形法向：

$$
\nabla g(\mathbf{x})=
\begin{pmatrix}
\frac{\partial g}{\partial x_1}(\mathbf{x})\\
\frac{\partial g}{\partial x_2}(\mathbf{x})\\
\vdots\\
\frac{\partial g}{\partial x_n}(\mathbf{x})
\end{pmatrix}
$$

### 4.2 无功约束力

**约束力“按需提供”**，并满足可行运动方向上不做功：

$$
\mathbf{f}_c\cdot\mathbf{z}=0
\quad\Rightarrow\quad
\mathbf{f}_c=\lambda\nabla g(\mathbf{x})
$$

![约束力与拉格朗日乘子](lec04_materials/constraint_force_lagrange_multiplier.png)

这里的 $\lambda$ 就是拉格朗日乘子，表示约束反力强度。

## 5. 约束动力学方程

引入雅可比 $J$ 后：

$$
M\mathbf{a}=\mathbf{F}+\mathbf{F}_c=\mathbf{F}+J^T\boldsymbol{\lambda}
$$

并满足加速度层约束：

$$
\ddot g(\mathbf{x})=\dot J\mathbf{v}+J\mathbf{a}=0
$$

课程强调三层关系：

- 位置层：$g(\mathbf{x})=0$
- 速度层：$\dot g(\mathbf{x})=J(\mathbf{x})\mathbf{v}=0$
- 加速度层：$\ddot g(\mathbf{x})=\dot J\mathbf{v}+J\mathbf{a}=0$

![约束方程逐次求导](lec04_materials/differentiated_constraint_equations.png)

## 6. 多约束与线性系统求解

当有 $m$ 个约束时，未知量 $(\mathbf{a},\boldsymbol\lambda)$ 是耦合的。

Schur 补形式：

$$
(JM^{-1}J^T)\boldsymbol{\lambda}=-JM^{-1}\mathbf{F}-\dot J\mathbf{v}
$$

鞍点系统形式：

$$
\begin{pmatrix}
M & -J^T\\
-J & 0
\end{pmatrix}
\begin{pmatrix}
\mathbf{y}\\
\boldsymbol{\lambda}
\end{pmatrix}
=
\begin{pmatrix}
\mathbf{0}\\
-\mathbf{b}
\end{pmatrix},
\quad
\mathbf{b}=JM^{-1}\mathbf{F}+\dot J\mathbf{v},
\quad
\mathbf{y}=\mathbf{a}-M^{-1}\mathbf{F}
$$

![多约束线性系统](lec04_materials/multiple_constraints_linear_system.png)

:::tip 关键问题：为什么课件特别提醒 $J$、$M$ 稀疏，但 $JM^{-1}J^T$ 往往不稀疏？
因为这直接决定内存和计算成本。若显式构造降维矩阵，稀疏性可能被破坏，求解代价会明显上升。
:::

## 7. 漂移与 Baumgarte 稳定化

离散时间下，即便连续方程正确，也会出现约束漂移。

课程给出的经典稳定化形式：

$$
J\mathbf{v}_{n+1}=-\alpha\frac{g(\mathbf{x}_n)}{h},
\qquad
M\frac{\mathbf{v}_{n+1}-\mathbf{v}_n}{h}=\mathbf{F}+J^T\boldsymbol\lambda
$$

可得到修正后的乘子方程：

$$
(JM^{-1}J^T)\boldsymbol\lambda
=-JM^{-1}\mathbf{F}-J\frac{\mathbf{v}_n}{h}-\alpha\frac{g}{h^2}
$$

![Baumgarte 稳定化公式](lec04_materials/baumgarte_stabilization_forms.png)

:::remark 关键问题：Baumgarte 实际在做什么权衡？
它用数值阻尼来抑制漂移，换来更稳的离散行为。参数太小抑制不够，太大又可能导致振荡和刚性问题。
:::

## 8. 刚体系统的约束化表达

课程把多刚体写成统一的约束系统（堆叠状态、力、雅可比）。

![刚体等式约束与雅可比](lec04_materials/rigid_body_equality_constraint_jacobian.png)

代表性关节约束：

$$
C(\mathbf{s})=\mathbf{x}_2+\mathbf{r}_2-\mathbf{x}_1-\mathbf{r}_1=0
$$

速度层导数：

$$
\frac{dC}{dt}=\mathbf{v}_2+\boldsymbol\omega_2\times\mathbf{r}_2-\mathbf{v}_1-\boldsymbol\omega_1\times\mathbf{r}_1
$$

对应雅可比结构：

$$
J=\big(-E_3\;[\mathbf{r}_1]_\times\;E_3\;-[\mathbf{r}_2]_\times\big)
$$

## 9. 约束式刚体接触

在多接触场景中，课程对比了两种思路：

- 冲量法：直接解冲量
- 约束法：把速度与约束反力联立求解

![刚体接触与互补建模](lec04_materials/rigid_body_contact_complementarity_setup.png)

法向接触条件常写成互补形式：

$$
0\le u_{\hat n}\perp\lambda_{\hat n}\ge 0
$$

可理解为：法向分离趋势与法向接触反力不能同时“激活”。

## 10. 互补问题与摩擦耦合

课程给出通用互补形式：

$$
0\le x\perp y(x)\ge 0
$$

- 若 $y=Ax+b$，得到线性互补问题（LCP）
- 若 $y(\cdot)$ 非线性，得到非线性互补问题（NCP）

法向与切向通过摩擦锥条件耦合：

$$
\mu\lambda_{\hat n}-\|\lambda_{\hat t}\|\ge 0,
\qquad
\|\mathbf{v}_{\hat t}\|\big(\mu\lambda_{\hat n}-\|\lambda_{\hat t}\|\big)=0
$$

![法向与切向互补关系](lec04_materials/normal_tangent_contact_complementarity.png)

### 10.1 课件提到的数值方法

- Pivoting 方法
- 不动点方法
- 非光滑 Newton 方法

## 11. 工具与工程方向

课程给出了工程系统参考。

![MuJoCo 示例](lec04_materials/mujoco_example_scene.png)

**MuJoCo** 被解释为 **Multi-Joint dynamics with Contact**，是约束动力学在工业级工具中的典型实现。

## 12. 广义坐标视角

最后一部分强调从 maximal coordinates 走向 generalized coordinates。

![广义坐标总结](lec04_materials/generalized_coordinates_summary.png)

核心对比：

- 最大坐标：变量多，额外约束多
- 广义坐标：变量更少（$N\lt n$），部分约束已内化到参数化中

:::tip 关键问题：用了广义坐标后，约束问题就完全消失了吗？
不会。它可以吸收很多完整约束，但接触和不等式约束通常仍需要专门处理。
:::

## 13. Exam Review

### 13.1 高价值定义

- **约束（Constraint）**：可行状态必须满足的几何/运动条件。
- **Penalty 方法**：用恢复力软性逼近约束。
- **拉格朗日乘子**：产生硬约束反力的未知强度。
- **互补关系**：两个量不能同时激活的数学约束关系。
- **LCP/NCP**：接触与摩擦问题常见的线性/非线性互补建模。

### 13.2 机制清单

1. 先写无约束动力学 $M\mathbf{a}=\mathbf{F}$。
2. 加入约束反力项 $J^T\boldsymbol\lambda$。
3. 联立速度层/加速度层一致性方程。
4. 用降维形式或鞍点系统求解。
5. 离散时间下加入漂移稳定化。
6. 接触问题加入法向互补与摩擦耦合。

### 13.3 简答模板

- 为什么 Penalty 会不稳定：刚度大时会引入数值刚性，要求更小时间步。
- 为什么乘子法更“硬”：反力强度由约束自动决定，不靠固定弹簧参数近似。
- 为什么接触比关节更难：接触有激活/失活切换，还和摩擦非线性耦合。

### 13.4 常见误区

- 只做位置修正，不做速度层一致性。
- 忽视长时间累积的约束漂移。
- 把切向摩擦与法向接触割裂处理。
- 不考虑稀疏结构，直接构造稠密系统导致性能恶化。

### 13.5 自检问题

- 你能从 $g(\mathbf{x})=0$ 推到 $\ddot g=\dot J\mathbf{v}+J\mathbf{a}$ 吗？
- 你能说明何时选 Penalty、何时选乘子法或混合方案吗？
- 你能用一句话解释 $0\le u_{\hat n}\perp\lambda_{\hat n}\ge0$ 的物理意义吗？
