# 第九讲：三维视觉 I - 相机模型、投影与深度

## 1. 从二维图像到三维视觉

计算机视觉通常从二维 RGB 图像开始，图像可以表示为一个 $H\times W\times 3$ 的数组。三维视觉要回答更难的问题：怎样从不完整的二维观测中恢复或推理三维世界？

![Multi-view visual inputs](lec09_materials/multi_view_inputs.png)

单帧 RGB 只是其中一种数据来源。实际三维系统还会使用：

- 双目图像：两个相邻相机提供视角差异；
- 多视角图像：多张图像从不同视角观察同一场景；
- 全景图像：扩大视场角来捕获更宽的场景；
- 深度图和点云：传感器直接提供几何测量。

![Visual data acquisition](lec09_materials/visual_data_acquisition.png)

RGB 相机输出彩色图像，深度相机输出逐像素深度图，LiDAR 输出稀疏或密集的三维点云。这些模态之所以重要，是因为具身智能体、机器人和自动驾驶系统需要距离、尺度和碰撞信息，而不仅是语义标签。

:::remark 关键问题与解答：为什么需要三维视觉
**问题（原意复述）：** 如果智能体只有二维图像输入，为什么仍然需要 3D vision？

**解答：** 二维外观不能直接给出度量距离、物体尺度、可通行空间或碰撞风险。三维视觉把视觉观测转换为几何量，从而支持操作、导航、建图和物理交互。
:::

## 2. 针孔相机：通过选择光线形成图像

如果只把胶片放在物体前方而不控制入射光，同一个物点的许多光线会落到胶片的许多位置，得到模糊图像。针孔相机加入带小孔的遮挡板，使每个三维点近似只通过一条主要光线成像。

:::remark 关键问题与解答：直接放胶片是否可行
**问题（原文）：** **"Do we get a reasonable image?"**

**解答：** 不能。没有孔径约束时，许多场景点的光线会在胶片上混合，胶片记录的是混杂光路，而不是清晰的空间映射。
:::

![Pinhole projection geometry](lec09_materials/pinhole_projection_geometry.png)

对三维点 $P=[x,y,z]^T$，由相似三角形可得：

$$
x' = f\frac{x}{z}, \qquad y' = f\frac{y}{z}
$$

焦距 $f$ 控制放大倍率。深度 $z$ 越大，投影点越靠近图像中心；$x$ 或 $y$ 越大，投影点越远离中心。

:::tip 推导：相似三角形
在二维截面中，图像平面坐标满足：

$$
\frac{x'}{f}=\frac{x}{z}
$$

因此 $x'=f x/z$。$y$ 方向同理。
:::

![Aperture size tradeoff](lec09_materials/aperture_size_tradeoff.png)

孔径大小存在取舍：

- 大孔径让更多光进入，但同一邻域的多条光线会进入相机，导致模糊；
- 过小孔径让几何成像更锐利，但进光不足，图像会变暗且噪声更明显。

:::remark 关键问题与解答：孔径大小
**问题（原文）：** **"Is the size of the aperture important?"** 以及 **"What happens if the aperture is too small?"**

**解答：** 重要。较小孔径能减少几何模糊，但如果孔径过小，通过的光太少。真实相机会加入透镜，在收集更多光的同时保持聚焦。
:::

## 3. 透镜与径向畸变

真实相机使用透镜，因为纯针孔会浪费大量光线。在旁轴折射模型中，靠近光轴的光线可以用简单几何近似：

![Paraxial refraction model](lec09_materials/paraxial_refraction_model.png)

$$
x' = z'\frac{x}{z}, \qquad y' = z'\frac{y}{z}, \qquad z'=f+z_o
$$

在本讲展示的简化透镜模型中：

$$
f=\frac{R}{2(n-1)}
$$

其中 $R$ 与透镜曲率有关，$n$ 是折射率。实际要点是：透镜提升进光量，同时仍尽量把光线聚焦到成像平面。

![Radial distortion examples](lec09_materials/radial_distortion_examples.png)

透镜并不完美。**径向畸变（radial distortion）** 在穿过透镜边缘的光线处最明显。常见的定性模式包括：

- 枕形畸变：直网格线向内弯曲；
- 桶形畸变：鱼眼镜头常见，直网格线向外鼓出。

:::warn 常见误区：透镜模型与相机矩阵
径向畸变不等于内参矩阵 $K$。$K$ 描述理想透视投影到像素坐标的过程；畸变描述相对理想模型的偏差，通常需要额外标定参数处理。
:::

## 4. 内参：从相机坐标到像素坐标

内参描述相机内部几何：焦距缩放、像素缩放、主点偏移，有时还包括坐标轴 skew。

从归一化透视投影出发，像素坐标为：

$$
(u,v)=\left(\alpha\frac{x}{z}+c_x,\;\beta\frac{y}{z}+c_y\right),
\qquad \alpha=fk,\quad \beta=fl
$$

$c_x,c_y$ 是主点偏移。$k,l$ 把图像平面的度量坐标转换成像素；如果像素不是正方形，$\alpha$ 和 $\beta$ 会不同。

:::remark 关键问题与解答：投影变换
**问题（原文）：** **"Is this a linear transformation? No - division by z is nonlinear. Can we express it in a matrix form?"**

**解答：** 在欧氏坐标中，除以 $z$ 是非线性的。在齐次坐标中，先用矩阵线性计算齐次向量，再除以最后一个坐标，因此投影可以表示为“差一个尺度”的矩阵形式。
:::

![Homogeneous projective transformation](lec09_materials/homogeneous_projective_transformation.png)

齐次形式为：

$$
P'_h =
\begin{bmatrix}
\alpha x+c_xz\\
\beta y+c_yz\\
z
\end{bmatrix}
=
\begin{bmatrix}
\alpha & 0 & c_x & 0\\
0 & \beta & c_y & 0\\
0 & 0 & 1 & 0
\end{bmatrix}
\begin{bmatrix}
x\\y\\z\\1
\end{bmatrix}
$$

经过齐次归一化后，就得到像素坐标 $(u,v)$。

内参矩阵为：

$$
K=
\begin{bmatrix}
\alpha & 0 & c_x\\
0 & \beta & c_y\\
0 & 0 & 1
\end{bmatrix},
\qquad
P' = MP = K[I\;0]P
$$

![Camera skewness matrix](lec09_materials/camera_skewness_matrix.png)

如果图像坐标轴并不严格垂直，就会出现 skew：

$$
P'=
\begin{bmatrix}
\alpha & -\alpha\cot\theta & c_x & 0\\
0 & \frac{\beta}{\sin\theta} & c_y & 0\\
0 & 0 & 1 & 0
\end{bmatrix}
\begin{bmatrix}
x\\y\\z\\1
\end{bmatrix}
$$

对大多数工业级相机，$\theta=\pi/2$，因此 skew 通常可以忽略。

## 5. 外参：世界坐标系到相机坐标系

外参描述世界参考系和相机参考系之间的相对位姿。平移有三个自由度：

$$
T=
\begin{bmatrix}
T_x\\T_y\\T_z
\end{bmatrix}
$$

本讲的旋转参数化也有三个自由度：

$$
R = R_x(\alpha)R_y(\beta)R_z(\gamma)
$$

二者合在一起，把世界坐标中的点 $P_w$ 映射到相机坐标：

$$
P=
\begin{bmatrix}
R & T\\
0 & 1
\end{bmatrix}_{4\times4}
P_w
$$

![Meaning of extrinsics R and T](lec09_materials/extrinsics_rt_meaning.png)

**关键定义（讲义原话）：** **"R and T represent the orientation and origin location of the world reference frame in the camera reference frame."**

这个约定非常重要。同一组 $R,T$ 也可以推出相机在世界坐标中的位姿：

$$
P_w=
\begin{bmatrix}
R^{-1} & -R^{-1}T\\
0 & 1
\end{bmatrix}_{4\times4}
P
$$

因此，相机在世界坐标中的朝向是 $R^{-1}$，平移是 $-R^{-1}T$。

:::warn 常见误区：外参方向
不要直接把 $T$ 理解成“相机在世界坐标中的位置”。在这里的约定下，$T$ 是世界坐标原点在相机坐标中的位置。相机中心在世界坐标中是 $-R^{-1}T$。
:::

## 6. 完整投影相机矩阵

完整相机模型把外参与内参组合起来：

![Full projective transformation](lec09_materials/full_projective_transformation.png)

$$
P'_{3\times1} = MP_w = K_{3\times3}[R\;T]_{3\times4}P_{w,4\times1}
$$

把 $M$ 的三行写成：

$$
M=
\begin{bmatrix}
\mathbf{m}_1\\
\mathbf{m}_2\\
\mathbf{m}_3
\end{bmatrix}
$$

则欧氏像素坐标通过齐次除法得到：

$$
P' \rightarrow
\left(
\frac{\mathbf{m}_1P_w}{\mathbf{m}_3P_w},
\frac{\mathbf{m}_2P_w}{\mathbf{m}_3P_w}
\right)
$$

这就是透视相机：深度出现在分母中，所以远处物体投影更小，三维平行线在图像中可能相交于消失点。

:::tip 关键问题与解答：投影变换保留什么
**问题（原意复述）：** projective transformation 会保留哪些性质？

**解答：** 点在线上这类关联关系会保留，但长度、角度、平行性等欧氏量通常不保留。这就是透视图像中可能出现消失点的原因。
:::

## 7. 透视、弱透视与正交投影模型

透视投影最准确，但由于每个点都有自己的深度分母，所以是非线性的：

$$
x'=\frac{f'}{z}x,\qquad y'=\frac{f'}{z}y
$$

当物体自身的相对深度变化远小于它到相机的距离时，可以使用弱透视。此时用平均深度 $z_0$ 代替每个点的 $z$：

![Weak perspective approximation](lec09_materials/weak_perspective_approximation.png)

$$
x'=\frac{f'}{z_0}x,\qquad y'=\frac{f'}{z_0}y
$$

其中 $m=f'/z_0$ 是该物体所有点共享的统一放大倍率。

![Pros and cons of camera models](lec09_materials/camera_model_pros_cons.png)

弱透视数学更简单，适合物体较小且距离较远的场景，尤其常用于识别任务。针孔透视更准确，适合三维到二维几何建模，常用于 structure from motion 和 SLAM。

正交投影可以看成投影中心在无穷远处的极限情况：

$$
x'=x,\qquad y'=y
$$

![Orthographic vs perspective projection](lec09_materials/orthographic_vs_perspective.png)

:::remark 关键问题与解答：如何选择投影模型
**问题（原意复述）：** 什么时候使用 perspective、weak perspective 或 orthographic projection？

**解答：** 当度量几何、深度变化或相机运动很重要时，用透视投影。当物体相对其距离很小、可以接受统一尺度时，用弱透视。当需要工程视图或理想化地去除深度尺度变化时，用正交投影。
:::

## 8. 深度图与深度反投影

**关键定义（讲义原话）：** **"A single-channel image filled by depth values"** 以及 **"A 2.5D representation."**

![Depth image and z-depth](lec09_materials/depth_image_z_depth.png)

深度图记录的是 z-depth：从光心沿光轴方向到场景点的距离。它不是 ray depth；ray depth 指的是光心到点的欧氏距离。

:::warn 常见误区：z-depth 与 ray depth
对点 $(x,y,z)$，z-depth 是 $z$。ray depth 是 $\sqrt{x^2+y^2+z^2}$。二者只有在光轴上，即 $x=y=0$ 时才相等。
:::

对深度相机，假设内参矩阵 $K$ 已知。深度像素 $(u,v,z)$ 满足：

![Depth backprojection formula](lec09_materials/depth_backprojection_formula.png)

$$
(u,v)=\left(\alpha\frac{x}{z}+c_x,\;\beta\frac{y}{z}+c_y\right)
$$

解出三维相机坐标：

$$
x=\frac{z(u-c_x)}{\alpha},\qquad y=\frac{z(v-c_y)}{\beta}
$$

因此，一个像素 $(u,v,z)$ 可以变成一个相机坐标系中的三维点 $(x,y,z)$。

![Depth image to point cloud](lec09_materials/depth_to_point_cloud.png)

通过反投影，深度图可以转换成深度点云。真正的三维表示应当支持两点之间的度量距离计算；只有深度值还不够，还需要 $K$ 才能恢复 $x,y,z$。

:::remark 关键问题与解答：为什么深度图只是 2.5D
**问题（原意复述）：** 深度图已经包含 depth values，为什么仍然只是 2.5D？

**解答：** 它只从一个视角为每个像素存储一个可见表面的深度。它不会直接存储被遮挡表面、完整物体几何，也不能在没有相机内参的情况下直接给出度量三维坐标。
:::

## 9. Exam Review

### Core definitions

- 针孔相机：为每个场景点选择一条主要光线，并用相似三角形投影。
- 内参 $K$：把相机坐标映射到像素坐标的相机内部参数。
- 外参 $R,T$：世界坐标系和相机坐标系之间的位姿关系。
- 透视投影：完整投影映射，深度在分母中。
- 弱透视：用共享平均深度 $z_0$ 近似的投影。
- 正交投影：去除由深度导致的尺度变化。
- 深度图：单通道 z-depth 图，是 2.5D 表示。
- 深度反投影：用 $K$ 把 $(u,v,z)$ 转换成相机坐标 $(x,y,z)$。

### Short-answer templates

- 解释针孔投影：先说光线选择，再用相似三角形，最后写出 $x'=fx/z$ 和 $y'=fy/z$。
- 解释齐次坐标：欧氏投影因为除以 $z$ 而非线性；齐次形式把矩阵乘法写成线性的，最后再归一化。
- 解释外参：先说明变换方向。本讲中 $P=[R\;T]P_w$，所以相机在世界坐标中的位姿是 $R^{-1},-R^{-1}T$。
- 比较相机模型：透视准确但非线性；弱透视简单但只适合深度变化小的物体；正交投影完全移除深度尺度变化。
- 解释深度反投影：写出像素方程，解出 $x,y$，并强调 $z$ 是光轴方向深度。

### Common mistakes

- 混淆图像平面度量坐标和像素坐标。
- 把深度图数值当作欧氏 ray depth。
- 直接把 $T$ 当作相机中心在世界坐标中的位置。
- 乘完相机矩阵后忘记做齐次除法。
- 把弱透视用于深度变化很大的物体。

### Self-check

1. 你能用相似三角形推导 $x'=fx/z$ 吗？
2. 你能写出内参矩阵 $K$ 并解释 $\alpha,\beta,c_x,c_y$ 吗？
3. 你能解释为什么投影变换在欧氏坐标下不是线性的、但在齐次坐标下可用矩阵表示吗？
4. 当 $K$ 已知时，你能把 $(u,v,z)$ 转换成 $(x,y,z)$ 吗？
5. 给定一个场景，你能判断该用透视、弱透视还是正交投影吗？
