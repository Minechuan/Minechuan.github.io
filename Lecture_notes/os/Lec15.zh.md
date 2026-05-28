# 第 15 讲：内存 3——按需分页（Demand Paging）

## 学习目标

学完本讲后，你应该能够：

1. 解释为什么按需分页可以把 DRAM 看成磁盘后备存储之上的缓存。
2. 描述完整的 page fault 处理流水线，以及“重试”语义如何成立。
3. 解释 non-resident 页如何通过 backing store 元数据定位。
4. 用 working set 模型分析 page cache 行为。
5. 推导并解释有效访问时间（EAT）模型。
6. 比较 FIFO、RANDOM、MIN、LRU 等置换策略及其工程限制。

## 1. 从翻译/TLB 到 Demand Paging 的过渡

进入 demand paging 之前，先回忆两点：

- TLB 通常容量较小但相联度高（小规模下常做全相联）。
- 地址翻译失败可以 trap 到 OS。

Demand paging 正是在这个基础上扩展：页表层面的 miss 可以是“可恢复事件”，而不一定是“致命错误”。

:::remark 关键问题：为什么在 paging + TLB 之后还需要 demand paging？
**问题（原意复述）：页表已经能做地址映射了，为什么还要再加一层机制？**

解答：
- 页表只描述映射状态，并不要求每个映射页都常驻内存。
- Demand paging 允许“先有映射、后按需装入数据”。
- 这样内存可以优先服务热点页，支撑更大的活动工作负载。
:::

## 2. 把 Demand Paging 当成缓存系统来理解

讲义将 demand paging 明确建模为缓存设计问题：

- Block size：1 个 page（例如 4 KB）。
- Organization：等效于全相联（虚拟页可落在多个候选物理帧中）。
- Lookup path：先查 TLB，再走 page table。
- Miss handling：从磁盘调页到内存，然后重试 fault 指令。
- Write behavior：需要 dirty 位与回写机制。

![Page fault 到 demand paging 流程](lec15_materials/page_fault_to_demand_paging_flow.png)

:::tip 关键问题：分页系统里的写路径是什么语义？
**问题（原意复述）：虚拟内存更像 write-through 还是 write-back？**

解答：
- 工程上虚拟内存基本按 write-back 处理。
- 被修改页面用 dirty 状态追踪。
- 页面被替换或后台清理时，再回写到 backing store。
:::

## 3. 为什么现代系统仍然离不开虚拟内存

历史上 paging 用于缓解内存稀缺。今天即便硬件更强，虚拟内存仍然关键，因为：

- 程序占用大但常常稀疏。
- 访问具有明显局部性（90-10 现象仍常见）。
- 很多内存内容是共享的，或阶段性才活跃。

![无限内存幻觉](lec15_materials/illusion_of_infinite_memory.png)

现代 VM 的价值不只是“超配”，还包括：

- 栈按需扩展，
- 堆按需扩展，
- `fork` + copy-on-write，
- `exec` 懒加载，
- `mmap` 共享映射。

![虚拟内存的多种用途](lec15_materials/many_uses_of_virtual_memory.png)

## 4. 构建进程 VAS 与 Backing Store

一个进程 VAS 通常包含 code、data、heap、stack 等区域。常驻页映射到物理帧；非驻留页必须能在磁盘上定位。

![创建进程 VAS](lec15_materials/create_process_vas_overview.png)

因此 OS 需要同时维护：

- 给硬件翻译路径使用的页表常驻映射信息；
- 给 non-resident 页定位用的软件元数据。

![VAS 的 backing store 映射](lec15_materials/backing_store_for_vas.png)

讲义用的抽象接口是：

`FindBlock(PID, page#) -> disk_block`

![non-resident 页定位结构](lec15_materials/findblock_nonresident_page_mapping.png)

:::warn 关键问题：non-resident 页的映射元数据放在哪？
**问题（原意复述）：是放进 PTE、放外部结构，还是两者结合？**

解答：
- 不同 OS 的实现组合不同。
- 有的会在 PTE 空闲位编码磁盘位置信息。
- 有的维护紧凑的软件表（例如数组/哈希结构）。
- 常见优化是将可执行代码页直接映射到文件后备镜像。
:::

## 5. Page Fault 处理流水线

线程访问 non-resident 页时，典型 fault 流程如下：

1. 因无效/非驻留翻译触发 trap。
2. 判断访问是否合法且是否可恢复。
3. 定位目标页的 backing-store 位置。
4. 获取空闲帧（若没有则先挑 victim）。
5. victim 若为 dirty，先安排/执行回写。
6. 将目标页从磁盘读入该帧。
7. 更新 PTE，并失效/刷新相关 TLB 项。
8. 重新调度并重试原指令。

![缺页处理步骤总览](lec15_materials/page_fault_handling_steps_summary.png)

:::tip 关键问题：为什么 fault 指令可以安全重试？
**问题（原意复述）：重试怎么保证程序语义不被破坏？**

解答：
- page fault 与故障指令同步发生。
- 架构状态会被保留到可重启点。
- 映射修复后重试，效果等价于数据一开始就在内存中。
:::

## 6. 空闲帧、后台清理与内存压力控制

讲义强调了内存压力下的帧管理机制：

- 维护 free-frame list。
- 空闲帧不足时启动后台 cleaner/reaper。
- 优先提前回写旧 dirty 页，减少硬缺页阻塞。
- 万不得已时再走同步替换路径。

这里内存管理和调度紧密耦合：OS 既要分配 CPU 时间，也要分配内存驻留配额。

:::remark 关键问题：每个进程该分多少帧？
**问题（原意复述）：分配目标应优先利用率、公平性还是优先级？**

解答：
- 没有“一刀切”的静态答案。
- OS 需要在吞吐、时延、公平与优先级策略间权衡。
- working set 行为与置换策略会直接影响最终分配效果。
:::

## 7. Working Set 模型与 Miss 分类

Working set 模型指出：程序运行会在多个阶段间切换，每个阶段有不同的活跃页子集。

![Working set 模型下的缓存行为](lec15_materials/cache_behavior_working_set_model.png)

直接后果：

- 命中率会随 cache 容量和阶段边界变化。
- 全局看似平稳，但阶段切换时可能出现短时 miss 突增。

讲义在该语境下讨论了：

- Compulsory miss：第一次访问、从未装入。
- Capacity miss：活跃工作集超过可用内存。
- Conflict miss：在全相联 VM 模型里通常不突出。
- Policy miss：替换策略选错导致的 miss。

![导致 page cache miss 的因素](lec15_materials/factors_misses_in_page_cache.png)

## 8. Demand Paging 成本模型（EAT）

Paging 同样适用缓存的平均时延模型。

$$
\text{EAT} = H\cdot T_h + M\cdot T_m,\quad H+M=1
$$

$$
\text{EAT} = T_h + M\cdot (T_m - T_h)
$$

讲义示例取值：

$$
T_h = 200\,\text{ns},\quad T_m - T_h = 8\,\text{ms}
$$

$$
p = P(\text{miss}),\; 1-p=P(\text{hit})
$$

$$
\text{EAT} = 200\,\text{ns} + p\cdot 8\,\text{ms}
= 200\,\text{ns} + p\cdot 8{,}000{,}000\,\text{ns}
$$

若每 1000 次访问有 1 次缺页（$p=10^{-3}$）：

$$
\text{EAT} = 8.2\,\mu s
$$

相对 200 ns 基线，约是 40 倍慢化。

若希望慢化低于 10%：

$$
\text{EAT} < 200\,\text{ns}\times 1.1 \Rightarrow p < 2.5\times 10^{-6}
$$

等价为约 40 万次访问才允许 1 次缺页。

![Demand paging 成本模型](lec15_materials/demand_paging_cost_model.png)

:::error 关键问题：为什么这么小的 miss 概率仍然“致命”？
**问题（原意复述）：page fault 很少，为什么还能显著拖慢系统？**

解答：
- fault 服务时间比 DRAM 命中时间大很多个数量级。
- 很小的 miss 率也会明显拉高平均时延并放大尾时延。
- 因此 OS 必须强力抑制“可避免缺页”。
:::

## 9. 置换策略与工程权衡

本讲回顾了经典页替换策略：

- FIFO：实现简单，但可能误淘汰热点页。
- RANDOM：成本低、鲁棒，但可预测性弱。
- MIN：理论最优，但依赖未来信息。
- LRU：用“最近性”近似 MIN 的工程策略。

![页替换策略总览](lec15_materials/page_replacement_policies.png)

LRU 的链表直觉：

- 被访问页面移到表头；
- 表尾作为最久未使用页被替换。

![LRU 与链表实现示意](lec15_materials/lru_policy_list_implementation.png)

真实系统通常不会做“精确 LRU”，而采用带硬件访问位与周期 aging 的近似方案。

## 10. 端到端分析检查清单

遇到实际分页性能问题时，建议先问这 5 个问题：

1. 这次 fault 属于 compulsory、capacity，还是 policy 驱动？
2. backing-store 定位路径是否高效？
3. 空闲帧供应是否健康（free list + cleaner）？
4. 当前替换策略是否匹配工作负载局部性？
5. 实际 fault rate 是否满足目标时延 SLO？

## 11. Exam Review

### 11.1 Must-Know Definitions

- **Demand paging**：将 DRAM 作为磁盘后备虚拟页的缓存进行管理。
- **Page fault**：当翻译/权限状态需要 OS 介入时触发的同步异常。
- **Backing store**：用于恢复 non-resident 虚拟页的磁盘位置。
- **Working set**：程序当前阶段的活跃页集合。
- **Policy miss**：由替换策略不佳引起的 miss，不是首次访问也不纯粹是容量不足。
- **EAT**：在 hit/miss 概率下的有效平均内存访问时间。

### 11.2 High-Value Short-Answer Templates

1. **为什么 demand paging 有效？**  
   它把热点页留在 DRAM，把冷页留在磁盘，并保留大而连续的虚拟地址抽象。
2. **Page fault 的核心处理步骤是什么？**  
   Trap -> 合法性判断 -> 磁盘定位 -> 取空闲帧/替换 -> 磁盘读入 -> 更新映射/TLB -> 重试指令。
3. **为什么 0.1% 缺页率也可能代价很高？**  
   缺页罚时远大于 DRAM 命中时延，稀疏 miss 仍可主导 EAT。
4. **为什么 MIN 不能直接落地？**  
   因为它依赖未来访问序列，系统只能用可实现的近似策略。

### 11.3 Common Pitfalls

- 把 invalid PTE 一律当成致命错误，而不区分 demand paging 可恢复状态。
- 估算 miss penalty 时忽略 dirty 页回写成本。
- 混淆 capacity miss 与 policy miss。
- 误以为生产内核总能承受精确 LRU 成本。
- 忽略内存策略与 CPU 调度在压力场景下的耦合。

### 11.4 Self-Check

:::tip 自检 1
给定 $T_h=200\,\text{ns}$、缺页罚时 $8\,\text{ms}$，估算 $p=10^{-4}$ 的 EAT，并与 $p=10^{-3}$ 对比。
:::

:::tip 自检 2
若负载在两个“几乎占满内存”的大 working set 间来回切换，阶段边界附近会出现什么 miss 形态？为什么？
:::

:::tip 自检 3
当 free-frame 压力上升时，cleaner、replacement 与 scheduler 该如何联动，才能降低用户可见的时延尖峰？
:::
