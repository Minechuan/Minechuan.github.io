# 第 1 讲：计算机视觉导论（总览）

## 1. 学习目标与课程安排

这节开篇课建立全局地图：什么是视觉、计算机视觉到底覆盖什么，以及这门学科如何把感知、智能与行动连接起来。

学完本讲后，你应该能够：

- 解释 sensation、perception、cognition 与 visuomotor control 的区别与联系。
- 用具体例子说明低层、中层、高层视觉任务。
- 说明为什么计算机视觉不仅做理解，也做生成与具身决策支持。
- 把计算机视觉放到跨学科框架中理解。

本讲涉及的课程安排要点：

- 4 次作业（共 40%）、1 次期中（30%）、1 次期末（30%），另有课堂参与加分。
- 核心先修：微积分、线性代数、概率统计、Python。
- 推荐资料同时覆盖经典视觉与深度学习方向。

## 2. 人类视觉到底是什么？

人类视觉是一个完整的“感知-行动系统”，而不只是拍照。

![人类视觉系统总览](lec01_materials/human_visual_system_overview.png)

### 2.1 视觉感觉：把光转成神经信号

视觉感觉从接收光信号开始，并在神经系统中形成表征。双眼系统还能通过视差获得深度（stereopsis）。

![双目视觉与立体视觉](lec01_materials/binocular_vision_stereopsis.png)

:::remark 📝 问题与解答："Vision = eyes = camera?"
**问题：** **"Vision = eyes = camera?"**

**解答：** 不是。相机只负责采集图像，而生物视觉还要进一步推断物体、事件、意图，并支持行动。传感器只是入口，不是全部。
:::

### 2.2 视觉知觉与视觉认知

讲义中的关键定义是：

**"the process of acquiring knowledge about environmental objects and events by extracting information from the light they emit or reflect."**

因此，知觉的本质是“获取知识”，而不是被动记录。

课堂还用视觉认知案例（如 Sally-Anne false-belief 任务）说明：视觉会与推理能力、心智理论发生耦合。

![视觉认知案例（Sally-Anne）](lec01_materials/visual_cognition_sally_anne.png)

### 2.3 视觉、语言与动作

人类智能中，视觉会与以下能力深度结合：

- 语言落地（把看到的内容转成可表达的语义）。
- 眼手协调与闭环控制。
- 在感知-行动回路中持续“提出假设-验证假设”。

![感知-行动闭环](lec01_materials/perception_action_loop.png)

:::tip 💡 问题与解答：视觉只负责识别吗？
**问题：** 视觉是否只用于识别场景？

**解答：** 不是。视觉还承担动作反馈与决策支持。在智能体中，感知和行动是紧耦合关系。
:::

## 3. 什么是计算机视觉？

本讲给出的核心表述是：

**"Computer vision deals with acquiring, processing and analyzing, understanding, generating or imagining visual data."**

这也是整门课主线：从采集到理解，再从理解走向生成。

## 4. 视觉数据与传感器模态

计算机视觉绝不只处理单张 RGB 图像。

![视觉数据模态](lec01_materials/visual_data_modalities.png)

本讲把数据来源组织为：

- RGB 图像与 RGB 视频。
- 深度图与 RGB-D 序列。
- LiDAR 点云。
- 超越单视角：全景、双目、多视图。
- 真正的 3D 视觉表示。

## 5. 低层视觉：处理与特征提取

低层视觉关注可测的局部信号：

- 图像处理：去噪、去模糊、增强。
- 特征提取：边缘、角点、光流/对应关系。

![低层视觉任务](lec01_materials/low_level_vision_tasks.png)

课堂示例应用包括运动去模糊与去雨。

## 6. 中层视觉：结构推断与三维理解

中层视觉开始基于低层证据做结构级推断。

![中层视觉总览](lec01_materials/mid_level_vision_overview.png)

代表任务与应用包括：

- 分组/分割与运动分析。
- 全景拼接。
- 3D 扫描与地标重建。
- 用于定位与建图的 SLAM。
- 神经 3D/4D 重建（NeRF、4DGS）。

课件中明确给出的公式化定义：

$$
\text{SLAM} = \text{Simultaneous Localization And Mapping}
$$

![SLAM 应用示例](lec01_materials/slam_robot_vacuum_mapping.png)

![NeRF 示例](lec01_materials/nerf_neural_radiance_field.png)

![神经 4D 重建（4DGS）](lec01_materials/neural_4dgs_dynamic_scene.png)

## 7. 高层视觉：语义理解

关键表述是：

**"High-level vision analyzes the structure of the external world that produced those images and generates semantic representation/interpretations."**

![高层视觉语义理解](lec01_materials/high_level_vision_semantics.png)

典型任务包括：

- 目标识别与检测。
- 场景理解。
- 行为理解。

课堂展示的应用有：人脸识别、场景理解、AR、无人收银商店等。

## 8. 视觉、图形学与生成

本讲强调了视觉与图形学的关系：

$$
\text{Graphics: } \mathcal{P} \rightarrow \mathcal{I}
$$

$$
\text{Vision: } \mathcal{I} \rightarrow \mathcal{P}
$$

其中 $\mathcal{P}$ 是参数/世界空间，$\mathcal{I}$ 是图像空间。

![视觉是逆图形学](lec01_materials/vision_as_inverse_graphics.png)

课件中的对象参数化写法可整理为：

$$
\text{cube}(\text{size}, x_0, y_0, z_0, \theta_{xy}, \theta_{xz}, \theta_{yz}, \ldots)
$$

$$
\text{sphere}(\text{radius}, x_1, y_1, z_1, \ldots)
$$

:::remark 📝 问题与解答：为什么视觉常被认为比图形学更难？
**问题：** 为什么说计算机视觉是 "inverse graphics"，而且更 ill-posed？

**解答：** 渲染是已知场景参数到图像的前向映射；视觉是从不完整且含噪图像反推隐藏场景参数。同一观测可能对应多种世界解释，因此天然更不适定。
:::

本讲也强调“图形学反哺视觉”：合成数据可以低成本提供大规模标签。

![合成数据帮助视觉学习](lec01_materials/synthetic_data_for_vision.png)

并且，计算机视觉已延展到生成任务：

- 人脸生成与人脸重演。
- 风格迁移。
- 文生图扩散模型。
- 视频生成。
- 视觉语言模型。

![文生图扩散模型示例](lec01_materials/text_to_image_diffusion_examples.png)

## 9. 具身视觉与跨学科版图

课程末尾进一步扩展了定义：

- 视觉不仅处理采集、分析、理解、生成；
- 还为身体运动提供视觉反馈，并帮助具身智能体决策。

Galbot 案例就是具身视觉系统的展示。

![Galbot 具身视觉案例](lec01_materials/galbot_embodied_vision_example.png)

最后，本讲强调计算机视觉的跨学科属性。

![计算机视觉的跨学科属性](lec01_materials/interdisciplinary_nature_of_cv.png)

## Exam Review

### A. 必会定义

- **Visual sensation：** 把光信号转为神经信号。
- **Visual perception：** **从光信息中获取环境知识**。
- **Computer vision：** **acquiring -> processing/analyzing -> understanding -> generating visual data**。
- **SLAM：** 同时定位与建图。
- **Inverse graphics：** 从图像反推出场景参数。

### B. 必会机制链路

光输入 -> 感觉 -> 知觉/认知 -> 动作反馈 -> 感知-行动闭环。

在机器视觉系统中：

传感器数据 -> 低层处理/特征 -> 中层结构/3D -> 高层语义 -> 决策/行动或生成。

### C. 简答模板

- **问：为什么计算机视觉不等于图像分类？**
  答：因为它还覆盖几何推断、时序理解、内容生成和具身控制反馈。
- **问：为什么视觉通常比图形学更难？**
  答：图形学是前向映射，视觉是含歧义和噪声的反向映射。
- **问：为什么要多模态传感器？**
  答：不同模态可消除不同歧义（外观、深度、几何、运动）。

### D. 常见误区

- 把视觉等同于相机采集。
- 忽略“感知-认知-行动”闭环。
- 误以为生成不属于计算机视觉。
- 忽略具身场景中的决策支持角色。

### E. 自检清单

- 你能在 1 分钟内讲清 sensation/perception/cognition 的区别吗？
- 你能分别列出低/中/高层视觉各 3 个任务吗？
- 你能用一个例子解释 inverse graphics 吗？
- 你能说明为什么真实系统需要多模态数据吗？
