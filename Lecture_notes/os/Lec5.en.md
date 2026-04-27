# Lecture 5: Synchronization 1 - Concurrency, Context Switching, and Why Locks Matter

## Learning Objectives

By the end of this lecture, you should be able to:

1. Explain how the OS achieves concurrency through PCB/TCB management and context switching.
2. Describe voluntary vs. involuntary context switches and the role of timer interrupts.
3. Explain why thread-based concurrency improves structure but creates correctness risks.
4. Use atomicity, critical sections, and locks to reason about thread safety.
5. Diagnose why naive bounded-buffer locking fails and what synchronization primitive is missing.
6. Summarize why microsecond-scale preemption matters in low-tail-latency systems (Shinjuku case).

## 1. Recap: Communication Endpoints and Blocking Semantics

### 1.1 Pipe and socket as queue-backed abstractions

The lecture starts by revisiting two familiar abstractions:

- Pipe: local IPC with finite buffer semantics.
- Socket: communication endpoint that generalizes file-like read/write across machines.

Both can block:

- Producer blocks when buffer is full.
- Consumer blocks when buffer is empty.

### 1.2 Process-per-connection vs thread-per-connection

The socket recap contrasts two design choices:

- Process-per-connection: stronger protection boundary, higher switching/sharing overhead.
- Thread-per-connection: lighter-weight concurrency, shared address space, easier data sharing, weaker isolation.

:::remark 📝 Key Question (recap)
**What are similar between pipes and sockets, and what are different?**

Answer:
- Similar: both expose read/write style APIs and may block on empty/full queues.
- Different: pipes are usually local and unnamed/simple namespace, while sockets are network-oriented, use host:port namespaces, and involve connection setup.
:::

## 2. OS Concurrency Core: PCB/TCB, Queues, and Dispatch Loop

### 2.1 PCB, process lifecycle, and queue-based scheduling

The kernel tracks each process in a PCB containing status, register context, identity, memory/IO metadata, and scheduling metadata.

Processes/threads move among states:

- `new`
- `ready`
- `running`
- `waiting`
- `terminated`

Scheduling is fundamentally queue management under policy.

![Context switch with privilege transitions](lec05_materials/context_switch_privilege_levels.png)

![Ready and I/O queue organization for PCBs](lec05_materials/ready_and_io_queues_pcb_flow.png)

### 2.2 Shared state vs per-thread state

Inside one address space:

- Shared: code, heap, global variables.
- Per-thread: stack, saved registers, thread metadata (TCB fields).

![Shared state vs per-thread state](lec05_materials/shared_vs_per_thread_state.png)

This split is the core tradeoff:

- Shared memory makes cooperation fast.
- Shared memory also makes races possible.

### 2.3 Dispatch loop as the minimal OS concurrency engine

A conceptual OS scheduling core is:

$$
\texttt{Loop}\;\{\;
\texttt{RunThread();}\;
\texttt{ChooseNextThread();}\;
\texttt{SaveStateOfCPU(curTCB);}\;
\texttt{LoadStateOfCPU(newTCB);}\;
\}
$$

![Yield path into run_new_thread and switch](lec05_materials/yield_stack_and_run_new_thread.png)

:::tip 💡 Key Question
**How does the dispatcher get control back from a running thread?**

Answer:
- Internal events (voluntary): `yield()`, blocking I/O, waiting for synchronization.
- External events (involuntary): interrupts, especially timer interrupts.
:::

## 3. Context Switching and Thread Bootstrap Details

### 3.1 Save/restore contract of `switch()`

A context switch is correct only if all architecturally relevant state is preserved and restored consistently.

$$
\begin{aligned}
\texttt{TCB[tCur].regs.r7} &\leftarrow \texttt{CPU.r7}\\
\texttt{TCB[tCur].regs.r0} &\leftarrow \texttt{CPU.r0}\\
\texttt{TCB[tCur].regs.sp} &\leftarrow \texttt{CPU.sp}\\
\texttt{TCB[tCur].regs.retpc} &\leftarrow \texttt{CPU.retpc}
\end{aligned}
$$

$$
\begin{aligned}
\texttt{CPU.r7} &\leftarrow \texttt{TCB[tNew].regs.r7}\\
\texttt{CPU.r0} &\leftarrow \texttt{TCB[tNew].regs.r0}\\
\texttt{CPU.sp} &\leftarrow \texttt{TCB[tNew].regs.sp}\\
\texttt{CPU.retpc} &\leftarrow \texttt{TCB[tNew].regs.retpc}
\end{aligned}
$$

![Register save/restore contract in switch](lec05_materials/context_switch_save_restore_registers.png)

### 3.2 Why switch bugs are dangerous

The lecture emphasizes a practical warning:

- Missing one register save/restore can produce intermittent wrong answers.
- Exhaustive testing is extremely hard because interleavings explode combinatorially.
- Simplicity is a design strategy, not aesthetics.

:::warn ⚠️ Key Question
**Can you devise an exhaustive test to test switch code?**

Answer:
- In practice, not completely.
- The state space across register values, interrupt timing, and interleavings is too large.
- We rely on layered validation: invariants, stress tests, architecture-specific tests, and conservative design.
:::

### 3.3 Voluntary vs involuntary switching and cost intuition

The class compares rough scales:

$$
\Delta t_{\text{switch interval}} \approx 10\text{--}100\,ms
$$

$$
\Delta t_{\text{ctx,proc}} \approx 3\text{--}4\,\mu s,\quad
\Delta t_{\text{ctx,thread}} \approx 100\,ns
$$

Threads are cheaper to switch largely because they do not require full address-space switching.

### 3.4 Timer interrupts force fairness

When code never yields, the OS regains control via periodic interrupts:

$$
\texttt{TimerInterrupt()\;\{\;DoPeriodicHouseKeeping();\;run\_new\_thread();\;\}}
$$

![Timer interrupt triggers run_new_thread](lec05_materials/timer_interrupt_for_preemption.png)

:::remark 📝 Key Question
**Could the ComputePI program grab all resources and never release the processor?**

Answer:
- Yes, if we had no involuntary preemption.
- Timer interrupts are the mechanism that prevents permanent CPU capture by non-cooperative threads.
:::

### 3.5 How a new thread starts

Thread creation is a bootstrap protocol:

1. Build TCB and initial stack.
2. Set stack pointer and return PC to a known root stub.
3. Put function pointer and argument pointer into designated argument registers.
4. Let scheduler pick the TCB; return lands in `ThreadRoot`.

$$
\begin{aligned}
\texttt{TCB[tNew].regs.sp} &\leftarrow \texttt{newStackPtr}\\
\texttt{TCB[tNew].regs.retpc} &\leftarrow \texttt{\&ThreadRoot}\\
\texttt{TCB[tNew].regs.r0} &\leftarrow \texttt{fcnPtr}\\
\texttt{TCB[tNew].regs.r1} &\leftarrow \texttt{fcnArgPtr}
\end{aligned}
$$

$$
\texttt{ThreadRoot(fcnPTR,fcnArgPtr)}:
\texttt{DoStartupHouseKeeping()} \rightarrow
\texttt{UserModeSwitch()} \rightarrow
\texttt{fcnPtr(fcnArgPtr)} \rightarrow
\texttt{ThreadFinish()}
$$

![Thread bootstrap by initializing TCB fields](lec05_materials/new_thread_tcb_initialization.png)

## 4. Reading Interlude: Keshav's Three-Pass Method

The lecture inserts an academic reading workflow:

- Pass 1 (10 min): identify category/context/contributions/clarity.
- Pass 2 (about 1 hour): understand logic and figures, postpone deep proofs.
- Pass 3 (several hours): mentally re-implement and challenge assumptions.

Practical takeaway: read with a goal, not at a fixed depth every time.

## 5. Modern Context Switching Case: Shinjuku

### 5.1 Why low tail latency is hard

Baseline high-performance datapath designs (OS bypass + polling + run-to-completion) reduce overhead but expose scheduling pathologies:

- Queue imbalance in distributed FCFS (`d-FCFS`), not work-conserving.
- Short requests trapped behind long requests.

![d-FCFS overhead and queueing imbalance](lec05_materials/shinjuku_dfcfs_overhead_and_queueing.png)

### 5.2 Why microsecond preemption matters

Coarse preemption (`PS-1ms`) can still hurt latency.
Fine preemption (`PS-5us`) tracks near-optimal behavior in the shown workload.

$$
P(S=0.5\,\mu s)=99.5\%,\quad P(S=500\,\mu s)=0.5\%
$$

$$
q_{\text{preempt}} \approx 5\,\mu s
$$

![PS-5us near-optimal tail latency behavior](lec05_materials/shinjuku_ps5us_tail_latency_curve.png)

### 5.3 Key design statement to remember

**A single address-space operating system that achieves microsecond-scale tail latency for all types of workloads regardless of variability in task duration.**

Key implementation ideas:

- Dedicated scheduling/queue core.
- Virtualization support for fast preemption.
- Very fast user-space context switching.
- Scheduling policy matched to workload distribution and latency target.

## 6. Why Synchronization Is Unavoidable

### 6.1 Non-determinism and correctness pressure

In concurrent systems:

- Scheduler may run threads in any order.
- Scheduler may preempt at any time.
- Therefore, correctness must be designed, not hoped for in tests.

### 6.2 ATM server as a motivating workload

Target goals:

- Serve requests efficiently.
- Preserve database correctness.
- Never over-disburse money.

![ATM server problem setup](lec05_materials/atm_server_problem_overview.png)

The lecture contrasts:

- Event-driven decomposition: efficient overlap but fragmented control flow.
- Thread-per-request: cleaner control flow but shared-state hazards.

### 6.3 Lost update in threaded deposit

Interleavings can corrupt `balance` updates:

$$
\texttt{Thread 1:}\;r_1\leftarrow B;\;r_1\leftarrow r_1+a_1;\;B\leftarrow r_1
$$

$$
\texttt{Thread 2:}\;r_1\leftarrow B;\;r_1\leftarrow r_1+a_2;\;B\leftarrow r_1
$$

![Lost-update race in threaded ATM deposit](lec05_materials/atm_threaded_lost_update_race.png)

:::error ⛔ Key Question
**If each request handler is logically correct, why can the final balance still be wrong?**

Answer:
- Local correctness is insufficient under interleaving.
- `load-add-store` is not atomic as a group, so two threads can overwrite each other's update.
:::

## 7. Atomicity, Locks, and Bounded Buffer Pitfalls

### 7.1 Core definitions (memorize these)

- **Atomic Operation: an operation that always runs to completion or not at all.**
- **Synchronization: using atomic operations to ensure cooperation between threads.**
- **Mutual Exclusion: ensuring that only one thread does a particular thing at a time.**
- **Critical Section: piece of code that only one thread can execute at once.**

### 7.2 Lock-based repair of the banking race

Wrap the shared update in one lock-protected critical section and use the same lock consistently across deposit/withdraw/etc.

![Lock serializes access to critical section](lec05_materials/lock_protected_critical_section.png)

### 7.3 Producer-consumer with bounded buffer

The lecture’s sequence is intentionally pedagogical: first write broken versions, then diagnose why they fail.

![Circular buffer structure and key questions](lec05_materials/circular_buffer_sequential_structure.png)

Canonical queue predicates used in implementations:

$$
\text{empty} \iff w=r
$$

$$
\text{full} \iff (w+1)\bmod \texttt{BUFSIZE}=r
$$

#### First cut (holds lock while spinning)

![First cut: wait loop under lock](lec05_materials/bounded_buffer_first_cut_spin_deadlock.png)

:::warn ⚠️ Key Question
**Will we ever come out of the wait loop?**

Answer:
- Not necessarily.
- If producer spins while holding lock on full buffer, consumer cannot enter to dequeue.
- Symmetric deadlock/livelock risk exists on empty buffer.
:::

#### Second cut (unlock-relock busy waiting)

![Second cut: release/reacquire in loop](lec05_materials/bounded_buffer_second_cut_unlock_relock.png)

:::remark 📝 Key Question
**What happens when one is waiting for the other?**

Answer:
- Correctness improves (other side can run), but efficiency collapses into busy waiting and repeated lock traffic.
- The missing primitive is sleep/wakeup coordination (semaphores or condition variables), not just a mutex.
:::

### 7.4 Why locks alone are not enough here

Mutex protects critical sections, but producer-consumer also needs condition synchronization:

- Resource condition: not-full / not-empty.
- Blocking wakeup: sleep without burning CPU.

This is why lock + condition variable (or semaphore) is the canonical design.

## 8. End-to-End Mental Model

You can now connect the full chain:

1. Concurrency exists because CPU time is multiplexed.
2. Multiplexing requires context save/restore and scheduler policy.
3. Threads make concurrency structurally easier than event decomposition.
4. Shared state introduces race conditions under non-deterministic interleavings.
5. Atomicity + mutual exclusion + condition synchronization restore correctness.

## Appendix: Exam Review

### A. Must-know definitions

- PCB/TCB and what state each stores.
- Voluntary vs involuntary context switch.
- Atomic operation, mutual exclusion, critical section, lock.

### B. Mechanism chain you should be able to narrate

1. `yield()` or blocking I/O traps into kernel.
2. Kernel saves current thread context into TCB.
3. Scheduler selects next runnable TCB.
4. Kernel restores registers/stack/PC and resumes.
5. Timer interrupts guarantee control returns even for non-yielding threads.

### C. Short-answer templates

- Why timer interrupts are necessary:
  - Without involuntary preemption, non-cooperative code can monopolize CPU.
- Why switch bugs are subtle:
  - Rare interleavings plus incomplete state save/restore cause intermittent silent corruption.
- Why thread-per-request still needs synchronization:
  - Cleaner code does not imply atomic shared-state updates.

### D. Common pitfalls to explicitly avoid

- Holding a lock while polling a condition.
- Using different locks for operations on the same shared object.
- Assuming tests cover enough interleavings.
- Ignoring tail latency while optimizing average latency.

### E. Self-check list

- Can I write the dispatch loop and explain each step?
- Can I explain exactly how `ThreadRoot` starts a new thread?
- Can I prove why bounded-buffer first cut can stall forever?
- Can I distinguish mutual exclusion from condition synchronization?
- Can I summarize why `PS-5us` preemption improved tail latency in the shown case?
