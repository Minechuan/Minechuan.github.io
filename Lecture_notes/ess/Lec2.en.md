# Lec2 Protection and Safety Systems

## 1. Learning Scope and Safety Goal

This lecture builds the safety logic used in low-voltage installations: what creates shock risk, how to classify direct and indirect contact, and how to choose the protection strategy for TT, TN, and IT earthing systems.

By the end of Lec2, you should be able to:

1. Explain the main physiological effects of current through the human body.
2. Distinguish direct contact from indirect contact.
3. Use touch-voltage and earth-fault relations to reason about protective devices.
4. Explain why TT, TN, and IT systems use different clearing methods and different continuity trade-offs.

:::remark Key definition
**The dangerous part is not only voltage; it is the current path through the human body.**

Shock risk is shaped by current magnitude, current path, duration, and the condition of the body and surroundings.
:::

## 2. What an Electric Shock Can Do

Electrical shock is dangerous because current flows through tissues and can interfere with muscles, breathing, and the heart.

:::tip Why very high currents do not always produce the same tetanization pattern
At very high current levels, the contraction can become so violent that the body may be thrown away from the conductor. The absence of classic "let-go" tetanization does not make the situation safer; it usually means the hazard has already escalated.
:::
- **Ventricular fibrillation**: the most dangerous effect, because uncontrolled cardiac contractions may persist even after the stimulus has ceased.
- **Burns**: Joule heating can burn the body along the current path.

## 3. Direct Contact and the First Protective Measures

Direct contact is accidental contact with a live conductor or a normally live conductive element. In low-voltage installations, the basic strategy is simple: do not leave live parts within reach, and isolate them with barriers, enclosures, or insulation.

In practice, the lecture stresses two complementary ideas:

1. Keep live parts out of reach by geometry or enclosure.
2. Add high-sensitivity residual current protection when direct-contact risk must be reduced further.

:::tip Key question and answer
**Question:** What is the practical difference between direct contact and indirect contact?

**Answer:** Direct contact means touching a live part that is supposed to be energized. Indirect contact means touching exposed conductive parts, such as metal frames, that became energized only because of an insulation fault.
:::

In low-voltage practice (for example, 230/400 V systems), a complementary measure against direct contact is the use of instantaneous residual current devices with very high sensitivity, typically around 30 mA for personal protection.

:::remark Class II reminder
Class II switchboards do not rely on main insulation alone. They add double insulation or reinforced insulation so that the enclosure itself contributes to safety.
:::

## 4. Touch Voltage, Body Current, and Automatic Disconnection

When an insulation fault energizes a metallic frame, the key safety quantity is the touch voltage.

$$
I_b = \frac{U_t}{R_b}
$$

:::tip What the TT slides are really saying
TT protection is simple in principle: let the earth fault happen, detect the resulting imbalance, and disconnect quickly enough that the touch voltage does not remain dangerous for long enough to injure a person.
:::
The lecture also emphasizes that the touch voltage depends on the fault current, the earth electrode resistance, and additional resistances such as shoes or floor conditions.

Automatic disconnection is the central indirect-contact strategy: remove the supply before the touch voltage can remain dangerous for long enough to injure a person.

:::tip Key question and answer
**Question:** How does a residual current device help here?

**Answer:** In a healthy circuit, line current and neutral current are equal and opposite. If an insulation fault sends part of the current to earth, the difference becomes residual current, and the RCD trips when that residual current reaches its threshold.
:::

In symbols:

$$
I_P - I_N = I_{res}
$$

and, in the healthy case, $I_N \approx I_L$.

## 5. Earthing Systems at a Glance

IEC 60364-1 distinguishes three earthing systems using the letters TN, TT, and IT.

- The **first letter** describes how the transformer neutral is connected.
- The **second letter** describes how exposed conductive parts are connected.

The lecture uses the standard meanings:

- **T**: direct connection to earth.
- **I**: isolated from earth or connected through high impedance.
- **N**: connected to the neutral of the original installation.

The PE, N, and PEN conductors matter here:

- **PE** is the protective conductor.
- **N** is the neutral conductor.
- **PEN** combines PE and N in the same conductor.

![Earthing system comparison](./lec02_materials/earthing_system_comparison.png)

:::remark Key interpretation
The earthing system is not a naming detail. It determines fault current magnitude, touch voltage, protection device choice, and whether service continuity is prioritized or traded away.
:::

## 6. TT System

In a TT system, the transformer neutral is directly connected to the service earth, while exposed conductive parts are connected to a separate protective earth electrode.

The fault loop is therefore dominated by the earth electrodes $R_A$ and $R_B$.

$$
I_d = \frac{U_p}{R_A + R_B}
$$

$$
U_t = \frac{R_A}{R_A + R_B} U_p
$$

Because the fault current is limited by the earth resistances, overcurrent protection alone is often not enough. The standard solution is a residual current device.

The nominal sensitivity of the RCD must satisfy:

$$
I_{\Delta n} \le \frac{U_L}{R_A}
$$

where $U_L$ is the conventional touch-voltage limit.

For most applications, $U_L = 50\,\mathrm{V}$. For temporary supplies, work sites, agricultural sites, and horticultural places, $U_L = 25\,\mathrm{V}$.

The time limit is also important:

- For circuits with rated current not exceeding 32 A, the fault clearing time must not exceed 0.2 s.
- For all other circuits, the time must not exceed 1 s.
- Selectivity between RCDs on the same distribution circuit must be preserved.

![TT fault loop and protective devices](./lec02_materials/tt_indirect_contact_fault_loop.png)

![TT RCD sensitivity and time limits](./lec02_materials/tt_rcd_sensitivity_and_time.png)

:::tip What the TT slides are really saying
TT protection is simple in principle: let the earth fault happen, detect the resulting imbalance, and disconnect quickly enough that the touch voltage does not remain dangerous.
:::

## 7. TN System

In a TN system, the transformer neutral is directly earthed and exposed conductive parts are connected back to that neutral through PE or PEN conductors.

The lecture distinguishes two common variants:

- **TN-C**: PE and N are combined as PEN.
- **TN-S**: PE and N are separated throughout the installation.

The PEN conductor is both protective and neutral at the same time. It is green-yellow over its length and blue at the ends of its terminations.

Because the fault loop impedance is low, the fault current is high and the fault resembles a phase-neutral short circuit.

$$
I_d = \frac{U_0}{R_{ph1} + R_{PE}}
$$

$$
U_d = R_{PE} I_d
$$

For 230/400 V networks, the touch voltage can reach a dangerous level quickly if the fault loop is not short enough.

The lecture uses a maximum-length criterion to ensure that the protective device really trips:

$$
L_{max} = \frac{0.8 U_0 S_{ph}}{2 \rho I_a (1 + m)}
$$

with $m = S_{ph} / S_{PE}$.

If the line is longer than $L_{max}$, either the conductor cross-section must be increased or the circuit must be protected with an RCD.

![TN fault loop and maximum-length logic](./lec02_materials/tn_c_example_trip_curve.png)

:::tip Key question and answer
**Question:** Why does TN protection often work with overcurrent devices?

**Answer:** Because the fault current is high enough to trip the circuit breaker or fuse quickly. The device is not waiting for a tiny leakage current; it is clearing a short-circuit-like fault.
:::

### 7.1 Worked TN-C Example

The lecture checks a 40 m TN-C feeder with phase conductor cross-section 95 mm² and protective conductor cross-section 50 mm², protected by an NS 250N breaker with a TM 250 D magnetic release.

The magnetic trip range is about 5 to 10 times the rated current, so the protective threshold is high enough to clear a short-circuit-like fault.

For the example values, the calculated maximum protected lengths are about 203 m and 101 m for the two trip settings shown on the slide, so a 40 m line is safely within the protected region.

The touch voltage check on the example gives about 120.6 V, and the clearing time requirement is still met because the breaker trips in less than 50 ms in the short-circuit region shown on the curve.

## 8. IT System

In an IT system, the transformer neutral is isolated or connected to earth through a high impedance, while exposed conductive parts are connected to earth.

This system is used when service continuity matters and the installation should not trip on the first insulation fault. Hospitals and high-power drive systems are classic examples.

The key idea is the first fault:

- The first fault does not normally cause immediate tripping.
- An insulation monitoring device, often called a CPI in the slides, must supervise the installation and raise an alarm.
- The touch voltage on the first fault is usually low, but it is still not something to ignore.

If a second fault occurs, the system behavior changes and the fault must be treated much more like a TN short-circuit condition.

For a 3-phase installation without a distributed neutral, the slide uses the second-fault maximum-length check with the effective applied voltage $\sqrt{3} U_0$.

$$
L_{max} = \frac{0.8 U_0 \sqrt{3} S_{ph}}{2 \rho I_a (1 + m)}
$$

For a 3-phase installation with a distributed neutral, the corresponding relation uses $U_0$ rather than $\sqrt{3}U_0$.

![IT first-fault behavior and fault path](./lec02_materials/it_double_fault_verification.png)

:::tip What makes IT different from TT and TN
IT trades immediate automatic tripping on the first fault for continuity of service. That is why it needs active insulation supervision instead of relying only on passive disconnection.
:::

## 9. Earthing System Comparison

The comparison slide condenses the whole chapter:

- **TN**: fault current is high, clearing is fast, and the maximum cable length is constrained by the fault loop.
- **TT**: fault current is limited by the earth electrodes, so RCD-based disconnection is the standard solution.
- **IT**: the first fault does not trip, but the installation must be monitored and the second fault must be cleared decisively.

The service-continuity ranking is equally important:

1. TT and TN prioritize protective disconnection.
2. IT prioritizes continuity on the first fault.
3. The right choice depends on the application, not on a universal preference.

## 10. Worked Examples

### 10.1 TT Example

For the TT example in the lecture, the earth-fault current is computed as:

$$
I_d = \frac{230}{10 + 20} = 7.7\,\mathrm{A}
$$

The touch voltage becomes:

$$
U_f = R_A I_f = 154\,\mathrm{V}
$$

Because that value is above the acceptable touch-voltage limit, protection by automatic disconnection must be guaranteed by an RCD.

The rated sensitivity condition on the slide gives:

$$
I_{\Delta n} \le 2.5\,\mathrm{A}
$$

### 10.2 TN-C Example

For the 40 m TN-C feeder, the slide checks the magnetic release settings against the maximum-length criterion.

The result is that both settings shown on the curve protect the circuit, and the selected line length is well below the allowable maximum.

The touch voltage for the fault is about 120.6 V, which means the clearing time must stay below 200 ms. The breaker curve clears the short-circuit region in less than 50 ms, so the condition is satisfied.

### 10.3 IT Example Without Distributed Neutral

For the 76 m IT feeder without distributed neutral, the slide checks the protective device at two magnetic settings:

- $I_a = 6 I_n = 480\,\mathrm{A}$ gives $L_{max} \le 175\,\mathrm{m}$.
- $I_a = 11 I_n = 1120\,\mathrm{A}$ gives $L_{max} \le 75\,\mathrm{m}$.

Since the circuit length is 76 m, the first setting is acceptable and the slide concludes that protection against indirect contact is guaranteed for the chosen device.

The touch voltage is about 79.7 V, and the breaker clears the short circuit in less than 20 ms.

## 11. Exam Review Appendix

### 11.1 Must-Master Definitions

- **Direct contact**: touching a live part that is intentionally energized.
- **Indirect contact**: touching exposed conductive parts that became live due to an insulation fault.
- **Touch voltage**: voltage appearing between an exposed conductive part and another conductive point that a person can reach simultaneously.
- **RCD**: residual current device that trips when phase and neutral currents are no longer balanced.
- **PEN**: combined protective and neutral conductor.

### 11.2 Mechanism to Explain in a Short Answer

1. Identify the contact type.
2. Identify the earthing system.
3. Decide whether the protective principle is enclosure, automatic disconnection, insulation monitoring, or a combination.
4. Check the relevant voltage limit, current threshold, and clearing time.

### 11.3 Ready-to-Use Answer Patterns

- "Direct contact is controlled by keeping live parts out of reach and by adding fast residual-current protection when needed."
- "TT relies on RCDs because the earth-fault current is limited by the electrode resistances."
- "TN can trip quickly with overcurrent protection because the fault current is high enough to resemble a short circuit."
- "IT keeps service continuity on the first fault and uses insulation monitoring to raise an alarm."

### 11.4 Frequent Pitfalls

- Treating every fault as if it had the same loop impedance.
- Forgetting that TT and TN use different clearing logic.
- Assuming the first IT fault should behave like a normal tripping fault.
- Ignoring time limits even when the voltage limit is already exceeded.

### 11.5 Self-Check List

1. Can I explain the difference between direct and indirect contact without looking at the slides?
2. Can I derive the TT residual-current condition from the touch-voltage limit?
3. Can I explain why TN allows overcurrent protection to work as a safety device?
4. Can I describe why IT improves continuity but needs insulation supervision?