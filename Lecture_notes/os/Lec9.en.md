# Lecture 9: Scheduling 1 - Concepts and Classic Policies

## Learning Objectives

By the end of this lecture, you should be able to:

1. Explain what CPU scheduling decides and why queue structure matters.
2. Compare scheduling goals: completion time, throughput, and fairness.
3. Analyze FCFS and Round Robin with concrete waiting/completion calculations.
4. Explain how time quantum affects responsiveness and overhead.
5. Analyze strict-priority scheduling, starvation, and fairness trade-offs.
6. Explain SJF/SRTF optimality and practical limits caused by unknown future runtime.
7. Describe adaptive burst prediction, lottery scheduling, and MLFQ intuition.

## 1. Problem Framing: What Scheduling Actually Does

The scheduler repeatedly makes one core decision:

- Which runnable thread should run next on the CPU?

![Scheduler entry point](lec09_materials/lecture_goal_scheduler_entrypoint.png)
![Scheduling as queue management](lec09_materials/scheduling_is_all_about_queues.png)

Useful framing assumptions in classic policy analysis:

- One program per user
- One thread per program
- Programs independent

![Scheduling assumptions](lec09_materials/scheduling_assumptions.png)

:::remark Key Question: fairness for users or programs?
**Question (slide wording): Is "fair" about fairness among users or programs?**

Answer:
- The two notions are different.
- A user running many jobs may receive more total CPU than a user running one job.
- Fairness must be defined explicitly before choosing policy.
:::

## 2. Policy Goals and Why They Conflict

Core goals are:

- Minimize completion time (user-visible latency).
- Maximize throughput (jobs completed per unit time).
- Maintain fairness.

![Policy goals and criteria](lec09_materials/scheduling_policy_goals.png)

These objectives can conflict:

- Aggressively minimizing average completion time may increase context-switch overhead.
- Enforcing stronger fairness can hurt average completion time.

## 3. FCFS: Simple, but Sensitive to Arrival Order

FCFS (FIFO / run-until-block) is easy to implement and reason about, but short jobs can wait behind long ones.

![FCFS head-of-line blocking example](lec09_materials/fcfs_example_head_of_line_blocking.png)

For order `P1=24, P2=3, P3=3`:

$$
\text{Avg wait} = \frac{0+24+27}{3}=17
$$

$$
\text{Avg completion} = \frac{24+27+30}{3}=27
$$

If we reorder arrivals as `P2, P3, P1`:

![FCFS reordered arrival case](lec09_materials/fcfs_reordered_arrival_improvement.png)

$$
\text{Avg wait} = \frac{6+0+3}{3}=3
$$

$$
\text{Avg completion} = \frac{3+6+30}{3}=13
$$

:::warn Key Question: is FCFS "bad" by itself?
**Question (slide intent): Is FCFS always bad for short jobs?**

Answer:
- Not always; outcome depends heavily on arrival order.
- The policy is simple, but it has head-of-line blocking risk under unfavorable mixes.
:::

## 4. Round Robin (RR): Preemption and Time Quantum

RR gives each runnable process a time slice `q`, then preempts and rotates to the back of the ready queue.

![RR definition and bounds](lec09_materials/round_robin_definition_and_bounds.png)

From the slide:

$$
\text{CPU share per process} = \frac{1}{n}
$$

$$
\text{max wait} \le (n-1)q
$$

Quantum-size behavior:

- Large `q` approaches FCFS.
- Very small `q` increases scheduling overhead.

![RR quantum performance rule](lec09_materials/round_robin_quantum20_worked_example.png)
![RR time-slice tradeoff](lec09_materials/round_robin_time_slice_tradeoff.png)

Worked RR example (`q=20`) with `P1=53, P2=8, P3=68, P4=24`:

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

![Quantum sweep table](lec09_materials/quantum_sweep_wait_and_completion_table.png)

Two-job quantum sensitivity from slides:

![Decrease completion time case](lec09_materials/rr_quantum_can_reduce_completion_time.png)
![Same completion time case](lec09_materials/rr_quantum_same_completion_time_case.png)
![Increase completion time case](lec09_materials/rr_too_small_quantum_increase_completion_time.png)

$$
\frac{10+11}{2}=10.5,\quad \frac{6+11}{2}=8.5,\quad \frac{1+2}{2}=1.5,\quad \frac{1.5+2}{2}=1.75
$$

Kernel implementation idea:

- FIFO ready queue plus timer interrupt preemption.
- Correct synchronization around queue updates and context switch boundaries is mandatory.

![RR kernel implementation](lec09_materials/rr_kernel_timer_interrupt_implementation.png)

:::remark Key Question: is smaller quantum always better?
**Question (slide wording): Does a smaller quantum in RR always lead to better average completion time?**

Answer:
- No.
- Smaller quantum may improve response for some mixes, but too small quantum causes overhead and can worsen completion time.
:::

:::remark Key Question: is RR always better than FCFS?
**Question (slide wording): Assuming zero-cost context switching, is RR always better than FCFS?**

Answer:
- No.
- For equal-length job batches, RR can have worse average completion time while finishing at the same final time.
:::

![FCFS vs RR same-length comparison](lec09_materials/fcfs_vs_rr_same_length_jobs_comparison.png)

## 5. Strict Priority and Fairness Tension

Strict priority scheduling executes highest-priority runnable work first.

![Strict priority scheduling](lec09_materials/strict_priority_scheduling_and_issues.png)

Risks:

- Starvation of low-priority jobs.
- Priority inversion when lock ownership and priorities interact.

Fairness discussion:

![Fairness tradeoff](lec09_materials/fairness_tradeoff_vs_completion_time.png)
![Fairness implementation choices](lec09_materials/fairness_implementation_options.png)

Key takeaway:

- Better fairness usually costs average completion time.
- Heuristics such as aging/priorities can help but may become ad hoc under overload.

## 6. SJF/SRTF: Optimality and the Future-Knowledge Problem

If future service times were known:

- SJF is optimal among non-preemptive policies for average completion time.
- SRTF is optimal among preemptive policies.

![If we knew the future](lec09_materials/sjf_srtf_if_we_knew_future.png)
![SRTF optimality discussion](lec09_materials/srtf_optimality_discussion.png)

Illustrative CPU-bound + I/O-bound scenario:

![SRTF benefit setup](lec09_materials/srtf_benefit_example_cpu_io_bound_jobs.png)
![SRTF timeline and disk utilization](lec09_materials/srtf_example_disk_utilization_timeline.png)

Slide annotation:

$$
\frac{9}{201} \approx 4.5\%
$$

Practical issue: exact future burst length is unknown, so pure SRTF can cause starvation and needs estimation.

![SRTF limits and starvation](lec09_materials/srtf_starvation_and_prediction_limits.png)

### 6.1 Estimating next CPU burst (adaptive scheduling)

The lecture presents history-based estimation:

![Burst prediction via exponential averaging](lec09_materials/next_cpu_burst_prediction_exponential_average.png)

$$
\tau_n = \alpha t_{n-1} + (1-\alpha)\tau_{n-1}, \quad 0<\alpha\le1
$$

:::tip Key Question: why keep discussing SRTF if it is hard to implement?
**Question (slide intent): If future is hard to predict, why study SRTF deeply?**

Answer:
- It serves as an optimal yardstick for average completion time.
- Practical policies can be compared against this upper bound on performance quality.
:::

## 7. Lottery Scheduling: Probabilistic Proportional Share

Each job gets tickets; each slice randomly picks a winning ticket.

![Lottery scheduling idea](lec09_materials/lottery_scheduling_core_idea.png)

On average, CPU share is proportional to ticket share.

Benefits:

- Avoids absolute starvation when every job has at least one ticket.
- Graceful behavior when jobs are added/removed.

![Lottery ticket share example](lec09_materials/lottery_scheduling_ticket_share_example.png)

:::remark Key Question: how should tickets be assigned?
**Question (slide wording): How to assign tickets?**

Answer:
- Assignment reflects desired policy, such as favoring short jobs.
- But heavy short-job load can still make individual progress slow, so admission/load control still matters.
:::

## 8. Multi-Level Feedback Queue (MLFQ)

MLFQ combines multiple queues and dynamic promotion/demotion:

- Jobs start high.
- Use full quantum repeatedly -> move down.
- Yield/block quickly -> may stay high or move up.

![MLFQ overview](lec09_materials/mlfq_overview_and_promotion_demotion.png)

Interpretation:

- It tries to approximate SJF/SRTF behavior using observed runtime behavior instead of true future knowledge.

## 9. Exam Review

### 9.1 Must-know definitions

- **FCFS**: simple FIFO scheduling, susceptible to head-of-line blocking.
- **RR**: preemptive time slicing with quantum `q`.
- **Strict priority scheduling**: run highest-priority runnable jobs first.
- **SJF/SRTF**: shortest-job policies, optimal for average completion time under their respective assumptions.
- **Lottery scheduling**: proportional-share via randomized ticket draw.
- **MLFQ**: dynamic multi-queue scheduling using behavioral feedback.

### 9.2 High-value short-answer templates

1. **Why can RR beat FCFS on responsiveness but lose on completion time?**  
   RR reduces long waits for short interactive work, but frequent preemption and interleaving can increase overhead and average completion for some mixes.
2. **Why is SRTF optimal yet not universally deployed directly?**  
   It requires reliable remaining-time estimates, and poor estimates plus arrivals can cause starvation and instability.
3. **How does MLFQ approximate SRTF without future knowledge?**  
   It treats observed short bursts as interactive behavior and keeps such jobs at higher priority while demoting CPU-heavy jobs.

### 9.3 Common pitfalls

- Assuming one objective (fairness/throughput/completion) can be optimized without trade-off.
- Treating "smaller quantum" as always better.
- Ignoring synchronization costs in scheduler implementation.
- Confusing policy semantics (priority, proportional share, response-time goals).

### 9.4 Self-check

:::tip Self-check 1
Give one workload where RR improves completion time over FCFS, and one where it worsens it. Explain why.
:::

:::tip Self-check 2
Explain how changing `\alpha` in exponential averaging changes prediction stability versus responsiveness.
:::

![Lecture conclusion summary](lec09_materials/scheduling_policy_conclusion_summary.png)
