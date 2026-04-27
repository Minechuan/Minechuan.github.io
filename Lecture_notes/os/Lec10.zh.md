# 第 10 讲：调度 2——案例、公平性、实时性与前向进展

## 学习目标

学完本讲后，你应该能够：

1. 解释为什么单一调度策略通常无法覆盖所有工作负载与平台。
2. 区分吞吐量、完成时间、公平性、截止期保证这几类不同目标。
3. 解释为什么 Round Robin 在硬实时场景下会失败，以及 EDF 如何解决。
4. 用具体执行过程分析饥饿、优先级反转与优先级捐赠。
5. 从策略与实现两层比较 Linux O(1)、彩票调度与 Linux CFS。
6. 根据系统目标选择调度器，并用合适方法评估权衡。

## 1. 快速回顾：我们已经掌握了什么

上一讲给出了核心策略工具箱：

- FCFS：实现简单，在部分场景吞吐高，但会伤害短作业。
- RR：等待有上界、交互性更好，但可能增加开销。
- 严格优先级：可优先关键任务，但可能饿死低优先级任务。
- SJF/SRTF：若已知未来服务需求，可优化平均完成时间。
- 彩票调度/MLFQ：工程上常用来折中公平性与响应性。

本讲继续用到 RR 的一个上界关系：

$$
W_{\max} \le (N-1)Q
$$

:::remark 关键问题：一种策略能覆盖所有机器类型吗？
**问题（课件原句）：Should you schedule the set of apps identically on servers, workstations, pads, and cellphones?**

解答：
- 通常不能。
- 不同设备关注的目标不同（延迟、吞吐、能耗、可预测性）。
- 调度策略必须服务部署场景，而不是只追求算法形式统一。
:::

## 2. 混合负载与分类陷阱

真实系统常常把交互型、批处理型、服务型任务混在一起运行。

![混合负载调度问题](lec10_materials/scheduling_mixed_workload_questions.png)

许多调度器的常见启发式：

- burst 短且经常 sleep 的任务，视为交互型。
- burst 长的任务，视为计算密集型。

困难在于：

- 应用会发生阶段变化。
- 应用自报类型不一定可靠。
- 同一个应用在手机与服务器上可能需要不同策略。

:::warn 关键问题：只看 burst 时间足够吗？
**问题（课件原意）：Is burst-time observation alone sufficient to decide who should get CPU next?**

解答：
- 不可靠。
- burst 行为有价值，但信息不完整；阶段变化与混合行为会破坏简单规则。
- 健壮的调度器要把启发式与“防饥饿/防钻空子”机制结合起来。
:::

## 3. 多核调度与同步副作用

在多核系统里，调度不仅是策略问题，也是数据结构和同步工程问题。

- 每核 run queue 更利于扩展性。
- 亲和性（affinity）可复用缓存，减少迁移损失。
- gang scheduling 可降低并行程序中无效自旋等待。
- 现代系统主要调度线程；进程切换还会引入地址空间切换成本。

这时锁实现会直接影响调度效果：

![自旋锁与 test-and-test-and-set](lec10_materials/spinlock_and_test_test_set.png)

- `test&set` 自旋属于忙等（不会睡眠）。
- 临界区很短时，自旋可能优于 sleep/wakeup。
- 朴素自旋会反复写缓存行，导致 cache ping-pong。
- `test-and-test-and-set` 通过先读后写降低一致性流量。

:::remark 关键问题：什么时候自旋优于阻塞？
**问题（课件原意）：When might busy waiting be better than sleeping?**

解答：
- 锁持有时间极短时。
- 线程很快会恢复运行时（例如 barrier 协调）。
- 否则通常阻塞更省 CPU。
:::

## 4. 实时调度：为什么 EDF 关键

硬实时系统关心的是最坏情况可预测性，而不只是平均性能。

课件中的任务模型：

![实时负载特征](lec10_materials/realtime_workload_characteristics.png)

- 周期任务模型：任务 \(i\) 记作 \((P_i, C_i)\)。
- 关键是持续满足截止期。

RR 在该类场景可能错过 deadline：

![Round Robin 错过截止期示例](lec10_materials/round_robin_missed_deadline_example.png)

EDF（Earliest Deadline First）按“绝对截止期最近”动态赋优先级：

![EDF 规则](lec10_materials/earliest_deadline_first_rule.png)

$$
D_i^{t+1} = D_i^t + P_i
$$

课件给出的可调度条件：

![EDF 可行性条件](lec10_materials/edf_feasibility_condition.png)

$$
\sum_{i=1}^{n} \left(\frac{C_i}{D_i}\right) \le 1
$$

课件示例：

$$
\frac{1}{4} + \frac{2}{5} + \frac{2}{7} = 0.936 \le 1
$$

:::tip 关键问题：为什么 RR 会失败而 EDF 可行？
**问题（课件原意）：Why doesn’t Round Robin work for strict deadline-driven workloads?**

解答：
- RR 保证的是轮转公平，不是截止期紧迫性。
- EDF 直接按 deadline 紧迫程度调度，目标与实时需求一致。
:::

## 5. 保证前向进展：跨策略看饥饿

先区分两个概念：

- 饥饿（starvation）：任务长期得不到进展。
- 死锁（deadlock）：循环等待资源。

课件对多类策略做了对比：

- 非 work-conserving 设计会直接导致饥饿。
- LCFS 在持续高到达率下会饿死早到任务。
- FCFS 若非抢占且任务不让出，会阻塞全局进展。
- RR 对等待时间公平性较强。
- 严格优先级容易饿死低优先级任务。

核心结论：

- 进展保证依赖“可抢占性 + 策略保护机制”。
- 等待时间公平不等于吞吐公平。

## 6. 优先级反转与优先级捐赠

优先级反转：高优先级任务被低优先级锁持有者阻塞，中优先级任务却持续运行。

![优先级反转核心问题](lec10_materials/priority_inversion_core_problem.png)

这会让高优先级任务“名义上高优先级，实际上没法前进”。

优先级捐赠/继承机制：

![优先级捐赠机制](lec10_materials/priority_donation_mechanism.png)

- 临时提升锁持有者优先级，使其尽快释放锁。
- 释放锁后恢复正常优先级关系。

课件案例：

![火星探路者优先级反转案例](lec10_materials/martian_pathfinder_priority_inversion_case.png)

- 1997 年火星探路者出现系统重启。
- 根因是优先级反转；重新启用优先级继承后恢复正常。

:::warn 关键问题：为了省开销能否关闭捐赠？
**问题（案例原意）：Is the runtime overhead of donation worth it?**

解答：
- 对安全关键或强实时系统，值得。
- 没有捐赠时，低概率锁交互也可能触发灾难性时序故障。
:::

## 7. Unix nice 与 Linux O(1)：工程化优先级调度

随着负载类型演化，工业内核在教材算法之外加入了大量工程机制。

Linux O(1) 调度器要点：

![Linux O(1) 调度结构](lec10_materials/linux_o1_scheduler_structure.png)
![Linux O(1) 启发式](lec10_materials/linux_o1_scheduler_heuristics.png)

- 总计 140 个优先级。
- 用户任务（受 `nice` 影响）与实时/内核任务区间分离。
- 通过 active/expired 双队列与 bitmap 实现 O(1) 选择。
- 用多种启发式奖励交互任务、缓解饥饿。

课件中的代表性启发式：

$$
P\to sleep\_avg = (sleep\_time - run\_time) \times coefficient
$$

含义：

- `sleep_avg` 越高，越倾向于 I/O/交互型。
- 调度器会给予更积极的优先级奖励。

## 8. 从按份额调度到 CFS

彩票调度给出“概率意义上的按份额共享”：

$$
N_{ticket} = \sum N_i
$$

- 在 \([1, N_{ticket}]\) 内随机取一个 dart。
- 选累计票数首次超过 dart 的任务。

Linux CFS 把公平性转化为可计算运行时指标：

![Linux CFS 公平性直觉](lec10_materials/linux_cfs_fairness_intuition.png)

$$
\text{execution rate} = \frac{1}{N}
$$

响应性约束（target latency）：

![Linux CFS 目标延迟](lec10_materials/linux_cfs_target_latency.png)

$$
Q = \frac{\text{Target Latency}}{n}
$$

CFS 的按权重分片：

![Linux CFS 按权重分配公式](lec10_materials/linux_cfs_weighted_share_formula.png)

$$
Q_i = \text{Target Latency} \cdot \frac{1}{N}
$$

$$
Q_i = \left(\frac{w_i}{\sum_p w_p}\right) \cdot \text{Target Latency}
$$

nice 到权重映射：

$$
\text{Weight} = \frac{1024}{(1.25)^{\text{nice}}}
$$

$$
(1.25)^5 \approx 3
$$

含义：

- nice 相差 5，大约对应 3 倍权重差。
- CFS 由此实现“公平为主、可控偏置”。

:::remark 关键问题：为什么 CFS 还要最小时间片？
**问题（课件原意）：If Target Latency enforces fairness, why add a minimum slice length?**

解答：
- 仅按目标延迟切分会在高并发下产生过小时间片。
- 最小粒度用于抑制上下文切换开销，守住吞吐。
:::

## 9. 如何选调度器、如何评估

课件给出了“目标 -> 策略”的经验映射：

![调度目标到策略映射](lec10_materials/scheduler_goal_to_policy_mapping.png)

常见选择：

- CPU 吞吐 -> FCFS。
- 平均完成时间 -> SRTF 近似。
- I/O 吞吐 -> SRTF 近似。
- CPU 时间公平 -> Linux CFS。
- 等待时间公平 -> Round Robin。
- 截止期满足 -> EDF。
- 关键任务优先 -> Priority Scheduling。

评估方法应组合使用：

- 确定性建模（固定负载）。
- 排队论分析（随机到达）。
- 实现/仿真测量（真实轨迹）。

## 10. 容量规划启示：调度不是万能药

当系统接近满载时，仅靠策略细节通常无法挽救响应时间。

![利用率-响应时间拐点曲线](lec10_materials/utilization_response_time_knee_curve.png)

关键结论：

- 利用率逼近 100% 时，响应时间常出现陡升。
- 应在拐点前扩容，而不是崩溃后补救。
- 很多调度器在线性区表现接近，但在过载区差异巨大。

## 11. Exam Review

### 11.1 必会定义

- **Starvation（饥饿）**：任务长期无法取得进展。
- **Priority Inversion（优先级反转）**：高优任务被低优锁持有者阻塞。
- **Priority Donation/Inheritance（优先级捐赠/继承）**：临时提升锁持有者优先级。
- **EDF**：按最早截止期动态赋优先级的实时调度。
- **CFS**：近似理想多任务处理器的公平份额调度器。

### 11.2 高价值简答模板

1. **为什么 RR 可以“公平”却不适合硬实时？**  
   RR 保证轮转公平，但不区分截止期紧迫程度；EDF 直接按 deadline 紧迫性调度。
2. **为什么 Linux 从 O(1) 式启发式逐步走向 CFS 式公平度量？**  
   启发式容易变成经验堆叠；CFS 提供更统一的公平目标与可调约束。
3. **优先级捐赠如何保护前向进展？**  
   它让锁持有者尽快运行并释放锁，从而解除高优先级等待者阻塞。

### 11.3 常见误区

- 误以为一种公平性就代表所有指标都公平。
- 分析调度正确性时忽略锁交互。
- 把“短 burst”简单等同于“交互型”。
- 认为只改调度策略就能解决资源过载。

### 11.4 自检

:::tip 自检 1
给定一个目标（吞吐、平均完成时间、截止期保证、等待公平），选择一种调度器并说明一个代价。
:::

:::tip 自检 2
构造一个优先级反转场景，并说明优先级捐赠如何改变执行顺序。
:::

:::tip 自检 3
解释在 CFS 中 `Target Latency`、`Minimum Granularity`、权重三者如何共同影响响应性与吞吐。
:::
