# Lecture 13: Memory 1 - Address Translation and Virtual Memory

## Learning Objectives

By the end of this lecture, you should be able to:

1. Explain why memory virtualization must provide both protection and translation.
2. Compute address-space and page-table sizes from bit widths.
3. Compare uniprogramming, relocation-only multiprogramming, and base-and-bound protection.
4. Explain segmentation translation, strengths, and fragmentation limits.
5. Explain simple paging translation, sharing, and page-growth behavior.
6. Analyze why naive flat page tables become too large on sparse 64-bit spaces.

## 1. Why Memory Virtualization Is Needed

Physical memory is shared hardware, but each process needs a private, stable programming model.

Two requirements must hold at the same time:

- **Protection**: one process cannot corrupt another process or the kernel.
- **Translation**: program-visible addresses can be mapped to different physical locations.

A useful mental model is OS interposition:

- I/O interposition via system calls,
- CPU interposition via interrupts,
- memory interposition via hardware translation on common accesses and page faults on exceptional accesses.

:::remark Key Question: Why can memory interposition not be done entirely in software?
**Question (original intent): If OS should control memory accesses, why not trap every load/store into the kernel?**

Answer:
- Every instruction may read or write memory, so trapping all accesses would be far too slow.
- The MMU handles the fast path in hardware.
- The OS is invoked only on uncommon events (for example, faults, permission violations, missing mappings).
:::

## 2. Address Space Basics and Sizing Math

**Address Space** means the set of addresses a program can issue.

For byte-addressed memory with a k-bit address:

$$
\text{Address space size} = 2^k\ \text{bytes}
$$

Core conversions used repeatedly:

$$
2^{10}\,\text{B} = 1024\,\text{B} = 1\,\text{KB}
$$

$$
4\,\text{KB} = 4\times 2^{10}\,\text{B} = 2^{12}\,\text{B}
$$

For a 32-bit process:

$$
2^{32}\ \text{bytes} \approx 4\times10^9\ \text{bytes}
$$

A 32-bit integer takes 4 bytes, so the count of 32-bit integers addressable is:

$$
\frac{2^{32}}{4\,\text{B}} = 2^{30}
$$

## 3. Process Virtual Address Space and Access Semantics

**Virtual Address Space** is not just a numeric interval. It is addresses plus associated mapping/protection state.

A virtual address access may:

- read or write ordinary memory,
- trigger an exception (for example segmentation fault),
- access memory-mapped I/O,
- touch shared regions when explicitly mapped.

This is why translation must be policy-aware, not only arithmetic.

## 4. From Uniprogramming to Primitive Multiprogramming

Uniprogramming gives one process the machine, so no overlap problem appears.

Primitive multiprogramming without protection/translation places multiple programs in physical memory and relies on relocation when loading.

![Primitive multiprogramming with relocation](lec13_materials/primitive_multiprogramming_relocation.png)

This approach can run multiple programs, but bugs in one program can still overwrite others or the OS.

:::warn Key Question: What is missing in relocation-only multiprogramming?
**Question (original intent): If linker/loader can relocate addresses, why is the system still unsafe?**

Answer:
- Relocation decides initial placement, but does not enforce runtime access boundaries.
- Without hardware checks, any wrong pointer can cross into foreign memory.
- So isolation is not guaranteed.
:::

## 5. Base and Bound: Hardware Protection with Minimal Translation

Base-and-bound adds runtime checks and relocation support in hardware:

- Bound check confirms offset is in range.
- Base is added to form physical address.

![Base and bound with protection](lec13_materials/base_bound_without_translation.png)

Core conditions:

$$
0 \le \text{Offset} < \text{Bound}
$$

$$
\text{PA} = \text{Base} + \text{Offset}
$$

This is already a major step: process memory can be isolated from OS and other processes.

:::remark Key Question: Does base-and-bound solve all memory multiplexing needs?
**Question (original intent): If base-and-bound already protects processes, why do we need more mechanisms?**

Answer:
- It protects well for one contiguous region.
- Real processes are sparse (code/data/heap/stack/shared pieces).
- One contiguous region is too rigid for fragmentation handling and sharing.
:::

## 6. Why Simple Base-and-Bound Is Not Enough

Three practical limits appear quickly:

1. External fragmentation grows over time with variable process sizes.
2. Sparse address spaces are awkward under a single contiguous model.
3. Inter-process sharing is hard when layout is monolithic.

These limits motivate segmentation and then paging.

## 7. Segmentation: Multiple Logical Regions Per Process

### 7.1 Translation Pipeline

Segmentation divides a process into logical regions such as code, data, heap, stack, and optionally shared segments.

![Segmentation translation pipeline](lec13_materials/segmentation_translation_pipeline.png)

Translation rule:

$$
\text{PA} = \text{Base}[\text{Seg}] + \text{Offset}
$$

Access is valid only if:

$$
V[\text{Seg}] = 1\ \land\ \text{Offset} < \text{Limit}[\text{Seg}]
$$

### 7.2 Four-Segment Example and Sharing

A segment ID selects one base/limit pair. Different segments can map to unrelated physical locations.

![Four-segment mapping and sharing room](lec13_materials/four_segment_layout_with_sharing.png)

This gives natural support for:

- sparse layout,
- per-segment permissions,
- selective shared segments.

### 7.3 Operational Observations

- Translation still occurs on every instruction fetch/load/store.
- Segment table entries need protection bits (read-only code, read-write data/stack, etc.).
- Stack/heap growth may be handled by faults and controlled segment expansion.

:::tip Key Question: Why can segmentation still become expensive?
**Question (original intent): If segmentation is flexible, what blocks scalability?**

Answer:
- Segments are variable-sized, so fitting them causes fragmentation pressure.
- Swapping variable chunks can be costly.
- Compaction/movement overhead rises when memory is busy.
:::

## 8. Swapping and the Need for Finer Granularity

When segments do not fit, systems may swap segments or entire process memory to disk.

![Swapping motivation](lec13_materials/swapping_motivation.png)

Swapping restores capacity but increases context-switch cost sharply.

This motivates fixed-size units so memory management can operate at finer granularity.

## 9. Paging: Fixed-Size Translation and Better Allocation

### 9.1 Core Mechanism

Paging divides virtual and physical memory into fixed-size pages/frames.

![Simple paging translation path](lec13_materials/simple_paging_translation_path.png)

Address decomposition:

$$
\text{VA} = \text{VPN} \parallel \text{Offset}
$$

$$
\text{PageSize} = 2^{|\text{Offset}|}
$$

For 10-bit offset:

$$
|\text{Offset}| = 10 \Rightarrow \text{PageSize} = 2^{10} = 1024\,\text{B}
$$

For a 32-bit VA with 10-bit offset:

$$
|\text{VPN}| = 32 - 10 = 22
$$

$$
\#\text{PTEs} = 2^{22}\ \text{(about 4 million)}
$$

### 9.2 Worked Example Intuition

![Simple page table worked example](lec13_materials/simple_page_table_worked_example.png)

The offset bits are copied directly to the physical address; only the page number part is translated through the page table.

### 9.3 Sharing Under Paging

Different processes can map different VPNs to the same physical frame.

![Shared physical page across processes](lec13_materials/page_sharing_between_processes.png)

Common uses:

- shared kernel mappings (with privilege protection),
- read-only shared code pages for the same binary/libraries,
- explicit shared-memory IPC regions.

:::remark Key Question: Why must page-sharing mappings be carefully controlled?
**Question (original intent): If sharing is useful, why not map pages freely across processes?**

Answer:
- Sharing changes isolation boundaries.
- Permissions must match intended semantics (read-only vs read-write).
- Incorrect sharing can reintroduce corruption and privilege risks.
:::

## 10. Paging Growth Behavior and Page-Table Size Explosion

When stack grows, new virtual pages can map to any free physical frames; contiguity is unnecessary.

![Stack growth by allocating new pages](lec13_materials/paging_stack_growth_with_new_pages.png)

This is a key advantage over variable contiguous segments.

However, simple flat page tables can be huge.

![Simple page-table size explosion](lec13_materials/simple_page_table_size_explosion.png)

For 32-bit VA, 4KB pages, 4-byte PTE:

$$
\frac{2^{32}}{2^{12}} = 2^{20}\ \text{entries}
$$

$$
2^{20}\times 4\,\text{B} = 2^{22}\,\text{B} = 4\,\text{MB}
$$

For 64-bit VA, 4KB pages, 8-byte PTE:

$$
\frac{2^{64}}{2^{12}} = 2^{52}\ \text{entries}
$$

$$
2^{52}\times 8\,\text{B} = 2^{55}\,\text{B} \approx 36\times10^{15}\,\text{B}
$$

The central issue is sparsity: most virtual space is unmapped, but a naive flat table still reserves indexing space for all possible pages.

:::error Key Question: Is a huge flat page table unavoidable?
**Question (original intent): If simple paging table is too big, does the whole paging idea fail?**

Answer:
- No. The problem is not paging itself, but the flat table representation.
- Multi-level paging (next lecture) stores translation structure sparsely.
- So we keep paging benefits while cutting table memory cost.
:::

## 11. Segmentation vs Paging: Practical Comparison

Segmentation strengths:

- matches program logical regions,
- natural per-region protection and sharing.

Segmentation weaknesses:

- variable-size placement and external fragmentation,
- costly movement/swapping decisions.

Paging strengths:

- uniform fixed-size allocation,
- easy frame management and sharing,
- growth without physical contiguity.

Paging weakness in simple form:

- large page tables for sparse spaces.

Real systems often combine ideas (for example, paging as main mechanism, with segmentation-like protection domains or legacy segment features).

## 12. Summary

- Memory virtualization requires both **protection** and **translation**.
- Base-and-bound gives early hardware isolation but limited flexibility.
- Segmentation improves logical structure and sparse mapping but suffers fragmentation/scalability limits.
- Paging solves variable-chunk allocation issues and supports efficient sharing.
- Flat page tables do not scale to sparse 64-bit spaces, motivating multi-level translation tables.

## 13. Exam Review

### 13.1 Must-Know Definitions

- **Address space**: all addresses a process can issue, plus mapping/protection semantics.
- **Base-and-bound**: hardware check-and-relocate scheme using bound check and base addition.
- **Segmentation**: translation by segment ID plus offset with per-segment base/limit/permissions.
- **Paging**: translation by virtual page number to physical frame number; offset unchanged.
- **External fragmentation**: unusable free gaps between allocated variable-size chunks.
- **Sparse address space**: large virtual range with only a small mapped subset.

### 13.2 High-Value Short-Answer Templates

1. **Why was base-and-bound not enough?**  
   It provides isolation for one contiguous region, but weak support for sparse layouts, sharing, and long-term fragmentation control.
2. **Why does paging improve memory multiplexing?**  
   Fixed-size frames simplify allocation, reduce external-fragmentation pressure, and allow non-contiguous growth and controlled sharing.
3. **Why does a flat page table explode on 64-bit systems?**  
   Entry count scales with virtual-page count, and sparse unmapped regions still consume table indexing space in a flat design.

### 13.3 Common Pitfalls

- Treating relocation-only loading as equivalent to runtime protection.
- Confusing internal and external fragmentation causes.
- Forgetting that offset bits are copied unchanged during paging translation.
- Assuming bigger virtual address space always means practical usable memory.

### 13.4 Self-Check

:::tip Self-check 1
Given 4KB pages and a 48-bit virtual address, how many offset bits and VPN bits are there?
:::

:::tip Self-check 2
A process uses code/data/heap/stack with large gaps. Explain in one paragraph why segmentation or paging handles this better than a single contiguous base-and-bound region.
:::

:::tip Self-check 3
Compute the flat page-table memory cost for a 32-bit process with 8KB pages and 4-byte PTEs.
:::
