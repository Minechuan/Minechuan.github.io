# Lecture 14: Memory 2 - Virtual Memory (Cont.), Caching, and TLBs

## Learning Objectives

By the end of this lecture, you should be able to:

1. Explain why flat page tables do not scale and how multi-level translation fixes sparsity.
2. Interpret key PTE states and explain demand paging, copy-on-write, and sharing.
3. Compare forward page tables, multi-level paging, and inverted page tables.
4. Explain where MMU sits on the access path and why translation latency matters.
5. Derive and use AMAT, and classify cache misses.
6. Explain TLB behavior, write policies, and physically-indexed vs virtually-indexed cache tradeoffs.

## 1. Fast Recap: Why Translation Structures Keep Evolving

We started from base-and-bound, moved to segmentation, then paging. The key direction never changed: keep isolation strong, while making translation cheap enough to run on every instruction fetch, load, and store.

A single-level page table is simple, but sparse 32/64-bit spaces make it expensive. Real systems therefore use hierarchical structures and caching of translation results.

:::remark Key Question: Why can't we just keep one flat table forever?
**Question (original intent): If one-level paging is conceptually clean, why add hierarchy?**

Answer:
- A flat table allocates metadata for an enormous virtual space, even when most pages are unmapped.
- Hierarchical tables allocate lower levels only where mappings actually exist.
- This preserves paging semantics while reducing memory overhead.
:::

## 2. Multi-level Translation: Segment + Page Trees

The lecture first shows a combined segmented + paged view, where top-level region selection and lower-level page translation are composed.

![Multi-level translation (segments + pages)](lec14_materials/multilevel_translation_segments_pages.png)

For the canonical two-level 32-bit split:

$$
32 = 10 + 10 + 12
$$

$$
\text{PageSize} = 2^{12} = 4096\,\text{B} = 4\,\text{KB}
$$

With 4-byte PTEs, one page table page stores:

$$
\frac{4096\,\text{B}}{4\,\text{B}} = 1024 = 2^{10}
$$

So each intermediate index level can use 10 bits in this example.

### 2.1 PTE Meaning Beyond "valid/invalid"

A Page Table Entry carries location and protection, and "invalid" does not mean one single thing.

Common meanings used by OS designs in this lecture:

- Not allocated / illegal access.
- Not in DRAM yet (demand paging).
- Copy-on-write pending split.
- Zero-fill-on-demand page not materialized yet.

:::tip Key Question: If a PTE is invalid, is it always a fatal error?
**Question (original intent): Does invalid always imply segmentation fault?**

Answer:
- No. It can be a protection fault, but it can also be a recoverable state.
- For demand paging, invalid may mean "present on disk, load now".
- For COW or zero-fill-on-demand, invalid/protection state can trigger legal kernel handling.
:::

## 3. Sharing and Real Architectures

Sharing can happen at segment level or page level. Multi-level tables support both while still keeping sparse allocation.

### 3.1 x86_64 Four-level Page Table

![x86_64 four-level page table](lec14_materials/x86_64_four_level_page_table.png)

A common 48-bit canonical virtual split is:

$$
48 = 9 + 9 + 9 + 9 + 12
$$

This layout keeps each page-table page naturally sized for efficient indexing.

### 3.2 IA64-style Many-level Thought Experiment

The lecture contrasts this with deeper trees for 64-bit spaces:

$$
64 = 7 + 9 + 9 + 9 + 9 + 9 + 12
$$

The point is not to memorize one ISA layout, but to understand the tradeoff: more levels improve sparse representation but increase walk depth on misses.

:::warn Key Question: Why not keep adding levels forever?
**Question (original intent): If deeper trees save memory, why not always maximize levels?**

Answer:
- More levels increase page-walk latency and memory references on misses.
- Many near-empty tables can increase management complexity.
- Practical designs balance sparse efficiency against critical-path translation latency.
:::

## 4. System-level Tradeoffs: Multi-level vs Inverted Tables

The lecture compares major strategies:

![Address translation comparison](lec14_materials/address_translation_comparison_table.png)

- Multi-level paging: sparse-friendly, easy sharing/allocation, but more lookups per reference.
- Inverted page table: size tied to physical memory, attractive on large virtual spaces, but hash-chain management and locality can be harder.

![Inverted page table concept](lec14_materials/inverted_page_table_hash_based.png)

### 4.1 Protection Constraint: Who Can Edit Translation State?

A process must not directly rewrite its own translation tables, otherwise isolation collapses.

Dual-mode operation enforces this:

- User mode runs application code.
- Kernel mode owns privileged operations (page-table base updates, mapping changes, descriptor changes).
- x86 privilege rings are one implementation detail; most OSes effectively use kernel/user split.

:::error Key Question: Why is page-table update privileged?
**Question (original intent): If a process could edit mappings freely, what breaks first?**

Answer:
- It could map arbitrary physical pages and bypass isolation.
- It could read/write kernel or other processes' memory.
- Therefore page-table pages and mapping control are kernel-protected resources.
:::

## 5. Where MMU Sits and Why Raw Translation Is Expensive

![Where is the MMU on the access path](lec14_materials/where_is_mmu.png)

MMU is on the critical path of every memory reference. Without translation caching, each memory access may trigger multiple memory operations just to discover the target physical page.

![Translation cost and TLB motivation](lec14_materials/translation_cost_and_tlb_motivation.png)

That is why the design must optimize both:

- data caching, and
- translation caching.

## 6. Caching Fundamentals and Locality

Caching wins because programs exhibit locality.

- Temporal locality: recently used items are likely reused soon.
- Spatial locality: neighbors of recently used addresses are likely used soon.

The lecture uses AMAT as a core metric:

$$
\text{AMAT} = (\text{HitRate} \times \text{HitTime}) + (\text{MissRate} \times \text{MissTime})
$$

$$
\text{HitRate} + \text{MissRate} = 1
$$

Worked examples:

$$
\text{HitRate}=90\% \Rightarrow \text{AMAT}=(0.9\times1)+(0.1\times101)=11\,\text{ns}
$$

$$
\text{HitRate}=99\% \Rightarrow \text{AMAT}=(0.99\times1)+(0.01\times101)=2\,\text{ns}
$$

:::tip Key Question: Why does a small hit-rate increase matter so much?
**Question (original intent): Why does 90% to 99% dramatically reduce AMAT?**

Answer:
- Miss penalty is usually much larger than hit time.
- A small miss-rate drop removes many expensive slow-path events.
- So translation/data locality improvements can produce outsized latency gains.
:::

## 7. TLB: Caching Translation Results

![Caching recent translations (TLB idea)](lec14_materials/cache_recent_translations_tlb.png)

TLB is a cache of recent VPN -> PPN translations (plus permission/state bits).

Hit path:

- Lookup TLB by virtual page number.
- If hit and permissions pass, combine PPN with offset and continue quickly.

Miss path:

- Walk page table(s).
- If PTE absent/invalid in a recoverable way, trigger page-fault handling.
- If resolved, refill TLB and retry.

Key maintenance rule:

- When page-table mappings change, affected TLB entries must be invalidated or updated.

## 8. Cache Miss Taxonomy and Organization Review

Major miss types in this lecture:

- Compulsory miss (cold start).
- Capacity miss (working set exceeds cache capacity).
- Conflict miss (mapping collisions).
- Coherence miss (external update invalidates cached copy).

Address decomposition for cache lookup:

![Cache block fields: tag/index/offset](lec14_materials/cache_block_tag_index_offset.png)

Placement choices:

![Placement: direct vs set-associative vs fully-associative](lec14_materials/cache_placement_direct_set_fully.png)

Equivalent formulas used in examples:

$$
\text{Direct-mapped index}=\text{BlockNo}\bmod \#\text{lines}
$$

$$
\text{Set index}=\text{BlockNo}\bmod \#\text{sets}
$$

Replacement policies highlighted:

- Random.
- LRU (Least Recently Used).

## 9. Write Policies and Cache Indexing Choices

Write policy summary:

- Write-through: update cache and lower level on each write; simpler visibility, higher write traffic.
- Write-back: update cache first; write dirty line on eviction; better average write cost, more complexity.

Physically-indexed vs virtually-indexed discussion:

![Physically-indexed vs virtually-indexed caches](lec14_materials/physically_vs_virtually_indexed_cache.png)

- Physically indexed: translation before cache indexing; avoids synonym/alias ambiguity, but TLB is in lookup-critical path.
- Virtually indexed: can reduce critical-path dependence on TLB, but alias handling and context-switch behavior become harder.

## 10. End-to-End Access Path (Mental Model)

A practical way to reason about one memory operation:

1. CPU issues a virtual address.
2. TLB lookup tries to return translation immediately.
3. On TLB miss, hardware/software page walk checks PTE chain.
4. After physical address is formed, cache hierarchy serves data (or misses to lower levels).
5. Permission/validity failures trigger protection fault or page fault handling.

## 11. Exam Review

### 11.1 Must-Know Definitions

- **Multi-level paging**: hierarchical page tables allocate lower-level tables only for used regions.
- **Inverted page table**: hash/indexed structure sized by physical-memory footprint rather than full virtual range.
- **TLB**: small, usually highly-associative cache of recent translations and optional process IDs.
- **AMAT**: weighted average access time by hit/miss probabilities and their latencies.
- **Conflict miss**: miss caused by placement collision, not by total cache capacity.
- **Write-through / Write-back**: immediate lower-level propagation vs deferred dirty-line eviction.

### 11.2 High-Value Short-Answer Templates

1. **Why does multi-level paging help sparse address spaces?**  
   It allocates translation metadata on demand for used regions, instead of preallocating entries for the entire virtual range.
2. **What happens on a TLB miss?**  
   The system walks page tables; if mapping is valid, refill TLB and continue; if not, raise a page fault/protection exception.
3. **Why is an inverted page table attractive for large virtual spaces?**  
   Its size scales with physical memory, not the virtual-address upper bound.
4. **How do write-through and write-back differ operationally?**  
   Write-through propagates immediately to lower memory; write-back delays propagation until eviction of dirty cache lines.

### 11.3 Common Pitfalls

- Treating every invalid PTE as "always fatal".
- Ignoring TLB maintenance after mapping changes.
- Confusing capacity and conflict misses.
- Assuming deeper table hierarchies are always better regardless of walk latency.
- Forgetting that translation and data-cache costs are stacked on the same critical access path.

### 11.4 Self-Check

:::tip Self-check 1
Given a 48-bit VA split into 9-9-9-9-12, explain how many index levels are walked on a TLB miss before data-cache lookup can proceed.
:::

:::tip Self-check 2
A workload improves TLB hit rate from 95% to 99%. Explain qualitatively why tail latency can improve even if average instruction count is unchanged.
:::

:::tip Self-check 3
When would physically-indexed caches be preferred over virtually-indexed caches in OS design? Give two reasons tied to correctness and one tied to performance tradeoff.
:::
