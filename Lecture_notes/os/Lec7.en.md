# Lecture 7: Synchronization 3 - Lock Implementation, Atomic Instructions, and Monitors

## Learning Objectives

By the end of this lecture, you should be able to:

1. Explain why lock APIs must rely on truly atomic acquire/release behavior.
2. Analyze interrupt-based lock implementations and locate missed-wakeup bugs.
3. Use atomic read-modify-write primitives (`test&set`, `swap`, `compare&swap`) to reason about lock design.
4. Compare simple spinlocks with guarded sleep-based locks.
5. Explain monitor programming with condition variables (`Wait`, `Signal`, `Broadcast`).
6. Distinguish Mesa vs. Hoare semantics and justify the `while` pattern after `wait`.

## 1. From Producer-Consumer to the Lock Abstraction

### 1.1 Why lock-only logic is not enough for bounded buffer

Bounded buffer requires two different guarantees at the same time:

- Mutual exclusion for queue integrity.
- Condition-based waiting for `not empty` / `not full`.

![Synchronization abstraction hierarchy](lec07_materials/sync_abstraction_hierarchy.png)

:::remark Key Question: lock-only vs condition waiting
**Question (slide intent): Why is bounded buffer not solved by only one lock?**

Answer:
- A lock only serializes access to shared data.
- Producer/consumer still need to sleep until a condition becomes true.
- If we only spin on a lock, we waste CPU; if we check once and continue, we break correctness.
:::

### 1.2 Target interface from "Too Much Milk"

The lecture moves from ad-hoc note protocols to a clean lock API:

- **`acquire(&milklock)`: wait until lock is free, then grab.**
- **`release(&milklock)`: unlock and wake up anyone waiting.**

Both operations must behave atomically with respect to competing threads.

## 2. Building Locks with Interrupt Control

### 2.1 Naive enable/disable approach and why it is unsafe

A first idea is to make lock operations atomic by disabling interrupts.

![Naive interrupt-disable lock idea](lec07_materials/naive_interrupt_disable_lock.png)

:::error Key Question: can user code disable interrupts?
**Question (slide wording): What happens with I/O or other important events?**

Answer:
- If user code can keep interrupts disabled, the system can stop responding.
- Real-time guarantees collapse when critical sections are long.
- Important external events can be delayed dangerously.
:::

### 2.2 Better kernel-side structure: lock variable + wait queue

The refined design disables interrupts only around lock-metadata transitions:

![Interrupt-based lock algorithm](lec07_materials/interrupt_based_lock_algorithm.png)

1. Enter a tiny atomic region.
2. If lock is busy, enqueue current thread and sleep.
3. If lock is free, set it busy and continue.
4. On release, wake one waiter or mark lock free.

This shortens the interrupts-off window and avoids coarse global blocking.

### 2.3 Where to re-enable interrupts around sleep

The subtle bug is about the boundary between enqueueing and sleeping.

![Missed wakeup when re-enable position is wrong](lec07_materials/sleep_reenable_missed_wakeup.png)
![Re-enable path via scheduler/context switch](lec07_materials/scheduler_reenable_after_sleep.png)

:::warn Key Question: missed wakeup boundary
**Question (slide wording): What about re-enabling ints when going to sleep?**

Answer:
- Re-enable too early: releaser may see no waiter and skip wakeup.
- Re-enable at the wrong late point: thread may be moved to ready queue, then still execute sleep.
- Result: lost wakeup / missed wakeup.

Safe pattern from the lecture:
- Call `sleep()` with interrupts still disabled in that path.
- Scheduler/next-thread path is responsible for re-enable semantics.
- Woken thread returns to acquire path and restores expected interrupt state.
:::

## 3. Atomic Read-Modify-Write Instructions

### 3.1 Why hardware atomic primitives are needed

Interrupt-based locking is not a good user-level mechanism and scales poorly on multiprocessors.

![Atomic read-modify-write overview](lec07_materials/atomic_read_modify_write_overview.png)

Atomic read-modify-write (RMW) instructions are hardware primitives that let us build lock algorithms without globally disabling interrupts.

### 3.2 Core RMW operations (from slide semantics)

![RMW instruction examples](lec07_materials/read_modify_write_instruction_examples.png)

$$
\texttt{test\&set}(a):\ r \leftarrow M[a],\ M[a] \leftarrow 1,\ \text{return } r
$$

$$
\texttt{swap}(a, r):\ t \leftarrow M[a],\ M[a] \leftarrow r,\ r \leftarrow t
$$

$$
\texttt{compare\&swap}(a, r_1, r_2)=
\begin{cases}
\text{success},\ M[a] \leftarrow r_2 & \text{if } M[a]=r_1\\
\text{failure},\ M[a] \text{ unchanged} & \text{otherwise}
\end{cases}
$$

### 3.3 Simple `test&set` lock and busy-waiting cost

![Simple test-and-set spinlock](lec07_materials/test_and_set_spinlock.png)

$$
\texttt{Acquire}:\ \texttt{while(test\&set(value));}
$$

$$
\texttt{Release}:\ \texttt{value} \leftarrow 0
$$

Correctness for mutual exclusion is straightforward, but efficiency is often poor:

- Waiting threads burn CPU cycles.
- On multiprocessors, repeated writes cause cache-line ping-pong.
- Priority and latency can degrade under contention.

:::warn Key Question: correctness vs performance
**Question (slide intent): Why can this still be a bad lock even if it is correct?**

Answer:
- It preserves safety, but wastes compute and memory-system bandwidth.
- Under load, spin-waiting can hurt throughput and tail latency.
:::

## 4. Better `test&set` Lock: Minimize Spinning, Then Sleep

### 4.1 Add `guard` for short atomic metadata updates

The improved design uses:

- `value`: lock state (`FREE`/`BUSY`)
- `guard`: short critical ownership over lock metadata

![Guarded test-and-set lock](lec07_materials/guarded_test_and_set_lock.png)

Key idea:
- Busy-wait only on short `guard` transitions.
- If actual lock is busy, enqueue and sleep instead of long spinning.

### 4.2 Why guard handling must stay atomic with sleep path

:::tip Key Question: can we remove busy waiting fully?
**Question (slide wording): Can we build test&set locks without busy-waiting?**

Answer:
- Not completely.
- But we can minimize it by restricting spin-wait to tiny metadata windows.
- Guard release must be coordinated with sleep transition; otherwise race windows reopen.
:::

## 5. Monitors and Condition Variables

### 5.1 Why monitors are cleaner than semaphore-only style

![Semaphore vs monitor motivation](lec07_materials/semaphore_vs_monitor_motivation.png)

A monitor separates concerns clearly:

- Locks for mutual exclusion.
- Condition variables for scheduling constraints.

**Key definition (slide wording): Monitor: a lock and zero or more condition variables for managing concurrent access to shared data.**

### 5.2 Condition variable semantics and usage rule

![Condition variable operations](lec07_materials/condition_variable_operations.png)

$$
\texttt{Wait(lock)}:\ \text{atomically release lock and sleep; re-acquire lock before return}
$$

- `Signal()`: wake one waiter if any.
- `Broadcast()`: wake all waiters.
- Rule: hold the lock when doing condition-variable operations.

### 5.3 Mesa vs. Hoare semantics and the `while` rule

![Mesa vs Hoare semantics prompt](lec07_materials/mesa_vs_hoare_monitoring_semantics.png)
![Mesa monitor execution model](lec07_materials/mesa_monitor_execution_model.png)

- Hoare monitor: signaler hands lock+CPU directly to waiter immediately.
- Mesa monitor: signaler keeps running; waiter is only put into ready queue.

:::remark Key Question: why not `if`?
**Question (slide wording): Why didn't we do this?**

Answer:
- In Mesa semantics, wakeup does not guarantee immediate execution.
- By the time waiter runs, condition may be false again.
- Therefore use `while (condition) wait(...)`, not `if (...) wait(...)`.
:::

### 5.4 Bounded buffer (3rd cut): monitor-style implementation

![Bounded buffer monitor third cut](lec07_materials/bounded_buffer_monitor_third_cut.png)

This version combines:

- One mutex for buffer integrity.
- Two condition variables (`producer_CV`, `consumer_CV`).
- Sleep-based waiting instead of long busy loops.

## 6. Exam Review

### 6.1 Must-know definitions

- **Atomic operation**: runs to completion or not at all.
- **Spinlock**: mutual exclusion by repeated atomic retry (busy-wait).
- **Monitor**: lock + condition variables as a structured concurrency abstraction.
- **Condition variable**: waiting queue tied to a lock-protected condition.

### 6.2 High-value short-answer templates

1. **Why not disable interrupts for user-level lock APIs?**
   It breaks responsiveness, delays critical interrupts, and cannot scale as a user-facing primitive.
2. **Why `while` after `cond_wait` in most OSes?**
   Because Mesa semantics only make waiter ready; condition may change before waiter runs.
3. **Why can `test&set` lock be correct but still poor?**
   Because correctness does not imply efficiency; spin-wait can waste CPU/cache/bus resources.

### 6.3 Common pitfalls

- Treating lock and condition waiting as the same mechanism.
- Forgetting atomic release-and-sleep semantics in `Wait(lock)`.
- Using `if` instead of `while` around `cond_wait` under Mesa semantics.
- Assuming low contention when choosing spin-heavy designs.

### 6.4 Self-check

:::tip Self-check 1
Can you explain one concrete interleaving that causes missed wakeup when interrupt re-enable is placed incorrectly around sleep?
:::

:::tip Self-check 2
Can you compare lock-only, semaphore-based, and monitor-based bounded-buffer implementations by readability, proof burden, and performance?
:::
