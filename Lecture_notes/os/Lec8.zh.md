# 第 8 讲：同步 4 - 读者/写者问题

## 学习目标

学完本讲后，你应该能够：

1. 解释读者/写者并发目标，以及为什么“整库一把粗粒度锁”并不理想。
2. 使用监视器状态变量（`AR`、`WR`、`AW`、`WW`）进行正确性推理。
3. 读懂并解释基于条件变量的读者/写者监视器实现。
4. 跟踪一次具体执行序列（`R1, R2, W1, R3`）并说明每一步阻塞/唤醒原因。
5. 分析饥饿与唤醒策略取舍（写者优先 vs 读者公平）。
6. 解释为什么条件变量不能被“直接等价替换”为信号量。
7. 将监视器思想映射到 C/C++/Python/Java 的语言机制。

## 1. 问题背景：为什么会有读者/写者问题

场景是一个共享数据库，存在两类用户：

- 读者（Reader）：只读操作。
- 写者（Writer）：读写并可能修改数据。

![读者/写者问题总览](lec08_materials/readers_writers_problem_overview.png)

目标策略是：

- 多个读者可以并行。
- 同一时刻最多一个写者。
- 活跃写者与任意读者不能重叠执行。

:::remark 关键问题：整库一把锁够不够
**问题（课件原话）：Is using a single lock on the whole database sufficient?**

解答：
- 用一把大锁在安全性上是正确的，但过于保守。
- 它会阻断本来可以并行的“读-读”访问。
- 读者/写者同步要做的是：在不破坏正确性的前提下提升读并发。
:::

## 2. 监视器状态与正确性约束

该监视器方案在一把互斥锁保护下维护四个计数器：

- `AR`：active readers（当前活跃读者数）
- `WR`：waiting readers（等待中的读者数）
- `AW`：active writers（当前活跃写者数）
- `WW`：waiting writers（等待中的写者数）

并使用两个条件变量：

- `okToRead`
- `okToWrite`

![约束与状态变量](lec08_materials/readers_writers_constraints_and_state.png)

代码中的关键判定表达式：

$$
(AW + WW) > 0
$$

$$
(AW + AR) > 0
$$

含义是：

- 读者在“有活跃写者或有等待写者”时必须等待。
- 写者在“有活跃读者或活跃写者”时必须等待。

## 3. Reader/Writer 监视器代码主线

### 3.1 Reader 路径

![Reader 入口与退出代码](lec08_materials/reader_entry_exit_code.png)

核心流程：

1. 进入监视器，先加锁并检查读入场条件。
2. 若不安全，先 `WR++`，在 `okToRead` 上睡眠，被唤醒后 `WR--`。
3. 可入场后 `AR++`，释放锁。
4. 在监视器锁外执行只读数据库访问。
5. 退出时 `AR--`；若自己是最后一个读者且有等待写者，则唤醒一个写者。

Reader 退出时的关键唤醒条件：

$$
AR = 0 \land WW > 0
$$

### 3.2 Writer 路径

![Writer 入口与退出代码](lec08_materials/writer_entry_exit_code.png)

核心流程：

1. 进入监视器后先加锁并检查写入场条件。
2. 若不安全，先 `WW++`，在 `okToWrite` 上睡眠，被唤醒后 `WW--`。
3. 可入场后 `AW++`，释放锁并执行读写访问。
4. 退出时 `AW--`，再决定唤醒对象：
  - 若 `WW > 0`，优先唤醒一个写者（写者优先策略）。
  - 否则若 `WR > 0`，广播唤醒读者。

$$
WW > 0
$$

$$
WR > 0
$$

:::tip 关键问题：为什么 Reader 要看等待写者
**问题（代码原意）：为什么 Reader 入口判断 `AW + WW`，而不只判断 `AW`？**

解答：
- 判断 `WW` 是为了体现“写者优先”。
- 如果只看 `AW`，持续到来的新读者可能让等待写者长期得不到执行机会。
:::

## 4. 仿真：序列 R1, R2, W1, R3

![仿真序列与初始状态](lec08_materials/simulation_sequence_initial_state.png)

课件给出的交错序列是：

1. `R1` 入场并开始读（`AR=1`）。
2. `R2` 也入场并并发读（`AR=2`）。
3. `W1` 到达，条件不满足，在 `okToWrite` 上睡眠（`WW=1`）。
4. `R3` 到达，因为 `WW>0` 也被阻塞，在 `okToRead` 上睡眠（`WR=1`）。

![写者等待时新读者被阻塞](lec08_materials/simulation_reader_blocks_when_writer_waits.png)

随后发生退出与唤醒：

5. `R2` 先退出；它不是最后一个读者，因此暂不唤醒写者。
6. `R1` 再退出；此时 `AR` 变为 0 且有等待写者，于是唤醒 `W1`。

![最后一个读者唤醒写者](lec08_materials/simulation_last_reader_wakes_writer.png)

写者完成后：

7. `W1` 退出；若没有更多等待写者而有等待读者，则读者被唤醒。
8. `R3` 最终恢复执行并完成读操作。

![写者完成后读者恢复](lec08_materials/simulation_writer_then_reader_unblock.png)

状态元组记法可写作：

$$
(AR, WR, AW, WW)
$$

:::remark 关键问题：这个仿真到底证明了什么
**问题（课件原意）：这段仿真除了互斥安全性，还验证了什么？**

解答：
- 它验证的是“策略行为”，不仅仅是“不会并发写冲突”。
- 该实现在写者排队时会阻止新读者进入，体现写者优先。
- 同时它验证了计数器与唤醒决策之间的一致性。
:::

## 5. 讨论：饥饿与单条件变量方案

![讨论问题页](lec08_materials/discussion_starvation_and_single_cv_questions.png)

几个关键讨论点：

1. 读者会不会饥饿？
  - 会。若严格写者优先且写者持续到来，读者可能等待很久。
2. Reader 退出时为什么保留 `if (AR==0 && WW>0)`？
  - 去掉该判断会导致错误或冗余唤醒。
3. 若把两个条件变量合并成一个 `okContinue` 会怎样？
  - 可以做对，但通常需要 `broadcast`，会带来额外唤醒和效率损失。

![单条件变量设计](lec08_materials/single_condition_variable_okcontinue_design.png)

:::warn 关键问题：一个 CV 能否替代两个 CV
**问题（课件原话）：What if we turn `okToWrite` and `okToRead` into `okContinue`?**

解答：
- 通过谨慎条件检查，仍然可以保证正确性。
- 但唤醒会变粗粒度，读者/写者都可能被频繁“无效唤醒”。
- 两个 CV 的意图更清晰，也更容易减少无效调度。
:::

## 6. 能否用信号量直接构造监视器

![朴素构造失败](lec08_materials/naive_monitor_from_semaphore_fails.png)

朴素尝试：

- `Wait(sema){ P(sema); }`
- `Signal(sema){ V(sema); }`

不能正确表达监视器条件语义。

原因：

- 条件变量没有历史记忆。
- 信号量有累积历史。
- 对 CV 而言，“无人等待时的 signal”是 no-op；而信号量 `V` 会累积计数。

即使改成“先释放锁，再 `P`，醒来再加锁”，仍有竞态窗口。

![信号量仿真中的竞态](lec08_materials/semaphore_construction_race_condition.png)

:::error 关键问题：检查 semaphore 队列是否为空就行吗
**问题（课件原话）：Does checking whether semaphore queue is empty fix it?**

解答：
- 不行。一般 API 抽象下不应依赖队列内部可见性。
- 更关键是：释放锁与真正睡眠之间仍可能被 signaler 插入，造成竞态。
- 严格正确的构造不是不可能，但会比朴素翻译复杂得多。
:::

## 7. 监视器模式与语言级支持

### 7.1 Mesa 监视器编程模板

![Mesa 监视器模板](lec08_materials/mesa_monitor_program_template.png)

经典结构是：

1. 持锁进入。
2. `while (need_to_wait) condvar.wait();`
3. 释放锁，执行监视器外工作。
4. 重新加锁，更新状态，`signal/broadcast`，再释放锁。

### 7.2 C：所有退出路径都要释放锁

![C 的非本地跳转风险](lec08_materials/c_nonlocal_exit_lock_risk.png)
![C 多把锁的错误路径](lec08_materials/c_multiple_locks_error_paths.png)

在 C 里，锁正确性本质上是控制流纪律：

- 每条 return/error 路径都必须释放全部已持有锁。
- `setjmp/longjmp` 这类非本地跳转可能绕过原本的释放路径。

### 7.3 C++：异常与 RAII

![C++ try/catch 释放模式](lec08_materials/cpp_try_catch_release_and_rethrow.png)
![C++ lock_guard RAII](lec08_materials/cpp_lock_guard_raii.png)

在异常路径较多时：

- 手写 `try/catch/rethrow` 可行，但冗长且易漏。
- RAII（`std::lock_guard`）更稳健：离开作用域自动释放锁。

### 7.4 Python 与 Java 的监视器支持

![Python with lock 上下文管理](lec08_materials/python_with_lock_context_manager.png)
![Java synchronized 方法](lec08_materials/java_synchronized_methods.png)
![Java wait/notify 监视器操作](lec08_materials/java_monitor_wait_notify.png)

语言层面的典型机制：

- Python `with lock:` 自动配对 acquire/release。
- Java `synchronized` 将锁生命周期绑定到方法/代码块作用域。
- Java 对象提供 monitor 风格的 wait/notify API。

## 8. 超越单机：Chubby 分布式锁案例

![Chubby 分布式锁服务](lec08_materials/chubby_distributed_lock_service.png)

课程最后提到分布式锁服务设计：

- 面向松耦合分布式系统的粗粒度同步。
- 可用性/可靠性与 API 设计和语义同样重要。
- 常见开源对应物包括 ZooKeeper、etcd 一类协调服务。

## 9. Exam Review

### 9.1 必背定义

- **读者/写者策略**：允许读并行、写互斥，并禁止读写重叠。
- **写者优先变体**：有写者排队时阻止新读者进入。
- **监视器**：锁 + 条件变量，且状态转移受锁保护。

### 9.2 高频简答模板

1. **为什么 Reader 要检查 `AW + WW > 0`？**  
   为了实现写者优先，避免在持续读流量下写者长期等待。
2. **为什么不能把条件变量直接换成信号量？**  
   因为 CV 的唤醒语义不保留历史，且依赖监视器锁内不变量；`P/V` 的历史语义不同。
3. **为什么 RAII 对并发系统代码很重要？**  
   因为它能显著减少异常/早返回路径下的漏解锁风险。

### 9.3 常见误区

- 在条件等待处写 `if` 而不是 `while`。
- 在 `cond_wait` 前后忘记维护等待计数。
- 错误路径/异常路径遗漏 unlock。
- 没有明确同步策略目标（公平性 vs 吞吐）就随意改唤醒规则。

### 9.4 自检题

:::tip 自检 1
给定序列 `R1, R2, W1, R3`，你能否准确解释为什么 `R3` 必须在 `W1` 前被阻塞？
:::

:::tip 自检 2
若从两个条件变量（`okToRead`, `okToWrite`）改成一个（`okContinue`），会产生哪些额外唤醒，为什么？
:::

![课程结论页](lec08_materials/lecture_conclusion_monitors_readers_writers.png)
