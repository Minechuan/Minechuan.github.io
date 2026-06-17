# Lecture 10: 3D Vision II - 3D Representations, Neural Rendering, and Point Networks

## 1. Multiple 3D Representations

3D data can be represented in many ways. The choice is not neutral: it determines memory cost, rendering method, editability, learning architecture, and what geometric operations are easy or hard.

![Multiple 3D representations](lec10_materials/multiple_3d_representations.png)

A useful split is:

- Regular representations: multi-view images, depth images, and volumetric grids.
- Irregular representations: meshes, point clouds, and implicit fields.

3D representations are also origin-dependent and application-dependent. A shape may come from real-world acquisition, manual modeling, procedural generation, or learning. It may be stored for rendering, editing, simplification, smoothing, filtering, repairing, animation, or machine learning.

:::remark Key question and answer: why many representations?
**Question (original intent):** Why do we need multiple 3D representations instead of one universal format?

**Answer:** Different tasks privilege different operations. Voxels are easy to index but expensive; meshes encode surfaces and topology; point clouds are lightweight but lack connectivity; implicit fields give continuous surfaces; radiance fields and Gaussians are optimized for view synthesis.
:::

## 2. Depth, Voxels, and Stereo Depth Sensors

A depth image is a single-channel image filled with depth values. It is a 2.5D representation because it records one visible depth per pixel from one viewpoint, not complete object geometry.

![Depth backprojection formula](lec10_materials/depth_backprojection_formula.png)

If the camera intrinsics are known, a depth pixel $(u,v,z)$ can be backprojected into camera-space coordinates:

$$
x=\frac{z(u-c_x)}{\alpha},\qquad y=\frac{z(v-c_y)}{\beta}
$$

Backprojection turns a depth image into a depth point cloud.

Voxels store a regular $H\times W\times D$ grid:

![Voxel representation limitations](lec10_materials/voxel_representation_limitations.png)

Voxels are easy to index and compatible with 3D convolutions, but they are memory-expensive and are not naturally surface representations.

:::remark Key question and answer: voxel surface
**Question (original wording):** **"Where is the surface?"** and **"How to upsample?"**

**Answer:** A voxel grid stores occupancy or values in cells; the actual surface must be inferred, for example by extracting an iso-surface. Upsampling is hard because increasing resolution cubically increases memory and computation.
:::

Stereo sensors estimate correspondence, compute disparity, and convert disparity into depth:

![Stereo disparity and depth](lec10_materials/stereo_disparity_depth.png)

$$
u-u'=\frac{Bf}{z}=\mathrm{disparity}
$$

Disparity is inversely proportional to depth. Large disparity means the point is close; small disparity means it is far.

![Stereo sensor tradeoffs](lec10_materials/stereo_sensor_tradeoffs.png)

Stereo is robust to direct sunlight and low-cost, but correspondence search along textureless or repetitive regions is hard. Active stereo and structured light inject patterns to make correspondence easier:

![Structured light stereo matching](lec10_materials/structured_light_stereo_matching.png)

:::warn Common pitfall: disparity vs. depth
Disparity and depth move in opposite directions. If disparity is noisy or missing at occlusion boundaries, the recovered depth map will also be unreliable there.
:::

## 3. Meshes: Explicit Surface Geometry

**Key definition (lecture wording):** **"A piece-wise Linear Surface Representation"** and **"Both a geometry and surface representation."**

![Surface mesh bunny](lec10_materials/surface_mesh_bunny.png)

A triangle mesh is essentially a graph with vertices and edges, plus triangular faces. It can also store attributes such as normals, colors, and texture coordinates per vertex, face, or edge.

There are two common storage strategies:

- Triangle list: each face stores three positions. This is simple but stores no connectivity.
- Indexed face set: vertices are stored once, and each face stores vertex indices.

![Indexed face set](lec10_materials/indexed_face_set.png)

In indexed face sets, vertices are often saved in counter-clockwise order so that the right-hand rule gives outward normals.

:::remark Key question and answer: mesh data structure
**Question (original wording):** **"What information should be stored?"**

**Answer:** At minimum, geometry and topology: vertex coordinates and which vertices form each face. Practical meshes also store attributes such as normals, color, and texture coordinates.
:::

Meshes approximate smooth surfaces with piecewise linear faces. They are widely used for visualization and for generating ground truth, even when real sensor data is originally captured as point clouds.

## 4. Point Clouds: Lightweight but Surface-Free

A point cloud stores $N\times 3$ coordinates. It is irregular and orderless, but compact and easy to acquire.

![Point cloud representation](lec10_materials/point_cloud_representation.png)

The key limitation is that a point cloud is not itself a surface. It is better understood as:

$$
\text{point cloud} = \text{surface} + \text{sampling}
$$

So we often need to sample point clouds from meshes or reconstruct surfaces from point clouds.

For uniform mesh sampling:

1. Compute each face area.
2. Convert face areas into sampling probabilities.
3. Sample faces independently according to these probabilities.
4. Uniformly sample a point inside each selected triangle.

![Uniform triangle sampling](lec10_materials/triangle_uniform_sampling.png)

For a triangle with vertices $v_1,v_2,v_3$:

$$
x=v_3+a_1(v_1-v_3)+a_2(v_2-v_3)=a_1v_1+a_2v_2+(1-a_1-a_2)v_3
$$

If $a_1+a_2\le 1$, the point is inside the triangle. If $a_1+a_2>1$, fold it back by:

$$
x=(1-a_1)v_1+(1-a_2)v_2+(a_1+a_2-1)v_3
$$

Uniform sampling is easy to implement but can produce irregularly spaced points. Farthest Point Sampling (FPS) selects points iteratively so that selected samples cover the shape more evenly.

![FPS vs uniform sampling](lec10_materials/fps_vs_uniform_sampling.png)

:::tip Key question and answer: uniform vs. FPS
**Question (original intent):** Why use FPS if uniform sampling is easier?

**Answer:** Uniform sampling is unbiased with respect to surface area, but the sampled points can cluster. FPS is more expensive but improves spatial coverage, which is often better for downstream point-cloud learning.
:::

## 5. Point Cloud Distance Metrics

:::remark Key question and answer: point-cloud distance
**Question (original wording):** **"How to measure the distance between two point clouds?"**

**Answer:** Two common choices are Chamfer Distance and Earth Mover's Distance. Chamfer uses nearest-neighbor sums; EMD solves a one-to-one matching problem.
:::

![Point cloud distance metrics](lec10_materials/point_cloud_distance_metrics.png)

Chamfer Distance:

$$
d_{CD}(S_1,S_2)=
\sum_{x\in S_1}\min_{y\in S_2}\lVert x-y\rVert_2+
\sum_{y\in S_2}\min_{x\in S_1}\lVert x-y\rVert_2
$$

Chamfer Distance is relatively insensitive to sampling density because it does not require a global one-to-one correspondence.

Earth Mover's Distance:

$$
d_{EMD}(S_1,S_2)=
\min_{\phi:S_1\rightarrow S_2}
\sum_{x\in S_1}\lVert x-\phi(x)\rVert_2,
\qquad \phi:S_1\rightarrow S_2\ \text{is a bijection}
$$

EMD is sensitive to sampling because it requires matched pairs. It is often more semantically faithful but more computationally expensive.

:::warn Common pitfall: Chamfer can hide missing structure
Chamfer Distance can be small even when one cloud has uneven density or misses thin structures, because many points may map to the same nearest neighbor. EMD penalizes such mismatch more directly when equal-size matching is valid.
:::

## 6. Implicit Fields, SDF, and Iso-Surface Extraction

Implicit representations encode a shape by a function over space instead of an explicit list of faces or points.

**Key definition (lecture wording):** **"Both an implicit geometry and surface representation."**

Examples include signed distance functions, unsigned distance functions, and occupancy networks.

![Signed distance function](lec10_materials/signed_distance_function.png)

For an SDF:

$$
F(x,y,z)<0\ \text{inside},\qquad
F(x,y,z)>0\ \text{outside},\qquad
F(x,y,z)=0\ \text{on the surface}
$$

The surface is the zero set, also called the zero iso-surface.

To extract a mesh from an implicit field, classical methods discretize space and identify where values cross the iso-value:

![Marching cubes cases](lec10_materials/marching_cubes_cases.png)

In 3D marching cubes, each cube has 8 vertices, so there are:

$$
2^8=256
$$

possible inside/outside configurations. Rotation and inversion symmetries reduce the first published version to 15 unique cases, but ambiguous cases can create holes. More robust lookup tables consider larger local context.

:::remark Key question and answer: zero iso-surface
**Question (original intent):** How do we extract the visible surface from an implicit field?

**Answer:** Evaluate the implicit function on a grid, locate cells whose vertices cross the target iso-value, and connect interpolated edge crossings according to a lookup table such as marching squares or marching cubes.
:::

DeepSDF extends this idea by learning a continuous signed distance function with a neural network.

## 7. Neural Radiance Fields and Volume Rendering

Novel view synthesis asks us to infer a 3D scene from images and camera poses, then render unseen viewpoints. Rendering maps a known 3D scene and camera parameters to images; inverse graphics infers scene structure and camera poses from images.

NeRF represents the scene as a continuous 5D function:

![NeRF radiance field function](lec10_materials/nerf_radiance_field_function.png)

$$
(x,y,z,\theta,\phi)\xrightarrow{F_\Theta}(RGB,\sigma)
$$

The network predicts color and density at every queried position and viewing direction. Images are generated by volume rendering along camera rays.

The continuous volume rendering equation is:

![Volume rendering equation](lec10_materials/volume_rendering_equation.png)

$$
I(D)=I_0T(0)+\int_0^D c(s)\rho(s)T(s)\,ds,
\qquad
T(s)=\exp\left(-\int_s^D \rho(t)\,dt\right)
$$

For a ray segment with attenuation coefficient $\sigma$:

$$
\alpha(t)=1-\exp(-\sigma t)
$$

For discretized ray marching:

$$
T_i=\prod_{j=i+1}^{n}(1-\alpha_j)=
\exp\left(-\sum_{j=i+1}^{n}\sigma_j\delta_j\right)
$$

$$
I=\sum_i T_i\alpha_i\left(\frac{c_i}{\sigma_i}\right)
$$

:::tip Key question and answer: differentiable rendering
**Question (original intent):** Why is differentiable rendering useful for NeRF?

**Answer:** It lets us compare rendered images with observed images, compute a rendering loss, and update the radiance-field network by gradient descent.
:::

## 8. 3D Gaussian Splatting

NeRF parameterizes the radiance field densely and samples many points along rays, including empty space. 3D Gaussian Splatting uses a sparse scene representation: place anisotropic volumetric Gaussians only where density is nonzero.

Instead of repeatedly ray-marching through empty space, 3DGS renders by rasterization/splatting:

![Gaussian splatting rasterization](lec10_materials/gaussian_splatting_rasterization.png)

Gaussians are closed under affine transforms and integration, so a projected 3D Gaussian becomes a 2D Gaussian on the image plane:

![Projected 3D Gaussian becomes 2D](lec10_materials/projected_3d_gaussian_2d.png)

The practical rendering pipeline is:

- cull Gaussians that contribute negligibly to the pixel frustum;
- project 3D Gaussians to 2D screen-space Gaussians;
- alpha-composite the splats in visibility order;
- optimize positions, covariance, opacity, and appearance to match images.

:::remark Key question and answer: inverse graphics problem
**Question (original wording):** **"Any problems for inverse graphics, though?"**

**Answer:** Yes. Optimization can fall into local minima. Practical 3DGS systems often start from an SfM point cloud and use heuristic pruning/spawning operations to stabilize learning.
:::

## 9. PointNet: Learning on Orderless Point Sets

Point clouds are not regular grids. A point cloud contains $N$ orderless points, each represented by a $D$-dimensional coordinate or feature vector.

![Point cloud permutation problem](lec10_materials/point_cloud_permutation_problem.png)

**Key definition (lecture wording):** **"Deep net needs to be invariant to N! permutations."**

Mathematically:

$$
f(x_1,x_2,\ldots,x_n)=f(x_{\pi_1},x_{\pi_2},\ldots,x_{\pi_n}),
\qquad x_i\in\mathbb{R}^D
$$

Sorting is not a good solution because adding one point can change the entire order dramatically. PointNet instead constructs a symmetric function:

![PointNet symmetric function](lec10_materials/pointnet_symmetric_function.png)

$$
f(x_1,x_2,\ldots,x_n)=\gamma\circ g(h(x_1),\ldots,h(x_n))
$$

Here $h$ is a shared point-wise MLP, $g$ is a symmetric aggregation such as max pooling, and $\gamma$ is another MLP applied to the global feature.

![PointNet classification architecture](lec10_materials/pointnet_classification_architecture.png)

A PointNet classification network uses shared MLPs, optional input/feature transforms, max pooling to obtain a global feature, and final MLP layers for class scores.

For segmentation, concatenate local point embeddings with the global feature so that each point receives both local identity and global shape context:

![PointNet segmentation extension](lec10_materials/pointnet_segmentation_extension.png)

:::remark Key question and answer: PointNet robustness
**Question (original wording):** **"Why is PointNet so robust to point missing or inserting new points?"**

**Answer:** With max pooling, the global feature is determined by critical points that achieve channel-wise maxima. Missing or adding non-critical points often does not change the max-pooled feature much.
:::

![PointNet robustness question](lec10_materials/pointnet_robustness_question.png)

PointNet is lightweight and fast, but vanilla PointNet has important limitations:

![PointNet limitations](lec10_materials/pointnet_limitations.png)

- It has no explicit local neighborhood context for each point.
- Its global feature depends on absolute coordinates, making generalization to unseen scene configurations harder.

These limitations motivate hierarchical point networks such as PointNet++.

## 10. Exam Review

### Core definitions

- Voxel grid: regular 3D grid, easy to index but memory-expensive.
- Mesh: explicit piecewise-linear surface with vertices, edges, and faces.
- Point cloud: orderless set of sampled 3D points, compact but not a surface.
- SDF: implicit function whose zero set is the surface.
- Chamfer Distance: bidirectional nearest-neighbor distance between point sets.
- EMD: minimum-cost bijective matching distance between equal-size point sets.
- NeRF: continuous radiance field mapping 3D position and view direction to color and density.
- 3DGS: sparse anisotropic Gaussian scene representation rendered by splatting.
- PointNet: point-set network using shared MLPs and symmetric pooling.

### Short-answer templates

- To compare 3D representations: discuss regularity, memory, surface information, topology, differentiability, and downstream model compatibility.
- To explain stereo depth: correspondence gives disparity; $u-u'=Bf/z$; disparity is inverse to depth.
- To explain mesh vs. point cloud: mesh stores connectivity and surfaces; point cloud stores samples and needs extra reconstruction for surfaces.
- To explain implicit surfaces: define $F(x,y,z)$, identify the zero set, then mention marching cubes or neural SDFs.
- To explain NeRF: input position and view direction, output color and density, render by differentiable volume integration.
- To explain 3DGS: start from sparse Gaussians, project to 2D Gaussians, rasterize/splat, then optimize by image loss.
- To explain PointNet: point-wise shared MLP, symmetric max pooling for permutation invariance, final MLP for prediction.

### Common mistakes

- Treating depth images as complete 3D geometry.
- Forgetting that point clouds are orderless.
- Assuming uniform sampling always gives evenly spaced points.
- Confusing Chamfer Distance with one-to-one matching.
- Treating SDF values as occupancy labels only; the sign and distance magnitude both matter.
- Saying NeRF stores a mesh; it stores a continuous radiance field.
- Ignoring PointNet's lack of local context.

### Self-check

1. Can you explain why voxels are easy for CNNs but expensive in memory?
2. Can you derive why stereo disparity is inversely proportional to depth?
3. Can you describe how to uniformly sample a triangle and why the fold-back step is needed?
4. Can you compare Chamfer Distance and EMD?
5. Can you explain how marching cubes extracts a mesh from an SDF?
6. Can you write the volume rendering equation and identify color, density, and transmittance?
7. Can you explain why max pooling makes PointNet permutation-invariant?
