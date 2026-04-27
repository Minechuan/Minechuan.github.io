# Lecture 11: Scheduling 3 - Deadlock, Detection, Prevention, and Avoidance

## Learning Objectives

By the end of this lecture, you should be able to:

1. Distinguish starvation from deadlock and explain why deadlock is a stronger failure mode.
2. Use bridge, lock, memory-space, and dining-lawyers examples to reason about deadlock formation.
3. State the four necessary conditions for deadlock and use them as a design checklist.
4. Read resource-allocation graphs and explain when a cycle does and does not imply deadlock.
5. Apply the deadlock detection algorithm and interpret unfinished nodes.
6. Compare prevention, recovery, avoidance, and denial from a system-engineering viewpoint.
7. Explain the intuition and decision rule behind Banker’s algorithm.

## 1. Fast Recap We Reuse

This lecture starts from scheduling concepts introduced earlier and then moves to deadlock.

Three recap formulas that still matter:

$$
D_i^{t+1} = D_i^t + P_i
$$

$$
N_{ticket} = \sum_i N_i
$$

$$
\text{execution rate} = \frac{1}{N}
$$

Why recap here: deadlock handling is not isolated from scheduling. Progress, fairness, and responsiveness interact with lock/resource behavior.

## 2. Deadlock vs. Starvation

- **Starvation**: a thread waits indefinitely and does not make progress.
- **Deadlock**: a set of threads forms cyclic waiting on resources.
- Relationship: deadlock implies starvation for the involved threads, but starvation does not necessarily mean deadlock.

The practical difference:

- Starvation may eventually end if scheduling/resource patterns change.
- Deadlock does not end without external intervention.

:::remark Key Question: what is the exact difference?
**Question (slide wording): Starvation \(\neq\) Deadlock. What changes in guarantees once waiting becomes cyclic?**

Answer:
- In starvation, progress is delayed without structural impossibility.
- In deadlock, cyclic dependencies make progress impossible under current ownership/waiting relations.
:::

## 3. Bridge and Lock Examples: How Deadlock Materializes

The single-lane bridge model is a resource graph in disguise:

![Bridge crossing deadlock intuition](lec11_materials/bridge_deadlock_segments.png)

- Each road segment is a resource.
- A car holds one segment and requests the next.
- Opposite-direction cars can create circular wait in the middle.

Lock deadlock has the same pattern:

![Lock deadlock unlucky interleaving](lec11_materials/lock_deadlock_unlucky_case.png)

- Thread A: `x.Acquire(); y.Acquire(); ...`
- Thread B: `y.Acquire(); x.Acquire(); ...`
- “Unlucky” interleaving yields cyclic wait.

:::warn Key Question: why is this bug hard to debug?
**Question (slide intent): Why can the same lock code sometimes run fine and sometimes deadlock?**

Answer:
- Deadlock can be schedule-dependent (non-deterministic trigger).
- Testing can miss unlucky interleavings.
- Correctness must come from lock-order discipline, not from “it usually works.”
:::

## 4. Beyond Locks: Space Deadlock and Dining Lawyers

Deadlock is not only about mutexes.

Memory-space deadlock:

![Space deadlock with two threads](lec11_materials/space_deadlock_two_threads.png)

- Two threads each request two units.
- If total capacity is only two units, each can hold one and wait forever for the second.

Dining lawyers:

![Dining lawyers deadlock setup](lec11_materials/dining_lawyers_problem.png)

- Five lawyers, five chopsticks, each needs two.
- If all grab one simultaneously, no one can proceed.

:::tip Key Question: what is the policy-level insight from dining lawyers?
**Question (slide wording): Can we formalize “never let everyone get stuck with one chopstick”?**

Answer:
- Yes. The key is to enforce rules that block at least one deadlock condition (typically hold-and-wait or circular wait).
- This is exactly why formal models and avoidance checks are introduced next.
:::

## 5. Four Necessary Conditions for Deadlock

![Four requirements for deadlock](lec11_materials/deadlock_four_conditions.png)

Deadlock can occur only if all four hold:

1. **Mutual exclusion**
2. **Hold and wait**
3. **No preemption**
4. **Circular wait**

Design implication:

- Breaking any one condition is enough to eliminate deadlock possibility for that resource protocol.

## 6. Resource-Allocation Graph (RAG)

RAG gives a formal language:

![Resource-allocation graph examples](lec11_materials/resource_allocation_graph_examples.png)

- Request edge: \(T_i \rightarrow R_j\)
- Assignment edge: \(R_j \rightarrow T_i\)
- Resource type \(R_i\) can have \(W_i\) instances.

:::remark Key Question: does a cycle always mean deadlock?
**Question (slide wording): Does a circle in a resource-allocation graph mean a deadlock?**

Answer:
- Not always.
- With single-instance resources, cycle strongly indicates deadlock.
- With multiple instances, a cycle may exist while a safe completion order still exists.
:::

## 7. Deadlock Detection Algorithm

Core detection setup:

![Deadlock detection algorithm](lec11_materials/deadlock_detection_algorithm.png)

Use vectors:

- \([FreeResources]\): currently free resources.
- \([Request_X]\): outstanding request of thread \(X\).
- \([Alloc_X]\): resources currently allocated to \(X\).

Algorithm predicate and state update:

$$
[Request_{node}] \le [Avail]
$$

$$
[Avail] = [Avail] + [Alloc_{node}]
$$

Interpretation:

- Repeatedly remove nodes that can finish with available resources.
- If nodes remain in `UNFINISHED`, those nodes are deadlocked under the current state model.

:::warn Key Question: what does “UNFINISHED remains” really mean?
**Question (slide wording): Nodes left in UNFINISHED \(\Rightarrow\) deadlocked — why?**

Answer:
- Every remaining node still needs resources that cannot be satisfied by any executable completion chain.
- So no progress sequence exists without external intervention.
:::

## 8. Four Ways Systems Deal with Deadlock

![Four system-level approaches](lec11_materials/how_systems_deal_with_deadlock.png)

1. **Prevention**: design resource protocol so deadlock cannot occur.
2. **Recovery**: allow deadlock, then detect and repair.
3. **Avoidance**: decide each request dynamically to stay in safe states.
4. **Denial**: ignore deadlock possibility (often called Ostrich strategy in apps).

Modern OS tendency:

- Keep kernel/critical subsystems deadlock-safe.
- In many application-level contexts, tolerate or delegate responsibility.

## 9. Prevention in Practice: Atomic and Ordered Acquisition

Two practical prevention patterns:

![Consistent lock ordering](lec11_materials/consistent_lock_ordering.png)

- Request required resources atomically (all-or-nothing).
- Enforce a global lock/resource order (`x` before `y`, etc.).

The point is to remove circular wait by construction.

:::tip Key Question: does release order matter?
**Question (slide prompt): Does it matter in which order the locks are released?**

Answer:
- Deadlock prevention mainly depends on **acquire order**, not release order.
- Consistent acquire order prevents cycles from forming.
:::

## 10. Recovery in Practice: Kill, Preempt, or Roll Back

Recovery options:

- Terminate one or more threads and reclaim resources.
- Preempt resources temporarily.
- Roll back work to a known safe point (common in transactional systems).

Trade-off:

- Recovery can restore progress.
- But it may violate program semantics, consistency, or user expectations.

:::error Key Question: why isn’t recovery always acceptable?
**Question (slide intent): If recovery can break deadlock, why not always use it?**

Answer:
- Forced termination/preemption can leave inconsistent state.
- Rollback requires explicit rollback-safe design and metadata.
- In many systems, prevention/avoidance is safer than late repair.
:::

## 11. Avoidance and Safe State

A naive rule says “grant if request does not deadlock right now,” but this is insufficient.

- You must avoid entering **unsafe** states, not only currently deadlocked states.
- Unsafe means no deadlock yet, but future requests can force one.

![Safe vs unsafe vs deadlocked states](lec11_materials/safe_unsafe_deadlocked_states.png)

:::remark Key Question: why can a non-deadlocked state still be dangerous?
**Question (slide wording): No deadlock yet — why may the system still be unsafe?**

Answer:
- Because current grants may eliminate all future feasible completion orders.
- Avoidance checks for existence of at least one safe completion sequence.
:::

## 12. Banker’s Algorithm

Banker’s algorithm formalizes safe-state checking.

![Banker's algorithm and safe-state rule](lec11_materials/bankers_algorithm_safe_state.png)

Key condition used in the simulated completion pass:

$$
[Max_{node}] - [Alloc_{node}] \le [Avail]
$$

Equivalent intuition from slides:

$$
(\text{available resources} - \#\text{requested}) \ge \text{max remaining needed by any thread}
$$

Interpretation:

- Tentatively grant a request.
- Run safety check (detection-style simulation with `Need = Max - Alloc`).
- Commit only if some full completion order still exists.

Dining-lawyers illustration:

![Banker's algorithm with dining lawyers](lec11_materials/bankers_algorithm_dining_lawyers.png)

- Safe if action is not taking the last chopstick, or if someone can complete immediately after.
- Generalized \(k\)-handed rule extends the same “leave a completion path” principle.

:::remark Key Question: why must max claims be known?
**Question (slide wording): Why state maximum resource needs in advance?**

Answer:
- Without max claims, the OS cannot bound future demand.
- Without bounded demand, safe-state simulation loses predictive power.
:::

## 13. Summary

- Deadlock is structured progress failure caused by cyclic resource waits.
- Four conditions provide a complete checklist for possibility.
- RAG and vector algorithms support formal detection.
- Prevention breaks conditions; recovery repairs after failure; avoidance keeps system safe online.
- Banker’s algorithm is the classic safe-state avoidance method.

## 14. Exam Review

### 14.1 Must-know definitions

- **Deadlock**: cyclic waiting where no involved thread can proceed.
- **Starvation**: indefinite waiting that may or may not be cyclic.
- **Safe state**: there exists at least one full completion order.
- **Unsafe state**: no deadlock yet, but deadlock can become unavoidable.
- **Banker’s algorithm**: request-grant policy that preserves safe states.

### 14.2 High-value short-answer templates

1. **Why does “cycle” not always mean deadlock?**  
   Because multi-instance resource types can still permit a safe completion sequence.
2. **How does prevention differ from avoidance?**  
   Prevention constrains protocol statically; avoidance checks each runtime request against safety.
3. **Why is Banker stronger than immediate deadlock checking?**  
   It reasons about future completion feasibility, not only present deadlock.

### 14.3 Common pitfalls

- Treating starvation and deadlock as interchangeable terms.
- Checking only “deadlock now” and ignoring unsafe-state transitions.
- Assuming lock bugs are deterministic and easy to reproduce.
- Ignoring semantic cost of recovery actions (kill/preempt/rollback).

### 14.4 Self-check

:::tip Self-check 1
Given two locks `x` and `y`, construct one deadlocking interleaving and then fix it with a global acquire order.
:::

:::tip Self-check 2
For a resource-allocation graph with a cycle and multi-instance resources, explain a completion order that avoids deadlock.
:::

:::tip Self-check 3
Given `Free`, `Alloc`, and `Max`, compute `Need = Max - Alloc` and determine whether the state is safe.
:::
