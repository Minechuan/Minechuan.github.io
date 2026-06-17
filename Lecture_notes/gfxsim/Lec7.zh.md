# 第7讲 SPH 与 APIC：粒子流体、仿射传输与连续体守恒

## 1. 全局图景

本讲把两条重要的粒子流体路线连在一起：

- SPH（Smoothed Particle Hydrodynamics）：直接在粒子邻域上近似密度、压力和粘性。
- APIC（Affine Particle-In-Cell）：保留粒子-网格混合框架，但传输的不再只是平移速度，而是仿射运动。

核心目标一致：稳定性、低耗散，以及物理上合理的守恒性质。

## 2. SPH 基础：从平均到核函数算子

### 2.1 粒子状态与核心问题

在粒子系统中，每个粒子保存质量、位置和速度：

$$
\mathbf{x} = [\mathbf{x}_0,\dots,\mathbf{x}_i,\dots]^T,
\quad
\mathbf{v} = [\mathbf{v}_0,\dots,\mathbf{v}_i,\dots]^T,
\quad
\mathbf{m}=[m_0,\dots,m_i,\dots]^T
$$

![粒子状态与属性查询](lec07_materials/sph_particle_state_and_property_query.png)

:::remark 关键问题（原意复述）：如何在任意位置得到物理量（例如密度）？
答案是局部插值：让邻域粒子按照距离权重参与贡献。SPH 的关键就是把这套权重设计成既平滑、又稳定、还符合物理含义的形式。
:::

### 2.2 为什么简单邻域平均会失败

朴素模型是半径内等权平均：

$$
A_i^{\mathrm{smooth}} = \frac{1}{n}\sum_j A_j
$$

即便改成体积加权

$$
A_i^{\mathrm{smooth}} = \frac{1}{n}\sum_j V_jA_j,
$$

当邻居数量突变时仍然会不平滑。

### 2.3 SPH 最终插值形式

实用的 SPH 形式是：

$$
A_i^{\mathrm{smooth}} = \sum_j V_jA_jW_{ij}
$$

其中

$$
V_i = \frac{m_i}{\rho_i^{\mathrm{smooth}}},
\qquad
\rho_i^{\mathrm{smooth}} = \sum_j m_jW_{ij}
$$

因此可写成

$$
A_i^{\mathrm{smooth}} = \sum_j \frac{m_j}{\sum_k m_kW_{jk}}A_jW_{ij}
$$

### 2.4 核函数设计与常见形式

平滑核通常满足局部支撑与归一化，例如：

$$
\int W(x)\,dx=1,
\qquad
q=\frac{\|\mathbf{x}_i-\mathbf{x}_j\|}{h}
$$

讲义中的一个三次样条核：

$$
W_{ij} = \frac{3}{2\pi h^3}
\begin{cases}
\frac{2}{3} - q^2 + \frac{1}{2}q^3, & 0\le q<1 \\
\frac{1}{6}(2-q)^3, & 1\le q<2 \\
0, & 2\le q
\end{cases}
$$

还给出了：

$$
W_{\mathrm{poly6}}(q)=\frac{315}{64\pi d^9}(d^2-q^2)^3,
\quad 0\le q\le d,
\text{ else }0
$$

![核函数定义](lec07_materials/sph_kernel_function_definition.png)

### 2.5 核函数梯度与拉普拉斯

SPH 力项需要一阶与二阶导数。

$$
\nabla_iW_{ij}=\frac{\partial W_{ij}}{\partial q}\frac{\mathbf{x}_i-\mathbf{x}_j}{\|\mathbf{x}_i-\mathbf{x}_j\|h},
\qquad
\nabla_jW_{ji}=-\nabla_iW_{ij}
$$

$$
\nabla_i\cdot\nabla_iW_{ij}
=\frac{\partial^2W_{ij}}{\partial q^2}\frac{1}{h^2}
+\frac{\partial W_{ij}}{\partial q}\frac{2}{h^2q},
\qquad
\Delta_jW_{ji}=\Delta_iW_{ij}
$$

![核函数总结](lec07_materials/sph_kernel_summary.png)

:::remark 关键问题（原意复述）：为什么 SPH 对核函数梯度和拉普拉斯这么敏感？
因为压力力依赖核梯度，粘性项依赖类似拉普拉斯的算子。如果这些离散算子不一致，力的对称性和动量表现会很快变差。
:::

## 3. SPH 流体动力学建模

### 3.1 将 Navier-Stokes 分项映射到粒子更新

讲义分裂（欧拉形式）：

$$
\frac{\partial\mathbf{u}}{\partial t}=-(\mathbf{u}\cdot\nabla)\mathbf{u},
\quad
\frac{\partial\mathbf{u}}{\partial t}=\mathbf{g},
\quad
\frac{\partial\mathbf{u}}{\partial t}=\frac{\mu}{\rho}\Delta\mathbf{u},
\quad
\frac{\partial\mathbf{u}}{\partial t}=-\frac{1}{\rho}\nabla p
$$

粒子视角（拉格朗日）：

$$
\frac{d\mathbf{u}}{dt}=0,
\quad
\frac{d\mathbf{u}}{dt}=\mathbf{g},
\quad
\frac{d\mathbf{u}}{dt}=\frac{\mu}{\rho}\Delta\mathbf{u},
\quad
\frac{d\mathbf{u}}{dt}=-\frac{1}{\rho}\nabla p
$$

### 3.2 密度、状态方程压力与压力力

$$
\rho(\mathbf{x})=\sum_i m_iW(\mathbf{x}-\mathbf{x}_i),
\qquad
p_i=k(\rho_i-\rho_0)^\gamma\ (\gamma\approx 7)
$$

$$
p(\mathbf{x})=\sum_i p_i\frac{m_i}{\rho_i}W(\mathbf{x}-\mathbf{x}_i),
\qquad
\nabla p(\mathbf{x})=\sum_i p_i\frac{m_i}{\rho_i}\nabla W(\mathbf{x}-\mathbf{x}_i)
$$

$$
\mathbf{f}_{ip}=-\frac{m_i}{\rho_i}\sum_j p_j\frac{m_j}{\rho_j}\nabla_iW(\mathbf{x}_j-\mathbf{x}_i)
$$

:::remark 关键问题（原意复述）："How to calculate the pressure field?" 与 "What is $p_i$?"
压力场用粒子压力插值得到；每粒子压力通常由状态方程给出。在弱可压 SPH 里，$p_i=k(\rho_i-\rho_0)^\gamma$ 是常见闭合关系。
:::

### 3.3 粘性力与动量守恒修正

朴素形式：

$$
\mathbf{f}_{iv}=\nu m_i\sum_jm_j\frac{\mathbf{v}_j}{\rho_j}\Delta_iW(\mathbf{x}_j-\mathbf{x}_i)
$$

该形式一般不能保证成对内力严格抵消。

守恒修正后：

$$
\mathbf{f}_{iv}^{\mathrm{cons}}=\nu m_i\sum_jm_j\left(\frac{\mathbf{v}_j}{\rho_j}-\frac{\mathbf{v}_i}{\rho_i}\right)\Delta_iW(\mathbf{x}_j-\mathbf{x}_i)
$$

### 3.4 压力力与动量守恒修正

朴素压力离散同样可能破坏成对反对称性。

守恒形式：

$$
\mathbf{f}_{ip}^{\mathrm{cons}}=-m_i\sum_jm_j\left(\frac{p_j}{\rho_j^2}+\frac{p_i}{\rho_i^2}\right)\nabla_iW(\mathbf{x}_j-\mathbf{x}_i)
$$

### 3.5 SPH 计算流程与方法特性

一个实用 SPH 步骤是：

1. 用重力更新位置和速度。
2. 通过核求和计算密度。
3. 计算粘性力。
4. 用状态方程计算压力。
5. 计算压力力并更新速度。

![SPH 动量守恒压力与粘性公式](lec07_materials/sph_momentum_conserved_pressure_viscosity.png)

讲义总结的 SPH 特性：

- 优点：速度快、GPU 友好。
- 优点：粒子表示对自由液面/障碍交互自然。
- 局限：需要足够稠密邻域才能稳定、准确。
- 局限：压力是局部近似，不能天然保证全局不可压。
- 常见改进：IISPH、PCISPH、Position-Based Fluids。

![SPH 方法优缺点](lec07_materials/sph_method_tradeoffs.png)

## 4. Eulerian vs Lagrangian vs Hybrid

核心关系：

$$
\frac{d\mathbf{u}}{dt}=\frac{\partial\mathbf{u}}{\partial t}+\mathbf{u}\cdot\nabla\mathbf{u}
= -\frac{1}{\rho}\nabla p + \nu\nabla\cdot\nabla\mathbf{u}+\mathbf{f},
\qquad
\nabla\cdot\mathbf{u}=0
$$

纯欧拉和纯拉格朗日各有优势和短板。混合法通常用粒子处理平流，用网格做压力投影。

![Eulerian Lagrangian 混合框架总览](lec07_materials/eulerian_lagrangian_hybrid_overview.png)

:::remark 关键问题（原句保留）："New Problem: Data Transfer between Grid & Particles"
混合法换来的是稳定性与细节的折中空间，但代价是“传输”本身变成数值核心。PIC/FLIP/APIC 本质是在回答这个传输设计问题。
:::

## 5. PIC、RPIC 与 APIC

### 5.1 PIC 基线

讲义关键词：

- **"PIC: translational velocity transfer (dissipation)"**

$$
\text{PIC P2G: }
m_i^n=\sum_pw_{ip}^nm_p,
\quad
m_i^n\mathbf{v}_i^n=\sum_pw_{ip}^nm_p\mathbf{v}_p^n
$$

$$
\text{PIC G2P: }
\mathbf{v}_p^{n+1}=\sum_iw_{ip}^n\tilde{\mathbf{v}}_i^{n+1}
$$

### 5.2 RPIC 扩展

讲义关键词：

- **"RPIC: translational velocity and rotational velocity"**

$$
(m\mathbf{v})_i^{n+1}=\sum_pw_{i,p}\Big[m_p\mathbf{v}_p^n+m_p\boldsymbol\omega_p^n\times(\mathbf{x}_i-\mathbf{x}_p^n)\Big]
$$

$$
\boldsymbol\omega_p^{n+1}=(\mathbf{K}_p^n)^{-1}\mathbf{L}_p^{n+1}
$$

### 5.3 APIC 核心思想与方程

讲义关键词：

- **"APIC: affine motion transfer, represented by matrix $\mathbf{C}$"**

$$
\text{APIC P2G: }
(m\mathbf{v})_i^{n+1}=\sum_pw_{i,p}\Big[m_p\mathbf{v}_p^n+m_p\mathbf{C}_p^n(\mathbf{x}_i-\mathbf{x}_p^n)\Big]
$$

$$
\text{APIC G2P: }
\mathbf{v}_p^{n+1}=\sum_iw_{i,p}\mathbf{v}_i^{n+1},
\qquad
\mathbf{C}_p^{n+1}=\mathbf{B}_p^{n+1}(\mathbf{D}_p^n)^{-1}
$$

![PIC RPIC APIC 传输对比](lec07_materials/pic_rpic_apic_transfer_comparison.png)

![APIC 核心方程与动量矩](lec07_materials/apic_core_equations_and_momentum_moments.png)

### 5.4 如何避免代价高或奇异的 $\mathbf{D}_p^{-1}$

在中心网格 + 二次/三次 B 样条下，$\mathbf{D}_p$ 可以化成常数形式：

$$
\omega_{ip}^n=N_{\mathrm{quadratic}}\Rightarrow \mathbf{D}_p^n=\frac{1}{4}\Delta x^2\mathbf{I},
\qquad
\omega_{ip}^n=N_{\mathrm{cubic}}\Rightarrow \mathbf{D}_p^n=\frac{1}{3}\Delta x^2\mathbf{I}
$$

二次中心网格时：

$$
\mathbf{C}_p^{n+1}=\frac{4}{\Delta x^2}\sum_iw_{i,p}\mathbf{v}_i^{n+1}(\mathbf{x}_i-\mathbf{x}_p^n)^T
$$

MAC 网格线性插值可用恒等式：

$$
\omega_{ip}^n(\mathbf{D}_p^n)^{-1}(\mathbf{x}_i-\mathbf{x}_p^n)=\nabla\omega_{ip}^n
$$

![APIC 中心网格二次 B 样条](lec07_materials/apic_centered_grid_quadratic_bspline.png)

![APIC MAC 网格三线性恒等式](lec07_materials/apic_mac_grid_trilinear_identity.png)

### 5.5 APIC 端到端流程

粒子积分 + APIC 传输 + 网格压力投影 + APIC 回传：

$$
\mathbf{x}_p^{n+1}=\mathbf{x}_p^n+\mathbf{v}_p^n\Delta t,
\qquad
\mathbf{v}_p^*=\mathbf{v}_p^n+\mathbf{f}_{\mathrm{extra}}\Delta t
$$

$$
\mathbf{v}_i^*=(m\mathbf{v})_i^{n+1}/m_i^{n+1},
\qquad
\mathbf{v}_i^{n+1}=\mathrm{PressureProjection}(\mathbf{v}_i^*,BC)
$$

$$
\mathbf{v}_p^{n+1}=\sum_iw_{i,p}\mathbf{v}_i^{n+1},
\qquad
\mathbf{C}_p^{n+1}=\frac{4}{\Delta x^2}\sum_iw_{i,p}\mathbf{v}_i^{n+1}(\mathbf{x}_i-\mathbf{x}_p^n)^T
$$

- **"Only P2G and G2P conserve angular momentum!"**

![APIC 全流程与性质](lec07_materials/apic_full_pipeline_and_properties.png)

:::remark 关键问题（原句）：compare PIC and APIC, how does $\mathbf{v}_p^n$ contribute to $\mathbf{v}_i^n$?
PIC 只传输局部常量速度分量。APIC 通过 $\mathbf{C}_p^n(\mathbf{x}_i-\mathbf{x}_p^n)$ 额外传输一阶（仿射）变化，因此对局部剪切/旋转的保真明显更好。
:::

## 6. 附录 A：流固耦合

### 6.1 单向耦合

核心思路：

- Solid affecting fluid：施加边界条件。
- Fluid affecting solid：计算耦合压力并施加力。

![流固单向耦合流程](lec07_materials/fluid_solid_one_way_coupling_pipeline.png)

### 6.2 双向耦合（变分视角）

$$
KE=\iiint_{\mathrm{fluid}}\frac{1}{2}\rho\|\mathbf{u}\|^2+\frac{1}{2}\mathbf{V}^*\mathbf{M}_s\mathbf{V}
$$

$$
\mathbf{u}^{n+1}=\tilde{\mathbf{u}}-\frac{\Delta t}{\rho}\nabla p,
\qquad
\mathbf{V}^{n+1}=\mathbf{V}^n+\Delta t\mathbf{M}_s^{-1}\mathbf{J}p
$$

$$
\frac{\Delta t}{\rho^2}\mathbf{G}^T\mathbf{M}_f\mathbf{G}p=\frac{1}{\rho}\mathbf{G}^T\mathbf{M}_f\tilde{\mathbf{u}}
$$

$$
\nabla\cdot\mathbf{u}^{n+1}=0,
\qquad
\mathbf{u}^{n+1}\cdot\hat{\mathbf{n}}=\mathbf{v}^{n+1}\cdot\hat{\mathbf{n}}
$$

![流固双向变分耦合](lec07_materials/fluid_solid_two_way_variational_coupling.png)

:::remark 关键问题（原意复述）：什么时候用单向，什么时候必须双向？
当固体对流体反作用很弱时，单向常够用；当动量交换强、解耦误差明显影响视觉或物理时，需要双向耦合。
:::

## 7. 附录 B：连续体守恒律

### 7.1 质量守恒

$$
\frac{d}{dt}\int_\Omega\rho\,dV
=-\oiint_{\partial\Omega}\rho\mathbf{v}\cdot\mathbf{n}\,dS
=-\int_\Omega\nabla\cdot(\rho\mathbf{v})\,dV
$$

$$
\frac{\partial\rho}{\partial t}=-\nabla\cdot(\rho\mathbf{v})
$$

对不可压流体：

$$
\frac{D\rho}{Dt}=0\Rightarrow\nabla\cdot\mathbf{v}=0
$$

![连续体质量守恒](lec07_materials/continuum_mass_conservation.png)

### 7.2 线动量守恒与 Cauchy 应力

$$
\int_\Omega\rho\frac{d\mathbf{v}}{dt}dV
=\oiint_{\partial\Omega}\mathbf{f}_{\mathrm{surface}}dS + \int_\Omega\mathbf{f}_{\mathrm{body}}dV
$$

$$
\mathbf{t}=\boldsymbol\sigma\mathbf{n},
\qquad
\oiint_{\partial\Omega}\boldsymbol\sigma\mathbf{n}\,dS=\int_\Omega\nabla\cdot\boldsymbol\sigma\,dV
$$

$$
\rho\frac{d\mathbf{v}}{dt}=\nabla\cdot\boldsymbol\sigma+\mathbf{f}_{\mathrm{body}}
$$

![连续体线动量与 Cauchy 方程](lec07_materials/continuum_linear_momentum_and_cauchy_equation.png)

### 7.3 角动量守恒

内部牵引不产生净力矩，推出应力对称：

$$
\sigma_{01}dh=\sigma_{10}dh
\Rightarrow
\boldsymbol\sigma=\boldsymbol\sigma^T
$$

### 7.4 Newtonian 应力到粘性拉普拉斯项

$$
\boldsymbol\sigma=-p\mathbf{I}+\mu\left(\nabla\mathbf{u}+(\nabla\mathbf{u})^T\right)
$$

$$
\rho\left(\frac{\partial\mathbf{u}}{\partial t}+\mathbf{u}\cdot\nabla\mathbf{u}\right)
= -\nabla p + \nabla\cdot\left[\mu\left(\nabla\mathbf{u}+(\nabla\mathbf{u})^T\right)\right] + \rho\mathbf{g}
$$

在不可压条件下，粘性项可化为分量拉普拉斯（例如 $\mu\nabla^2u$）。

![Newtonian 应力到 Navier-Stokes](lec07_materials/newtonian_fluid_stress_to_navier_stokes.png)

:::remark 关键问题（原意复述）：为什么不可压流体里常写成 $\mu\nabla^2\mathbf{u}$？
把 $\nabla\cdot(\mu(\nabla\mathbf{u}+(\nabla\mathbf{u})^T))$ 展开后，会出现和 $\nabla\cdot\mathbf{u}$ 相关的项；在 $\nabla\cdot\mathbf{u}=0$ 时这些项消失。
:::

## 8. Exam Review

### A. 必须能精确定义的概念

- **SPH interpolation**：基于核函数的局部粒子加权求和。
- **Kernel support radius**：核函数非零贡献的局部邻域范围。
- **Momentum-conserved SPH force forms**：满足成对反对称的压力/粘性离散形式。
- **PIC**：常量（平移）传输，稳定但耗散。
- **RPIC**：在传输中加入旋转自由度。
- **APIC**：用矩阵 $\mathbf{C}$ 传输仿射运动，降低 PIC 耗散并保留局部结构。

### B. 机制链（简答模板）

1. 从 Navier-Stokes 分裂为平流/外力/粘性/压力项。
2. SPH 用核函数近似密度、压力与力。
3. 用对称守恒形式修复内力导致的动量问题。
4. 混合法中：粒子做平流，网格做压力投影。
5. APIC 用仿射 P2G/G2P 传输，降低 PIC 耗散。

### C. 常见误区

- 直接用朴素 SPH 压力/粘性离散而不检查动量对称性。
- 忽略邻域质量（邻居过稀会导致 SPH 不稳）。
- 把 APIC 当成“更平滑插值”，但没理解角动量守恒来源。
- 忽略混合求解器中“传输设计”对结果质量的决定性作用。
- 连续体方程和离散力公式混用时缺乏一致性检查。

### D. 自检问题

- 你能从 $V_i=m_i/\rho_i$ 推出最终 SPH 插值式吗？
- 你能解释为什么朴素 SPH 压力/粘性可能破坏动量守恒吗？
- 你能默写 APIC 的 P2G 和 G2P 核心式吗？
- 你能说明 $\mathbf{D}_p$ 的作用，以及它为什么有时容易求、有时会奇异吗？
- 你能把 Cauchy 应力形式和不可压 NS 的粘性项联系起来吗？


