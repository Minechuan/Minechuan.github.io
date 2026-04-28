# Lecture 8: Object Detection and Instance Segmentation

## 1. Improving FCN: What to Keep in the Bottleneck

![FCN bottleneck question](lec08_materials/fcn_bottleneck_question.png)

A segmentation encoder-decoder should not force the bottleneck to memorize everything. The design goal is to keep high-level semantics in deep layers, while routing fine boundary details through skip connections.

:::remark Key question and answer: bottleneck content
**Question (original wording):** **"What needs to be stored in the bottleneck?"**

**Answer:** Keep global context in the bottleneck. Recover precise boundaries through encoder-decoder skip links.
:::

![UNet skip link and bottleneck role](lec08_materials/unet_skip_link_bottleneck.png)

Modern dense prediction backbones scale this idea in different ways:

- DeepLabV3 emphasizes multi-scale context aggregation.
- UperNet unifies feature pyramid fusion with multiple prediction heads.

![DeepLabV3 design variants](lec08_materials/deeplabv3_dense_prediction_designs.png)

![UperNet multi-head dense prediction](lec08_materials/upernet_multi_head_dense_prediction.png)

## 2. Segmentation Metrics: Accuracy, IoU, Soft IoU, mIoU

For one semantic class, pixel accuracy is easy to compute:

$$
\mathrm{accuracy}=\frac{TP+TN}{TP+TN+FP+FN}
$$

But this metric can be biased when the class occupies very few pixels.

:::tip Key question and answer: when accuracy misleads
**Question (original intent):** When can pixel accuracy be misleading in segmentation?

**Answer:** When negatives dominate the image, high accuracy may mostly reflect predicting background correctly, not segmenting the target class well.
:::

IoU is the overlap-focused metric:

$$
IoU=\frac{\text{target}\cap\text{prediction}}{\text{target}\cup\text{prediction}}
$$

![IoU visualization](lec08_materials/iou_visualization.png)

A differentiable variant used for training is Soft IoU:

$$
IoU=\frac{I(X)}{U(X)}
$$

$$
I(X)=\sum_{v\in V}X_vY_v,
\qquad
U(X)=\sum_{v\in V}(X_v+Y_v-X_vY_v)
$$

$$
L_{IoU}=1-IoU=1-\frac{I(X)}{U(X)}
$$

![Soft IoU loss formula](lec08_materials/soft_iou_loss_formula.png)

For multi-class segmentation, report class-wise IoU and average them as mIoU.

## 3. Object Detection as Localization + Classification

**Key definition (lecture wording):** **"Task: localization + classification"**.

For axis-aligned 2D detection, the box has 4 DoF:

$$
\text{bbox}=(x,y,h,w),\quad \text{DoF}=4
$$

![Single object bbox parameterization](lec08_materials/single_object_bbox_parameterization.png)

:::remark Key question and answer: box parameterization
**Question (original wording):** **"How many degree-of-freedom?"** and **"How to parameterize such a bounding box?"**

**Answer:** Four degrees of freedom, typically parameterized as $(x,y,h,w)$ (or equivalent center-size forms).
:::

Box regression predicts offsets:

$$
\Delta=(\Delta x,\Delta y,\Delta w,\Delta h)
$$

Common losses:

$$
L_1=\sum_i|\Delta_i|,
\quad
L_2=\sum_i\Delta_i^2,
\quad
RMSE=\sqrt{\frac{1}{N}\sum_i\Delta_i^2}
$$

![Bounding-box regression losses](lec08_materials/bbox_regression_losses_overview.png)

Smooth L1 is a practical compromise used in Fast/Faster R-CNN:

$$
L_2(x)=x^2,
\qquad
L_1(x)=|x|
$$

$$
\operatorname{smooth}_{L1}(x)=
\begin{cases}
0.5x^2,& |x|<1 \\
|x|-0.5,& \text{otherwise}
\end{cases}
$$

![Smooth L1 vs L1/L2](lec08_materials/smooth_l1_vs_l1_l2.png)

## 4. Multi-Object Detection Evolution

The core challenge is that different images contain different numbers of objects, so output size is not fixed.

A historical path:

1. Sliding window over many locations/scales.
2. Region proposal methods (Selective Search).
3. R-CNN family with learned feature extraction and box classification/regression.

![Selective Search region proposals](lec08_materials/selective_search_region_proposals.png)

R-CNN improved accuracy but had major bottlenecks: too many per-region forward passes and weak context in cropped regions.

![R-CNN limitations](lec08_materials/rcnn_limitations_speed_and_context.png)

Fast R-CNN shares one backbone feature map per image and crops region features from it.

![Fast R-CNN shared backbone](lec08_materials/fast_rcnn_shared_backbone.png)

RoI Pool converts variable-size proposals into fixed-size features.

![RoI Pool feature cropping](lec08_materials/roi_pool_feature_cropping.png)

Faster R-CNN inserts RPN to generate proposals from features directly.

![Faster R-CNN with RPN](lec08_materials/faster_rcnn_with_rpn.png)

## 5. Two-Stage and Single-Stage Pipelines

![Two-stage detector question](lec08_materials/two_stage_detector_question.png)

:::remark Key question and answer: second stage necessity
**Question (original wording):** **"Do we really need the second stage?"**

**Answer:** The second stage improves per-proposal classification and box refinement quality. Removing it usually improves speed but may hurt localization/classification accuracy.
:::

Two-stage inference logic:

- Stage 1: backbone features + RPN proposals (often around 300 proposals).
- Stage 2: per-proposal classification/refinement, confidence filtering, and NMS.

Single-stage detectors (YOLO/SSD/RetinaNet) predict directly on dense locations:

$$
(dx,dy,dh,dw,\text{confidence})
$$

$$
\text{output}=7\times 7\times(5B+C)
$$

![Single-stage output tensor](lec08_materials/single_stage_detector_output_tensor.png)

NMS removes duplicate detections:

$$
\text{Input: }(B,S,\tau),\quad \text{Output: }D
$$

![NMS before and after](lec08_materials/nms_before_after.png)

Speed tradeoff in the R-CNN family is the classical motivation for one-stage designs.

![R-CNN family speed comparison](lec08_materials/rcnn_family_speed_comparison.png)

## 6. Detection Evaluation: Precision/Recall, AP, mAP

![How to evaluate detection intuition](lec08_materials/ap_precision_recall_curve.png)

:::remark Key question and answer: evaluation target
**Question (original wording):** **"How to Evaluate Detection?"**

**Answer:** Evaluate at least four aspects together: precision (false positives), localization quality (IoU), duplicate suppression, and recall (coverage).
:::

AP (11-point approximation in this lecture):

$$
AP=\frac{1}{11}\sum_{Recall_i}\mathrm{Precision}(Recall_i)
$$

$$
Recall_i=[0,0.1,0.2,\ldots,1.0]
$$

At stricter IoU thresholds, AP drops if localization is weak.

![AP at different IoU thresholds](lec08_materials/ap_at_different_iou_thresholds.png)

mAP averages AP across classes and/or IoU thresholds. Common report terms include $AP$, $AP_{50}$, and $AP_{75}$.

## 7. End-to-End Detection with DETR

DETR treats detection as direct set prediction with a transformer encoder-decoder and matching-based training.

![DETR end-to-end pipeline](lec08_materials/detr_end_to_end_pipeline.png)

Key idea:

- Predict a fixed set of object queries.
- Use bipartite matching loss to align predictions with ground truth without NMS-heavy post hoc design.

## 8. Instance Segmentation with Mask R-CNN

Instance segmentation predicts one mask per object instance, not just one class map for all pixels.

![Instance segmentation approaches](lec08_materials/instance_segmentation_approaches.png)

Top-down route (Mask R-CNN): detect first, then predict per-RoI binary masks.

![Mask R-CNN architecture](lec08_materials/mask_rcnn_top_down_architecture.png)

RoI Pool has coordinate quantization (“snapping”), causing feature misalignment.

![RoI Pool misalignment problem](lec08_materials/roi_pool_misalignment_problem.png)

RoI Align removes snapping and preserves spatial precision.

![RoI Align no snapping](lec08_materials/roi_align_no_snapping.png)

Ablation results show clear AP gains from RoI Align.

![RoI Align ablation](lec08_materials/roi_align_ablation_table.png)

Mask head design choices:

- Class-specific masks: one $m\times m$ mask per class.
- Class-agnostic masks: one shared $m\times m$ mask.

![Class-specific vs class-agnostic masks](lec08_materials/class_specific_vs_agnostic_masks.png)

Another key design is decoupling class and mask competition:

- Use per-pixel sigmoid + binary loss for independent masks.
- This often outperforms multinomial (softmax-style) competition.

![Multinomial vs independent masks](lec08_materials/multinomial_vs_independent_masks.png)

Training targets are usually resized binary masks (e.g., $28\times 28$ per positive RoI).

![Example mask training targets](lec08_materials/mask_training_target_examples.png)

:::tip Key question and answer: why RoI Align and independent masks work better
**Question (original intent):** Why do RoI Align and per-class independent masks improve Mask R-CNN quality?

**Answer:** RoI Align reduces geometric misalignment, and independent masks remove harmful inter-class competition in the mask branch.
:::

## 9. Open-Source Frameworks

Useful implementation ecosystems:

- TensorFlow Detection API: `https://github.com/tensorflow/models/tree/master/research/object_detection`
- Detectron2 (PyTorch): `https://github.com/facebookresearch/detectron2`

These frameworks provide strong baselines (Faster R-CNN, RetinaNet, Mask R-CNN, etc.) and practical fine-tuning pipelines.

## Exam Review

### A. Must-know definitions

- **Object detection:** localization + classification.
- **Two-stage detector:** proposal generation first, per-proposal refinement second.
- **NMS:** iterative duplicate suppression using IoU threshold $\tau$.
- **AP/mAP:** precision-recall based detection metrics.
- **Instance segmentation:** per-instance binary mask prediction.

### B. Mechanism chain to explain clearly

FCN bottleneck question -> skip links preserve details -> IoU-family metrics for segmentation -> variable-output challenge in detection -> proposal-based two-stage pipeline -> one-stage speed-up tradeoff -> PR/AP/mAP evaluation -> Mask R-CNN adds aligned mask prediction.

### C. Short-answer templates

- Why can pixel accuracy fail in segmentation?
  - Because dominant background can inflate scores under class imbalance.
- Why did R-CNN evolve to Fast/Faster R-CNN?
  - To avoid redundant per-region CNN computation and to learn proposals with RPN.
- Why is NMS necessary?
  - Dense predictions produce many overlapping boxes for one object.
- Why is RoI Align better than RoI Pool?
  - It avoids coordinate snapping and keeps better spatial alignment for masks.

### D. Common mistakes

- Reporting only pixel accuracy or only AP50.
- Ignoring the speed-accuracy tradeoff between one-stage and two-stage detectors.
- Confusing semantic segmentation (class map) with instance segmentation (instance masks).
- Assuming mask branch should always use class competition like softmax.

### E. Self-check checklist

- Can you derive and interpret IoU and Soft IoU loss?
- Can you explain why Smooth L1 is preferred in box regression?
- Can you compare R-CNN, Fast R-CNN, and Faster R-CNN by computation path?
- Can you explain AP computation from precision-recall and why IoU thresholds matter?
- Can you justify RoI Align and independent mask prediction in Mask R-CNN?
