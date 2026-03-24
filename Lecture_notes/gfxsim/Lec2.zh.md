# 第2讲 刚体动力学：姿态、惯量与时间积分

## 1. 为什么这一讲重要

刚体仿真是第一个必须把平动与转动同时求解的环节。在图形学里，旋转物体、碰撞响应、关节系统和可信运动都依赖这一套机制。

本讲的一次仿真步可组织为：

1. 在采样点上计算外力。
2. 聚合平动相关量。
3. 在世界坐标中计算力矩与惯量。
4. 对姿态与角速度做时间积分。

![刚体仿真总流程](lec02_materials/rigid_body_dynamics_summary_pipeline.png)

:::remark 关键问题：为什么不能把刚体当作单个粒子处理？
粒子模型只跟踪位置和线速度。刚体还必须包含姿态、角速度和惯量张量，因为不同质量分布在同一力矩下会产生不同转动响应。
:::

## 2. 粒子状态与刚体状态

与粒子相比，刚体额外引入了转动状态：

- 质心位置 $\mathbf{x}_c$
- 质心速度 $\mathbf{v}_c$
- 姿态（旋转矩阵/欧拉角/四元数）
- 角速度 $\boldsymbol{\omega}$
- 质量 $M$
- 惯量张量 $\mathbf{I}$

![粒子与刚体对比](lec02_materials/points_vs_rigid_bodies_overview.png)

实践中通常拆成两部分：

- 质心平动
- 围绕质心的转动

## 3. 质心平动

质心的运动等价于总质量作用下的质点运动。课件给出：

$$
\mathbf{x}_c = \frac{\sum_i m_i\mathbf{x}_i}{\sum_i m_i},
\quad
\mathbf{v}_c = \frac{\sum_i m_i\mathbf{v}_i}{\sum_i m_i},
\quad
\mathbf{a}_c = \frac{\sum_i m_i\mathbf{a}_i}{\sum_i m_i}
$$

力汇总与显式更新：

$$
\mathbf{f}=\sum_i\mathbf{f}_i,
\quad
\mathbf{v}_c \leftarrow \mathbf{v}_c + \Delta t\,M^{-1}\mathbf{f},
\quad
\mathbf{x}_c \leftarrow \mathbf{x}_c + \Delta t\,\mathbf{v}_c
$$

## 4. 局部空间到世界空间

把局部坐标系质心固定在原点，可写出映射：

$$
\mathbf{x}^{\mathrm{world}}_i = \mathbf{x}^{\mathrm{world}}_c + \mathbf{R}\,\mathbf{x}^{\mathrm{obj}}_i
$$

材质点速度为：

$$
\mathbf{v}^{\mathrm{world}}_i = \mathbf{v}^{\mathrm{world}}_c + \boldsymbol{\omega}\times(\mathbf{R}\,\mathbf{r}_i)
$$

![局部到世界映射](lec02_materials/local_to_world_space_mapping.png)

这个关系把几何姿态与物理速度连接起来，是后续力矩计算的基础。

## 5. 姿态表示及其取舍

### 5.1 旋转矩阵

核心性质：

- **列向量单位化且两两正交**
- $\mathbf{R}^{-1}=\mathbf{R}^{\mathsf{T}}$
- 保长度、保角度、保持手性

优点是顶点变换直接，缺点是动力学中冗余大（9 个参数表示 3 个自由度），时间导数处理也不够自然。

### 5.2 欧拉角/Tait-Bryan 角

欧拉角在控制和交互中直观，但会遇到万向节死锁（gimbal lock）。

![万向节死锁](lec02_materials/gimbal_lock_axes_alignment.png)

:::warn 关键问题：仿真里的 gimbal lock 本质是什么？
当两个旋转轴对齐时，局部丢失一个转动自由度，角度更新会病态，数值积分容易变差。
:::

### 5.3 四元数

课件强调单位四元数适合动力学：

- 几乎唯一（$\mathbf{q}$ 与 $-\mathbf{q}$ 表示同一姿态）
- 无 gimbal lock
- 多次旋转拼接高效
- 与角速度的导数关系清晰

## 6. 四元数旋转与代数

对 $\mathbf{q}=(s,\mathbf{v})$，乘法写作：

$$
\mathbf{q}_1\otimes\mathbf{q}_2=
\big(s_1s_2-\mathbf{v}_1\cdot\mathbf{v}_2,\;s_1\mathbf{v}_2+s_2\mathbf{v}_1+\mathbf{v}_1\times\mathbf{v}_2\big)
$$

轴角 $(\mathbf{n},\phi)$ 的单位四元数：

$$
\mathbf{Q}=\left[\cos\frac{\phi}{2},\;\mathbf{n}\sin\frac{\phi}{2}\right],
\qquad
\mathbf{Q}^{-1}=\left[\cos\frac{\phi}{2},\;-\mathbf{n}\sin\frac{\phi}{2}\right]
$$

点旋转为：

$$
[0,\mathbf{x}'] = \mathbf{Q}\otimes [0,\mathbf{x}]\otimes \mathbf{Q}^{-1}
$$

连续旋转可通过乘法顺序进行合成。

![四元数旋转点公式](lec02_materials/quaternion_rotate_point_formula.png)

## 7. 角动量、力矩与惯量张量

动力学主方程：

$$
\mathbf{L}=\mathbf{I}\boldsymbol{\omega},
\qquad
\frac{d\mathbf{L}}{dt}=\boldsymbol{\tau},
\qquad
\boldsymbol{\tau}=\sum_i\mathbf{x}_i\times\mathbf{f}_i
$$

世界坐标下逐点力矩：

$$
\boldsymbol{\tau}_i=(\mathbf{R}\mathbf{r}_i)\times\mathbf{f}_i,
\qquad
\boldsymbol{\tau}=\sum_i\boldsymbol{\tau}_i
$$

局部参考系惯量张量：

$$
\mathbf{I}_{\mathrm{ref}}=\sum_i m_i\left((\mathbf{r}_i^{\mathsf{T}}\mathbf{r}_i)\mathbf{I}_3-\mathbf{r}_i\mathbf{r}_i^{\mathsf{T}}\right)
$$

转到世界系：

$$
\mathbf{I}_t=\mathbf{R}_t\,\mathbf{I}_{\mathrm{ref}}\,\mathbf{R}_t^{\mathsf{T}}
$$

![力矩与惯量流程](lec02_materials/angular_momentum_torque_inertia_pipeline.png)

:::tip 关键问题：为什么要每步更新惯量张量？
因为世界坐标下的惯量取决于当前姿态。若刚体在转动但仍把 $\mathbf{I}$ 当常量，会导致角动力学失真。
:::

## 8. 转动时间积分

角速度驱动下的四元数导数：

$$
\frac{d\mathbf{q}}{dt}=\frac{1}{2}[0,\boldsymbol{\omega}]\otimes\mathbf{q}
$$

常见显式一步：

$$
\mathbf{q}_{n+1}=\mathbf{q}_n+\frac{\Delta t}{2}[0,\boldsymbol{\omega}_n]\otimes\mathbf{q}_n,
\qquad
\mathbf{q}_{n+1}\leftarrow\frac{\mathbf{q}_{n+1}}{\|\mathbf{q}_{n+1}\|}
$$

角速度更新可写成欧拉刚体方程离散形式：

$$
\boldsymbol{\omega}_{n+1}=\boldsymbol{\omega}_n+\Delta t\,\mathbf{I}^{-1}\left(\boldsymbol{\tau}_n-\boldsymbol{\omega}_n\times(\mathbf{I}\boldsymbol{\omega}_n)\right)
$$

它是平动显式/隐式思想在转动系统中的对应形式，但由于 $\boldsymbol{\omega}\times(\mathbf{I}\boldsymbol{\omega})$ 存在，非线性更强。

## 9. 课件实现建议

- 先把平动部分跑通，再接转动。
- 一个好用的自检是“无外力矩下常角动量自旋”。
- **重力若通过质心施加，不产生力矩。**
- 四元数要定期归一化。
- 明确区分局部预计算量（$\mathbf{I}_{\mathrm{ref}}$）和每步世界变换量（$\mathbf{I}_t$）。

![长方体惯量公式](lec02_materials/box_inertia_tensor_formula.png)

## 10. 公式速查（与讲义对齐）

- $\mathbf{x}_c=\dfrac{\sum_i m_i\mathbf{x}_i}{\sum_i m_i}$
- $\mathbf{v}_c\leftarrow\mathbf{v}_c+\Delta t\,M^{-1}\mathbf{f}$，$\mathbf{x}_c\leftarrow\mathbf{x}_c+\Delta t\,\mathbf{v}_c$
- $\mathbf{x}^{\mathrm{world}}_i=\mathbf{x}^{\mathrm{world}}_c+\mathbf{R}\mathbf{x}^{\mathrm{obj}}_i$
- $\mathbf{R}^{-1}=\mathbf{R}^{\mathsf{T}}$
- $\mathbf{q}_1\otimes\mathbf{q}_2$
- $[0,\mathbf{x}']=\mathbf{Q}\otimes[0,\mathbf{x}]\otimes\mathbf{Q}^{-1}$
- $\mathbf{L}=\mathbf{I}\boldsymbol{\omega}$，$\dfrac{d\mathbf{L}}{dt}=\boldsymbol{\tau}$
- $\mathbf{I}_{\mathrm{ref}}=\sum_i m_i((\mathbf{r}_i^{\mathsf{T}}\mathbf{r}_i)\mathbf{I}_3-\mathbf{r}_i\mathbf{r}_i^{\mathsf{T}})$
- $\mathbf{I}_t=\mathbf{R}_t\mathbf{I}_{\mathrm{ref}}\mathbf{R}_t^{\mathsf{T}}$
- $\dfrac{d\mathbf{q}}{dt}=\dfrac{1}{2}[0,\boldsymbol{\omega}]\otimes\mathbf{q}$
- $\boldsymbol{\omega}_{n+1}=\boldsymbol{\omega}_n+\Delta t\,\mathbf{I}^{-1}(\boldsymbol{\tau}_n-\boldsymbol{\omega}_n\times\mathbf{I}\boldsymbol{\omega}_n)$

## 11. Exam Review

### 11.1 高价值定义

- **刚体状态**：平动变量 + 姿态 + 角速度 + 惯量张量。
- **力矩**：力在转动系统中的对应量。
- **惯量张量**：三维转动中的“质量等价物”。
- **四元数导数关系**：角速度到姿态更新的运动学桥梁。

### 11.2 机制检查清单

1. 计算各点外力 $\mathbf{f}_i$。
2. 更新 $\mathbf{v}_c,\mathbf{x}_c$。
3. 由四元数构建旋转矩阵 $\mathbf{R}$。
4. 计算力矩与世界惯量。
5. 更新 $\boldsymbol{\omega}$ 与四元数。
6. 归一化四元数并进入下一步。

### 11.3 简答模板

- 为什么动力学偏好四元数？
因为它避免 gimbal lock，旋转拼接高效，且与角速度的导数关系清晰。

- 为什么每步都要更新 $\mathbf{I}$？
因为世界坐标下惯量随姿态变化。

- 为什么重力有时不产生力矩？
若作用线穿过质心，力臂为零。

### 11.4 常见误区

- 力矩计算中混用局部/世界坐标。
- 忘记四元数归一化。
- 在三维刚体中把惯量误当标量。
- 连续旋转时四元数乘法顺序写反。

### 11.5 提交前自检

1. 是否明确区分平动与转动状态？
2. 力矩与惯量是否在正确坐标系下定义？
3. 是否包含四元数导数与归一化步骤？
4. 是否解释了 $\mathbf{I}_t=\mathbf{R}\mathbf{I}_{\mathrm{ref}}\mathbf{R}^{\mathsf{T}}$ 的意义？
5. 是否给出了至少一个物理合理性自检实验？
