# Lecture 12: Scheduling in Modern Computer Systems (Paper Seminar)

## Learning Objectives

By the end of this lecture, you should be able to:

1. Explain why modern scheduling problems are now tightly coupled with tail latency, GPUs, and shared caches.
2. Describe the core ideas and trade-offs of ZygOS, Tiresias, DRF, and FairRide.
3. Distinguish fairness goals in single-resource and multi-resource systems.
4. Use dominant share and hit-ratio formulations to reason about allocation quality.
5. Explain why strategy-proofness is difficult in cache sharing and how probabilistic blocking helps.
6. Compare these systems to classic FCFS/RR/SJF fairness and efficiency viewpoints.

## 1. Big Picture: Four Case Studies of Modern Scheduling

This lecture studies four representative systems/papers:

- **ZygOS**: low tail latency for microsecond-scale RPC services.
- **Tiresias**: GPU-cluster scheduling for distributed deep learning without complete job information.
- **DRF (Dominant Resource Fairness)**: fairness for multiple resource types.
- **FairRide**: fair and near-optimal cache sharing with strategic users.

The common theme is clear: scheduling policy must now balance **latency, throughput, fairness, uncertainty, and strategic behavior** at the same time.

## 2. ZygOS: Low Tail Latency in Datacenters

### 2.1 Problem Setting

Microsecond-scale services (KV stores, in-memory DBs) are highly sensitive to tail latency under fan-out/fan-in request patterns.

![ZygOS problem setting and tail-at-scale context](lec12_materials/zygos_tail_latency_problem.png)

:::remark Key Question: Why does tail behavior dominate user-visible performance?
**Question (original intent): In large fan-out RPC trees, why can a small tail probability still dominate end-to-end latency SLOs?**

Answer:
- A request often waits for multiple sub-requests.
- End-to-end latency is close to the slowest branch, not the average branch.
- So p99 behavior can become the practical bottleneck even when mean latency looks fine.
:::

### 2.2 Core Design Idea

ZygOS tries to combine two worlds:

- Dataplane benefits: reduced overhead, share-nothing fast path.
- Single-queue-like work conservation: avoid idle cores while others queue.

It introduces application-agnostic work stealing in the shuffle layer, and reduces head-of-line blocking with lightweight inter-processor notifications.

![ZygOS execution model and stealing flow](lec12_materials/zygos_execution_model_work_stealing.png)

### 2.3 Evaluation Signal

Experiments show better SLO-crossing throughput and stronger tail behavior than baselines in low service-time regimes.

![ZygOS Silo TPC-C result](lec12_materials/zygos_silo_tpcc_results.png)

Key numbers highlighted in lecture:

- Around **1.63x speedup over Linux** in the shown Silo workload setting.
- Strong reduction in high-percentile latency under comparable loads.

:::tip Key Question: Why does queueing-model mismatch matter at low service times?
**Question (original intent): Which systems actually converge to their theoretical queueing models when service times are very small?**

Answer:
- At very low service time, software overhead and scheduling overhead become dominant.
- If system design cannot keep overhead low, practical behavior diverges from ideal queueing predictions.
- ZygOS focuses on reducing this gap.
:::

## 3. Tiresias: Scheduling DL Jobs Without Full Knowledge

### 3.1 Two Practical Challenges

Tiresias starts from two real constraints in production GPU clusters:

1. Job completion time is unknown in advance.
2. Over-aggressive consolidation can fragment free GPUs and increase queueing delay.

It also observes temporal and spatial heterogeneity in DL jobs.

![Temporal and spatial variation in DL jobs](lec12_materials/tiresias_temporal_spatial_variation.png)

:::remark Key Question: What does "without complete knowledge" really mean?
**Question (original intent): If you do not know true job lengths, how can you still approximate short-job-first behavior?**

Answer:
- Use attained service (how much work has already run) as a robust proxy.
- Prefer younger/less-served jobs to reduce mean completion time.
- Accept that policy is approximate, then optimize for stability and practicality.
:::

### 3.2 2DAS Scheduler

Tiresias uses two-dimensional attained service:

$$
\text{Age}_{2D}(j) = g_j \cdot t_j
$$

where \(g_j\) is allocated GPU count and \(t_j\) is executed time.

This captures both:

- temporal progress (time),
- spatial footprint (GPU parallelism).

![2DAS definition and intuition](lec12_materials/tiresias_2das_definition.png)

### 3.3 Placement Strategy

Besides scheduling order, Tiresias uses model-profile-based placement:

- Some models are more sensitive to network contention and imbalance.
- Consolidation is decided using model characteristics, not only queue order.

### 3.4 Results

Lecture highlights:

- Significant average JCT improvements over YARN-CS in testbed.
- Strong gains over Gandiva in trace-driven simulation.

![Tiresias JCT improvement in testbed](lec12_materials/tiresias_jct_testbed.png)

:::warn Key Question: Why can "always consolidate" become harmful?
**Question (original intent): If consolidation helps training efficiency, why not always consolidate jobs?**

Answer:
- Consolidation can consume contiguous GPU blocks and leave fragmented residual resources.
- Fragmentation increases queueing delay for incoming jobs.
- So scheduler must jointly optimize training efficiency and queue dynamics.
:::

## 4. DRF: Fairness for Multiple Resource Types

### 4.1 Why Single-Resource Fairness Is Not Enough

Classic max-min intuition on one resource (e.g., CPU) does not directly solve multi-resource allocation.

In datacenters, jobs consume CPU, memory, disk, and I/O in different proportions.

### 4.2 DRF Definitions

Baseline fair-share concept:

$$
\text{Fair-share baseline} = \frac{1}{n}
$$

DRF key definition:

$$
\text{dominant share}_i = \max_k\left(\frac{a_{ik}}{R_k}\right)
$$

where \(a_{ik}\) is user \(i\)'s allocation of resource \(k\), and \(R_k\) is cluster total of resource \(k\).

DRF then applies max-min fairness on dominant shares.

![Dominant resource and dominant share example](lec12_materials/drf_dominant_share_example.png)

From the example in lecture:

$$
\frac{1}{4} > \frac{2}{10} = \frac{1}{5}
$$

So memory is dominant for that user in the shown allocation.

### 4.3 Policy Comparison Perspective

DRF is compared with alternatives (Asset fairness, CEEI, etc.) via properties such as:

- share guarantee,
- strategy-proofness,
- Pareto efficiency,
- monotonicity-related criteria.

![Policy property matrix including DRF](lec12_materials/drf_policy_properties.png)

:::remark Key Question: Why did DRF become the practical default?
**Question (original intent): What makes DRF especially attractive for cluster schedulers?**

Answer:
- It preserves strong fairness semantics under heterogeneous demands.
- It keeps a clear operational interpretation (dominant shares).
- It provides a better fairness-efficiency-strategy balance than many simple baselines.
:::

## 5. FairRide: Near-Optimal Fair Cache Sharing

### 5.1 Model and Utility

FairRide studies shared cache allocation with strategic users.

The lecture's simplified model:

- Equal-sized files.
- User \(i\) accesses file \(j\) at rate \(r_{ij}\).
- Policy decides cache fraction \(p_j\) for each file.

User utility is hit ratio:

$$
HR_i = \frac{\text{total hits}_i}{\text{total accesses}_i}
= \frac{\sum_j p_j r_{ij}}{\sum_j r_{ij}}
$$

![FairRide simple model and hit-ratio formulation](lec12_materials/fairride_cache_model_and_hit_ratio.png)

### 5.2 Fundamental Tension

The lecture emphasizes three goals:

1. Isolation guarantee (share guarantee),
2. Strategy-proofness,
3. Pareto efficiency.

And a core impossibility insight:

- No allocation policy can satisfy all three simultaneously in general.
- Best practical policies target two strongly and approximate the third.

### 5.3 FairRide Mechanism

FairRide starts from max-min style sharing but adds blocking for users who "do not pay" shared-file cost.

The blocking is probabilistic:

$$
p(n_j) = \frac{1}{n_j + 1}
$$

where \(n_j\) is the number of *other* users caching file \(j\).

Example values:

$$
p(1)=50\%, \quad p(4)=20\%
$$

![FairRide probabilistic blocking rule](lec12_materials/fairride_probabilistic_blocking.png)

:::error Key Question: Why is probabilistic blocking necessary?
**Question (original intent): If cheating is possible under pure max-min behavior, why does random blocking change incentives?**

Answer:
- Deterministic rules can be predictably exploited.
- Randomized blocking turns over-requesting into expected loss.
- Properly chosen probability discourages strategic inflation while retaining high efficiency.
:::

### 5.4 Final Trade-off Position

FairRide's final position in the property table:

- Keeps isolation guarantee,
- restores strategy-proofness,
- achieves near-optimal (not perfect) Pareto efficiency.

![FairRide final property summary](lec12_materials/fairride_final_properties.png)

## 6. Cross-Paper Synthesis

### 6.1 What Changes from Classic Scheduling

- FCFS/RR/SJF mainly focus on order and CPU-time progress.
- Modern systems add multi-dimensional resources, uncertainty, and user strategy.
- "Who runs next" is now only part of the design; placement, pricing-like logic, and anti-gaming mechanisms matter too.

### 6.2 Unifying Lens

You can compare all four papers by four questions:

1. What is optimized (tail, JCT, fairness, cache utility)?
2. What uncertainty exists (service time, job length, user behavior)?
3. What is the fairness unit (queue time, dominant share, hit ratio)?
4. What mechanism enforces policy (stealing, 2D age, dominant-share equalization, probabilistic blocking)?

## 7. Exam Review

### 7.1 Must-Know Definitions

- **Tail latency SLO**: service objective on high-percentile latency, not mean latency.
- **2D attained service (2DAS)**: executed GPU-time product used as scheduling age in Tiresias.
- **Dominant resource**: resource type where a user's allocation fraction is maximal.
- **Dominant share fairness (DRF)**: max-min fairness applied to dominant shares.
- **Strategy-proofness**: users cannot improve utility by misreporting or gaming demand.
- **Probabilistic blocking**: randomized access suppression to discourage strategic cheating.

### 7.2 High-Value Short-Answer Templates

1. **Why not use single-resource max-min in clusters?**  
   Because heterogeneous demands create cross-resource imbalance; fairness must be defined on dominant shares, not one fixed dimension.
2. **What is the core contribution of Tiresias?**  
   Joint temporal-spatial age scheduling plus model-aware placement under incomplete job information.
3. **How does FairRide differ from pure max-min cache allocation?**  
   It introduces probabilistic blocking to improve strategy-proofness while keeping near-optimal efficiency.

### 7.3 Common Pitfalls

- Treating average latency as sufficient in fan-out RPC services.
- Ignoring GPU placement fragmentation when optimizing only per-job speed.
- Thinking DRF means equal CPU shares; DRF equalizes dominant shares.
- Assuming deterministic fair allocation is automatically strategy-proof.

### 7.4 Self-Check

:::tip Self-check 1
Given two users with demands \(\langle 1\ \text{CPU}, 4\ \text{GB}\rangle\) and \(\langle 3\ \text{CPU}, 1\ \text{GB}\rangle\), explain why equal CPU percentage is not a complete fairness criterion.
:::

:::tip Self-check 2
For a DL cluster, describe one scenario where fewer job preemptions can increase average JCT, and explain the scheduling trade-off.
:::

:::tip Self-check 3
Using \(p(n_j)=1/(n_j+1)\), compute the blocking probability for \(n_j=2\) and \(n_j=5\), then explain why larger sharing groups imply less aggressive blocking.
:::

