# Lecture 7: Deep Learning IV (Residual Learning, Backbone Design, and Semantic Segmentation)

## 1. Why Very Deep Plain CNNs Fail in Practice

A core training puzzle in this lecture is the degradation problem.

![Deep plain CNN degradation (20-layer vs 56-layer)](lec07_materials/cnn_depth_degradation_train_test_error.png)

When we keep stacking layers in a **plain** CNN (no skip connection), a deeper model can perform worse on both train and test sets. This is not the classic overfitting pattern. It is mainly an optimization problem.

:::remark Key question and answer: deeper plain network
**Question (original wording):** **"What happens when we continue stacking deeper layers on a ‘plain’ convolutional neural network?"**

**Answer:** Optimization becomes much harder. A deeper plain network can get higher training error than a shallower one, so depth alone does not guarantee better learning.
:::

:::tip Key question and answer: baseline construction
**Question (original wording):** **"What should the deeper model learn to be at least as good as the shallower model?"**

**Answer:** At minimum, new layers should learn identity behavior so the deep model can reproduce the shallower solution before learning additional improvements.
:::

## 2. Residual Learning and Why Skip Connections Work

Residual learning changes the target from directly fitting $H(x)$ to fitting the residual $F(x)$:

$$
H(x)=F(x)+x,
\qquad
H(x)=x\;\text{if}\;F(x)=0
$$

![Residual block and identity mapping](lec07_materials/residual_block_skip_connection.png)

This design gives a safe optimization path: if new layers are not useful yet, the block can still pass identity.

From optimization geometry, skip connections also tend to produce flatter minima and reduce chaotic training behavior in very deep networks.

![Loss landscape with and without skip connections](lec07_materials/loss_landscape_with_without_skip.png)

## 3. Generalization Gap and the Overfitting View

**Key definition (lecture wording):** **"Generalization gap: the difference between a model's performance on training data and its performance on unseen data drawn from the same distribution."**

![Generalization gap and early stopping intuition](lec07_materials/generalization_gap_early_stopping.png)

Important distinctions:

- Underfitting on train set is often caused by insufficient capacity or poor optimization.
- Overfitting on test set is usually caused by mismatch between data variability and model capacity.
- Early stopping helps prevent the late-stage expansion of the train/validation gap.

:::remark Key question and answer: essence of overfitting
**Question (original intent):** Why can a model with many parameters still fail on unseen data?

**Answer:** It can absorb residual variation (noise) as if it were true structure. The fix is to reduce model-data mismatch rather than only chasing lower training loss.
:::

## 4. Data-Centric Mitigation: Variation and Augmentation

Real image classification must handle many variations:

- Pose and deformation
- Viewpoint
- Background
- Illumination
- Occlusion
- Intraclass variation

A good classifier should be invariant or robust to these changes.

:::remark Key question and answer: requirement of a good classifier
**Question (original intent):** Why add augmentation if labels are unchanged?

**Answer:** Augmentation makes training data better approximate real-world variability, so invariances are learned during training instead of being hoped for at test time.
:::

![Data augmentation gallery](lec07_materials/data_augmentation_gallery_examples.png)

Typical augmentation families:

- Geometric: scaling, cropping, flipping, padding, rotation, translation, affine transform.
- Photometric: brightness, contrast, saturation, hue.

Benefits emphasized in the lecture:

- Better prediction accuracy
- Reduced overfitting
- Stronger generalization
- Better class-balance behavior in classification

## 5. Model-Centric Mitigation: Regularization, Dropout, BatchNorm

Regularization adds complexity control to the task objective:

$$
L(W)=\frac{1}{N}\sum_{i=1}^{N}L_i\big(f(x_i,W),y_i\big)+\lambda R(W)
$$

$$
\mathcal{L}=\mathcal{L}_{main}+\lambda R(W)
$$

$$
R(W)=\sum_k\sum_l W_{k,l}^{2},\qquad
R(W)=\sum_k\sum_l |W_{k,l}|,\qquad
R(W)=\sum_k\sum_l \left(\beta W_{k,l}^{2}+|W_{k,l}|\right)
$$

Dropout and BatchNorm are also practical anti-overfitting tools.

:::tip Key question and answer: BatchNorm as regularization
**Question (original intent):** Why can BatchNorm behave like regularization?

**Answer:** It constrains activation statistics and introduces batch-dependent noise during training. This often improves generalization and can reduce reliance on dropout.
:::

## 6. How to Analyze and Evolve Classification Backbones

The lecture gives four evaluation axes for CNN architectures:

- Expressivity/capacity
- Fitness for the target task
- Optimization properties
- Computation/memory cost

For ImageNet-scale classification, a model must capture both local details and global context.

:::remark Key question and answer: small filters in VGG
**Question (original wording):** **"Why use smaller filters? (3x3 conv)"**

**Answer:** Stacking $3\times 3$ layers increases nonlinearity, keeps receptive-field growth, and can be more parameter-efficient than one large kernel.
:::

![Receptive field of stacked 3x3 layers](lec07_materials/receptive_field_three_3x3_layers.png)

A common comparison in the lecture is:

$$
3\cdot(3^2C^2)\;\text{vs.}\;7^2C^2
$$

Backbone evolution thread:

- AlexNet -> VGG -> ResNet
- Beyond ResNet: WideResNet, ResNeXt, DenseNet, SENet
- Efficiency-oriented families: MobileNet
- Automated design: NAS (neural architecture search)

:::tip Key question and answer: NAS motivation
**Question (original wording):** **"can we use neural networks to design neural networks?"**

**Answer:** That is the NAS idea: use search/learning to discover architectures, then trade off accuracy, efficiency, and deployment constraints.
:::

## 7. From Image Classification to Semantic Segmentation

**Key definition:** **"Image classification is to categorize an image into several known classes (N)."**

A simple classifier view is:

$$
y=f_\theta(x),\qquad y\in\{1,\dots,N\}
$$

Semantic segmentation moves from one global label to dense per-pixel labeling.

**Key definition (lecture intent):** **"Semantic segmentation is a dense labeling (per-pixel classification) problem."**

A common segmentation objective is pixel-wise cross-entropy:

$$
\mathcal{L}_{CE}=\operatorname{mean}(H(P,Q))=-\operatorname{mean}\left(\sum_{x\in\mathcal{X}}P(x)\log Q(x)\right)
$$

## 8. FCN Pipeline, Bottleneck, and Upsampling

FCN-style segmentation uses an encoder-decoder process:

- Downsampling (pooling / strided conv) for context
- Bottleneck for compact high-level representation
- Upsampling to recover output resolution

![FCN downsampling and upsampling pipeline](lec07_materials/fcn_downsample_upsample_pipeline.png)

### 8.1 Why bottleneck helps

- Lower memory/computation cost
- Larger effective receptive field (better global context)
- Redundant low-level details are compressed

### 8.2 Upsampling mechanisms

Max unpooling uses pooling indices to place activations back.

![Max unpooling mechanism](lec07_materials/max_unpooling_mechanism.png)

Transposed convolution can be interpreted as multiplication by a transposed matrix:

$$
\vec{x}*\vec{a}=X\vec{a}
$$

$$
\begin{bmatrix}
x&y&z&0&0&0\\
0&0&0&x&y&z
\end{bmatrix}
\begin{bmatrix}
0\\a\\b\\c\\d\\0
\end{bmatrix}
=
\begin{bmatrix}
ay+bz\\bx+cy+dz
\end{bmatrix}
$$

$$
\vec{x}*^{T}\vec{a}=X^{T}\vec{a}
$$

$$
\begin{bmatrix}
x&0\\
y&0\\
z&x\\
0&y\\
0&z\\
0&0
\end{bmatrix}
\begin{bmatrix}
a\\b
\end{bmatrix}
=
\begin{bmatrix}
ax\\ay\\az+bx\\by\\bz\\0
\end{bmatrix}
$$

## 9. U-Net: What Should Be Stored in the Bottleneck

The lecture repeatedly asks what information should remain in the bottleneck.

![U-Net with skip connections](lec07_materials/unet_skip_connections_structure.png)

:::remark Key question and answer: bottleneck content
**Question (original wording):** **"What needs to be stored in the bottleneck?"**

**Answer:** Mainly global semantic context. Fine spatial details, especially boundaries, should be recovered through skip links from encoder features at the same resolution.
:::

Auto-encoder intuition behind bottleneck design:

$$
X=\{x\mid x\in\mathbb{R}^{N}\},\quad \hat{x}\in\mathbb{R}^{N},\; z\in\mathbb{R}^{L},\quad N>L
$$

$$
\|x-\hat{x}\|^{2}
$$

## 10. Evaluation Metrics and Alternative Losses for Segmentation

Pixel accuracy is easy but can be misleading for imbalanced classes:

$$
\operatorname{accuracy}=\frac{TP+TN}{TP+TN+FP+FN}
$$

Intersection-over-Union (IoU) is more informative for region overlap:

$$
IoU=\frac{\text{target}\cap\text{prediction}}{\text{target}\cup\text{prediction}}
$$

![IoU visualization](lec07_materials/iou_metric_visualization.png)

Soft IoU turns IoU into a differentiable objective:

$$
IoU=\frac{I(X)}{U(X)},\qquad
I(X)=\sum_{v\in V}X_v*Y_v,\qquad
U(X)=\sum_{v\in V}(X_v+Y_v-X_v*Y_v)
$$

$$
L_{IoU}=1-IoU=1-\frac{I(X)}{U(X)}
$$

![Soft IoU loss formula](lec07_materials/soft_iou_loss_formula.png)

For multi-class segmentation, report class-wise IoU and average it as mIoU.

## Exam Review

### A. Must-know definitions

- **Degradation problem:** deeper plain CNN can have worse optimization behavior, even on training data.
- **Residual learning:** learn $F(x)$ in $H(x)=F(x)+x$.
- **Generalization gap:** train-vs-unseen performance difference under the same data distribution.
- **Semantic segmentation:** dense per-pixel classification.
- **IoU / mIoU:** overlap metric for segmentation quality.

### B. Mechanism chain you should explain clearly

Deep plain nets are hard to optimize -> residual/skip links stabilize optimization -> overfitting controlled by data + model methods -> backbone evolution balances capacity and cost -> FCN/U-Net restore dense predictions -> IoU-family metrics evaluate region overlap.

### C. Short-answer templates

- Why skip links?
  - They provide identity shortcuts and improve optimization in very deep networks.
- Why data augmentation?
  - It injects realistic variation and improves invariance/generalization.
- What should bottleneck store in segmentation?
  - Global context, while boundary details come from skip connections.
- Why IoU instead of only pixel accuracy?
  - IoU penalizes mismatch in overlap and is more robust to class imbalance.

### D. Common mistakes

- Treating deepening as a guaranteed gain without skip links.
- Confusing degradation with pure overfitting.
- Over-augmenting until semantic content is destroyed.
- Using pixel accuracy alone for highly imbalanced segmentation.
- Letting bottleneck memorize all spatial detail instead of using skip paths.

### E. Self-check checklist

- Can you explain why a 56-layer plain net can underperform a 20-layer net on training error?
- Can you derive the residual form $H(x)=F(x)+x$ and interpret the identity case?
- Can you compare geometric vs photometric augmentation with examples?
- Can you explain encoder-decoder + skip-link roles in U-Net?
- Can you compute IoU and describe when mIoU is preferred?
