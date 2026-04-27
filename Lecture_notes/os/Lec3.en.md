# Lecture 3: Abstractions 2 - Files and I/O (Programmer's View)

## Learning Objectives

By the end of this lecture, you should be able to:

1. Explain the POSIX file abstraction and why "everything is a file" matters.
2. Distinguish C high-level stream APIs (`FILE*`) from low-level POSIX descriptor APIs (`int fd`).
3. Reason about buffering, visibility, and correctness when using stream I/O.
4. Describe the kernel-side state behind descriptor-based I/O.
5. Explain descriptor copying and open-file-description aliasing under `fork`, `dup`, and `dup2`.
6. Identify multithreaded `fork()` hazards and safe usage boundaries.
7. Avoid correctness bugs caused by mixing `FILE*` and raw file descriptor I/O.

## 1. Core Idea: Everything Is a File

The Unix/POSIX design goal is interface uniformity:

- disk files,
- devices (terminal/printer),
- sockets/pipes,
- many other I/O objects,

are controlled through a common interface family centered on `open/read/write/close`.

:::remark Key Question: Why was "everything is a file" such a big idea?
**Question (original intent): Why unify unrelated objects (disk files, devices, sockets) under one API style?**

Answer:
- It greatly reduces cognitive and implementation complexity for application programmers.
- It enables composition patterns (`producer | filter | consumer`) because I/O endpoints share semantics.
- It lets OS internals optimize behind one abstraction without changing user code structure.
:::

## 2. I/O Stack and Two API Layers

![I/O and storage layers](lec03_materials/io_storage_layers.png)

From top to bottom:

- Application/service logic
- High-level stream API (`FILE*`)
- Low-level descriptor API (`int fd`) + syscall boundary
- Open file descriptions + file-system layer
- Driver/device layer

This layering explains why we have both convenience APIs and precise control APIs.

## 3. High-Level API (`FILE*`): Streams, Convenience, and Semantics

High-level C I/O (`stdio.h`) exposes stream-based interfaces such as:

- `fopen/fclose`
- `fgetc/fputc`, `fgets/fputs`
- `fread/fwrite`
- `fprintf/fscanf`
- `fseek/ftell/rewind`

Standard streams are pre-opened:

$$
\text{STDIN\_FILENO}=0,\quad \text{STDOUT\_FILENO}=1,\quad \text{STDERR\_FILENO}=2
$$

Block operation sizing model:

$$
\text{bytes requested by }\operatorname{fread}/\operatorname{fwrite}
= \text{size\_of\_elements}\times \text{number\_of\_elements}
$$

Stream position model (`fseek`):

$$
\text{pos}_{\text{new}}=
\begin{cases}
\text{offset}, & \text{whence}=\text{SEEK\_SET}\\
\text{pos}_{\text{cur}}+\text{offset}, & \text{whence}=\text{SEEK\_CUR}\\
\text{pos}_{\text{end}}+\text{offset}, & \text{whence}=\text{SEEK\_END}
\end{cases}
$$

:::tip Key Question: If `FILE*` is "high-level," what does it add beyond syscalls?
**Question (original intent): What do we gain from stream APIs instead of calling `read/write` directly all the time?**

Answer:
- Better ergonomics (formatted I/O, line-oriented reading, convenient buffering).
- Better performance in many small-I/O workloads due to userspace buffering.
- Cleaner API surface for common text and structured I/O tasks.
:::

## 4. Low-Level API (`int fd`): Raw Syscall Interface

Low-level POSIX I/O gives explicit control over descriptors and kernel-visible offsets:

$$
fd = \operatorname{open}(\text{filename},\text{flags}[,\text{mode}]),\quad
fd\ge 0\Rightarrow \text{success},\; fd<0\Rightarrow \text{error}
$$

$$
n = \operatorname{read}(fd,\text{buf},\text{maxsize}),\quad
n\in\{-1\}\cup[0,\text{maxsize}],\quad
n=0\Rightarrow \text{EOF},\; n=-1\Rightarrow \text{error}
$$

$$
m = \operatorname{write}(fd,\text{buf},\text{size}),\quad
m\in\{-1\}\cup[0,\text{size}]
$$

Descriptor utilities include `dup`, `dup2`, `pipe`, `fileno`, `fdopen`, and device-specific `ioctl`-style operations.

## 5. High-Level vs. Low-Level: Same Kernel Path, Different Contract

![High-level vs low-level API path](lec03_materials/high_vs_low_api_path.png)

Both styles eventually trap into the kernel.

Difference is not "kernel vs non-kernel"; it is:

- who manages buffering and rich formatting logic,
- how much control you need over exact I/O timing and offsets,
- whether convenience or precision dominates this code path.

## 6. Why Userspace Buffering Exists

![Userspace buffering overhead motivation](lec03_materials/userspace_buffering_overhead.png)

![Userspace buffering functionality motivation](lec03_materials/userspace_buffering_functionality.png)

Two major motivations:

1. Overhead reduction: syscalls are expensive, so batching helps throughput.
2. Functionality: kernel keeps generic byte-oriented primitives; userspace layers add richer operations.

Observed performance note from lecture:

$$
\text{byte-by-byte syscall throughput}\approx 10\,\text{MB/s}
$$

Correctness rule with `FILE*`:

- Do not assume data visibility timing unless you force it.
- Use `fflush` when your protocol requires visibility at a specific point.
- `fclose` flushes before closing.

:::warn Key Question: Why can two `FILE*` handles to the same file observe surprising results?
**Question (original intent): Why might a later `fread` fail to observe a recent `fwrite` immediately?**

Answer:
- Stream writes may still reside in userspace buffer.
- Visibility to another reader may lag until flush happens.
- Correct code should establish explicit flush/sync points when ordering matters.
:::

## 7. Kernel State Model: File Descriptor to Open File Description

![Kernel state for fd lookup](lec03_materials/kernel_fd_state_mapping.png)

Important split:

- **File descriptor (fd):** per-process integer handle.
- **Open file description (OFD):** kernel object containing file identity + current offset (and related state).

Offset progress under successful reads:

$$
\text{pos}_{k+1}=\text{pos}_{k}+n_k,\quad n_k>0
$$

This is why repeated `read(fd, ...)` continues from where the previous read ended.

## 8. `fork()`: Descriptor Copy, OFD Aliasing, Shared Progress

![fork descriptor copy and OFD aliasing](lec03_materials/fork_fd_copy_ofd_aliasing.png)

After `fork` (with inherited descriptors):

$$
\text{OFD}_{\text{parent}}\equiv\text{OFD}_{\text{child}}
$$

Meaning:

- descriptor numbers are copied into child descriptor table,
- both processes may reference the same kernel open-file-description state,
- offset updates through one process affect what the other process sees next.

:::remark Key Question: Why is OFD aliasing useful instead of duplicating everything?
**Question (original intent): Why not duplicate independent kernel file state for parent and child by default?**

Answer:
- Shared resources after `fork` are often exactly what we want (pipes, terminals, inherited files).
- It enables process cooperation with minimal setup cost.
- Lifetime remains correct: OFD survives until the last referencing descriptor is closed.
:::

## 9. Shared Terminal Example and Descriptor Inheritance

![Shared terminal descriptors after fork](lec03_materials/shared_terminal_descriptors.png)

The classic case:

- parent and child both inherit descriptors `0/1/2`,
- both can read/write through the same terminal endpoint,
- closing descriptor `0` in one process does not implicitly close descriptor `0` in the other process.

This helps explain shell behavior and many IPC patterns.

## 10. `dup` and `dup2`: Explicit Descriptor Duplication

![dup and dup2 aliasing model](lec03_materials/dup_dup2_aliasing.png)

Core relation:

$$
fd' = \operatorname{dup}(fd),\quad
\operatorname{dup2}(fd,fd_t)=fd_t,\quad
\text{OFD}(fd')\equiv\text{OFD}(fd_t)\equiv\text{OFD}(fd)
$$

Interpretation:

- New descriptor number, same underlying open-file description.
- Useful for redirection wiring (`stdin/stdout/stderr`) without reopening files.

## 11. Multithreaded `fork()`: Hazard Boundary

![fork in multithreaded process](lec03_materials/multithreaded_fork_single_thread_child.png)

Key fact:

$$
\#\text{threads in child after }\operatorname{fork}=1
$$

Only the calling thread survives in child; other threads vanish.

:::error Key Question: Why is `fork()` in a multithreaded process dangerous?
**Question (original intent): What can go wrong if vanished threads were in critical sections?**

Answer:
- Child may inherit locks in inconsistent ownership states.
- Data structures may be left half-updated with no cleanup path.
- Safe pattern: in child, call `exec()` quickly (replace address space) unless you know exactly what you are doing.
:::

## 12. Pitfall: Do Not Carelessly Mix `FILE*` and Raw `fd`

![Avoid mixing FILE and file descriptors](lec03_materials/avoid_mixing_file_and_fd.png)

`FILE*` has its own userspace buffer and policy.

So this assumption is unsafe:

- "After `fread(..., f)`, calling `read(fileno(f), ...)` starts exactly where I expect."

In lecture example, the right choice is "none of the above" because buffered prefetch can desynchronize your mental model.

$$
\text{Do not assume }\operatorname{fread}(\cdot)\text{ advances visibility exactly as a subsequent }\operatorname{read}(fd,\cdot)\text{ expectation.}
$$

## 13. API Design Guidance: When to Use Which Layer

Use high-level stream API when:

- text/line/formatted I/O dominates,
- convenience and readability matter,
- buffering behavior is acceptable or explicitly managed.

Use low-level descriptor API when:

- precise offset/control semantics are needed,
- integrating with `fork/exec/dup2/pipe` workflows,
- implementing runtimes, shells, or systems components.

:::tip Key Question: How should we design a file API for real systems software?
**Question (original intent): High-level vs low-level is not binary; how should a good design combine them?**

Answer:
- Keep a small, stable low-level core (`open/read/write/close` + descriptor ops).
- Build high-level convenience layers as wrappers with explicit sync/flush boundaries.
- Document visibility and buffering contracts clearly to prevent semantic surprises.
:::

## 14. Takeaways

- POSIX unifies I/O by treating many resources as files.
- `FILE*` and `fd` both reach kernel I/O, but they offer different contracts.
- Buffering improves speed/functionality but introduces visibility semantics you must control.
- Descriptor copying aliases kernel open-file-description state; this is powerful but subtle.
- In multithreaded contexts, `fork` requires strict discipline.
- Avoid mixing high-level and low-level I/O blindly on the same underlying file.

## 15. Exam Review

### 15.1 Must-Know Definitions

- **File Descriptor (fd):** per-process integer handle for kernel I/O objects.
- **Open File Description (OFD):** kernel state for an open instance (identity + current offset + flags/state).
- **Stream (`FILE*`):** userspace abstraction wrapping descriptor + buffer + metadata/locking.
- **Buffering:** batching data movement to reduce syscall overhead and add higher-level features.
- **Aliasing (in this lecture):** multiple descriptors/processes referencing the same OFD.

### 15.2 High-Value Short-Answer Templates

1. **Why both `FILE*` and `fd` APIs?**  
   `FILE*` improves convenience/performance for common patterns; `fd` gives precise kernel-facing control and composability with process primitives.
2. **What is copied vs shared at `fork` for files?**  
   Descriptor table entries are copied, but they may alias the same OFD, so offset/state can be shared.
3. **Why avoid mixing `fread` and `read` on same file handle?**  
   Userspace buffering in `FILE*` can invalidate naive offset/visibility assumptions for raw descriptor reads.
4. **Why is `fork` in multithreaded processes risky?**  
   Only one thread survives in child, so lock/data invariants from vanished threads may be broken.

### 15.3 Common Pitfalls

- Assuming stream writes are instantly visible without flush.
- Forgetting partial read/write behavior and return-value checks.
- Misunderstanding fd copy vs OFD alias semantics after `fork`/`dup`.
- Mixing `FILE*` and raw `fd` access without a strict synchronization plan.
- Calling `fork` in multithreaded programs and doing complex work in child before `exec`.

### 15.4 Self-Check

:::tip Self-check 1
Given one opened file and two processes created via `fork`, explain why reads in one process can affect the other's next read result.
:::

:::tip Self-check 2
Design one example where `FILE*` is the right choice and one where raw descriptor API is preferable, and justify each in one sentence.
:::

:::tip Self-check 3
You must redirect child stdout to a file before `exec`. Explain why `dup2` is the natural primitive.
:::
