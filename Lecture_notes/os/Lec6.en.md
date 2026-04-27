# Lecture 6: Synchronization 2 - Lock Implementation

## Learning Objectives

By the end of this lecture, you should be able to:

1. Explain why mutex-only solutions are not enough for bounded-buffer coordination.
2. State semaphore semantics and map `P/Down` and `V/Up` to wait/signal behavior.
3. Build the full producer-consumer design with `emptySlots`, `fullSlots`, and `mutex`.
4. Reason about ordering constraints in semaphore operations and deadlock risk.
5. Analyze the "Too Much Milk" sequence from failed fixes to a correct-but-unsatisfying solution.
6. Summarize synchronization concepts used as building blocks for lock implementation.

## 1. Why We Need More Than a Mutex

### 1.1 Bounded buffer has multiple constraints, not one

For producer-consumer, we must satisfy all of these at the same time:

- Consumer waits when there is no item.
- Producer waits when the buffer is full.
- Only one thread manipulates queue internals at a time.

A single mutex can protect queue integrity, but it cannot by itself encode "not empty" and "not full" waiting conditions efficiently.

:::warn ⚠️ Key Question
**What goes wrong if we only keep trying lock-based waiting loops?**

Answer:
- If we wait while holding the lock, the other side cannot enter and unblock us.
- If we release/reacquire in a tight loop, correctness may improve but we burn CPU in busy waiting.
- We need a primitive that combines counting + blocking wakeup.
:::

### 1.2 Correctness constraints as a checklist

You can treat this as a design checklist:

1. Scheduling constraint A: consumer must block if there is no full slot.
2. Scheduling constraint B: producer must block if there is no empty slot.
3. Mutual exclusion: queue pointers/data must be updated atomically.

A useful invariant is:

$$
\text{emptySlots}+\text{fullSlots}=\text{bufSize}
$$

## 2. Recall: Semaphores as Generalized Locks

Semaphores were introduced in the lecture as the right primitive for this pattern.

- **A semaphore has a non-negative integer value.**
- **Down()/P() waits until value is positive, then decrements by 1.**
- **Up()/V() increments by 1 and may wake a waiting thread.**

Formalized from the slide content:

$$
s \in \mathbb{Z}_{\ge 0}
$$

$$
P(s):\ \text{wait until } s>0,\ s\leftarrow s-1
$$

$$
V(s):\ s\leftarrow s+1
$$

:::remark 📝 Key Question
**How should we mentally map `P` and `V`?**

Answer:
- `P` is the wait/acquire direction for an available resource token.
- `V` is the signal/release direction that returns one token.
- In bounded buffer, tokens represent empty slots, full slots, or exclusive access.
:::

## 3. Full Semaphore Solution for Bounded Buffer

### 3.1 Initialization and roles

The complete setup uses three semaphores:

$$
\text{fullSlots}=0,\quad \text{emptySlots}=\text{bufSize},\quad \text{mutex}=1
$$

- `fullSlots`: how many produced items are available.
- `emptySlots`: how many free positions remain.
- `mutex`: binary semaphore for queue critical section.

![Full semaphore-based bounded-buffer solution](lec06_materials/semaphore_bounded_buffer_full_solution.png)

### 3.2 Why producer and consumer code is asymmetric

Producer and consumer are intentionally not mirror images in token meaning:

- Producer: consume `emptySlots`, then publish `fullSlots`.
- Consumer: consume `fullSlots`, then publish `emptySlots`.

![Discussion of asymmetry and ordering](lec06_materials/semaphore_ordering_discussion.png)

:::tip 💡 Key Question
**Why asymmetry?**

Answer:
- Producer removes one empty slot and creates one occupied slot.
- Consumer removes one occupied slot and creates one empty slot.
- The asymmetry is exactly the resource-flow direction.
:::

### 3.3 Is operation ordering important?

The lecture raises three practical ordering questions:

- **Is order of P's important?** Yes. Wrong order can deadlock.
- **Is order of V's important?** Usually not for safety, but it can affect scheduling efficiency.
- **If we have 2 producers or 2 consumers, do we need to change anything?** No, the same semaphore structure scales.

:::warn ⚠️ Key Question
**Why can `P(mutex)` before `P(emptySlots)` deadlock?**

Answer:
- A producer may grab `mutex` first, then block waiting for `emptySlots`.
- A consumer that could free space now cannot enter the critical section.
- This creates a circular wait condition.
:::

## 4. Where Synchronization Is Going

The lecture connects layers from hardware primitives to user-visible abstractions.

![Synchronization abstraction hierarchy](lec06_materials/synchronization_abstraction_hierarchy.png)

Practical interpretation:

- Hardware gives atomic building blocks (load/store + stronger atomic ops).
- OS/runtime builds locks/semaphores/monitors/send-receive on top.
- Applications should use higher-level APIs whenever possible.

:::remark 📝 Key Question
**Where are we going with synchronization?**

Answer:
- Build robust high-level synchronization primitives on top of atomic operations.
- Avoid forcing every program to manually compose correctness from raw load/store.
:::

## 5. Motivating Example: Too Much Milk

### 5.1 Real-world timeline and correctness properties

The example maps everyday coordination to thread synchronization.

![Real-life timeline for too-much-milk](lec06_materials/too_much_milk_real_life_timeline.png)

Required correctness properties are:

1. Never more than one buyer when milk is needed.
2. Someone buys if milk is needed.

:::tip 💡 Key Question
**What correctness properties must any solution satisfy?**

Answer:
- Safety: do not buy twice unnecessarily.
- Liveness: do not end up with nobody buying when milk is needed.
:::

### 5.2 Solution #1: One shared note after checking

Idea: check state, then leave/remove a note around buying.

Problem: it can still fail intermittently due to context switches between checks and updates.

:::error ⛔ Key Question
**Result of Solution #1?**

Answer:
- Still too much milk, but only occasionally.
- Intermittent bugs are especially dangerous because they are hard to reproduce and debug.
:::

### 5.3 Solution #1.5: Place note first

Attempted fix: leave note before checking.

Problem: can cause the opposite failure mode where no one buys milk.

:::warn ⚠️ Key Question
**What happens when we place the note first in this variant?**

Answer:
- Both participants may observe a note-based condition that makes each skip buying.
- Liveness breaks: needed work may never happen.
:::

### 5.4 Solution #2: Labeled notes

Idea: each thread leaves its own labeled note (`A` or `B`) and checks the other.

![Labeled-note solution attempt](lec06_materials/too_much_milk_solution2_labeled_notes.png)

Problem: under unlucky interleavings, both threads can believe the other will buy.
This is starvation/lockup behavior.

:::error ⛔ Key Question
**Does labeled-note Solution #2 fully work?**

Answer:
- No.
- It can still violate liveness by letting both sides defer forever.
:::

### 5.5 Solution #3: Two-note waiting protocol

This version introduces explicit waiting logic (`while(Note B)` on one side plus conditional logic on the other side).

![Two-note protocol (Solution #3)](lec06_materials/too_much_milk_solution3_protocol.png)

The slide then proves correctness via interleaving cases:

- Case 1: `leave note A` happens before `if(noNote A)`.
- Case 2: `if(noNote A)` happens before `leave note A`.

![Case 1 interleaving argument](lec06_materials/too_much_milk_solution3_case1.png)

![Case 2 interleaving argument](lec06_materials/too_much_milk_solution3_case2.png)

:::tip 💡 Key Question
**Why does Solution #3 finally work?**

Answer:
- In each interleaving, a thread can conclude one of two safe outcomes:
  - It is safe for me to buy now, or
  - The other thread will buy, so I can quit safely.
- That jointly preserves safety and liveness.
:::

### 5.6 Why Solution #3 is still unsatisfying

Even though it is correct, it is not a good engineering endpoint:

- Too complex for a simple task.
- Thread A and B logic are asymmetric and hard to scale.
- Waiting thread consumes CPU (busy waiting).

:::warn ⚠️ Key Question
**What lesson should we keep from Solution #3 discussion?**

Answer:
- Correctness alone is not enough; clarity, scalability, and efficient waiting matter.
- We want cleaner abstractions supported by hardware atomic primitives.
:::

## 6. Core Definitions to Memorize

- **Synchronization: using atomic operations to ensure cooperation between threads.**
- **Mutual Exclusion: ensuring that only one thread does a particular thing at a time.**
- **Critical Section: piece of code that only one thread can execute at once.**
- **Locks: synchronization mechanism for enforcing mutual exclusion on critical sections.**
- **Semaphores: synchronization mechanism for enforcing resource constraints.**
- **Atomic Operation: an operation that runs to completion or not at all.**

## Appendix: Exam Review

### A. Must-know definitions

- Semaphore, mutex, mutual exclusion, critical section, atomic operation.
- Safety vs liveness in concurrent algorithms.
- Busy waiting and why it is often undesirable.

### B. Mechanism narrative (bounded buffer)

1. Producer waits on `emptySlots` before entering queue critical section.
2. Producer acquires `mutex`, enqueues, releases `mutex`.
3. Producer signals `fullSlots`.
4. Consumer waits on `fullSlots`, acquires `mutex`, dequeues, releases `mutex`.
5. Consumer signals `emptySlots`.

### C. Short-answer templates

- Why three semaphores?
  - Separate counting constraints from mutual exclusion.
- Why is `P` ordering sensitive?
  - Wrong blocking order can hold one resource while waiting for another.
- Why can a "human-looking" protocol fail on computers?
  - Context switches expose interleavings humans do not naturally reason about.

### D. Common pitfalls

- Treating mutex as both queue protection and condition synchronization.
- Busy waiting under lock or with high-frequency lock churn.
- Forgetting to specify both safety and liveness goals before coding.

### E. Self-check list

- Can I derive the roles of `emptySlots`, `fullSlots`, and `mutex` without memorizing code?
- Can I explain exactly why `P` ordering may deadlock?
- Can I state both correctness properties in Too-Much-Milk?
- Can I explain why Solution #3 is correct yet still poor as an API pattern?
