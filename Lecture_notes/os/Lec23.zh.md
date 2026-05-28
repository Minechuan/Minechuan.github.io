# 第 23 讲：现代计算机系统中的存储与文件系统

## 学习目标

学完本讲后，你应该能够：

1. 解释去重如何提升存储效率，以及为什么元数据局部性设计是关键。
2. 描述 IOFlow 的控制面/数据面拆分与其端到端存储 SLA API。
3. 分析为什么存储限速应基于成本模型，而不是只看字节或 IOPS。
4. 解释 GFS 的设计假设、架构与写一致性流程。
5. 解释 EC-Cache 如何用纠删码同时改进负载均衡和尾延迟。
6. 解释 Chord 的一致性哈希、finger table 与 $O(\log N)$ 查询行为。
7. 对比四类系统的权衡，并提炼可复用设计原则。

## 1. 全局脉络

本讲由四个系统案例构成：

- 去重：面向容量与元数据效率。
- IOFlow：面向可编程存储 SLA 执行。
- GFS：面向大规模、追加主导型文件负载。
- EC-Cache + Chord：面向分布式缓存与查找扩展性。

主线可以概括为：

- 把控制逻辑与重数据搬运分离。
- 用匹配工作负载结构的抽象来简化系统问题。
- 把复杂决策放在拥有全局信息的位置。

## 2. 去重（Dedup）：不只是压缩

![dedup pipeline](lec23_materials/dedup_pipeline_fingerprint_index.png)

**关键定义：** **Deduplication 是跨文件/跨流的全局压缩：通过 fingerprint 识别并消除重复数据段。**

去重流水线：

1. 把备份数据切分为 segments。
2. 为每个 segment 计算 fingerprint。
3. 查询索引判断该数据是否已存在。
4. 仅写入唯一段，重复段仅保留元数据引用。

一个核心扩展性瓶颈是 fingerprint 索引规模：

$$
\left(\frac{80\,\mathrm{TB}}{8\,\mathrm{KB}}\right)\times 20\,\mathrm{B}=200\,\mathrm{GB}
$$

因此元数据设计是第一优先级，而不是附属问题。

### 2.1 面向局部性的元数据技术

![summary vector](lec23_materials/dedup_summary_vector_bloom_filter.png)

![lpc](lec23_materials/dedup_locality_preserved_caching.png)

课件中的高吞吐高压缩方案组合了：

- Summary Vector（类似 Bloom filter 的快速排除）。
- Stream-informed segment layout（把可能重复的数据段在磁盘上靠近放置）。
- Locality Preserved Caching（按重复局部性缓存元数据/容器）。

它们共同降低了随机元数据访问成本，保证去重吞吐可落地。

### 2.2 真实环境效果

![datacenter A compression](lec23_materials/dedup_real_world_compression_datacenter_a.png)

![datacenter B compression](lec23_materials/dedup_real_world_compression_datacenter_b.png)

真实部署的价值不仅是瞬时压缩比，更在于长期备份演化下的持续节省。

:::remark 关键问题：为什么去重必须同时做元数据工程？
**问题（原意复述）：去重都已经删了很多数据，为什么性能仍可能崩掉？**

解答：
- 因为每个 segment 都要经过元数据判定。
- 到大规模时，索引与缓存行为决定延迟和吞吐上限。
- 只有“消重 + 元数据局部性”联合设计，去重才能稳定受益。
:::

## 3. IOFlow：端到端存储 SLA 控制

![ioflow architecture](lec23_materials/ioflow_architecture_control_data_plane.png)

IOFlow 针对企业虚拟化存储中的实际缺口：

- 应用需要细粒度 SLA，
- 但系统缺少统一可编排的存储控制面去端到端执行。

**关键定义（沿用课件）：** **Storage flow refers to all IO requests to which an SLA applies.**

### 3.1 数据面可编程能力与 API

![ioflow api](lec23_materials/ioflow_api_queue_programming.png)

IOFlow API 暴露了队列级控制：

- 分类（`IO Header -> Queue`），
- 调度（`token rate`、`priority`、`queue size`），
- 路由（`Queue -> Next hop`）。

由于存储栈缺乏统一 IO 头，flow 名称通过控制器解析。

![flow name resolution](lec23_materials/ioflow_flow_name_resolution.png)

### 3.2 为什么限速必须基于成本模型

![cost-based rate limiting](lec23_materials/ioflow_cost_based_rate_limiting.png)

仅按字节或仅按 IOPS 都无法覆盖混合读写、请求大小差异和设备异构。

因此 IOFlow 采用经验成本模型并绑定到队列：

$$
\mathrm{ConfigureTokenBucket}[\mathrm{Queue}\rightarrow\mathrm{cost\ model}]
$$

### 3.3 基于控制器的 max-min 公平与执行位置选择

![controller max-min](lec23_materials/ioflow_controller_based_max_min_sharing.png)

![enforcement placement](lec23_materials/ioflow_controller_enforcement_placement.png)

控制器负责：

- 估计每个 VM 的需求，
- 在租户内/租户间做集中式 max-min，
- 下发每 VM token 速率，
- 选择最优执行位置以降低排队与开销。

这与 SDN 中“集中控制简化策略复杂度”的思想一致。

### 3.4 评测结论

![bandwidth sla setup](lec23_materials/ioflow_bandwidth_sla_setup.png)

![bandwidth sla results](lec23_materials/ioflow_bandwidth_sla_results.png)

![data plane overhead](lec23_materials/ioflow_data_plane_overhead_40gbps_rdma.png)

![control plane overhead](lec23_materials/ioflow_control_plane_overhead.png)

![ioflow summary](lec23_materials/ioflow_summary_of_contributions.png)

结果显示：

- 多租户 SLA 能被稳定执行且保持 work-conserving，
- 在 40Gbps RDMA 下数据面开销可接受，
- 控制面网络/CPU 开销低（控制器 CPU 占用很小）。

:::tip 关键问题：为什么集中控制在存储 QoS 里常常更有优势？
**问题（原意复述）：分布式控制不是天然更可扩展吗？**

解答：
- 分布式方案必须同时解决局部拥塞信号与全局协调。
- 集中控制有全局视图，可直接优化 SLA 目标。
- 只要控制开销够低，集中策略通常更简单且更可预测。
:::

## 4. GFS：工作负载对齐的文件系统设计

![why gfs](lec23_materials/gfs_why_build_gfs_workload_assumptions.png)

GFS 明确针对一类负载：

- 节点故障频繁，
- 文件超大（multi-GB），
- 写入以 append 为主，
- 更看重持续带宽而非单次低延迟。

### 4.1 接口与架构取舍

![gfs architecture decoupling](lec23_materials/gfs_architecture_data_control_decoupling.png)

**关键定义（沿用课件）：** **Very important: data flow is decoupled from control flow.**

- master 负责 metadata 操作，
- 客户端与 chunkserver 直接进行数据读写。

这样可以让 master 不在数据热路径上，避免中心吞吐瓶颈。

### 4.2 Master、操作日志与可靠性模型

![master responsibilities](lec23_materials/gfs_master_node_responsibilities.png)

![operation log](lec23_materials/gfs_operation_log_recovery.png)

master 负责命名空间、文件到 chunk 的映射、lease 管理和后台平衡。

**关键定义：** **Operation log 是 metadata 的唯一持久记录，也是并发 metadata 操作的序列化时间线。**

### 4.3 Chunk、复制与基于 lease 的写序列化

![chunks and chunkservers](lec23_materials/gfs_chunks_and_chunkservers.png)

![chunk size](lec23_materials/gfs_chunk_size_tradeoffs.png)

![lease primary secondary](lec23_materials/gfs_chunk_lease_primary_secondary.png)

关键设计点：

- 固定大小 chunk（GFS 典型为 64MB），每个 chunk 有不可变 64-bit handle，
- 默认三副本，
- 每 chunk 元数据紧凑到可由 master 常驻内存管理，
- 通过 lease 选出 primary，统一写顺序，secondaries 按序执行。

### 4.4 写入流程与故障处理

![gfs write pipeline](lec23_materials/gfs_write_pipeline_and_failures.png)

写路径核心：

1. 客户端向 master 获取 primary + secondaries。
2. 客户端把数据流水推送到各副本。
3. primary 决定序列化顺序。
4. secondaries 按该顺序应用并回 ACK。
5. primary 向客户端返回成功/失败。

部分失败时，客户端重试写阶段。

:::warn 关键问题：为什么 GFS 坚持“控制和数据分离”？
**问题（原意复述）：master 既然知道全局信息，为什么不顺便转发数据？**

解答：
- 因为那会把 master 变成数据吞吐瓶颈。
- 控制集中 + 数据旁路能同时保留全局决策和高带宽。
- 这个模式后来在大量分布式存储系统中反复出现。
:::

## 5. EC-Cache：把纠删码用于缓存，而不只是归档

### 5.1 编码模型

![erasure primer](lec23_materials/ec_cache_erasure_coding_primer.png)

**关键定义：** **输入 $k$ 个数据单元，生成 $r$ 个校验单元；$(k+r)$ 中任意 $k$ 个可解码原数据。**

### 5.2 EC-Cache 的写路径与读路径

![ec write path](lec23_materials/ec_cache_write_path.png)

![ec read path](lec23_materials/ec_cache_read_path_with_additional_reads.png)

写：

- 对象切分，
- 编码生成校验，
- 将 $(k+r)$ 单元均匀分布到不同服务器。

读：

- 读取 $(k+\Delta)$ 个单元，
- 使用最先返回的 $k$ 个，
- 解码并合并。

$$
\text{Additional reads: read }(k+\Delta)\text{ units and use the first }k\text{ arrivals}
$$

### 5.3 为什么 additional reads 能改善尾延迟

![tail latency and any-k](lec23_materials/ec_cache_tail_latency_and_any_k_property.png)

当 $\Delta=0$ 时，straggler 会显著拖慢尾部。

当 $\Delta$ 取小值（课件示例常用 $\Delta=1$）时，“先到先用”的 any-$k$ 机制可明显压低尾延迟。

### 5.4 评测指标与结果

![load imbalance metric](lec23_materials/ec_cache_load_imbalance_metric.png)

负载不均衡指标：

$$
\lambda=\frac{L_{\max}-L_{\mathrm{avg}}}{L_{\mathrm{avg}}}\times 100
$$

![read latency improvement](lec23_materials/ec_cache_read_latency_improvement.png)

![delta role](lec23_materials/ec_cache_role_of_additional_reads_delta.png)

![ec summary](lec23_materials/ec_cache_summary.png)

在偏斜流量下，实验给出了显著的负载均衡和延迟改善。

:::remark 关键问题：为什么纠删码在缓存里也能提升性能？
**问题（原意复述）：纠删码不是主要用来做容错和省空间吗？**

解答：
- 纠删码同时带来“放置自由度”和“读取选择自由度”。
- any-$k$ 解码让系统可以“竞速选择最快返回”。
- 这正是把编码能力转化为负载均衡与尾延迟优化能力的关键。
:::

## 6. Chord：可扩展的分布式查找

### 6.1 动机与基线对比

![centralized](lec23_materials/chord_centralized_solution_limits.png)

![naive flooding](lec23_materials/chord_naive_distributed_flooding.png)

两类基线：

- 集中式索引：查询简单，但中心状态大且单点故障。
- Flooding：去中心化，但最坏消息量爆炸。

$$
\text{Flooding lookup cost}=O(N),\quad \text{Centralized index state}=O(M)
$$

### 6.2 Chord 性质与标识空间

![chord properties](lec23_materials/chord_properties_scalability.png)

![chord ids](lec23_materials/chord_identifier_space_sha1.png)

**关键定义（沿用课件）：**

- **m bit identifier space for both keys and nodes.**
- **Key identifier = SHA-1(key).**
- **Node identifier = SHA-1(IP address).**
- **A key is stored at its successor: node with next higher ID.**

![consistent hashing](lec23_materials/chord_consistent_hashing_successor_mapping.png)

### 6.3 Finger table 与查询复杂度

![finger table](lec23_materials/chord_finger_table_definition.png)

每个节点维护指数间隔的路由条目（finger table），把查询跳数压到对数级。

![lookup faster](lec23_materials/chord_lookup_ologn_hops.png)

$$
\text{Chord lookup cost}=O(\log N),\quad \text{Chord per-node state}=O(\log N)
$$

### 6.4 节点加入与动态维护

![joining three steps](lec23_materials/chord_joining_three_step_and_lazy_update.png)

![join key transfer](lec23_materials/chord_join_step3_key_transfer.png)

加入流程：

1. 初始化新节点 finger table。
2. 更新其他节点 finger 条目。
3. 转移新节点应负责的 key 区间。

懒更新版本会先做少量必要更新，再周期修复。

### 6.5 实证验证

![lookup cost evaluation](lec23_materials/chord_lookup_cost_evaluation.png)

![chord summary](lec23_materials/chord_summary_and_impact.png)

评测结果与理论一致：消息复杂度近似对数增长，且扩展性稳定。

:::error 关键问题：为什么 Chord 不直接让每个节点保存全局路由？
**问题（原意复述）：如果全局信息能做到更快查询，为什么不用？**

解答：
- 全局状态在大规模和高 churn 下成本过高且脆弱。
- Chord 选择紧凑状态 + 对数跳数的平衡点。
- 这使其在动态成员变化下更实用。
:::

## 7. 跨论文综合

从 Dedup、IOFlow、GFS、EC-Cache、Chord 可以抽象出一组共性：

1. 让重数据流量绕开中心控制路径。
2. 用紧凑元数据/路由结构，并利用局部性或对数复杂度约束。
3. 让系统不变量对齐主导工作负载（追加写、热点偏斜、混合 IO 成本）。
4. 把分布式难题收敛为可执行抽象（lease、flow、successor、any-$k$）。

## 8. Exam Review

### 8.1 必背定义

- **Deduplication**：通过 fingerprint 在全局范围消除重复数据段。
- **Storage flow (IOFlow)**：受同一 SLA 约束的一组 IO 请求。
- **Control/data decoupling (GFS)**：metadata 经 master，数据直达 chunkserver。
- **Any-$k$ decoding (EC-Cache)**：$(k+r)$ 中任意 $k$ 个单元可恢复原对象。
- **Chord successor rule**：key 映射到顺时针方向第一个 ID 不小于它的节点。

### 8.2 必会机制复述

1. Dedup 流水线，以及为何元数据局部性决定成败。
2. IOFlow 队列控制与基于成本模型的 token 分配。
3. GFS 基于 lease 的写序列化与部分失败重试路径。
4. EC-Cache 的 $(k+\Delta)$ 读取与 first-$k$ 完成策略。
5. Chord 的 finger table 查询与 join 维护流程。

### 8.3 简答题模板

1. 为什么存储限速不能只按字节做？
- 因为设备类型、读写比例、请求大小差异使“字节数”不能代表真实服务成本。

2. 为什么 GFS 单 master 仍能扩展？
- 因为控制集中但数据路径绕过 master。

3. 为什么 EC-Cache 能改善尾延迟？
- 因为 additional reads + any-$k$ 解码降低了对慢节点的敏感度。

4. 为什么 Chord 采用 $O(\log N)$ 路由？
- 它在查询效率与节点状态开销之间取得了可扩展平衡。

### 8.4 常见误区

- 把 dedup 当成“纯压缩问题”，忽略元数据瓶颈。
- 在未评估控制开销和数据旁路前，先入为主地否定集中控制。
- 只把纠删码当作存储效率工具，忽略其性能调度价值。
- 误以为去中心查找只能在 flooding 与全局路由之间二选一。

### 8.5 自检清单

- 你能推导 dedup 索引规模并解释它如何影响架构吗？
- 你能不看图复述 IOFlow 控制器的四项决策吗？
- 你能逐步解释 GFS 写顺序与失败返回路径吗？
- 你能说明 EC-Cache 中 $\Delta>0$ 何时收益最大吗？
- 你能从 finger table 结构解释 Chord 的复杂度界吗？
