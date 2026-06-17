# Lec13: Miscellaneous Topics

## 1. Why This Lecture Is Not Really “Miscellaneous”

This lecture looks like a grab bag at first glance, but the topics actually meet at one point: they all explain what happens after a program stops being “just syntax.” We need a runtime discipline for nested scopes and closures, a storage discipline for heap data, a register discipline for SSA-form IR, and a path-based way to reason about control flow.

So the lecture is best read as four connected stories:

- how nested procedures find nonlocal variables;
- how heap objects are reclaimed automatically;
- how SSA IR is turned into efficient register usage;
- how infinite CFG path sets can still be described and analyzed finitely.

## 2. Nonlocal Access Under Static Scope

**Static scope** means the binding of a name is determined by the lexical nesting structure of the program, not by the dynamic call chain at runtime.

In a nested-procedure language, that immediately raises a question: if function `F` is nested several levels inside outer procedures, how does `F` find variables declared outside itself?

![A nested-procedure example makes lexical visibility concrete: `F` can reach only the bindings allowed by the program text](lec13_materials/static_scope_nested_access.png)

The key fact is that visibility depends on where a procedure is defined, not on who happens to call it. That is why:

- a nested procedure can access locals of its lexical ancestors;
- it cannot access locals of sibling procedures;
- the set of accessible nonlocal variables is known statically.

This static knowledge is what makes the runtime representation systematic rather than ad hoc.

## 3. Access Links and Displays

The lecture first uses **access links** to implement static scope.

Define the **nesting depth** of a procedure as follows: if procedure `p` is defined inside a procedure at depth `i`, then `p` has depth `i + 1`. If procedure `q` is directly nested in `p`, then every activation of `q` carries an access link to the nearest active activation of `p`.

Following one access link always decreases the nesting depth by exactly `1`. Therefore, if code at depth `m` wants a variable declared at depth `n`, it follows the access chain exactly `m - n` times. That number is known at compile time.

When a procedure of depth `m` calls one of depth `n`, establishing the callee's access link depends on the lexical relation:

- if `n = m + 1`, the callee is directly nested in the caller, so the callee links to the caller;
- if `m >= n`, the caller follows its own access links `m - n + 1` times to reach the activation of the procedure that lexically contains the callee.

This works, but the cost of a nonlocal access depends on how far apart the two depths are.

:::remark 📝 **Question: why are access links correct for static scope?**
Because every link follows the lexical-parent relation rather than the arbitrary caller relation. At runtime we may have many active calls, but the access chain always climbs the lexical nesting tree one level at a time. Since the number of levels between a use and its declaration is fixed by the source program, the compiler already knows how many links to follow.
:::

To make nonlocal access constant-time, the lecture introduces the **display** method.

**A display** is a runtime array `d` where `d[i]` points to the nearest active activation record at nesting depth `i`. Then a variable known to live at depth `i` can be reached directly through `d[i]`.

![A display trades pointer-chasing for direct indexing into the nearest active frame at each nesting depth](lec13_materials/display_runtime_example.png)

The maintenance rule is simple:

- on entry to a depth-`n` procedure, save the old `d[n]` in the new activation record;
- set `d[n]` to the new activation record;
- on return, restore the saved old value.

So access links are conceptually simple, while displays optimize repeated nonlocal access into direct indexing.

## 4. Dynamic Scope, Procedure Values, and Closures

The lecture contrasts static scope with **dynamic scope**.

Under dynamic scope, a nonlocal name such as `a` refers to the most recent active binding of that name along the call chain. So the binding is decided at runtime rather than by lexical program text.

![Dynamic scope changes results because a callee can see bindings introduced by whoever called it most recently](lec13_materials/dynamic_scope_scope_stack.png)

That difference is why the same source program can print different results under static and dynamic scope. Modern mainstream languages overwhelmingly prefer static scope because:

- name resolution becomes predictable;
- compilers can reason about bindings statically;
- optimization and modular reasoning become much easier.

The lecture then asks what happens when a procedure itself becomes a value.

If procedure `p` is passed as an argument to procedure `q`, and `q` later calls `p`, then `q` may not know the lexical environment that `p` needs. Passing only a code pointer is therefore insufficient. The caller must also pass the environment needed to resolve `p`'s free variables.

That becomes even more important when a procedure is returned as a result. A plain stack discipline can break: by the time the returned nested procedure is called later, the activation record that originally held its captured variables may already have been popped.

:::warn ⚠️ **Question: why does returning a nested procedure break stack allocation?**
Because the returned procedure may outlive the call that created the variables it refers to. If those variables stayed only in a stack frame, that frame would disappear when the creator returned. Later uses would then hold dangling environment pointers. The implementation must either heap-allocate the relevant environment or move the captured variables to heap-backed storage.
:::

This is exactly why **a closure** is needed for first-class functions.

**A closure** packages code together with the environment required by its free variables. At runtime, the implementation allocates heap space for the outer variables that may escape.

![A closure keeps code and captured environment together, allowing escaped functions to outlive the creating stack frame](lec13_materials/closure_escape_to_heap.png)

The lecture mentions Lua's `upvalue` design:

- an upvalue initially points to stack storage;
- if the variable escapes, the implementation moves it to the heap;
- closures then keep stable references to that heap-resident cell.

So the essential jump is from “procedure pointer” to “procedure plus environment.”

## 5. Garbage Collection: Reachability and Design Goals

Once data can live on the heap, we need a policy for reclaiming memory automatically.

The lecture defines **garbage** in the narrow sense as unreachable data, and **garbage collection** as automatic reclamation of unreachable heap objects.

The central notion is **reachability**:

- the **root set** contains data reachable without dereferencing heap pointers, such as globals and stack variables;
- any object pointed to by the root set is reachable;
- any object pointed to from a reachable object is also reachable.

One crucial property follows:

**Once an object becomes unreachable, it never becomes reachable again.**

That monotonicity is what makes tracing collection possible.

The lecture also emphasizes three design concerns:

- type safety: the collector should know which fields are pointers;
- runtime overhead: total execution time matters;
- pause time and locality: memory management affects responsiveness and cache behavior.

![The simplest garbage example shows how rebinding a pointer can immediately orphan an older heap node](lec13_materials/reference_counting_example.png)

In the small `p` / `q` example, after `q = p`, the heap node formerly referenced by `q` becomes unreachable and therefore collectible.

:::remark 📝 **Question: which operations can change the reachable set?**
Allocation can increase it by creating a fresh object that is immediately connected to roots. Assignments, parameter passing, returns, and procedure exit can move pointers into or out of the root set or out of reachable objects. The important invariant is that these operations may remove the last path to an object, but they never make an already unreachable old object reachable again.
:::

From here the lecture splits GC algorithms into two broad families:

1. track reference updates continuously and reclaim objects as soon as they become isolated;
2. periodically trace all reachable objects and reclaim the rest.

## 6. Reference Counting and Weak References

**Reference counting** attaches a counter to each object.

The core rules are:

- on allocation, initialize the count;
- when a new pointer to the object is created, increment the count;
- when a pointer is overwritten or disappears, decrement the count;
- if the count becomes `0`, reclaim the object, but first decrement the counts of objects it points to.

That last rule matters because freeing one object can cascade and make other objects unreachable too.

![The update `Y = X` shows why decrement-before-free and recursive processing of outgoing pointers are both essential](lec13_materials/reference_counting_example.png)

Reference counting has several appealing properties:

- it is incremental rather than one giant stop-the-world sweep;
- reclamation can happen promptly;
- it is simple enough to integrate with smart-pointer systems.

But it also has three classic drawbacks:

- every object needs space for its counter;
- pointer updates become more expensive;
- cyclic garbage is not collected.

The cycle problem is fundamental:

- three objects may point to one another;
- each can still have count `1`;
- yet none is reachable from the program anymore.

To mitigate some cyclic patterns, the lecture introduces **weak references**. A weak reference does not contribute to the reference count. Typical examples include parent pointers in tree-like structures.

Weak references help break ownership cycles, but they do not remove the need to check validity before dereferencing them.

## 7. Tracing Collectors: Mark-Sweep, Compacting, Copying, and Generations

Tracing collectors ignore reference counts and instead ask a different question: starting from the roots, which objects are still reachable right now?

The basic **mark-and-sweep** algorithm has two phases:

1. traverse from the root set and mark every reachable object;
2. sweep the heap and free every unmarked object.

![Tracing from roots separates the live subgraph from the unreachable one, which can then be reclaimed in bulk](lec13_materials/mark_sweep_reachability_example.png)

In the lecture's example, objects `A, D, E, F, G, H, I` stay live, while `B` and `C` are reclaimed after the current procedure returns.

Mark-sweep handles cycles naturally, but plain sweeping can leave fragmentation. That leads to **mark-and-compact**:

- mark reachable objects;
- compute their new addresses;
- move them toward one end of the heap;
- update all pointers.

Compacting improves locality and turns scattered free holes into one large contiguous free region.

The lecture then introduces the **copying collector**:

- split the heap into `From` and `To` semispaces;
- allocate only in `From`;
- when `From` is full, copy reachable objects into `To`;
- swap the roles of the two spaces.

The benefit is that compaction happens naturally during copying. The cost is that only half the heap is available for active allocation at a time.

Finally, the lecture explains **generational collection**. The empirical observation is simple but powerful: most objects die young. So the heap is divided by object age, and younger generations are collected more frequently than older ones.

![A generational layout spends most collection effort where objects die most often: in the youngest region](lec13_materials/generational_gc_layout.png)

This design avoids tracing the entire heap at every collection and is therefore one of the most practically important GC ideas.

:::tip 💡 **Question: why does generational GC usually work well in practice?**
Because real programs create many short-lived temporary objects: parser nodes, iterator results, closures for small scopes, intermediate strings, and so on. If most of those die quickly, a collector gains a lot by repeatedly scanning only the youngest region and touching older regions much less often.
:::

## 8. Lowering SSA IR to Target Code

The lecture then shifts from memory management to backend code generation.

When lowering SSA-form IR with block parameters or phi-functions, the compiler typically inserts register-to-register moves on incoming control-flow edges so that each block starts with the values its SSA parameters expect.

The running `pow` example illustrates the whole chain:

- block-parameter IR;
- equivalent phi-form IR;
- final target code with explicit loads, arithmetic, branches, and moves.

![Lowering SSA merges to target code starts by inserting explicit register moves on control-flow edges](lec13_materials/ssa_to_target_code_pow.png)

One resulting version of the target code is:

```text
pow:
  LD R1, b
  LD R2, e
  LD R3, #1
  LD R4, R2
  LD R5, R3
  BR loop
loop:
  BGTZ R4, body
  BR done
body:
  MUL R6, R5, R1
  LD R7, #1
  SUB R8, R4, R7
  LD R4, R8
  LD R5, R6
  BR loop
done:
  RET R5
```

The natural next step is liveness analysis and construction of the interference graph.

## 9. Why SSA Interference Graphs Are Chordal

An interference graph connects two symbolic registers when their live ranges overlap, so they cannot share the same physical register.

The lecture's key graph-theoretic definition is:

**A chordal graph is an undirected graph in which every cycle of length at least `4` has a chord.**

A **chord** is an edge between two nonadjacent vertices on that cycle.

![A non-SSA example can yield a non-chordal interference graph, while SSA renaming restores the chordal structure](lec13_materials/ssa_interference_chordal_vs_nonchordal.png)

The lecture presents an important fact from the literature:

**Interference graphs of SSA-form IR are chordal.**

That matters because chordal graphs admit efficient optimal coloring strategies.

Two more definitions explain the coloring algorithm:

- **a simplicial vertex** is one whose neighbors already form a clique;
- **a simplicial elimination sequence** is an ordering in which each vertex is simplicial in the subgraph induced by itself and the earlier vertices in the sequence.

For chordal graphs:

- a simplicial elimination sequence exists;
- it can be computed in polynomial time, in fact `O(|V| + |E|)`;
- greedy coloring in that order is optimal.

This is a beautiful case where an IR design choice, namely SSA, gives the backend a graph family with unusually pleasant structure.

:::remark 📝 **Question: what does SSA buy here beyond prettier variable names?**
SSA does much more than rename assignments. It reshapes liveness so that interference becomes chordal, which means the graph is far easier to color optimally. In other words, SSA is not only a mid-level analysis format; it also creates backend-friendly structure for register allocation.
:::

## 10. Coalescing and Linear Scan Register Allocation

After graph construction, we would like to eliminate unnecessary register-to-register moves. That is the job of **coalescing**: merge two noninterfering nodes so they can share one physical register.

The catch is that careless coalescing may destroy chordality. The lecture therefore discusses a safer strategy: first compute the chordal structure and candidate colors, then coalesce only when the merged node can still be assigned a color unused by all of its neighbors.

On the `pow` example, repeated safe coalescing gradually removes the inserted `LD Rs, Rt` copies until the code simplifies to:

```text
pow:
  LD R1, b
  LD R2, e
  LD R3, #1
  BR loop
loop:
  BGTZ R2, body
  BR done
body:
  MUL R3, R3, R1
  LD R4, #1
  SUB R2, R2, R4
  BR loop
done:
  RET R3
```

So SSA-based coalescing is really about recovering the clean code shape that phi- or block-parameter lowering temporarily obscured.

The lecture then turns to **Linear Scan Register Allocation (LSRA)**. Instead of coloring a full interference graph, LSRA computes one live interval per symbolic register and scans the code linearly.

Its appeal is practical:

- compile time is close to linear in code size;
- code quality is often close to graph coloring;
- JIT compilers value speed of compilation very highly.

![Live intervals make conflicts visible as interval overlaps, which linear scan can process in one forward sweep](lec13_materials/linear_scan_interval_overlap.png)

The core LSRA workflow is:

1. compute live intervals;
2. scan intervals in order of starting point;
3. maintain an active set ordered by interval end;
4. expire intervals that have ended;
5. assign a free register if possible, otherwise choose an interval to spill.

One common heuristic is to spill the active interval whose end is farthest away.

The lecture gives the complexity as:

$$
O(|V| \log |R|)
$$

where `|V|` is the number of symbolic registers and `|R|` the number of physical registers.

:::tip 💡 **Question: why do JIT compilers like linear scan so much?**
Because a JIT is optimizing under a wall-clock budget seen directly by the user. A slightly worse allocation that compiles fast is often a better product choice than a globally smarter algorithm with noticeably higher compilation latency. Linear scan sits in that sweet spot surprisingly often.
:::

## 11. Interval Splitting

The lecture closes the register-allocation part with **live-interval splitting**.

The idea is simple: one long live interval may overlap with many short ones and therefore create avoidable pressure. If we store a value temporarily and reload it later, we can split that one long interval into smaller intervals that overlap less.

![Splitting one long interval around a loop can reduce overlap and lower the register pressure seen by linear scan](lec13_materials/live_interval_splitting.png)

In the lecture's example, a value held in `R1` is stored before the loop and reloaded afterward as `R4`. That creates two shorter live intervals instead of one long cross-loop interval.

So interval splitting is a controlled tradeoff:

- add memory traffic in a few places;
- reduce simultaneous register demand over a larger region.

This is often worthwhile around loops or long-lived values that are dormant for many instructions.

## 12. Path Expressions for Infinite CFG Path Sets

The final topic asks a foundational question:

**What is dataflow analysis really analyzing?**

At heart, it analyzes sets of CFG paths. But a CFG with loops has infinitely many paths, so we need a finite notation for an infinite path set.

That notation is the **path expression**.

**A path expression** on a directed graph `G = (V, E)` is a regular expression over the alphabet `E`, with the additional requirement that every recognized string must be a valid path in `G`.

![A path expression uses regular-expression structure to describe all paths between two graph nodes, including looping ones](lec13_materials/path_expression_graph_example.png)

For the lecture's graph, the alphabet is:

$$
\Sigma = \{\langle a,b \rangle,\ \langle b,d \rangle,\ \langle b,c \rangle,\ \langle d,a \rangle,\ \langle d,c \rangle,\ \langle d,e \rangle,\ \langle e,d \rangle\}
$$

All paths from `a` to `c` can be described by:

$$
\big(\langle a,b\rangle \langle b,d\rangle (\langle d,e\rangle \langle e,d\rangle)^* \langle d,a\rangle\big)^*
\langle a,b\rangle
\big(\langle b,c\rangle \mid \langle b,d\rangle (\langle d,e\rangle \langle e,d\rangle)^* \langle d,c\rangle\big)
$$

This one finite expression describes infinitely many concrete paths because the starred subexpressions encode arbitrary numbers of loop traversals.

## 13. Dataflow Analysis via Path Expressions

The lecture first reuses path expressions for shortest-path computation.

Let `F(r)` be the minimum length of all paths recognized by expression `r`. Then:

$$
F(\varepsilon) = 0
$$

$$
F(\langle u_1, u_2 \rangle) = \mathrm{length}(\langle u_1, u_2 \rangle)
$$

$$
F(r_1 \mid r_2) = \min(F(r_1), F(r_2))
$$

$$
F(r_1 r_2) = F(r_1) + F(r_2)
$$

$$
F(r_1^*) =
\begin{cases}
-\infty, & F(r_1) < 0 \\
0, & \text{otherwise}
\end{cases}
$$

Because the edge `\langle d,e \rangle` has weight `-1` and `\langle e,d \rangle` has weight `2`, one cycle around `d \to e \to d` has total weight `1`, so its Kleene star contributes `0` rather than `-\infty`. The lecture's worked expression therefore evaluates to shortest-path value `1`.

The same formalism can describe CFG paths for forward and backward dataflow analysis.

![Forward and backward analyses differ only in which family of paths we summarize from each CFG point](lec13_materials/cfg_path_expressions.png)

For the shown CFG:

$$
BB2_{\mathrm{forward}} = e_1 e_2 \big((e_3 \mid e_4 e_5)e_6\big)^*
$$

$$
EXIT_{\mathrm{forward}} = e_1 e_2 \big((e_3 \mid e_4 e_5)e_6\big)^* (e_3 \mid e_4 e_5)e_7
$$

$$
ENTRY_{\mathrm{backward}} = e_1 e_2 (e_3 \mid e_4 e_5)\big(e_6 (e_3 \mid e_4 e_5)\big)^* e_7
$$

Now lift path expressions from path sets to dataflow transformers. Let the dataflow domain be `V`, let meet be `\wedge`, and let each basic block `B` have transfer function `f_B : V \to V`. Then the lecture defines:

$$
F(\varepsilon) = \mathrm{id}
$$

$$
F(e) = f_{h(e)}
$$

$$
F(r_1 \mid r_2) = F(r_1) \wedge F(r_2)
$$

$$
F(r_1 r_2) = F(r_2) \circ F(r_1)
$$

$$
F(r_1^*) = \bigwedge_{i \ge 0} F(r_1)^i
$$

So the regular-expression operators become meet, composition, and iterative closure over transfer functions.

:::remark 📝 **Question: how can one finite expression stand for infinitely many CFG paths?**
Because the infinity comes from repetition, and repetition is exactly what the Kleene star captures. Instead of listing every loop iteration count separately, a path expression factors the path family into concatenation, choice, and repetition. That is the same compression trick that makes regular expressions finite descriptions of infinite languages.
:::

## 14. Reaching Definitions Without Iteration

The lecture ends with a reaching-definitions example expressed entirely in the path-expression framework.

The CFG contains definitions:

- `d1: i = m - 1`
- `d2: j = n`
- `d3: a = u1`
- `d4: i = i + 1`
- `d5: j = j - 1`
- `d6: a = u2`
- `d7: i = u3`

![Reaching definitions can be composed symbolically by path expressions instead of solved only by iterative fixed-point propagation](lec13_materials/reaching_definitions_path_expression.png)

The dataflow abstraction is:

$$
F(r)(I) = (I - kill_r) \cup gen_r
$$

The slide computes the relevant `gen` / `kill` sets bottom-up:

$$
gen_{e_4 e_5} = \{d_4, d_5, d_6\}, \qquad
kill_{e_4 e_5} = \{d_1, d_2, d_3, d_7\}
$$

$$
gen_{e_3 \mid e_4 e_5} = \{d_4, d_5, d_6\}, \qquad
kill_{e_3 \mid e_4 e_5} = \{d_1, d_2, d_7\}
$$

$$
gen_{(e_3 \mid e_4 e_5)^*} = \{d_4, d_5, d_6\}, \qquad
kill_{(e_3 \mid e_4 e_5)^*} = \{\}
$$

The point is not that iterative dataflow analysis is wrong. The point is that path expressions provide another exact formulation, and in examples like this one the result can be derived compositionally without a standard worklist iteration.

## 15. Exam Review

### 15.1 Core Definitions You Should Be Able to State

- **Static scope**: name binding determined by lexical nesting.
- **Dynamic scope**: name binding determined by the dynamic call chain.
- **Access link**: pointer from an activation record to the nearest active frame of its lexical parent.
- **Display**: array indexed by nesting depth, each entry pointing to the nearest active frame at that depth.
- **Closure**: code plus the environment needed by its free variables.
- **Garbage**: unreachable heap data.
- **Root set**: directly reachable starting points for reachability.
- **Chordal graph**: graph in which every cycle of length at least `4` has a chord.
- **Simplicial vertex**: vertex whose neighbors form a clique.
- **Path expression**: regular expression over CFG or graph edges whose words are valid paths.

### 15.2 Mechanisms You Should Be Able to Explain

- how access links find a variable declared several lexical levels outward;
- why displays reduce nonlocal access to constant-time indexing;
- why first-class functions require closures rather than raw code pointers;
- why reference counting reclaims promptly but misses cycles;
- how mark-sweep differs from mark-compact and copying collection;
- why generational GC relies on the empirical “most objects die young” principle;
- why SSA interference graphs are easier to color;
- how LSRA uses live intervals instead of a full interference graph;
- how path expressions summarize infinite path families finitely.

### 15.3 Short-Answer Templates

- **Why is a closure necessary?**  
  A nested function may outlive the activation record that created its free variables. A closure keeps the code together with a persistent environment, usually heap-backed, so later calls still see valid bindings.

- **Why can't plain reference counting collect every garbage object?**  
  Cyclic structures can keep one another's counts above zero even when no root can reach them.

- **Why does SSA help register allocation?**  
  SSA reshapes liveness so that the interference graph is chordal, enabling efficient optimal coloring strategies.

- **Why are path expressions useful in dataflow analysis?**  
  They give a finite algebraic description of infinitely many CFG paths and let us lift regular-expression structure to transfer-function composition.

### 15.4 Common Confusions

- Access links follow lexical parents, not the runtime caller chain in general.
- Displays optimize lookup cost, but still represent the same lexical-scope discipline.
- Returning a nested function is not safe with stack-only environments.
- Weak references help with ownership cycles, but they are not ordinary strong references.
- Copying collection improves locality, but it pays with semispace overhead.
- Linear scan is fast, not always globally optimal.
- A path expression describes a set of paths, not one concrete execution trace.

### 15.5 Self-Check List

- Can you compute how many access links to follow for a nonlocal variable?
- Can you explain the runtime difference between static and dynamic scope on the same code?
- Can you compare reference counting, mark-sweep, mark-compact, copying, and generational GC?
- Can you explain why SSA makes the interference graph chordal?
- Can you describe the active-set invariant in linear scan?
- Can you write a path expression for a looping CFG fragment and map it to a dataflow transformer?
