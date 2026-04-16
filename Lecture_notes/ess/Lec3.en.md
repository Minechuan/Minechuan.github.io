# Lec3 Protection Devices and Short-Circuit Current Calculation

## 1. Learning Goals and Big Picture

This lecture connects two engineering tasks that must be done together:

1. Choose protection devices that can safely interrupt realistic faults.
2. Calculate maximum and minimum short-circuit currents so device settings are technically valid.

By the end of this lecture, you should be able to:

1. Explain how MCB/MCCB/RCCB/SPD roles differ in low-voltage protection.
2. Distinguish `Icu` and `Ics`, and read their standards context correctly.
3. Choose a short-circuit calculation method based on available data and required accuracy.
4. Use core formulas for three-phase, two-phase, and phase-neutral short-circuit current.
5. Build loop impedance from upstream network, transformer, machine, and cable parameters.

:::remark Key question and answer
**Question (lecture intent): Why are protection-device selection and short-circuit calculation inseparable?**

**Answer:** Because breaker behavior depends on the fault current level at the installation point. If current is underestimated, protection may fail to trip in time; if overestimated without basis, device choice becomes uneconomical or inconsistent with the network.
:::

## 2. Protection Devices in Low-Voltage Installations

The lecture starts from the practical protection set used in installations:

- Fuses.
- Circuit breakers (`MCB`, `MCCB`, `RCBO`).
- Residual current devices (`RCD`/`RCCB`).
- Surge protective devices (`SPD`).

![Protection devices overview](./lec03_materials/protection_devices_overview.png)

Circuit breakers are presented as automatic fault interrupters for overload and short-circuit conditions.

### 2.1 RCCB in the Device Family

`RCCB` devices are shown as residual-current protection elements used when leakage/fault-to-earth behavior must be detected directly.

### 2.2 `Ics` vs `Icu` (Core Concept)

The lecture uses two similar but non-equivalent capacities:

- **`Icu`**: ultimate breaking capacity.
- **`Ics`**: service breaking capacity.

:::remark Key definition (slide wording)
**The ultimate rated breaking capacity (Icu) or (Icn) is the maximum fault-current a circuit-breaker can successfully interrupt without being damaged.**

**This Ics is the value of the short-circuit threshold current. The device trips and after resetting, guarantees the installation's continuity of service.**
:::

Design implication:

- `Icu` is a survival limit under severe fault.
- `Ics` is a recoverable-operability level after interruption.
- IEC 60947-2 expresses `Ics` as a percentage of `Icu` (commonly 25%, 50%, 75%, 100%).

The standard comparison pages (`EN 60898` vs `IEC 60947-2`) emphasize that nameplate interpretation depends on the applicable standard family.

## 3. Magnetic Tripping Curves (`B`, `C`, `D`)

The lecture compares magnetic trip zones for `B/C/D` curves.

![Magnetic tripping curves B C D](./lec03_materials/magnetic_tripping_curves_bcd.png)

Quick reading rule:

- Curve `B`: faster magnetic pickup at lower multiples of rated current.
- Curve `C`: medium inrush tolerance.
- Curve `D`: higher inrush tolerance, later magnetic pickup.

Approximate pickup ranges shown:

- `B`: about `3-5 In` (AC), higher in DC ranges.
- `C`: about `5-10 In` (AC).
- `D`: about `10-20 In` (AC).

:::tip Key question and answer
**Question (from the curve comparison): When do we move from B to C or D?**

**Answer:** When expected inrush/magnetizing current increases and nuisance magnetic tripping must be avoided, while still preserving short-circuit clearing capability.
:::

## 4. Why Short-Circuit Current Depends on Impedance

The short-circuit section starts from one main physical statement:

- Fault current is determined by the equivalent impedance seen from the fault point.

![Fault location and equivalent impedance](./lec03_materials/fault_location_impedance_dependency.png)

So current level changes with:

- Fault location (near source vs far end).
- Earthing system.
- Upstream network strength.
- Transformer/machine/cable contributions to loop impedance.

## 5. How to Choose a Calculation Method

The lecture proposes three methods:

1. Composition method.
2. Conventional method.
3. Impedance method.

Selection criteria include:

- Whether maximum or minimum current is needed.
- Required accuracy.
- Known supply/installation parameters.
- Installation criticality.

:::remark Key question and answer
**Question (slide original intent): The method for calculating short-circuit currents should be chosen according to what?**

**Answer:** Current type (max/min), accuracy target, known data level, and installation importance. If upstream data are scarce, use composition; if detailed loop data are available, impedance method gives broader and more accurate results.
:::

## 6. Conventional Method (French UTE C 15-105:2003)

This method assumes source voltage during fault is `80%` of nominal, with load factor `1.05` included.

### 6.1 Minimum Short-Circuit Current

$$
I_{K1\min}=\frac{0.8\times1.05\times U_o}{Z_F+Z_N}
$$

Where:

- `U_o`: phase-to-neutral nominal voltage.
- `Z_F`: phase-conductor resistance.
- `Z_N`: neutral-conductor resistance.

![Conventional method minimum current formula](./lec03_materials/conventional_method_min_current_formula.png)

### 6.2 Fault Current at Installation End

$$
I_d=\frac{0.8\times1.05\times U_o}{Z_F+Z_{PE}}
$$

Where `Z_{PE}` is protective-conductor resistance.

![Conventional method fault current formula](./lec03_materials/conventional_method_fault_current_formula.png)

## 7. Impedance Method for Maximum Currents

The impedance method builds the complete fault loop using `R` and `X` terms from each segment.

### 7.1 Symmetrical Three-Phase Short-Circuit Current

The lecture treats this as the most severe balanced fault (`I_{k3\max}`).

$$
I_{k3\max}=\frac{C_{\max}\,m\,U_o}{\sqrt{\left[R_Q+R_T+R_{Uph}+\rho_0\frac{L}{S\,n_{ph}}\right]^2+\left[X_Q+X_T+X_{Uph}+\lambda\frac{L}{n_{ph}}\right]^2}}
$$

![Three-phase short-circuit formula](./lec03_materials/three_phase_short_circuit_formula.png)

### 7.2 Two-Phase Short-Circuit Current

$$
I_{k2\max}=\frac{\sqrt{3}}{2}I_{k3\max}=0.86\,I_{k3\max}
$$

![Two-phase short-circuit relation](./lec03_materials/two_phase_short_circuit_relation.png)

### 7.3 Phase-to-Neutral Short-Circuit Current

$$
I_{k1\max}=\frac{C_{\max}\,m\,U_o}{\sqrt{\left[R_Q+R_T+R_{Uph}+R_{UN}+\rho_0L\left(\frac{1}{S\,n_{ph}}+\frac{1}{S_N\,n_N}\right)\right]^2+\left[X_Q+X_T+X_{Uph}+X_{UN}+\lambda L\left(\frac{1}{n_{ph}}+\frac{1}{n_N}\right)\right]^2}}
$$

![Phase-neutral short-circuit formula](./lec03_materials/phase_neutral_short_circuit_formula.png)

:::tip Supplementary explanation
The denominator structure is always "total resistive part squared + total reactive part squared". In design review, sensitivity is usually strongest to cable length `L`, conductor section, and upstream short-circuit strength.
:::

## 8. Minimum Current Rules and Why They Matter

For protection verification at the farthest point, the lecture instructs replacing `\rho_0` and `C_{max}` with more conservative settings:

- For circuit-breaker checks: `\rho_1=1.25\rho_0`.
- For fuse checks: `\rho_2=1.5\rho_0`.
- Use `C_{min}` instead of `C_{max}`.

:::remark Key question and answer
**Question:** Why is minimum short-circuit current a critical check even when maximum current is already known?

**Answer:** Because protection must still trip under the weakest fault condition (long cable, high effective resistance, lower source factor). Many mis-coordination problems appear at minimum-fault cases, not at maximum-fault cases.
:::

## 9. Short-Circuit Impedance Building Blocks

### 9.1 Upstream Network Impedance

$$
Z_Q=\frac{(mU_n)^2}{S_{kQ}}
$$

Typical MV-side short-circuit power ranges used on the slide:

- Rural: `150 MVA`.
- Semi-urban: `250 MVA`.
- Urban: `350-500 MVA`.

![Upstream network impedance formula](./lec03_materials/upstream_network_impedance_formula.png)

### 9.2 Transformer Impedance

$$
Z_T=\frac{U_{kt}}{100}\times\frac{(mU_n)^2}{S_{rT}}
$$

Typical short-circuit voltage values by apparent power:

- `<=630 kVA: 4%`
- `800-1250 kVA: 5%`
- `1600-2000 kVA: 6%`

![Transformer impedance formula and table](./lec03_materials/transformer_impedance_formula_and_table.png)

The trend plot highlights a useful shortcut: transformer impedance can be neglected only when upstream short-circuit power is much larger than transformer rated power.

### 9.3 Alternator / Synchronous Machine Impedance

The lecture separates short-circuit evolution into three periods:

1. Sub-transient (`10-20 ms`, highest, often `>5 In`).
2. Transient (up to `200-300 ms`, often `3-5 In`).
3. Steady regime (`~0.3-5 In`, depends on excitation type).

Reactance conversion formulas:

$$
X_d'=\frac{X_d'(\%)}{100}\times\frac{U_n^2}{S_{rG}}
$$

$$
X_o=\frac{X_o(\%)}{100}\times\frac{U_n^2}{S_{rG}}
$$

Typical ranges shown:

- Turbo alternator: `X_d'` about `10-20`, transient `15-25`, permanent `150-230`.
- Pole-surface alternator: `15-25`, `25-35`, `70-120`.

![Alternator reactance conversion and ranges](./lec03_materials/alternator_reactance_conversion_and_ranges.png)

### 9.4 Conductors and Cables

$$
R=\rho\frac{L}{n_cS_c}
$$

$$
X=\lambda\frac{L}{n_c}
$$

For low voltage and conductor section below `150 mm^2`, the slide states resistance-dominant simplification is often acceptable.

![Conductor and cable impedance formulas](./lec03_materials/conductor_cable_impedance_formulas.png)

Resistivity table used for max/min and TN/IT checks:

$$
\rho_1=1.25\rho_{20},\quad \rho_1=1.5\rho_{20}
$$

With base values:

$$
\rho_{20,\mathrm{Cu}}=0.018\,\Omega\cdot\mathrm{mm}^2/\mathrm{m},\quad
\rho_{20,\mathrm{Al}}=0.029\,\Omega\cdot\mathrm{mm}^2/\mathrm{m}
$$

![Conductor resistivity rules table](./lec03_materials/conductor_resistivity_rules_table.png)

## 10. Exam Review Appendix

### 10.1 Must-Master Definitions

- **Rated service short-circuit breaking capacity (`Ics`)**: fault-current level where tripping plus service continuity after reset is expected.
- **Ultimate breaking capacity (`Icu`)**: highest interruptible fault-current under specified standard conditions.
- **Symmetrical three-phase short-circuit (`I_{k3}`)**: balanced severe fault with highest typical current magnitude.
- **Minimum short-circuit current**: weakest fault current at the remote end used for trip-verification robustness.
- **Equivalent fault-loop impedance**: combined `R/X` seen from the fault point.

### 10.2 Mechanisms You Should Explain in Short Answers

1. Why fault current level depends on impedance seen at the fault point.
2. Why `Icu` and `Ics` are both necessary in device selection.
3. Why max-current checks and min-current checks answer different protection questions.
4. How upstream network, transformer, machine, and cable each enters loop impedance.

### 10.3 Ready-to-Use Answer Patterns

- "`Icu` is the survival interrupting limit, while `Ics` indicates practical service continuity capability after interruption."
- "Three-phase symmetrical faults are used for worst-case magnitude checks; minimum-current checks verify tripping at weak-fault conditions."
- "If upstream data are limited, composition method gives an engineering estimate; impedance method is preferred when full loop data are known."
- "Conservative minimum-current verification replaces resistivity/source factors to avoid false confidence in breaker tripping."

### 10.4 Frequent Pitfalls

- Treating one calculated current as valid for all fault types.
- Using only maximum short-circuit current and skipping minimum-current verification.
- Mixing naming/interpretation rules from different standards without checking context.
- Ignoring neutral/PE path contribution in phase-neutral or fault-loop calculations.

### 10.5 Self-Check List

1. Can I explain when to use composition vs conventional vs impedance method?
2. Can I derive and interpret `I_{K1\min}` and `I_d` physically, not only numerically?
3. Can I justify breaker curve (`B/C/D`) selection from inrush and fault behavior?
4. Can I build the loop impedance chain from utility side to cable end without missing terms?
5. Can I state why minimum short-circuit current is often the decisive protection check?
