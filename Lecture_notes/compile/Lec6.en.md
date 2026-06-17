# Lec6: Runtime Environments

A compiler is not finished when it emits instructions. Those instructions still need a world to live in: memory must be organized, data must be stored and found, procedures must be called and returned from, and dynamic data must be allocated and reclaimed. This lecture studies that world, namely the runtime environment.

## 1. Why Runtime Matters

**The runtime environment implements storage organization and procedure abstraction.** It is the part that makes compiled code actually runnable.

The lecture packages that idea into a compact equation:

$$
\text{Executable File} = \text{computation represented by the source program} + \text{runtime environment realized through architecture / OS interfaces}
$$

So the compiler is never generating "just the program logic". It is also committing to a storage model, a calling model, and the low-level conventions that connect the program to the architecture or virtual machine.

![Runtime environment as the bridge from executable code to actual execution](lec06_materials/runtime_environment_role.png)

That runtime layer must respect the source language itself. An object-oriented language may need inheritance metadata and virtual tables. A functional language may need closures and garbage collection. A systems language may expose stack allocation, manual memory management, or strict ownership rules.

:::remark 📝 Question: Why must the runtime environment depend on the source language?
Question: **Why is runtime design not just a machine-level issue?**

Answer: because the runtime must preserve the language features that remain meaningful after parsing and semantic analysis. Procedure calls, scope rules, object layout, dispatch, closures, exceptions, and memory lifetime are language-level commitments, and the runtime is where those commitments become executable behavior.
:::

## 2. From Three-Address Code to Real Execution

The lecture first asks a very concrete question: how would the three-address code for `fib` actually run?

One useful mental model is a tiny virtual machine with operations such as:

- `vm_get(name)` and `vm_set(name, value)` for variable access;
- `vm_param(value, idx)` for passing arguments;
- `vm_call(name, nargs)` for transferring control to a procedure;
- `vm_ret(value)` for returning a value.

The machine state then includes at least:

- the code being executed;
- a variable table;
- a function table with entry positions and parameter lists;
- a program counter `pc`;
- a return-address stack `ra`;
- a return-value register such as `a0`;
- a parameter stack.

This explains how linear IR can be executed one step at a time, but it also exposes an important weakness: if every variable lives in one global table, then lexical scope is not respected, and recursive calls cannot create separate copies of local state.

That is the point where runtime design stops being a toy interpreter detail and becomes a real compiler problem.

The same idea also appears when lowering three-address code to target code. The executable must not only encode the computation, but also lay out data and obey machine calling conventions.

![Lowering three-address code into target code plus runtime conventions](lec06_materials/three_address_to_target_code.png)

On a native target such as RISC-V:

- global data may live in the `.data` segment;
- code may live in the `.text` segment;
- `a0` may carry the first argument and the return value;
- `ra` may store the return address.

:::warn ⚠️ Question: What is wrong with the naive "one global variable table" virtual machine?
Question: **Why is the simple VM design not enough for a real language implementation?**

Answer: because it erases the distinction between different activations of the same procedure and between different scopes that reuse the same source-level names. Without per-activation storage, recursion breaks; without scope-aware storage, name binding becomes wrong.
:::

## 3. Storage Organization

### 3.1 Static and Dynamic Allocation

Before code generation finishes, the compiler must decide how the target runtime will allocate space for program objects.

Objects that may require storage include:

- source-language data objects;
- temporaries used for intermediate results and argument passing;
- context saved across procedure calls.

The basic distinction is between compile-time and run-time decisions:

- static allocation:
  the compiler can decide the placement from the program text alone;
- dynamic allocation:
  the decision can only be made while the program runs.

Typical examples:

- static:
  constants, globals, and static variables;
- dynamic:
  locals of active procedures and heap objects created by operations like `malloc`.

One subtle point matters: knowing an object's size statically does **not** automatically mean the object should be statically allocated. Its lifetime still decides the right policy.

### 3.2 Pure Static Allocation

**Pure static allocation makes all allocation decisions at compile time.**

Its advantages are simple:

- almost no runtime support is needed;
- access paths can be fixed very early.

Its disadvantages are decisive:

- it does not support recursive procedures;
- it cannot support dynamically created data structures naturally.

The lecture uses classic Fortran as the standard example. Because procedure activations never overlap recursively, storage can be reused across different procedures at different times.

![Static storage reuse in a Fortran-style call graph](lec06_materials/fortran_static_storage_reuse.png)

This is time-sharing reuse of memory, not stack discipline. It works only because the language semantics are restrictive enough.

### 3.3 Stack and Heap Allocation

To support recursive procedures, we need dynamic allocation. The key observation is that procedure activations are nested in time: later calls return earlier, so their lifetimes follow a last-in-first-out pattern.

That is why a **stack** is the natural storage manager for:

- parameters;
- local variables whose lifetime matches one activation;
- saved call context.

Heap allocation serves a different purpose. It is for dynamic data whose:

- size is not fixed before execution;
- lifetime does not match one procedure activation;
- reachability may continue after the creator returns.

So stack allocation is about structured, nested lifetimes; heap allocation is about flexible, non-LIFO lifetimes.

## 4. Procedure Abstraction

### 4.1 Activation Trees

**An activation tree represents dynamic procedure activations as a tree.**

Each node is one activation of one procedure. The root is the entry procedure, and the children of a node are the activations called during that activation, ordered from left to right by call order.

![Activation tree and enter/leave trace for nested procedure calls](lec06_materials/activation_tree_example.png)

This tree gives a clean semantic picture of execution:

- entering a procedure corresponds to visiting its node before its children;
- leaving a procedure corresponds to visiting its node after its children.

:::tip 💡 Question: What do preorder and postorder traversal mean here?
Question: **In the activation tree example, what do preorder and postorder correspond to?**

Answer: preorder corresponds to `enter` events, because we encounter a node when a procedure begins executing. Postorder corresponds to `leave` events, because we finish all child activations before the current activation returns.
:::

### 4.2 Activation Records

A single run of a procedure is called an **activity** or **activation**. The contiguous storage block holding the local information for that activation is an **activation record**, also called a **frame**.

Typical fields include:

- actual parameters;
- a return-value slot;
- a control link to the caller's activation record;
- an access link for nonlocal data access;
- saved machine state, including the return address;
- local data;
- temporaries.

![Typical layout of an activation record](lec06_materials/activation_record_layout.png)

The access link matters when a language allows nested procedures or other nonlocal-variable accesses that follow lexical scope rather than only the dynamic caller chain.

Different execution platforms realize these ideas differently. Native ABIs and virtual machines agree on the need for per-activation storage, but differ in where values live and how control state is represented.

![Comparison between native stack frames and JVM-style frames](lec06_materials/native_vs_vm_stack_frames.png)

For example:

- x86-64/Linux uses registers heavily, passes many values through registers, and stores some call metadata in memory;
- the JVM has no general-purpose programmer-visible registers in this sense, so evaluation happens through the operand stack inside each frame.

### 4.3 ARP and Variable-Length Locals

**The activation-record pointer (ARP) points to the activation record of the currently running procedure.**

One clean design is to let `ARP` point to the end of the frame's fixed-length region. Then:

- the compiler can precompute offsets for fixed fields such as parameters, control links, and saved state;
- generated code can access them by fixed offsets relative to `ARP`;
- variable-length locals can still grow in the part beyond that fixed region.

![Activation-record pointer positioned at the fixed-length part of the frame](lec06_materials/activation_record_pointer.png)

When variable-length arrays live on the stack, the runtime usually also maintains a stack-top pointer `TOP`.

![Variable-length local data inside a stack-managed activation record](lec06_materials/variable_length_stack_locals.png)

This leads to the restoration rule after a callee returns:

- restore `ARP` from the saved control-link information;
- restore `TOP` by combining the not-yet-restored `ARP` with the callee's fixed-length frame size.

:::remark 📝 Question: How do we recover `ARP` and `TOP` after returning from a procedure with variable-length locals?
Question: **If a callee allocates variable-sized local data on the stack, how does the caller recover the right frame pointers after return?**

Answer: the control information stored in the callee's frame tells us where the caller's activation record was. That restores `ARP`. Then `TOP` can be recomputed from the frame boundary and the fixed-length part of the callee's record, instead of relying on a single constant frame size.
:::

## 5. Implementing Calls and Returns

### 5.1 Call Sequence

The lecture splits a call into two pieces:

- `precall` in the caller;
- `prologue` in the callee.

The caller-side `precall` typically:

- computes actual argument values;
- writes them into the callee's activation record or calling-convention locations;
- saves caller-saved machine state;
- stores the return address and old `ARP`;
- updates `ARP` to the callee's frame.

The callee-side `prologue` typically:

- saves callee-saved machine state;
- initializes local data;
- begins executing the body.

![One design for the call sequence: precall plus prologue](lec06_materials/call_sequence_design.png)

### 5.2 Return Sequence

The lecture splits return symmetrically:

- `epilogue` in the callee;
- `postreturn` in the caller.

The callee-side `epilogue` typically:

- places the return value in the agreed result location;
- restores `ARP` and callee-saved state using the saved information;
- jumps to the stored return address.

The caller-side `postreturn` then:

- retrieves the return value if needed;
- restores caller-saved state;
- continues execution after the call.

![One design for the return sequence: epilogue plus postreturn](lec06_materials/return_sequence_design.png)

:::tip 💡 Question: How does this compare with x86-64/Linux?
Question: **How is the lecture's abstract call/return design similar to and different from a real ABI such as x86-64/Linux?**

Answer: the high-level responsibilities are the same, but a real ABI fixes the exact split. On x86-64/Linux, many arguments and return values travel in registers, `call` and `ret` manipulate return addresses through hardware-supported conventions, the caller/callee-saved split is predefined, and the frame pointer may even be omitted when the compiler can address data relative to the stack pointer safely.
:::

## 6. Heap Management

### 6.1 Goals and Fragmentation

A heap manager must support allocation and reclamation of variable-size memory blocks. Its usual goals are:

- space efficiency:
  keep required heap space small and reduce fragmentation;
- program efficiency:
  let the program run fast, especially with respect to memory hierarchy behavior;
- overhead:
  keep allocation and reclamation operations themselves efficient.

:::warn ⚠️ Question: What is the difference between program efficiency and overhead?
Question: **Why does the lecture list both program efficiency and overhead as separate goals?**

Answer: program efficiency is about how fast the user's program runs using the allocated memory, for example because of good locality. Overhead is about how much extra time and work the memory manager itself spends answering `alloc` and `free` requests. A design can help one and hurt the other.
:::

As allocation and reclamation proceed, the heap tends to break into alternating used blocks and free holes. This is fragmentation.

![Fragmentation and coalescing in heap storage](lec06_materials/heap_fragmentation.png)

Two common consequences follow:

- a request usually consumes only part of a free block, leaving a smaller hole;
- reclamation should often coalesce adjacent holes back into larger ones.

### 6.2 Allocation Policies and Hazards

The lecture reviews several classic policies:

- best-fit:
  choose the smallest free block whose size is at least `N`;
- first-fit:
  choose the first free block whose size is at least `N`;
- next-fit:
  resume the first-fit search from the previous allocation point;
- largest-fit:
  choose the largest free block whose size is at least `N`.

:::remark 📝 Question: When is `largest-fit` reasonable?
Question: **What kind of workload might make `largest-fit` a reasonable choice?**

Answer: it is mainly a niche strategy. It can make sense when requests are usually small and you would rather keep medium-sized holes intact for later requests, while repeatedly carving from a very large free block. In general-purpose allocators, though, it is rarely the default because it can also destroy the largest contiguous space too aggressively.
:::

Manual heap management also creates classic correctness hazards:

- memory leaks:
  unreachable objects are never reclaimed;
- dangling-pointer dereference:
  a program dereferences memory after it has already been freed.

Modern languages and runtimes therefore often add:

- static lifetime reasoning such as ownership;
- smart pointers;
- garbage collection.

## 7. Toy Language Walkthrough

### 7.1 What the Example Language Tests

The lecture ends with a tiny C-like language that has only:

- one `main` function;
- `int` values;
- straight-line core code plus nested blocks.

Even this tiny setting already tests important semantic/runtime ideas:

- temporary values;
- shadowing of identifiers;
- nested lexical scope;
- the need to distinguish bindings that reuse the same source-level name.

### 7.2 Class-Three-Address IR

The target IR keeps pure expressions separated from instruction-level effects:

$$
\begin{aligned}
R &::= id(x)\mid num(i)\mid add(R_1,R_2)\mid sub(R_1,R_2)\mid mul(R_1,R_2) \\
I &::= move(x,R)\mid div(x,R_1,R_2)\mid mod(x,R_1,R_2)\mid ret(R)\mid label(\ell) \\
F &::= func(x,\vec I) \\
P &::= prog(F)
\end{aligned}
$$

So:

- `R` is a pure expression language;
- `I` is the instruction language;
- each function body is a list of instructions.

![Toy-language class-three-address IR and example lowering](lec06_materials/toy_language_class_three_address_ir.png)

The renamed identifiers such as `x.1`, `y.2`, and `%t.4` are especially important. They show that scope and binding have already been resolved before execution. The runtime no longer needs to guess which source-level `x` is meant; the compiler has already turned that question into distinct storage names.

## 8. Exam Review

### 8.1 Must-Know Definitions

- **Runtime environment**: the storage and calling machinery that makes compiled code executable.
- **Static allocation**: allocation decided entirely at compile time.
- **Dynamic allocation**: allocation decided while the program runs.
- **Activation tree**: the dynamic tree of procedure activations.
- **Activation record / frame**: the contiguous storage block used by one activation.
- **Control link**: a pointer to the caller's activation record.
- **Access link**: a pointer used to reach nonlocal data according to lexical scope.
- **ARP**: a pointer to the current activation record.
- **Heap fragmentation**: the splitting of free memory into scattered holes.

### 8.2 Mechanisms You Should Be Able to Explain

- Why the runtime environment is part of the executable, not an afterthought.
- Why pure static allocation cannot support recursive procedures.
- Why procedure activations naturally fit stack discipline.
- Why heap objects need a different management strategy from stack locals.
- How preorder and postorder on the activation tree correspond to execution events.
- What information belongs in an activation record.
- How `precall/prologue` and `epilogue/postreturn` divide responsibility.
- Why `ARP` plus fixed offsets is a useful frame-access design.
- How fragmentation appears and why coalescing matters.

### 8.3 Short-Answer Templates

- Why do we need a runtime environment:
  because executable code still needs storage organization and procedure abstraction to run correctly.
- Why can recursion not use pure static allocation:
  because multiple activations of the same procedure may overlap in time and need distinct local storage.
- Why use a stack for procedure calls:
  because procedure lifetimes are nested and therefore follow LIFO order.
- Why use a heap:
  because some data outlives the procedure that created it or has a size only known at runtime.
- Why activation records matter:
  because each call needs its own parameters, locals, saved state, and links to surrounding context.

### 8.4 Common Mistakes

- treating "size known statically" as identical to "must be statically allocated";
- forgetting that recursion requires multiple simultaneous instances of one procedure's locals;
- confusing control links with access links;
- thinking a simple global variable table is enough for scoped languages;
- treating heap allocation as only a performance issue rather than also a correctness issue;
- mixing up program efficiency with allocator overhead.

### 8.5 Self-Check

- Can you explain why runtime design depends on language features such as scope and object model?
- Can you compare static allocation, stack allocation, and heap allocation by lifetime?
- Can you draw an activation record and label each field?
- Can you describe what `precall`, `prologue`, `epilogue`, and `postreturn` each do?
- Can you explain how fragmentation appears and how coalescing helps?
- Can you explain why renamed IR variables make runtime storage easier to manage?
