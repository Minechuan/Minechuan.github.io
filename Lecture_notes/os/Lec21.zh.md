# 第 21 讲：文件系统 3 - mmap、Buffer Cache、Durability 与 Reliability

## 学习目标

学完本讲后，你应该能够：

1. 解释 `mmap()` 如何把文件访问转化为按需分页的内存访问。
2. 追踪 buffer cache 在 `open`、`read`、`write`、eviction 下的行为。
3. 比较文件系统缓存中的替换策略、预取策略与延迟写策略。
4. 用系统实例区分 **availability**、**durability**、**reliability**。
5. 推导 RAID-5 奇偶校验恢复公式，并说明为何需要 RAID-6 / erasure coding。
6. 解释为什么只有 durability 还不够，以及文件系统如何维持一致性。

## 1. 从早期文件系统设计过渡到“故障下正确性”

本讲先回顾，再把重点从“布局性能”转向“失败条件下的正确性”。

- FAT、inode 树、FFS 局部性、NTFS 元数据都在提升映射效率与性能。
- 但现代系统还必须应对崩溃、部分写入、跨多块更新中断。
- 因此关注点从“数据在哪”扩展为“执行做到一半崩溃会怎样”。

## 2. 内存映射文件（`mmap`）

**关键定义：** **`mmap` maps a file (or anonymous region) into a process virtual address space.**

![mmap page fault to file-backed page](lec21_materials/mmap_page_fault_to_file_backed_page.png)

映射后：

- 访问通过普通的虚拟地址 load/store 完成。
- 缺失页会触发 page fault。
- OS 的 page-fault handler 从文件加载对应页并更新页表项。
- 映射建立后，CPU 重试故障指令继续执行。

![shared mapped files across processes](lec21_materials/shared_mapped_files_across_processes.png)

**关键定义：** **`MAP_SHARED` allows updates to become visible across mappings and eventually to storage.**

:::remark 关键问题：为什么 `mmap` 在某些场景可替代显式 `read`/`write`？
**问题（原意复述）：如果把文件页直接映射到 VAS，用户代码省掉了什么工作？**

解答：
- 用户态无需显式维护 read 缓冲和拷贝路径。
- 访问路径变为“内存引用 + 缺页处理”。
- 内核仍然做 I/O，只是从 `read` 系统调用路径转到 page-fault 路径。
:::

## 3. Buffer Cache 内部流程：`open`、`read`、`write` 与驱逐

**关键定义：** **Buffer cache is memory used to cache kernel file-system resources (data blocks, inodes, directory blocks, free-map metadata).**

![buffer cache read path](lec21_materials/buffer_cache_read_path.png)

从操作路径看：

- `open`：目录遍历，解析 `<name -> inumber>`，建立 open-file 状态。
- `read`：沿 inode/索引定位数据块，读入后把请求字节拷给用户缓冲区。
- `write`：先更新缓存中的块；可能触发新块分配与元数据更新。
- eviction：缓存满时选择牺牲块；脏块在复用前必须写回。

课件强调缓存块的中间状态（`free`、`in-use`、`being-read`、`dirty`、`being-written`）由 OS 软件维护。

:::warn 关键问题：为什么 `write()` 可以在数据落盘前返回？
**问题（原意复述）：一次 write 系统调用的数据到底什么时候才真正进入持久介质？**

解答：
- Buffer cache 属于 write-back cache。
- `write()` 通常在数据拷入内核缓存后即可返回。
- 真正 flush 发生在后续（周期刷盘、内存压力驱逐、显式 sync）。
- 这提升了写延迟表现，但也引入了崩溃窗口。
:::

## 4. 缓存策略、预取与延迟写

![delayed writes writeback cache](lec21_materials/delayed_writes_writeback_cache.png)

### 4.1 替换策略

课件以 LRU 作为文件块缓存的基线策略。

- 优点：工作集可容纳时，局部性命中效果好。
- 缺点：顺序扫描型负载容易污染缓存、挤出热点块。
- 工程上常提供额外提示（例如 "use once"）抑制扫描污染。

### 4.2 缓存大小边界

核心权衡是：

- 缓存给太多，进程虚拟内存空间受压。
- 缓存给太少，文件访问磁盘 I/O 上升。
- 更合理做法是按运行时压力动态调整边界。

### 4.3 Read-Ahead 预取

- Read-ahead 利用顺序访问特性提前拉取后续块。
- 预取过猛会拖慢其他应用请求。
- 预取过弱会丢失合并寻道的机会。

### 4.4 延迟写的收益与风险

- 收益：写调用低延迟、批处理更充分、磁盘写调度更友好。
- 风险：崩溃时，尚未刷盘的脏块可能丢失。

:::tip 关键问题：为什么脏块“最近刚用过”也要周期性刷盘？
**问题（原意复述）：为什么 buffer cache 不能只按纯 LRU 行为？**

解答：
- 纯粹“最近访问”不能表达 durability 风险。
- 周期写回是在给“潜在数据丢失窗口”设上限。
- 因此 buffer-cache 策略本质上同时是性能策略和可靠性策略。
:::

## 5. 关键 "ilities"：Availability、Durability、Reliability

![availability durability reliability definitions](lec21_materials/availability_durability_reliability_definitions.png)

**关键定义：** **Availability is the probability that the system accepts and processes requests.**

**关键定义：** **Durability is the ability to recover previously stored data despite faults.**

**关键定义（课件中的 IEEE 含义）：** **Reliability is the ability to perform required functions correctly over time under stated conditions.**

工程语境下可区分为：

- Availability 回答“现在是否可服务”。
- Durability 回答“故障后数据是否还在”。
- Reliability 更宽：正确性 + 可用性 + 安全/容错维度。

## 6. 如何提升文件系统 Durability：ECC、NVRAM、RAID、纠删码

### 6.1 短期 Durability

- 存储块内 ECC 可修复小规模介质错误。
- 电池保护的非易失内存（NVRAM）可保护待刷盘脏数据。
- 复制（replication）避免单副本丢失。

### 6.2 RAID 与奇偶恢复

![raid5 parity reconstruction](lec21_materials/raid5_parity_reconstruction.png)

RAID-5 条带奇偶关系：

$$
P_0 = D_0 \oplus D_1 \oplus D_2 \oplus D_3
$$

当某个数据块缺失（如 `D_2`）时：

$$
D_2 = D_0 \oplus D_1 \oplus D_3 \oplus P_0
$$

### 6.3 为什么需要 RAID-6 / 纠删码

![raid6 and erasure code parameters](lec21_materials/raid6_and_erasure_code_parameters.png)

磁盘容量变大后，重建窗口变长，重建期间第二次故障概率上升。

课件中的一般化纠删码参数：

$$
\text{parity fragments} = n-m
$$

$$
\text{failure tolerance} = n-m
$$

课件示例：

$$
m=4,\quad n=16
$$

含义：任意 4 个分片即可恢复原始对象（与课件讨论的 MDS 场景一致）。

:::remark 关键问题：为什么“多副本”本身不等于高 durability？
**问题（原意复述）：independence of failures 到底在强调什么？**

解答：
- 同一故障域内的副本可能同时失效。
- 真正 durability 要求故障域隔离（磁盘、控制器、服务器、机架、地域）。
- 纠删码 + 跨地域分布能显著提高长期存活概率。
:::

## 7. 仅有 Durability 还不够：Crash Consistency 问题

![threats to reliability](lec21_materials/threats_to_reliability.png)

一次逻辑文件操作通常会触及多个物理块：

- inode / indirect block / data block / allocation bitmap / directory entry
- 更底层 remapping 还可能把一次更新拆成多个物理更新

如果在中途崩溃：

- 部分写入成功、部分丢失
- 元数据指针可能失配
- 命名空间可达性与分配状态可能分叉

所以 reliability 需要一致性保证，而不仅仅是冗余副本。

:::error 关键问题：为什么 RAID 不能直接等价为文件系统 reliability？
**问题（原意复述）：如果 RAID 组里有一块来不及写完就崩溃，会怎样？**

解答：
- RAID 主要防的是介质/设备故障。
- 它并不自动保证文件系统“多块更新原子性”。
- 因此在更新序列中断时，依然可能落到逻辑不一致状态。
:::

## 8. 文件系统的两条可靠性路径

![careful ordering vs copy on write](lec21_materials/careful_ordering_vs_copy_on_write.png)

### 8.1 谨慎写序 + 恢复扫描（传统 FAT/FFS 风格）

- 按安全顺序构造更新，使“做到一半”也可恢复。
- 把最终“接入命名空间”的步骤放在最后。
- 重启后由恢复工具（`fsck` 风格）扫描并修复未完成动作。

### 8.2 版本化 + Copy-on-Write（ZFS 风格族）

- 构造一个新版本，并复用旧版本中未变化的块。
- 通过原子切换根/元数据指针来提交新版本。
- 恢复更简单，因为提交前旧版本始终有效。

:::tip 关键问题：为什么 copy-on-write 能简化崩溃恢复？
**问题（原意复述）：为什么“声明新版本 ready”这个最后步骤很关键？**

解答：
- 新版本构造期间，旧的已提交状态始终可读。
- 若切换前崩溃，系统仍回到旧状态。
- 若切换后崩溃，系统看到的是完整连通的新状态。
:::

## Exam Review

### A. 高价值定义

- **`mmap`**：把文件/匿名区映射到 VAS，按需缺页加载。
- **Buffer cache**：内核维护的文件系统块与元数据缓存。
- **Delayed write (write-back)**：`write()` 返回早于物理持久化。
- **Availability / Durability / Reliability**：可服务性 / 数据生存性 / 按条件持续正确服务。
- **RAID parity 与 erasure coding**：在容量、性能、容错之间做权衡的冗余机制。

### B. 必会机制链

1. `mmap` 访问失配 -> page fault -> OS handler -> 读盘 -> 更新页表 -> 重试指令。
2. `open` 路径遍历 -> inode 解析 -> 绑定 fd 状态。
3. `write` -> 脏块进入缓存 -> 周期/压力刷盘 -> 持久化（或进入崩溃窗口）。
4. RAID-5 在单块丢失时用 XOR 恢复。
5. 一致性保障：有序更新恢复路径 vs COW 版本提交路径。

### C. 简答模板

- 为什么要 delayed writes？
  - 降低写调用时延、提高批处理调度效率；代价是受控崩溃窗口。
- 为什么 buffer cache 不能一味做大？
  - 必须在进程内存需求和文件缓存命中率之间动态平衡。
- 为什么 RAID 不等于完整 reliability？
  - 抗磁盘损坏与保证文件系统跨多块一致性是两个问题。
- 为什么 COW 有利于恢复？
  - 通过提交边界把“多次写”变成“单次可见性切换”。

### D. 常见误区

- “durability 就代表 always available” -> 错。
- “用了 RAID 就一定 metadata crash-safe” -> 错。
- “LRU 一条策略足够覆盖 buffer cache” -> 错（还需要 durability 驱动刷盘策略）。

### E. 自检清单

- 你能从 XOR 性质推导 RAID-5 恢复公式吗？
- 你能举出一个“元数据更新中断导致不一致”的具体例子吗？
- 你能在 1 分钟内比较 fsck 路径与 COW 路径吗？
- 你能说明 `mmap` 何时优于显式 `read`/`write` 吗？
