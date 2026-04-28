# 第六讲：深度学习 III（优化、Softmax/交叉熵与归一化）

## 1. 优化配置：先把哪些环节定下来

一套完整训练配置由四个强耦合部分组成：

1. 数据预处理。
2. 权重初始化。
3. 损失函数。
4. 优化策略（优化器 + 学习率调度）。

在实践里，第 4 项往往决定训练是否稳定、是否高效。

:::remark 关键问题与解答：从哪里开始调优化
**问题（保留原意）：** **"optimizer?"** 和 **"learning rate?"**

**解答：** 先用稳健默认值（如 `Adam`），第一优先级调学习率和学习率调度。训练早期的大多数失败，不是结构问题，而是 LR 设定不当。
:::

## 2. 学习率、衰减与 Warmup

学习率决定参数更新步长：

- 太小：下降很慢。
- 太大：震荡甚至发散。
- 本讲语境下常见可用起点：约 `1e-6` 到 `1e-3`（依任务尺度而定）。

![学习率调度与公式](lec06_materials/learning_rate_schedules_formulas.png)

常见调度公式：

$$
\alpha_t=\frac{1}{2}\alpha_0\left(1+\cos\left(\frac{t\pi}{T}\right)\right)
$$

$$
\alpha_t=\alpha_0\left(1-\frac{t}{T}\right)
$$

$$
\alpha_t=\frac{\alpha_0}{\sqrt{t}}
$$

训练初期常配合线性 warmup：

- 前若干千次迭代，把 LR 从 `0` 线性升到目标值。
- 目的：在梯度与统计量仍不稳定时，避免一开始就“冲过头”。

:::tip 关键问题与解答：batch size 和 LR 为什么要联动
**问题（保留原意）：** batch size 增加 `N` 倍时，为什么初始 LR 常按 `N` 倍放大？

**解答：** batch 更大时梯度噪声通常更小，单步更新更可靠，因此通常能承受更大的步长。这是经验法则，不是严格定理。
:::

## 3. 优化器默认选择（实战版）

一个实用优先级：

- **"Adam is a good default"**：新数据集上收敛快、容错高。
- `SGD + Momentum` 可能更优，但通常需要更细致的 LR 与调度调参。
- 若调参预算有限，余弦衰减常是性价比很高的选项。

## 4. 从分类任务到 CNN 分类器结构

核心任务形态：

- 二分类：判断目标类别是否成立。
- 多分类：在 `K` 个已知类别中选一个。

经典 CNN 分类器模板：

$$
\texttt{[(Conv-ReLU)*N - POOL?]*m-(FC-ReLU)*K-FC-SoftMax}
$$

它表达的是“分层特征提取 + Softmax 分类头”的组合。

## 5. Softmax：把分数变成概率

关键定义（尽量保留原讲义措辞）：

- **"SoftMax ... is a generalization of the logistic/sigmoid function to multiple dimensions."**

给定 logits `s = f(x_i;W)`，类别概率为：

$$
P(Y=k\mid X=x_i)=\frac{e^{s_k}}{\sum_j e^{s_j}},\qquad s=f(x_i;W)
$$

等价激活写法：

$$
\sigma(z):\mathbb{R}^K\to(0,1)^K,\qquad \sigma(z)_i=\frac{\exp(\beta z_i)}{\sum_{j=1}^{K}\exp(\beta z_j)}
$$

$$
\beta\to\infty\Rightarrow \operatorname{Softmax}(z)\to\arg\max(z)
$$

$$
K=2\Rightarrow \sigma\!\left(\begin{bmatrix}z\\0\end{bmatrix}\right)_1=\operatorname{Sigmoid}(z)
$$

![Softmax：从 logits 到概率](lec06_materials/softmax_logits_to_probabilities.png)

## 6. 损失设计：NLL、Softmax-CE 与多分类 SVM

当标签是 one-hot 时，负对数似然（NLL）：

$$
L_i=-\log P(Y=y_i\mid X=x_i)
$$

与 Softmax 联立可写成：

$$
L_i=-\log\left(\frac{e^{s_{y_i}}}{\sum_j e^{s_j}}\right)
$$

本讲对比结论：

- **"Softmax classifier + cross-entropy loss"** 是当前最主流方案。
- 多分类 SVM 仍可用，但在现代深度分类管线里使用更少。

多分类 SVM 形式：

$$
L_i=\sum_{j\ne y_i}\max\left(0,\,s_j-s_{y_i}+1\right)
$$

## 7. 从 KL 散度到交叉熵

离散分布下 KL 散度：

$$
D_{KL}(P\parallel Q)=\sum_{x\in\mathcal{X}}P(x)\log\frac{P(x)}{Q(x)}
$$

$$
D_{KL}(P\parallel Q)\ge 0,\qquad D_{KL}(P\parallel Q)=0\iff P=Q
$$

$$
D_{KL}(P\parallel Q)\ne D_{KL}(Q\parallel P)
$$

![离散分布的 KL 散度](lec06_materials/kl_divergence_distance_between_distributions.png)

本讲使用的分解：

$$
D_{KL}(P\parallel Q)=-\sum_{x\in\mathcal{X}}P(x)\log Q(x)-\left(-\sum_{x\in\mathcal{X}}P(x)\log P(x)\right)
$$

$$
H(P,Q)=-\sum_{x\in\mathcal{X}}P(x)\log Q(x),\qquad H(P)=-\sum_{x\in\mathcal{X}}P(x)\log P(x)
$$

当 `P` 是固定真值分布时，最小化 KL 与最小化交叉熵等价（差一个常数项）：

$$
\mathcal{L}_{CE}=H(P,Q)=-\sum_{x\in\mathcal{X}}P(x)\log Q(x)
$$

$$
\mathcal{L}_{CE}\approx\log(\#\text{classes})\ \text{(random init)},\qquad \min\mathcal{L}_{CE}=0
$$

![由 KL 推到交叉熵](lec06_materials/cross_entropy_from_kl_derivation.png)

:::remark 关键问题与解答：标签不是 one-hot 时怎么办
**问题（保留原意）：** 如果目标概率不是 one-hot（如标签不确定或 label smoothing），应该优化什么？

**解答：** 应该用“分布对分布”的损失，典型就是交叉熵；在 `P` 固定时，它与 KL 最优化是等价的（相差常数项）。
:::

## 8. 欠拟合与过拟合（引出归一化的优化动机）

![欠拟合与过拟合示意](lec06_materials/underfitting_overfitting_curves.png)

- 欠拟合：训练误差高，常见原因是容量不足或优化不到位。
- 过拟合：训练误差低，但验证/测试泛化差。
- 更强的优化工具（如归一化、残差/跳连）能显著降低深层网络欠拟合风险。

## 9. BatchNorm：训练态与测试态机制

典型插入位置：线性/卷积层之后，非线性激活之前。

训练态公式：

$$
x\in\mathbb{R}^{N\times D},\qquad \gamma,\beta\in\mathbb{R}^{D}
$$

$$
\mu_j=\frac{1}{N}\sum_{i=1}^{N}x_{i,j},\qquad \sigma_j^2=\frac{1}{N}\sum_{i=1}^{N}(x_{i,j}-\mu_j)^2
$$

$$
\hat{x}_{i,j}=\frac{x_{i,j}-\mu_j}{\sqrt{\sigma_j^2+\epsilon}},\qquad y_{i,j}=\gamma_j\hat{x}_{i,j}+\beta_j
$$

![BatchNorm 训练态公式](lec06_materials/batchnorm_train_mode_equations.png)

测试态使用滑动统计量：

$$
\mu_{\mathrm{rms}}\leftarrow \rho\mu_{\mathrm{rms}}+(1-\rho)\mu_i,\qquad
\sigma_{\mathrm{rms}}^2\leftarrow \rho\sigma_{\mathrm{rms}}^2+(1-\rho)\sigma_i^2
$$

$$
\hat{x}_{i,j}=\frac{x_{i,j}-\mu_{\mathrm{rms},j}}{\sqrt{\sigma_{\mathrm{rms},j}^2+\epsilon}},\qquad y_{i,j}=\gamma_j\hat{x}_{i,j}+\beta_j
$$

![BatchNorm 测试态公式](lec06_materials/batchnorm_eval_mode_equations.png)

在 CNN 中接入 BN 后的模板：

$$
\texttt{[(Conv-BN-ReLU)*N - POOL?]*m-(FC-BN-ReLU)*K-FC-SoftMax}
$$

![CNN 中 Conv-BN-ReLU 结构](lec06_materials/conv_bn_relu_block.png)

:::warn 关键问题与解答：最后一层为何通常不用 BN
**问题（保留原意）：** 为什么最后输出层通常不加 BN？

**解答：** 最后一层是任务语义空间（如 logits）。若强行按隐藏层统计分布去归一化，可能破坏输出与标签语义之间应有的对应关系。
:::

## 10. BatchNorm 为何有效：经典解释与现代解释

本讲对比了两种视角：

- 经典解释：缓解 **internal covariate shift**。
- 现代经验：BN 主要在于平滑/改善优化地形，使梯度更可预测、允许更大学习率。

直接收益：

- 深网络更易优化。
- 梯度尺度更稳定。
- 由 batch 统计噪声带来轻微正则化。

:::remark 关键问题与解答："Why BatchNorm Works?"
**问题：** **"Why BatchNorm Works?"** 它的主要机制真的是 internal covariate shift 吗？

**解答：** internal covariate shift 是历史上重要直觉；但现代研究更倾向于“改善优化条件”才是 BN 效果的核心来源。
:::

## 11. BN 的局限与 GN 在小 batch 下的优势

BN 的典型失效场景：

- batch 太小，批内均值/方差噪声很大。
- 训练态批统计与测试态滑动统计不一致。
- 训练目标与测试行为错位，可能导致明显掉点。

几种归一化方式的“统计维度”差异：

- BatchNorm：每个通道，跨 batch + 空间维统计。
- LayerNorm：单样本内跨通道统计。
- InstanceNorm：单样本逐通道统计。
- GroupNorm：单样本内按通道分组统计。

![BatchNorm / LayerNorm / InstanceNorm / GroupNorm 对比](lec06_materials/normalization_techniques_comparison.png)

![小 batch 条件下 BatchNorm 与 GroupNorm 对比](lec06_materials/batchnorm_vs_groupnorm_small_batch.png)

:::tip 关键问题与解答："Why BatchNorm?"
**问题：** **"Why BatchNorm?"**

**解答：** 在 CNN 中，不同通道常对应不同检测器。BN 做的是“按通道归一化”，既保留通道语义，又能显著稳定优化。
:::

:::remark 关键问题与解答："Why not LayerNorm?"
**问题：** **"Why not LayerNorm?"**

**解答：** LayerNorm 在单样本内把所有通道绑定到同一统计量，容易让 CNN 中通道语义互相干扰；这在图像分类中常不理想，但在 Transformer 中通常非常有效。
:::

:::remark 关键问题与解答："Why not InstanceNorm?"
**问题：** **"Why not InstanceNorm?"**

**解答：** InstanceNorm 会去除样本特有外观统计（对比度、亮度、风格），可能把分类有用信息一起抹掉，因此更常见于风格迁移而非通用分类。
:::

:::tip 关键问题与解答："Why GroupNorm sometimes?"
**问题：** **"Why GroupNorm sometimes?"**

**解答：** GroupNorm 不依赖 batch 统计，在小 batch 或样本高度相关（检测/分割常见）时更稳定，往往比 BN 更可靠。
:::

## Exam Review

### A. 必会定义

- **学习率调度（Learning-rate schedule）**：按迭代/epoch 调整学习率的规则。
- **Softmax**：把 logits 映射到概率单纯形的函数。
- **NLL / 交叉熵**：基于对数似然的分类目标函数。
- **KL 散度**：两个分布间的有向差异度量。
- **BatchNorm**：训练时用批统计、测试时用滑动统计的按通道归一化。
- **LayerNorm / InstanceNorm / GroupNorm**：按不同归一化维度定义的三种替代方案。

### B. 机制链路（必须讲清）

优化配置（预处理/初始化/损失/LR） -> logits -> Softmax 概率 -> CE/KL 目标 -> 梯度更新 -> 归一化辅助稳定训练。

### C. 简答模板

- 学习率调度为什么关键？
  - 前期要快、后期要稳，调度就是在二者间平衡。
- 为什么 Softmax + CE 常用？
  - 输出可解释概率，且对数似然目标优化性质好。
- 标签是软分布时为什么用 CE？
  - 它比较的是“分布与分布”，不是只比较单一类别索引。
- 为什么 CNN 隐藏层常用 BN？
  - 既保留通道语义，又显著改善优化稳定性。
- 为什么小 batch 常选 GN？
  - 避免对 noisy batch 统计的依赖。

### D. 常见误区

- 只换优化器，不调学习率与调度。
- 把 KL 当成严格“距离度量”（metric）。
- 忘记 BN 的训练态/测试态统计来源不同。
- 对输出 logits 层无差别套 BN。
- 认为 LayerNorm/InstanceNorm 可在所有 CNN 场景无脑替代 BN。

### E. 自检清单

- 你能从 KL 推到 CE（在 `P` 固定条件下）吗？
- 你能默写 Softmax 与单样本 NLL 吗？
- 你能解释 warmup 为何能抑制训练初期不稳定吗？
- 你能写出 BN 训练态/测试态公式并说明区别吗？
- 你能说明何时应优先 GroupNorm 吗？
