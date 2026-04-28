# 第五讲：深度学习 II（CNN 基础与训练）

## 1. 为什么要从 MLP 转向 CNN

这一讲先从视觉建模的核心瓶颈切入：全连接 MLP 并不尊重图像结构。

- 将图像展平为向量，在高分辨率输入下代价很高。
- 展平会破坏局部空间结构。
- 视觉任务依赖局部模式（边缘、角点、纹理）及其层级组合。

神经元级别的抽象仍然是：

$$
f\left(\sum_i w_i x_i+b\right)
$$

也可以把脉冲神经元看成时间维扩展：

$$
V_j[t+1]=\lambda V_j[t]+\sum_i w_{ij}S_i[t]+b_j,\qquad
S_j[t]=\mathbb{1}\left(V_j[t]\ge\theta_j\right)
$$

:::remark 问题与解答：为什么是 CNN？
**问题（课堂原问题）：** **CNN 和 FC，谁表达能力更强？FC/MLP 的问题是什么？**

**解答：** **FC is a super set of Conv layer (without sparse and parameter sharing constraints.)**  
但在视觉任务里，这种“更自由”通常会带来副作用：参数过多、归纳偏置弱、更容易过拟合、数据效率更差。
:::

## 2. 卷积层机制

![卷积层操作示意](lec05_materials/cnn_convolution_layer_operation.png)

二维卷积/相关运算本质上是局部加权求和：

$$
(f*g)[m,n]=\sum_{k=-\infty}^{\infty}\sum_{l=-\infty}^{\infty} f[m+k,n+l]g[k,l]
$$

在 CNN 实践中（有限核支持）：

$$
y=(x*g)[m,n]=\sum_{k=-b}^{b}\sum_{l=-b}^{b}w[k,l]^\top x[m+k,n+l],\qquad F=2b+1
$$

关键尺寸公式：

$$
N_{\text{out}}=\frac{N-F}{\text{stride}}+1,\qquad
N_{\text{out}}=\frac{N+2P-F}{\text{stride}}+1
$$

$$
W_2=\frac{W_1-F+2P}{S}+1,\qquad
H_2=\frac{H_1-F+2P}{S}+1
$$

![Padding 与输出尺寸公式](lec05_materials/cnn_padding_output_size_formula.png)

单个卷积层参数量：

$$
\#\text{params}=F^2CK\ (+K\text{ biases})
$$

其中 `F` 是卷积核大小，`C` 是输入通道数，`K` 是卷积核个数。

:::tip 问题与解答：为什么要 padding
**问题：** 如果反复使用 `5x5`、stride=`1`、且不做 padding，会发生什么？

**解答：** 空间尺寸会快速缩小（`32 -> 28 -> 24 -> ...`），表示能力明显下降。  
因此在前中层网络中，为了保留空间分辨率，零填充通常是标准做法。
:::

## 3. 池化、FC 对比卷积，以及为什么是 CNN

池化会对特征图做下采样，并引入局部不变性。

![最大池化示例](lec05_materials/cnn_max_pooling_example.png)

对于 `2x2` 池化（stride=2）：

$$
W_2=\left\lfloor\frac{W_1}{2}\right\rfloor,\qquad
H_2=\left\lfloor\frac{H_1}{2}\right\rfloor,\qquad
\#\text{params}=0
$$

卷积层相比全连接层，参数效率高得多：

$$
\#\text{params}_{\mathrm{FC}}=W_1W_2H_1H_2CK,\qquad
\#\text{params}_{\mathrm{Conv}}=F^2CK
$$

![FC 与卷积参数量对比](lec05_materials/cnn_fc_vs_conv_parameter_comparison.png)

CNN 的结构优势主要来自：

- 稀疏连接（局部感受野）。
- 参数共享（同一卷积核在空间上复用）。
- 池化带来的下采样与不变性。

:::remark 问题与解答：FC 更强，为什么不全用 FC？
**问题：** 如果 FC 表达能力更强，为什么视觉里不直接全用 FC？

**解答：** 因为图像是强结构化数据。CNN 的结构约束提供了有效先验，显著减少参数，优化更稳定，对数据量要求也更低。
:::

## 4. 等变性、不变性与 CNN 归纳偏置

图像分类可抽象为：

$$
\hat y=f(I;\theta),\qquad y\in\{0,1\}
$$

平移/旋转等微小扰动，直接引出几何鲁棒性问题。

- **Parameter Sharing = Equivariance with Translation**（忽略边界效应）。
- 池化有助于局部平移/旋转不变性。
- **Convolution is not naturally equivariant with changes in scale and rotation.**

![CNN 的归纳偏置总览](lec05_materials/cnn_inductive_bias_summary.png)

这一讲把 CNN 的归纳偏置概括为四点：

1. 局部连接。
2. 权重共享。
3. 平移等变。
4. 层级组合（边缘 -> 纹理/形状 -> 语义）。

:::remark 问题与解答：池化到底带来了什么不变性？
**问题：** 池化是否能让模型对所有几何变换都不敏感？

**解答：** 不能。池化主要提供局部不变性（尤其是小平移）。尺度变化和大角度旋转通常还需要额外机制（数据增强、多尺度设计、专门结构）。
:::

## 5. CNN 训练流水线

标准 mini-batch 训练循环：

1. 采样一个 batch。
2. 前向计算并得到损失。
3. 反向传播梯度。
4. 更新参数。

训练检查清单：

- 数据准备。
- 权重初始化。
- 损失函数定义。
- 优化配置（优化器 + 学习率）。

数据预处理常见操作：

$$
X\leftarrow X-\operatorname{mean}(X,\text{axis}=0),\qquad
X\leftarrow X\,/\,\operatorname{std}(X,\text{axis}=0)
$$

![数据预处理流程](lec05_materials/cnn_data_preprocessing_pipeline.png)

:::warn 问题与解答：为什么强调零均值数据
**问题（课堂原问题）：** 如果神经元输入总是正数，`w` 的梯度会怎样？

**解答：** 梯度很容易同号（全正或全负），导致优化路径“锯齿形”摆动，收敛变慢。做零中心化能明显缓解这个问题。
:::

## 6. 权重初始化：从小随机数到 Xavier/He

朴素小随机初始化：

$$
W=0.01\cdot\operatorname{randn}(D_{\mathrm{in}},D_{\mathrm{out}})
$$

通常只在浅层网络还可以，深层容易失效。

Xavier 初始化（适用于 `tanh` 这类零中心激活）：

$$
\sigma_W=\frac{1}{\sqrt{D_{\mathrm{in}}}},\qquad
W=\frac{\operatorname{randn}(D_{\mathrm{in}},D_{\mathrm{out}})}{\sqrt{D_{\mathrm{in}}}}
$$

方差推导核心：

$$
\operatorname{Var}(y)=D_{\mathrm{in}}\operatorname{Var}(x_i)\operatorname{Var}(w_i),\qquad
\operatorname{Var}(y)=\operatorname{Var}(x_i)\iff \operatorname{Var}(w_i)=\frac{1}{D_{\mathrm{in}}}
$$

![Xavier 初始化方差推导](lec05_materials/cnn_xavier_initialization_derivation.png)

对于 ReLU，通常改用 He 初始化：

$$
x\leftarrow \max(0,xW),\qquad
\sigma_W=\sqrt{\frac{2}{D_{\mathrm{in}}}},\qquad
W=\operatorname{randn}(D_{\mathrm{in}},D_{\mathrm{out}})\sqrt{\frac{2}{D_{\mathrm{in}}}}
$$

![ReLU 场景下的 He 初始化](lec05_materials/cnn_he_initialization_for_relu.png)

初始化仍是活跃研究方向（如 Fixup、Lottery Ticket、data-dependent initialization）。

:::remark 问题与解答：为什么初始化不当会让训练“还没开始就失败”
**问题：** 为什么优化器还没真正发挥作用，网络就可能学不动？

**解答：** 因为不良初始化会让激活或梯度在深层中塌缩（消失）或饱和/爆炸，导致有效梯度信号无法稳定传播。
:::

## 7. 优化：SGD、Momentum、Adam

基础 SGD 更新：

$$
x_{t+1}=x_t-\alpha\nabla f(x_t)
$$

SGD 三个典型问题：

1. 条件数大，路径容易锯齿震荡。
2. 鞍点/平坦区导致梯度很小。
3. mini-batch 梯度有噪声：

$$
L(W)=\frac{1}{N}\sum_{i=1}^{N}L_i(x_i,y_i,W),\qquad
\nabla_WL(W)=\frac{1}{N}\sum_{i=1}^{N}\nabla_WL_i(x_i,y_i,W)
$$

Momentum 在一致方向上加速：

$$
v_{t+1}=\rho v_t+\nabla f(x_t),\qquad
x_{t+1}=x_t-\alpha v_{t+1}
$$

![SGD 与 Momentum 对比](lec05_materials/cnn_sgd_momentum_comparison.png)

Adam 结合一阶/二阶矩并做偏差修正：

$$
m_t=\beta_1m_{t-1}+(1-\beta_1)g_t,\quad
v_t=\beta_2v_{t-1}+(1-\beta_2)g_t^2
$$

$$
\hat m_t=\frac{m_t}{1-\beta_1^t},\quad
\hat v_t=\frac{v_t}{1-\beta_2^t},\quad
\theta_t=\theta_{t-1}-\eta\frac{\hat m_t}{\sqrt{\hat v_t}+\epsilon}
$$

常用起始默认值：

$$
\beta_1=0.9,\qquad \beta_2=0.999,\qquad \eta\in\{10^{-3},5\times10^{-4}\}
$$

![Adam 更新分解](lec05_materials/cnn_adam_update_components.png)

:::tip 问题与解答：优化器和学习率谁更关键
**问题：** 实践里，优化器类型和学习率到底先调哪个？

**解答：** 学习率通常是一阶关键超参数；优化器选择是二阶改进。工程上常见强基线是 Adam + 合理的学习率策略。
:::

## Exam Review

### A. 必会定义

- **卷积层（Convolution layer）**：具有局部感受野和权重共享的线性算子。
- **池化（Pooling）**：无可学习参数的下采样算子。
- **稀疏连接（Sparse connectivity）**：每个输出只连接输入的局部邻域。
- **参数共享（Parameter sharing）**：同一卷积核在不同空间位置复用。
- **平移等变（Translation equivariance）**：输入平移会引起特征图对应平移。
- **（局部）不变性（Invariance）**：表示对小扰动不敏感。
- **Xavier 初始化**：面向零中心激活的方差保持初始化。
- **He 初始化**：面向 ReLU 的 `2/Din` 方差缩放初始化。
- **Momentum**：通过速度项缓解锯齿振荡、加快收敛。
- **Adam**：基于一阶/二阶矩与偏差修正的自适应优化器。

### B. 机制链路（必须能讲清）

图像局部性 -> 卷积与参数共享 -> 池化下采样 -> 层级特征组合 -> 分类头。  
训练效果再由预处理、初始化和优化器/学习率共同决定。

### C. 简答模板

- 为什么 CNN 比纯 FC 更适合图像？
  - CNN 注入了视觉任务先验，且参数量更低。
- 为什么前期卷积常配 padding？
  - 避免空间尺寸过快缩小，保留细节。
- 池化为什么有用？
  - 让特征对局部小位移更稳健。
- 为什么要 Xavier/He？
  - 维持深层激活与梯度尺度稳定。
- 为什么需要 Momentum/Adam？
  - 缓解锯齿与噪声问题，加速收敛。

### D. 常见误区

- 把平移等变误认为“对所有几何变换都不变”。
- 误以为 pooling 自动解决尺度不变性。
- 忽略 FC 与卷积在参数量上的数量级差异。
- 在深 ReLU 网络里直接套 Xavier 不做修正。
- 过度纠结优化器类型，却不先把学习率调对。

### E. 自检清单

- 你能推导有/无 padding 时的卷积输出尺寸吗？
- 你能在同输入输出规格下比较 FC 和 Conv 参数量吗？
- 你能解释“参数共享 -> 平移等变”吗？
- 你能说明预处理为何会改变优化几何吗？
- 你能说清 Xavier 何时用、He 何时用吗？
- 你能默写 SGD、Momentum、Adam 的更新式吗？

