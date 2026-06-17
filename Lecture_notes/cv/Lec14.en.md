# Lecture 14: Large Models II - Video Transformers and Multimodal Foundation Models

## 1. From Image Transformers to Video Transformers

Video is not just a larger image. It is a sequence of 2D frames, so a video model must understand both spatial content and temporal change. A short clip can be handled by extending ViT from image patches to video tokens, but the token count grows very quickly.

![Video ViT token count](lec14_materials/video_vit_token_count.png)

For a \(224 \times 224\) frame with \(16 \times 16\) patches:

$$
14 \times 14 = 196 \text{ tokens per image},\qquad
T = 16 \Rightarrow 3136 \text{ tokens}
$$

A longer video becomes much worse:

$$
5 \text{ minutes at } 24\text{ fps} \Rightarrow 1{,}411{,}200 \text{ tokens}
$$

The core difficulty is clear: video adds time, and transformer attention becomes expensive when token count grows.

:::remark Key question and answer: why is vanilla ViT expensive for video?
**Question (original intent):** Why can we not simply apply image-level ViT to every video frame and attend over all tokens?

**Answer:** Because every frame contributes many patch tokens, and self-attention scales quadratically with the number of tokens. Even a short clip can already contain thousands of tokens; long videos become impractical.
:::

## 2. Two Strategies for Efficient Video Transformers

There are two broad ways to make video transformers efficient.

![Video efficiency strategies](lec14_materials/video_efficiency_strategies.png)

- **Modify the attention operator:** keep many tokens, but restrict or factorize how attention is computed.
- **Reduce the number of tokens:** make each token represent a larger spatiotemporal region or shrink intermediate token sequences.

These two ideas are complementary. Divided space-time attention and Video Swin mainly modify attention. Tubelets and MViT reduce token count.

:::tip Key organizing idea
Video efficiency is usually not solved by one trick. A model often needs both better attention structure and fewer tokens.
:::

## 3. Joint, Divided, and Windowed Space-Time Attention

The most direct video attention is joint space-time attention: all spatial and temporal tokens attend together.

![Joint vs divided space-time attention](lec14_materials/joint_vs_divided_attention.png)

**Key idea (lecture wording):** **"We can Divide Time and Space Attention Operators into 2 steps."**

Divided space-time attention first attends along time for the same spatial location, then attends across spatial locations.

![Divided space-time attention](lec14_materials/divided_space_time_attention.png)

During time attention, each token attends to the same spatial location across frames. During space attention, tokens interact within a frame. This reduces cost and gives the model an inductive bias: temporal correspondence and spatial context are handled separately.

Video Swin Transformer takes another route:

![Video Swin Transformer](lec14_materials/video_swin_transformer.png)

**Key idea (lecture wording):** **"Restrict self-attention to small local space-time cubes."**

It is similar to a 3D CNN, but with self-attention inside each local cube. Shifted cubes between layers let information cross cube boundaries.

The slide gives the local token/window example:

$$
T' \times H' \times W' = 8 \times 8 \times 8,\qquad
P \times M \times M = 4 \times 4 \times 4
$$

$$
\#\text{window} = 2 \times 2 \times 2 = 8,\qquad
\#\text{window after shift} = 3 \times 3 \times 3 = 27
$$

:::remark Key question and answer: joint vs divided attention
**Question (original intent):** What is the practical difference between joint space-time attention and divided space-time attention?

**Answer:** Joint attention lets all video tokens interact at once, which is expressive but expensive. Divided attention factorizes the operation into temporal attention and spatial attention, reducing cost while preserving the two key forms of interaction.
:::

:::remark Key question and answer: why use shifted local cubes?
**Question (original intent):** If local windows are efficient, why shift them across layers?

**Answer:** Without shifting, each token mostly communicates inside its own cube. Shifting changes cube boundaries so information can gradually pass between neighboring cubes.
:::

## 4. Reducing Tokens: MViT and Tubelets

The second route is to reduce token count before or during attention.

![MViT key-value pooling](lec14_materials/mvit_key_value_pooling.png)

Multiscale Vision Transformers aggregate and shrink the key and value sequences before computing attention. The slide example reduces a \(56 \times 56\) key/value grid to \(14 \times 14\):

$$
56 \times 56 \rightarrow 14 \times 14
\quad(\text{kernel}=4 \times 4,\ \text{stride}=4)
$$

This keeps queries at a finer scale while keys and values become cheaper to attend to. The effect is a multiscale view: local detail remains available, but attention cost is lower.

![Tubelets reduce tokens](lec14_materials/tubelets_reduce_tokens.png)

**Key question (lecture wording):** **"How to reduce the number of tokens?"**

One answer is **tubelets**. Instead of tokenizing frame-by-frame patches, a tubelet spans both space and time. It is more efficient because a single token represents a spatiotemporal block.

:::remark Key question and answer: why are tubelets more efficient than frame patches?
**Question (original intent):** Why does grouping frames into tubelets reduce video transformer cost?

**Answer:** A tubelet covers multiple frames and spatial pixels at once, so fewer tokens are produced. Fewer tokens directly reduce the size of the attention computation.
:::

## 5. CLIP: Contrastive Image-Text Foundation Models

After video transformers, the lecture moves to foundation models. CLIP is the central example for image-text classification and retrieval.

CLIP learns an image encoder and a text encoder. Matching image-text pairs should have high similarity; mismatched pairs should have low similarity.

![CLIP training objective](lec14_materials/clip_training_objective.png)

Let \(u_i\) be an image embedding and \(v_i\) its paired text embedding. The bidirectional contrastive loss is:

$$
\mathcal{L}_{\mathrm{CLIP}}
=
\sum_{i=1}^{n}
-\log
\left(
\frac{e^{\langle u_i, v_i\rangle}}
{\sum_{j=1}^{n} e^{\langle u_i, v_j\rangle}}
\right)
+
\sum_{i=1}^{n}
-\log
\left(
\frac{e^{\langle u_i, v_i\rangle}}
{\sum_{j=1}^{n} e^{\langle u_j, v_i\rangle}}
\right)
$$

The first term asks each image to pick the correct text. The second asks each text to pick the correct image.

CLIP also enables zero-shot classification:

![CLIP zero-shot categories](lec14_materials/clip_zero_shot_categories.png)

To classify an image, we create text embeddings for category prompts such as "plane", "dog", or "bird", then compare the image vector to those text vectors.

CoCa extends this direction by adding a decoder and a captioning loss.

![CoCa captioning loss](lec14_materials/coca_captioning_loss.png)

The contrastive objective aligns image and text globally; the captioning objective trains generation token by token.

:::remark Key question and answer: why does CLIP support open-vocabulary classification?
**Question (original intent):** Why can CLIP classify categories that were not represented by a fixed classifier head?

**Answer:** Because categories are represented as text embeddings. If the text encoder can encode the category name or prompt, the model can compare an image vector against that text vector without training a new output layer.
:::

## 6. Advantages and Limits of CLIP-Style Models

CLIP-style models are attractive because dot-product retrieval is efficient, training is simple enough to scale, and the learned representation can be reused.

![CLIP-style advantages](lec14_materials/clip_style_advantages.png)

The main advantages are:

- dot product is efficient;
- training is relatively easy and scalable;
- inference supports large-scale retrieval;
- open-vocabulary use gives zero-shot generalization;
- CLIP can be chained with other models.

But CLIP-style global contrast has a serious limitation: it does not necessarily learn compositional structure.

![CLIP compositionality roles](lec14_materials/clip_compositionality_roles.png)

**Key statement (lecture wording):** **"Compositionality here means understanding who plays which role, not just detecting words or objects."**

For event understanding, the same objects and event type may appear in two examples, but agent and target roles can be swapped. A global image-text match may still know that "protester", "police", and "attack" are present without understanding who attacked whom.

One remedy is event-aware hard negatives:

![CLIP event hard negatives](lec14_materials/clip_event_hard_negatives.png)

The idea is to construct negatives that are semantically close but structurally wrong, such as changing the event type or rotating argument roles. This forces the contrastive task to care about event structure, not just object words.

:::warn Key limitation: global contrast is not enough
**Question (original intent):** Why does global image-text contrast fail on event roles?

**Answer:** Because the positive and negative captions may share the same objects and event type. The model must distinguish argument structure, but ordinary batch negatives often do not pressure it to learn that level of composition.
:::

:::tip Key design lesson
Hard negatives are useful when they target the exact failure mode. For compositional language, negatives should differ in roles, relations, order, or event structure, not merely in unrelated object names.
:::

## 7. Chaining Foundation Models for Video: VidIL

Not every multimodal system must train one integrated video-language model. VidIL shows a different pattern: compose existing frozen models.

![VidIL chaining pipeline](lec14_materials/vidil_chaining_pipeline.png)

**Main idea (lecture wording):** **"Make a video promptable by translating it into language descriptors; then let a frozen language model perform few-shot reasoning."**

The pipeline is:

- sample frames from the video;
- use image-language models such as CLIP or BLIP to describe frames;
- convert visual evidence into language descriptors;
- build a few-shot prompt;
- let a frozen LLM generate caption, answer, event label, or retrieval judgment.

Temporal prompts matter because video semantics depend on order.

![Temporal prompts matter](lec14_materials/temporal_prompts_matter.png)

**Key statement (lecture wording):** **"Same words, different order: temporal markers help the LLM distinguish sunset vs. sunrise."**

The result is a surprisingly strong baseline: chaining can work well when the intermediate representation is language.

:::remark Key question and answer: why can chaining work for video tasks?
**Question (original intent):** Why can a frozen LLM solve some video-language tasks without video pretraining?

**Answer:** If visual models translate frames into useful textual descriptors, the task becomes a language reasoning problem. The LLM can then use few-shot prompting to combine objects, events, attributes, captions, and temporal markers.
:::

:::warn Key limitation of chaining
Chaining depends heavily on the quality of intermediate descriptions. If the image-language model misses an action, object, or temporal transition, the LLM may reason fluently from incomplete evidence.
:::

## 8. Integrated Vision-Language Models: LLaVA and Flamingo

Integrated VLMs connect visual features directly to an autoregressive language model.

LLaVA uses the autoregressive nature of LLMs: image features are converted into tokens that the decoder can consume along with text.

![LLaVA architecture and training](lec14_materials/llava_architecture_training.png)

Its recipe is:

- initialize with a pretrained language model decoder and a pretrained image encoder such as CLIP;
- train a new linear layer to bridge CLIP features to the LLM input space;
- finetune the LLM and linear layer together.

Flamingo follows a different recipe.

![Flamingo architecture](lec14_materials/flamingo_architecture.png)

It keeps large pretrained parts frozen, uses a Perceiver Resampler to compress visual features, and inserts gated cross-attention layers into the language model. This enables few-shot multimodal learning with interleaved text and visual inputs.

:::remark Key question and answer: LLaVA vs Flamingo
**Question (original intent):** How do LLaVA and Flamingo differ architecturally?

**Answer:** LLaVA projects image features into the LLM token space with a learned bridge and finetunes the language side. Flamingo keeps more pretrained components frozen and injects visual information through resampled visual tokens and gated cross-attention.
:::

## 9. Data Quality, Dense Captions, and Omni Models

Foundation models depend strongly on data. The lecture contrasts sheer scale with detailed supervision.

![Quality vs quantity tradeoff](lec14_materials/quality_vs_quantity_tradeoff.png)

One side is massive weakly aligned data:

$$
6 \text{ billion image-text pairs} \gg 700\text{k image-text pairs}
$$

The other side is dense, high-quality captions. PixMo-style data is smaller but much more detailed.

![PixMo dense caption example](lec14_materials/pixmo_dense_caption_example.png)

Dense captions describe objects, layout, attributes, relations, and fine spatial details. They are expensive to collect, but they teach capabilities that raw image-text pairs may not provide.

The lecture ends by pointing beyond vision-language models to omni models.

![Omni models beyond vision language](lec14_materials/omni_models_beyond_vision_language.png)

Omni models train one transformer-like system to input and output across text, audio, and video. The direction is no longer just "vision plus language", but general multimodal sequence modeling.

:::remark Key question and answer: quality vs quantity
**Question (original intent):** Is more image-text data always better than detailed caption data?

**Answer:** Not always. Massive data helps scale and coverage, but dense captions provide richer supervision about layout, relations, attributes, and fine-grained semantics. The best system design depends on which capabilities are missing.
:::

## 10. Summary and Exam Review

![VidIL summary diagram](lec14_materials/vidil_summary_diagram.png)

### 10.1 Definitions you should know

- **Video Transformer:** a transformer adapted to video tokens with spatial and temporal structure.
- **Divided space-time attention:** factorized attention that separately models temporal and spatial interactions.
- **Tubelet:** a spatiotemporal token covering multiple frames and spatial patches.
- **CLIP:** an image-text contrastive model that aligns image and text embeddings.
- **CoCa:** a contrastive-captioning model that adds a decoder and captioning loss to image-text foundation modeling.
- **VidIL:** a chaining approach that translates video into language descriptors and uses a frozen LLM for few-shot reasoning.
- **LLaVA:** an integrated VLM that bridges a vision encoder to an LLM decoder.
- **Flamingo:** a VLM that uses visual resampling and gated cross-attention for few-shot multimodal learning.

### 10.2 Short-answer templates

- **Why are video transformers expensive?**  
Video adds a temporal dimension, producing many more tokens; attention cost then grows rapidly with token count.

- **How does divided space-time attention help?**  
It factorizes attention into temporal and spatial steps, reducing cost while preserving both types of interaction.

- **Why does CLIP enable zero-shot classification?**  
Class names can be encoded as text vectors, so classification becomes image-text similarity comparison.

- **Why can CLIP fail at compositionality?**  
Global contrast may recognize objects and event words without learning roles, relations, and order.

- **Why can chaining foundation models work?**  
If visual evidence is converted into language, an LLM can use its language reasoning and few-shot prompting ability.

- **Why do dense captions matter?**  
They teach details about layout, relations, attributes, and spatial structure that weak image-text pairs may omit.

### 10.3 Common pitfalls

- Do not treat video as just a stack of independent images; temporal order matters.
- Do not say CLIP "understands" all language composition just because it matches captions well.
- Do not confuse chaining with end-to-end integrated VLM training.
- Do not assume smaller high-quality data is worse than massive weak data; they teach different capabilities.
- Do not forget that omni models extend beyond vision-language to text, audio, and video input/output.

### 10.4 Self-check questions

- Can you explain the two broad strategies for video efficiency?
- Can you compare joint, divided, and local window space-time attention?
- Can you write and explain the two directions in the CLIP contrastive loss?
- Can you explain why event-aware hard negatives are useful?
- Can you compare VidIL, LLaVA, and Flamingo in one paragraph?
