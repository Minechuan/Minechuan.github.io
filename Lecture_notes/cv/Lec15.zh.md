# 第十五讲：生成模型 II - Diffusion、Flow Matching 与条件生成

## 1. 从 VAE 走向 Diffusion Models

Diffusion models 可以看作一种很深的 latent-variable model。本讲从 VAE 开始，是因为 diffusion 仍然在解决同一个大目标：通过引入 latent variables 来建模数据似然，再学习一个可训练、可采样的近似过程。

对 VAE 来说，生成模型是

$$
p_\theta(x)=\int_z p_\theta(x\mid z)p(z)\,dz,\qquad
\max_\theta \mathbb{E}_{x\sim p_{\text{data}}}[\log p_\theta(x)].
$$

由于真实 posterior 很难直接计算，VAE 引入 variational posterior，并优化 ELBO：

$$
\log p_\theta(x)\ge
\mathbb{E}_{q_\phi(z\mid x)}
\left[\log \frac{p_\theta(x\mid z)p(z)}{q_\phi(z\mid x)}\right].
$$

问题在于：单个 latent code 必须同时表示物体类别、形状、姿态、纹理和细节。

![VAE single Gaussian limitation](lec15_materials/vae_single_gaussian_limitation.png)

Hierarchical VAE 通过引入多个 latent variables 来缓解这个问题：

$$
p(x,z_1,z_2)=p(x\mid z_1)p(z_1\mid z_2)p(z_2),\qquad
q(z_1,z_2\mid x)=q(z_1\mid x)q(z_2\mid z_1).
$$

这正是通往 diffusion 的桥梁。Diffusion 不只使用两个 latent variables，而是使用一条很长的 Markov chain \(x_0,x_1,\ldots,x_T\)。前向链逐步把数据破坏成噪声；反向链学习逐步把噪声还原成数据。

:::remark 关键问题与解答：为什么要突破单个 VAE latent code？
**问题（原意复述）：** 为什么 VAE 中单个 latent code 往往不足以生成高保真图像？

**解答：** 单个 Gaussian latent 需要同时压缩全局语义和局部细节。decoder 容易对多种可能输出做平均，因此图像会模糊、细节会丢失。层级 latent 或长 diffusion chain 可以把建模压力分散到多个步骤中。
:::

## 2. Forward Diffusion Process

Forward diffusion process 是固定的，不是学习出来的。它反复向干净数据 \(x_0\) 中加入 Gaussian noise，直到最终状态 \(x_T\) 接近标准高斯噪声。

![Forward diffusion kernel](lec15_materials/forward_diffusion_kernel.png)

一步前向加噪核为

$$
q(x_t\mid x_{t-1})=\mathcal{N}(x_t;\sqrt{1-\beta_t}x_{t-1},\beta_t I).
$$

定义

$$
\alpha_t=1-\beta_t,\qquad
\bar{\alpha}_t=\prod_{s=1}^{t}\alpha_s.
$$

那么从 \(x_0\) 直接到 \(x_t\) 的 closed-form diffusion kernel 是

$$
q(x_t\mid x_0)=\mathcal{N}(x_t;\sqrt{\bar{\alpha}_t}x_0,(1-\bar{\alpha}_t)I).
$$

等价地，可以一步采样出 \(x_t\)：

$$
x_t=\sqrt{\bar{\alpha}_t}x_0+\sqrt{1-\bar{\alpha}_t}\epsilon,\qquad
\epsilon\sim\mathcal{N}(0,I).
$$

Noise schedule \(\beta_t\) 的设计目标是让 \(\bar{\alpha}_T\to 0\)，从而得到

$$
q(x_T\mid x_0)\approx \mathcal{N}(0,I).
$$

![Forward diffusion distribution](lec15_materials/forward_diffusion_distribution.png)

**关键问题（讲义原意）：** **"What happens to a distribution in the forward diffusion?"**

分布会不断与 Gaussian noise 做卷积。细节结构被逐渐抹平；足够多步之后，分布会接近一个简单的 Gaussian。

:::remark 关键问题与解答：前向过程只破坏信息，为什么还有用？
**问题（原意复述）：** 如果 forward diffusion 只是把数据变成噪声，为什么还要定义它？

**解答：** 因为它创造了明确的 denoising supervision。每个时间步加入了多少噪声是已知的，所以可以训练神经网络去反转每一个小的噪声破坏步骤。
:::

## 3. Reverse Denoising 与 ELBO

生成时沿链条反向运行。从 \(x_T\sim\mathcal{N}(0,I)\) 开始，模型反复预测更干净的样本：

$$
p_\theta(x_{0:T})=p(x_T)\prod_{t=1}^{T}p_\theta(x_{t-1}\mid x_t),
$$

其中

$$
p_\theta(x_{t-1}\mid x_t)=\mathcal{N}(x_{t-1};\mu_\theta(x_t,t),\sigma_t^2I).
$$

ELBO 可以拆成 reconstruction、reverse-step matching 和 prior matching：

![DDPM ELBO terms](lec15_materials/ddpm_elbo_terms.png)

$$
\mathcal{L}_{\text{ELBO}}=
\mathbb{E}_q\left[
\log p_\theta(x_0\mid x_1)
-\sum_{t=2}^{T}D_{\mathrm{KL}}\left(q(x_{t-1}\mid x_t,x_0)\,\|\,p_\theta(x_{t-1}\mid x_t)\right)
-D_{\mathrm{KL}}\left(q(x_T\mid x_0)\,\|\,p(x_T)\right)
\right].
$$

最重要、真正需要学习的是 reverse-step matching：让 \(p_\theta(x_{t-1}\mid x_t)\) 尽量接近真实 posterior \(q(x_{t-1}\mid x_t,x_0)\)。

因为前向过程是 Gaussian，所以真实反向 posterior 也是 Gaussian：

![True reverse posterior Gaussian](lec15_materials/true_reverse_posterior_gaussian.png)

$$
q(x_{t-1}\mid x_t,x_0)=
\mathcal{N}\left(x_{t-1};\tilde{\mu}_t(x_t,x_0),\tilde{\beta}_t I\right),
$$

$$
\tilde{\mu}_t(x_t,x_0)=
\frac{\sqrt{\bar{\alpha}_{t-1}}\beta_t}{1-\bar{\alpha}_t}x_0+
\frac{\sqrt{\alpha_t}(1-\bar{\alpha}_{t-1})}{1-\bar{\alpha}_t}x_t,\qquad
\tilde{\beta}_t=\frac{1-\bar{\alpha}_{t-1}}{1-\bar{\alpha}_t}\beta_t.
$$

:::remark 关键问题与解答：真实 posterior 有公式，为什么推理时不能直接用？
**问题（原意复述）：** 如果 \(q(x_{t-1}\mid x_t,x_0)\) 已知，为什么还需要神经网络？

**解答：** 训练时 \(x_0\) 已知，所以真实 posterior 可以监督模型；但生成时我们从纯噪声开始，并不知道干净的 \(x_0\)。神经网络要学会只根据 \(x_t\) 和 \(t\) 近似需要的反向转移。
:::

## 4. DDPM Noise-Prediction Objective

DDPM 会重新参数化反向均值，让模型预测加入的噪声，而不是直接预测干净图像。

由 posterior mean 可以写出

$$
\tilde{\mu}_t(x_t,x_0)=
\frac{1}{\sqrt{\alpha_t}}
\left(x_t-\frac{\beta_t}{\sqrt{1-\bar{\alpha}_t}}\epsilon\right).
$$

模型使用相同形式，但用 \(\epsilon_\theta(x_t,t)\) 替换真实噪声 \(\epsilon\)：

$$
\mu_\theta(x_t,t)=
\frac{1}{\sqrt{\alpha_t}}
\left(x_t-\frac{\beta_t}{\sqrt{1-\bar{\alpha}_t}}\epsilon_\theta(x_t,t)\right).
$$

因此，匹配反向均值等价于在一个与时间有关的比例因子下预测真实噪声：

$$
\|\mu_\theta-\tilde{\mu}_t\|^2\propto
\|\epsilon_\theta(x_t,t)-\epsilon\|^2.
$$

![DDPM noise prediction objective](lec15_materials/ddpm_noise_prediction_objective.png)

最终简化目标为

$$
\mathcal{L}_{\text{simple}}=
\mathbb{E}_{x_0,t,\epsilon}
\left[\|\epsilon-\epsilon_\theta(x_t,t)\|_2^2\right],
$$

其中

$$
x_0\sim p_{\text{data}},\qquad
t\sim \mathrm{Uniform}\{1,\ldots,T\},\qquad
\epsilon\sim\mathcal{N}(0,I),\qquad
x_t=\sqrt{\bar{\alpha}_t}x_0+\sqrt{1-\bar{\alpha}_t}\epsilon.
$$

**关键句（讲义原话）：** **"Training diffusion = add known noise, then train a network to predict that noise."**

:::remark 关键问题与解答：为什么预测 noise，而不是直接预测 \(x_0\)？
**问题（原意复述）：** 为什么 DDPM 训练 \(\epsilon_\theta(x_t,t)\)，而不是直接训练一个 clean-image predictor？

**解答：** 前向过程让我们在训练时知道精确的噪声 \(\epsilon\)，所以 noise prediction 在每个 timestep 都有干净监督信号。通过 posterior mean 公式，预测噪声也就决定了反向 Gaussian 的均值。
:::

## 5. Score Function 与 SDE 视角

Diffusion 有多种等价或相近的理解方式。其中一个重要视角是 score matching。

![Score function view](lec15_materials/score_function_view.png)

对任意分布 \(p(x)\)，score function 定义为

$$
s(x)=\frac{\partial}{\partial x}\log p(x).
$$

Score 是一个指向更高概率密度区域的向量场。Diffusion models 可以理解为在不同噪声等级下学习 score function。

另一个视角把 diffusion 写成 stochastic differential equation：

$$
dx=f(x,t)dt+g(t)dw.
$$

它描述数据 \(x\)、时间 \(t\)、噪声 \(w\) 的无穷小变化。模型学习一个神经近似来反转或求解这个过程。

:::tip 概念捷径
DDPM、score-based models 和 SDE formulations 看起来不同，但核心思想相同：学习如何把 noisy samples 移回 data distribution。
:::

## 6. Flow Matching：直接学习 Vector Field

Flow matching 提供了另一种生成建模路线。它不显式依赖 diffusion posterior，而是构造一条从 data 到 noise 的路径，并训练模型预测路径上的 velocity。

![Flow matching training](lec15_materials/flow_matching_training.png)

采样

$$
z\sim p_{\text{noise}},\quad x\sim p_{\text{data}},\quad t\sim \mathrm{Uniform}[0,1].
$$

定义直线插值和目标速度：

$$
x_t=(1-t)x+tz,\qquad v=z-x.
$$

训练目标为

$$
L=\|f_\theta(x_t,t)-v\|_2^2.
$$

采样从噪声开始，沿学习到的 vector field 反向走：

![Flow matching sampling](lec15_materials/flow_matching_sampling.png)

$$
v_t=f_\theta(x_t,t),\qquad x\leftarrow x-\frac{v_t}{T}.
$$

核心采样循环可以非常短：初始化随机噪声，在每个时间点计算 velocity field，然后更新 sample。

:::remark 关键问题与解答：Flow matching 和 DDPM 有什么不同？
**问题（原意复述）：** Flow matching 只是换了符号的 DDPM 吗？

**解答：** 不是。DDPM 通常从概率加噪过程和反向 posterior 推导；flow matching 直接回归一个把 noise transport 到 data 的 vector field。二者都可以迭代生成样本，但训练目标和推导方式不同。
:::

## 7. Generalized Flow 与 Generalized Diffusion

Generalized flow 把 rectified flow、diffusion 和 score-based models 统一到一个框架中。

![Generalized flow model](lec15_materials/generalized_flow_model.png)

不再固定使用 \(x_t=(1-t)x+tz\)，而是定义

$$
x_t=a(t)x+b(t)z.
$$

目标也可以是一般线性组合：

$$
y_{gt}=c(t)x+d(t)z,\qquad
y_{\text{pred}}=f_\theta(x_t,t),
$$

损失为

$$
\mathcal{L}=\|y_{gt}-y_{\text{pred}}\|_2^2.
$$

Rectified flow 是其中一个特例：

$$
a(t)=1-t,\qquad b(t)=t,\qquad c(t)=-1,\qquad d(t)=1.
$$

Diffusion 和 score-based models 也可以放进这个模板。Variance preserving 和 variance exploding schedule 分别使用：

$$
a_{\mathrm{VP}}(t)=\sqrt{\sigma(t)},\quad b_{\mathrm{VP}}(t)=\sqrt{1-\sigma(t)},\qquad
a_{\mathrm{VE}}(t)=1,\quad b_{\mathrm{VE}}(t)=\sigma(t).
$$

![Generalized diffusion prediction targets](lec15_materials/generalized_diffusion_prediction_targets.png)

不同 target choice 会得到熟悉的预测形式：

$$
y_{gt}=x\quad(x\text{-prediction}),\qquad
y_{gt}=z\quad(\epsilon\text{-prediction}),\qquad
y_{gt}=b(t)z-a(t)x\quad(v\text{-prediction}).
$$

:::remark 关键问题与解答：Generalized diffusion 的意义是什么？
**问题（原意复述）：** 为什么要引入 \(a(t),b(t),c(t),d(t)\)，而不是只讲 DDPM？

**解答：** 它说明很多现代生成模型的差异主要来自 interpolation path 和 prediction target。这样可以在同一框架下比较 DDPM、score-based models、rectified flow、\(x\)-prediction、\(\epsilon\)-prediction 和 \(v\)-prediction。
:::

## 8. Latent Diffusion Models

Pixel-space diffusion 很贵，因为图像像素数量巨大。Latent Diffusion Models 先把图像压缩到低维 latent space，在 latent 上做 diffusion，再把最终 latent decode 回像素。

![Latent diffusion pipeline](lec15_materials/latent_diffusion_pipeline.png)

一个常见设置是

$$
256\times256\times3 \to 32\times32\times16.
$$

基本流程是：

1. 训练 encoder 和 decoder，把图像转换成 continuous latents。
2. 训练 diffusion model 去除 latent 中的噪声。
3. 推理时采样随机 latent，迭代 denoise，再用 decoder 得到图像。

![Modern LDM pipeline](lec15_materials/modern_ldm_pipeline.png)

Autoencoder 训练并不简单。VAE-style objective 能提供概率 latent space，但 decoder 输出可能偏模糊；GAN-style discriminator 可以提升感知锐度。现代 LDM pipeline 往往结合 **VAE + GAN + diffusion**。

:::remark 关键问题与解答：为什么在 latent space 做 diffusion？
**问题（原意复述）：** 为什么不直接在 pixels 上运行 diffusion？

**解答：** Latent space 比 pixel space 小得多，因此 denoising 更便宜，也更容易使用更大的模型或更多采样步。decoder 再把干净 latent 转换成高分辨率图像。
:::

## 9. Conditional Diffusion、DiT 与应用

Conditional diffusion 与 unconditional diffusion 几乎相同，只是模型额外接收条件 \(y\)，例如文本、类别标签、分割图、深度图或姿态。

**关键句（讲义原话）：** **"Almost the same as unconditional diffusion!"**

模型从

$$
\epsilon_\theta(x_t,t)
$$

变为

$$
\epsilon_\theta(x_t,y,t),
$$

损失变为

$$
\mathbb{E}_{x_t,y,t}
\left[\|\epsilon-\epsilon_\theta(x_t,y,t)\|^2\right].
$$

一种常见 condition schema 是 **Cross attention**：

![Condition cross attention](lec15_materials/condition_cross_attention.png)

$$
Q=W_Q\varphi_i(x_t),\qquad
K=W_K\tau_\theta(y),\qquad
V=W_V\tau_\theta(y).
$$

其中，\(y\) 是 condition signal，\(\tau_\theta\) 是 domain-specific encoder，例如 text encoder；\(\varphi_i(x_t)\) 是 signal to be denoised。直观地说，noisy latents 通过 \(Q\) 提问，condition 通过 \(K,V\) 提供信息。

Diffusion Transformer (DiT) 用 transformer blocks 替代 U-Net-style denoiser。核心问题变成：如何注入 timestep、text 等 conditioning。常见方式包括 predict scale/shift、cross-attention 和 joint attention。

Text-to-image 系统通常在 latent space 中使用这套流程：

![Text-to-image diffusion transformer](lec15_materials/text_to_image_diffusion_transformer.png)

图像生成例子中的尺寸为

$$
128\times128\times16 \to 1024\times1024\times3,\qquad
2\times2\text{ patchify}\Rightarrow64\times64=1024\text{ image tokens}.
$$

Text-to-video 会把 latent 进一步扩展到时间维：

![Text-to-video diffusion transformer](lec15_materials/text_to_video_diffusion_transformer.png)

视频生成例子中的尺寸为

$$
32\times128\times72\times16 \to 257\times1024\times576\times3,\qquad
1\times2\times2\text{ patchify}\Rightarrow76K\text{ tokens}.
$$

**关键句（讲义原话）：** **"Conditional generation is of great importance!"**

应用包括 text-to-image、spatial control、image editing、personalization、text-to-3D、text-to-music 和 text-to-video。

:::tip 关键比较：condition injection methods
Cross-attention 很适合文本条件，因为生成 latent 可以 attend 到 text tokens。Scale/shift conditioning 更轻量，常用于 timestep 或 class conditioning。Joint attention 更对称地处理 image/text tokens，但通常更贵。
:::

## 10. Summary and Exam Review

本讲最后把 diffusion 放回生成模型整体图景中：

![Generative models overview](lec15_materials/generative_models_overview.png)

整体脉络是：

- GANs 通过 adversarial discriminator 学习生成。
- VAEs 学习 latent-variable likelihood lower bound。
- DDPMs 学习反转一个固定加噪过程。
- Score/SDE 视角把 denoising 理解为跟随梯度或求解随机动力学。
- Flow matching 学习从 noise 到 data 的 vector field。
- LDMs 通过在 latent space 操作，让 diffusion 变得高效。
- Conditional diffusion 把生成建模变成可控生成。

### Exam Review

高价值定义：

- **Forward diffusion process:** 固定 Markov chain，逐步向数据加入 Gaussian noise。
- **Reverse denoising process:** 学习到的链，通过 Gaussian reverse transitions 把噪声映射回数据。
- **DDPM simplified objective:** 训练网络预测 timestep \(t\) 中加入 \(x_0\) 的噪声。
- **Score function:** \(s(x)=\nabla_x\log p(x)\)，指向更高概率密度区域的 vector field。
- **Flow matching:** 学习一个 velocity field，把样本从 noise distribution transport 到 data distribution。
- **Latent diffusion:** 在压缩 latent space 中做 diffusion，再 decode 回 pixels。
- **Conditional diffusion:** 在条件 \(y\) 的引导下 denoise，例如文本或空间控制。

简答题模板：

- 如果问 diffusion 为什么有效：固定前向过程产生已知 noisy examples，神经反向过程学习逐步去噪。
- 如果问 DDPM 为什么预测 noise：训练时真实噪声已知，并且 posterior mean 可以用该噪声表示。
- 如果问 DDPM 和 flow matching 的区别：DDPM 是概率加噪过程下的 posterior matching；flow matching 直接回归从 data 到 noise 路径上的 vector field。
- 如果问 latent diffusion 为什么高效：它先降低空间分辨率和表示维度，再做 denoising，最后用 decoder 恢复高分辨率 pixels。
- 如果问文本条件如何进入 diffusion：text encoder 产生 condition tokens，denoiser 通过 cross-attention 或其他 conditioning layers 引导去噪。

常见误区：

- 不要说 forward diffusion process 是学习出来的；它由 noise schedule 固定。
- 不要混淆 \(\beta_t\)、\(\alpha_t\)、\(\bar{\alpha}_t\)。\(\beta_t\) 是噪声方差，\(\alpha_t=1-\beta_t\)，\(\bar{\alpha}_t\) 是累乘。
- 不要说模型在 inference 时知道 \(x_0\)。它只有 \(x_t\)、timestep \(t\) 和可选条件 \(y\)。
- 不要把 latent diffusion 当成完全不同的 objective；它通常是在 latent space 中应用同样的 denoising 思路。
- 不要以为 conditional diffusion 只适用于 text-to-image。条件可以是文本、类别、深度、姿态、分割、音频或其他模态。

自检清单：

- 你能从一步 Gaussian kernel 推导出 \(q(x_t\mid x_0)\) 吗？
- 你能解释为什么 \(q(x_{t-1}\mid x_t,x_0)\) 是 Gaussian 吗？
- 你能推导为什么 \(\|\mu_\theta-\tilde{\mu}_t\|^2\) 会化为 noise-prediction MSE 吗？
- 你能写出 flow matching 的训练目标和采样更新吗？
- 你能解释 generalized diffusion 中 \(a(t),b(t),c(t),d(t)\) 各自的作用吗？
- 你能解释为什么 text-to-video 比 text-to-image 需要多得多的 tokens 吗？
