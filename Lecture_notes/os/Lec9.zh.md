# 第 9 讲：调度 1 - 概念与经典策略

## 学习目标

学完本讲后，你应该能够：

1. 解释 CPU 调度在做什么决策，以及为什么“队列结构”是核心。
2. 比较调度目标：完成时间、吞吐量与公平性。
3. 用具体等待时间/完成时间计算分析 FCFS 与 RR。
4. 解释时间片大小如何影响响应性与调度开销。
5. 分析严格优先级调度中的饥饿与公平性取舍。
6. 解释 SJF/SRTF 的最优性，以及“无法预知未来运行时间”的现实限制。
7. 描述自适应 burst 预测、彩票调度和 MLFQ 的基本直觉。

## 1. 问题建模：调度到底在决定什么

调度器反复解决一个核心问题：

- 下一刻应该让哪个可运行线程占用 CPU？

![调度入口代码](lec09_materials/lecture_goal_scheduler_entrypoint.png)
![调度本质是队列管理](lec09_materials/scheduling_is_all_about_queues.png)

经典策略分析里常见的简化假设：

- 每个用户一个程序
- 每个程序一个线程
- 程序之间独立

![调度假设](lec09_materials/scheduling_assumptions.png)

:::remark 关键问题：公平是对用户还是对程序
**问题（课件原话）：Is "fair" about fairness among users or programs?**

解答：
- 这两种公平并不等价。
- 一个用户若提交更多作业，可能拿到更多总 CPU 份额。
- 不先定义“对谁公平”，就无法正确评价策略。
:::

## 2. 调度目标与天然冲突

核心目标有三类：

- 最小化完成时间（用户可感知延迟）。
- 最大化吞吐量（单位时间完成作业数）。
- 保持公平性。

![调度目标与准则](lec09_materials/scheduling_policy_goals.png)

这些目标往往彼此冲突：

- 过度追求平均完成时间，可能带来更高切换开销。
- 提高公平性通常会牺牲一部分平均完成时间。

## 3. FCFS：简单但强依赖到达顺序

FCFS（FIFO / 运行到阻塞）实现简单、易于理解，但短作业可能被长作业“堵头”。

![FCFS 堵头示例](lec09_materials/fcfs_example_head_of_line_blocking.png)

对顺序 `P1=24, P2=3, P3=3`：

$$
\text{Avg wait} = \frac{0+24+27}{3}=17
$$

$$
\text{Avg completion} = \frac{24+27+30}{3}=27
$$

若到达顺序改为 `P2, P3, P1`：

![FCFS 变更到达顺序](lec09_materials/fcfs_reordered_arrival_improvement.png)

$$
\text{Avg wait} = \frac{6+0+3}{3}=3
$$

$$
\text{Avg completion} = \frac{3+6+30}{3}=13
$$

:::warn 关键问题：FCFS 一定对短作业差吗
**问题（课件原意）：FCFS 是否总是对短作业不友好？**

解答：
- 不一定。
- FCFS 性能对到达顺序非常敏感。
- 它的问题不是“总错”，而是容易在不利负载下出现堵头。
:::

## 4. Round Robin（RR）：抢占与时间片

RR 给每个可运行进程一个时间片 `q`，用完就抢占并放到就绪队列尾部。

![RR 定义与边界](lec09_materials/round_robin_definition_and_bounds.png)

课件中的关键关系：

$$
\text{CPU share per process} = \frac{1}{n}
$$

$$
\text{max wait} \le (n-1)q
$$

时间片大小的一般规律：

- `q` 很大时接近 FCFS。
- `q` 太小时调度开销上升。

![RR 量子 20 示例页](lec09_materials/round_robin_quantum20_worked_example.png)
![RR 时间片取值讨论](lec09_materials/round_robin_time_slice_tradeoff.png)

以 `q=20`、`P1=53, P2=8, P3=68, P4=24` 为例：

$$
P_1=(68-20)+(112-88)=72
$$

$$
P_2=(20-0)=20,\quad
P_3=(28-0)+(88-48)+(125-108)=85,\quad
P_4=(48-0)+(108-68)=88
$$

$$
\text{Avg wait}= \frac{72+20+85+88}{4}=66\frac{1}{4}
$$

$$
\text{Avg completion}= \frac{125+28+153+112}{4}=104\frac{1}{2}
$$

![不同 q 的等待/完成统计表](lec09_materials/quantum_sweep_wait_and_completion_table.png)

课件的双作业时间片灵敏度示例：

![减小完成时间示例](lec09_materials/rr_quantum_can_reduce_completion_time.png)
![完成时间不变示例](lec09_materials/rr_quantum_same_completion_time_case.png)
![时间片过小反而变差](lec09_materials/rr_too_small_quantum_increase_completion_time.png)

$$
\frac{10+11}{2}=10.5,\quad \frac{6+11}{2}=8.5,\quad \frac{1+2}{2}=1.5,\quad \frac{1.5+2}{2}=1.75
$$

内核实现要点：

- 就绪队列可沿用 FIFO 结构。
- 通过定时器中断触发抢占。
- 队列更新和上下文切换边界必须严格同步。

![RR 内核实现思路](lec09_materials/rr_kernel_timer_interrupt_implementation.png)

:::remark 关键问题：时间片越小越好吗
**问题（课件原话）：Does a smaller quantum in RR always lead to better average completion time?**

解答：
- 不会。
- 更小时间片可能改善部分负载响应，但过小时会被开销吞噬，平均完成时间反而变差。
:::

:::remark 关键问题：RR 一定优于 FCFS 吗
**问题（课件原话）：Assuming zero-cost context switching, is RR always better than FCFS?**

解答：
- 不是。
- 在同长度作业批次中，RR 可能平均完成时间更差，尽管最终全部完成时刻相同。
:::

![同长度作业下 FCFS vs RR](lec09_materials/fcfs_vs_rr_same_length_jobs_comparison.png)

## 5. 严格优先级与公平性张力

严格优先级策略总是优先执行最高优先级的可运行作业。

![严格优先级调度与问题](lec09_materials/strict_priority_scheduling_and_issues.png)

主要风险：

- 低优先级作业饥饿。
- 锁竞争场景中的优先级反转。

公平性讨论要点：

![公平性与完成时间的权衡](lec09_materials/fairness_tradeoff_vs_completion_time.png)
![公平性的实现选项](lec09_materials/fairness_implementation_options.png)

结论是：

- 提高公平性通常以牺牲平均完成时间为代价。
- 例如 aging/动态优先级等方法可缓解问题，但在高负载下可能变成经验性规则堆叠。

## 6. SJF/SRTF：最优性与“预知未来”难题

若我们能知道未来服务时间：

- SJF 在非抢占策略中对平均完成时间最优。
- SRTF 在抢占策略中对平均完成时间最优。

![如果能预知未来](lec09_materials/sjf_srtf_if_we_knew_future.png)
![SRTF 最优性讨论](lec09_materials/srtf_optimality_discussion.png)

CPU-bound 与 I/O-bound 混合例子：

![SRTF 收益示例设定](lec09_materials/srtf_benefit_example_cpu_io_bound_jobs.png)
![SRTF 时间线与磁盘利用率](lec09_materials/srtf_example_disk_utilization_timeline.png)

课件标注：

$$
\frac{9}{201} \approx 4.5\%
$$

现实问题是：未来 burst 长度未知，纯 SRTF 可能导致饥饿，需要估计机制。

![SRTF 饥饿与预测限制](lec09_materials/srtf_starvation_and_prediction_limits.png)

### 6.1 下一次 CPU burst 的估计（自适应调度）

课件给出基于历史的估计：

![指数平滑预测 CPU burst](lec09_materials/next_cpu_burst_prediction_exponential_average.png)

$$
\tau_n = \alpha t_{n-1} + (1-\alpha)\tau_{n-1}, \quad 0<\alpha\le1
$$

:::tip 关键问题：既然难实现为什么还学 SRTF
**问题（课件原意）：未来难预测时，为什么还要深入学习 SRTF？**

解答：
- 它给出了平均完成时间的理论标杆。
- 现实策略可以用它作为“离最优还差多少”的比较基准。
:::

## 7. 彩票调度：概率化按份额分配

给每个作业分配彩票，时间片到来时随机抽中奖票。

![彩票调度核心思想](lec09_materials/lottery_scheduling_core_idea.png)

长期平均上，CPU 份额与票数份额成比例。

优点：

- 每个作业至少一张票时，可避免绝对饥饿。
- 作业增删时整体行为较平滑。

![彩票调度票数份额示例](lec09_materials/lottery_scheduling_ticket_share_example.png)

:::remark 关键问题：票数怎么分
**问题（课件原话）：How to assign tickets?**

解答：
- 票数本质上承载策略意图，例如偏向短作业。
- 但短作业过多时，单个作业推进仍可能很慢，因此还需结合负载控制。
:::

## 8. 多级反馈队列（MLFQ）

MLFQ 将多队列与动态升降级结合：

- 作业初始在高优先级。
- 多次用满时间片则降级。
- 频繁主动让出或短 burst 行为可保留高优先级或升回高层。

![MLFQ 总览](lec09_materials/mlfq_overview_and_promotion_demotion.png)

它的核心价值在于：

- 不依赖真实未来信息，通过“历史行为反馈”逼近 SJF/SRTF 效果。

## 9. Exam Review

### 9.1 必背定义

- **FCFS**：简单 FIFO，易出现堵头。
- **RR**：基于时间片 `q` 的抢占轮转。
- **严格优先级调度**：总是先运行最高优先级可运行任务。
- **SJF/SRTF**：按最短作业（剩余）优先，在相应假设下平均完成时间最优。
- **彩票调度**：随机抽签实现按份额 CPU 分配。
- **MLFQ**：用动态优先级与多队列反馈近似短作业优先。

### 9.2 高频简答模板

1. **为什么 RR 可能提升响应但降低平均完成时间？**  
   RR 能更快轮到交互短任务，但频繁抢占会增加开销，并在某些作业组合下拉高平均完成时间。
2. **为什么 SRTF 最优却不能直接全面落地？**  
   因为依赖剩余时间估计，估计误差与新作业到达会引发饥饿和不稳定行为。
3. **MLFQ 如何在不知道未来的情况下逼近 SRTF？**  
   通过观察历史 burst 行为，把疑似短交互任务留在高优先级，把长 CPU 密集任务逐步下放。

### 9.3 常见误区

- 认为单一目标（公平/吞吐/完成时间）可以无代价同时最优。
- 把“时间片越小越好”当作普遍规律。
- 忽略调度器本身同步与切换开销。
- 混淆优先级策略与份额策略的语义目标。

### 9.4 自检题

:::tip 自检 1
给出一个 RR 优于 FCFS 的负载，以及一个 RR 劣于 FCFS 的负载，并说明原因。
:::

:::tip 自检 2
解释指数平滑中 `\alpha` 变大或变小时，预测“响应速度”和“稳定性”各会如何变化。
:::

![课程总结页](lec09_materials/scheduling_policy_conclusion_summary.png)
