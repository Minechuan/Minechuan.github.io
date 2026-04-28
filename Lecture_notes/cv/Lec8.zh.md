# 第八讲：目标检测与实例分割

## 1. 改进 FCN：瓶颈里到底该保留什么

![FCN bottleneck question](lec08_materials/fcn_bottleneck_question.png)

语义分割中的编码器-解码器不应该让瓶颈层“记住一切”。更合理的设计是：深层主要保留高层语义信息，精细边界细节通过 skip connection 回传。

:::remark 关键问题与解答：瓶颈信息内容
**问题（原文）：** **"What needs to be stored in the bottleneck?"**

**解答：** 瓶颈层主要保留全局上下文；精细边界由编码器到解码器的跳连来恢复。
:::

![UNet skip link and bottleneck role](lec08_materials/unet_skip_link_bottleneck.png)

现代密集预测骨干网络基本都在放大这个思路：

- DeepLabV3 重点做多尺度上下文聚合。
- UperNet 统一特征金字塔融合与多任务预测头。

![DeepLabV3 design variants](lec08_materials/deeplabv3_dense_prediction_designs.png)

![UperNet multi-head dense prediction](lec08_materials/upernet_multi_head_dense_prediction.png)

## 2. 分割指标：Accuracy、IoU、Soft IoU、mIoU

对单个语义类别，像素准确率计算很直接：

$$
\mathrm{accuracy}=\frac{TP+TN}{TP+TN+FP+FN}
$$

但在类别像素占比很低时，它可能产生明显误导。

:::tip 关键问题与解答：Accuracy 何时会误导
**问题（原意）：** 在语义分割中，什么时候 pixel accuracy 会不可靠？

**解答：** 当背景（负样本）占绝对多数时，高 accuracy 可能只是“背景判对了”，并不代表目标类分割得好。
:::

IoU 直接衡量预测区域与真值区域的重叠质量：

$$
IoU=\frac{\text{target}\cap\text{prediction}}{\text{target}\cup\text{prediction}}
$$

![IoU visualization](lec08_materials/iou_visualization.png)

训练时常用可微版本 Soft IoU：

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

多类别分割通常先算各类别 IoU，再做平均得到 mIoU。

## 3. 目标检测：定位 + 分类

**关键定义（讲义原话）：** **"Task: localization + classification"**。

对二维轴对齐框，参数自由度是 4：

$$
\text{bbox}=(x,y,h,w),\quad \text{DoF}=4
$$

![Single object bbox parameterization](lec08_materials/single_object_bbox_parameterization.png)

:::remark 关键问题与解答：边界框参数化
**问题（原文）：** **"How many degree-of-freedom?"** 和 **"How to parameterize such a bounding box?"**

**解答：** 4 个自由度，典型参数化是 $(x,y,h,w)$（或等价的中心点+宽高形式）。
:::

边界框回归预测偏移量：

$$
\Delta=(\Delta x,\Delta y,\Delta w,\Delta h)
$$

常见损失函数：

$$
L_1=\sum_i|\Delta_i|,
\quad
L_2=\sum_i\Delta_i^2,
\quad
RMSE=\sqrt{\frac{1}{N}\sum_i\Delta_i^2}
$$

![Bounding-box regression losses](lec08_materials/bbox_regression_losses_overview.png)

Smooth L1 是 Fast/Faster R-CNN 中非常实用的折中：

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

## 4. 多目标检测的演化路径

多目标检测的核心困难在于：每张图对象数量不同，输出规模天然不固定。

经典演化路径：

1. 多尺度滑窗穷举。
2. 区域候选（Selective Search）。
3. R-CNN 系列，用学习到的特征做分类和回归。

![Selective Search region proposals](lec08_materials/selective_search_region_proposals.png)

R-CNN 提升了准确率，但有两个明显瓶颈：每个候选框都要单独前向，且裁剪区域上下文不足。

![R-CNN limitations](lec08_materials/rcnn_limitations_speed_and_context.png)

Fast R-CNN 改为“整图一次 backbone，共享特征图，再裁剪 RoI 特征”。

![Fast R-CNN shared backbone](lec08_materials/fast_rcnn_shared_backbone.png)

RoI Pool 把任意大小 proposal 变成固定大小特征。

![RoI Pool feature cropping](lec08_materials/roi_pool_feature_cropping.png)

Faster R-CNN 在此基础上引入 RPN，从特征图直接生成 proposal。

![Faster R-CNN with RPN](lec08_materials/faster_rcnn_with_rpn.png)

## 5. Two-Stage 与 Single-Stage 流水线

![Two-stage detector question](lec08_materials/two_stage_detector_question.png)

:::remark 关键问题与解答：是否一定需要第二阶段
**问题（原文）：** **"Do we really need the second stage?"**

**解答：** 第二阶段通常能显著提升每个 proposal 的分类与定位精度；去掉第二阶段往往更快，但定位/分类质量可能下降。
:::

Two-stage 推理逻辑：

- 第一阶段：backbone 特征 + RPN 候选框（常见约 300 个）。
- 第二阶段：逐 proposal 分类/回归，再做置信度过滤与 NMS。

Single-stage（YOLO/SSD/RetinaNet）在稠密位置直接预测：

$$
(dx,dy,dh,dw,\text{confidence})
$$

$$
\text{output}=7\times 7\times(5B+C)
$$

![Single-stage output tensor](lec08_materials/single_stage_detector_output_tensor.png)

NMS 用于去重：

$$
\text{Input: }(B,S,\tau),\quad \text{Output: }D
$$

![NMS before and after](lec08_materials/nms_before_after.png)

R-CNN 系列的速度对比正是 one-stage 方法的重要动机。

![R-CNN family speed comparison](lec08_materials/rcnn_family_speed_comparison.png)

## 6. 检测评估：Precision/Recall、AP、mAP

![How to evaluate detection intuition](lec08_materials/ap_precision_recall_curve.png)

:::remark 关键问题与解答：检测评估看什么
**问题（原文）：** **"How to Evaluate Detection?"**

**解答：** 至少同时看四件事：精度（误检）、定位质量（IoU）、重复响应抑制，以及召回覆盖率。
:::

本讲使用的 AP（11 点近似）写法：

$$
AP=\frac{1}{11}\sum_{Recall_i}\mathrm{Precision}(Recall_i)
$$

$$
Recall_i=[0,0.1,0.2,\ldots,1.0]
$$

IoU 阈值越严格，如果定位不够准，AP 会明显下降。

![AP at different IoU thresholds](lec08_materials/ap_at_different_iou_thresholds.png)

mAP 是在类别和/或 IoU 阈值上的 AP 平均。常见报告项有 $AP$、$AP_{50}$、$AP_{75}$。

## 7. DETR：端到端 Transformer 检测

DETR 把检测建模为集合预测（set prediction），使用 transformer encoder-decoder 和匹配损失端到端训练。

![DETR end-to-end pipeline](lec08_materials/detr_end_to_end_pipeline.png)

核心思想：

- 预测固定数量的 object queries。
- 用二分图匹配损失对齐预测与真值，减少对 NMS 等后处理设计的依赖。

## 8. 实例分割与 Mask R-CNN

实例分割要为每个对象实例输出独立掩码，而不是整图共享一张类别图。

![Instance segmentation approaches](lec08_materials/instance_segmentation_approaches.png)

Top-down 路线（Mask R-CNN）：先检测，再对每个 RoI 预测二值 mask。

![Mask R-CNN architecture](lec08_materials/mask_rcnn_top_down_architecture.png)

RoI Pool 有坐标量化（snapping）问题，会带来特征错位。

![RoI Pool misalignment problem](lec08_materials/roi_pool_misalignment_problem.png)

RoI Align 去掉 snapping，保留更精确的空间对齐。

![RoI Align no snapping](lec08_materials/roi_align_no_snapping.png)

消融结果显示 RoI Align 带来显著 AP 提升。

![RoI Align ablation](lec08_materials/roi_align_ablation_table.png)

Mask 分支的两个常见设计：

- 类别相关（class-specific）：每个类别一个 $m\times m$ mask。
- 类别无关（class-agnostic）：全类别共享一个 $m\times m$ mask。

![Class-specific vs class-agnostic masks](lec08_materials/class_specific_vs_agnostic_masks.png)

另一个关键点是让类别预测和 mask 预测解耦：

- 使用 per-pixel sigmoid + binary loss 做独立 mask。
- 通常优于多项竞争（softmax 风格）方案。

![Multinomial vs independent masks](lec08_materials/multinomial_vs_independent_masks.png)

训练目标通常是固定分辨率二值掩码（如每个正样本 RoI 对应 $28\times 28$）。

![Example mask training targets](lec08_materials/mask_training_target_examples.png)

:::tip 关键问题与解答：RoI Align 与独立 mask 为什么更优
**问题（原意）：** 为什么 RoI Align 和“每类独立 mask”通常会提升 Mask R-CNN 效果？

**解答：** RoI Align 降低了几何错位；独立 mask 减少了 mask 分支中的类别竞争干扰。
:::

## 9. 开源框架

高质量实现生态：

- TensorFlow Detection API：`https://github.com/tensorflow/models/tree/master/research/object_detection`
- Detectron2（PyTorch）：`https://github.com/facebookresearch/detectron2`

这些框架覆盖 Faster R-CNN、RetinaNet、Mask R-CNN 等主流基线，并支持高效微调流程。

## Exam Review

### A. 必会定义

- **Object detection：** 定位 + 分类。
- **Two-stage detector：** 先候选框，再逐 proposal 精修。
- **NMS：** 基于 IoU 阈值 $\tau$ 的重复框抑制。
- **AP/mAP：** 基于 precision-recall 曲线的检测指标。
- **Instance segmentation：** 对每个实例输出独立二值掩码。

### B. 必须讲清楚的机制链路

FCN 瓶颈问题 -> skip link 保细节 -> IoU 系指标评估分割 -> 检测中的可变输出难题 -> proposal 驱动的 two-stage 管线 -> one-stage 的速度权衡 -> PR/AP/mAP 评估 -> Mask R-CNN 的对齐掩码预测。

### C. 简答题模板

- 为什么 pixel accuracy 在分割里会失真？
  - 因为类别不平衡时，背景主导会抬高分数。
- 为什么 R-CNN 会演化到 Fast/Faster R-CNN？
  - 为了避免每个 proposal 重复跑 CNN，并用 RPN 学习候选框。
- 为什么 NMS 不可少？
  - 稠密预测会给同一对象产生大量重叠框。
- 为什么 RoI Align 比 RoI Pool 更好？
  - 避免坐标量化带来的错位，对 mask 这种像素敏感任务更关键。

### D. 常见误区

- 只看 pixel accuracy 或只看 AP50。
- 忽略 one-stage 与 two-stage 的速度-精度权衡。
- 把语义分割（类别图）和实例分割（实例掩码）混为一谈。
- 误以为 mask 分支也必须采用 softmax 类间竞争。

### E. 自检清单

- 你能推导并解释 IoU 与 Soft IoU loss 吗？
- 你能说明边界框回归里为什么常用 Smooth L1 吗？
- 你能按计算路径对比 R-CNN、Fast R-CNN、Faster R-CNN 吗？
- 你能从 precision-recall 解释 AP，并说明 IoU 阈值变化的影响吗？
- 你能解释为什么 Mask R-CNN 需要 RoI Align 与独立 mask 预测吗？
