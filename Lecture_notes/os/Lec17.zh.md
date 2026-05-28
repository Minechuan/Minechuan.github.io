# 第 17 讲：内存 5——现代计算机系统中的内存管理

## 学习目标

学完本讲后，你应该能够：

1. 解释现代系统如何通过内存抽象连接硬件趋势与应用需求。
2. 用统一分析视角比较 FaRM、vLLM、Infiniswap、AIFM、PipeSwitch、TGS。
3. 从每个系统中提炼“核心机制 - 瓶颈问题”的对应关系。
4. 分析分布式和 GPU 内存管理里透明性、隔离性、利用率、可编程性的权衡。

## 1. 全景图：同一主线下的多种内存前沿方案

这是一讲综合回顾内容。重点不是一个单独算法，而是一个统一问题：

**如何把内存做成可扩展、可高性能复用的抽象能力（跨机器、跨加速器）？**

本讲系统可分为四条路线：

- 快速网络上的内存抽象：FaRM、vLLM。
- 远端内存分页/解耦：Infiniswap、AIFM。
- GPU 与主机内存间的交换与共享：PipeSwitch、TGS。

:::remark 关键问题：为什么这些论文要放在一起看？
**问题（原意复述）：看起来场景不同，它们的共同主线是什么？**

解答：
- 都从一个明确性能瓶颈出发，重构内存管理。
- 都在调整抽象边界（应用、运行时、OS、硬件）来回收效率。
- 共同说明：现代内存管理越来越依赖跨层协同和负载感知。
:::

## 2. FaRM：基于 RDMA 的共享内存抽象与事务执行

![FaRM RDMA 数据路径](lec17_materials/farm_rdma_data_path.png)

FaRM 的出发点是硬件现实：单机 DRAM 越来越大，数据中心 RDMA 网络足够快，远端内存访问可以支撑低延迟服务。

![现代集群编程问题](lec17_materials/farm_programming_modern_cluster_question.png)

关键设计是跨机器的**共享地址空间抽象**，让分布式在内存数据编程更接近“本地内存思维”。

![FaRM 共享地址空间](lec17_materials/farm_shared_address_space_layout.png)

为了可用性，FaRM 将该抽象与**事务机制**组合。

![FaRM 事务流水线](lec17_materials/farm_transaction_pipeline.png)

事务路径采用 lock/validate/update 流程，并使用 one-sided RDMA 降低数据路径软件开销。

![FaRM TAO 案例](lec17_materials/farm_tao_case_study.png)

总结：

- FaRM 不只是“远程访问更快”。
- 核心价值是 **共享内存抽象 + 事务语义** 的可落地结合。

## 3. vLLM：用 PagedAttention 管理 LLM 的 KV Cache

LLM serving 的瓶颈通常先是内存与缓存管理，而不是纯算力。

![自回归推理流程](lec17_materials/vllm_autoregressive_inference_process.png)

批处理会提高吞吐，但大量请求动态增长/收缩会让 KV cache 压力迅速上升。

![批处理与 KV 压力](lec17_materials/vllm_batching_requests_and_kv_pressure.png)
![KV Cache 基础概念](lec17_materials/vllm_kv_cache_basics.png)

旧方案常按请求预留连续区域，导致内部和外部碎片并存。

![旧 KV 管理与碎片](lec17_materials/vllm_previous_kv_cache_management_fragmentation.png)

vLLM 提出 **PagedAttention**：把分页/虚拟化思想下沉到应用层 KV cache。

![PagedAttention 总览](lec17_materials/vllm_pagedattention_overview.png)
![虚拟化 KV Block](lec17_materials/vllm_virtualized_kv_blocks.png)

直接收益：

- 显著减少内存浪费。
- 序列长度可弹性增长。
- 更容易实现前缀/分支共享。

![内存效率与碎片](lec17_materials/vllm_memory_efficiency_internal_fragmentation.png)

讲义中的共享收益公式：

$$
\text{MemorySaving\%} = \frac{\#\text{blocks saved by sharing}}{\#\text{total blocks without sharing}} \times 100\%
$$

![共享带来的内存节省](lec17_materials/vllm_memory_saving_via_sharing.png)

当 KV block 内存不足时，vLLM 讨论了 swapping 和 recomputation 两种恢复路径。

![抢占与恢复方案](lec17_materials/vllm_preemption_and_recovery_options.png)

评估中，greedy 与 beam-search 解码都体现了明显吞吐优势。

![Greedy 吞吐结果](lec17_materials/vllm_throughput_greedy_decoding.png)
![Beam Search 吞吐结果](lec17_materials/vllm_throughput_beam_search.png)

**关键定义：** **PagedAttention 是面向注意力 KV cache 的应用层分页/虚拟化机制。**

:::tip 关键问题：为什么 OS 分页思想能帮助 LLM serving？
**问题（原意复述）：KV cache 是应用内部结构，为什么要借用虚拟内存思想？**

解答：
- 本质问题仍是动态增长下的分配与碎片管理。
- 分页提供固定块和间接映射，解耦逻辑增长与物理连续。
- 这正是虚拟化提升利用率的典型场景。
:::

## 4. Infiniswap：可部署的远端分页与内存解耦

真实集群中常见“有的机器内存空闲、有的容器缺内存”的结构性浪费。

![内存利用不足](lec17_materials/infiniswap_memory_underutilization_google_trace.png)

Infiniswap 用 RDMA 把空闲远端内存当作分页空间。

![空闲内存解耦思路](lec17_materials/infiniswap_disaggregate_free_memory_idea.png)
![Infiniswap 系统总览](lec17_materials/infiniswap_system_overview.png)

它强调工程可部署目标：不改硬件、不改应用、可容错。

![目标与设计思路](lec17_materials/infiniswap_design_objectives_and_ideas.png)

两点关键机制：

- 用 **memory slab** 代替细粒度 page 作为管理单元。
- 用 **power of two choices** 做可扩展远端目标选择。

![memory slab 管理单元](lec17_materials/infiniswap_memory_slab_management_unit.png)
![power-of-two choices](lec17_materials/infiniswap_power_of_two_choices.png)

结果亮点：

![集群内存利用率结果](lec17_materials/infiniswap_cluster_memory_utilization_result.png)

- 报告中集群内存利用率从 **40.8% 提升到 60%（1.47x）**。

:::warn 关键问题：为什么不做中心化全局最优放置？
**问题（原意复述）：统一控制器不是更容易做出最优决策吗？**

解答：
- 中心化路径会成为扩展性与可用性瓶颈。
- Infiniswap 优先选择分布式、低开销启发式。
- 轻微局部次优通常值得换取系统稳健性和规模能力。
:::

## 5. AIFM：应用集成的远端内存系统

AIFM 指出：仅靠 OS 分页接入 far memory，性能损失仍然过大。

![内存弹性不足](lec17_materials/aifm_memory_inelasticity.png)
![现有方案性能浪费根因](lec17_materials/aifm_why_existing_systems_waste_performance.png)

讲义强调两类核心问题：

- **语义鸿沟（semantic gap）**：页粒度无法表达对象级语义与访问意图。
- **内核开销高**：page fault 与内核网络路径成本明显。

AIFM 把关键能力下沉到用户态协同：

![AIFM 设计总览](lec17_materials/aifm_design_overview.png)

- remoteable 数据结构库：显式暴露应用语义。
- 用户态 runtime：高效管理对象迁移。
- pauseless evacuator：降低回收扰动。
- remote agent：缓解网络带宽和本地内存带宽差距影响。

![pauseless evacuator](lec17_materials/aifm_pauseless_evacuator.png)

代码层面的核心思想是把原生结构替换为 remoteable 结构，同时保持可用的编程范式。

![改造前示例代码](lec17_materials/aifm_sample_code_before_remoteable_ds.png)
![改造后示例代码](lec17_materials/aifm_sample_code_with_remoteable_ds.png)

NYC Taxi 分析中的代表点：

![NYC Taxi 分析结果](lec17_materials/aifm_nyc_taxi_analysis.png)

- 本地内存占比 `x=3%` 时，归一化性能约 `y=0.77`。
- 本地内存占比 `x=23%` 时，归一化性能约 `y=0.95`。

**关键定义：** **AIFM 是“应用集成 + 用户态 runtime + 远端对象管理”的 far-memory 体系。**

## 6. PipeSwitch：面向 DL 任务的快速流水化上下文切换

GPU 集群经常把训练与推理静态分离，这会牺牲总体利用率。

![低利用率动机](lec17_materials/pipeswitch_low_gpu_utilization_motivation.png)

PipeSwitch 的切入点非常直接：DL 作业切换代价过高，无法细粒度共享。

![快速切换目标](lec17_materials/pipeswitch_goal_fast_context_switching.png)

系统架构包含 controller、active/standby workers、memory daemon。

![PipeSwitch 架构](lec17_materials/pipeswitch_architecture.png)

关键优化是 **模型传输与执行的流水并行**。

![传输-执行流水化](lec17_materials/pipeswitch_pipelined_transmission_execution.png)

并结合统一内存管理与 active-standby 切换，降低分配/初始化/清理开销。

![统一内存管理](lec17_materials/pipeswitch_unified_memory_management.png)
![active-standby 切换](lec17_materials/pipeswitch_active_standby_worker_switching.png)

结果信号：

![高利用率结果](lec17_materials/pipeswitch_high_utilization_result.png)

- 在评估调度周期中实现接近 100% 的 GPU 利用率。

:::remark 关键问题：为什么流水化是关键路径级改造？
**问题（原意复述）：单独优化每个步骤一点，为什么不够？**

解答：
- 顺序传输再执行会让 PCIe 与 GPU 在不同阶段轮流空闲。
- 流水化通过分层重叠传输和计算，直接缩短关键路径。
- 这改变的是整体时序结构，而不仅是常数项优化。
:::

## 7. TGS：容器云中的透明 GPU 共享

TGS 关注容器化 GPU 训练中的低利用率与隔离需求并存问题。

![生产环境低 GPU 利用率](lec17_materials/tgs_low_gpu_utilization_in_production.png)

它对比了两类基线：

- 应用层定制（如 AntMan）：效果可以，但透明性差。
- OS/硬件层（MPS/MIG）：更透明，但利用率和灵活性受限。

![TGS 与 AntMan/MPS/MIG 对比](lec17_materials/tgs_comparison_table_antman_mps_mig.png)

TGS 架构把“算力速率控制 + 统一内存控制”结合起来。

![TGS 架构](lec17_materials/tgs_architecture.png)

### 7.1 计算资源共享：自适应速率控制

![TGS 自适应速率控制](lec17_materials/tgs_adaptive_rate_control.png)

讲义关系式：

$$
\alpha_{out} = \alpha_{in}
$$

$$
\beta_{out} \le \beta_{in}
$$

含义：

- 保持生产作业吞吐需求（`\alpha`）不被破坏。
- 在剩余资源范围内调整机会作业发射速率（`\beta`）。

### 7.2 内存资源共享：透明统一内存

当 GPU 内存超售时，TGS 利用 CUDA unified memory 将机会作业页映射到主机内存，从而保护生产作业稳定性。

![TGS 统一内存机制](lec17_materials/tgs_transparent_unified_memory_mechanism.png)

### 7.3 评估结果

![TGS 混合作业流结果](lec17_materials/tgs_mixed_workload_jct_results.png)

在“50 个 production + 50 个 opportunistic”作业流中：

- opportunistic 作业相对 exclusive 基线，JCT 降低 **52%**。
- production 作业相对无控制 co-execution 基线，JCT 降低 **21%**。

![TGS 超售场景结果](lec17_materials/tgs_unified_memory_oversubscription_results.png)

在内存超售场景下，讲义总结相对 MPS 最高约 **15% 吞吐提升**。

![TGS 结论页](lec17_materials/tgs_conclusion_summary.png)

:::error 关键问题：TGS 的“透明”到底指什么？
**问题（原意复述）：透明是不是只等于“不改源码”？**

解答：
- 不改框架/源码是必要条件之一，但不是全部。
- 更完整的透明性是：开发者保持常规容器工作流，底层由系统自动执行共享、隔离与控制。
- TGS 的目标是在不把复杂控制逻辑暴露给应用方的前提下获得利用率收益。
:::

## 8. 跨论文统一视角：如何快速比较一套系统

建议用三步法：

- 先看瓶颈：网络时延、碎片、分页开销、上下文切换、隔离冲突分别属于哪类。
- 再看边界：智能放在应用、runtime、OS 还是硬件。
- 最后看成本：吞吐、时延、利用率之外，是否牺牲透明性、稳定性、维护成本。

六篇系统的共性模式：

1. 给开发者保留简洁可用的模型。
2. 在关键层引入间接映射/虚拟化。
3. 用运行时控制环（放置、分页、限速、流水调度）持续稳定性能。

## 9. Exam Review

### 9.1 必会定义

- **FaRM**：面向 RDMA 的分布式共享内存与事务平台。
- **PagedAttention**：基于固定 KV block 与块表映射的 KV cache 虚拟化机制。
- **Infiniswap**：在工程约束下可部署的 RDMA 远端分页与内存解耦系统。
- **AIFM**：应用集成 far-memory 方案（remoteable 数据结构 + 用户态 runtime）。
- **PipeSwitch**：通过流水化上下文切换实现 GPU 高效多路复用。
- **TGS**：通过速率控制与统一内存实现容器云透明 GPU 共享。

### 9.2 机制记忆清单

对每个系统至少说清：

- 起始瓶颈是什么。
- 引入了什么新抽象。
- 关键机制是什么（事务路径、块表、slab、用户态对象运行时、流水并行、限速控制）。
- 核心收益相对哪个基线，改善了什么指标。

### 9.3 简答模板

- “为什么这样设计”：机制必须直接对准瓶颈。
- “为什么不是基线 X”：指出基线损失点（碎片、开销、隔离弱、透明性不足）。
- “仍有哪些代价”：说明实现复杂度、硬件依赖、调参与公平性风险。

### 9.4 常见误区

- 只看吞吐提升，不看隔离性与透明性。
- 把“能访问远端内存”误当“远端内存一定高效”。
- 默认某一层（OS、应用、硬件）永远最优；本讲案例显示常常需要跨层协同。

### 9.5 自检问题

1. 你能否解释 PagedAttention 与传统 VM 分页的相似点和关键差异？
2. 你能否说明 Infiniswap 为何选择分布式启发式而非中心化全局最优？
3. 你能否讲清 AIFM 如何同时缓解 semantic gap 与 kernel overhead？
4. 你能否解释 PipeSwitch 的流水化为何改变了上下文切换关键路径？
5. 你能否说明 `\alpha_{out}=\alpha_{in}` 与 `\beta_{out}\le\beta_{in}` 在 TGS 中分别保护了谁、约束了谁？
