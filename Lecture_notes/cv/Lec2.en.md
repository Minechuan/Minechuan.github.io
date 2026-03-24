# Lecture 2: Classic Vision I - Filtering and Edge Detection

## 1. Learning Objectives and Context

This lecture focuses on low-level vision: modeling images as functions, designing filters, and building a robust edge detector.

By the end, you should be able to:

- Explain why an image can be treated as a discrete function.
- Derive moving-average filtering as convolution in 1D and 2D.
- Explain why low-pass filtering improves noise robustness.
- Reconstruct the full Canny pipeline and justify each step.

**Question: "How to detect the lane?"**

A practical answer is to detect reliable edges first, then use geometric constraints (line fitting, region of interest, perspective cues) to extract lane boundaries.

## 2. Images as Functions

An image is a function over spatial coordinates with a finite value range.

$$
f:[a,b]\times[c,d]\rightarrow[0,255]
$$

For color images, the value is a 3D vector:

$$
f(x,y)=\begin{bmatrix}r(x,y)\\g(x,y)\\b(x,y)\end{bmatrix}
$$

![Image as function](lec02_materials/image_as_function_domain_range.png)

In practice, images are sampled on a grid, so we work with integer-indexed pixels and finite-resolution matrices.

## 3. Image Gradient: Why Derivatives Matter

For intensity field $f(x,y)$, the gradient is:

$$
\nabla f=\begin{bmatrix}\frac{\partial f}{\partial x},\frac{\partial f}{\partial y}\end{bmatrix},\quad
\|\nabla f\|=\sqrt{\left(\frac{\partial f}{\partial x}\right)^2+\left(\frac{\partial f}{\partial y}\right)^2}
$$

Numerically, we use finite differences:

$$
\left.\frac{\partial f}{\partial x}\right|_{x=x_0}\approx\frac{f(x_0+1,y_0)-f(x_0-1,y_0)}{2}
$$

![Image gradient definition](lec02_materials/image_gradient_definition.png)

**Question: "What is an edge?"**

An edge corresponds to a local extremum of directional intensity change.

**Definition (Edge):** **An edge is where image intensity changes significantly along one direction while changing little along the orthogonal direction.**

## 4. Linear Filtering and Convolution

### 4.1 From System View to Convolution

A 1D linear filter maps $f[n]$ to $h[n]$:

$$
h=G(f),\quad h[n]=G(f)[n]
$$

Moving average can be written as convolution:

$$
h[n]=(f*g)[n]=\sum_{m=-\infty}^{\infty}f[m]g[n-m]
$$

### 4.2 Frequency-Domain Interpretation

Convolution and Fourier transform pair naturally:

$$
\mathcal{F}(f*g)=\mathcal{F}(f)\mathcal{F}(g)
$$

If $\mathcal{F}(g)$ concentrates near low frequency, $g$ is a low-pass filter, which suppresses high-frequency components (often noise) and produces smoothing.

![Low-pass intuition](lec02_materials/low_pass_filter_frequency_view.png)

:::remark 📝 Question and answer: rectangular filter in frequency domain
**Question:** **"Our filter is indeed a rectangular function. What is its Fourier transform?"**

**Answer:** It becomes a sinc-like spectrum: energy is concentrated around zero frequency with oscillatory sidelobes. This is why moving average behaves as a low-pass filter.
:::

## 5. 2D Filtering and Non-linear Thresholding

For a $3\times3$ moving average:

$$
h[m,n]=\frac{1}{9}\sum_{k=n-1}^{n+1}\sum_{l=m-1}^{m+1}f[k,l]
$$

Equivalent convolution form:

$$
(f*g)[m,n]=\sum_{k,l}f[k,l]g[m-k,n-l]
$$

![2D moving average](lec02_materials/2d_moving_average_formula.png)

Thresholding is a non-linear filter:

$$
h[m,n]=\begin{cases}1,&f[n,m]>\tau\\0,&\text{otherwise}\end{cases}
$$

![Thresholding](lec02_materials/thresholding_nonlinear_filter.png)

:::tip 💡 Question and answer: is thresholding linear?
**Question:** Is thresholding a linear system?

**Answer:** No. It does not satisfy superposition, so it is non-linear.
:::

## 6. Edge Detection Criteria and Causes

Common causes of edges include:

- Depth discontinuity
- Surface orientation discontinuity
- Surface color discontinuity
- Illumination discontinuity

![What causes an edge](lec02_materials/edge_causes_discontinuities.png)

To evaluate a detector, we care about precision, recall, localization, and single response:

$$
\mathrm{Precision}=\frac{TP}{TP+FP},\quad \mathrm{Recall}=\frac{TP}{TP+FN}
$$

## 7. From Gradient to Canny Pipeline

### 7.1 Why Raw Gradient Is Not Enough

**Question:** **"Gradient is non-zero everywhere. Where is the edges?"**

Gradient response alone is too dense and too sensitive to noise.

![Gradient non-zero problem](lec02_materials/gradient_nonzero_everywhere_problem.png)

### 7.2 Smooth First, Then Differentiate

Gaussian smoothing is preferred:

$$
g(x)=\frac{1}{\sqrt{2\pi}\sigma}\exp\!\left(-\frac{x^2}{2\sigma^2}\right),\quad
\mathcal{F}(g)=\exp\!\left(-\frac{\sigma^2\omega^2}{2}\right)
$$

In 2D:

$$
g(x,y)=\frac{1}{2\pi\sigma^2}\exp\!\left(-\frac{x^2+y^2}{2\sigma^2}\right)
$$

Derivative theorem of convolution reduces implementation cost:

$$
\frac{d}{dx}(f*g)=f*\frac{d}{dx}g
$$

### 7.3 Non-Maximal Suppression (NMS)

For each pixel $q$, move along gradient direction to neighbors:

$$
r=q+g(q),\quad p=q-g(q)
$$

Keep $q$ only if:

$$
\text{keep }q\iff g(q)>g(p)\text{ and }g(q)>g(r)
$$

![NMS principle](lec02_materials/nms_principle_grid.png)

Because $p,r$ may be off-grid, use bilinear interpolation.

![Bilinear interpolation](lec02_materials/bilinear_interpolation_geometry.png)

$$
f(x,y_1)=\frac{x_2-x}{x_2-x_1}f(Q_{11})+\frac{x-x_1}{x_2-x_1}f(Q_{21})
$$

$$
f(x,y_2)=\frac{x_2-x}{x_2-x_1}f(Q_{12})+\frac{x-x_1}{x_2-x_1}f(Q_{22})
$$

$$
f(x,y)=\frac{y_2-y}{y_2-y_1}f(x,y_1)+\frac{y-y_1}{y_2-y_1}f(x,y_2)
$$

### 7.4 Hysteresis Thresholding and Edge Linking

Use two thresholds:

- High threshold (`maxVal`) starts confident edges.
- Low threshold (`minVal`) continues connected weak edges.

**Question: "How to decide maxVal and minVal?"**

A practical starting point is to scale both thresholds by the average magnitude after NMS.

Heuristic settings shown in class:

$$
\text{maxVal}=0.3\times\operatorname{avg}(\text{NMS-passed magnitudes}),\quad
\text{minVal}=0.1\times\operatorname{avg}(\text{NMS-passed magnitudes})
$$

![Hysteresis thresholding](lec02_materials/hysteresis_thresholding_rule.png)

Edge linking then grows curves using orientation consistency + low-threshold support + local NMS consistency.

![Edge linking](lec02_materials/edge_linking_growth_logic.png)

:::warn ⚠️ Question and answer: drop-outs
**Question:** **"Drop-outs?"**

**Answer:** Broken edges are repaired by hysteresis linking: a weak pixel is kept if it is connected to strong-edge chains and agrees with local edge direction.
:::

## 8. Tradeoff Between Smoothing and Localization

Larger $\sigma$ gives stronger denoising but blurrier boundaries; smaller $\sigma$ preserves detail but is noise-sensitive.

![Tradeoff](lec02_materials/smoothing_localization_tradeoff.png)

In practice, multi-scale edge detection is often better than committing to one scale.

## 9. Canny Detector: End-to-End Summary

**Key statement:** **The first derivative of Gaussian closely approximates the operator that optimizes the product of signal-to-noise ratio and localization.**

Pipeline:

1. Gaussian smoothing.
2. Gradient magnitude and orientation.
3. Non-maximal suppression.
4. Hysteresis thresholding.
5. Edge linking.

![Canny summary](lec02_materials/canny_pipeline_summary.png)

## Exam Review

### A. Must-know Definitions

- **Image as function:** mapping from spatial domain to intensity/color range.
- **Edge:** strong directional intensity change.
- **Linear filter:** satisfies superposition and is representable by convolution.
- **Hysteresis thresholding:** two-threshold strategy for stable edge continuation.

### B. Mechanism Chain You Should Be Able to Explain

Noise makes raw gradients unreliable -> low-pass (Gaussian) suppresses noise -> derivative extracts transitions -> NMS thins responses -> hysteresis + linking preserve connected true edges.

### C. Short-answer Templates

- Why smooth before edge detection?
  - Because differentiation amplifies high-frequency noise; smoothing improves SNR.
- Why NMS?
  - To convert thick gradient ridges into one-pixel-wide edge candidates.
- Why double thresholds?
  - To keep confident edges while recovering weak but connected segments.

### D. Common Mistakes

- Treating thresholding as a linear operation.
- Using only one threshold and losing connectivity.
- Ignoring interpolation during NMS and causing directional bias.
- Choosing one fixed $\sigma$ without considering scale variation.

### E. Self-check Checklist

- Can you derive moving average as convolution in 1D/2D?
- Can you explain low-pass behavior using $\mathcal{F}(f*g)=\mathcal{F}(f)\mathcal{F}(g)$?
- Can you write NMS logic with $q,p,r$ and compare magnitudes?
- Can you justify threshold ratios and edge-linking criteria?
- Can you explain the smoothing-localization tradeoff with examples?
