# 第11讲 Projective Dynamics 与 MPM

## 1. 全局图景
本讲把两条重要仿真主线连在一起：

- Projective Dynamics（PD）：面向高刚度约束系统的 local-global 优化方法。
- Material Point Method（MPM）：把 APIC 思想推广到连续体固体/流体/塑性/断裂的粒子-网格混合框架。

学完后你应形成统一理解：

1. 为什么非凸形变能下，直接 Newton 优化很难。
2. PD 如何用“局部投影 + 全局二次求解”替代难处理的非凸性。
3. APIC 传输式如何扩展成 MLS-MPM，并注入形变梯度与本构应力。

![Newton method and non-convex issue](lec11_materials/newton_method_nonconvex_issue.png)

## 2. 为什么需要 Projective Dynamics
从隐式欧拉的优化形式出发：

$$
\mathbf{x}_{n+1}=\arg\min_{\mathbf{x}}\,g(\mathbf{x}),
\qquad
g(\mathbf{x})=\frac{1}{2h^2}\lVert\mathbf{x}-\mathbf{y}\rVert_{\mathbf{M}}^2+E(\mathbf{x}).
$$

其中惯性项是局部二次项，而形变能通常是全局非凸项。

- Newton 形式：$\mathbf{x}_{k+1}=\mathbf{x}_k-\mathbf{H}(g)^{-1}\nabla g$。
- 但 $\mathbf{H}(g)=\frac{\mathbf{M}}{h^2}+\mathbf{H}(E)$ 在非凸能下往往难处理。
- 工程上表现为：不稳定风险与反复大规模线性求解的高成本。

### 2.1 Local-Global 分解
**关键表述（沿用讲义原意）：Projective dynamics combines local projections and a global quadratic energy to approximate the global and non-convex energy.**

![PD local-global steps](lec11_materials/pd_local_global_steps_overview.png)

对弹簧类约束：

$$
E(\mathbf{x})=\sum_{e=\{i,j\}}\frac{1}{2}k_e\left(\lVert\mathbf{x}_i-\mathbf{x}_j\rVert-l_{0,e}\right)^2
$$

PD 通过局部投影目标，把全局步骤改写为二次目标：

$$
E(\mathbf{x})\approx\sum_{e=\{i,j\}}\frac{1}{2}k_e\left\lVert(\mathbf{x}_i-\mathbf{x}_j)-\bigl(\mathbf{x}^{new}_{e,i}-\mathbf{x}^{new}_{e,j}\bigr)\right\rVert^2.
$$

![Spring projection cases](lec11_materials/spring_projection_stretched_compressed.png)

:::remark 关键问题（原意复述）：相比直接最小化非凸弹簧能，为什么投影更有效？
投影先把每条边上的难问题转成几何目标更新，再把全局步骤变成大规模凸二次求解。这样把最危险的曲率问题从求解阶段里剥离出来。
:::

### 2.2 全局步与“近常矩阵”技巧
由投影能可得到力和近似 Hessian：

$$
\mathbf{f}_i=-\nabla_iE(\mathbf{x})=-\sum_{e:i\in e}\left[(\mathbf{x}_i-\mathbf{x}_j)-\bigl(\mathbf{x}^{new}_{e,i}-\mathbf{x}^{new}_{e,j}\bigr)\right],
$$

$$
\mathbf{H}=\sum_{e=\{i,j\}}
\begin{bmatrix}
\mathbf{I}_{ii} & -\mathbf{I}_{ij}\\
-\mathbf{I}_{ji} & \mathbf{I}_{jj}
\end{bmatrix}.
$$

全局更新：

$$
\left(\frac{1}{h^2}\mathbf{M}+\mathbf{H}\right)\Delta\mathbf{x}
=-\frac{1}{h^2}\mathbf{M}(\mathbf{x}_k-\mathbf{y})+\mathbf{f}(\mathbf{x}_k),
\qquad
\mathbf{x}_{k+1}=\mathbf{x}_k+\Delta\mathbf{x}.
$$

![PD global step Hessian form](lec11_materials/pd_global_step_hessian_block_form.png)

![PD assembled matrix example](lec11_materials/pd_assembled_system_matrix_example.png)

实践中最关键的优势是系统矩阵可近似视为常量：

$$
\mathbf{A}:=\frac{1}{h^2}\mathbf{M}+\mathbf{H}_{PD}.
$$

因此可以“一次分解、多次复用”。

![PD constant matrix and pipeline](lec11_materials/pd_constant_matrix_and_solver_pipeline.png)

### 2.3 PD、Newton、梯度下降对比
可以这样记：

- Newton：$\mathbf{x}_{k+1}=\mathbf{x}_k-\mathbf{H}(g)^{-1}\nabla g$（局部二次收敛，但昂贵且依赖曲率质量）。
- 梯度下降：$\mathbf{x}_{k+1}=\mathbf{x}_k-a_{k+1}\nabla g$（线性收敛，步长敏感）。
- PD：$\mathbf{x}_{k+1}=\mathbf{x}_k-\mathbf{A}^{-1}\nabla g$，其中 $\mathbf{A}$ 近常（线性但工程上稳、前期收敛快）。

![PD pros and cons](lec11_materials/pd_pros_cons_and_convergence_plot.png)

:::remark 关键问题（原意复述）：PD 前期很快，为什么后期可能变慢？
因为固定近似 Hessian 没有完整跟踪投影更新后的真实曲率。大误差阶段下降很快，但到后期细致收敛时可能不如完整 Newton。
:::

## 3. 连续体、PBD 与 PD 的关系
**关键表述（讲义原句）：PD bridges the gap between continuum mechanics and PBD.**

- PBD 通过位置/速度直接投影来维持约束。
- 视觉上常常合理，但并不总是与力学能量严格一致。
- PD 在“投影效率”与“能量建模”之间建立桥梁。

![Continuum-PD-PBD relation](lec11_materials/continuum_pd_pbd_relationship.png)

## 4. 从 APIC 到 MLS-MPM
可以把 MPM 看作：把 APIC 式混合传输推广到可形变连续体。

- 欧拉网格：负责动量更新、碰撞、边界条件。
- 拉格朗日粒子：负责对流、历史变量与形变状态。

![MPM outline](lec11_materials/mpm_outline_deformation_stress_force.png)

### 4.1 APIC 核心（角动量守恒的关键传输）
**关键表述（讲义原句）：Only P2G and G2P conserve angular momentum.**

粒子积分：

$$
\mathbf{x}_p^{n+1}=\mathbf{x}_p^n+\mathbf{v}_p^n\Delta t,
\qquad
\mathbf{v}_p^*=\mathbf{v}_p^n+\mathbf{f}_{extra}\Delta t.
$$

APIC 的 P2G：

$$
(m\mathbf{v})_i^{n+1}=\sum_p w_{i,p}\left[m_p\mathbf{v}_p^n+m_p\mathbf{C}_p^n(\mathbf{x}_i-\mathbf{x}_p^n)\right],
\qquad
m_i^{n+1}=\sum_p m_p w_{i,p}.
$$

网格操作与 G2P：

$$
\mathbf{v}_i^*=\frac{(m\mathbf{v})_i^{n+1}}{m_i^{n+1}},
\quad
\mathbf{v}_i^{n+1}=\mathrm{PressureProjection}(\mathbf{v}_i^*,BC),
$$

$$
\mathbf{v}_p^{n+1}=\sum_i w_{i,p}\mathbf{v}_i^{n+1},
\qquad
\mathbf{C}_p^{n+1}=\frac{4}{\Delta x^2}\sum_i w_{i,p}\mathbf{v}_i^{n+1}(\mathbf{x}_i-\mathbf{x}_p^n)^T.
$$

![APIC pipeline and equations](lec11_materials/apic_pipeline_and_core_equations.png)

### 4.2 MLS-MPM = APIC + 可形变固体
连续体核心变量：

$$
\mathbf{F}=\frac{\partial\mathbf{x}}{\partial\mathbf{X}},
\qquad
\mathbf{P}=\frac{\partial W}{\partial\mathbf{F}},
\qquad
\mathbf{f}_i=-\sum_p V_p^{ref}\,\mathbf{P}\frac{\partial\mathbf{F}}{\partial\mathbf{x}_i}.
$$

形变梯度更新：

$$
\mathbf{F}_p^{n+1}=(\mathbf{I}+\Delta t\,\mathbf{C}_p^n)\mathbf{F}_p^n.
$$

![MLS-MPM and APIC side-by-side](lec11_materials/mls_mpm_vs_apic_transfer_equations.png)

![Deformation gradient update](lec11_materials/mls_mpm_deformation_gradient_update.png)

应力项注入 P2G 后：

$$
(m\mathbf{v})_i^n
=\sum_p w_{i,p}\left(m_p\mathbf{v}_p^n+
\left[m_p\mathbf{C}_p^n-\frac{4\Delta t}{\Delta x^2}V_p^0\mathbf{P}(\mathbf{F}_p^n)^T\right](\mathbf{x}_i-\mathbf{x}_p^n)
\right).
$$

![Stress momentum contribution](lec11_materials/mls_mpm_stress_momentum_contribution.png)

### 4.3 网格边界条件
典型 BC 写法：

$$
\mathbf{v}_i^{n+1}=BC_{sticky}(\hat{\mathbf{v}}_i^{n+1})=0,
$$

$$
\mathbf{v}_i^{n+1}=BC_{slip}(\hat{\mathbf{v}}_i^{n+1})
=\hat{\mathbf{v}}_i^{n+1}-\mathbf{n}(\mathbf{n}^T\hat{\mathbf{v}}_i^{n+1}),
$$

$$
\mathbf{v}_i^{n+1}=BC_{separate}(\hat{\mathbf{v}}_i^{n+1})
=\hat{\mathbf{v}}_i^{n+1}-\mathbf{n}\,\min(\mathbf{n}^T\hat{\mathbf{v}}_i^{n+1},0).
$$

![Boundary condition examples](lec11_materials/mls_mpm_boundary_conditions_examples.png)

## 5. MLS-MPM 中的本构模型
### 5.1 弹性固体
连续体动量方程与 Cauchy 应力映射：

$$
\rho\frac{d\mathbf{u}}{dt}=\nabla\cdot\boldsymbol{\sigma}+\mathbf{f}_{body},
\qquad
\boldsymbol{\sigma}=\det(\mathbf{F})^{-1}\mathbf{P}\mathbf{F}^T.
$$

常见弹性本构：

$$
\text{Neo-Hookean:}\quad \mathbf{P}=\mu(\mathbf{F}-\mathbf{F}^{-T})+\lambda\log(J)\mathbf{F}^{-T},
$$

$$
\text{Corotated:}\quad \mathbf{P}=2\mu(\mathbf{F}-\mathbf{R})+\lambda(J-1)J\mathbf{F}^{-T},
\quad J=\det(\mathbf{F}),\; I_c=\lVert\mathbf{F}\rVert_F^2.
$$

![Elastic constitutive models](lec11_materials/elastic_constitutive_models_neo_hookean_corotated.png)

### 5.2 塑性固体
乘法分解与奇异值截断：

$$
\mathbf{F}_p=\mathbf{F}_{p,plastic}\mathbf{F}_{p,elastic},
\qquad
\mathbf{P}=\frac{\partial W(\mathbf{F}_{p,elastic})}{\partial\mathbf{F}_{p,elastic}}.
$$

$$
\mathbf{F}_{p,elastic}^{n+1}=(\mathbf{I}+\Delta t\mathbf{C}_p^n)\mathbf{F}_p^n,
\quad
\mathrm{svd}(\mathbf{F}_{p,elastic}^{n+1})=\mathbf{U}\mathbf{\Lambda}\mathbf{V}^T,
$$

$$
\Lambda_{elastic}=\max(\min(\Lambda_{ii},1+\theta_s),1-\theta_c),
\qquad
\mathbf{F}_{p,elastic}^{n+1}=\mathbf{U}\mathbf{\Lambda}_{elastic}\mathbf{V}^T.
$$

![Plastic constitutive model](lec11_materials/plastic_constitutive_model_svd_clamp.png)

### 5.3 弱可压流体
在同一框架内加入压强闭合：

$$
\mathbf{f}_i\Delta t = -\frac{1}{\rho}\nabla p\,\Delta t,
\qquad p=K(1-J).
$$

由形变更新得到：

$$
\det(\mathbf{F}_p^{n+1})=\det(\mathbf{I}+\Delta t\mathbf{C}_p^n)\det(\mathbf{F}_p^n)
\Rightarrow
J_p^{n+1}=(1+\Delta t\,\mathrm{tr}(\mathbf{C}_p^n))J_p^n.
$$

![Weakly compressible fluid model](lec11_materials/weakly_compressible_fluid_model_in_mls_mpm.png)

### 5.4 断裂建模方向
可将相场退化写入本构能：

$$
\mathbf{P}
=\frac{\partial W(\mathbf{F}_{p,elastic})}{\partial\mathbf{F}_{p,elastic}}
=\frac{\partial\Bigl([(1-\epsilon)c^2+\epsilon]W^+(\mathbf{F}_{p,e})+W^-(\mathbf{F}_{p,e})+\cdots\Bigr)}{\partial\mathbf{F}_{p,elastic}}.
$$

![Fracture constitutive model](lec11_materials/fracture_constitutive_model_cd_mpm.png)

![Traditional MPM fracture issue](lec11_materials/traditional_mpm_fracture_failure_example.png)

### 5.5 与拉格朗日网格耦合
面向毛发/布料/软体的一条实用路线：

1. 在 MPM 之上引入 FEM 或 mass-spring 网格。
2. 用网格顶点/单元作为粒子载体提供结构信息。
3. 将拉格朗日内力映射为欧拉网格力。

![Lagrangian mesh coupling](lec11_materials/lagrangian_mesh_coupling_for_hair_cloth.png)

:::remark 关键问题（原意复述）：为什么要把拉格朗日网格和 MPM 结合？
这样既保留网格层面的结构方向性与材料特征，又利用网格域接触/碰撞处理的稳健性。对布料、毛发、各向异性材料尤其有效。
:::

## 6. 从 MPM 到 MLS-MPM：本质变化
可以归纳为两件事的融合：

- APIC 的仿射传输与角动量友好的重建。
- MPM 离散中显式加入本构应力动量项。

![From MPM to MLS-MPM](lec11_materials/from_mpm_to_mls_mpm_comparison_table.png)

近期方向包括紧支撑核、断裂耦合改进、以及数据驱动参数调优。

![Recent directions](lec11_materials/recent_directions_using_mpm.png)

![Lecture summary](lec11_materials/lecture_summary_mpm_mls_mpm.png)

## 7. Exam Review
### A. 必须精确定义的概念
- **Projective Dynamics**：用局部投影 + 全局二次求解近似非凸形变优化。
- **MLS-MPM**：在 APIC 混合传输基础上引入形变梯度与本构应力的连续体模型。
- **第一类 Piola-Kirchhoff 应力**：$\mathbf{P}=\partial W/\partial\mathbf{F}$。
- **Cauchy 应力映射**：$\boldsymbol{\sigma}=\det(\mathbf{F})^{-1}\mathbf{P}\mathbf{F}^T$。

### B. 机制链（简答模板）
1. 粒子存储 $\mathbf{x}_p,\mathbf{v}_p,\mathbf{F}_p$。
2. P2G 传输动量（APIC 仿射项 + 本构应力项）。
3. 在网格上执行更新与边界条件。
4. G2P 回传粒子速度与仿射矩阵。
5. 更新形变梯度与本构应力，进入下一步。

### C. 常见误区
- 把 PBD 的投影效果误当作与力学能量最小化等价。
- 忽视 PD 固定矩阵“速度快但后期可能精细收敛偏慢”的代价。
- 写了 APIC 公式但实现中漏掉仿射项。
- 在塑性更新中混淆 $\mathbf{F}$ 的弹性/塑性部分，缺少 SVD 截断。
- 套用流体压强闭合时不检查可压缩性假设。

### D. 自检问题
1. 为什么 PD 在前几次迭代里常比完整 Newton 更快？
2. APIC 哪些传输步骤对角动量守恒最关键？
3. MLS-MPM 里为什么既要 $\mathbf{C}_p$ 又要 $\mathbf{F}_p$？
4. sticky/slip/separate 三种 BC 的法向处理差异是什么？
5. 为什么本构模型决定了 MPM 材料的“性格”？

:::remark 自检参考答案
1. PD 在局部投影后复用近常全局矩阵，单步成本低，并能快速消除大残差成分。
2. 关键是成对的仿射 P2G 与 G2P；丢掉仿射重建会破坏目标角动量行为。
3. $\mathbf{C}_p$ 描述局部速度梯度/仿射运动用于传输，$\mathbf{F}_p$ 记录有限形变历史用于本构响应。
4. sticky 直接置零；slip 去掉法向分量；separate 只去掉“向内”法向分量以避免穿透。
5. 传输和离散是管线，本构方程才决定材料是橡胶、砂土、流体还是脆性断裂体。
:::
