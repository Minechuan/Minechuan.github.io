# Lecture 22: Reliability with Transactions and Distributed Decision Making (2PC)

## Learning Objectives

By the end of this lecture, you should be able to:

1. Explain why reliability needs more than simple replication.
2. Compare careful ordering, copy-on-write, and transaction-based recovery.
3. Explain **what a transaction is** and why log commit is the atomic boundary.
4. Describe journaling replay rules after crash.
5. Explain the protocol model (syntax, semantics, state machine) for distributed systems.
6. Explain the Two Generals paradox and why 2PC targets eventual agreement.
7. Trace 2PC coordinator/worker state transitions and failure behavior.
8. Analyze blocking and durability trade-offs in 2PC.

## 1. From Careful Ordering to Copy-on-Write

The lecture begins by revisiting two classic file-system reliability approaches.

![careful ordering question](lec22_materials/careful_ordering_data_before_pointer_question.png)

**Key idea (careful ordering):** write operations in a safe order so crash leaves recoverable structure.

![ffs create ordering](lec22_materials/ffs_create_file_ordering_sequence.png)

For FFS-style updates, data and metadata are sequenced so post-crash scan can finish or clean up partially completed work.

**Key idea (copy-on-write):** avoid in-place overwrite; build a new version and switch pointers.

![zfs openzfs cow](lec22_materials/zfs_openzfs_copy_on_write_design.png)

:::remark Key Question: Data first or pointer first?
**Question (original intent): Assume writing data and directory pointer are both atomic. Which should be written first?**

Answer:
- Write data first.
- If pointer is written first and crash happens before data write, namespace may reference invalid/uninitialized content.
- Data-first preserves a safer invariant: namespace only points to valid data.
:::

## 2. Transactions as Atomic Multi-Structure Updates

**Key definition:** **A transaction is an atomic sequence of reads and writes that takes the system from one consistent state to another.**

![classic sql transaction](lec22_materials/classic_transaction_sql_example.png)

A classic transfer transaction groups multiple updates into one all-or-nothing unit:

```sql
BEGIN;
UPDATE accounts SET balance = balance - 100.00 WHERE name = 'Alice';
UPDATE branches SET balance = balance - 100.00 WHERE name = (SELECT branch_name FROM accounts WHERE name = 'Alice');
UPDATE accounts SET balance = balance + 100.00 WHERE name = 'Bob';
UPDATE branches SET balance = balance + 100.00 WHERE name = (SELECT branch_name FROM accounts WHERE name = 'Bob');
COMMIT;
```

![log concept](lec22_materials/log_as_atomic_append_for_commit.png)

A log turns many dependent actions into one durable commitment point.

$$
\text{Transaction visible as committed} \iff \text{commit record is durable in log}
$$

:::tip Key Question: Why does logging make atomicity practical?
**Question (original intent): Why use one atomic append to represent commitment of a long action sequence?**

Answer:
- Because the append of commit record is the minimal durable event.
- Recovery only checks whether commit exists.
- This avoids ambiguity from partially applied in-place writes.
:::

## 3. Journaling File Systems and Crash Recovery

**Key definition:** **Don’t modify on-disk structures directly; write updates as log transactions first.**

![journaling idea](lec22_materials/journaling_file_system_core_idea.png)

![create with journaling](lec22_materials/create_file_with_journaling_steps.png)

After commit:
- file-system operations consult log-aware state,
- on-disk home locations can be updated later,
- committed log records are replayed eventually.

![discard partial](lec22_materials/journal_recovery_discard_partial_transaction.png)

![replay complete](lec22_materials/journal_recovery_replay_complete_transaction.png)

Recovery rule is simple:
- no commit record => discard partial transaction,
- commit record exists => replay (redo) to completion.

## 4. Distributed Systems Need Protocols

The lecture then shifts from single-machine persistence to multi-machine coordination.

![distributed transparency](lec22_materials/distributed_system_transparency_dimensions.png)

**Key definition:** **A protocol is an agreement on communication syntax, semantics, and allowed state transitions.**

![protocol definition](lec22_materials/protocol_syntax_semantics_state_machine.png)

![send receive mailbox](lec22_materials/distributed_app_send_receive_mailbox_api.png)

Practical abstraction shown in class:
- mailbox `mbox` as destination queue,
- `Send(message, mbox)`,
- `Receive(buffer, mbox)`.

## 5. Consensus and the Two Generals Paradox

![consensus definition](lec22_materials/distributed_consensus_problem_definition.png)

Consensus target:
- nodes propose values,
- some may fail,
- non-failed nodes eventually decide the same value from proposed values.

![two generals paradox](lec22_materials/two_generals_paradox_unsolved_simultaneity.png)

**Key statement:** unreliable messaging cannot guarantee simultaneous action with absolute certainty, because the final acknowledgement itself can be lost.

:::warn Key Question: If Two Generals is impossible, what can we still solve?
**Question (original intent): Can we replace strict simultaneity with eventual agreement?**

Answer:
- Yes. Instead of "act at exactly same time," require "all parties eventually decide the same outcome."
- This is exactly the design space where 2PC is useful.
:::

## 6. Two-Phase Commit (2PC): Core Mechanism

![2pc phases](lec22_materials/two_phase_commit_prepare_and_commit_phases.png)

![2pc algorithm](lec22_materials/two_phase_commit_detailed_algorithm.png)

**Key definitions (slide wording):**
- **One coordinator, N workers (replicas).**
- **If all workers reply `VOTE-COMMIT`, coordinator sends `GLOBAL-COMMIT`; otherwise `GLOBAL-ABORT`.**
- **Persistent stable log on each machine tracks progress and supports recovery.**

Commit criterion can be written as:

$$
\text{commit} \iff \text{unanimous approval}
$$

## 7. State Machines: Coordinator and Workers

![coordinator state machine](lec22_materials/two_phase_commit_coordinator_state_machine.png)

Coordinator path:
- `INIT -> WAIT` after sending `VOTE-REQ`.
- `WAIT -> COMMIT` if all `VOTE-COMMIT`.
- `WAIT -> ABORT` if any `VOTE-ABORT` or timeout.

![worker state machine](lec22_materials/two_phase_commit_worker_state_machine.png)

Worker path:
- `INIT -> READY` when voting commit.
- `INIT -> ABORT` when voting abort.
- `READY -> COMMIT/ABORT` after global decision message.

## 8. Failures and Blocking Behavior

![worker failure example](lec22_materials/two_phase_commit_worker_failure_timeout_abort.png)

Worker failure handling:
- coordinator waits in `WAIT` for votes,
- missing vote until timeout => coordinator broadcasts `GLOBAL-ABORT`.

![coordinator failure blocking](lec22_materials/two_phase_commit_coordinator_failure_blocking_case.png)

Coordinator failure is harder:
- workers in `READY` may already have promised commit,
- they cannot unilaterally abort,
- they must block until coordinator recovers and reveals decision.

![blocking discussion](lec22_materials/two_phase_commit_blocking_discussion.png)

:::error Key Question: Why is 2PC called a blocking protocol?
**Question (original intent): What stalls when coordinator fails after workers enter READY?**

Answer:
- READY workers hold locks/resources while waiting for final decision.
- They cannot safely choose abort by themselves because commit might already be decided elsewhere.
- So progress is blocked by coordinator recovery.
:::

## 9. Durability in Distributed Decision

![2pc durability](lec22_materials/two_phase_commit_durability_with_stable_storage.png)

**Key definition:** **Stable storage is non-volatile storage that guarantees atomic writes (e.g., SSD, NVRAM-backed durable media path).**

Recovery principle:
- read local log first,
- restore node state,
- continue protocol from durable state rather than from scratch.

This is the distributed version of the same log-first idea used in journaling file systems.

## 10. End-to-End Summary

![summary](lec22_materials/lecture_summary_transactions_and_2pc.png)

Main thread of this lecture:

1. Reliability requires structured commit logic, not just extra copies.
2. Logs provide the atomic boundary for multi-step updates.
3. Journaling uses log replay to recover from partial progress.
4. Distributed execution needs explicit protocols and state machines.
5. 2PC provides eventual agreement with durability, but may block under coordinator failure.

## 11. Exam Review

### A. Must-know Definitions

- **Transaction**: atomic sequence from consistent state to consistent state.
- **Journaling**: log-first persistence; replay committed records; discard partials.
- **Protocol**: syntax + semantics + state machine.
- **2PC**: prepare (vote) then decide (global commit/abort).
- **Blocking (2PC)**: READY worker may wait indefinitely for coordinator recovery.

### B. Short-Answer Templates

1. Why does log-before-home-write improve crash safety?
- It creates a durable commit point before exposing partially updated home blocks.

2. Why does 2PC need unanimous commit votes?
- Because atomic distributed commit requires all participants to guarantee readiness.

3. Why can’t READY worker unilaterally abort?
- It may violate global atomicity if coordinator already committed elsewhere.

### C. Common Pitfalls

- Confusing durability with full reliability.
- Assuming distributed commit means simultaneity.
- Ignoring the resource cost of blocking in READY state.

### D. Self-Check Checklist

- Can you explain `VOTE-REQ`, `VOTE-COMMIT`, `GLOBAL-COMMIT`, `GLOBAL-ABORT` transitions from memory?
- Can you justify why partial transactions are discarded but committed ones are replayed?
- Can you compare single-node journaling recovery and distributed 2PC recovery using the same log-first principle?
