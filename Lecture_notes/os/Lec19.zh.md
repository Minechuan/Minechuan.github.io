# 第 19 讲：文件系统 1 - I/O 性能与文件系统设计

## 学习目标

学完本讲后，你应该能够：

1. 使用响应时间、吞吐量、利用率来分析 I/O 行为。
2. 使用基础排队模型（课堂中的 M/M/1 与 M/G/1 形式）估计排队延迟。
3. 解释为什么磁盘调度策略会同时影响性能与公平性。
4. 将 I/O 性能规律与文件系统结构设计联系起来。
5. 说明名字解析如何把用户路径映射到基于 inode 的存储元数据。

## 1. 从设备 I/O 到文件系统性能

本讲贯穿两个层次：

- 设备层 I/O 性能（排队、调度、利用率压力）。
- 文件系统抽象（名称、目录、inode、数据块）。

核心观点是：文件系统设计不能脱离底层设备性能特征。

![Basic I/O performance concepts](lec19_materials/io_basic_performance_concepts.png)

核心指标：

- **响应时间（latency）**：单次操作完成所需时间。
- **吞吐量（throughput/bandwidth）**：每秒可完成的操作数或字节数。

![I/O bottleneck and response-time curve](lec19_materials/io_performance_bottleneck_and_response_curve.png)

:::remark 关键问题：为什么接近饱和时延迟会陡增？
**问题（原意复述）：如果硬件吞吐量很高，为什么用户感知到的响应时间仍可能很大？**

解答：
- 当利用率接近 1 时，排队延迟会非线性增大。
- 即使平均负载不高，突发到达也会造成瞬时积压。
- 因此高吞吐并不自动等于低延迟。
:::

## 2. 确定性排队直觉

![Deterministic model and utilization](lec19_materials/queueing_deterministic_model_and_utilization.png)

课堂记号：

$$
\mu = \frac{1}{T_S}, \qquad
\lambda = \frac{1}{T_A}, \qquad
u = \frac{\lambda}{\mu} = \frac{T_S}{T_A}, \ \lambda < \mu
$$

- `T_A`：到达间隔时间。
- `T_S`（`Tser`）：服务时间。
- `T_Q`：排队等待时间。

这个确定性模型用于建立直觉，但真实系统通常是突发性的。

## 3. 突发到达与指数建模

![Exponential arrival model](lec19_materials/exponential_arrival_distribution_memoryless.png)

为了刻画突发性，课堂引入到达间隔的指数分布：

$$
f(x)=\lambda e^{-\lambda x}, \qquad \mathbb{E}[X]=\frac{1}{\lambda}
$$

**关键定义：** **无记忆性（Memoryless）** 指“下一次到达的概率与已经等待多久无关”。

这使得排队分析公式可解，并能较好近似很多实际聚合负载。

## 4. 课堂使用的排队结果

![Queueing parameters](lec19_materials/queueing_parameters_lambda_mu_u_lq.png)

参数回顾：

- `\lambda`：到达率。
- `T_{ser}`：平均服务时间。
- `C`：变异系数平方。
- `u`：利用率。
- `T_q`、`L_q`：排队时间与队列长度。

Little 定律形式：

$$
L_q = \lambda T_q
$$

课件中的结果形式：

![M/M/1 and M/G/1 formulas](lec19_materials/mm1_and_mg1_queue_delay_formulas.png)

$$
\text{M/M/1 (}C=1\text{): } T_q = T_{ser}\cdot\frac{u}{1-u}
$$

$$
\text{M/G/1 (slide form): } T_q = T_{ser}\cdot\frac{1}{2}(1+C)\cdot\frac{u}{1-u}
$$

随着利用率逼近 1，排队延迟会发散。

## 5. 例题：由统计量推导延迟

![Queueing numerical example](lec19_materials/queueing_example_numerical_solution.png)

课堂给定：

$$
\lambda=10/s,\quad T_{ser}=20\,\text{ms}=0.02\,s,\quad u=\lambda T_{ser}=0.2
$$

$$
T_q = 20\cdot\frac{0.2}{1-0.2}=5\,\text{ms}
$$

$$
L_q = \lambda T_q = 10\times0.005 = 0.05
$$

$$
T_{sys}=T_q+T_{ser}=25\,\text{ms}
$$

:::tip 关键问题：平均队列长度小于 1 还重要吗？
**问题（原意复述）：如果 `L_q = 0.05`，是否可以认为排队几乎可忽略？**

解答：
- 平均值会掩盖突发行为。
- 大多数时刻队列很短，不代表不会出现高尾延迟。
- 对排队敏感的系统，必须关注分布与尾部，而不只看均值。
:::

## 6. 实际 I/O 优化抓手

![I/O optimization strategies](lec19_materials/io_optimization_speed_parallelism_overlap.png)

课堂强调四个抓手：

- Speed：缩短单次服务步骤时间。
- Parallelism：通过多控制器/总线/资源实现解耦并行。
- Overlap：等待 I/O 时并行做其他有用工作。
- Queue management：吸收突发并进行更合理的请求调度。

![When disk performance is highest](lec19_materials/when_disk_performance_is_highest.png)

磁盘性能高的常见条件：

- 大块顺序访问。
- 有足够在途请求，便于批处理与重排。

## 7. 磁盘调度策略与权衡

磁盘一次只能服务一个请求，因此请求顺序非常关键。

![FIFO and SSTF scheduling](lec19_materials/disk_scheduling_fifo_sstf.png)

- FIFO：按到达顺序，简单且公平，但可能导致长寻道。
- SSTF：优先最近请求，降低寻道距离，但可能饿死远端请求。

![SCAN scheduling](lec19_materials/disk_scheduling_scan.png)

- SCAN（电梯算法）：沿当前方向服务，扫到端点后反向。
- 相比纯 SSTF，更不容易长期饥饿。

![C-SCAN scheduling](lec19_materials/disk_scheduling_cscan.png)

- C-SCAN：单向扫描服务，回卷后继续同向。
- 在不同柱面位置上等待时间更均匀，公平性更稳定。

:::warn 关键问题：既然 SSTF 就近最优，为什么不总用它？
**问题（原意复述）：如果 SSTF 在机械寻道上更高效，为什么不把它作为默认策略？**

解答：
- 局部寻道最优会牺牲全局公平性，甚至导致饥饿。
- 系统需要可预测服务，而不只是贪心局部最优。
- 在混合负载下，SCAN/C-SCAN 往往有更好的整体行为。
:::

## 8. 现代系统中的网络 I/O 视角

![Network I/O in modern systems](lec19_materials/network_io_and_modern_systems.png)

同样的规律也适用于磁盘之外：

- 排队与调度仍决定延迟/吞吐权衡。
- 现代栈越来越多使用用户态网络、RDMA、SmartNIC、DPU 来降低开销并提高重叠度。

## 9. 从块存储到文件系统抽象

![Building a file system](lec19_materials/building_a_file_system_goals.png)

**关键定义：** **文件系统把块设备接口提升为文件、目录、命名、保护与可靠性语义。**

用户视角与系统视角：

- 用户按字节流与路径名思考。
- 系统按固定大小的数据块与元数据结构组织。

![User-byte to block translation](lec19_materials/translation_from_user_bytes_to_blocks.png)

对部分字节区间访问时，文件系统内部需要做块级 read-modify-write 处理。

## 10. 文件系统核心结构：目录、inode、数据块

![FS components: directory, inode, blocks](lec19_materials/file_system_components_directory_inode_blocks.png)

名字解析模型：

- 目录维护 `<file_name, file_number>` 映射。
- file number 用于索引 inode 类元数据。
- inode 再映射到数据块。

![Open and name resolution components](lec19_materials/open_name_resolution_and_four_components.png)

课件总结的四个主要组件：

1. 目录结构。
2. 索引结构（inode/file header）。
3. 存储数据块。
4. 空闲空间映射。

目录语义与保护：

![Directory mapping and protection](lec19_materials/directory_mapping_and_protection_reason.png)

- 目录项是结构化映射，不是任意可改的原始字节。
- `readdir` 这类 API 以受控方式迭代目录项。

路径解析成本示例：

![Directory resolution cost](lec19_materials/directory_resolution_disk_access_count.png)

解析 `/my/book/count` 时，需要跨多级目录及目标文件元数据进行多次读取。

内存中的加速结构：

![In-memory file-system tables](lec19_materials/in_memory_file_system_tables_and_inode.png)

- 每进程 open-file table：fd 级句柄。
- 全局 open-file table：共享打开状态。
- 内存 inode/对象元数据：把句柄关联到存储块。

## 11. 工作负载现实与设计启示

课堂中的文件大小观测：

![Most files are small](lec19_materials/file_size_observation_most_files_small.png)
![Most bytes are in large files](lec19_materials/file_size_observation_most_bytes_large_files.png)

设计启示：

- 很多操作被元数据/路径处理主导（因为小文件多）。
- 吞吐优化同样重要（因为大多数字节集中在大文件）。

最终总结公式视角：

![Lecture conclusion](lec19_materials/lecture_conclusion_queueing_and_fs_summary.png)

$$
T_q = T_{ser}\cdot\frac{1}{2}(1+C)\cdot\frac{u}{1-u},
\quad u\to 1^- \Rightarrow T_q\to\infty
$$

因此文件系统与 I/O 栈设计必须同时优化：结构语义层和排队性能层。

## 12. Exam Review

### 12.1 必背定义

- **利用率（`u`）**：服务能力被占用的比例。
- **M/M/1 与 M/G/1**：分别对应无记忆到达/更一般服务时间假设的排队模型。
- **SSTF/SCAN/C-SCAN**：在公平性与性能上取舍不同的磁盘调度策略。
- **名字解析（Name resolution）**：将用户路径转换为内部 file number/inode 的过程。
- **目录项（Directory entry）**：`<file_name, file_number>` 映射。
- **Inode**：描述文件数据块与属性的元数据对象。

### 12.2 简答模板

- “为什么接近饱和时延迟急剧上升？”：`u/(1-u)` 的排队非线性效应。
- “为什么不能只用 SSTF？”：会出现饥饿与公平性问题。
- “为什么文件系统要分离 inode 与目录？”：名称面向用户，块映射面向系统。
- “为什么目录字节需要受保护？”：为了维护元数据不变量与一致性。

### 12.3 常见误区

- 把平均队列长度误当作尾延迟风险的充分指标。
- 把磁盘调度简化成“只看最小寻道”。
- 讨论文件系统性能时忽略元数据与路径遍历成本。

### 12.4 自检清单

1. 你能根据到达/服务统计量推导 `u`、`T_q`、`L_q`、`T_sys` 吗？
2. 你能解释何时应优先 SCAN 或 C-SCAN 而不是 SSTF 吗？
3. 你能完整描述从 pathname 到 inode 再到数据块的步骤吗？
4. 你能说明为什么小文件负载会强烈考验元数据性能吗？
5. 你能论证为什么高带宽设备仍然必须做排队感知设计吗？
