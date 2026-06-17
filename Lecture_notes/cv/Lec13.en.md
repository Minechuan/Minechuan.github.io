# Lecture 13: Generative Models I

## 1. Generative Models, Discriminative Models, and Conditional Generation

This lecture studies models whose goal is not only to assign labels, but also to represent how data itself is distributed. That is the core shift from discriminative learning to generative learning.

![Generative vs discriminative definitions](lec13_materials/generative_vs_discriminative_definitions.png)

**Key definitions (lecture wording):**

- **Discriminative Model: Learn a probability distribution \(p(y \mid x)\)**
- **Generative Model: Learn a probability distribution \(p(x)\)**
- **Conditional Generative Model: Learn \(p(x \mid y)\)**

The practical distinction is:

- A discriminative model focuses on prediction from input to label.
- A generative model tries to explain how data samples are produced.
- A conditional generative model produces data consistent with a condition such as a class label, text prompt, or another modality.

Generative modeling also connects back to discriminative learning through Bayes' rule:

$$
P(x \mid y) = \frac{P(y \mid x) P(x)}{P(y)}
$$

If we know a likelihood term and a prior, we can form a conditional distribution. This is one reason generative modeling can support downstream inference rather than only synthesis.

:::remark Key question and answer: why learn \(p(x)\) instead of only \(p(y \mid x)\)?
**Question (original intent):** If classification already works with \(p(y \mid x)\), why do we care about learning \(p(x)\)?

**Answer:** Because \(p(x)\) describes the structure of the data itself. Once the model understands how data is distributed, it can support sampling, density estimation, uncertainty modeling, missing-data reasoning, and in some cases even improve conditional inference.
:::

## 2. Why Generative Models Matter

The most important motivation in the lecture is ambiguity. Many tasks do not have one single correct output.

![Why generative models](lec13_materials/why_generative_models_ambiguity.png)

**Key statement (lecture wording):** **"Modeling ambiguity: If there are many possible outputs \(x\) for an input \(y\), we want to model \(P(x \mid y)\)."**

This matters in tasks such as:

- language modeling, where many continuations can be valid;
- text-to-image generation, where one prompt may correspond to many different images;
- image-to-video or world modeling, where the future is inherently uncertain.

A deterministic predictor tends to collapse these possibilities into one average answer. A generative model instead tries to represent the distribution over plausible answers.

:::remark Key question and answer: why are generative models especially useful for multimodal outputs?
**Question (original intent):** Why is generative modeling a better fit when one input can correspond to many valid outputs?

**Answer:** Because the goal is no longer to predict one point estimate. We need a distribution that can capture multiple possible futures, images, or texts. Generative models are designed for exactly that setting.
:::

## 3. A Taxonomy of Generative Models

The lecture organizes generative models by whether the model can explicitly compute a density and by how sampling is performed.

![Generative model taxonomy](lec13_materials/generative_model_taxonomy.png)

The taxonomy in this lecture is:

- **Explicit density, tractable density:** autoregressive models.
- **Explicit density, approximate density:** variational autoencoders (VAE).
- **Implicit density, direct sampling:** generative adversarial networks (GAN).
- **Implicit density, iterative sampling:** diffusion models, to be covered later.

This taxonomy is useful because each family makes a different tradeoff among:

- tractable likelihood;
- sample quality;
- sample diversity or mode coverage;
- training stability;
- inference over latent variables.

:::tip Key organizing idea
If a model gives you a usable \(p(x)\), likelihood-based training is often principled but may be expensive or approximate. If a model gives up explicit density, sampling can become much more direct, but evaluation and training objectives become less straightforward.
:::

## 4. Maximum Likelihood and Autoregressive Models

The lecture first revisits the classical likelihood view of generative modeling.

![Autoregressive factorization](lec13_materials/autoregressive_factorization.png)

We define an explicit density model

$$
p(x) = f(x; W)
$$

and train it by maximum likelihood:

$$
W^* = \arg\max_W \prod_i p(x^{(i)})
$$

For sequence data, the chain rule gives an exact factorization:

$$
p(x) = \prod_{t=1}^{T} p(x_t \mid x_1, x_2, \ldots, x_{t-1})
$$

This is the foundation of autoregressive modeling. The model predicts the next element conditioned on all previous ones.

The same idea powers large language models: a text sequence is factorized token by token. The lecture then extends the same logic to images.

![Autoregressive models of images](lec13_materials/autoregressive_images.png)

An image can be treated as a long sequence of subpixel values. In principle this gives a tractable density and exact likelihood training. In practice, it becomes very expensive because a high-resolution image corresponds to a very long sequence.

:::remark Key question and answer: what is the main strength of autoregressive models?
**Question (original intent):** Why are autoregressive models such a clean generative modeling framework?

**Answer:** Because the chain rule converts the global density \(p(x)\) into a product of conditional terms that can be trained exactly by maximum likelihood. The model has an explicit density and a principled objective.
:::

:::warn Key limitation
Autoregressive image generation is conceptually simple but computationally heavy. Sampling is sequential, and long image sequences make both training and generation expensive.
:::

## 5. From Probabilistic Autoencoders to Variational Autoencoders

A probabilistic autoencoder introduces a latent variable \(z\). Instead of directly modeling \(p(x)\), it assumes data is generated by first sampling \(z\) from a simple prior and then decoding \(z\) into \(x\).

The resulting marginal likelihood is

$$
p_\theta(x) = \int p(z)\, p_\theta(x \mid z)\, dz
$$

This is elegant, but the integral is usually intractable.

The lecture's solution is to learn an approximate posterior:

![Variational encoder](lec13_materials/variational_encoder.png)

$$
q_\phi(z \mid x)
$$

**Key statement (lecture wording):** **"Let's learn a distribution \(q_\phi(z \mid x)\) to approximate \(p_\theta(z \mid x)\)."**

The encoder is no longer deterministic. It outputs parameters of a distribution, usually a Gaussian:

- mean \(\mu_{z \mid x}\)
- covariance \(\Sigma_{z \mid x}\)

This makes VAE a probabilistic autoencoder rather than a standard autoencoder.

:::remark Key question and answer: why is direct training intractable?
**Question (lecture wording / intent):** **"How to train?"** What is the problem with maximizing \(p_\theta(x)\) directly?

**Answer:** Because the latent variable must be marginalized out:
$$
p_\theta(x) = \int p(z)\, p_\theta(x \mid z)\, dz
$$
For high-dimensional latent spaces this integral is generally intractable, so we need an optimization target that is easier to compute.
:::

:::remark Key question and answer: why does naive Monte Carlo fail?
**Question (original intent):** Why not just sample many \(z \sim p(z)\) and estimate the integral directly?

**Answer:** Because most prior samples are irrelevant to the specific data point \(x\). In high dimensions, naive prior samples often land in regions where \(p_\theta(x \mid z)\) contributes almost nothing, so the estimate has terrible efficiency.
:::

## 6. ELBO: the VAE Training Objective

The lecture derives a tractable lower bound on data likelihood.

![VAE ELBO derivation](lec13_materials/vae_elbo_derivation.png)

The key decomposition is:

$$
\log p_\theta(x^{(i)})
=
\mathbb{E}_{z}\left[\log p_\theta(x^{(i)} \mid z)\right]
- D_{KL}\!\left(q_\phi(z \mid x^{(i)}) \,\|\, p(z)\right)
+ D_{KL}\!\left(q_\phi(z \mid x^{(i)}) \,\|\, p_\theta(z \mid x^{(i)})\right)
$$

Since the final KL term is nonnegative, we obtain the Evidence Lower Bound:

$$
\mathcal{L}(x^{(i)}, \theta, \phi)
=
\mathbb{E}_{z}\left[\log p_\theta(x^{(i)} \mid z)\right]
- D_{KL}\!\left(q_\phi(z \mid x^{(i)}) \,\|\, p(z)\right)
\le \log p_\theta(x^{(i)})
$$

So maximizing ELBO approximately maximizes likelihood while encouraging the approximate posterior to stay close to the prior.

Interpretation of the two ELBO terms:

- The reconstruction term encourages the decoder to explain the observed data well.
- The KL term regularizes the latent distribution so it remains structured and sampleable.

The lecture also gives the Gaussian KL formulas used in practice.

![VAE KL between Gaussians](lec13_materials/vae_kl_gaussians.png)

For two Gaussians:

$$
D_{KL}\!\left(\mathcal{N}(\mu_1, \Sigma_1)\,\|\,\mathcal{N}(\mu_2, \Sigma_2)\right)
= \frac{1}{2}\left(
\log \frac{\det \Sigma_2}{\det \Sigma_1}
- d + \mathrm{tr}(\Sigma_2^{-1}\Sigma_1)
+ (\mu_2-\mu_1)^T\Sigma_2^{-1}(\mu_2-\mu_1)
\right)
$$

For the common prior \( \mathcal{N}(0, I) \):

$$
D_{KL}\!\left(\mathcal{N}(\mu, \Sigma)\,\|\,\mathcal{N}(0, I)\right)
= \frac{1}{2}\left(\mathrm{tr}(\Sigma) + \mu^T\mu - d - \log \det \Sigma\right)
$$

If \(\Sigma_{z \mid x}\) is diagonal,

$$
\Sigma_{z \mid x} = \mathrm{diag}(\sigma_1^2, \ldots, \sigma_d^2)
$$

then

$$
D_{KL} = \frac{1}{2}\sum_{j=1}^{d} \left(\sigma_j^2 + \mu_j^2 - 1 - \log \sigma_j^2\right)
$$

:::remark Key question and answer: why is ELBO enough?
**Question (original intent):** If ELBO is only a lower bound, why do we optimize it?

**Answer:** Because it is tractable, differentiable, and tied directly to likelihood. Maximizing ELBO both improves data reconstruction and reduces the gap between the approximate posterior and the true posterior.
:::

## 7. Reparameterization, VAE Training, and VAE Behavior

The next obstacle is backpropagation through sampling.

![Reparameterization trick](lec13_materials/reparameterization_trick.png)

The lecture uses the reparameterization trick:

$$
\epsilon \sim \mathcal{N}(0, I),\qquad
z = \mu_{z \mid x} + \epsilon \sigma_{z \mid x}
$$

This moves randomness into \(\epsilon\), while keeping \(\mu_{z \mid x}\) and \(\sigma_{z \mid x}\) inside a differentiable computation graph.

The resulting training pipeline is:

![VAE training pipeline](lec13_materials/vae_training_pipeline.png)

- encode \(x\) into \(\mu_{z \mid x}\) and \(\Sigma_{z \mid x}\);
- sample \(z\) with reparameterization;
- decode \(z\) into a distribution over \(\hat{x}\);
- optimize ELBO by forward pass and backpropagation.

At sampling time, we ignore the encoder and simply draw \(z \sim p(z)\), then decode.

The lecture also gives several insights about VAE behavior:

- VAEs are usually stable to train.
- They support latent inference naturally because an encoder is learned.
- They often produce blurry images, especially with simple likelihood assumptions such as per-pixel Gaussian decoding.
- They usually cover more modes of the data distribution than GANs.

:::remark Key question and answer: why does the reparameterization trick work?
**Question (lecture wording / intent):** **"How to backprop through \(z\)?"**

**Answer:** We rewrite sampling as a deterministic transformation of noise:
$$
z = \mu_{z \mid x} + \epsilon \sigma_{z \mid x},\qquad \epsilon \sim \mathcal{N}(0, I)
$$
Now gradients flow through \(\mu\) and \(\sigma\), while stochasticity is isolated in \(\epsilon\).
:::

:::remark Key question and answer: why are VAE images often blurry?
**Question (original intent):** What causes the blurry appearance that VAEs often show in image generation?

**Answer:** The decoder is trained to maximize expected likelihood under a smooth probabilistic reconstruction model. When several outputs are plausible, the model tends to average them in pixel space, which washes out sharp details.
:::

:::remark Key question and answer: why is it called "variational"?
**Question (lecture wording / intent):** Why is this probabilistic autoencoder called **"variational"**?

**Answer:** Because it comes from variational inference. We choose an approximate posterior family \(q_\phi(z \mid x)\) and optimize over that family to get the best approximation to the true posterior. The word "variational" refers to optimizing over distributions or functions.
:::

## 8. GANs: implicit generation through adversarial training

GANs take a different route. Instead of explicitly modeling a likelihood, they learn to generate samples that fool a discriminator.

The lecture motivates GANs by asking what happens if we give up explicit density modeling and only care about sampling.

The standard minimax game is:

![GAN saturating loss](lec13_materials/gan_saturating_loss.png)

$$
\min_{\theta_g}\max_{\theta_d}
\left[
\mathbb{E}_{x \sim p_{data}} \log D_{\theta_d}(x)
+ \mathbb{E}_{z \sim p(z)} \log\!\left(1 - D_{\theta_d}(G_{\theta_g}(z))\right)
\right]
$$

The discriminator tries to distinguish real from fake. The generator tries to produce fake samples that the discriminator cannot reject.

The lecture emphasizes that the original generator objective can saturate. If the generated sample is obviously bad, the gradient signal from

$$
\min_{\theta_g}
\mathbb{E}_{z \sim p(z)} \log\!\left(1 - D_{\theta_d}(G_{\theta_g}(z))\right)
$$

can become weak.

So in practice people usually use the non-saturating generator objective:

![GAN non-saturating loss](lec13_materials/gan_non_saturating_loss.png)

$$
\max_{\theta_g}
\mathbb{E}_{z \sim p(z)} \log\!\left(D_{\theta_d}(G_{\theta_g}(z))\right)
$$

This keeps the same goal of fooling the discriminator, but provides stronger gradients when generated samples are still poor.

The lecture also highlights DCGAN-style architectural guidelines:

![DCGAN architecture guidelines](lec13_materials/dcgan_architecture_guidelines.png)

- use strided convolutions instead of pooling in the discriminator;
- use fractionally strided convolutions in the generator;
- use batch normalization in both networks;
- remove fully connected hidden layers in deeper image architectures;
- use ReLU in the generator except the output;
- use LeakyReLU in the discriminator.

:::remark Key question and answer: what is the conceptual difference between VAE and GAN training?
**Question (original intent):** If both models generate data, what is the main training difference?

**Answer:** VAE optimizes a likelihood-related objective through ELBO. GAN does not optimize an explicit density; it learns through a two-player adversarial game between generator and discriminator.
:::

:::warn Key issue: why is GAN training unstable?
**Question (original intent):** Why are GANs powerful but hard to train?

**Answer:** Because the objective depends on a moving opponent. The generator's gradients depend on the current discriminator, and the discriminator's behavior depends on the current generator. This coupled optimization can lead to instability, vanishing gradients, oscillation, or mode collapse.
:::

## 9. GAN Evaluation and VAE vs. GAN

Since GANs do not provide a clean likelihood objective, evaluation becomes especially important.

The lecture introduces Fréchet Inception Distance (FID).

![FID formula](lec13_materials/fid_formula.png)

Generated and real images are embedded into a feature space, often using an Inception network. Their feature distributions are approximated as Gaussians with means and covariances \((\mu_r, \Sigma_r)\) and \((\mu_g, \Sigma_g)\). Then

$$
\mathrm{FID}(r, g)
= \|\mu_r - \mu_g\|_2^2
+ \mathrm{Tr}\!\left(\Sigma_r + \Sigma_g - 2(\Sigma_r \Sigma_g)^{\frac{1}{2}}\right)
$$

Lower FID means the generated distribution is closer to the real one in that feature space.

The lecture ends with a direct comparison:

![VAE vs GAN](lec13_materials/vae_vs_gan_coverage_vs_realism.png)

- **VAE:** better mode coverage, latent inference, more stable training, approximate likelihood, but often blurrier samples.
- **GAN:** sharper and more realistic samples, no explicit likelihood, weaker latent inference in standard form, risk of mode collapse, and more unstable training.

The lecture's key takeaway is:

- VAE tends to optimize **coverage**.
- GAN tends to optimize **realism**.

:::remark Key question and answer: should lower FID always be treated as "better"?
**Question (original intent):** What does FID really measure, and what should we be careful about?

**Answer:** FID measures distributional closeness in a learned feature space, not semantic perfection. It is useful, but it is still only one proxy. Visual inspection, diversity checks, and task-specific evaluation may still matter.
:::

## 10. Exam Review

### 10.1 Definitions you should know

- **Generative model:** models a distribution over data, typically \(p(x)\) or \(p(x \mid y)\).
- **Discriminative model:** models a distribution over labels conditioned on data, typically \(p(y \mid x)\).
- **Autoregressive model:** factorizes \(p(x)\) into a product of sequential conditional probabilities.
- **VAE:** a latent-variable generative model trained by maximizing ELBO.
- **GAN:** an implicit generative model trained adversarially with a generator and discriminator.
- **ELBO:** a tractable lower bound on log-likelihood.
- **FID:** a feature-space distance between generated and real data distributions.

### 10.2 Mechanisms and comparisons

- Autoregressive models have explicit tractable likelihood, but slow sequential sampling.
- VAE has latent inference and stable training, but often sacrifices image sharpness.
- GAN gives strong visual realism, but no explicit density and less stable optimization.
- VAE is an approximate-density model; GAN is an implicit-density model.

### 10.3 Short-answer templates

- **Why generative models?**  
They model uncertainty and ambiguity, especially when one input can correspond to many valid outputs.

- **Why is VAE training intractable without approximation?**  
Because \(p_\theta(x)\) requires integrating over latent variables, which is generally intractable in high dimensions.

- **Why use ELBO?**  
Because it is a differentiable lower bound on \(\log p_\theta(x)\) that decomposes into reconstruction and KL regularization terms.

- **Why use the reparameterization trick?**  
Because direct sampling blocks gradient flow, while \(z=\mu+\epsilon\sigma\) keeps the graph differentiable.

- **Why use non-saturating GAN loss?**  
Because it gives stronger gradients to the generator when generated samples are poor.

- **How do VAE and GAN differ?**  
VAE prioritizes likelihood-based coverage and inference; GAN prioritizes adversarial realism and sample sharpness.

### 10.4 Common pitfalls

- Do not say a standard GAN provides tractable \(p(x)\); it does not.
- Do not confuse the true posterior \(p_\theta(z \mid x)\) with the approximate posterior \(q_\phi(z \mid x)\).
- Do not forget that ELBO is a lower bound, not the exact log-likelihood.
- Do not describe FID as pure pixel distance; it is computed in a learned feature space.
- Do not assume sharp samples imply full mode coverage.

### 10.5 Self-check questions

- Can you explain the difference between explicit and implicit density models?
- Can you derive the autoregressive factorization from the chain rule?
- Can you state the two ELBO terms and explain what each one does?
- Can you explain reparameterization without confusing randomness and parameters?
- Can you explain why GANs often look sharper but may miss modes?
