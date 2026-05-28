# 第 22 讲：事务化可靠性与分布式决策（2PC）

## 学习目标

学完本讲后，你应该能够：

1. 解释为什么可靠性不能只靠简单副本。
2. 对比 careful ordering、copy-on-write 与基于事务的恢复路径。
3. 说明 **transaction 是什么**，以及为什么 log commit 是原子边界。
4. 解释 journaling 在崩溃后的重放规则。
5. 说明分布式系统里的协议模型（syntax、semantics、state machine）。
6. 解释 Two Generals 悖论，以及 2PC 为什么转向“最终一致决策”。
7. 追踪 2PC 中 coordinator/worker 的状态转换与故障行为。
8. 分析 2PC 的 blocking 与 durability 代价。

## 1. 从谨慎写序到 Copy-on-Write

本讲先回顾文件系统可靠性的两条经典路线。

![careful ordering question](lec22_materials/careful_ordering_data_before_pointer_question.png)

**关键思路（careful ordering）：** 按安全顺序写入，使崩溃后结构仍可恢复。

![ffs create ordering](lec22_materials/ffs_create_file_ordering_sequence.png)

在 FFS 风格更新中，数据与元数据按顺序推进，崩溃后可以通过扫描完成或清理未完操作。

**关键思路（copy-on-write）：** 不做原地覆盖，构造新版本后切换指针。

![zfs openzfs cow](lec22_materials/zfs_openzfs_copy_on_write_design.png)

:::remark 关键问题：先写数据还是先写指针？
**问题（原意复述）：若“写数据”和“写目录项指针”各自都是原子操作，应先做哪一步？**

解答：
- 先写数据。
- 如果先写指针，崩溃发生在数据落盘前，命名空间会指向无效/未初始化内容。
- 数据先行能维持更安全的不变量：目录只指向有效数据。
:::

## 2. 事务：把多结构更新变成一个原子单元

**关键定义：** **A transaction is an atomic sequence of reads and writes that takes the system from one consistent state to another.**

![classic sql transaction](lec22_materials/classic_transaction_sql_example.png)

经典转账事务把多个更新绑定为“全做或全不做”：

```sql
BEGIN;
UPDATE accounts SET balance = balance - 100.00 WHERE name = 'Alice';
UPDATE branches SET balance = balance - 100.00 WHERE name = (SELECT branch_name FROM accounts WHERE name = 'Alice');
UPDATE accounts SET balance = balance + 100.00 WHERE name = 'Bob';
UPDATE branches SET balance = balance + 100.00 WHERE name = (SELECT branch_name FROM accounts WHERE name = 'Bob');
COMMIT;
```

![log concept](lec22_materials/log_as_atomic_append_for_commit.png)

log 的作用是把多步依赖动作收敛到一个可持久判定的提交点。

$$
\text{事务被视为已提交} \iff \text{commit 记录已持久化到日志}
$$

:::tip 关键问题：为什么日志能让原子性变得可实现？
**问题（原意复述）：为什么要用一次原子 append 来“封印”一串长操作？**

解答：
- 因为 commit 记录追加是最小可判定持久事件。
- 恢复时只需判断 commit 是否存在。
- 这避免了原地多块写入中“做到一半”的歧义。
:::

## 3. Journaling 文件系统与崩溃恢复

**关键定义：** **不要直接修改磁盘主结构；先把更新写成日志事务。**

![journaling idea](lec22_materials/journaling_file_system_core_idea.png)

![create with journaling](lec22_materials/create_file_with_journaling_steps.png)

提交后：
- 文件系统逻辑先看日志一致性视图，
- home location 可延后更新，
- 已提交日志最终会被重放到主结构。

![discard partial](lec22_materials/journal_recovery_discard_partial_transaction.png)

![replay complete](lec22_materials/journal_recovery_replay_complete_transaction.png)

恢复规则很清晰：
- 没有 commit 记录 => 丢弃未完成事务，
- 存在 commit 记录 => 重放（redo）到完成。

## 4. 分布式系统为什么需要协议

接着课程从单机持久化切到多机协同决策。

![distributed transparency](lec22_materials/distributed_system_transparency_dimensions.png)

**关键定义：** **协议是关于通信 syntax、semantics 与状态转移规则的约定。**

![protocol definition](lec22_materials/protocol_syntax_semantics_state_machine.png)

![send receive mailbox](lec22_materials/distributed_app_send_receive_mailbox_api.png)

课堂给出的编程抽象：
- 邮箱 `mbox` 作为目标队列，
- `Send(message, mbox)`，
- `Receive(buffer, mbox)`。

## 5. 一致性决策与 Two Generals 悖论

![consensus definition](lec22_materials/distributed_consensus_problem_definition.png)

一致性目标是：
- 多节点提出候选值，
- 允许部分节点失败，
- 未失败节点最终在候选集中达成同一决定。

![two generals paradox](lec22_materials/two_generals_paradox_unsolved_simultaneity.png)

**关键结论：** 在不可靠网络上，无法用有限确认链条保证“绝对同步行动”，因为最后一个确认本身也可能丢失。

:::warn 关键问题：Two Generals 无法解，系统还能做什么？
**问题（原意复述）：不能保证严格同一时刻动作时，能否改成“最终同一决定”？**

解答：
- 可以。把目标从“同时执行”改为“最终得出同一结论”。
- 2PC 正是在这个设计空间中工作的。
:::

## 6. 两阶段提交（2PC）的核心机制

![2pc phases](lec22_materials/two_phase_commit_prepare_and_commit_phases.png)

![2pc algorithm](lec22_materials/two_phase_commit_detailed_algorithm.png)

**关键定义（沿用课件措辞）：**
- **One coordinator, N workers (replicas).**
- **If all workers reply `VOTE-COMMIT`, coordinator sends `GLOBAL-COMMIT`; otherwise `GLOBAL-ABORT`.**
- **每台机器维护 persistent stable log，用于故障恢复。**

提交判定可写为：

$$
\text{commit} \iff \text{全体参与方一致同意}
$$

## 7. 状态机视角：Coordinator 与 Worker

![coordinator state machine](lec22_materials/two_phase_commit_coordinator_state_machine.png)

Coordinator 状态路径：
- 发送 `VOTE-REQ` 后 `INIT -> WAIT`。
- 收齐 `VOTE-COMMIT` 后 `WAIT -> COMMIT`。
- 任一 `VOTE-ABORT` 或超时则 `WAIT -> ABORT`。

![worker state machine](lec22_materials/two_phase_commit_worker_state_machine.png)

Worker 状态路径：
- 投 commit 票：`INIT -> READY`。
- 投 abort 票：`INIT -> ABORT`。
- 在 `READY` 等待全局决定：`READY -> COMMIT/ABORT`。

## 8. 故障处理与 Blocking 行为

![worker failure example](lec22_materials/two_phase_commit_worker_failure_timeout_abort.png)

Worker 失败处理：
- coordinator 在 `WAIT` 等票，
- 超时收不齐票时广播 `GLOBAL-ABORT`。

![coordinator failure blocking](lec22_materials/two_phase_commit_coordinator_failure_blocking_case.png)

Coordinator 失败更棘手：
- worker 一旦进入 `READY`，表示已承诺可提交，
- 不能单方面改成 abort，
- 必须等待 coordinator 恢复并给出最终决定。

![blocking discussion](lec22_materials/two_phase_commit_blocking_discussion.png)

:::error 关键问题：为什么说 2PC 是 blocking 协议？
**问题（原意复述）：coordinator 在 worker 进入 READY 后崩溃，会卡住什么？**

解答：
- READY worker 会持有锁等资源并等待最终决策。
- 它不能自行 abort，因为全局上可能已提交。
- 因此协议进展被 coordinator 恢复所阻塞。
:::

## 9. 分布式决策中的 Durability

![2pc durability](lec22_materials/two_phase_commit_durability_with_stable_storage.png)

**关键定义：** **stable storage 是保证原子写的非易失存储（如 SSD、带持久保证的 NVRAM 路径）。**

恢复原则：
- 先读本地日志，
- 还原节点状态，
- 从持久状态继续协议，而不是“从头猜测”。

这和 journaling 文件系统中的“log-first 再恢复”是同一思想在分布式场景下的延展。

## 10. 全讲主线总结

![summary](lec22_materials/lecture_summary_transactions_and_2pc.png)

本讲主线可以压缩为 5 句：

1. 可靠性不只是副本数量，还需要结构化提交语义。
2. 日志提供了多步更新的原子边界。
3. journaling 依赖“提交重放、未提交丢弃”完成崩溃恢复。
4. 分布式执行必须依赖显式协议与状态机。
5. 2PC 提供可持久的最终一致决策，但在 coordinator 故障下可能阻塞。

## 11. Exam Review

### A. 必背定义

- **Transaction**：把系统从一个一致状态原子地推进到另一个一致状态。
- **Journaling**：先写日志后更新主结构；提交重放，未提交丢弃。
- **Protocol**：syntax + semantics + state machine。
- **2PC**：先 prepare（投票），后 decision（全局提交/中止）。
- **Blocking（2PC）**：READY worker 可能等待 coordinator 恢复。

### B. 简答题模板

1. 为什么“日志先行、主结构后写”能提升崩溃安全？
- 因为先建立可判定的持久提交点，再异步落 home blocks，可避免半更新歧义。

2. 为什么 2PC 的 commit 必须全票通过？
- 因为分布式原子提交要求所有参与方都保证可完成提交。

3. 为什么 READY worker 不能自行 abort？
- 因为全局上可能已经 commit，单方 abort 会破坏原子性。

### C. 常见误区

- 把 durability 等同于完整 reliability。
- 误以为分布式提交等价于“同一时刻动作”。
- 忽略 READY 阶段阻塞对锁和内存资源的占用。

### D. 自检清单

- 你能不看图复述 `VOTE-REQ`、`VOTE-COMMIT`、`GLOBAL-COMMIT`、`GLOBAL-ABORT` 的转移吗？
- 你能解释为什么“未提交丢弃、已提交重放”足以恢复一致性吗？
- 你能用同一套“log-first”语言同时解释单机 journaling 与分布式 2PC 恢复吗？
