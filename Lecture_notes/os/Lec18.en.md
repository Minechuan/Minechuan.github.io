# Lecture 18: I/O - General I/O, Disk, and SSD

## Learning Objectives

By the end of this lecture, you should be able to:

1. Explain why I/O is a first-class OS problem even after CPU scheduling and memory management are solved.
2. Describe how CPUs communicate with devices through controllers, buses, and interrupts.
3. Compare programmed I/O, DMA, and different user-facing timing interfaces (blocking, non-blocking, asynchronous).
4. Analyze HDD latency using seek, rotation, and transfer components.
5. Explain why SSD writes are fundamentally different from reads and why FTL, wear leveling, and garbage collection are required.

## 1. Why I/O Is Core to Operating Systems

Without I/O, a computer cannot interact with storage, network, input, or output devices. Real systems face thousands of heterogeneous devices with very different performance and behavior.

![Device transfer-rate range](lec18_materials/io_device_transfer_rate_range.png)

The challenge for OS design is not just correctness but also unification:

- How to standardize interfaces for very different devices.
- How to keep device access reliable and debuggable.
- How to hide device-specific timing and failure details from applications.

:::remark Key Question: Why does I/O need dedicated OS abstractions?
**Question (original intent): We already have process, scheduling, and memory abstractions. Why add more complexity for I/O?**

Answer:
- Device diversity is extreme (speed, granularity, and access patterns).
- Applications need portable interfaces; hardware needs device-specific control.
- The OS is the bridge layer that translates a common API into device-specific mechanisms.
:::

## 2. Hardware Communication Path: Bus, Controller, and Registers

CPU does not talk to a device directly. It talks to a device controller through hardware interconnects.

![PCIe architecture evolution](lec18_materials/pcie_serial_lanes_architecture.png)

Buses (or PCIe lane fabrics) provide the physical/protocol substrate for data movement and control transactions.

![CPU-controller communication](lec18_materials/cpu_controller_port_mapped_vs_mmio.png)

Two classic ways to access controller registers:

- Port-mapped I/O: dedicated in/out instruction space.
- Memory-mapped I/O (MMIO): registers appear in physical address space and are accessed via load/store.

Key insight: both approaches expose control/status registers, but MMIO aligns naturally with normal memory instructions and modern system integration.

## 3. Moving Data: Programmed I/O vs DMA

![PIO versus DMA](lec18_materials/pio_vs_dma_data_transfer.png)

Programmed I/O (PIO):

- CPU copies each byte/word via explicit instructions.
- Simple but CPU-intensive, so cost scales with data size.

Direct Memory Access (DMA):

- CPU configures transfer, controller moves data directly between device and memory.
- Lower CPU overhead for bulk transfer.

Typical DMA sequence:

1. Driver programs DMA/controller descriptors.
2. Device/DMA engine transfers data on the bus.
3. Device raises completion interrupt.

## 4. Completion and Driver Structure

The OS must detect completion and errors.

![Polling versus interrupt notification](lec18_materials/io_notification_polling_vs_interrupt.png)

Notification options:

- Polling: OS repeatedly checks status registers.
- Interrupts: device signals CPU when operation completes.

Kernel driver organization:

![Kernel device-driver role](lec18_materials/device_driver_kernel_role.png)
![I/O request lifecycle](lec18_materials/io_request_lifecycle_top_bottom_half.png)

- Top half: fast path for request submission and immediate control.
- Bottom half/deferred handling: completion and heavier follow-up work.

This split keeps interrupt handling responsive while preserving throughput.

## 5. Uniform OS Interface to Applications

OS aims to provide one stable abstraction despite diverse devices:

- Block devices: read/write/seek semantics.
- Character devices: stream-like byte access.
- Network devices: packet-oriented semantics.

Timing-facing semantics are equally important.

![Blocking, non-blocking, async](lec18_materials/blocking_nonblocking_async_interfaces.png)

Interface styles:

- Blocking: caller sleeps until operation completes.
- Non-blocking: call returns immediately; result may be partial or unavailable.
- Asynchronous: caller submits request and gets completion notification later.

:::tip Key Question: Which timing API is “best”?
**Question (original intent): Should systems always prefer asynchronous APIs for performance?**

Answer:
- No single style is universally best.
- Blocking is simpler for sequential logic.
- Non-blocking/asynchronous can improve concurrency and resource utilization, but increase application complexity.
- API choice should follow workload and programming model constraints.
:::

## 6. HDD Fundamentals: Geometry and Access Cost

![HDD geometry](lec18_materials/hdd_sector_track_cylinder_geometry.png)

Core terms:

- Sector: transfer unit.
- Track: ring of sectors.
- Cylinder: aligned tracks across platters.

A disk access cost has multiple components.

![Disk latency model](lec18_materials/disk_latency_components_formula.png)

$$
T_{\text{disk}} = T_{\text{queue}} + T_{\text{controller}} + T_{\text{seek}} + T_{\text{rotation}} + T_{\text{xfer}}
$$

Interpretation:

- Seek time: move arm/head to target track.
- Rotational latency: wait for target sector under head.
- Transfer time: actually move bits.

## 7. HDD Numerical Example and Locality Implication

![Disk performance example](lec18_materials/disk_performance_numerical_example.png)

Given 7200 RPM:

$$
T_{\text{rotation}} = \frac{60000\ \text{ms/min}}{7200\ \text{rev/min}} \approx 8\ \text{ms},
\quad
\overline{T}_{\text{rotation}} \approx 4\ \text{ms}
$$

For a 4KB block and 50MB/s transfer rate:

$$
T_{\text{xfer}} = \frac{4096}{50\times10^6}\ \text{s}
= 81.92\times10^{-6}\ \text{s}
\approx 0.082\ \text{ms}
$$

Random block read:

$$
T_{\text{rand}} = 5 + 4 + 0.082 = 9.082\ \text{ms}
$$

Same-cylinder random block:

$$
T_{\text{same-cyl}} = 4 + 0.082 = 4.082\ \text{ms}
$$

Takeaway: reducing seek and rotational delay dominates performance gains for HDD-oriented systems.

:::warn Key Question: Why do file systems care so much about layout locality on HDD?
**Question (original intent): Transfer bandwidth looks high; why is random access still slow?**

Answer:
- Media transfer can be fast, but seek + rotation dominate short random I/O.
- Layout locality minimizes mechanical repositioning costs.
- So block placement and request scheduling are first-order optimizations on HDDs.
:::

## 8. SSD Read and Write Asymmetry

SSD removes mechanical seek/rotation delays, but write path introduces new constraints.

![SSD read architecture](lec18_materials/ssd_read_architecture_and_latency.png)

Read-path latency model:

$$
T_{\text{ssd-read}} = T_{\text{queue}} + T_{\text{controller}} + T_{\text{xfer}}
$$

Writes are harder:

![SSD write cost](lec18_materials/ssd_write_cost_and_block_erase.png)

- Writes occur at page granularity (e.g., 4KB), but erase occurs at block granularity (e.g., 256KB).
- Erase operations are much slower and wear cells.

## 9. FTL, Copy-on-Write, Wear Leveling, and Garbage Collection

To provide HDD-like logical interfaces over flash constraints, SSD controllers use a Flash Translation Layer (FTL).

![FTL indirection and COW](lec18_materials/ssd_ftl_indirection_and_copy_on_write.png)
![Wear leveling and GC](lec18_materials/ssd_wear_leveling_and_garbage_collection.png)

Core principles:

1. Indirection mapping:
- Map logical block/page IDs to physical flash locations.

2. Copy-on-write updates:
- Write new data to free pages, then update mapping.
- Avoid in-place overwrite that would require immediate block erase.

3. Wear leveling:
- Spread writes across flash to avoid early wear-out hotspots.

4. Garbage collection:
- Reclaim stale pages in background and rebuild free-page pools.

:::error Key Question: Why not overwrite flash blocks in place?
**Question (original intent): If OS writes 4KB, why not directly erase and rewrite the same 256KB block each time?**

Answer:
- Block erase is slow (millisecond-scale) and expensive.
- Flash blocks have finite program/erase endurance.
- In-place overwrite would amplify latency and accelerate wear-out.
- FTL + COW + GC is the practical compromise.
:::

## 10. HDD vs SSD and System-Level Implications

![HDD vs SSD trend](lec18_materials/hdd_vs_ssd_price_trend.png)
![Conclusion and effective BW](lec18_materials/io_conclusion_and_effective_bandwidth.png)

The lecture ends with a unifying performance view:

$$
T_{\text{resp}} = T_{\text{queue}} + T_{\text{overhead}} + T_{\text{xfer}}
$$

$$
BW_{\text{eff}} = BW \cdot \frac{T}{S+T}
$$

Practical distinctions:

- HDD: queue + controller + seek + rotation + transfer.
- SSD: queue + controller + transfer, plus erase/wear-management side effects in write-heavy paths.

System implication:

- File systems and I/O schedulers should be designed according to underlying device behavior, not device-agnostic assumptions.

## 11. Exam Review

### 11.1 Must-Know Definitions

- **Controller register interface**: device control/status via port-mapped I/O or MMIO.
- **PIO**: CPU-mediated transfer path.
- **DMA**: controller-mediated direct memory transfer path.
- **Blocking / Non-blocking / Asynchronous**: three timing contracts between application and OS.
- **Disk latency decomposition**: queue + controller + seek + rotation + transfer.
- **FTL**: logical-to-physical flash mapping layer.
- **Wear leveling**: write-distribution strategy to extend flash lifetime.
- **Garbage collection (SSD)**: reclaim invalid pages and recover free space.

### 11.2 Short-Answer Templates

- “Why DMA over PIO?”: lower CPU cost and better overlap for large transfers.
- “Why HDD random I/O is slow?”: mechanical seek/rotation dominates transfer.
- “Why SSD writes are tricky?”: erase granularity and wear constraints require indirection and GC.
- “Why interface unification matters?”: portability at API level with device-specific optimization underneath.

### 11.3 Common Pitfalls

- Treating SSD as “just faster HDD” without write-path constraints.
- Ignoring queueing/controller overhead when applying simplified formulas.
- Using one timing API style everywhere without considering workload concurrency.

### 11.4 Self-Check

1. Can you derive HDD latency terms for a given RPM and transfer size?
2. Can you explain when DMA provides meaningful gains over PIO?
3. Can you justify why FTL must support copy-on-write updates?
4. Can you describe how wear leveling and garbage collection interact?
5. Can you use `BW_eff = BW * T/(S+T)` to explain protocol/setup overhead effects on small transfers?
