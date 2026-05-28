# 第 20 讲：文件系统 2 - 案例研究与面向缓冲的设计

## 学习目标

学完本讲后，你应该能够：

1. 说明 FAT、基于 inode 的 UNIX/FFS、NTFS 如何表示文件与目录。
2. 计算多级 inode 索引的关键容量，并分析访问深度带来的代价。
3. 分析为什么局部性、空闲空间策略、缓冲机制会直接决定文件系统性能。
4. 区分硬链接与软链接，并完整追踪路径解析到最终 inode/数据块的过程。
5. 在真实工作负载下比较 FAT、FFS、NTFS 的设计权衡。

## 1. 从 I/O 回顾到文件系统结构

本讲先回顾三件事，再进入具体文件系统设计。

- 排队论基础：利用率接近饱和时，时延会非线性上升。
- 磁盘调度：请求重排策略会同时影响吞吐与公平性。
- 翻译边界：用户字节区间最终都要落到块级 I/O。

![Queueing parameters and definitions](lec20_materials/queueing_parameters_and_definitions.png)
![Queueing results M/M/1 and M/G/1](lec20_materials/queueing_results_mm1_mg1.png)

本讲继续使用的核心公式：

$$
\mu = \frac{1}{T_{ser}}, \qquad
\lambda = \frac{1}{T_A}, \qquad
u = \frac{\lambda}{\mu} = \lambda T_{ser}
$$

$$
L_q = \lambda T_q
$$

$$
\text{M/M/1: } T_q = T_{ser}\cdot\frac{u}{1-u}
$$

$$
\text{M/G/1 (slide form): } T_q = T_{ser}\cdot\frac{1}{2}(1+C)\cdot\frac{u}{1-u}
$$

![Disk scheduling FIFO and SSTF](lec20_materials/disk_scheduling_fifo_sstf.png)
![Disk scheduling SCAN](lec20_materials/disk_scheduling_scan.png)
![Disk scheduling C-SCAN](lec20_materials/disk_scheduling_cscan.png)

![Translation from user bytes to blocks](lec20_materials/translation_user_bytes_to_blocks.png)

:::remark 关键问题：为什么即使有高级文件 API，块翻译仍然是核心？
**问题（原意复述）：当用户请求的是字节区间而不是整块时，系统到底要做什么？**

解答：
- 文件系统先把字节区间映射到对应块。
- 读取时先取块，再返回需要的字节片段。
- 写入时通常需要块级 read-modify-write。
- 所以缓冲与块布局始终是性能关键路径。
:::

## 2. 案例 A：FAT（File Allocation Table）

FAT 用“块链表”来表示文件，起点由 file number 给出。

![FAT file mapping overview](lec20_materials/fat_file_mapping_overview.png)

设计思路：

- 文件数据放在普通磁盘块中。
- FAT 项记录“下一块”指针。
- file number 指向该文件块链的根。
- 空闲块在 FAT 中标记，可扫描或配合空闲链策略分配。

![FAT storage and formatting](lec20_materials/fat_storage_and_formatting.png)

课件强调的格式化含义：

- FAT 位于磁盘上。
- 完整格式化：清块 + FAT 标记为空闲。
- 快速格式化：主要重置 FAT/空闲元数据，不会完整清除数据区。

![FAT directories](lec20_materials/fat_directory_structure.png)

**关键定义：** **A directory is a file containing `<file_name: file_number>` mappings.**

在 FAT 中进一步表现为：

- 目录项同时保存命名与较多属性信息。
- 目录查找常常是线性扫描。
- 根目录位置通常由磁盘格式约定固定。

:::warn 关键问题：FAT 在规模上升后最核心的性能短板是什么？
**问题（原意复述）：仅从 file number 出发，查找、布局和访问会遇到哪些问题？**

解答：
- 长链跟随会拉高随机访问代价。
- 物理布局容易碎片化。
- 大目录与大文件会进一步放大遍历开销。
:::

## 3. 案例 B：UNIX inode 与多级索引

UNIX 类系统通过 inode 将“命名”和“块映射”解耦。

![Inode multilevel index structure](lec20_materials/inode_multilevel_index_structure.png)

**关键定义：** **File Number (inumber) is index into an array of inodes (index structure).**

inode 关键点：

- 每个 inode 保存元数据（owner/group、权限位、大小、时间戳等）。
- 目录项负责把文件名映射到 inode 编号。
- 多个名字可以指向同一个 inode（硬链接）。
- 数据定位采用非对称层次：direct + indirect + double indirect + triple indirect。

![Inode direct pointers for small files](lec20_materials/inode_direct_pointers_small_files.png)
![Inode indirect pointers for large files](lec20_materials/inode_indirect_pointers_large_files.png)

容量计算（4KB 块、4 字节指针）：

$$
N_{ptr} = \frac{4096}{4} = 1024
$$

$$
\text{Direct capacity} = 12\times4\text{KB} = 48\text{KB}
$$

$$
\text{Single-indirect capacity} = 1024\times4\text{KB} = 4\text{MB}
$$

$$
\text{Double-indirect capacity} = 1024^2\times4\text{KB} = 4\text{GB}
$$

$$
\text{Triple-indirect capacity} = 1024^3\times4\text{KB} = 4\text{TB}
$$

![Multilevel index access-cost example](lec20_materials/multilevel_index_access_cost_example.png)

课件示例下的访问深度：

- block #5：一次数据块访问。
- block #23：间接块 + 数据块。
- block #340：二级间接块 + 一级间接块 + 数据块。

:::tip 关键问题：为什么这种非对称树能同时兼顾小文件和大文件？
**问题（原意复述）：为什么不对所有文件统一使用固定深度索引？**

解答：
- 大多数文件很小，direct 指针可保持常见路径低延迟。
- 大文件再通过间接层级扩展。
- 这样避免了小文件也承担深层索引开销。
:::

## 4. 案例 C：Berkeley FFS 的局部性与空闲空间策略

FFS 保留 inode 思路，但重点重构了布局与分配策略。

![FFS design goals and changes](lec20_materials/ffs_design_goals_and_changes.png)
![FFS inode placement motivation](lec20_materials/ffs_inode_placement_motivation.png)

课件中的问题定义：

- inode 全部集中会导致 header/data 频繁远距离寻道。
- 创建文件时未知最终大小，连续预分配困难。
- 旋转延迟会造成“下一块错过”问题。

![FFS block groups locality](lec20_materials/ffs_block_groups_locality.png)
![FFS block groups allocation policy](lec20_materials/ffs_block_groups_allocation_policy.png)

FFS 的解决方向：

- 将磁盘分为 block groups。
- 在组内共置元数据、数据块和空闲位图。
- 优先局部、近顺序分配。
- 预留空闲空间维持分配弹性。

![FFS first-fit block allocation](lec20_materials/ffs_first_fit_block_allocation.png)
![Rotational delay, skip-sector, and read-ahead](lec20_materials/rotational_delay_skip_sector_and_readahead.png)
![FFS pros and cons](lec20_materials/ffs_pros_and_cons.png)

:::remark 关键问题：为什么 FFS 要强调保留空闲空间（常见 10%+）？
**问题（原意复述）：为什么不把磁盘尽量写满？**

解答：
- 占用率过高会减少连续可用区间，碎片快速增长。
- 碎片会提高寻道次数并削弱顺序吞吐。
- 预留空间可保留“局部性友好”的布局选择。
:::

## 5. 硬链接、软链接与路径遍历

![Hard links and reference counting](lec20_materials/hard_links_reference_counting.png)

硬链接语义：

- `link()` 增加一个指向同一 inode 的目录项。
- `unlink()` 删除一个名字到 inode 的引用。
- 当链接计数归零（并满足运行时打开句柄语义）后，文件内容才可回收。

![Soft links (symbolic links)](lec20_materials/soft_links_symbolic_links.png)

软链接语义：

- 目录项保存目标路径字符串。
- 每次访问都要重新解析目标路径。
- 目标路径失效时，解析会失败。

![Directory traversal inode lookup flow](lec20_materials/directory_traversal_inode_lookup_flow.png)

路径解析示例（`/home/pkuos/stuff.txt`）：

1. 从根 inode 开始。
2. 读取目录数据块，查当前路径分量，得到下一层 inode 号。
3. 对每个分量重复此过程。
4. 打开最终 inode，并让文件描述符绑定其块映射。

:::error 关键问题：为什么一次 open 可能触发多次权限检查？
**问题（原意复述）：为什么不仅检查最终文件，还要检查路径中的目录？**

解答：
- 路径遍历本身就是对目录对象的访问。
- 任何中间目录缺少执行/搜索权限都可能阻断解析。
- 因此权限控制覆盖的是整条命名空间路径，而非仅叶子节点。
:::

## 6. 大目录优化：B-Tree / dirhash

目录项数量大时，线性扫描成本很高。

![Large directories B-tree intro](lec20_materials/large_directories_btree_intro.png)
![Large directories dirhash lookup](lec20_materials/large_directories_dirhash_lookup.png)

核心思路：

- 对目录名建立索引（B-tree/B+tree 风格哈希索引）。
- 将近线性的查找过程，转化为“索引遍历 + 叶节点定位”。
- 显著减少大目录场景中的磁盘访问次数。

## 7. 案例 D：NTFS（MFT + Extents）

NTFS 采用“元数据表中心化”设计。

![NTFS MFT and extents overview](lec20_materials/ntfs_mft_and_extents_overview.png)

**关键定义：** **Everything (almost) is a sequence of `<attribute:value>` pairs.**

围绕 MFT 的机制：

- 每个文件对应一个 MFT record（记录大小有上限）。
- 小文件数据可直接驻留在 MFT 记录（resident data）。
- 更大数据用 non-resident extents 表示。
- 极大或严重碎片文件可跨多个 MFT 记录串联元数据。

![NTFS small file resident data](lec20_materials/ntfs_small_file_resident_data.png)
![NTFS medium file extents](lec20_materials/ntfs_medium_file_extents.png)
![NTFS large file additional MFT records](lec20_materials/ntfs_large_file_additional_mft_records.png)
![NTFS huge fragmented file many records](lec20_materials/ntfs_huge_fragmented_file_many_records.png)

图中的 extent 运算关系：

$$
\text{Extent end} = \text{Start} + \text{Length}
$$

![NTFS directories and name attributes](lec20_materials/ntfs_directories_and_name_attributes.png)

NTFS 目录补充：

- 目录通常采用树形索引组织。
- 文件号标识其 MFT 项。
- 硬链接可体现为一个 MFT 项内多个 file-name attributes。

## 8. 统一比较与设计权衡

![File system summary 1](lec20_materials/file_system_summary_1.png)
![File system summary 2](lec20_materials/file_system_summary_2.png)

跨系统对比：

- FAT：链式分配简单，但在碎片化与大目录场景扩展性弱。
- inode/FFS：多级索引通用性强，叠加局部性布局后性能稳定，但依赖合理空闲空间策略。
- NTFS：属性驱动 + extent + 目录索引，适应多样文件规模与复杂元数据需求。

统一性能结论：

- 文件系统性能不只取决于介质速度。
- 更关键的是命名结构、索引深度、空闲空间管理与缓冲/预取机制的联动。

## 9. Exam Review

### 9.1 必背定义

- **File number / inumber**：文件元数据记录（如 inode）的索引标识。
- **Hard link**：多个名字指向同一 inode/对象。
- **Symbolic link**：保存“目标路径”的名字对象。
- **Extent**：由 `(start, length)` 描述的连续存储区间。
- **Block group（FFS）**：把数据、元数据与空闲管理共同组织的局部性单元。

### 9.2 机制检查点

- 能从到达/服务参数推导 `u`、`T_q`、`L_q`。
- 能计算 direct/indirect 多级容量。
- 能解释 block-group 为什么降低寻道。
- 能逐步追踪 pathname 到最终 inode。
- 能说明 NTFS 中 resident 与 non-resident 数据的差异。

### 9.3 简答模板

- “FFS 为什么要预留空闲空间？”：为了保持连续分配选择，抑制碎片，维持顺序性能。
- “硬链接下什么时候能删除文件内容？”：当引用计数语义允许回收且名字引用已消失。
- “软链接为什么脆弱？”：每次访问都依赖目标路径再次解析。
- “大目录为什么要索引？”：线性扫描的磁盘访问成本增长过快。

### 9.4 常见误区

- 误以为元数据布局与数据路径性能无关。
- 混淆硬链接（同 inode）与软链接（存路径）。
- 忽略路径中间目录的权限检查。
- 误以为“磁盘越满越好”。

### 9.5 自检清单

1. 你能用统一叙事比较 FAT、inode/FFS、NTFS 吗？
2. 你能从原理推导 48KB / 4MB / 4GB / 4TB 这些容量结论吗？
3. 你能用排队与局部性视角解释 SCAN/C-SCAN 与 FFS 布局选择吗？
4. 你能画出一次 pathname open 的元数据读取链路吗？
5. 你能解释 NTFS 如何分别处理小、中、大、超大碎片文件吗？
