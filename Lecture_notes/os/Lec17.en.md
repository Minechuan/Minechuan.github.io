# Lecture 17: Memory 5 - Memory Management in Modern Computer Systems

## Learning Objectives

By the end of this lecture, you should be able to:

1. Explain how modern systems use memory abstractions to bridge hardware trends and application demands.
2. Compare five representative systems (FaRM, vLLM, Infiniswap, AIFM, PipeSwitch, TGS) using a common design lens.
3. Extract the core mechanism behind each system and map it to the bottleneck it solves.
4. Reason about transparency, isolation, utilization, and programmability tradeoffs in distributed and GPU memory management.

## 1. Big Picture: One Course, Multiple Memory Frontiers

This lecture is a synthesis lecture. Instead of introducing one isolated mechanism, it revisits multiple systems and asks one central question:

**How do we turn memory into a scalable, high-performance abstraction across machines and accelerators?**

The covered systems naturally form four tracks:

- Memory abstraction over fast networks: FaRM, vLLM.
- Remote-memory paging/disaggregation: Infiniswap, AIFM.
- GPU-memory sharing and swapping between GPU/host memory: PipeSwitch, TGS.

:::remark Key Question: Why group these papers together?
**Question (original intent): These systems seem to target different domains. What is the unifying theme?**

Answer:
- All of them redesign memory management around a concrete performance bottleneck.
- Each one changes the abstraction boundary (application/runtime/OS/hardware) to recover efficiency.
- Together, they show that modern memory management is increasingly cross-layer and workload-aware.
:::

## 2. FaRM: RDMA-Native Shared Memory with Transactions

![FaRM RDMA data path](lec17_materials/farm_rdma_data_path.png)

FaRM starts from a hardware fact: large DRAM capacity and fast datacenter RDMA networks make remote memory access practical for latency-sensitive services.

![Programming modern clusters](lec17_materials/farm_programming_modern_cluster_question.png)

Its key move is to provide a **shared address space abstraction** across machines, so developers can reason about distributed in-memory data more like local memory.

![FaRM shared address space](lec17_materials/farm_shared_address_space_layout.png)

To keep this model usable for real services, FaRM combines it with **transactional execution**.

![FaRM transaction pipeline](lec17_materials/farm_transaction_pipeline.png)

The transaction path follows a lock/validate/update flow and leverages one-sided RDMA operations, which reduces software overhead in the data path.

![FaRM TAO case study](lec17_materials/farm_tao_case_study.png)

Takeaway:

- FaRM is not only about remote access speed.
- It is about making distributed memory programming practical through the pair: **shared memory abstraction + transactions**.

## 3. vLLM: PagedAttention for LLM KV Cache Management

LLM serving is memory-bound and cache-management-bound before it is pure compute-bound.

![Autoregressive inference process](lec17_materials/vllm_autoregressive_inference_process.png)

Batching improves throughput but makes KV-cache pressure more severe when many requests grow/shrink dynamically.

![Batching and KV pressure](lec17_materials/vllm_batching_requests_and_kv_pressure.png)
![KV cache basics](lec17_materials/vllm_kv_cache_basics.png)

Previous systems often reserve contiguous regions per request, causing both internal and external fragmentation.

![Previous KV cache management](lec17_materials/vllm_previous_kv_cache_management_fragmentation.png)

vLLM introduces **PagedAttention**: paging/virtualization ideas at application level for KV cache.

![PagedAttention overview](lec17_materials/vllm_pagedattention_overview.png)
![Virtualized KV blocks](lec17_materials/vllm_virtualized_kv_blocks.png)

Key consequences:

- Much lower memory waste.
- Flexible growth/shrink per sequence.
- Natural support for prefix/block sharing across decoding branches.

![Memory efficiency and fragmentation](lec17_materials/vllm_memory_efficiency_internal_fragmentation.png)

The sharing metric in lecture is:

$$
\text{MemorySaving\%} = \frac{\#\text{blocks saved by sharing}}{\#\text{total blocks without sharing}} \times 100\%
$$

![Memory saving via sharing](lec17_materials/vllm_memory_saving_via_sharing.png)

For preemption, vLLM discusses swapping versus recomputation.

![Preemption and recovery](lec17_materials/vllm_preemption_and_recovery_options.png)

Evaluation highlights include strong throughput gains for greedy and beam-search decoding.

![Greedy decoding throughput](lec17_materials/vllm_throughput_greedy_decoding.png)
![Beam-search throughput](lec17_materials/vllm_throughput_beam_search.png)

**Key definition:** **PagedAttention is application-level memory paging/virtualization specialized for attention KV caches.**

:::tip Key Question: Why does OS-style paging help LLM serving?
**Question (original intent): KV cache is an application structure, so why borrow virtual-memory ideas?**

Answer:
- The core problem is still dynamic allocation and fragmentation under unpredictable growth.
- Paging gives fixed-size blocks and indirection, which decouples logical growth from physical contiguity.
- This is exactly the condition where virtualization improves utilization.
:::

## 4. Infiniswap: Practical Remote Paging for Memory Disaggregation

Production clusters often have significant unused memory on some machines while other containers are memory-starved.

![Memory underutilization](lec17_materials/infiniswap_memory_underutilization_google_trace.png)

Infiniswap uses this idle memory by treating remote memory as paging space over RDMA.

![Disaggregate free memory](lec17_materials/infiniswap_disaggregate_free_memory_idea.png)
![Infiniswap system overview](lec17_materials/infiniswap_system_overview.png)

Design goals are practical: no hardware redesign, no app modification, and failure tolerance.

![Objectives and ideas](lec17_materials/infiniswap_design_objectives_and_ideas.png)

Two important mechanisms:

- **Memory slab** as management unit (instead of tiny page-granularity remote bookkeeping).
- **Power of two choices** for scalable remote-target selection.

![Memory slab unit](lec17_materials/infiniswap_memory_slab_management_unit.png)
![Power of two choices](lec17_materials/infiniswap_power_of_two_choices.png)

Result highlight:

![Cluster utilization result](lec17_materials/infiniswap_cluster_memory_utilization_result.png)

- Cluster memory utilization improves from **40.8% to 60% (1.47x)** in the reported setup.

:::warn Key Question: Why not use a central global controller for remote-memory placement?
**Question (original intent): Wouldn't one global optimizer make better placement choices?**

Answer:
- A centralized path becomes a scalability and fault-tolerance bottleneck.
- Infiniswap favors decentralized, low-overhead heuristics.
- Slightly suboptimal local choices are often worth the gain in robustness and scalability.
:::

## 5. AIFM: Application-Integrated Far Memory

AIFM argues that OS paging alone leaves too much performance on the table for far memory.

![Memory is inelastic](lec17_materials/aifm_memory_inelasticity.png)
![Why existing systems waste performance](lec17_materials/aifm_why_existing_systems_waste_performance.png)

Two root causes emphasized in lecture:

- **Semantic gap**: page granularity ignores object-level meaning and access intent.
- **Kernel overhead**: page faults and in-kernel networking overheads are expensive.

AIFM's design is user-space integrated:

![AIFM design overview](lec17_materials/aifm_design_overview.png)

- Remoteable data-structure library to expose semantics.
- User-space runtime for efficient object movement.
- Pauseless evacuator for low-disruption reclamation.
- Remote agent to reduce bandwidth mismatch impact.

![Pauseless evacuator](lec17_materials/aifm_pauseless_evacuator.png)

The code transformation idea is explicit: swap native structures with remoteable ones while preserving programming style.

![Sample code before](lec17_materials/aifm_sample_code_before_remoteable_ds.png)
![Sample code after](lec17_materials/aifm_sample_code_with_remoteable_ds.png)

Representative result from NYC Taxi analysis:

![NYC Taxi analysis](lec17_materials/aifm_nyc_taxi_analysis.png)

- At memory fraction `x=3%`, normalized performance around `y=0.77`.
- At `x=23%`, normalized performance around `y=0.95`.

**Key definition:** **AIFM is an application-integrated far-memory design that moves object management into user-space runtime and data structures.**

## 6. PipeSwitch: Fast Pipelined GPU Context Switching

GPU clusters commonly separate training and inference, but that static separation hurts utilization.

![Low utilization motivation](lec17_materials/pipeswitch_low_gpu_utilization_motivation.png)

PipeSwitch targets a concrete pain point: context switching across DL jobs is too slow for fine-grained sharing.

![Goal: fast context switching](lec17_materials/pipeswitch_goal_fast_context_switching.png)

Architecture includes controller, active/standby workers, and a memory daemon.

![PipeSwitch architecture](lec17_materials/pipeswitch_architecture.png)

Its core optimization is **pipelined model transmission and execution**.

![Pipelined transmission and execution](lec17_materials/pipeswitch_pipelined_transmission_execution.png)

It also uses unified memory management and active-standby switching to cut allocation/init/cleanup overheads.

![Unified memory management](lec17_materials/pipeswitch_unified_memory_management.png)
![Active-standby switching](lec17_materials/pipeswitch_active_standby_worker_switching.png)

Reported outcome:

![High utilization result](lec17_materials/pipeswitch_high_utilization_result.png)

- Near-100% GPU utilization in evaluated scheduling cycles.

:::remark Key Question: Why is pipelining essential here, not just an optimization detail?
**Question (original intent): Can't we just make each switching step a bit faster?**

Answer:
- Sequential transfer-then-execute leaves hardware idle in each phase.
- Pipelining overlaps PCIe transfer and GPU compute across layer groups.
- Overlap changes the critical path itself, not just constant factors.
:::

## 7. TGS: Transparent GPU Sharing in Container Clouds

TGS addresses low utilization in shared container environments while preserving production-job protection.

![Low utilization in production](lec17_materials/tgs_low_gpu_utilization_in_production.png)

It compares against two major categories:

- Application-layer customization (e.g., AntMan): effective but weak transparency.
- OS/hardware-layer methods (MPS/MIG): more transparent but constrained in utilization/flexibility.

![TGS comparison table](lec17_materials/tgs_comparison_table_antman_mps_mig.png)

TGS architecture combines rate monitoring/control with unified memory handling.

![TGS architecture](lec17_materials/tgs_architecture.png)

### 7.1 Adaptive Rate Control for Compute Sharing

![TGS adaptive rate control](lec17_materials/tgs_adaptive_rate_control.png)

Lecture notation shows:

$$
\alpha_{out} = \alpha_{in}
$$

$$
\beta_{out} \le \beta_{in}
$$

Interpretation:

- Keep production-job throughput demand (`\alpha`) intact.
- Throttle opportunistic-job issue rate (`\beta`) according to remaining resources.

### 7.2 Transparent Unified Memory for Memory Sharing

When GPU memory is oversubscribed, TGS leverages CUDA unified memory to remap opportunistic pages to host memory, preserving production stability.

![TGS unified-memory mechanism](lec17_materials/tgs_transparent_unified_memory_mechanism.png)

### 7.3 Evaluation Signals

![TGS mixed workload result](lec17_materials/tgs_mixed_workload_jct_results.png)

For mixed stream (50 production + 50 opportunistic jobs):

- Opportunistic jobs: **52% JCT reduction** vs exclusive GPU assignment.
- Production jobs: **21% JCT reduction** vs uncontrolled co-execution.

![TGS oversubscription result](lec17_materials/tgs_unified_memory_oversubscription_results.png)

Under memory oversubscription, TGS reports up to about **15% throughput gain** over MPS in this lecture summary.

![TGS conclusion slide](lec17_materials/tgs_conclusion_summary.png)

:::error Key Question: What does ?transparent? really mean in TGS?
**Question (original intent): Is transparency just "no source-code modification"?**

Answer:
- No framework/source rewrite is a necessary part, but not the whole story.
- Transparency also means users keep their normal containerized workflow while the system enforces isolation/control underneath.
- TGS tries to provide utilization gains without exposing scheduling/memory-control complexity to application developers.
:::

## 8. Cross-Paper Synthesis: A Practical Comparison Lens

A concise way to compare all six systems:

- Bottleneck first: identify whether the bottleneck is network latency, memory fragmentation, paging overhead, GPU context switching, or isolation.
- Boundary shift second: decide where to place intelligence (application, runtime, OS, hardware).
- Cost accounting third: measure throughput/latency/utilization together with transparency and engineering overhead.

Common design pattern across papers:

1. Keep a simple programmer-facing model.
2. Add an indirection/virtualization layer at the right level.
3. Use runtime control loops (placement, paging, throttling, pipelining) to stabilize performance.

## 9. Exam Review

### 9.1 Must-Know Definitions

- **FaRM**: RDMA-centric distributed shared-memory platform with transactions.
- **PagedAttention**: KV-cache virtualization using fixed-size blocks and block tables.
- **Infiniswap**: remote paging system that disaggregates free memory over RDMA with practical deployment constraints.
- **AIFM**: application-integrated far memory using user-space runtime + remoteable data structures.
- **PipeSwitch**: pipelined context-switching framework for GPU-efficient DL multiplexing.
- **TGS**: transparent GPU-sharing framework combining adaptive compute-rate control and unified memory.

### 9.2 Mechanism Checklist

For each system, be ready to explain:

- The bottleneck it starts from.
- The new abstraction it introduces.
- The key mechanism (transaction path, block table, slab mapping, user-space object runtime, pipeline overlap, rate control).
- The headline evaluation gains and what baseline they are against.

### 9.3 Short-Answer Templates

- "Why this design?": tie mechanism directly to bottleneck.
- "Why not baseline X?": explain where baseline loses (fragmentation, overhead, weak isolation, poor transparency).
- "What tradeoff remains?": mention implementation complexity, hardware assumptions, or fairness/isolation tuning.

### 9.4 Common Pitfalls

- Treating throughput-only gains as complete success while ignoring isolation and transparency.
- Confusing ?remote memory exists? with ?remote memory is efficient? (control-plane and data-structure choices matter).
- Assuming one layer (OS/app/hardware) always dominates; these papers show co-design is often required.

### 9.5 Self-Check

1. Can you explain why PagedAttention resembles VM paging but differs in block-table scope and sharing semantics?
2. Can you justify why Infiniswap uses decentralized placement heuristics instead of central optimization?
3. Can you describe how AIFM reduces semantic-gap and kernel-overhead costs at the same time?
4. Can you explain why PipeSwitch's pipeline changes the critical path of switching?
5. Can you derive what `\alpha_{out} = \alpha_{in}` and `\beta_{out} \le \beta_{in}` mean for production/opportunistic coexistence in TGS?
