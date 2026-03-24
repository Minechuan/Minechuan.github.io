# Lec3 Rigid Body Collision and Shape Matching

## 1. Why This Lecture Matters

This lecture closes the loop of rigid-body simulation: after we know how to integrate rigid motion, we still need robust collision and contact handling. The lecture compares force-based, impulse-based, and position-based ideas, and shows where each one is strong or weak.

![Method comparison overview](lec03_materials/methods_comparison_overview.png)

:::remark Key Question: Why is collision handling still hard after we already have equations of motion?
Because contact introduces discontinuity and inequality constraints. Velocities can jump, penetrations must be prevented, and friction couples normal and tangential motion.
:::

## 2. Collision and Contact Pipeline

A practical decomposition used throughout the lecture is:

1. Collision detection
2. Collision response
3. Contact handling for persistent interactions

The lecture emphasizes that method choice depends on target goals:

- Games: prioritize stability and speed
- High-fidelity simulation: combine impulse with stronger constraints
- Robotics/control: prefer global constraint solves

## 3. SDF-Based Collision Detection

### 3.1 Signed Distance Function Basics

A **signed distance function** $\phi(\mathbf{x})$ encodes both distance and side information:

- **$\phi(\mathbf{x}) > 0$**: outside
- **$\phi(\mathbf{x}) < 0$**: inside
- **$\phi(\mathbf{x}) = 0$**: on the surface

![SDF sign convention](lec03_materials/sdf_sign_definition.png)

Representative SDFs:

$$
\phi_{\text{plane}}(\mathbf{x})=(\mathbf{x}-\mathbf{p})\cdot\mathbf{n},
\qquad
\phi_{\text{sphere}}(\mathbf{x})=\lVert\mathbf{x}-\mathbf{c}\rVert-r
$$

### 3.2 Composition by CSG Rules

For multiple implicit surfaces:

$$
\phi_{\cap}(\mathbf{x})=\max_i\phi_i(\mathbf{x}),
\qquad
\phi_{\cup}(\mathbf{x})=\min_i\phi_i(\mathbf{x})
$$

![SDF intersection rule](lec03_materials/sdf_intersection_max_rule.png)

:::tip Key Question: Why does intersection use max, while union uses min?
For intersection, a point is inside only if it is inside every shape, so the largest signed distance controls feasibility. For union, being inside any shape is enough, so the smallest signed distance controls membership.
:::

## 4. Force-Based Penalty Methods

### 4.1 Quadratic Penalty

When penetration happens, apply force along normal:

$$
\mathbf{f}\leftarrow-k\,\phi(\mathbf{x})\,\mathbf{N},
\qquad
\mathbf{N}=\nabla\phi(\mathbf{x})
$$

The potential is quadratic in penetration depth, so force is linear near contact.

![Quadratic penalty force](lec03_materials/quadratic_penalty_contact_force.png)

### 4.2 Buffer Zone Variant

Use a buffer $\varepsilon$ and activate penalty before true penetration:

$$
\text{if }\phi(\mathbf{x})<\varepsilon,\quad
\mathbf{f}\leftarrow k(\varepsilon-\phi(\mathbf{x}))\mathbf{N}
$$

This reduces deep penetration, but does not strictly guarantee non-penetration.

### 4.3 Log-Barrier Penalty

Barrier-style force:

$$
\mathbf{f}\leftarrow\rho\,\frac{1}{\phi(\mathbf{x})}\mathbf{N}
$$

![Log-barrier penalty](lec03_materials/log_barrier_penalty_force.png)

It can become very large near the boundary, but it requires maintaining $\phi(\mathbf{x})>0$ and careful time-step control.

:::warn Key Question: If barrier force is strong, why can simulation still fail?
Because finite time stepping can overshoot the barrier. Without adaptive $\Delta t$ or safety measures, a state may jump directly to invalid penetration.
:::

## 5. Impulse Method for Particle Contact

Impulse methods treat collision as an instantaneous event affecting position and velocity.

### 5.1 Position and Velocity Update

Position projection at contact:

$$
\mathbf{x}_{new}\leftarrow\mathbf{x}-\phi(\mathbf{x})\nabla\phi(\mathbf{x})
$$

Velocity split and update:

$$
\mathbf{v}_N=(\mathbf{v}\cdot\mathbf{N})\mathbf{N},
\qquad
\mathbf{v}_T=\mathbf{v}-\mathbf{v}_N
$$

$$
\mathbf{v}_N^{new}=-\mu_N\mathbf{v}_N,
\qquad
\mathbf{v}_T^{new}=a\mathbf{v}_T,
\qquad
\mathbf{v}_{new}=\mathbf{v}_N^{new}+\mathbf{v}_T^{new}
$$

$$
a\leftarrow\max\left(1-\frac{\mu_T}{1+\mu_N}\frac{\lVert\mathbf{v}_N\rVert}{\lVert\mathbf{v}_T\rVert},0\right)
$$

![Particle impulse update](lec03_materials/particle_impulse_position_velocity_update.png)

:::remark Key Question: Why is position correction alone insufficient?
Only correcting position removes interpenetration at the current frame. Without velocity correction, the particle may immediately re-penetrate in the next frame.
:::

## 6. Rigid-Body Impulse Response

For contact point $\mathbf{x}_i=\mathbf{x}+\mathbf{R}\mathbf{r}_i$:

$$
\mathbf{v}_i=\mathbf{v}_{cm}+\boldsymbol{\omega}\times(\mathbf{R}\mathbf{r}_i)
$$

Applying contact impulse $\mathbf{j}$ updates rigid-body state as:

$$
\mathbf{v}^{new}=\mathbf{v}+\frac{1}{M}\mathbf{j},
\qquad
\boldsymbol{\omega}^{new}=\boldsymbol{\omega}+\mathbf{I}^{-1}((\mathbf{R}\mathbf{r}_i)\times\mathbf{j})
$$

Contacts are classified via normal relative velocity:

$$
v_{rel}=\mathbf{n}\cdot(\mathbf{v}_A-\mathbf{v}_B)
$$

- $v_{rel}<0$: colliding
- $v_{rel}=0$: sliding
- $v_{rel}>0$: separating

### 6.1 Frictionless Impulse Magnitude

For two rigid bodies (3D), the scalar impulse magnitude follows a restitution model:

$$
J=\frac{-(1+c)\,\mathbf{n}\cdot\mathbf{v}_{rel}}
{\frac{1}{M_a}+\frac{1}{M_b}+\left(\mathbf{I}_a^{-1}(\mathbf{x}_a\times\mathbf{n})\times\mathbf{x}_a+\mathbf{I}_b^{-1}(\mathbf{x}_b\times\mathbf{n})\times\mathbf{x}_b\right)\cdot\mathbf{n}}
$$

![Frictionless rigid-body impulse](lec03_materials/rigid_body_frictionless_impulse_formula.png)

## 7. Frictional Rigid-Body Collision

Tangential friction is added by decomposing total impulse:

$$
\mathbf{J}=J_n\mathbf{n}+J_t\mathbf{t},
\qquad
J_t\in[-\mu J_n,\mu J_n]
$$

The clamp enforces a Coulomb-style friction bound.

![Frictional rigid-body impulse](lec03_materials/rigid_body_frictional_impulse_formula.png)

:::tip Key Question: Why clamp tangential impulse?
Without clamping, the tangential correction could inject nonphysical energy or violate friction cones, causing unstable sliding behavior.
:::

## 8. Vertex-Wise Impulse Solve for Complex Bodies

For mesh-like rigid bodies (the lecture uses a rigid rabbit example), each tested vertex can generate a local velocity target, then we solve for impulse:

$$
\Delta\mathbf{v}_i=\mathbf{v}_i^{new}-\mathbf{v}_i=\mathbf{K}\mathbf{j}
$$

$$
\mathbf{K}=\frac{1}{M}\mathbf{I}_3-(\mathbf{R}\mathbf{r}_i)^*\mathbf{I}^{-1}(\mathbf{R}\mathbf{r}_i)^*
$$

$$
\mathbf{j}=\mathbf{K}^{-1}(\mathbf{v}_i^{new}-\mathbf{v}_i)
$$

with cross-product matrix form $\mathbf{r}\times\mathbf{q}=\mathbf{r}^*\mathbf{q}$.

![Vertex-wise impulse workflow](lec03_materials/vertex_wise_impulse_workflow.png)

## 9. Multiple Contacts and Coupled Impulses

When many contacts happen simultaneously, impulses are coupled. The lecture writes a block linear system where each joint velocity change depends on multiple impulses.

The key takeaway is: sequential independent impulses are often insufficient for dense contacts; coupled solve improves consistency.

## 10. Position-Based Alternative: Shape Matching

### 10.1 Two-Stage Idea

1. Predict positions independently by velocities and external forces.
2. Re-project all points to the closest rigid transform.

This trades strict force fidelity for robustness.

### 10.2 Optimization Formulation

Given predicted points $\mathbf{y}_i$, solve:

$$
\min_{\mathbf{c},\mathbf{R}}\sum_i\frac{1}{2}\lVert\mathbf{c}+\mathbf{R}\mathbf{r}_i-\mathbf{y}_i\rVert^2
$$

Closed-form structure:

$$
\mathbf{c}=\frac{1}{N}\sum_i\mathbf{y}_i,
\qquad
\mathbf{A}=\left(\sum_i(\mathbf{y}_i-\mathbf{c})\mathbf{r}_i^T\right)\left(\sum_i\mathbf{r}_i\mathbf{r}_i^T\right)^{-1}
$$

Then polar decomposition $\mathbf{A}=\mathbf{R}\mathbf{S}$, and project back:

$$
\mathbf{x}_i\leftarrow\mathbf{c}+\mathbf{R}\mathbf{r}_i,
\qquad
\mathbf{v}_i\leftarrow\frac{\mathbf{c}+\mathbf{R}\mathbf{r}_i-\mathbf{x}_i}{\Delta t}
$$

![Shape matching formulation](lec03_materials/shape_matching_least_squares_formulation.png)
![Shape matching algorithm](lec03_materials/shape_matching_algorithm_pipeline.png)

:::remark Key Question: Why is shape matching popular in real-time engines?
Because it is simple, stable, and easy to integrate with particle/cloth pipelines. The trade-off is lower physical faithfulness in strict contact/friction scenarios.
:::

## 11. Practical Method Selection

- Force-based penalty: intuitive and easy to start, but needs step-size and stiffness tuning.
- Impulse-based: physically meaningful for impact, but stacking and many-contact coupling need extra care.
- Position-based shape matching: robust and fast in practice, but less accurate for strict friction goals.

## 12. Exam Review

### 12.1 High-Value Definitions

- **Collision pipeline**: detection + response + contact handling.
- **SDF**: scalar field encoding signed distance to boundary.
- **Penalty method**: contact modeled as force from a potential.
- **Impulse method**: instantaneous velocity jump at collision.
- **Shape matching**: projection of predicted points to nearest rigid transform.

### 12.2 Mechanism Checklist

1. Build/choose a collision detector (SDF or geometry library).
2. Classify contact by relative velocity.
3. Compute normal and tangential response (with restitution and friction bounds).
4. Update rigid translational and angular velocity consistently.
5. For many contacts, solve coupled impulses when needed.
6. If using shape matching, complete predict-then-project loop each step.

### 12.3 Short-Answer Templates

- Why does penalty need step-size control?
Because the force is integrated over finite $\Delta t$; too large a step causes overshoot and penetration.

- Why can impulse outperform penalty in impact events?
Because impact is inherently discontinuous, and impulse directly models the velocity jump.

- Why use shape matching if it is less physically strict?
Because it offers strong stability and real-time performance with low implementation complexity.

### 12.4 Common Pitfalls

- Mixing coordinate spaces for contact point, normal, and inertia terms.
- Ignoring friction bounds when applying tangential impulses.
- Solving dense contacts independently and accumulating inconsistency.
- Treating shape matching output as exact force-based dynamics.

### 12.5 Self-Check Before Submission

1. Can I derive collision classification from $v_{rel}$?
2. Can I explain how impulse updates both $\mathbf{v}$ and $\boldsymbol{\omega}$?
3. Can I contrast penalty vs impulse failure modes?
4. Can I write the shape-matching objective and its projection steps?
5. Can I justify method choice for game, high-fidelity simulation, and robotics?
