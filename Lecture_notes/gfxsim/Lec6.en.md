# Lec6 FLIP: Fluid Implicit Particle, Drift Compensation, and Numerical Diffusion Reduction

## 1. Governing Equations and Hybrid Perspective

FLIP/PIC fluid solvers in graphics start from the same continuum model:

$$
\rho \frac{D\mathbf{v}}{Dt} = -\nabla p + \rho\mathbf{g} + \mu\nabla^2\mathbf{v}
$$

$$
\frac{\partial \rho}{\partial t} = -\nabla\cdot(\rho\mathbf{v}),
\qquad
\frac{D\rho}{Dt}=0 \Rightarrow \nabla\cdot\mathbf{v}=0
$$

The key interpretation is still the same: material acceleration is naturally Lagrangian, while pressure/viscosity operators are naturally Eulerian.

![Physics model, Navier-Stokes terms, and PIC context](lec06_materials/physics_model_navier_stokes_and_pic_context.png)

:::remark Key Question (original intent): "The left-hand side is in Lagrangian perspective & the right-hand side is in Eulerian perspective." Why does this matter for implementation?
Because it tells us how to split work: use particles to carry motion history and use grids to solve incompressibility and differential operators robustly. PIC/FLIP is exactly this mixed design.
:::

## 2. PIC Baseline and Its Dissipation Problem

The central PIC statement is **"Particles carry velocity → can skip grid advection!"**

Typical split steps are:

$$
\frac{\partial \mathbf{u}}{\partial t}=-(\mathbf{u}\cdot\nabla)\mathbf{u},
\quad
\frac{\partial \mathbf{u}}{\partial t}=\mathbf{g},
\quad
\frac{\partial \mathbf{u}}{\partial t}=\frac{\mu}{\rho}\Delta\mathbf{u},
\quad
\frac{\partial \mathbf{u}}{\partial t}=-\frac{1}{\rho}\nabla p
$$

![PIC particle-grid-pressure cycle](lec06_materials/pic_pipeline_particle_grid_pressure_cycle.png)

A practical loop is:

```cpp
for (int step = 0; step < numSubSteps; step++) {
  integrateParticles(sdt);
  handleParticleCollisions(boundaryConditions);
  transferVelocities(toGrid=true);
  solveIncompressibility();
  transferVelocities(toGrid=false);
}
```

:::remark Key Question (original phrase): **"Problem: dissipation due to interpolation between particles and grids."** Why does PIC lose detail?
PIC overwrites particle velocity with interpolated grid velocity. Each transfer acts like low-pass filtering, so small-scale vortical motion decays quickly.
:::

## 3. FLIP Update Rule and FLIP95 Blending

FLIP keeps particle velocity history and applies only increments from the grid, e.g.

$$
\Delta\mathbf{u}\sim -\frac{\Delta t}{\rho}\nabla p
$$

This corresponds to the lecture sentence **"Particles keep their velocities → only update velocity changes"**.

To balance stability and detail, the lecture uses

$$
\mathbf{u}_p = 0.05\,\mathbf{u}_p^{\mathrm{PIC}} + 0.95\,\mathbf{u}_p^{\mathrm{FLIP}}
$$

![PIC and FLIP velocity update comparison](lec06_materials/pic_vs_flip_velocity_update_comparison.png)

:::remark Key Question (original intent): Why not use pure FLIP all the time?
Pure FLIP preserves detail but can be noisy. A small PIC portion adds damping that improves robustness, giving a better stability-detail tradeoff in practice.
:::

## 4. FLIP95 Implementation Details

### 4.1 Particle Integration and Boundary Handling

Particle update:

$$
\mathbf{v}_i \leftarrow \mathbf{v}_i + \Delta t\,\mathbf{g},
\qquad
\mathbf{x}_i \leftarrow \mathbf{x}_i + \Delta t\,\mathbf{v}_i
$$

Boundary clamping shown in lecture (x direction example):

$$
\text{if } x_i.x < x_{\min}+h+r:\; x_i.x=h+r,\; v_i.x=0
$$

$$
\text{if } x_i.x > x_{\min}+(\mathrm{res}-1)h-r:\; x_i.x=(\mathrm{res}-1)h-r,\; v_i.x=0
$$

The boundary note is **"No-stick boundary: Only replace \(u_{i,j}\) (along normal) with \(u_{solid}\)"**.

### 4.2 Particle/Grid Transfer and Weights

![FLIP95 transfer formulas and weighting geometry](lec06_materials/flip95_particle_grid_transfer_and_weights.png)

Particle-to-grid:

$$
u_i = \frac{\sum_p w_p u_p}{\sum_p w_p}
$$

Grid-to-particle:

$$
\text{PIC: } u_p = \frac{\sum_i w_i u_i}{\sum_i w_i},
\qquad
\text{FLIP: } u_p \mathrel{+}= \frac{\sum_i w_i\Delta u_i}{\sum_i w_i}
$$

Indexing and offsets used in the lecture:

$$
x_{p0}=x_p-x_{\min},\quad y_{p0.5}=y_p-y_{\min}-\frac{h}{2},\quad z_{p0.5}=z_p-z_{\min}-\frac{h}{2}
$$

$$
x_{\mathrm{cell}}=\left\lfloor\frac{x_{p0}}{h}\right\rfloor,
\quad
y_{\mathrm{cell}}=\left\lfloor\frac{y_{p0.5}}{h}\right\rfloor,
\quad
\Delta x=x_{p0}-x_{\mathrm{cell}}h,
\quad
\Delta y=y_{p0.5}-y_{\mathrm{cell}}h
$$

FLIP increment and blend shown on slide:

$$
\Delta u_p=\frac{\sum_i w_i(u_i-u_{i,old})}{\sum_i w_i}
$$

$$
u_p = 0.5\frac{\sum_i w_i u_i}{\sum_i w_i} + 0.95(u_{p,old}+\Delta u_p)
$$

:::tip Note on consistency
The lecture slide explicitly prints `0.5` in the PIC coefficient above, while the declared FLIP95 mix is `0.05/0.95`. Keep this discrepancy in mind when implementing.
:::

## 5. Incompressibility Solve with Gauss-Seidel Projection

![Gauss-Seidel incompressibility and Poisson pressure solve](lec06_materials/incompressibility_solve_gauss_seidel_poisson.png)

Divergence and Poisson equation:

$$
d\leftarrow u_{i+1,j}-u_{i,j}+v_{i,j+1}-v_{i,j}
$$

$$
\nabla\cdot\nabla p = \frac{\rho}{\Delta t}\nabla\cdot\mathbf{u}^*
$$

$$
\frac{1}{h^2}\left(4p_{i,j}-p_{i-1,j}-p_{i+1,j}-p_{i,j-1}-p_{i,j+1}\right)
=\frac{\rho}{\Delta t}\frac{1}{h}\left(-u_{i+1,j}-v_{i,j+1}+u_{i,j}+v_{i,j}\right)
$$

Gauss-Seidel update (with `solid cell s=0; other cell s=1`):

$$
s\leftarrow s_{i+1,j}+s_{i-1,j}+s_{i,j+1}+s_{i,j-1}
$$

$$
u_{i,j}\leftarrow u_{i,j}+d\,\frac{s_{i-1,j}}{s},
\quad
u_{i+1,j}\leftarrow u_{i+1,j}-d\,\frac{s_{i+1,j}}{s}
$$

$$
v_{i,j}\leftarrow v_{i,j}+d\,\frac{s_{i,j-1}}{s},
\quad
v_{i,j+1}\leftarrow v_{i,j+1}-d\,\frac{s_{i,j+1}}{s}
$$

Optional pressure accumulation shown in lecture:

$$
p_{i,j}\leftarrow p_{i,j}+\frac{d}{s}\cdot\frac{\rho h}{\Delta t}
$$

:::remark Key Question (original intent): What does the `s` mask actually do?
It removes solid-cell unknowns from local updates and redistributes correction only through valid fluid neighbors, making projection compatible with boundaries.
:::

## 6. Over-Relaxation and Drift Compensation

The lecture highlights **"Drifting!"** as a visible FLIP artifact (particle clumping/compression over time).

### 6.1 Over-Relaxation

$$
d = o\cdot\left(u_{i+1,j}+v_{i,j+1}-u_{i,j}-v_{i,j}\right),\qquad 1<o<2\;(\text{e.g., }o=1.9)
$$

Over-relaxation accelerates divergence correction by amplifying each local correction step.

### 6.2 Drift Compensation Terms

![Drift compensation overview](lec06_materials/drift_compensation_overview_and_density_term.png)

$$
d = o\cdot\left(u_{i+1,j}+v_{i,j+1}-u_{i,j}-v_{i,j}\right) - k(\rho-\rho_0)
$$

When density exceeds rest value:

$$
\rho > \rho_0
$$

the extra term adds outward correction.

### 6.3 Push Particles Apart + Spatial Hashing

![Particle separation with Gauss-Seidel + hash grid acceleration](lec06_materials/push_particles_apart_hash_grid_acceleration.png)

$$
\mathbf{d}=\mathbf{x}_{p_i}-\mathbf{x}_{p_j},
\qquad
\lVert\mathbf{d}\rVert<2r\Rightarrow
\mathbf{s}=0.5\,\frac{(2r-\lVert\mathbf{d}\rVert)\mathbf{d}}{\lVert\mathbf{d}\rVert}
$$

$$
\mathbf{x}_{p_i}\mathrel{+}=\mathbf{s},\qquad \mathbf{x}_{p_j}\mathrel{-}=\mathbf{s}
$$

$$
h_{\mathrm{cell}}=2.2\,r_{\mathrm{radius}}
$$

### 6.4 Particle Density on Shifted Grid

The lecture statement is **"Grid is shifted by h/2 in both directions!"**

![Density accumulation on shifted cell centers](lec06_materials/particle_density_accumulation_shifted_grid.png)

$$
\rho_1\leftarrow\rho_1+w_1,
\ \rho_2\leftarrow\rho_2+w_2,
\ \rho_3\leftarrow\rho_3+w_3,
\ \rho_4\leftarrow\rho_4+w_4,
\quad
w_1+w_2+w_3+w_4=1
$$

:::remark Key Question (original intent): Why compensate by particle density, not velocity alone?
Velocity divergence can look acceptable while particles still cluster. Density feedback directly targets compression artifacts that are visible in particle-based free-surface motion.
:::

## 7. Mixed Lagrangian-Eulerian Fluids Result Context

![Mixed Lagrangian-Eulerian fluids visual comparison](lec06_materials/mixed_lagrangian_eulerian_fluids_comparison.png)

This comparison motivates hybrid designs: particle information improves advection detail, while grid projection preserves incompressibility constraints.

## 8. Reducing Numerical Diffusion Beyond Basic FLIP

A key lecture prompt is **"Better advection method instead of semi-Lagrangian method."**

Main directions listed in lecture:

- MacCormack advection (higher-order accuracy)
- Flow map (less interpolation)
- Flow map + covector advection
- Advection-reflection method (splitting-error compensation)
- Vorticity confinement
- Vortex method

### 8.1 Advection-Reflection Method

![Advection-reflection and energy-preserving projection](lec06_materials/advection_reflection_energy_preserving_projection.png)

$$
\tilde{\mathbf{u}}^{1/2} = A(\mathbf{u}^0;\mathbf{u}^0,\tfrac{1}{2}\Delta t),
\quad
\mathbf{u}^{1/2}=P\tilde{\mathbf{u}}^{1/2}
$$

$$
\hat{\mathbf{u}}^{1/2}=2\mathbf{u}^{1/2}-\tilde{\mathbf{u}}^{1/2}
$$

$$
\tilde{\mathbf{u}}^{1}=A(\hat{\mathbf{u}}^{1/2};\mathbf{u}^{1/2},\tfrac{1}{2}\Delta t),
\quad
\mathbf{u}^{1}=P\tilde{\mathbf{u}}^{1}
$$

$$
\mathbf{x}^*=\mathbf{x}_0+\mathbf{v}_0\Delta t,
\qquad
\Delta\mathbf{x}=\mathbf{x}^*-\mathbf{x}_1
$$

### 8.2 Vorticity Confinement

![Vorticity confinement pipeline](lec06_materials/vorticity_confinement_pipeline.png)

$$
\boldsymbol{\omega}=\nabla\times\mathbf{u}
$$

$$
\mathbf{N}=\frac{\nabla\lVert\boldsymbol{\omega}\rVert}{\lVert\nabla\lVert\boldsymbol{\omega}\rVert\rVert}
$$

$$
\mathbf{f}_{\mathrm{conf}}=\varepsilon\Delta x(\mathbf{N}\times\boldsymbol{\omega})
$$

### 8.3 Vortex Method Formulation

![From Navier-Stokes to vorticity equation](lec06_materials/vortex_method_equation_transform.png)

$$
\nabla\times\left[\mathbf{u}_t+(\mathbf{u}\cdot\nabla)\mathbf{u}+\frac{\nabla p}{\rho}\right]
=\nabla\times\left[\nu\nabla^2\mathbf{u}+\frac{\mathbf{f}}{\rho}\right]
$$

$$
\boldsymbol{\omega}_t+(\mathbf{u}\cdot\nabla)\boldsymbol{\omega}-(\boldsymbol{\omega}\cdot\nabla)\mathbf{u}
=\nu\nabla^2\boldsymbol{\omega}+\nabla\times\frac{\mathbf{f}}{\rho}
$$

$$
-\nabla\times\boldsymbol{\omega}=\nabla^2\mathbf{u}
$$

### 8.4 MacCormack / BiMocq2 / Mapping Correction

![BiMocq2 multi-level forward/backward mapping idea](lec06_materials/bimocq2_multilevel_forward_backward_mapping.png)

MacCormack correction form shown in lecture:

$$
\hat{\phi}^{n+1}=A(\phi^n),
\quad
\hat{\phi}^{n}=A^R(\hat{\phi}^{n+1}),
\quad
\phi^{n+1}=\hat{\phi}^{n+1}+\frac{\phi^n-\hat{\phi}^{n}}{2}
$$

BiMocq2 mapping expression:

$$
\chi(\mathbf{x}(T)):\mathbf{x}(T)\to\mathbf{x}(t_0)
$$

### 8.5 Covector / Impulse-Fluid Direction

![Impulse fluid and covector advection reference](lec06_materials/impulse_fluid_and_covector_advection_reference.png)

$$
\frac{D\mathbf{m}}{Dt}=-(\nabla\mathbf{u})^T\mathbf{m},
\quad
\nabla^2\varphi=\nabla\cdot\mathbf{m},
\quad
\mathbf{u}=\mathbf{m}-\nabla\varphi
$$

A lecture reference link:
[Neural Flow Maps (SIGGRAPH 2023 Best Paper)](https://yitongdeng-projects.github.io/neural_flow_maps_webpage/)

:::remark Key Question (original intent): How do these methods reduce diffusion while keeping robustness?
They keep semi-Lagrangian-style stability benefits but add error-correction mechanisms (forward/backward correction, reflection, vorticity reinjection, mapping compensation) to recover lost small-scale motion.
:::

## 9. Exam Review

### A. Definitions You Should Be Able to State Exactly

- **PIC**: overwrite particle velocity from grid interpolation each step; robust but dissipative.
- **FLIP**: update particle velocity by grid velocity increment; preserves detail but can drift/noise.
- **Over-relaxation**: scale divergence correction with factor `o` (`1<o<2`) to accelerate convergence.
- **Drift compensation**: add density-based term `-k(\rho-\rho_0)` to suppress particle clumping/compression.
- **Advection-reflection**: combine advection/projection with reflection-style correction to reduce energy loss.

### B. Mechanism Chain (Short-Answer Template)

1. Start from Navier-Stokes + incompressibility.
2. Use particle-grid hybrid transfer (PIC/FLIP).
3. Solve pressure Poisson equation for divergence-free velocity.
4. Add over-relaxation and drift compensation when FLIP shows clustering/drift.
5. Use higher-order/error-correction advection methods to reduce numerical diffusion.

### C. Typical Pitfalls

- Using too much PIC blending and over-damping fine structures.
- Ignoring the mismatch between visual particle density and velocity divergence.
- Tuning over-relaxation aggressively without checking stability.
- Forgetting boundary behavior (`no-stick` normal replacement) when debugging artifacts.
- Confusing anti-diffusion methods: each improves different error sources.

### D. Self-Check Questions

- Can you explain why PIC is stable but dissipative in one sentence?
- Can you write the FLIP increment formula and the FLIP95 blending idea from memory?
- Can you derive why pressure projection is still central in a particle-grid solver?
- Can you explain the role of `\rho_0` in drift compensation?
- Can you compare MacCormack, advection-reflection, and vorticity confinement by their correction targets?
