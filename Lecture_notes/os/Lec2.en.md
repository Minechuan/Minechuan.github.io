# Lecture 2: Abstractions 1 - Threads and Processes (Programmer's View)

## Learning Objectives

By the end of this lecture, you should be able to:

1. Explain why OSes and applications need threads to handle multiple activities at once.
2. Distinguish concurrency from parallelism and reason about scheduler-driven interleavings.
3. Describe thread state, per-thread vs shared process state, and the role of the execution stack.
4. Explain how non-determinism leads to race conditions and why synchronization is required.
5. Use lock and semaphore APIs conceptually, including `pthread` and `P/V` patterns.
6. Explain process creation/execution management via `fork`, `exec`, `wait`, and signals.
7. Compare thread APIs and process APIs from a systems-design perspective.

## 1. Fast Recall: Core OS Concepts Reused Here

This lecture assumes four foundations are already familiar:

- **Thread**: one execution context (PC, registers, flags, stack).
- **Address Space**: program-visible memory with translation/protection.
- **Process**: an executing program instance with one or more threads.
- **Dual Mode + Protection**: kernel-only privileged operations and isolation.

It also quickly recalls Base-and-Bound to connect memory isolation with execution abstractions.

![Base-and-bound load-time translation](lec02_materials/base_bound_load_time_translation.png)

![Base-and-bound runtime translation](lec02_materials/base_bound_runtime_translation.png)

Key checked form:

$$
0 \le \text{Offset} < \text{Bound},\qquad \text{PhysicalAddress} = \text{Base} + \text{Offset}
$$

:::remark Key Question: Why start a thread lecture with memory-protection recall?
**Question (original intent): What does base-and-bound have to do with threads/processes?**

Answer:
- Threads are execution entities, but they execute inside an address-space protection model.
- Process/thread abstraction and memory abstraction are tightly coupled in real OS design.
- Without protection, multi-threaded/multi-process reasoning breaks quickly under bugs.
:::

## 2. Why Threads Exist: Handling Multiple Things At Once

The motivating requirement is **MTAO (multiple things at once)**:

- OS internals: interrupts, process work, background maintenance.
- Network servers: many connections in flight.
- UI software: responsiveness while computation continues.
- I/O-bound software: hide network/disk latency.

Concurrency unit provided by OS:

- **Thread** is the minimal scheduling/execution abstraction for these concurrent activities.

![Multiprocessing vs multiprogramming](lec02_materials/multiprocessing_vs_multiprogramming.png)

### 2.1 Concurrency vs Parallelism

- **Concurrency**: structuring work so multiple activities can make progress.
- **Parallelism**: physically executing multiple activities simultaneously.

A single-core system can be concurrent without being parallel.

:::tip Key Question: Why does this distinction matter in design?
**Question (original intent): If tasks are not literally simultaneous, why still model them as concurrent?**

Answer:
- Because correctness and responsiveness depend on interleaving behavior, not only hardware core count.
- Concurrency is a software-structure problem first; parallelism is a hardware-capacity bonus.
:::

## 3. From Single Flow to Threaded Programs

A single-flow program can stall forever on one long task:

- Example: endless `ComputePI()` means no UI/class-list output path progresses.

Threaded version splits responsibilities:

- `create_thread(taskA)` and `create_thread(taskB)` allow independent progress.
- One task can keep UI responsive while another waits on I/O or does long compute.

![Thread state RUNNING READY BLOCKED](lec02_materials/thread_state_running_ready_blocked.png)

![Threads mask I/O latency](lec02_materials/threads_mask_io_latency_timeline.png)

## 4. Thread API Path: Library Call to Kernel Mechanism

At the programmer level, we call APIs like `pthread_create`.

Under the hood:

1. User-space library prepares arguments and metadata.
2. A syscall trap enters kernel mode.
3. Kernel allocates thread structures and scheduler-visible state.
4. Return path exposes result to user code.

Core APIs highlighted:

- `pthread_create(...)`
- `pthread_exit(...)`
- `pthread_join(...)`

Fork-join pattern abstraction:

![Fork-join pattern](lec02_materials/fork_join_pattern.png)

:::remark Key Question: Why must `pthread_join()` exist if threads can just terminate?
**Question (original intent): Why not let child threads finish silently without joins?**

Answer:
- Joining provides synchronization and lifecycle ownership.
- It allows deterministic collection of completion and return value.
- Without join (or equivalent), resource cleanup and ordering become error-prone.
:::

## 5. Thread State and the Execution Stack

Per-process shared state includes:

- code/data/heap,
- file descriptors and connection state.

Per-thread private state includes:

- registers + program counter,
- execution stack,
- thread-control metadata (TCB).

![Shared vs private thread state](lec02_materials/thread_shared_and_private_state.png)

### 5.1 Execution Stack Walkthrough

The recursive call-chain example illustrates stack frames holding:

- parameters,
- temporary data,
- return addresses.

![Execution stack recursive growth](lec02_materials/execution_stack_recursive_growth.png)

For one illustrated interleaving of returns, output evolves as:

- first `2`, then `1`.

### 5.2 Multi-thread Process Layout

Each thread has its own stack, while heap/global/code are shared.

![Two-thread memory layout](lec02_materials/two_thread_memory_layout.png)

## 6. Interleaving, Nondeterminism, and Correctness

Thread abstraction gives the illusion of abundant processors, while actual execution depends on scheduler choices.

![Thread abstraction vs physical reality](lec02_materials/thread_abstraction_vs_physical_reality.png)

Key consequence:

- execution order can vary between runs,
- context switches can happen at many instruction boundaries,
- tests can pass many times and still hide rare failures.

Independent vs cooperating threads:

- Independent: no shared mutable state, easier determinism.
- Cooperating: shared state, must design correctness explicitly.

## 7. Race Conditions: When Interleavings Change Results

Race example setup:

$$
x_0=0,\quad y_0=0
$$

Thread A and B updates:

$$
\text{Thread A: }x\leftarrow y+1
$$

$$
\text{Thread B: }y\leftarrow 2;\ \ y\leftarrow 2y
$$

Possible final `x` values:

$$
x\in\{1,3,5\}
$$

![Race condition possible values](lec02_materials/race_condition_possible_values.png)

This non-deterministic outcome under valid schedules is the essence of a race.

:::warn Key Question: Why is a race not just a "performance issue"?
**Question (original intent): If all schedules are legal, why call this a bug?**

Answer:
- Because program meaning should not depend on accidental timing unless explicitly designed to.
- A race violates semantic stability: same input may produce inconsistent outputs.
- It is a correctness bug, not only an efficiency concern.
:::

## 8. Synchronization, Mutual Exclusion, and Locks

Definitions used throughout systems programming:

- **Synchronization**: coordination among threads over shared state.
- **Mutual Exclusion**: only one thread in a critical region at a time.
- **Critical Section**: code region requiring mutual exclusion.
- **Lock**: object representing ownership of that exclusion right.

Operational lock interface:

- `acquire`: wait, then hold lock.
- `release`: relinquish lock.

Applying lock discipline to shared tree updates/searches:

![Lock-protected tree operations](lec02_materials/lock_protected_tree_operations.png)

## 9. Semaphores as Generalized Synchronization

A semaphore is a non-negative integer with atomic operations:

$$
P(S):\ \text{wait until }S>0,\ \text{then }S\leftarrow S-1
$$

$$
V(S):\ S\leftarrow S+1
$$

![Semaphore definition and P/V](lec02_materials/semaphore_definition_p_v.png)

Two common patterns:

1. Binary semaphore for mutual exclusion:

$$
S_{mutex}=1
$$

2. Join/signaling semaphore:

$$
S_{join}=0
$$

![Semaphore mutex and thread-join patterns](lec02_materials/semaphore_mutex_and_threadjoin_patterns.png)

:::tip Key Question: When choose semaphore vs mutex lock?
**Question (original intent): If both can protect critical sections, why keep both abstractions?**

Answer:
- A mutex models ownership-centric mutual exclusion cleanly.
- A semaphore can represent both exclusion and event-count signaling.
- Use the abstraction that directly matches the coordination semantics.
:::

## 10. Process Abstraction and Process-Management APIs

A process is an execution environment with restricted rights:

- one or more threads,
- one address space,
- owned resources (FDs, connections, etc.),
- isolation from other processes.

### 10.1 `fork()` semantics

`fork()` duplicates current process state into parent+child views.

$$
\text{fork()} > 0\Rightarrow\text{parent},\quad
\text{fork()} = 0\Rightarrow\text{child},\quad
\text{fork()} < 0\Rightarrow\text{error}
$$

![fork return-value semantics](lec02_materials/fork_return_value_semantics.png)

### 10.2 `fork` + `exec` + `wait`

Typical shell/program-launch pattern:

- parent calls `fork`,
- child calls `exec` to replace image,
- parent calls `wait` to synchronize completion.

![fork-exec-wait code example](lec02_materials/fork_exec_wait_example.png)

![shell fork-exec-wait flow](lec02_materials/shell_fork_exec_wait_flow.png)

API set summarized in lecture:

- `exit`, `fork`, `exec`, `wait`, `kill`, `sigaction`.

:::remark Key Question: Why separate `fork` and `exec` instead of one call?
**Question (original intent): What practical power comes from the split design?**

Answer:
- It allows child-side setup between duplication and replacement (FD redirection, env shaping, etc.).
- It supports both "fork-only" and "fork-then-exec" workflows.
- This makes UNIX process control composable.
:::

## 11. Why Process and Thread APIs Look Different

Thread creation is usually a library API (`pthread_create`) over shared-address-space execution.

Process management uses explicit system-call primitives (`fork/exec/wait`) because address-space identity and protection boundaries are involved.

![Process vs thread API design](lec02_materials/process_vs_thread_api_design.png)

Windows-style `CreateProcess` merges concerns differently, but the same conceptual tasks remain.

## 12. Takeaways

- Threads are the OS unit of concurrency; processes are protected execution environments.
- Non-deterministic scheduling is normal and must be handled by design.
- Shared mutable state demands synchronization (locks/semaphores).
- Process APIs define lifecycle and isolation transitions for real programs.

## 13. Exam Review

### 13.1 Must-Know Definitions

- **Thread**: schedulable execution context in a process.
- **Process**: isolated execution environment with resources and one+ threads.
- **Concurrency**: managing multiple activities with possible interleaving.
- **Parallelism**: simultaneous execution on multiple hardware execution units.
- **Race Condition**: outcome depends on unsynchronized execution timing/order.
- **Critical Section**: code that must not be executed concurrently by multiple threads.
- **Semaphore**: integer synchronization primitive with `P/down` and `V/up`.

### 13.2 High-Value Short-Answer Templates

1. **Why can a single-core system still need threads?**  
   Because threads provide concurrency structure: overlap I/O waits, keep responsiveness, and manage multiple tasks even without true parallel hardware execution.
2. **Why does `x = y + 1` race with `y = 2; y = y*2`?**  
   Different legal interleavings expose different observed `y` values to Thread A, so final `x` becomes schedule-dependent.
3. **Why does shell launch usually use `fork` then `exec`?**  
   `fork` creates child context; child can be prepared; then `exec` installs target program, while parent can continue and `wait` as needed.

### 13.3 Common Pitfalls

- Assuming concurrency implies physical parallelism.
- Assuming test pass under one schedule proves thread-safety.
- Holding locks too broadly and serializing unrelated work.
- Treating semaphores and mutexes as interchangeable in all designs.
- Forgetting to handle `fork()<0` and `exec()` failure paths.

### 13.4 Self-Check

:::tip Self-check 1
Given two threads and one shared integer, construct one interleaving that preserves determinism and one that causes a race outcome.
:::

:::tip Self-check 2
Explain why each thread needs a private stack but shares heap/global data with sibling threads in the same process.
:::

:::tip Self-check 3
For a shell launching a command, write the control-flow order of `fork`, `exec`, and `wait`, and explain what each runs in parent vs child.
:::
