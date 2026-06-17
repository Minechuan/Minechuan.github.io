# 第十二讲：大模型 I - Attention、Transformer 与 ViT

## 1. 从 RNN 应用走向 Attention

这一讲从多模态序列任务出发，用它们来引出 attention 和 transformer。Image captioning、VQA 和 visual dialogue 都要求模型把视觉内容与语言生成或语言理解结合起来。

![Image captioning pipeline](lec12_materials/image_captioning_pipeline.png)

在 image captioning 中，CNN 先把图像转换成特征表示，RNN 再逐 token 生成单词序列。这说明前一讲的序列模型已经足够支持基础的“看图说话”任务。

![Visual question answering examples](lec12_materials/visual_question_answering_examples.png)

VQA 更进一步。模型不仅要看图，还要理解问题、对齐视觉证据和语言意图，再输出答案。正是这种“按需选择信息”的需求，把问题自然推进到 attention。

:::remark 关键问题与解答：为什么在这些任务之后引入 attention？
**问题（原意复述）：** 为什么 image captioning 和 VQA 会自然导向 attention？

**解答：** 因为这类任务要求模型在不同时间点关注不同的信息。只用一个固定 summary vector 往往太受限；attention 允许模型动态检索当前最相关的输入部分。
:::

## 2. Sequence-to-Sequence 与瓶颈问题

讲义用 machine translation 作为 sequence-to-sequence 的典型例子。Encoder 读入输入序列并更新 hidden state：

![Seq2seq encoder-decoder](lec12_materials/seq2seq_encoder_decoder.png)

$$
h_t = f_W(x_t, h_{t-1})
$$

Vanilla encoder-decoder 随后用最终 encoder state 初始化 decoder，并按自回归方式逐步预测输出 token：

$$
s_t = g_U(y_{t-1}, s_{t-1}, c)
$$

这里的 $c$ 是 context vector，通常来自最终 encoder state。这会形成明显的 bottleneck：整个输入序列必须先被压缩进一个向量，再开始解码。

Attention 的作用就是打破这个瓶颈，让 decoder 在每个 timestep 都能构造不同的 context vector。

![Seq2seq attention alignment](lec12_materials/seq2seq_attention_alignment.png)

Decoder 先计算 alignment scores：

$$
e_{t,i} = f_{\mathrm{att}}(s_{t-1}, h_i)
$$

然后把它们归一化成 attention weights：

$$
0 < a_{t,i} < 1,\qquad \sum_i a_{t,i} = 1
$$

最后 context vector 是 encoder hidden states 的加权和：

$$
c_t = \sum_i a_{t,i} h_i
$$

关键变化在于：decoder 不再依赖一个静态的全局摘要，而是可以在每一步主动索取所需的信息。

:::remark 关键问题与解答：seq2seq attention 解决了什么？
**问题（原意复述）：** 为什么只用最终 encoder state 不够？

**解答：** 因为一个向量必须承载全部输入信息，序列一长或内容一复杂，就会形成严重的信息瓶颈。Attention 让 decoder 能访问所有 encoder states，并在每个输出步拼装任务相关的 context vector。
:::

## 3. Attention 作为通用计算原语

**关键定义（讲义原文）：** **"Attention: A new primitive that operates on sets of vectors."**

通用 attention layer 把 seq2seq 中的思想抽象出来，只保留核心操作：用 query 去比较一组 data vectors，归一化这些分数，再做加权求和。

Softmax 归一化是：

$$
a_i = \frac{\exp(e_i)}{\sum_j \exp(e_j)}
$$

![Why scaled dot product](lec12_materials/why_scaled_dot_product.png)

讲义接着追问为什么使用 scaled dot product。如果分数过大，softmax 会饱和，梯度会变得非常小。同时，dot product 的量级会随维度增长：

$$
q \cdot x_i = \sum_{k=1}^{D_x} q_k x_{i,k}
$$

在讲义的简化假设下，其方差大致随维度增长：

$$
\mathrm{Var}(q \cdot x_i) \approx D_x,\qquad
\mathrm{Std}(q \cdot x_i) \approx \sqrt{D_x}
$$

因此用 $\sqrt{D}$ 去缩放，可以把分数量级控制在更稳定的范围内。

:::tip 关键问题与解答：为什么要做 scaled dot product？
**问题（讲义原文）：** **"Why Scaled Dot Product?"**

**解答：** 因为不缩放时，dot product 会随特征维度增大而变大，softmax 更容易饱和，梯度变小。除以 $\sqrt{D}$ 可以稳定分数分布和训练过程。
:::

## 4. 从 Attention 到 Cross-Attention 与 Self-Attention

最基础的 attention layer 使用 query 矩阵 $Q$ 和一组 data vectors $X$：

$$
E = \frac{QX^T}{\sqrt{D_x}},\qquad
E_{ij} = \frac{Q_i \cdot X_j}{\sqrt{D_x}}
$$

$$
A = \mathrm{softmax}(E, \mathrm{dim}=1),\qquad
Y = AX,\qquad
Y_i = \sum_j A_{ij} X_j
$$

更一般的版本会引入单独的 key 和 value 投影：

![Attention with keys and values](lec12_materials/attention_with_keys_values.png)

$$
K = XW_K,\qquad V = XW_V
$$

$$
E = \frac{QK^T}{\sqrt{D_Q}},\qquad
E_{ij} = \frac{Q_i \cdot K_j}{\sqrt{D_Q}}
$$

$$
Y = AV,\qquad
Y_i = \sum_j A_{ij} V_j
$$

如果 queries 来自一个集合，而 keys/values 来自另一个集合，这就是 **cross-attention**。

![Cross-attention layer](lec12_materials/cross_attention_layer.png)

如果三者都来自同一组输入，这就是 **self-attention**：

![Self-attention layer](lec12_materials/self_attention_layer.png)

$$
Q = XW_Q,\qquad K = XW_K,\qquad V = XW_V
$$

$$
E = \frac{QK^T}{\sqrt{D_Q}},\qquad
A = \mathrm{softmax}(E, \mathrm{dim}=1),\qquad
Y = AV
$$

它带来的核心能力是：每个 input token 都可以直接从所有其他 input tokens 收集信息。

:::remark 关键问题与解答：cross-attention 和 self-attention 的区别是什么？
**问题（原意复述）：** 实际应用里，cross-attention 和 self-attention 有什么不同？

**解答：** Cross-attention 是“一个集合去读另一个集合”，例如 decoder queries 去读 encoder outputs。Self-attention 是“同一个集合内部互相通信”，因此每个 token 都能读取整个输入序列。
:::

## 5. Masking、多头注意力与全局交互代价

语言模型不能让当前位置偷看未来 token。讲义中的 masked self-attention 就是在 softmax 之前，把不允许的位置的 similarity 强行改成 $-\infty$。

![Masked self-attention layer](lec12_materials/masked_self_attention_layer.png)

这样虽然 attention 公式不变，但 attention matrix 会被限制成下三角结构，从而保证 autoregressive decoding 的因果性。

Multi-head attention 会并行运行多个 self-attention：

![Multihead self-attention](lec12_materials/multihead_self_attention.png)

每个 head 都有自己的 query、key、value 投影。设 head dimension 为 $D_H$、head 数量为 $H$，最终输出投影是：

$$
O = YW_O
$$

讲义还特别强调，self-attention 本质上只是若干个矩阵乘法。

![Self-attention matrix pipeline](lec12_materials/self_attention_matrix_pipeline.png)

这让它非常适合并行计算，但代价是每个 head 都需要一个 $N \times N$ 的 attention matrix，因此 memory 和 compute 都会随序列长度二次增长。

:::warn 关键问题：为什么 self-attention 会贵？
**问题（原文/原意）：** 序列长度 $N$ 增大时，memory 会怎样增长？

**解答：** 因为每个 head 的 similarity matrix 是 $N \times N$，所以主导内存项随序列长度按 $O(N^2)$ 增长。
:::

## 6. 三种序列处理方式

讲义明确对比了 recurrent network、convolution 和 self-attention。

![Summary view of attention and transformers](lec12_materials/attention_transformer_summary.png)

三者的取舍可以概括为：

- RNN 处理有序 1D sequences，时间方向上是 $O(N)$ memory/compute，但难并行，因为 hidden states 必须顺序计算。
- Convolution 容易并行，但要建立长距离交互，通常需要堆很多层来扩大 receptive field。
- Self-attention 很适合并行，而且每个输出从第一层起就能直接访问所有输入，但代价是 $N^2$ attention map。

这也是为什么 attention 在大规模训练中变得极具吸引力：它把“时间上的串行递推”换成了“全局通信 + 并行矩阵计算”。

:::tip 关键问题与解答：为什么 transformer 会取代很多 RNN？
**问题（原意复述）：** 既然 self-attention 更贵，为什么它最后反而成了主流？

**解答：** 因为现代大模型训练更看重并行硬件效率和长距离依赖建模。Self-attention 易于并行，而且从第一层开始就能进行全局交互，这在大规模预训练里优势非常明显。
:::

## 7. Transformer Block

**关键定义（讲义原文）：** **"Transformer: A neural network architecture that uses attention everywhere."**

Transformer block 的输入是一组向量。向量之间唯一真正发生交互的地方是 multi-head self-attention；其余子层都在每个 token 上独立工作。

![Transformer block with LayerNorm](lec12_materials/transformer_block_with_layernorm.png)

讲义给出了 per-token 的 layer normalization。对 token 向量 $h_i$：

$$
\mu = \overline{h_i},\qquad
\sigma = \mathrm{std}(h_i)
$$

$$
\mathrm{LN}(h_i) = \gamma * (h_i - \mu) / \sigma + \beta
$$

Layer normalization 是对每个 token 的 channel 维做归一化，而不是对 batch 或 sequence 维归一化。

Transformer block 中的 feed-forward network 是逐 token 的两层 MLP：

![Why FFN](lec12_materials/why_ffn.png)

$$
\mathrm{FFN}(x) = W_2 \, \sigma(W_1x + b_1) + b_2
$$

典型维度是：

$$
D \rightarrow 4D \rightarrow D
$$

Self-attention 主要负责跨 token 的路由与混合；FFN 则负责每个 token 内部的非线性计算、特征变换、channel mixing 和容量提升。

![Why LayerNorm](lec12_materials/why_layernorm.png)

讲义还解释了为什么需要 layer normalization。Self-attention 子层和 FFN 子层都可能让 activation 变得不稳定，所以每个子模块都需要自己的 normalization。

:::remark 关键问题与解答：为什么 Transformer 还需要 FFN？
**问题（讲义原文）：** **"Why FFN?"**

**解答：** Attention 主要做的是跨 token 的信息路由和混合。FFN 则在每个 token 内部提供非线性计算和通道维特征变换，补足 attention 本身表达力不足的问题。
:::

:::remark 关键问题与解答：为什么需要 LayerNorm？
**问题（讲义原文）：** **"Why Layer Normalization?"**

**解答：** 因为 Transformer 子层会让 activation scale 变得不稳定。LayerNorm 对每个 token 的 feature channels 做归一化，从而稳定优化过程，同时不依赖 batch statistics。
:::

## 8. 用 Transformer 做语言模型

语言模型先用一个形状为 $[V \times D]$ 的 embedding matrix，把 token 映射成向量。

![LLM embedding and masking](lec12_materials/llm_embedding_and_masking.png)

在每个 transformer block 内部，使用 masked self-attention，保证当前位置只能看到之前的 token。

最后，用一个形状为 $[D \times V]$ 的 projection matrix，把每个 token 表示映射回 vocabulary logits：

![LLM output projection](lec12_materials/llm_output_projection.png)

训练目标是 next-token prediction，损失函数是 softmax 加 cross-entropy。

讲义还强调了一点：Transformer 的核心结构从 2017 年以来并没有发生根本变化，但模型已经变得更深、更宽、上下文更长。

## 9. 常见的 Transformer Tweaks

讲义把近年的常见改动归纳成一条主线：架构整体没变，但一些细节调整已经变得非常常见。

![Pre-norm transformer](lec12_materials/pre_norm_transformer.png)

**Pre-Norm** 把 layer normalization 移到 residual path 内部，这通常有助于深层 transformer 的优化稳定性。

![QK-Norm](lec12_materials/qk_norm.png)

**QK-Norm** 在计算相似度之前先归一化 queries 和 keys：

$$
Q = \mathrm{normalize}(XW_Q),\qquad
K = \mathrm{normalize}(XW_K)
$$

这样可以减少 gradient spikes，提升训练稳定性。

**Classic MLP** 可以写成：

$$
Y = \sigma(XW_1)W_2
$$

**SwiGLU** 则把它改成带门控的形式：

![SwiGLU MLP](lec12_materials/swiglu_mlp.png)

$$
Y = (\sigma(XW_1) \odot XW_2)W_3
$$

相比普通两层 MLP，这种 gated 结构有更强的非线性控制能力。

**Mixture of Experts (MoE)** 则把一个共享 MLP 换成多个 experts：

![Mixture of experts](lec12_materials/mixture_of_experts.png)

讲义强调的核心取舍是：参数量可以按 experts 数 $E$ 大幅增长，而每个 token 实际只激活少量 experts，因此 compute 增长远小于总参数增长。

:::tip 关键问题与解答：MoE 的意义是什么？
**问题（原意复述）：** 为什么要放很多 experts，但每个 token 只激活少数几个？

**解答：** 因为这样可以在不让每个 token 都承担完整计算代价的前提下，大幅增加模型总容量。也就是“参数量增长快于每 token 的实际算力开销”。
:::

## 10. Vision Transformer 与归纳偏置

Vision Transformer 会把图像切成 patch tokens。

![ViT patch tokens](lec12_materials/vit_patch_tokens.png)

对于一个 $224 \times 224 \times 3$ 图像，如果 patch 大小是 $16 \times 16$，则 token 总数是：

$$
14 \times 14 = 196 \text{ tokens}
$$

每个 patch 先被展平，再做线性投影：

$$
16 \times 16 \times 3 = 768 \Rightarrow D
$$

随后，transformer 对这些 $D$ 维 patch vectors 做处理，并通过 positional encoding 告诉模型每个 patch 的二维位置。

![ViT positional encoding](lec12_materials/vit_positional_encoding.png)

在分类阶段，讲义使用输出 patch 表示的 average pooling，再接一个从 $D$ 到类别数 $C$ 的线性层。

![ViT classification pooling](lec12_materials/vit_classification_pooling.png)

和 language modeling 不同，图像分类不需要 causal masking；每个 patch 都可以看到所有其他 patch。

CNN 和 ViT 在 inductive bias 上有明显差异。

![ViT vs CNN table](lec12_materials/vit_vs_cnn_table.png)

CNN 具有很强的图像先验：

![CNN inductive biases](lec12_materials/cnn_inductive_biases.png)

- local connectivity
- translation equivariance
- hierarchical composition
- spatial smoothness

ViT 则拿掉了大部分硬编码假设：

![ViT inductive biases](lec12_materials/vit_inductive_biases.png)

- 没有硬编码 locality
- 没有硬编码 translation equivariance
- 没有硬编码 hierarchy
- 剩下的弱先验主要来自 patch structure 和 positional encoding

这就解释了它们的性能差异：

![CNN vs ViT performance](lec12_materials/cnn_vs_vit_performance.png)

- CNN 在小中规模数据集上更 data-efficient，因为其 inductive biases 能帮助学习。
- ViT 在超大规模数据下可能更强，因为更弱的先验不再成为限制，模型可以学到更一般的关系。

:::remark 关键问题与解答：为什么 ViT 往往更吃数据？
**问题（原意复述）：** 为什么 CNN 在小数据更强，而 ViT 在大规模预训练下更容易反超？

**解答：** CNN 在训练前就带有大量图像相关先验，因此在有限数据下更容易学好。ViT 的 inductive bias 更弱，通常需要更多数据或更强预训练，但这份“弱先验”在大规模数据下反而更灵活，能学到更通用的关系。
:::

## 11. Exam Review

### 11.1 核心定义

- Attention：在一组向量上根据相似度做加权求和的计算原语。
- Cross-attention：queries 来自一个集合，keys 和 values 来自另一个集合。
- Self-attention：queries、keys、values 都来自同一输入集合。
- Masked self-attention：禁止未来位置被访问的 self-attention。
- Multi-head attention：多个 attention heads 并行运行，再合并输出。
- Transformer block：self-attention + residual + layer normalization + tokenwise FFN。
- Embedding matrix：把 vocabulary token 映射成模型向量的查表矩阵。
- Output projection：把模型维度映射回 vocabulary logits 的线性层。
- Vision Transformer：处理图像 patch tokens 的 transformer。
- Inductive bias：模型在见到数据前就内置的结构性假设。

### 11.2 简答题模板

如果被问到 attention 为什么优于固定 context vector，可以回答：

Attention 用动态检索替代了单个全局 bottleneck 向量。模型在不同输出步可以访问不同输入部分，因此更适合长序列和复杂依赖。

如果被问到 self-attention 到底做了什么，可以回答：

Self-attention 让每个 token 对所有 token 计算 similarity，做归一化，再从 values 中取加权和。本质上，它是一个学习式的、基于内容的全局通信机制。

如果被问到 transformer 为什么适合大规模训练，可以回答：

它主要由并行矩阵乘法组成，不依赖时间上的串行 hidden-state 递推，而且从第一层起就允许全局交互，这和现代并行硬件及大规模预训练非常匹配。

如果被问到 ViT 为什么在小数据上往往不如 CNN，可以回答：

因为 ViT 去掉了很多图像相关的强先验，因此更灵活但更不 data-efficient。CNN 在有限数据下通常更容易优化，也更容易泛化。

### 11.3 公式清单

Seq2seq with attention：

$$
h_t = f_W(x_t, h_{t-1}),\qquad
s_t = g_U(y_{t-1}, s_{t-1}, c)
$$

$$
e_{t,i} = f_{\mathrm{att}}(s_{t-1}, h_i),\qquad
c_t = \sum_i a_{t,i} h_i
$$

Attention：

$$
a_i = \frac{\exp(e_i)}{\sum_j \exp(e_j)}
$$

$$
E = \frac{QK^T}{\sqrt{D}},\qquad
A = \mathrm{softmax}(E),\qquad
Y = AV
$$

LayerNorm：

$$
\mu = \overline{h_i},\qquad
\sigma = \mathrm{std}(h_i),\qquad
\mathrm{LN}(h_i) = \gamma * (h_i - \mu) / \sigma + \beta
$$

FFN 与 SwiGLU：

$$
\mathrm{FFN}(x) = W_2 \, \sigma(W_1x + b_1) + b_2
$$

$$
Y = (\sigma(XW_1) \odot XW_2)W_3
$$

### 11.4 常见错误

- 把 attention 当成“替代 recurrence 的黑箱”，而不是“基于相似度做加权检索”的机制。
- 忘记 self-attention 的主要代价来自 $N \times N$ similarity matrix。
- 混淆 cross-attention 和 self-attention。
- 误以为 LayerNorm 是按 batch 归一化。本讲里它是按 token、跨 channels 做归一化。
- 误以为 FFN 负责跨 token 混合。实际上 FFN 是逐 token 独立计算；跨 token 混合是 attention 的工作。
- 误以为 ViT 永远比 CNN 强。讲义非常明确：小数据下 CNN 往往更 data-efficient。

### 11.5 自检问题

1. 为什么 seq2seq attention 可以打破固定 context bottleneck？
2. 为什么 dot product 要除以 $\sqrt{D}$？
3. 把 key 和 value 从原始 data vectors 中分离出来后，attention 的表达能力有什么变化？
4. 为什么语言模型必须使用 masked self-attention？
5. 为什么 self-attention 的 memory 是关于序列长度的二次增长？
6. FFN 提供了哪些 attention 本身不擅长提供的能力？
7. 为什么 LayerNorm 要按 token 做？
8. QK-Norm 是如何提升训练稳定性的？
9. 为什么 MoE 能让参数量增长快于每 token 的计算量？
10. 为什么 ViT 通常需要比 CNN 更多的数据？
