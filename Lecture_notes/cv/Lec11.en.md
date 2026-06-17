# Lecture 11: Sequential Models - PointNet++, Sparse Convolution, RNNs, and LSTMs

## 1. 3D Deep Learning Roadmap

This lecture connects two themes. The first theme completes the 3D deep learning pipeline: hierarchical point networks, voxel networks, and sparse convolution. The second theme starts sequential models: RNNs, language-model decoding, backpropagation through time, vanishing gradients, and gated recurrent models.

The 3D part asks how to process irregular or sparse geometry without losing the structure that makes the data meaningful. The sequence part asks how to reuse a model over time while preserving enough memory for long-range dependencies.

:::remark Key question and answer: why combine 3D and sequence models?
**Question (original intent):** Why study both 3D networks and recurrent networks in the same lecture?

**Answer:** Both topics are about respecting data structure. Point clouds and sparse voxels require architectures that respect geometry and sparsity. Sequential data requires architectures that respect temporal order and shared dynamics.
:::

## 2. PointNet++: Hierarchical Point Feature Learning

PointNet treats a point cloud as an unordered set and aggregates per-point features with a symmetric operation. That gives permutation invariance, but a single global PointNet does not naturally build local-to-global spatial hierarchy.

**Key idea (lecture wording):** **"Recursively apply pointnet at local regions."**

![PointNet++ basic idea](lec11_materials/pointnetpp_basic_idea.png)

PointNet++ fixes the missing hierarchy by repeatedly grouping nearby points, applying a small PointNet inside each local region, and abstracting the set into coarser point-level features. This creates a point-cloud analogue of CNN feature pyramids:

- Sampling chooses representative centroids.
- Grouping forms local neighborhoods around those centroids.
- A local PointNet maps each neighborhood to a feature vector.
- Repeating this process increases receptive field and semantic abstraction.

The important properties are:

- **Hierarchical feature learning:** local geometry is summarized first, then combined into larger structures.
- **Local translation invariance:** local coordinates make small shifts inside a region less disruptive.
- **Permutation invariance:** each local set is still processed as an unordered set.

![PointNet++ classification](lec11_materials/pointnetpp_classification.png)

For classification, the hierarchy contracts the point set until one global descriptor is formed, then predicts class scores. If a local PointNet emits $C$ feature channels, the feature passed upward may concatenate local geometry with the original coordinates; the lecture explicitly notes $d=3$ because the original $x,y,z$ coordinates are appended to the local geometry feature.

For segmentation, the network must return per-point labels, so it cannot stop at a global descriptor. It uses feature propagation and skip-link concatenation to recover dense point features.

![PointNet++ segmentation](lec11_materials/pointnetpp_segmentation.png)

The upsampling step interpolates features from a coarser set of $N_2$ points to a finer set of $N_1$ points where $N_1>N_2$. Existing coarse points keep their learned features. Other points receive features by 3-nearest-neighbor inverse-distance interpolation, then concatenate original coordinates and the matching skip-link feature from the encoder side.

:::tip Key question and answer: why does segmentation need skip links?
**Question (original intent):** Why is classification allowed to collapse to a global feature, while segmentation needs skip-link concatenation?

**Answer:** Classification predicts one label for the whole shape, so global abstraction is enough. Segmentation predicts a label for every point, so the decoder must recover fine spatial detail; skip links provide high-resolution local information that was lost during downsampling.
:::

## 3. Voxel Networks and Sparse Convolution

A voxel representation converts 3D space into a regular grid. The simplest version stores whether each cell is occupied.

![Voxelization regular grid](lec11_materials/voxelization_regular_grid.png)

A dense 3D CNN can run on such volumetric data, but the cost grows cubically with resolution. A $30\times 30\times 30$ grid already has $27000$ cells, and higher resolutions become expensive quickly. Voxelization also introduces discretization error: points or surfaces must be snapped into grid cells, so geometric detail can be lost.

The key observation is that real 3D shapes and scenes are sparse. Most cells in a high-resolution grid are empty, especially when geometry is concentrated near surfaces.

![Sparse shape occupancy](lec11_materials/sparse_shape_occupancy.png)

Instead of storing and convolving over all voxels, sparse convolution stores only occupied grid cells and constrains computation near the surface.

![Dense convolution vs sparse convolution](lec11_materials/sparse_convolution_dense_vs_sparse.png)

**Sparse convolution** preserves a regular-grid indexing structure while avoiding computation in empty space. Common implementations include SparseConvNet, torchsparse, Minkowski Engine, and spconv.

Compared with dense convolution, sparse convolution has clear advantages:

- Much higher efficiency than dense 3D convolution.
- Regular grid structure supports indexing.
- Similar expressiveness to 2D convolution because kernels are spatially structured.
- Translation equivariance similar to 2D convolution.

The main cost is discretization error: continuous geometry is still represented through a grid.

Sparse convolution and point cloud networks make different tradeoffs.

![Sparse convolution vs point networks](lec11_materials/sparse_conv_vs_point_networks.png)

Sparse convolution is strong when the scene is large and indexing must be efficient. Its kernels are spatially anisotropic and neighbor lookup is fast. However, practical grids are often low-resolution, performance is resolution-dependent, and discretized geometry can be sensitive to geometric transformations.

Point cloud networks are lightweight and can build in some geometric invariance, but farthest point sampling and ball query can be slow, especially for large-scale scenes.

:::warn Common pitfall: sparse does not mean continuous
Sparse convolution removes empty-grid waste, but it is still a voxel method. It improves efficiency; it does not remove discretization error.
:::

## 4. Sequential Data and the Basic RNN

A feed-forward network processes one input independently. A recurrent neural network processes a sequence by carrying a hidden state forward through time.

**Key definition (lecture wording):** **"Recurrent Neural Network: Process Sequential Data."**

At timestep $t$, the RNN receives input $x_t$, combines it with the previous hidden state $h_{t-1}$, and produces a new hidden state $h_t$:

$$
h_t = f_W(h_{t-1}, x_t)
$$

A vanilla RNN uses a single hidden vector as its state:

![Vanilla RNN equations](lec11_materials/vanilla_rnn_equations.png)

$$
h_t = \tanh(W_{hh}h_{t-1}+W_{xh}x_t)
$$

The output is usually computed from the hidden state:

$$
y_t = W_{hy}h_t
$$

The same weight matrix is reused at every timestep. This weight sharing is what lets an RNN handle sequences of variable length while learning one transition rule.

:::remark Key question and answer: what is the hidden state?
**Question (original intent):** What does the RNN hidden state represent?

**Answer:** The hidden state is a learned summary of the past. Ideally, $h_t$ contains all information from $x_1,\ldots,x_t$ that is useful for future outputs. In practice, vanilla RNNs often forget distant information because of gradient-flow problems.
:::

## 5. Computational Graphs, BPTT, and Truncated BPTT

Unrolling an RNN turns recurrence into a deep computation graph along time. The same function $f_W$ appears repeatedly, and the same parameters $W$ are reused at every step.

Training uses **Backpropagation through Time (BPTT)**: run forward through the entire sequence to compute loss, then run backward through the entire unrolled sequence to compute gradients.

![Backpropagation through time](lec11_materials/backpropagation_through_time.png)

If the sequence is long, full BPTT is expensive in memory and computation. **Truncated Backpropagation through Time** runs forward and backward through shorter chunks instead of the whole sequence.

This is a practical compromise:

- It makes training feasible for long streams.
- It limits how far a gradient can directly propagate.
- It trains temporal relations inside a window more strongly than relations across very long spans.

:::tip Key question and answer: why truncate BPTT?
**Question (original intent):** Why not always backpropagate through the entire sequence?

**Answer:** Full BPTT stores activations for every timestep and propagates gradients across the full length, which is expensive and unstable for long sequences. Truncated BPTT reduces cost by optimizing over chunks, but it weakens direct supervision for dependencies longer than the chunk length.
:::

## 6. Character-Level Language Models and Decoding

A character-level language model predicts the next character/token from the sequence seen so far. During sampling, the model feeds its own predicted token back as the next input and repeats the process.

The ideal decoding objective is to find a length-$T$ output sequence with maximum probability:

![Exhaustive search sequence probability](lec11_materials/exhaustive_search_sequence_probability.png)

$$
P(y|x)=P(y_1|x)P(y_2|y_1,x)P(y_3|y_1,y_2,x)\cdots P(y_T|y_1,\ldots,y_{T-1},x)
$$

Equivalently:

$$
P(y|x)=\prod_{t=1}^{T}P(y_t|y_1,\ldots,y_{t-1},x)
$$

Trying every possible sequence is exhaustive search. If the vocabulary size is $V$ and the output length is $T$, the complexity is:

$$
O(V^T)
$$

This is usually impossible, so practical decoding uses approximations.

Greedy sampling always chooses the highest-probability next token. It is deterministic and can generate only one sequence for a fixed initial token and hidden state.

Weighted sampling samples the next token from the predicted probability distribution. It can generate diverse sequences, but it may accidentally sample a low-quality token and derail generation.

Beam search keeps the top $k$ partially generated sequences at each timestep. Here, $k$ is the beam size. Beam search is more efficient than exhaustive search, but it is not guaranteed to find the globally optimal sequence.

:::remark Key question and answer: greedy vs sampling vs beam search
**Question (original intent):** How should a language model choose the next token during generation?

**Answer:** Greedy decoding is stable but lacks diversity. Weighted sampling is diverse but risky. Beam search balances quality and efficiency by tracking multiple high-probability candidates, but it is still approximate.
:::

## 7. Vanishing Gradients and Long-Term Dependencies

Backpropagation through an unrolled vanilla RNN repeatedly multiplies gradients through many timesteps. This can cause gradients to vanish or explode.

**Key question (lecture wording):** **"Why is Vanishing Gradient a Problem?"**

![Vanishing gradient problem](lec11_materials/vanishing_gradient_problem.png)

The issue is that gradient signals from far-away timesteps become much smaller than gradient signals from nearby timesteps. As a result, model weights are updated mostly with respect to near effects, not long-term effects.

A language-model example makes the problem concrete. To predict the final word in a sentence such as "she finally printed her ____", the model may need to remember the word "tickets" from many timesteps earlier. If the gradient from the final loss cannot reach that earlier context, the model cannot learn the dependency.

Vanilla RNNs struggle because the hidden state is constantly overwritten:

$$
h_t=\tanh(W_{hh}h_{t-1}+W_{xh}x_t)
$$

The fix is not merely to make the RNN larger. The architecture needs a more direct path for information and gradients to persist across many timesteps.

:::warn Common pitfall: vanishing gradient is not just a small-model problem
A bigger hidden state increases capacity, but it does not by itself create a stable long-term memory path. The problem is the multiplicative gradient chain through time.
:::

## 8. LSTM: Separate Memory and Dynamic Gates

**Key question (lecture wording):** **"How to Fix the Vanishing Gradient Problem?"**

The lecture frames the main problem as follows: **"it's too difficult for the RNN to learn to preserve information over many timesteps."** In a vanilla RNN, the hidden state is constantly rewritten. LSTM introduces a separate cell state that can be added to instead of fully overwritten.

**Key definition (lecture wording):** **"On step $t$, there is a hidden state $h_t$ and a cell state $c_t$."** The cell state stores long-term information, while the hidden state is the exposed output state.

![LSTM gates](lec11_materials/lstm_gates.png)

The LSTM computes gates and candidate content from the current input and previous hidden state:

$$
\begin{pmatrix} i \\ f \\ o \\ g \end{pmatrix}
=
\begin{pmatrix} \sigma \\ \sigma \\ \sigma \\ \tanh \end{pmatrix}
W
\begin{pmatrix} h_{t-1} \\ x_t \end{pmatrix}
$$

The cell state update is additive:

$$
c_t=f\odot c_{t-1}+i\odot g
$$

The hidden state reads from the cell:

$$
h_t=o\odot\tanh(c_t)
$$

Interpret the gates elementwise:

- $f$ is the forget gate: how much old cell content to keep.
- $i$ is the input/write gate: how much new candidate content to write.
- $o$ is the output/read gate: how much cell content to expose through $h_t$.
- $g$ is candidate content, bounded by $\tanh$.

The lecture emphasizes that gates are dynamic: their values are computed from the current context. Each gate element can be open, closed, or in between.

:::remark Key question and answer: do LSTMs solve vanishing gradients?
**Question (lecture wording):** **"Do LSTMs Solve the Vanishing Gradient Problem?"**

**Answer:** LSTMs make it easier to preserve information over many timesteps, but they do not guarantee that there is no vanishing or exploding gradient. If $f=1$ and $i=0$, a cell can preserve its information indefinitely. This additive memory path gives gradients an easier route than a vanilla RNN's repeated matrix multiplication.
:::

![LSTM answer to vanishing gradients](lec11_materials/lstm_vanishing_gradient_answer.png)

LSTM gradient flow is easier because backpropagation from $c_t$ to $c_{t-1}$ involves elementwise multiplication by $f$, not repeated multiplication by the recurrent matrix $W$. This is conceptually similar to residual connections: additive paths help gradients travel.

## 9. GRU and Other RNN Variants

GRU is another gated recurrent architecture. It is often simpler than LSTM because it does not maintain a separate exposed cell state. The lecture gives the GRU equations:

![GRU equations](lec11_materials/gru_equations.png)

$$
r_t=\sigma(W_{xr}x_t+W_{hr}h_{t-1}+b_r)
$$

$$
z_t=\sigma(W_{xz}x_t+W_{hz}h_{t-1}+b_z)
$$

$$
\tilde{h}_t=\tanh(W_{xh}x_t+W_{hh}(r_t\odot h_{t-1})+b_h)
$$

$$
h_t=z_t\odot h_{t-1}+(1-z_t)\odot\tilde{h}_t
$$

Here, $r_t$ is a reset gate controlling how much past state participates in the candidate state. $z_t$ is an update gate controlling how much of the old state is retained versus replaced by the candidate.

RNN variants all express the same central tradeoff: more gating and memory paths improve long-range learning, but they also add parameters and complexity.

:::tip Key question and answer: LSTM vs GRU
**Question (original intent):** When should we prefer GRU over LSTM?

**Answer:** GRU is usually simpler and can train faster because it has fewer gates and no separate cell state. LSTM offers a more explicit memory pathway and can be more expressive for long dependencies. The best choice is empirical, but both are designed to improve gradient flow compared with vanilla RNNs.
:::

## 10. Exam Review

### 10.1 Definitions to Know

- PointNet++: a hierarchical point network that recursively applies PointNet in local regions.
- Voxelization: conversion of 3D space into a regular occupancy/value grid.
- Sparse convolution: convolution on occupied or active grid cells instead of the full dense volume.
- RNN: a sequence model that reuses the same transition function over timesteps.
- BPTT: training an unrolled RNN by backpropagating through time.
- Truncated BPTT: BPTT over chunks rather than the full sequence.
- Beam search: approximate sequence decoding that keeps the top $k$ partial hypotheses.
- Vanishing gradient: the loss gradient becomes too small when propagated across many timesteps.
- LSTM: an RNN variant with a cell state and dynamic gates for read/write/erase.
- GRU: a gated RNN variant with reset and update gates.

### 10.2 Short-Answer Templates

If asked why PointNet++ improves over PointNet, answer:

PointNet++ preserves PointNet's permutation invariance but adds local neighborhoods and hierarchy. It can learn local geometry first and then aggregate larger structures, which is closer to how CNNs build features from local to global receptive fields.

If asked why sparse convolution is useful, answer:

Dense 3D convolution wastes computation on empty space. Sparse convolution stores only active cells and computes near occupied geometry, so it is much more efficient for sparse 3D shapes and large scenes while still retaining grid indexing.

If asked why vanilla RNNs struggle with long-term dependencies, answer:

The hidden state is repeatedly overwritten, and gradients must pass through many recurrent transitions. Repeated multiplication can shrink gradient signals, so distant causes receive weak learning signals.

If asked how LSTM helps, answer:

LSTM adds a cell state updated by addition, $c_t=f\odot c_{t-1}+i\odot g$. When the forget gate preserves information, gradients can flow along the cell path more directly, making long-distance dependency learning easier.

### 10.3 Formula Checklist

Vanilla RNN:

$$
h_t=\tanh(W_{hh}h_{t-1}+W_{xh}x_t),\qquad y_t=W_{hy}h_t
$$

Sequence probability:

$$
P(y|x)=\prod_{t=1}^{T}P(y_t|y_1,\ldots,y_{t-1},x),\qquad \text{exhaustive search cost }O(V^T)
$$

LSTM:

$$
\begin{pmatrix} i \\ f \\ o \\ g \end{pmatrix}
=
\begin{pmatrix} \sigma \\ \sigma \\ \sigma \\ \tanh \end{pmatrix}
W
\begin{pmatrix} h_{t-1} \\ x_t \end{pmatrix},
\quad
c_t=f\odot c_{t-1}+i\odot g,
\quad
h_t=o\odot\tanh(c_t)
$$

GRU:

$$
r_t=\sigma(W_{xr}x_t+W_{hr}h_{t-1}+b_r),\quad
z_t=\sigma(W_{xz}x_t+W_{hz}h_{t-1}+b_z)
$$

$$
\tilde{h}_t=\tanh(W_{xh}x_t+W_{hh}(r_t\odot h_{t-1})+b_h),\quad
h_t=z_t\odot h_{t-1}+(1-z_t)\odot\tilde{h}_t
$$

### 10.4 Common Mistakes

- Treating PointNet++ as only a deeper PointNet. The key is local grouping and hierarchical abstraction.
- Saying sparse convolution removes voxelization error. It improves efficiency, not continuous geometry fidelity.
- Confusing greedy sampling with beam search. Greedy keeps one path; beam search keeps $k$ paths.
- Saying LSTM completely solves vanishing gradients. It helps, but does not guarantee no vanishing or exploding gradients.
- Forgetting that RNN weights are shared across timesteps.

### 10.5 Self-Check Questions

1. Why does PointNet++ need both sampling and grouping?
2. What is the main computational bottleneck of dense 3D convolution?
3. Why is sparse convolution suitable for large-scale 3D scenes?
4. What does BPTT do that ordinary feed-forward backpropagation does not?
5. Why is exhaustive sequence decoding $O(V^T)$?
6. How does the LSTM cell state create a better gradient path than a vanilla RNN hidden state?
7. What roles do $f$, $i$, $o$, and $g$ play in LSTM?
8. What are the reset and update gates in GRU responsible for?
