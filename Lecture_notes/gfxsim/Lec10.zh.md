# 第10讲 布料仿真：弯曲模型、锁死问题、PBD 与应变限制

## 1. 全局图景

本讲围绕布料仿真的一个核心矛盾展开：

- 布料应该容易弯。
- 布料应该尽量不拉伸。
- 数值过程还要稳定且高效。

讲义给出的实用路线是：

1. 建立内部力（拉伸/剪切/弯曲）。
2. 分析朴素弹簧建模为何会出现弯曲失真和 locking。
3. 引入基于投影的模拟（PBD）。
4. 扩展到应变限制与面积限制，增强大形变稳定性。

## 2. 布料受力与弯曲建模动机

动力学方程：

$$
\frac{d\mathbf{v}}{dt}=\mathbf{M}^{-1}\mathbf{f}(\mathbf{x},\mathbf{v})
$$

其中 $\mathbf{f}(\mathbf{x},\mathbf{v})$ 包含：

- 内力：拉伸、剪切、弯曲
- 外力：接触、摩擦、碰撞、重力、风力

![Cloth internal forces](lec10_materials/cloth_internal_forces_tension_shearing_bending.png)

在弹簧网络里，边弹簧能覆盖拉伸/剪切，但弯曲质量高度依赖几何建模方式。

![Spring network force components summary](lec10_materials/spring_networks_force_components_summary.png)

### 2.1 经典 bending spring 问题

若只用“长度变化”定义弯曲弹簧，在布料近似共面时长度几乎不变，模型会给出很弱的弯曲阻力。

![Bending spring flat-state issue](lec10_materials/bending_spring_flat_state_issue.png)

:::remark 关键问题（原意复述）：为什么纯距离弯曲在平坦状态附近很弱？
因为平坦附近可以发生较大角度变化，但边长变化很小。只看长度误差的模型几乎“看不见”这类弯曲，因此恢复力不足。
:::

## 3. 二面角弯曲模型（Dihedral Angle Model）

讲义核心式：

- **"Bending forces as a function of $\theta$: $\mathbf{f}_i=f(\theta)\mathbf{u}_i$."**

![Dihedral angle geometric conditions](lec10_materials/dihedral_angle_model_geometric_conditions.png)

定义

$$
\mathbf{E}=\mathbf{x}_4-\mathbf{x}_3,
\quad
\mathbf{N}_1=(\mathbf{x}_1-\mathbf{x}_3)\times(\mathbf{x}_1-\mathbf{x}_4),
\quad
\mathbf{N}_2=(\mathbf{x}_2-\mathbf{x}_4)\times(\mathbf{x}_2-\mathbf{x}_3)
$$

方向项

$$
\mathbf{u}_1=\lVert\mathbf{E}\rVert\frac{\mathbf{N}_1}{\lVert\mathbf{N}_1\rVert^2},
\qquad
\mathbf{u}_2=\lVert\mathbf{E}\rVert\frac{\mathbf{N}_2}{\lVert\mathbf{N}_2\rVert^2}
$$

$$
\mathbf{u}_3=\frac{(\mathbf{x}_1-\mathbf{x}_4)\cdot\mathbf{E}}{\lVert\mathbf{E}\rVert}\frac{\mathbf{N}_1}{\lVert\mathbf{N}_1\rVert^2}
+\frac{(\mathbf{x}_2-\mathbf{x}_4)\cdot\mathbf{E}}{\lVert\mathbf{E}\rVert}\frac{\mathbf{N}_2}{\lVert\mathbf{N}_2\rVert^2}
$$

$$
\mathbf{u}_4=-\frac{(\mathbf{x}_1-\mathbf{x}_3)\cdot\mathbf{E}}{\lVert\mathbf{E}\rVert}\frac{\mathbf{N}_1}{\lVert\mathbf{N}_1\rVert^2}
-\frac{(\mathbf{x}_2-\mathbf{x}_3)\cdot\mathbf{E}}{\lVert\mathbf{E}\rVert}\frac{\mathbf{N}_2}{\lVert\mathbf{N}_2\rVert^2}
$$

并满足

$$
\mathbf{u}_1+\mathbf{u}_2+\mathbf{u}_3+\mathbf{u}_4=\mathbf{0}
$$

平面材料形式：

$$
\mathbf{f}_i=k\frac{\lVert\mathbf{E}\rVert^2}{\lVert\mathbf{N}_1\rVert+\lVert\mathbf{N}_2\rVert}\sin\frac{\pi-\theta}{2}\,\mathbf{u}_i
$$

带静止角的形式：

$$
\mathbf{f}_i=k\frac{\lVert\mathbf{E}\rVert^2}{\lVert\mathbf{N}_1\rVert+\lVert\mathbf{N}_2\rVert}
\left(\sin\frac{\pi-\theta}{2}-\sin\frac{\pi-\theta_0}{2}\right)\mathbf{u}_i
$$

![Dihedral bending force forms](lec10_materials/dihedral_bending_force_planar_nonplanar_forms.png)

### 3.1 距离约束 vs 角度约束

- 距离约束：
  - 简单
  - 便宜
  - 平坦状态下偏弱
- 角度约束：
  - 平坦状态下更强
  - 计算更贵

![Distance vs angle bending constraints](lec10_materials/distance_vs_angle_bending_constraints.png)

## 4. 拉伸与 Locking 问题

讲义提出的关键问题是：

- **"Issue: Can a simulator fold cloth freely?"**

![Locking issue folding-line example](lec10_materials/locking_issue_folding_line_example.png)

DoF 计数直觉（边约束主导）：

$$
\mathrm{DoF}=3N_{\mathrm{vertices}}-N_{\mathrm{edges}}
$$

对流形三角网格可近似写成（讲义写法）：

$$
N_{\mathrm{edges}}\approx 3N_{\mathrm{vertices}}-3N_{\mathrm{boundaryEdges}}
$$

于是有效自由度大致为：

$$
\mathrm{System\ DoFs}\approx 3N_{\mathrm{boundaryEdges}}
$$

![Locking DoF counting](lec10_materials/locking_issue_dof_counting.png)

工程折中：

- 边弹簧太硬：locking、不稳、步长很小
- 边弹簧太软：橡皮感拉伸，褶皱偏粗

![Inequality cloth comparison](lec10_materials/inequality_cloth_vs_soft_stiff_springs.png)

:::remark 关键问题（原意复述）：为什么硬边弹簧很容易导致 locking？
当太多边长被当作强硬约束后，面内可变形空间被过度压缩，真实折叠所需的模态被“锁掉”，表现成过约束布料。
:::

## 5. Position Based Dynamics (PBD)

PBD 的核心陈述：

- **"Position based dynamics (PBD) is based on the projection function."**

单根弹簧对应一个位置约束：

$$
\phi(\mathbf{x})=\lVert\mathbf{x}_i-\mathbf{x}_j\rVert-L=0
$$

投影问题：

$$
\{\mathbf{x}_i^{new},\mathbf{x}_j^{new}\}=\arg\min\frac{1}{2}\left(m_i\lVert\mathbf{x}_i^{new}-\mathbf{x}_i\rVert^2+m_j\lVert\mathbf{x}_j^{new}-\mathbf{x}_j\rVert^2\right)
\quad
\text{s.t. }\phi(\mathbf{x})=0
$$

![Single spring to constraint](lec10_materials/single_spring_to_position_constraint.png)

两点投影闭式更新：

$$
\mathbf{x}_i^{new}\leftarrow \mathbf{x}_i-\frac{m_j}{m_i+m_j}(\lVert\mathbf{x}_i-\mathbf{x}_j\rVert-L)\frac{\mathbf{x}_i-\mathbf{x}_j}{\lVert\mathbf{x}_i-\mathbf{x}_j\rVert}
$$

$$
\mathbf{x}_j^{new}\leftarrow \mathbf{x}_j+\frac{m_i}{m_i+m_j}(\lVert\mathbf{x}_i-\mathbf{x}_j\rVert-L)\frac{\mathbf{x}_i-\mathbf{x}_j}{\lVert\mathbf{x}_i-\mathbf{x}_j\rVert}
$$

![Single constraint projection closed form](lec10_materials/single_constraint_projection_closed_form.png)

### 5.1 多约束投影（Jacobi 风格）

对全部边和迭代：

$$
\mathbf{x}_i^{new}\mathrel{+}=\mathbf{x}_i-\frac{1}{2}(\lVert\mathbf{x}_i-\mathbf{x}_j\rVert-L_e)\frac{\mathbf{x}_i-\mathbf{x}_j}{\lVert\mathbf{x}_i-\mathbf{x}_j\rVert}
$$

$$
\mathbf{x}_j^{new}\mathrel{+}=\mathbf{x}_j+\frac{1}{2}(\lVert\mathbf{x}_i-\mathbf{x}_j\rVert-L_e)\frac{\mathbf{x}_i-\mathbf{x}_j}{\lVert\mathbf{x}_i-\mathbf{x}_j\rVert}
$$

随后做平均与混合：

$$
\mathbf{x}_i^{new}\leftarrow\frac{\mathbf{x}_i^{new}}{n_i},
\qquad
\mathbf{x}_i\leftarrow\frac{\mathbf{x}_i^{new}+\alpha\mathbf{x}_i}{1+\alpha}
$$

投影后的速度回写非常关键：

$$
\mathbf{v}\leftarrow\mathbf{v}+\frac{\mathbf{x}^{new}-\mathbf{x}}{\Delta t},
\qquad
\mathbf{x}\leftarrow\mathbf{x}^{new}
$$

![PBD Jacobi and simulator pipeline](lec10_materials/pbd_jacobi_projection_and_simulator_pipeline.png)

![PBD practical notes](lec10_materials/pbd_stiffness_resolution_and_velocity_update.png)

### 5.2 PBD 的优势与局限

优点：

- 易并行（GPU 友好）
- 易实现
- 低分辨率下效率高
- 通用投影框架，易扩展到其他约束/耦合

局限：

- 物理严格性不足
- 高分辨率下可能性能吃紧
- 分层/加速方案会带来振荡或调参复杂度

![PBD pros and cons](lec10_materials/pbd_pros_cons_and_practical_notes.png)

讲义也给了 Position Based Fluids、XPBD 等扩展方向。

![XPBD reference slide](lec10_materials/xpbd_extended_position_based_dynamics.png)

## 6. 应变限制：动力学后校正

应变限制把投影主要作为“校正阶段”：

1. 先做一个软/松弛约束的动力学步。
2. 再把位置投影到应变约束可行域。
3. 用校正位移重建速度。

![Strain limiting simulator pipeline](lec10_materials/strain_limiting_simulator_pipeline.png)

### 6.1 弹簧应变限制

约束：

$$
\sigma_{min}\le\frac{1}{L}\lVert\mathbf{x}_i-\mathbf{x}_j\rVert\le\sigma_{max}
$$

流程：

$$
\sigma\leftarrow\frac{1}{L}\lVert\mathbf{x}_i-\mathbf{x}_j\rVert,
\qquad
\sigma_0\leftarrow\min(\max(\sigma,\sigma_{min}),\sigma_{max})
$$

$$
\mathbf{x}_i^{new}\leftarrow \mathbf{x}_i-\frac{m_j}{m_i+m_j}(\lVert\mathbf{x}_i-\mathbf{x}_j\rVert-\sigma_0L)\frac{\mathbf{x}_i-\mathbf{x}_j}{\lVert\mathbf{x}_i-\mathbf{x}_j\rVert}
$$

$$
\mathbf{x}_j^{new}\leftarrow \mathbf{x}_j+\frac{m_i}{m_i+m_j}(\lVert\mathbf{x}_i-\mathbf{x}_j\rVert-\sigma_0L)\frac{\mathbf{x}_i-\mathbf{x}_j}{\lVert\mathbf{x}_i-\mathbf{x}_j\rVert}
$$

特例：

- PBD 硬约束：$\sigma_0\equiv1$
- 无限放宽：上下界取很大

![Spring strain limit](lec10_materials/spring_strain_limit_constraint.png)

### 6.2 三角形面积限制

面积约束：

$$
A_{min}\le A\le A_{max}
$$

面积和缩放系数：

$$
A\leftarrow\frac{1}{2}\lVert(\mathbf{x}_j-\mathbf{x}_i)\times(\mathbf{x}_k-\mathbf{x}_i)\rVert,
\qquad
s\leftarrow\sqrt{\frac{\min(\max(A,A_{min}),A_{max})}{A}}
$$

保持质心不动：

$$
\mathbf{c}\leftarrow\frac{m_i\mathbf{x}_i+m_j\mathbf{x}_j+m_k\mathbf{x}_k}{m_i+m_j+m_k}
$$

$$
\mathbf{x}_i^{new}\leftarrow\mathbf{c}+s(\mathbf{x}_i-\mathbf{c}),
\quad
\mathbf{x}_j^{new}\leftarrow\mathbf{c}+s(\mathbf{x}_j-\mathbf{c}),
\quad
\mathbf{x}_k^{new}\leftarrow\mathbf{c}+s(\mathbf{x}_k-\mathbf{c})
$$

![Triangle area limit scaling](lec10_materials/triangle_area_limit_scaling_factor.png)

![Triangle area limit projection](lec10_materials/triangle_area_limit_projection_with_mass_center.png)

### 6.3 为什么应变限制常用于工业仿真

常见目的：

- 降低不稳定
- 抑制大变形伪影
- 引入非线性控制
- 缓解 locking

![Strain limiting two-phase curve](lec10_materials/strain_limiting_two_phase_force_strain_curve.png)

## 7. 讲义提到的其他方法

讲义还提到基于拉格朗日乘子求解约束、以及面向不可拉伸布料的求解路径。

## 8. Exam Review

### A. 必须精确定义的概念

- **Dihedral angle bending model**：弯曲力由折叠角 $\theta$ 决定。
- **Locking**：约束过强导致自然折叠模态受阻。
- **PBD projection**：通过直接投影位置来满足约束。
- **Strain limiting**：在动力学之后做应变范围校正。
- **Area limiting**：围绕质心缩放以限制三角形面积。

### B. 机制链（简答模板）

1. 布料内力包括拉伸、剪切和弯曲。
2. 纯距离弯曲在平坦附近响应偏弱。
3. 二面角弯曲提供更强几何响应。
4. 边约束过硬会造成 locking。
5. PBD 通过迭代投影 enforce 约束。
6. 应变限制在软动力学步后做有界校正。

### C. 常见误区

- 把全部边约束一次性设成无限硬。
- 忽略 PBD 刚度会随迭代次数和分辨率变化。
- 投影后不重建速度。
- 应变上/下界设置缺乏物理依据。
- 做面积限制时忽略质心一致性。

### D. 自检问题

- 你能解释为什么纯距离弯曲在平坦状态会低估阻力吗？
- 你能推导 $\phi(\mathbf{x})=\lVert\mathbf{x}_i-\mathbf{x}_j\rVert-L=0$ 的双点投影更新吗？
- 你能用 DoF 计数解释 locking 的来源吗？
- 你能说明为什么 PBD 稳健但不严格物理吗？
- 你能写出弹簧应变限制和三角面积限制的投影步骤吗？

:::remark 自检参考答案
1. 在平坦附近，折角可明显变化但边长几乎不变；只看长度误差的模型无法感知足够弯曲偏差，恢复力偏小。

2. 在长度约束下最小化质量加权位移，得到沿 $(\mathbf{x}_i-\mathbf{x}_j)$ 方向、按质量比反向分配的修正。

3. 当过多边长被强制约束时，可用面内自由度被大量压缩，自然折叠所需的形变模态被锁死。

4. PBD 是几何投影而非完整力学积分，稳定性好、实现快，但“刚度”受数值参数（迭代次数等）影响，不完全等价于真实材料参数。

5. 弹簧应变限制是先夹紧 $\sigma$ 再投影端点；面积限制是夹紧面积后求 $s$，并围绕质心对三个顶点缩放。
:::
