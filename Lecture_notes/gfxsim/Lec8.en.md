# Lec8 FEM and Hyperelastic Material Models

## 1. Big Picture

This lecture shifts from fluids to deformable solids, focusing on how continuum mechanics leads to a practical FEM pipeline. The thread is:

- Start from conservation laws and stress.
- Define deformation, strain, and energy.
- Convert energy into forces for FEM.
- Generalize with hyperelastic materials and invariant-based models.

## 2. Conservation Laws for Continua

### 2.1 Mass Conservation

$$
\frac{d}{dt}\int_\Omega \rho\, dV = -\oint_{\partial\Omega} \rho \mathbf{v}\cdot\mathbf{n}\, dS
= -\int_\Omega \nabla\cdot(\rho\mathbf{v})\, dV
$$

So the continuity equation is:

$$
\frac{\partial \rho}{\partial t} = -\nabla\cdot(\rho\mathbf{v})
$$

For incompressible fluids, $\frac{D\rho}{Dt}=0$ implies $\nabla\cdot\mathbf{v}=0$.

![Mass conservation](lec08_materials/mass_conservation.png)

### 2.2 Linear Momentum Balance

Surface traction and body forces produce acceleration:

$$
\int_\Omega \rho\,\frac{d\mathbf{v}}{dt}\, dV = \oint_{\partial\Omega} \mathbf{f}_{\text{surface}}\, dS + \int_\Omega \mathbf{f}_{\text{body}}\, dV
$$

Traction and Cauchy stress:

$$
\mathbf{t} = \boldsymbol\sigma\,\mathbf{n}
$$

This gives Cauchy’s equation of motion:

$$
\rho\,\frac{d\mathbf{u}}{dt} = \nabla\cdot\boldsymbol\sigma + \mathbf{f}_{\text{body}}
$$

![Linear momentum balance](lec08_materials/linear_momentum_balance.png)

### 2.3 Angular Momentum Balance

The traction forces cannot generate net torque on an infinitesimal element, which implies the stress tensor is symmetric:

$$
\boldsymbol\sigma = \boldsymbol\sigma^T
$$

![Angular momentum balance](lec08_materials/angular_momentum_balance.png)

### 2.4 Newtonian Fluid Stress (Reference Reminder)

For a Newtonian fluid:

$$
\boldsymbol\sigma = -p\mathbf{I} + \mu(\nabla\mathbf{v} + (\nabla\mathbf{v})^T)
$$

![Newtonian fluid stress](lec08_materials/newtonian_fluid_stress.png)

:::remark Key Question (original intent): Why does angular momentum balance matter in solids?
Because it forces the Cauchy stress tensor to be symmetric. That symmetry is the backbone of consistent strain and energy definitions in continuum mechanics.
:::

## 3. Elasticity: Spring-Mass vs Continuum FEM

The lecture contrasts two views of elasticity.

### 3.1 Spring-Mass Intuition

A spring edge uses stretch ratio and energy:

$$
F = \frac{l}{l_0},\quad G = \frac{l}{l_0} - 1,\quad E = \frac{1}{2}kG^2
$$

Resulting force:

$$
\mathbf{f}_i = -kG\frac{\mathbf{x}_{ij}}{\|\mathbf{x}_{ij}\|}
$$

![Spring-mass model](lec08_materials/spring_mass_model.png)

Key limitations: layout sensitivity, parameter tuning, and weak linkage to real material parameters.

### 3.2 Continuum FEM View

FEM uses deformation measures, strain, energy density, and stress to produce forces with material control.

![Continuum FEM overview](lec08_materials/fem_continuum_overview.png)

:::remark Key Question (original intent): Why move from springs to FEM?
Springs are easy to implement but do not map cleanly to material behavior. FEM derives forces from energy in the continuum model, so parameters like $\lambda,\mu$ have physical meaning and behave consistently across meshes.
:::

## 4. Deformation Field and Deformation Gradient

We describe deformation as a mapping from reference to current configuration:

$$
\mathbf{x} = \varphi(\mathbf{X})
$$

Locally, the field is linear:

$$
\mathbf{x} \approx \mathbf{F}\mathbf{X} + \mathbf{b},
\quad \mathbf{F}=\frac{\partial\mathbf{x}}{\partial\mathbf{X}}
$$

![Deformation field locally linear](lec08_materials/deformation_field_locally_linear.png)

In linear FEM on a triangle:

$$
\mathbf{F}[\mathbf{X}_{10}\ \mathbf{X}_{20}] = [\mathbf{x}_{10}\ \mathbf{x}_{20}],
\quad \mathbf{F} = [\mathbf{x}_{10}\ \mathbf{x}_{20}][\mathbf{X}_{10}\ \mathbf{X}_{20}]^{-1}
$$

![Deformation gradient in a triangle](lec08_materials/deformation_gradient_triangle.png)

## 5. Green Strain and Rotation Separation

The Green strain removes rigid rotation and captures stretch:

$$
\mathbf{G} = \frac{1}{2}(\mathbf{F}^T\mathbf{F} - \mathbf{I})
$$

Using polar decomposition:

$$
\mathbf{F} = \mathbf{R}\mathbf{S},\quad \mathbf{G} = \frac{1}{2}(\mathbf{S}^T\mathbf{S} - \mathbf{I})
$$

![Green strain and polar decomposition](lec08_materials/green_strain_polar.png)

A useful geometric relation:

$$
\frac{l^2-l_0^2}{l_0^2} = 2\mathbf{n}^T\mathbf{G}\mathbf{n}
$$

## 6. Energy Density and Stress

Define energy density $W(\mathbf{G})$, then total energy:

$$
E = \int W(\mathbf{G})\, dA = A_{\text{ref}} W(\epsilon_{uu},\epsilon_{vv},\epsilon_{uv})
$$

For St. Venant-Kirchhoff (StVK):

$$
W = \frac{\lambda}{2}(\epsilon_{uu}+\epsilon_{vv})^2 + \mu(\epsilon_{uu}^2+\epsilon_{vv}^2+2\epsilon_{uv}^2)
$$

Stress in the reference configuration:

$$
\mathbf{S} = \frac{\partial W}{\partial\mathbf{G}} = 2\mu\mathbf{G} + \lambda\,\text{trace}(\mathbf{G})\mathbf{I}
$$

![Strain energy density](lec08_materials/strain_energy_density.png)

Forces come from the negative energy gradient:

$$
\mathbf{f}_i = -\left(\frac{\partial E}{\partial \mathbf{x}_i}\right)^T
$$

![Force as energy gradient](lec08_materials/force_gradient_energy.png)

## 7. Stress Measures and Nanson’s Formula

Different stress tensors map different normals to tractions:

- Second Piola-Kirchhoff: $\mathbf{T} = \mathbf{S}\mathbf{N}$ (reference)
- First Piola-Kirchhoff: $\mathbf{P} = \mathbf{F}\mathbf{S}$
- Cauchy stress: $\mathbf{t} = \boldsymbol\sigma\mathbf{n}$ (current)

![Stress measures table](lec08_materials/stress_measures_table.png)

Nanson’s formula links area and normals:

$$
\mathbf{A}\mathbf{n} = \det(\mathbf{F})\mathbf{F}^{-T}(A_{\text{ref}}\mathbf{N})
$$

Thus:

$$
\boldsymbol\sigma = \det(\mathbf{F})^{-1}\mathbf{P}\mathbf{F}^T
$$

![Nanson formula](lec08_materials/nanson_formula.png)

## 8. Linear FEM Force Summary

For each tetrahedron:

$$
\mathbf{E}=[\mathbf{X}_{10}\ \mathbf{X}_{20}\ \mathbf{X}_{30}],
\quad \mathbf{F}=[\mathbf{x}_{10}\ \mathbf{x}_{20}\ \mathbf{x}_{30}]\mathbf{E}^{-1}
$$

$$
[\mathbf{f}_1\ \mathbf{f}_2\ \mathbf{f}_3] = -V_{\text{ref}}\mathbf{P}\mathbf{E}^{-T},
\quad \mathbf{f}_0 = -\mathbf{f}_1-\mathbf{f}_2-\mathbf{f}_3
$$

![Linear FEM summary](lec08_materials/linear_fem_summary.png)

## 9. Hyperelasticity and Invariants

Hyperelasticity uses a strain energy density $\Psi(\mathbf{F})$:

$$
E = \int_\Omega \Psi(\mathbf{F})\, d\mathbf{x},
\quad \mathbf{f}_i = -\left(\frac{\partial E}{\partial \mathbf{x}_i}\right)^T
$$

![Hyperelasticity intro](lec08_materials/hyperelasticity_intro.png)

Cauchy-Green invariants:

$$
\mathbf{C} = \mathbf{F}^T\mathbf{F}
$$

$$
I_C = \text{tr}(\mathbf{C}),\quad II_C = \text{tr}(\mathbf{C}^2),\quad III_C = \det(\mathbf{C}) = J^2
$$

$$
I_C^* = \frac{1}{2}(I_C^2 - II_C)
$$

![Cauchy-Green invariants](lec08_materials/cauchy_green_invariants.png)

## 10. Material Models and Comparisons

Common energy choices:

- StVK (simple, rotation invariant, weak in compression)
- Neo-Hookean (better volume preservation, stiff in compression)

![Material model comparison](lec08_materials/material_model_comparison.png)

Example formulas:

$$
W_{\text{StVK}} = \frac{\lambda}{2}(I_C-3)^2 + \frac{\mu}{4}(II_C-2I_C+3)
$$

$$
W = \frac{\lambda}{2}\log^2 J + \frac{\mu}{2}(I_C-3) - \mu\log J,
\quad \mathbf{P} = \mu(\mathbf{F}-\mathbf{F}^{-T}) + \lambda\log(J)\mathbf{F}^{-T}
$$

## 11. Isotropic Material Models

Isotropic hyperelasticity depends on principal stretches:

$$
W(\mathbf{F}) = W(\mathbf{U}\mathbf{\Lambda}\mathbf{V}^T) = W(\lambda_0,\lambda_1,\lambda_2)
$$

$$
\mathbf{P}(\mathbf{F}) = \mathbf{U}\,\text{diag}\left(\frac{\partial W}{\partial \lambda_0},\frac{\partial W}{\partial \lambda_1},\frac{\partial W}{\partial \lambda_2}\right)\mathbf{V}^T
$$

![Isotropic material models](lec08_materials/isotropic_models.png)

![FEM for isotropic material summary](lec08_materials/fem_isotropic_summary.png)

## 12. After-Class Reading

- Teran et al. 2003. Finite Volume Methods for the Simulation of Skeleton Muscles. SCA.
- Sifakis and Barbic (2012). FEM simulation of 3D deformable solids: A practitioner's guide to theory, discretization and model reduction.
- Xu et al. 2015. Nonlinear Material Design Using Principal Stretches. TOG (SIGGRAPH).

## 13. Exam Review

### Key Definitions

- Deformation map: $\mathbf{x}=\varphi(\mathbf{X})$, deformation gradient $\mathbf{F}=\partial\mathbf{x}/\partial\mathbf{X}$.
- Green strain: $\mathbf{G}=\frac{1}{2}(\mathbf{F}^T\mathbf{F}-\mathbf{I})$.
- Stress measures: $\mathbf{S}$ (2nd PK), $\mathbf{P}$ (1st PK), $\boldsymbol\sigma$ (Cauchy).
- Invariants: $I_C, II_C, III_C$ of $\mathbf{C}=\mathbf{F}^T\mathbf{F}$.

### Mechanisms to Explain

1. How $\mathbf{F}$ maps reference vectors to current vectors.
2. Why $\mathbf{G}$ removes rigid rotation.
3. How energy density $W$ leads to forces via $\mathbf{f}_i=-\partial E/\partial\mathbf{x}_i$.
4. How Nansons formula connects reference and current stress.

### Short-Answer Templates

- **Define a stress measure:** say which normal it acts on (reference or current) and how traction is computed.
- **Compare StVK vs Neo-Hookean:** StVK is simple but weak in compression; Neo-Hookean better preserves volume but is stiff and undefined when inverted.
- **Linear FEM pipeline:** compute $\mathbf{E}$ and $\mathbf{F}$, evaluate $W$ and $\mathbf{P}$, then assemble forces via $-V_{\text{ref}}\mathbf{P}\mathbf{E}^{-T}$.

### Common Pitfalls

- Mixing reference and current normals when applying stress.
- Forgetting that $\mathbf{F}$ contains rotation, so strain must be built from $\mathbf{F}^T\mathbf{F}$.
- Using StVK at large compression without safeguards.

### Self-Check

- Can you derive $\boldsymbol\sigma$ from $\mathbf{P}$ using Nansons formula?
- Can you express $W$ using invariants and explain rotational invariance?
- Can you write the per-tet force formula from $\mathbf{P}$?
