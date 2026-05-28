# 第 16 讲：内存 4——页面置换、工作集与抖动控制

## 学习目标

学完本讲后，你应该能够：

1. 解释为什么置换策略质量决定了按需分页能否持续高效。
2. 在同一引用串上比较 FIFO、MIN、LRU，并解读缺页次数差异。
3. 解释栈性质，以及 FIFO 为什么会违反该性质（Belady 异常）。
4. 描述 Clock 如何近似 LRU，包括 use/modified 位的软件仿真变体。
5. 解释 second-chance list、free list 后台清理、反向映射与帧分配策略。
6. 使用 working set 与 page-fault-frequency 思路检测并缓解 thrashing。

## 1. 从按需分页到置换策略设计

按需分页要想表现好，前提是置换决策能够保住局部性。一旦空闲帧紧张，页面置换策略就会成为性能主杠杆。

核心设计问题：

- 发生缺页时到底该淘汰哪一页？
- 假设多少硬件支持（use 位、modified 位）？
- 理论最优、实现成本、fault 时延三者如何取舍？

:::remark 关键问题：为什么现在“置换”成了中心问题？
**问题（原意复述）：我们已经会按需调页了，为什么还要花这么大力气选 victim？**

解答：
- 缺页代价主要由磁盘 I/O 和阻塞时延决定。
- 一次错误的淘汰可能立刻引发下一次缺页。
- 因此分页性能不仅取决于“怎么装入”，更取决于“如何长期维持正确的驻留集合”。
:::

## 2. 在同一引用串上比较 FIFO、MIN 与 LRU

讲义使用同一引用串、3 个帧对比策略：

`A B C A B D A D B C B`

![FIFO 置换示例](lec16_materials/fifo_replacement_example.png)

FIFO 在该例中产生 **7 次缺页**。关键失误是 `D` 到来时淘汰了 `A`，而 `A` 很快就会再次被访问。

![MIN/LRU 对比示例](lec16_materials/min_lru_comparison_example.png)

MIN 在同一引用串下是 **5 次缺页**。这个例子里 LRU 与 MIN 决策一致，但这种一致并不保证在所有负载下成立。

:::tip 关键问题：为什么 MIN 只能做基准，不能直接部署？
**问题（原意复述）：既然 MIN 最优，为什么内核不直接用 MIN？**

解答：
- MIN 需要知道未来访问序列（每页下一次被访问的距离）。
- 真实系统无法预知未来引用。
- 所以 MIN 是缺页下界，主要用于评估可实现近似策略。
:::

## 3. LRU 也可能表现很差的场景

LRU 通常很强，但并非万能。若访问模式是大小为 `N+1` 的循环工作集，却只给 `N` 个帧（例如 3 帧下反复 `A B C D A B C D ...`），则每次访问都可能缺页。

这说明：

- LRU 捕捉的是“最近性”，不是程序阶段语义本身。
- 若活跃集合系统性超过可用帧数，仅靠置换策略无法根治问题。

## 4. 栈性质与 Belady 异常

一个理想性质是：增加帧数后，缺页不应上升，这就是栈性质（stack property）。

![Belady 异常的 FIFO 反例](lec16_materials/belady_anomaly_fifo_counterexample.png)

讲义反例显示：

- 3 帧：9 次缺页
- 4 帧：10 次缺页

说明 FIFO 可能违反单调性。而 MIN/LRU 家族在其建模假设下满足栈式包含关系。

## 5. Clock：可落地的 LRU 近似

Clock 把页组织成环，并在缺页时推动单指针扫描。

![Clock 算法总览](lec16_materials/clock_algorithm_overview.png)

核心机制：

- 每页维护 **use 位**（accessed 位）。
- 缺页时指针扫描页面：
- 若 `use=1`：清零并暂时跳过。
- 若 `use=0`：选为可替换候选。

它找的是“足够老”的页面，而不一定是“最老”的页面。

![Clock 缺页替换步骤示意](lec16_materials/clock_page_fault_replacement_step.png)

执行替换时：

- 若脏页则先回写。
- 失效对应翻译状态（PTE/TLB）。
- 装入新页并更新映射。

:::warn 关键问题：Clock 指针转速能说明什么？
**问题（原意复述）：Clock hand 转得慢或快，分别是好事还是坏事？**

解答：
- 转得慢通常意味着缺页少，或很快能找到可替换页。
- 转得快通常意味着压力大：缺页多或近期被访问页很多。
- 因此指针速度可作为内存压力的粗粒度运行信号。
:::

## 6. Clock 变体与位仿真

讲义给出三类扩展：

1. Nth-chance Clock：
- 让页面在被替换前经历多轮机会。
- 常见策略是 clean 页更早替换，dirty 页多给几次机会。

2. modified 位仿真：
- 初始把可写页临时标成只读。
- 首次写入触发陷入；OS 记录软件 modified 状态后再放开写权限。

3. use 位仿真：
- 分阶段把页面标无效（或更严格权限）。
- 访问陷入告诉 OS“该页被用过”，再更新软件 use 状态。

工程权衡：

- 硬件支持少，陷入开销会增加。
- 硬件支持多，快路径更简单。

## 7. Second-Chance List（VAX/VMS 风格）

Second-chance list 把内存分成两组：

- Active list：直接映射、命中快。
- Second-chance list：标 invalid 的“二次机会”页，按近似 LRU 管理。

![Second-chance list（VAX/VMS）](lec16_materials/second_chance_list_vax_vms.png)

工作逻辑：

- Active 溢出页进入 SC 列表。
- 命中 SC 页会触发 fault，然后被提升回 Active。
- 长期不再使用的页最终在 SC 尾部被淘汰。

这种设计在保持 Active 命中快路径的同时，近似 LRU 行为。

## 8. Free List 与后台清理

系统常通过后台维护 free-page 池，而不是每次 fault 都现场选 victim + 清理。

![Free list 与 pageout daemon](lec16_materials/free_list_pageout_daemon.png)

要点：

- pageout daemon 提前补充 free list。
- dirty 页可在“非紧急时刻”先回写。
- 缺页路径通常可直接拿到可用帧，降低尾时延。

## 9. 反向映射与帧分配策略

淘汰某个物理帧时，OS 需要快速定位所有指向该帧的 PTE（共享页场景尤其关键）。

反向映射（coremap 类机制）支持：

- 淘汰时批量失效关联 PTE，
- 扫描活跃性与置换统计。

帧分配常见范围与策略：

- Global replacement：进程可从其他进程“拿帧”。
- Local replacement：进程仅在自己配额内替换。
- Equal / Proportional / Priority：提供静态基线配额。

讲义中的比例分配公式：

$$
s_i = \text{进程 } p_i \text{ 的大小},\quad S = \sum_i s_i,\quad m = \text{系统总物理帧数}
$$

$$
a_i = \frac{s_i}{S}\,m
$$

## 10. Thrashing 检测与 Working-Set 控制

Page-fault-frequency（PFF）根据观察到的缺页率动态调配帧数。

![PFF 分配曲线](lec16_materials/page_fault_frequency_allocation_curve.png)

策略直觉：

- 缺页率过高：增加帧。
- 缺页率过低：回收帧。

但若系统总体内存不足，仅靠 PFF 也无法阻止性能崩塌。

![Thrashing 与 CPU 利用率](lec16_materials/thrashing_cpu_utilization_curve.png)

**定义：** **Thrashing** 指系统大部分时间都在换页，几乎没有有效执行进展。

从局部性角度看：

![局部性访问轨迹](lec16_materials/locality_memory_reference_pattern.png)

进程只有在工作集能放下时才会表现稳定。

![Working-set 窗口示例](lec16_materials/working_set_window_example.png)

Working-set 模型符号：

$$
\Delta \equiv \text{工作集窗口}
$$

$$
WS_i(t) = \{\text{进程 } P_i \text{ 在最近 } \Delta \text{ 内访问的页面集合}\}
$$

$$
D = \sum_i |WS_i|,
\quad D > m \Rightarrow \text{thrashing}
$$

讲义给出的控制动作：

- 当总需求 `D` 超过物理内存 `m`，应挂起/换出一部分进程，让需求重新“装得下”。

:::error 关键问题：一旦出现 thrashing，最佳响应是什么？
**问题（原意复述）：缺页暴涨时，是否继续保持所有进程 runnable 并只调置换参数？**

解答：
- 通常不行。若工作集总量本身放不下，仅调置换细节不够。
- 应降低多道程序度（挂起/换出部分进程）。
- 先恢复 free-frame 余量，再逐步恢复并发。
:::

## 11. Compulsory Miss、聚簇与换入优化

并非所有 miss 都是策略失败。首次访问或换回后首次访问带来的 miss 属于 compulsory miss。

两类实用缓解手段：

- Clustering：一次缺页顺带预取邻近页，利用顺序磁盘读吞吐。
- Working-set 感知换入：进程换回时优先带回“即将用到”的工作集。

两者都能减少恢复阶段的连续重复缺页。

## 12. Exam Review

### 12.1 Must-Know Definitions

- **栈性质（stack property）**：增加帧数不会增加缺页次数。
- **Belady 异常**：FIFO 可能在帧数增加后反而缺页更多。
- **Clock 算法**：利用环形队列与 use 位近似 LRU。
- **Second-chance list**：active + second-chance 双列表近似 LRU，并保持 active 命中快路径。
- **PFF 控制**：用缺页率上下界动态调配帧数。
- **Working-set 模型**：进程需要最近窗口 `\Delta` 内访问页集合的支持。
- **Thrashing**：分页活动主导运行时间，有效计算几乎停滞。

### 12.2 High-Value Short-Answer Templates

1. **为什么 FIFO 在加内存后可能更差？**  
   FIFO 不满足栈性质；不同帧数下驻留集可能分叉，从而出现 Belady 型反例。
2. **为什么 Clock 被广泛采用？**  
   它用低成本 use 位 aging 近似 recency，在开销和效果间取得较好平衡。
3. **什么时候 PFF 也无法稳住性能？**  
   当总工作集需求超过物理内存时，单进程调参不足以解决全局拥塞。
4. **抗 thrashing 的标准动作是什么？**  
   降低多道程序压力，挂起/换出部分进程。

### 12.3 Common Pitfalls

- 把 LRU 当作“任何场景都最优”的绝对策略。
- 误以为增加帧数对所有策略都必然降缺页。
- 设计淘汰路径时忽略反向映射开销。
- 在 fault 临界路径估算中忘记脏页回写时延。
- 面对全局内存超载时只做局部置换调参。

### 12.4 Self-Check

:::tip 自检 1
在同一引用串上，用一段话解释 MIN 为什么优于 FIFO，以及 LRU 何时可能与 MIN 打平。
:::

:::tip 自检 2
你观察到 Clock hand 转速很快且缺页率上升。给出两个可能原因和一个立即可执行的缓解动作。
:::

:::tip 自检 3
系统在 swap-in 后出现大量 compulsory miss。说明 clustering 与 working-set 感知预装入会如何改变缺页形态。
:::
