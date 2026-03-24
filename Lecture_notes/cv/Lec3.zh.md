# 第 3 讲：经典视觉 II - 卷积实现、鲁棒直线拟合与 Harris 角点

## 1. 学习目标与知识路线

本讲把经典视觉里的三条实用主线连起来：

- 在现代硬件上高效实现卷积。
- 在存在离群点时，把边缘稳健地提升为直线模型。
- 用 Harris 角点检测器得到稳定关键点。

学完后你应当能够：

- 准确说明卷积与相关（correlation）的区别。
- 推导最小二乘直线拟合，以及其齐次形式的 SVD 解法。
- 解释 RANSAC 为什么有效，以及迭代次数怎么设。
- 从窗口平移能量推导出 Harris 响应函数。

:::remark 📝 问题与解答：车道线检测作为系统任务
**问题：** **"How to detect the lane?"**

**解答：** 采用模块化流水线：gradient -> edge -> line。关键不只是找到候选边缘，而是让每个阶段都具备鲁棒性（去噪、抗离群、稳定模型选择）。
:::

## 2. 卷积算子的工程实现

### 2.1 卷积与相关

课件里的关键表述是：

**"Convolution (The kernel $g$ is flipped before shifting)."**

1D 与 2D 卷积：

$$
(f * g)(n)=\sum_{m=-\infty}^{\infty} f(n-m)\,g(m)
$$

$$
(f * g)(i,j)=\sum_m\sum_n f(i-m,j-n)\,g(m,n)
$$

相关（不翻转核）：

$$
(f \star g)(n)=\sum_{m=-\infty}^{\infty} f(n+m)\,g(m)
$$

$$
(f \star g)(i,j)=\sum_m\sum_n f(i+m,j+n)\,g(m,n)
$$

![卷积与相关公式](lec03_materials/convolution_correlation_formulas.png)

课堂强调的性质：

$$
f * g=g * f,
\quad
(f*g)*h=f*(g*h),
\quad
f*(g+h)=f*g+f*h
$$

$$
\mathcal{F}(f*g)=\mathcal{F}(f)\,\mathcal{F}(g),
\quad
\mathcal{F}(f\star g)=\overline{\mathcal{F}(f)}\,\mathcal{F}(g)
$$

![卷积与相关性质](lec03_materials/convolution_correlation_properties.png)

### 2.2 为什么需要 Padding

:::tip 💡 问题与解答：为什么要做 padding？
**问题：** Why do we need padding?

**解答：** 它能防止空间尺寸持续收缩，并保护边界信息。不做 padding 时，边缘像素参与卷积的次数明显更少，深层网络中特征图也会过快变小。
:::

![Padding 与像素利用率](lec03_materials/padding_pixel_utilization.png)

### 2.3 从滑窗到矩阵乘法

工程加速主线是 `im2col + GEMM`：

$$
K\times K\rightarrow 1\times K^2
$$

$$
H\times W\rightarrow K^2\times N,\quad N=H_{out}\times W_{out}
$$

$$
(1\times K^2)\times (K^2\times N)\rightarrow 1\times N
$$

$$
1\times N\rightarrow H_{out}\times W_{out}
$$

![im2col 重排](lec03_materials/im2col_matrix_rearrangement.png)

![GEMM 与输出重建](lec03_materials/gemm_output_reconstruction.png)

## 3. 从边缘图到鲁棒直线模型

### 3.1 为什么只有边缘还不够

:::remark 📝 问题与解答："Aren't we done just by doing edge detection?"
**问题：** **"Aren’t we done just by doing edge detection?"**

**解答：** 还不够。真实数据里有遮挡、非理想直线形态、以及多条候选线并存。边缘图只给候选，后续仍需拟合与鲁棒筛选。
:::

### 3.2 针对 $y=mx+b$ 的最小二乘拟合

给定点 $(x_i,y_i)$，最小化：

$$
E=\sum_{i=1}^{n}(y_i-mx_i-b)^2
$$

矩阵形式：

$$
E=\lVert Y-XB\rVert^2,\quad B=\begin{bmatrix}m\\b\end{bmatrix}
$$

$$
\frac{dE}{dB}=-2X^TY+2X^TXB=0
\Rightarrow
X^TXB=X^TY
\Rightarrow
B=(X^TX)^{-1}X^TY
$$

![最小二乘正规方程](lec03_materials/least_squares_normal_equation.png)

课堂特别指出的限制：该形式对垂直线会失效。

### 3.3 一般直线方程与 SVD 解

采用齐次直线形式：

$$
ax+by=d,
\quad
E=\sum_{i=1}^{n}(ax_i+by_i-d)^2
$$

$$
A=
\begin{bmatrix}
x_1 & y_1 & 1\\
\vdots & \vdots & \vdots\\
x_i & y_i & 1\\
\vdots & \vdots & \vdots\\
x_n & y_n & 1
\end{bmatrix},
\quad
h=\begin{bmatrix}a\\b\\d\end{bmatrix},
\quad
Ah=0
$$

为避免平凡解 $h=0$：

$$
\min_h \lVert Ah\rVert\quad \text{s.t.}\quad \lVert h\rVert=1
$$

SVD 分解：

$$
A_{n\times 3}=U_{n\times n}D_{n\times 3}V^T_{3\times 3}
$$

$$
V^TV=I_{3\times 3},\ V=[c_1,c_2,c_3],\
D=
\begin{bmatrix}
\operatorname{diag}(\lambda_1,\lambda_2,\lambda_3)\\
O
\end{bmatrix},\
\lambda_1\ge\lambda_2\ge\lambda_3\ge0
$$

令

$$
h=\alpha_1c_1+\alpha_2c_2+\alpha_3c_3,
\quad
\alpha_1^2+\alpha_2^2+\alpha_3^2=1,
$$

则有

$$
\lVert Ah\rVert^2=(\lambda_1\alpha_1)^2+(\lambda_2\alpha_2)^2+(\lambda_3\alpha_3)^2\ge\lambda_3^2
$$

因此最优解是：

$$
h=c_3
$$

![一般直线的 SVD 解](lec03_materials/general_line_svd_solution.png)

### 3.4 RANSAC：随机采样一致性

核心集合关系：

$$
|P|=|I|+|O|
$$

其中 $P$ 为全体点，$I$ 为内点，$O$ 为离群点。

算法骨架：

1. 随机采样最小样本集（大小为 $s$）。
2. 拟合候选模型。
3. 在阈值 $\delta$ 下统计内点。
4. 重复 $N$ 次，保留最大一致集。

![RANSAC 内点离群点示意](lec03_materials/ransac_inlier_outlier_setup.png)

### 3.5 RANSAC 需要多少次采样

:::remark 📝 问题与解答：How many samples?
**问题：** **"How many samples?"**

**解答：** 使用失败概率模型：

$$
N=\frac{\log(1-p)}{\log\big(1-(1-e)^s\big)}
$$

其中 $p$ 为目标成功概率，$e$ 为离群比例，$s$ 为最小采样数。
例如 $p=0.99, e=0.3, s=2$ 时，课件表格给出约 $N=7$。
:::

![RANSAC 采样次数公式](lec03_materials/ransac_sample_count_formula.png)

### 3.6 从投票视角看 RANSAC 与 Hough

Hough 把投票转到参数空间（例如 $y=mx+n$）。相较之下：

- RANSAC 对“单主模态 + 离群点”很强。
- Hough 对多模态结构和高离群比例更友好，但可能出现伪峰。

![RANSAC 与 Hough 对比](lec03_materials/ransac_vs_hough_comparison.png)

## 4. 什么是好的关键点

:::remark 📝 问题与解答：What Points are Keypoints?
**问题：** **"What Points are Keypoints?"**

**解答：** 好关键点需要显著、可重复、定位准确，并且数量足够支持后续匹配。
:::

课堂要求可归纳为：

- **"Repeatability: detect the same point independently in both images."**
- Saliency（局部结构信息量高）。
- Accurate localization（定位稳定）。
- Quantity sufficient（数量足够）。
- 对光照、尺度、视角变化具备不变性。

![关键点要求](lec03_materials/keypoint_requirements_repeatability.png)

课堂强调角点，是因为其局部梯度在多个主方向上都显著变化。

![Harris 角点直觉](lec03_materials/harris_intuition_window_shift.png)

## 5. Harris 角点检测：从推导到流程

### 5.1 窗口平移能量

从局部平移能量出发：

$$
E_{(x_0,y_0)}(u,v)=\sum_{(x,y)\in N(x_0,y_0)}[I(x+u,y+v)-I(x,y)]^2
$$

定义强度差图与窗口函数：

$$
D_{u,v}(x,y)=[I(x+u,y+v)-I(x,y)]^2
$$

$$
w(x,y)=
\begin{cases}
1,&-b\le x,y\le b\\
0,&\text{else}
\end{cases}
$$

因此

$$
E_{(x_0,y_0)}(u,v)=(D_{u,v}*w)(x_0,y_0)
$$

![窗口平移能量](lec03_materials/harris_shifted_window_energy.png)

### 5.2 一阶近似与结构张量

当 $(u,v)$ 足够小时：

$$
I[x+u,y+v]-I[x,y]\approx I_xu+I_yv
$$

$$
D_{u,v}(x,y)\approx (I_xu+I_yv)^2=
[u,v]
\begin{bmatrix}
I_x^2 & I_xI_y\\
I_xI_y & I_y^2
\end{bmatrix}
\begin{bmatrix}u\\v\end{bmatrix}
$$

$$
E_{(x_0,y_0)}(u,v)\approx
[u,v]
\begin{bmatrix}
I_x^2*w & I_xI_y*w\\
I_xI_y*w & I_y^2*w
\end{bmatrix}
\begin{bmatrix}u\\v\end{bmatrix}
$$

定义

$$
M(x,y)=
\begin{bmatrix}
I_x^2*w & I_xI_y*w\\
I_xI_y*w & I_y^2*w
\end{bmatrix}
$$

于是

$$
E_{(x_0,y_0)}(u,v)\approx [u,v]M(x_0,y_0)\begin{bmatrix}u\\v\end{bmatrix}
$$

![Taylor 近似与结构张量](lec03_materials/harris_taylor_structure_tensor.png)

### 5.3 特征值解释

由于 $M$ 是对称半正定矩阵，可做特征分解：

$$
M(x,y)=Q
\begin{bmatrix}
\lambda_1 & 0\\
0 & \lambda_2
\end{bmatrix}
Q^T,
\quad
\lambda_1,\lambda_2\ge0
$$

$$
E_{(x_0,y_0)}(u,v)\approx \lambda_1u'^2+\lambda_2v'^2,
\quad
\begin{bmatrix}u'\\v'\end{bmatrix}=Q\begin{bmatrix}u\\v\end{bmatrix}
$$

课件中的角点判据：

$$
\lambda_1,\lambda_2>b,
\quad
\frac{1}{k}<\frac{\lambda_1}{\lambda_2}<k
$$

### 5.4 角点响应函数与高斯窗口

课件给出的响应函数形式：

$$
\theta(x,y)=\det(M(x,y))-\alpha\operatorname{Tr}(M(x,y))^2-t
$$

课件给出的等价关系：

$$
\lambda_1,\lambda_2>b
\iff
\lambda_1\lambda_2-2t>0,\quad t=\frac{b^2}{2}
$$

$$
\frac{1}{k}<\frac{\lambda_1}{\lambda_2}<k
\iff
\lambda_1\lambda_2-2\alpha(\lambda_1+\lambda_2)^2>0
$$

$$
\theta=
\frac{1}{2}\big(\lambda_1\lambda_2-2\alpha(\lambda_1+\lambda_2)^2\big)
+
\frac{1}{2}\big(\lambda_1\lambda_2-2t\big)
$$

课堂经验值提示：当 $k\approx 3$ 时，可取 $\alpha\approx 0.045$。

使用高斯窗口可改善旋转一致性：

$$
M(x,y)=
\begin{bmatrix}
I_x^2*g_\sigma & I_xI_y*g_\sigma\\
I_xI_y*g_\sigma & I_y^2*g_\sigma
\end{bmatrix}
$$

$$
\theta(x,y)=g(I_x^2)g(I_y^2)-[g(I_xI_y)]^2-\alpha[g(I_x^2)+g(I_y^2)]^2-t
$$

![Harris 响应函数](lec03_materials/harris_corner_response.png)

:::tip 💡 问题与解答：为什么用高斯窗口？
**问题：** 为什么把硬矩形窗口替换为高斯窗口？

**解答：** 高斯窗口各向同性、对旋转更友好，能减少窗口方向偏置，同时保持局部聚合特性。
:::

### 5.5 Harris 端到端流程与性质

流程总结：

1. 计算图像导数 $I_x,I_y$。
2. 构造 $I_x^2, I_y^2, I_xI_y$。
3. 用窗口函数（矩形或高斯）做局部聚合。
4. 计算响应 $\theta(x,y)$。
5. 阈值化得到 $\theta(x,y)>0$。
6. 执行非极大值抑制。

![Harris 流程总览](lec03_materials/harris_pipeline_summary.png)

![Harris 检测结果](lec03_materials/harris_detection_results.png)

课堂给出的性质表述：

**"Corner response is equivariant with both translation and image rotation."**

## Exam Review

### A. 必会定义

- **Convolution：** 核翻转后再滑动的线性滤波操作。
- **Correlation：** 不做核翻转的模板匹配操作。
- **RANSAC：** 在离群环境下通过随机最小采样 + 一致集最大化进行鲁棒拟合。
- **结构张量 $M$：** 编码局部方向强度变化的二阶矩阵。
- **Harris 响应 $\theta$：** 综合 $M$ 的行列式与迹的角点打分。

### B. 机制链路（必须能讲清）

卷积要高效落地 -> im2col + GEMM 把滑窗变成矩阵乘法 -> 仅有边缘不足以稳定估计直线 -> SVD 提供齐次直线拟合的稳定解 -> RANSAC 通过一致性处理离群点 -> 匹配任务要求可重复关键点 -> Harris 把窗口平移能量转为基于特征值的角点评分。

### C. 简答模板

- 为什么最小二乘 $y=mx+b$ 会失效？
  - 因为垂直线无法用有限斜率 $m$ 表示。
- 为什么 SVD 能解齐次直线拟合？
  - 在约束 $\lVert h\rVert=1$ 下，最小化 $\lVert Ah\rVert$ 的解是最小奇异值对应的右奇异向量。
- 为什么 RANSAC 需要迭代？
  - 为保证以概率 $p$ 至少采到一次“无离群最小样本”。
- 为什么 Harris 看特征值？
  - 特征值直接反映主方向上的强度变化强弱。

### D. 常见误区

- 实现时混淆卷积与相关。
- 用斜截式最小二乘直接拟合垂直结构。
- 在高离群率下仍设置过小的 RANSAC 迭代次数。
- Harris 中跳过窗口聚合/平滑就直接阈值化。
- 只做阈值化，不做非极大值抑制。

### E. 自检清单

- 能否写出 1D/2D 卷积与相关公式？
- 能否推导正规方程并说明其限制？
- 能否解释为什么 SVD 解里有 $h=c_3$？
- 能否根据 $p,e,s$ 估计 RANSAC 的 $N$？
- 能否从 $E(u,v)$ 推导到 $M$ 再到 $\theta$？
