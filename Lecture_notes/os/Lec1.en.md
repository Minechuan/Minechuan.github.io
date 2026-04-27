# Lecture 1: Introduction to Operating Systems and Scheduling

An operating system aims to run many programs efficiently, safely, and fairly on limited hardware.

> Think of OS as both a resource manager and an abstraction layer.

## 1. Why We Need an OS

- Hide hardware complexity behind consistent interfaces
- Manage CPU, memory, I/O, and file systems
- Provide isolation and scheduling for concurrent workloads

Typical metrics include response time $T_{response}$, turnaround time $T_{turnaround}$, and throughput.

---

## 2. A Simple Scheduling Model

In round-robin scheduling, let the time quantum be $q$ and context-switch cost be $c$. If $q$ is too small, switching overhead dominates.

$$
\eta = \frac{q}{q + c}
$$

Here $\eta$ is a rough efficiency ratio.

:::note 📝 Note: Learning Path
Understand scheduling goals first, then compare FCFS, SJF, and RR.
:::

:::tip 💡 Tip: Exam Prep
A side-by-side table of tradeoffs is usually more useful than memorizing formulas alone.
:::

:::warn ⚠️ Warning: Common Confusion
High throughput does not always mean low latency; batch and interactive tasks prefer different policies.
:::

:::error ⛔ Error Pattern
Treating all processes with the same priority can hurt interactive user experience.
:::

## 3. Minimal Scheduler Pseudocode

```text
while ready_queue not empty:
  p = pick_next(ready_queue)
  run(p, quantum=q)
  if p not finished:
    ready_queue.push_back(p)
```

For practical details, see [Linux CFS documentation](https://www.kernel.org/doc/html/latest/scheduler/sched-design-CFS.html).
