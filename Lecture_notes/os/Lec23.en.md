# Lecture 23: Storage and File Systems in Modern Computer Systems

## Learning Objectives

After this lecture, you should be able to:

1. Explain how deduplication improves storage efficiency and why locality-aware metadata design matters.
2. Describe IOFlow's control-plane/data-plane split and its API for end-to-end storage SLAs.
3. Analyze why storage rate limiting should be cost-based instead of bytes-only or IOPS-only.
4. Explain GFS design assumptions, architecture, and write consistency workflow.
5. Explain how EC-Cache uses erasure coding for load balancing and tail-latency reduction.
6. Explain Chord's consistent hashing, finger tables, and $O(\log N)$ lookup behavior.
7. Compare trade-offs across all four systems and identify reusable design principles.

## 1. Big Picture and Throughline

This lecture is organized as four system case studies:

- Deduplication for capacity and metadata efficiency.
- IOFlow for programmable storage-SLA enforcement.
- GFS for large-scale append-heavy file workloads.
- EC-Cache + Chord for distributed caching and lookup scalability.

The unifying theme is simple:

- Separate control logic from heavy data movement.
- Choose abstractions that match real workload structure.
- Push complexity to where global information is available.

## 2. Deduplication: More Than Compression

![dedup pipeline](lec23_materials/dedup_pipeline_fingerprint_index.png)

**Key definition:** **Deduplication is global compression across files/streams by removing redundant segments using fingerprints.**

Dedup pipeline:

1. Split backup data into segments.
2. Compute fingerprint for each segment.
3. Query index to decide whether data is already stored.
4. Store only unique segments, keep metadata references for duplicates.

A core scaling concern is fingerprint index size:

$$
\left(\frac{80\,\mathrm{TB}}{8\,\mathrm{KB}}\right)\times 20\,\mathrm{B}=200\,\mathrm{GB}
$$

So metadata design is first-order, not secondary.

### 2.1 Locality-aware metadata techniques

![summary vector](lec23_materials/dedup_summary_vector_bloom_filter.png)

![lpc](lec23_materials/dedup_locality_preserved_caching.png)

The paper's high-speed/high-compression strategy combines:

- Summary Vector (Bloom-filter style pruning before full index lookup).
- Stream-informed segment layout (store likely-related duplicates close on disk).
- Locality Preserved Caching (cache metadata/containers with duplicate locality).

These reduce random metadata I/O and keep dedup throughput practical.

### 2.2 Real-world effect

![datacenter A compression](lec23_materials/dedup_real_world_compression_datacenter_a.png)

![datacenter B compression](lec23_materials/dedup_real_world_compression_datacenter_b.png)

The deployment takeaway is not just ratio gain, but sustained savings over time under real backup churn.

:::remark Key Question: Why does dedup need metadata engineering as much as data elimination?
**Question (original intent): If dedup removes lots of data, why can performance still collapse?**

Answer:
- Because every segment decision depends on metadata lookup.
- At large scale, index and cache behavior dominate latency and throughput.
- Dedup wins only when redundancy elimination and metadata locality are co-designed.
:::

## 3. IOFlow: End-to-End Storage SLA Control

![ioflow architecture](lec23_materials/ioflow_architecture_control_data_plane.png)

IOFlow addresses a practical gap in enterprise virtualized storage:

- rich app-level SLA needs,
- but no unified storage control plane to enforce them end to end.

**Key definition (slide wording):** **Storage flow refers to all IO requests to which an SLA applies.**

### 3.1 Data-plane programmability and API

![ioflow api](lec23_materials/ioflow_api_queue_programming.png)

IOFlow API exposes queue-level controls:

- classification (`IO Header -> Queue`),
- scheduling (`token rate`, `priority`, `queue size`),
- routing (`Queue -> Next hop`).

Flow naming is resolved through a controller because storage stacks lack one common universal IO header.

![flow name resolution](lec23_materials/ioflow_flow_name_resolution.png)

### 3.2 Why rate limiting must be cost-based

![cost-based rate limiting](lec23_materials/ioflow_cost_based_rate_limiting.png)

Bytes-only and IOPS-only limiting both fail under mixed read/write sizes and device heterogeneity.

IOFlow therefore uses empirical cost models and binds them to queues:

$$
\mathrm{ConfigureTokenBucket}[\mathrm{Queue}\rightarrow\mathrm{cost\ model}]
$$

### 3.3 Controller-based max-min fairness and enforcement placement

![controller max-min](lec23_materials/ioflow_controller_based_max_min_sharing.png)

![enforcement placement](lec23_materials/ioflow_controller_enforcement_placement.png)

The controller:

- infers per-VM demand,
- runs centralized max-min within/across tenants,
- sets per-VM token rates,
- chooses where to enforce to reduce queueing and overhead.

This is analogous to SDN's centralized-control simplification.

### 3.4 Evaluation highlights

![bandwidth sla setup](lec23_materials/ioflow_bandwidth_sla_setup.png)

![bandwidth sla results](lec23_materials/ioflow_bandwidth_sla_results.png)

![data plane overhead](lec23_materials/ioflow_data_plane_overhead_40gbps_rdma.png)

![control plane overhead](lec23_materials/ioflow_control_plane_overhead.png)

![ioflow summary](lec23_materials/ioflow_summary_of_contributions.png)

Results show:

- tenant SLAs are enforced with work conservation,
- data-plane overhead remains reasonable at 40Gbps RDMA,
- control-plane overhead is low (controller CPU overhead is very small).

:::tip Key Question: Why does a centralized controller help in storage QoS?
**Question (original intent): Isn't distributed control more scalable by default?**

Answer:
- Distributed control must solve local congestion signals and global coordination simultaneously.
- Centralized control can directly optimize SLA objectives with global view.
- If control overhead stays low, centralized policy gives simpler and more predictable enforcement.
:::

## 4. GFS: Workload-Aligned File-System Design

![why gfs](lec23_materials/gfs_why_build_gfs_workload_assumptions.png)

GFS is built for a specific workload profile:

- frequent node failures,
- huge multi-GB files,
- append-dominated writes,
- high sustained bandwidth prioritized over low single-op latency.

### 4.1 Interface and architecture choices

![gfs architecture decoupling](lec23_materials/gfs_architecture_data_control_decoupling.png)

**Key definition (slide wording):** **Very important: data flow is decoupled from control flow.**

- Master handles metadata operations.
- Clients read/write data directly with chunkservers.

This keeps master out of the data path and avoids a central throughput bottleneck.

### 4.2 Master, log, and reliability model

![master responsibilities](lec23_materials/gfs_master_node_responsibilities.png)

![operation log](lec23_materials/gfs_operation_log_recovery.png)

Master responsibilities include namespace, file-to-chunk mapping, lease management, and background balancing.

**Key definition:** **Operation log is the only persistent record of metadata and the serialization timeline for concurrent metadata operations.**

### 4.3 Chunks, replication, and lease-based write ordering

![chunks and chunkservers](lec23_materials/gfs_chunks_and_chunkservers.png)

![chunk size](lec23_materials/gfs_chunk_size_tradeoffs.png)

![lease primary secondary](lec23_materials/gfs_chunk_lease_primary_secondary.png)

Design points:

- fixed-size chunks (64MB in GFS), each with immutable 64-bit chunk handle,
- default 3-way replication,
- per-chunk metadata kept compact enough for in-memory master state,
- primary/secondary via lease to serialize modifications.

### 4.4 Write pipeline and failure handling

![gfs write pipeline](lec23_materials/gfs_write_pipeline_and_failures.png)

Write path essence:

1. Client asks master for primary + secondaries.
2. Client pipelines data to replicas.
3. Primary chooses serialization order.
4. Secondaries apply in that order and ack primary.
5. Primary replies success/error to client.

On partial failure, client retries the write phase.

:::warn Key Question: Why does GFS insist on separating metadata control from data transfer?
**Question (original intent): If master knows everything, why not route data through master too?**

Answer:
- It would make master the throughput bottleneck.
- Data-path bypass keeps scalability high while preserving global metadata control.
- This pattern appears again in many later distributed storage systems.
:::

## 5. EC-Cache: Erasure Coding for Caching, Not Just Archival

### 5.1 Core coding model

![erasure primer](lec23_materials/ec_cache_erasure_coding_primer.png)

**Key definition:** **Take $k$ data units, generate $r$ parity units; any $k$ out of $(k+r)$ are sufficient for decode.**

### 5.2 Write/read paths in EC-Cache

![ec write path](lec23_materials/ec_cache_write_path.png)

![ec read path](lec23_materials/ec_cache_read_path_with_additional_reads.png)

Write:

- split object,
- encode parity,
- place $(k+r)$ units across distinct servers uniformly.

Read:

- fetch $(k+\Delta)$ units,
- use first $k$ arrivals,
- decode and combine.

$$
\text{Additional reads: read }(k+\Delta)\text{ units and use the first }k\text{ arrivals}
$$

### 5.3 Why additional reads improve tail

![tail latency and any-k](lec23_materials/ec_cache_tail_latency_and_any_k_property.png)

Without additional reads ($\Delta=0$), straggler effect hurts tail latency.

With modest $\Delta$ (often $\Delta=1$ in the lecture examples), the "first $k$ arrivals" effect cuts tail significantly.

### 5.4 Evaluation metrics and results

![load imbalance metric](lec23_materials/ec_cache_load_imbalance_metric.png)

Load imbalance metric:

$$
\lambda=\frac{L_{\max}-L_{\mathrm{avg}}}{L_{\mathrm{avg}}}\times 100
$$

![read latency improvement](lec23_materials/ec_cache_read_latency_improvement.png)

![delta role](lec23_materials/ec_cache_role_of_additional_reads_delta.png)

![ec summary](lec23_materials/ec_cache_summary.png)

Reported outcomes include large improvements in balance and latency under skew.

:::remark Key Question: Why can coding help both balance and latency in a cache?
**Question (original intent): Isn't erasure coding mainly for fault tolerance and space saving?**

Answer:
- Coding also introduces placement and read-choice flexibility.
- Any-$k$ decoding enables "race the fastest" reads.
- That flexibility is what turns coding into a load-balancing and tail-latency tool.
:::

## 6. Chord: Scalable Decentralized Lookup

### 6.1 Motivation and baseline comparisons

![centralized](lec23_materials/chord_centralized_solution_limits.png)

![naive flooding](lec23_materials/chord_naive_distributed_flooding.png)

Baselines:

- centralized index: simple lookup but single-point failure and large central state,
- flooding: decentralized but worst-case message explosion.

$$
\text{Flooding lookup cost}=O(N),\quad \text{Centralized index state}=O(M)
$$

### 6.2 Chord properties and identifier space

![chord properties](lec23_materials/chord_properties_scalability.png)

![chord ids](lec23_materials/chord_identifier_space_sha1.png)

**Key definitions (slide wording):**

- **m bit identifier space for both keys and nodes.**
- **Key identifier = SHA-1(key).**
- **Node identifier = SHA-1(IP address).**
- **A key is stored at its successor: node with next higher ID.**

![consistent hashing](lec23_materials/chord_consistent_hashing_successor_mapping.png)

### 6.3 Finger tables and lookup complexity

![finger table](lec23_materials/chord_finger_table_definition.png)

Each node keeps exponentially spaced routing entries (finger table), enabling logarithmic routing hops.

![lookup faster](lec23_materials/chord_lookup_ologn_hops.png)

$$
\text{Chord lookup cost}=O(\log N),\quad \text{Chord per-node state}=O(\log N)
$$

### 6.4 Joining and dynamic maintenance

![joining three steps](lec23_materials/chord_joining_three_step_and_lazy_update.png)

![join key transfer](lec23_materials/chord_join_step3_key_transfer.png)

Joining workflow:

1. Initialize new node's finger table.
2. Update existing nodes' finger entries.
3. Transfer the key interval now owned by the new node.

A lazy variant updates fewer entries immediately and repairs gradually.

### 6.5 Empirical confirmation

![lookup cost evaluation](lec23_materials/chord_lookup_cost_evaluation.png)

![chord summary](lec23_materials/chord_summary_and_impact.png)

Evaluation confirms near-logarithmic message growth and robust scaling behavior.

:::error Key Question: What is the core Chord trade-off versus full global knowledge routing?
**Question (original intent): Why not let every node know every other node for $O(1)$ lookup?**

Answer:
- Full global routing state is too expensive and brittle at scale.
- Chord chooses compact per-node state and accepts logarithmic hops.
- This gives practical scalability under membership churn.
:::

## 7. Cross-Paper Synthesis

Across Dedup, IOFlow, GFS, EC-Cache, and Chord, one recurring pattern is:

1. Keep heavy data traffic off the central control path.
2. Use compact metadata/routing structures with strong locality or logarithmic bounds.
3. Match system invariants to dominant workload patterns (append-heavy, skewed popularity, mixed IO cost).
4. Convert hard distributed decisions into manageable abstractions (leases, flows, successor mapping, any-$k$ reads).

## 8. Exam Review

### 8.1 Must-Know Definitions

- **Deduplication**: eliminate duplicate segments globally via fingerprinting.
- **Storage flow (IOFlow)**: all IO requests to which an SLA applies.
- **Control/data decoupling (GFS)**: metadata via master, data directly via chunkservers.
- **Any-$k$ decoding (EC-Cache)**: any $k$ of $(k+r)$ units can reconstruct original data.
- **Chord successor rule**: key goes to first node clockwise with ID >= key ID.

### 8.2 Mechanisms You Should Be Able to Reproduce

1. Dedup pipeline and why metadata locality matters.
2. IOFlow queue controls + cost-based token assignment.
3. GFS lease-based write ordering and retry-on-partial-failure behavior.
4. EC-Cache read with $(k+\Delta)$ and first-$k$ completion.
5. Chord lookup with finger tables and join maintenance steps.

### 8.3 Short-Answer Templates

1. Why not rate-limit storage by bytes only?
- Because device/read-write/request-size heterogeneity makes bytes a poor proxy for true service cost.

2. Why can a single GFS master still scale?
- Because control is centralized but data path bypasses master.

3. Why does EC-Cache improve tail latency?
- Because additional reads + any-$k$ decoding reduce straggler sensitivity.

4. Why does Chord use $O(\log N)$ routing?
- It balances lookup efficiency with compact per-node state under dynamic membership.

### 8.4 Common Pitfalls

- Treating dedup as "just compression" and ignoring metadata bottlenecks.
- Assuming centralized control is always bad without checking control overhead and data-path bypass.
- Confusing erasure coding only with storage efficiency, missing its latency/balance benefits.
- Assuming decentralized lookup must choose between flooding and full global state.

### 8.5 Self-Check Checklist

- Can you derive the dedup index-size estimate and explain why it changes design choices?
- Can you explain IOFlow's controller decisions (rate, placement, fairness) without diagrams?
- Can you trace GFS write ordering and failure return paths step by step?
- Can you explain when $\Delta>0$ in EC-Cache helps or hurts?
- Can you justify Chord's $O(\log N)$ lookup and state bounds from finger-table structure?
