# Lec12 Collision, Plasticity, and Fracture

## 1. Big Picture
This lecture ties together three topics that often meet in one simulator:

- Collision handling: detect contact candidates, certify actual intersections, and modify motion so trajectories stay admissible.
- Plasticity: model permanent deformation after the material exceeds its elastic range.
- Fracture: decide when deformation should create topological change such as cracks or separation.

A useful mental map is:

1. Collision detection = broad phase + narrow phase.
2. Each detection stage has a discrete and a continuous version.
3. Collision response can also be discrete or continuous.
4. Once collision and contact are under control, we can move on to material behaviors beyond elasticity, namely plastic flow and fracture.

![Collision detection pipeline](lec12_materials/collision_detection_pipeline.png)

## 2. Collision Detection
### 2.1 Broad-Phase Goals
**Key statement (slide wording): Broad-phase determines pairs of (potentially) colliding objects. No need to be 100% exact, but avoid false negatives.**

If we test every pair directly, the brute-force cost is

$$
C_n^2=\frac{n(n-1)}{2}.
$$

That cost quickly becomes unacceptable, so broad phase uses cheap geometric filters to eliminate obviously impossible pairs before expensive exact tests.

The main design principle is asymmetric:

- False positives are acceptable because narrow phase will filter them out later.
- False negatives are dangerous because a real collision would be missed entirely.

### 2.2 AABB Sweep-and-Prune
Axis-aligned bounding boxes (AABBs) are the simplest practical filter.

- Wrap each object in an AABB.
- Project each AABB to the coordinate axes.
- Sort interval endpoints.
- Prune pairs that do not overlap on at least one axis.
- Run object-object tests only on pairs that overlap on all tested axes.

The slide highlights the typical cost:

$$
O(n\log n + k),
$$

where $k$ is the number of surviving candidate pairs after pruning.

![AABB sweep-and-prune](lec12_materials/aabb_sweep_and_prune.png)

AABB broad phase works well when objects are not too rotated relative to the coordinate frame. Its weakness is looseness: when the real shape is thin or rotated, the box can contain a lot of empty space, which creates many false positives.

### 2.3 OBBs and the Separating Axis Test
When orientation matters, oriented bounding boxes (OBBs) are tighter. Their standard overlap test is the Separating Axis Test (SAT).

**Key statement (slide wording): Two objects A, B are disjoint if for some vector $\mathbf{v}$ the projections $A\mathbf{v}$ and $B\mathbf{v}$ onto the vector do not overlap.**

That vector is called a separating axis.

For 3D OBBs, it is enough to test 15 axes:

- 3 face normals of box A,
- 3 face normals of box B,
- 9 cross-product axes formed by one edge direction from each box.

![OBB separating axis test](lec12_materials/obb_separating_axis_test.png)

This is tighter than AABB but more expensive. The lecture also leaves a compact reminder that for CCD, people sometimes reason with spacetime versions such as “OBBs in 4D”.

### 2.4 BVH for Large-Scale and Self-Collision
Bounding volume hierarchies (BVHs) organize objects or primitives into a tree based on geometric or topological proximity.

The main benefit is recursive culling:

- If two high-level bounding volumes do not intersect, all descendants are discarded at once.
- If they do intersect, we descend only into the relevant children.

For self-collision, the lecture uses two mutually recursive ideas:

- `Process_Node(A)`: recurse into a node and test pairs among its children.
- `Process_Pair(B, C)`: recurse into two nodes only when their bounding volumes intersect.

![BVH self-collision recursion](lec12_materials/bvh_self_collision_recursion.png)

This gives a clean way to avoid blindly testing every primitive pair inside the same object. Performance depends heavily on how effective the hierarchy is at culling.

### 2.5 Spatial Partitioning and Hashing
Another line of broad phase partitions space instead of object sets.

Typical structures include:

- uniform grids,
- quadtrees and octrees,
- kd-trees,
- BSP-style partitions.

For moving objects, we often enlarge the occupied region so the partition still catches motion over the time step.

A concrete example from the lecture is grid-cell hashing for vertex-triangle tests:

$$
H(x,y,z):=[(z*\mathrm{gridsize}+y)*\mathrm{gridsize}+x]\bmod n.
$$

The pipeline is:

1. Hash vertices by their containing cell.
2. Hash tetrahedra or triangles by all cells touched by their bounding box.
3. Run narrow-phase tests only among primitives that fall into the same hash bucket.

![Spatial hashing for vertex-triangle tests](lec12_materials/spatial_hashing_vertex_triangle.png)

This is attractive when the scene is dynamic and local density is not too pathological.

## 3. Narrow-Phase Collision Detection
### 3.1 DCD: Discrete Collision Detection
**Key definition (slide wording): DCD tests if any intersection exists in each state at discrete time instant: $\mathbf{x}^{[0]}, \mathbf{x}^{[1]}, \ldots$**

For triangle meshes, the basic discrete test is edge-triangle intersection.

Let the moving point on the edge be

$$
\mathbf{x}(t)=(1-t)\mathbf{x}_a+t\mathbf{x}_b.
$$

To intersect the triangle plane, it must satisfy

$$
\bigl((1-t)\mathbf{x}_a+t\mathbf{x}_b-\mathbf{x}_0\bigr)\cdot(\mathbf{x}_{10}\times\mathbf{x}_{20})=0,
$$

which gives

$$
t=\frac{\mathbf{x}_{0a}\cdot(\mathbf{x}_{10}\times\mathbf{x}_{20})}{\mathbf{x}_{ba}\cdot(\mathbf{x}_{10}\times\mathbf{x}_{20})}.
$$

We then check two things:

- whether $t\in[0,1]$, so the hit lies on the edge segment,
- whether $\mathbf{x}(t)$ lies inside the triangle.

![DCD edge-triangle test](lec12_materials/dcd_edge_triangle_test.png)

:::remark Key Question (original wording): Inside?
Solving the edge-plane equation only tells us that the line segment meets the triangle's supporting plane. A collision is confirmed only if the intersection point also lies inside the triangle region, not merely on the infinite plane.
:::

DCD is simple and often robust, but it has one famous failure mode: tunneling. If the object moves from one side of another object to the other side between two sampled states, neither endpoint state may show an intersection, even though a collision happened in between.

### 3.2 CCD: Continuous Collision Detection
**Key definition (slide wording): CCD tests if any intersection exists between two states: $\mathbf{x}^{[0]}$ and $\mathbf{x}^{[1]}$.**

For triangle meshes, two basic continuous tests appear repeatedly:

- vertex-triangle,
- edge-edge.

The core idea is to ask whether primitives become coplanar at some time within the step. For the vertex-triangle case, the coplanarity condition is

$$
\mathbf{x}_{30}(t)\cdot\bigl(\mathbf{x}_{10}(t)\times\mathbf{x}_{20}(t)\bigr)=0,
$$

which expands to a cubic equation

$$
at^3+bt^2+ct+d=0.
$$

If some root lies in $[0,1]$, we then test whether the vertex lies inside the triangle at that same instant.

![CCD vertex-triangle test](lec12_materials/ccd_vertex_triangle_test.png)

For edge-edge CCD, we again solve the coplanar condition and then test whether the two segments intersect inside their finite extents at that time.

![CCD edge-edge test](lec12_materials/ccd_edge_edge_test.png)

:::remark Key Question (original intent): Why does DCD tunnel while CCD can avoid tunneling?
DCD samples only isolated states, so a collision can happen between samples and still be invisible. CCD searches over the whole time interval and asks whether a valid collision time exists, which is exactly the information needed to catch between-step events.
:::

### 3.3 Why CCD Is Harder
The lecture emphasizes three practical obstacles:

- floating-point sensitivity, especially around cubic root finding,
- higher computational cost than DCD,
- more difficult implementation and debugging.

So the usual engineering pattern is not “use CCD everywhere blindly”, but “use broad phase to reduce the workload, then spend CCD only where the extra robustness matters”.

## 4. Collision Response
### 4.1 Discrete Response: Intersection Elimination
Discrete response starts from an already intersecting state and tries to remove interpenetration directly.

This is useful when intersections already exist because of:

- large time steps,
- initialization issues,
- imported or edited geometry,
- numerical drift.

For cloth-volume and volume-volume contact, pushing vertices or edges outward is comparatively straightforward because “inside” and “outside” are well defined.

Cloth-cloth contact is much harder:

- DCD may already have missed the true event due to tunneling.
- A thin sheet does not naturally provide a global interior/exterior notion.

Baraff et al. segment cloth into regions by flood fill and then decide which region is intersecting, but the slide explicitly notes that it **cannot handle boundary well**.

![Cloth untangling by flood fill](lec12_materials/cloth_untangling_flood_fill.png)

:::remark Key Question (original intent): Why is cloth-cloth intersection elimination much harder than cloth-volume intersection elimination?
A solid volume gives a clear signed notion of “inside” and “outside”, so pushing a penetrated point outward is meaningful. A cloth surface is two-sided and thin, so after interpenetration there may be no unambiguous push-out direction, especially near boundaries or folds.
:::

The lecture also mentions later work such as intersection contour minimization as an alternative untangling strategy.

### 4.2 Continuous Response: Goal and Tradeoff
**Key statement (slide wording): Given the calculated next state $\mathbf{x}^{[1]}$, we want to update it into $\bar{\mathbf{x}}^{[1]}$, such that the path from $\mathbf{x}^{[0]}$ to $\bar{\mathbf{x}}^{[1]}$ is intersection-free.**

Two major families are contrasted:

- interior point methods,
- impact zone optimization.

The high-level tradeoff is:

- interior point methods are slower, move all vertices, and use cautious small steps, but they are very reliable,
- impact zone methods are faster, operate only on colliding regions, and can take larger steps, but may fail.

![Continuous response pros and cons](lec12_materials/continuous_response_pros_cons.png)

### 4.3 Interior Point Methods
Interior point response is written as an optimization problem:

$$
\bar{\mathbf{x}}^{[1]}\leftarrow \arg\min_{\mathbf{x}}\left(\frac{1}{2}\lVert \mathbf{x}-\mathbf{x}^{[1]}\rVert^2-\rho\sum E(d(\mathbf{x}))\right).
$$

The barrier term penalizes configurations that approach collision. A gradient-descent style update shown in the lecture is

$$
\alpha=\min(1,\mathrm{CCD}(\mathbf{x},\mathbf{v})),
$$

$$
\mathbf{x}^{(k+1)}\leftarrow \mathbf{x}^{(k)}+\alpha\left(\mathbf{x}^{[1]}-\mathbf{x}^{(k)}+\rho\sum \frac{\partial E}{\partial \mathbf{x}}\right).
$$

![Interior point gradient descent](lec12_materials/interior_point_gradient_descent.png)

A simple log barrier is

$$
E(\mathbf{x})=-\rho\log\lVert \mathbf{x}_{ij}\rVert,
$$

with corresponding repulsive forces

$$
\mathbf{f}_i(\mathbf{x})=-\nabla_iE=\rho\frac{\mathbf{x}_{ij}}{\lVert \mathbf{x}_{ij}\rVert^2},
\qquad
\mathbf{f}_j(\mathbf{x})=-\nabla_jE=-\rho\frac{\mathbf{x}_{ij}}{\lVert \mathbf{x}_{ij}\rVert^2}.
$$

:::remark Key Question (original intent): Why must the step size $\alpha$ be chosen with CCD information?
The descent direction may reduce the objective while still crossing a collision manifold on the way. CCD is used as a line-search safety certificate: it shrinks the step so the entire segment of motion stays intersection-free.
:::

### 4.4 IPC: Incremental Potential Contact
IPC inserts contact into the implicit Euler energy viewpoint.

**Key statement (slide wording): Implicit Euler = energy minimization.**

Without contact,

$$
\mathbf{x}_{n+1}=\arg\min_{\mathbf{x}}\frac{1}{2h^2}\lVert \mathbf{x}-\mathbf{y}\rVert_{\mathbf{M}}^2+E(\mathbf{x}).
$$

With contact potential,

$$
\mathbf{x}_{n+1}=\arg\min_{\mathbf{x}}\frac{1}{2h^2}\lVert \mathbf{x}-\mathbf{y}\rVert_{\mathbf{M}}^2+E(\mathbf{x})+\rho\sum E(d(\mathbf{x})).
$$

The lecture uses a $C^2$ barrier with local support:

$$
E(\mathbf{x})=
\begin{cases}
-\bigl(\lVert \mathbf{x}_{ij}\rVert-\hat d\bigr)^2\ln\left(\dfrac{\lVert \mathbf{x}_{ij}\rVert}{\hat d}\right), & 0<\lVert \mathbf{x}_{ij}\rVert<\hat d,\\[6pt]
0, & \text{else.}
\end{cases}
$$

The benefit of local support is important: once the distance is above the threshold $\hat d$, the barrier vanishes instead of affecting far-away configurations.

![IPC contact barrier](lec12_materials/ipc_contact_barrier.png)

The pseudo-code exposes the main implementation ingredients:

- compute the active constraint set,
- build the barrier-augmented objective,
- project the Hessian to SPD form,
- take a Newton step,
- use CCD to clip the step,
- recompute the constraint set and continue.

![IPC pseudo-code](lec12_materials/ipc_pseudocode.png)

The lecture also mentions two recent themes:

- SIGGRAPH 2023 work improving performance, accuracy, and GPU-friendliness,
- SIGGRAPH Asia 2024 work on contact solvers such as `ppf-contact-solver`.

Friction is noted as being formulated as a lagged dissipative potential.

### 4.5 Impact Zone Optimization and a Practical Pipeline
**Key statement (slide wording): The goal of impact zone optimization is to optimize $\mathbf{x}^{[1]}$ until it becomes intersection-free.**

Its objective is

$$
\bar{\mathbf{x}}^{[1]}\leftarrow \arg\min_{\mathbf{x}}\frac{1}{2}\lVert \bar{\mathbf{x}}-\mathbf{x}^{[1]}\rVert^2,
$$

subject to non-penetration constraints such as

$$
C(\mathbf{x})=-(\mathbf{x}_3-b_0\mathbf{x}_0-b_1\mathbf{x}_1-b_2\mathbf{x}_1)\cdot\mathbf{N}\le 0
$$

for a detected vertex-triangle pair, and

$$
C(\mathbf{x})=-(b_2\mathbf{x}_2+b_3\mathbf{x}_3-b_0\mathbf{x}_0-b_1\mathbf{x}_1)\cdot\mathbf{N}\le 0
$$

for a detected edge-edge pair.

Geometrically, these constraints keep the relevant primitive pair from crossing along the contact normal.

A practical system from the lecture is:

1. run CCD,
2. identify and optimize impact zones,
3. if needed, either use an interior point method or freeze colliding vertices back to their pre-collision state as rigid impact zones.

![Practical continuous response system](lec12_materials/practical_collision_response_system.png)

:::remark Key Question (original intent): Why can impact zone optimization be fast yet still fail?
It only updates vertices involved in collision and can therefore make larger, cheaper moves than global interior-point optimization. But because it works on a reduced active set, it can miss interactions outside that set and may still suffer from tunneling or infeasible local decisions.
:::

:::remark Note on the slide formula
The vertex-triangle constraint on the slide repeats $\mathbf{x}_1$ in the barycentric combination. This note preserves the formula as shown in the image, but the geometric intent is clear: the orange point is the barycentric point on the triangle used to define the non-penetration constraint.
:::

## 5. Plasticity and Fracture
### 5.1 Stress Measures and Material Stages
Once deformation exceeds the elastic regime, we care about yield, hardening, necking, and eventually fracture.

The lecture places two stress measures side by side:

- Cauchy stress uses the current area,
- PK stress uses the reference area.

The slide formulas are

$$
\sigma_t=\frac{F}{A}=\frac{F}{A_0}\frac{A_0}{A},
\qquad
\mathbf{P}=\frac{F}{A_0}.
$$

![Cauchy stress and PK stress](lec12_materials/cauchy_vs_pk_stress.png)

A related continuum relation that later appears in fracture visualization is the traction law

$$
\mathbf{t}=\boldsymbol{\sigma}\mathbf{n},
$$

which maps an interface normal $\mathbf{n}$ to the traction vector on that oriented surface.

:::remark Key Question (original intent): Why do both Cauchy stress and PK stress appear in simulation notes?
Cauchy stress is physically tied to forces on the current deformed configuration, so it is natural for traction and spatial balance laws. PK stress is referenced to the rest configuration, which makes it much easier to pair with deformation gradients and energy derivatives in Lagrangian simulation.
:::

### 5.2 Plastic Strain Model
The strain measure on the slide is Green strain:

$$
\boldsymbol{\epsilon}=\frac{1}{2}(\mathbf{F}^T\mathbf{F}-\mathbf{I})=
\begin{bmatrix}
\epsilon_{uu} & \epsilon_{uv}\\
\epsilon_{uv} & \epsilon_{vv}
\end{bmatrix}.
$$

Elastic energy is evaluated on elastic strain only:

$$
E=\int W(\epsilon_e)\,dA,
\qquad
\epsilon_e=\epsilon-\epsilon_p.
$$

The plastic strain starts from zero in the reference state and is updated by a yield-and-clamp rule:

$$
\epsilon_p^{\mathbf{x}=\mathbf{X}}=0,
$$

$$
\epsilon_p^{t=i+1}=\left(\epsilon_p^{t=i}+\Delta\epsilon_p\right)
\min\left(1,\frac{\gamma_2}{\lVert \epsilon_p^{t=i}+\Delta\epsilon_p\rVert_F}\right),
$$

$$
\Delta\epsilon_p=
\frac{\max(0,\lVert \epsilon'\rVert_F-\gamma_1)}{\lVert \epsilon'\rVert_F}\,\epsilon',
\qquad
\epsilon'=\epsilon_e-\frac{\mathrm{Tr}(\epsilon_e)}{3}\mathbf{I}_3.
$$

Here $\gamma_1$ is the yield threshold and $\gamma_2$ limits the accumulated plastic strain.

![Plasticity strain model](lec12_materials/plasticity_strain_model.png)

### 5.3 Fracture by FEM + Remeshing
A classical fracture pipeline in the lecture is

$$
\text{strain} \rightarrow \text{stress tensor }\sigma \rightarrow \text{tensile/compressive forces} \rightarrow \text{separation tensor} \rightarrow \text{remeshing}.
$$

The tensile and compressive stress parts are written as

$$
\sigma^+=\sum_{i=1}^3\max(0,\nu^i(\sigma))\,\mathbf{m}(\hat{\mathbf{n}}^i(\sigma)),
$$

$$
\sigma^-=\sum_{i=1}^3\min(0,\nu^i(\sigma))\,\mathbf{m}(\hat{\mathbf{n}}^i(\sigma)).
$$

The auxiliary map is

$$
\mathbf{m}(\mathbf{a})=
\begin{cases}
\mathbf{a}\mathbf{a}^T/\lvert \mathbf{a}\rvert, & \mathbf{a}\neq 0,\\
0, & \mathbf{a}=0.
\end{cases}
$$

The separation tensor shown on the slide is

$$
\zeta=\frac{1}{2}\left(-\mathbf{m}(\mathbf{f}^+)+\sum_{\mathbf{f}\in\{\mathbf{f}^+\}}\mathbf{m}(\mathbf{f})+\mathbf{m}(\mathbf{f}^-)-\sum_{\mathbf{f}\in\{\mathbf{f}^-\}}\mathbf{m}(\mathbf{f})\right).
$$

If the largest positive eigenvalue $\nu^+$ of $\zeta$ exceeds the toughness threshold $\tau$, the mesh is separated with a fracture plane perpendicular to the corresponding eigenvector $\mathbf{n}^+$.

![FEM remeshing fracture pipeline](lec12_materials/fem_remeshing_fracture_pipeline.png)

This method is physically meaningful but expensive, and remeshing can create ill-shaped elements.

### 5.4 Other Fracture Directions
The lecture gives a compact comparison:

- FEM + remeshing: physically expressive but slow and mesh-quality sensitive.
- Mass spring + pre-fracture: cheap and controllable, but the crack pattern is often fixed and unphysical.
- Meshless particle-based methods: avoid remeshing and represent fracture through particle interactions.
- XFEM: decouple the simulation mesh from the crack surface.

### 5.5 Meshless Particle-Based Methods
Meshless fracture methods update particle motion and deformation without explicitly cutting a finite-element mesh.

The slide shows a force accumulation of the form

$$
\mathbf{T}_a=-\sum_b V_b\,\boldsymbol{\sigma}_b\,\nabla \widetilde W_{ba},
$$

and a deformation-gradient update

$$
\mathbf{F}_p^{n+1}=\mathbf{F}_p^n(\mathbf{I}+\Delta t\nabla \mathbf{v}).
$$

It also lists the standard tensor quantities

$$
J=\det(\mathbf{F}),
\qquad
\mathbf{B}=\mathbf{F}\mathbf{F}^T,
\qquad
\bar{\mathbf{B}}=J^{-2/3}\mathbf{B}.
$$

The conceptual pipeline is:

1. body force drives particle velocity and position,
2. velocity gradients update deformation,
3. deformation determines strain and stress,
4. stress feeds back into deformation energy and fracture decisions.

![Meshless fracture methods](lec12_materials/meshless_fracture_methods.png)

### 5.6 XFEM
XFEM is presented as a way to decouple the crack surface from the simulation mesh.

**Key statement (slide wording): The extended Finite Element Method (XFEM) is proposed for decoupling the simulation mesh from the crack surface.**

The main points are:

- crack surfaces are represented by level sets,
- surface remeshing is needed only for rendering,
- the central difficulty is integration over discontinuous integrands on polyhedral domains.

![XFEM overview](lec12_materials/xfem_overview.png)

This is attractive because it avoids rebuilding the simulation mesh every time the crack geometry changes.

### 5.7 Exemplar-Based Plasticity
The final example is data-driven plastic deformation of rigid bodies.

Instead of relying only on analytic constitutive laws, the method blends example deformations and updates interpolation weights by gradient descent.

The slide shows three core expressions:

$$
\Delta \mathbf{x}_i=\alpha\cdot\max(\lVert \mathbf{j}_i\rVert-\mathrm{yield},0)\cdot\frac{\mathbf{j}_i}{\lVert \mathbf{j}_i\rVert},
$$

$$
\mathbf{x}_i=\sum W\cdot\mathrm{interpolate}(\mathbf{T}_0,\mathbf{T}_1,\ldots,\mathbf{e})\cdot\mathbf{u}_i,
$$

$$
\Delta \mathbf{e}=\lVert \Delta \mathbf{x}\rVert\frac{\mathbf{J}^T\Delta \mathbf{x}}{\lVert \mathbf{J}^T\Delta \mathbf{x}\rVert}.
$$

![Exemplar-based plasticity](lec12_materials/exemplar_based_plasticity.png)

This is a reminder that permanent deformation can also be learned or example-guided, not only derived from classical continuum models.

## 6. Exam Review
### A. Definitions You Should State Precisely
- **Broad phase**: a cheap culling stage that preserves all true collisions while allowing false positives.
- **DCD**: a test for intersection at sampled discrete states.
- **CCD**: a test for whether intersection happens anywhere during an entire time interval.
- **Interior point collision response**: optimize the next state with a barrier that prevents trajectories from crossing into collision.
- **IPC**: implicit-Euler energy minimization plus a contact barrier potential.
- **Plasticity**: permanent deformation after the material exceeds its elastic regime.
- **Fracture**: topological separation caused by sufficiently strong stress or deformation.

### B. Mechanism Chains to Memorize
1. Broad phase: cheap bounding or spatial filter $\rightarrow$ candidate pairs.
2. Narrow phase: exact primitive test $\rightarrow$ confirmed collision information.
3. Continuous response: modify $\mathbf{x}^{[1]}$ into $\bar{\mathbf{x}}^{[1]}$ so the entire path is collision-free.
4. Plasticity: compute strain $\rightarrow$ split elastic/plastic part $\rightarrow$ apply yield rule $\rightarrow$ update permanent deformation.
5. Fracture: compute stress $\rightarrow$ derive crack-driving measure $\rightarrow$ compare with toughness $\rightarrow$ separate or enrich geometry.

### C. Short-Answer Templates
- Why is broad phase allowed to be inexact?
It must be conservative, not exact: false positives only increase narrow-phase work, while false negatives miss real collisions.

- Why is CCD more expensive than DCD?
Because CCD solves for collision time over a continuous interval, often through root finding and additional inside tests, instead of checking only isolated states.

- Why is IPC robust?
Because contact is built into the minimized objective by a barrier potential, and each update is clipped by CCD so the step remains intersection-free.

- Why does remeshing-based fracture cost more?
Because crack formation changes topology, so the discretization itself must be updated while preserving element quality.

### D. Common Pitfalls
- Treating broad phase as if it must be exact.
- Forgetting that plane intersection is not the same as triangle or segment intersection.
- Assuming DCD can guarantee collision-free motion for fast objects.
- Writing a barrier term but taking a full Newton step without CCD-safe clipping.
- Mixing Cauchy stress and PK stress as if they lived in the same configuration.
- Thinking plasticity and fracture are the same phenomenon.

### E. Self-Check Questions
1. Why can AABB sweep-and-prune achieve $O(n\log n+k)$ instead of brute-force $O(n^2)$?
2. After solving a coplanar time in CCD, what extra test is still required?
3. Why is cloth-cloth untangling harder than volume push-out?
4. What role does the contact barrier play in IPC?
5. How do $\sigma_t=F/A$ and $\mathbf{P}=F/A_0$ differ conceptually?
6. What do $\gamma_1$, $\gamma_2$, and $\tau$ control in the lecture's plasticity/fracture models?

:::remark Self-check Reference Answers
1. Sorting projected intervals costs $O(n\log n)$, and only overlapping interval pairs survive to the candidate set of size $k$.
2. An inside test is still needed: vertex inside triangle, or segment-segment overlap inside their finite extents.
3. Cloth has no clean global inside/outside notion and is easily tangled by missed between-step events, especially near folds and boundaries.
4. It makes approaching contact infinitely or sharply expensive before penetration occurs, turning non-penetration into an optimization-friendly energy term.
5. Cauchy stress measures force per current area in the deformed configuration, while PK stress measures force per reference area in the rest configuration.
6. $\gamma_1$ is the yield threshold, $\gamma_2$ caps accumulated plastic strain, and $\tau$ is the toughness threshold for fracture.
:::
