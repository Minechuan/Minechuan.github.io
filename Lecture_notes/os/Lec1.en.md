# Lecture 1: Operating Systems and Four Fundamental Concepts

## Learning Objectives

By the end of this lecture, you should be able to:

1. Explain what an OS does as a referee, illusionist, and glue layer.
2. Describe why OS design evolved across hardware eras.
3. Explain the four core abstractions: thread, address space, process, and dual-mode protection.
4. Analyze how a single CPU creates the illusion of multiple virtual CPUs.
5. Explain base-and-bound translation and why it enables isolation.
6. Compare syscall, interrupt, and exception as control-transfer paths.
7. Use a compact exam-ready framework to answer OS intro questions.

## 1. What Is an Operating System?

At a high level, an OS is a special software layer between applications and hardware.

It simultaneously plays three roles:

- **Referee**: manages protection, isolation, sharing, and resource allocation.
- **Illusionist**: offers clean abstractions over messy hardware (files, virtual memory, virtual CPU).
- **Glue**: provides common services (storage, networking, authorization, UI conventions).

:::remark Key Question: Why is OS not just a "driver collection"?
**Question (original intent): Why do we need an OS layer at all instead of direct app-to-hardware access?**

Answer:
- Modern machines are shared by many programs and users; direct access would break isolation immediately.
- Programs need stable abstractions, while hardware details change constantly.
- Security, reliability, and fair sharing require centralized mediation.
:::

## 2. Why OS Design Keeps Changing

OS history in this lecture is organized by hardware economics:

- Hardware expensive, humans cheap: early batch systems and large shared machines.
- Hardware cheaper, humans expensive: PCs/workstations and GUI-first usage.
- Hardware really cheap, humans really expensive: ubiquitous devices and pervasive networking.

A useful transition chain is:

- Batch -> Multiprogramming -> Timesharing -> Graphical UI -> Ubiquitous devices.

![Very brief OS history phases](lec01_materials/os_history_phases.png)

Most modern systems are lineage-based rather than built from scratch.

![OS archaeology and lineage](lec01_materials/os_lineage_archaeology.png)

:::tip Key Question: Why is lineage important in OS engineering?
**Question (original intent): If we can write new code, why keep old OS lineages?**

Answer:
- OSes are huge systems with decades of compatibility constraints.
- Existing kernels already encode hardware support, APIs, and operational lessons.
- Innovation often happens by incremental evolution, not full replacement.
:::

## 3. Bottom Line: Run Programs, but Run Them Safely

The OS bottom line is simple: run programs.

But "run" means a concrete pipeline:

1. Load code/data segments from executable into memory.
2. Create stack and heap.
3. Transfer control to user program.
4. Provide services during execution.
5. Keep OS and other programs protected.

![Instruction fetch/decode/execute cycle](lec01_materials/instruction_cycle_fetch_decode_execute.png)

:::warn Key Question: Why can't the OS just "start" a program and disappear?
**Question (original intent): After loading, why must the OS remain involved?**

Answer:
- Programs need syscalls for files, network, process management, and memory management.
- Interrupts/exceptions require privileged handling.
- Without continuous mediation, isolation and fairness collapse.
:::

## 4. Concept 1: Thread of Control

The key definition from the lecture is:

- **Thread: Single unique execution context**.

A thread state is anchored by:

- Program Counter (PC),
- registers and execution flags,
- stack pointer and stack content.

![Four fundamental OS concepts](lec01_materials/four_fundamental_concepts.png)

Operationally:

- A thread is running when its context is resident in processor registers.
- The rest of its state lives in memory and can be restored later.

## 5. Concept 2: Address Space

The key definition from the lecture is:

- **Programs execute in an address space that is distinct from the memory space of the physical machine**.

For capacity intuition:

$$
|\mathcal{AS}_{32}| = 2^{32},\qquad |\mathcal{AS}_{64}| = 2^{64}
$$

$$
\text{Addr}_{\max}^{(32)} = 2^{32} - 1
$$

![Address space in a picture](lec01_materials/address_space_layout.png)

Typical segments discussed in this lecture:

- code segment,
- static data segment,
- heap,
- stack.

:::remark Key Question: What does an address "mean" in practice?
**Question (original intent): If I read/write an address, what exactly happens?**

Answer:
- It may behave like normal memory.
- It may map to device behavior (memory-mapped I/O).
- It may trigger a fault if translation/protection checks fail.
:::

## 6. Concept 3: Process

The key definition from the lecture is:

- **A process is an instance of an executing program consisting of an address space and one or more threads of control**.

Process-level ownership includes:

- memory/address space,
- file descriptors and file-system context,
- communication endpoints and related resources.

![Single-threaded vs multithreaded process](lec01_materials/single_vs_multithreaded_process.png)

Fundamental tradeoff highlighted in class:

- stronger protection often costs more overhead,
- lighter-weight sharing often reduces isolation.

:::tip Key Question: Why allow multiple threads inside one process?
**Question (original intent): Do multiple threads share heap, and why is that useful?**

Answer:
- Yes, threads in one process share code/data/heap and many process resources.
- This makes intra-process communication fast and convenient.
- It also requires synchronization discipline to avoid races.
:::

## 7. Multiprogramming and the Illusion of Multiple CPUs

On a single physical CPU, the OS creates multiple virtual CPUs by time multiplexing.

![Virtual CPU time multiplexing](lec01_materials/virtual_cpu_time_multiplexing.png)

Each vCPU needs a saved context block containing at least:

- PC,
- SP,
- register set.

A context switch does:

1. save current thread/process context,
2. load next context,
3. resume execution at restored PC.

Common triggers:

- timer interrupt,
- voluntary yield,
- I/O completion,
- synchronous fault/exception.

:::warn Key Question: Why does concurrency feel non-deterministic?
**Question (original intent): Same program, same input, why can schedule and outcome differ?**

Answer:
- Interleavings depend on asynchronous events and scheduler decisions.
- Switch points may happen between many instruction boundaries.
- Correct code must tolerate legal interleavings, not assume one lucky order.
:::

## 8. Protection as the Core Contract

Protection in this lecture has two simultaneous goals:

- isolate processes from each other,
- isolate the OS from user processes.

![Protection and isolation boundary](lec01_materials/protection_isolation_boundary.png)

Security properties emphasized:

- reliability: prevent total-system crashes from one buggy app,
- security/privacy: confine what each process can access,
- fairness: limit resource usage (CPU, memory, I/O).

Mechanisms include:

- address translation limits,
- privileged instructions/registers,
- syscall mediation and subsystem checks.

## 9. Concept 4: Dual Mode Operation

Hardware provides at least two modes:

- user mode (limited privileged access),
- kernel mode (full privileged access).

![User/kernel privileged mode](lec01_materials/user_kernel_dual_mode.png)

Key machine support:

- a mode bit (user/system),
- trap path to enter kernel while saving user PC/context,
- return-from-interrupt path to restore user context and clear kernel privilege.

:::remark Key Question: Why is dual mode mandatory?
**Question (original intent): Why not let user programs execute privileged instructions directly?**

Answer:
- Then any process could rewrite protection registers, device state, or kernel memory.
- Isolation, security, and fairness would be unenforceable.
- Dual mode is the minimum hardware contract that makes OS protection real.
:::

## 10. Base-and-Bound Translation: First Practical Protection Mechanism

Base-and-Bound (B&B) introduces a simple translation + bounds check model.

![Runtime base-and-bound translation](lec01_materials/base_bound_runtime_translation.png)

Checked formula form:

$$
\text{PA} = \text{Base} + \text{VA}
$$

$$
0 \le \text{VA} < \text{Bound}
$$

Equivalent physical-range form:

$$
\text{Base} \le \text{PA} < \text{Base} + \text{Bound}
$$

One concrete binary example in slides:

$$
\text{Base}=1000_2,\ \text{Bound}=0100_2,\ \text{VA}=0010_2\Rightarrow \text{PA}=1010_2
$$

Lecture contrast:

- Load-time relocation: translate when program is loaded (needs relocating loader; no runtime add on address path).
- Runtime translation: translate on-the-fly for each memory reference (more flexible for multiprogramming).

:::error Key Question: Can a program touch OS memory or other programs under B&B?
**Question (original intent): "Can the program touch OS? Can it touch other programs?"**

Answer:
- Not if base/bound are correctly set and enforced by hardware.
- Any out-of-range access triggers a trap/exception instead of silent overwrite.
:::

## 11. Unprogrammed Control Transfer and Interrupt Vector

The lecture classifies three control-transfer paths into kernel mode:

- syscall (software request from process),
- interrupt (external asynchronous event),
- exception/trap (internal synchronous fault/event).

![Three types of mode transfer](lec01_materials/three_mode_transfers.png)

All are "unprogrammed control transfer" from the user code perspective: the process does not directly jump to arbitrary kernel handler addresses.

Handler dispatch relies on an interrupt/exception vector:

![Interrupt vector structure](lec01_materials/interrupt_vector_structure.png)

Given an event/interrupt number `i`, hardware indexes vector entry `i` to obtain handler target address and properties, then transfers control safely.

:::remark Key Question: How do we get the kernel target address safely?
**Question (original intent): How do we get the system target address of an unprogrammed control transfer?**

Answer:
- Hardware uses the interrupt/exception number as an index.
- The vector table stores pre-registered kernel handler addresses/metadata.
- User code cannot freely forge arbitrary kernel jump targets through this path.
:::

## 12. Lab 0 Snapshot

The lecture ends with Lab 0 reminders:

- Booting Pintos,
- debugging workflow,
- kernel monitor basics.

Time note from the original slide:

- The shown deadline was **Thursday, March 12, 2026**.

## Exam Review

### A. High-Value Definitions

- **Thread**: single execution context (PC/registers/flags/stack).
- **Address Space**: process-visible virtual memory domain with translation/protection.
- **Process**: resource-owning execution environment containing one or more threads.
- **Dual Mode**: hardware privilege split between user and kernel execution.

### B. Mechanism Chain (Must Remember)

1. Load executable segments; create stack/heap.
2. Enter user execution context.
3. User code runs in translated/protected address space.
4. Events (syscall/interrupt/exception) transfer control to kernel.
5. Kernel handles event and returns to user context.

### C. Short-Answer Templates

- "Why process + thread both needed?"
: Process gives protection boundary; thread gives concurrency unit.
- "How is multi-CPU illusion built on one CPU?"
: Save/restore context + time multiplexing + scheduling policy.
- "Why is dual mode non-negotiable?"
: Without privilege separation, no enforceable isolation.

### D. Common Mistakes

- Confusing process with thread ownership boundaries.
- Assuming shared memory implies safety.
- Treating interrupts and syscalls as the same source.
- Forgetting that translation and protection are coupled in hardware.

### E. Self-Check Checklist

- Can you derive valid-address conditions for B&B?
- Can you explain when context switches happen?
- Can you compare syscall vs interrupt vs exception clearly?
- Can you justify why interrupt vector indexing is necessary?
- Can you connect the four concepts into one coherent runtime story?
