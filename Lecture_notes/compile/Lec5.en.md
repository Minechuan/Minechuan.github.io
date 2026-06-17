# Lec5: Intermediate Representations

An intermediate representation, or IR, is the compiler's internal language for talking about a program after it has understood the source but before it has committed to machine code. This lecture is really about two questions: what should that internal language look like, and how do we generate it systematically?

## 1. Why IR Exists

**IR is a representation of program semantics.** The front end understands the source program; the back end understands the target machine. IR is the bridge between them.

That bridge matters for at least three reasons:

- it decouples front ends from back ends;
- it gives optimizers a uniform object to analyze and transform;
- it lets the compiler move from source-oriented structure to machine-oriented structure in controlled steps.

Retargeting is the first big motivation. A modern compiler often supports several source languages and several target architectures. Without IR, every front end would need to know every target, and every back end would need to understand every source language directly.

Once an optimizer is inserted between front end and back end, IR becomes even more central. Optimizations are usually organized as many simple passes, and those passes need a stable internal program form.

:::remark 📝 Question: Why does compilation need an intermediate representation?
Question: **Why does compilation need IR instead of translating source code directly to target code?**

Answer: because the compiler has to solve two different problems. The front end extracts meaning from the source language, while the back end expresses that meaning for a specific machine. IR separates those concerns, so analysis, optimization, and retargeting do not all get tangled into one monolithic translation step.
:::

## 2. IR Design Dimensions

The lecture emphasizes that IR design is not one yes-or-no choice. We should think along several largely independent dimensions.

- organization structure:
  graph-like IR, linear IR, or a hybrid;
- abstraction level:
  closer to source language or closer to target machine;
- naming strategy:
  how the IR names intermediate values.

For abstraction level, the lecture uses two-dimensional array access as a concrete example. If the source program contains `A[i,j]`, a high-level IR may preserve "subscript access" as one semantic object. A lower-level IR may expand it into explicit offset arithmetic:

$$
\begin{aligned}
t_0 &= i - 1 \\
t_1 &= t_0 * 10 \\
t_2 &= j - 1 \\
t_3 &= t_1 + t_2 \\
t_4 &= t_3 * 4 \\
t_5 &= A[t_4]
\end{aligned}
$$

The high-level form is better when we want source-like analysis of arrays. The low-level form is better when we want machine-oriented optimization.

![Source-like vs machine-like array access IR](lec05_materials/ir_abstraction_levels.png)

A real compiler usually uses more than one IR. Rust is the lecture's concrete example:

- AST and HIR remain closer to source structure;
- MIR is a hybrid form with explicit control flow and Rust-specific type information;
- LLVM IR is more machine-oriented and more language-neutral.

![Rust compiler pipeline from AST to HIR, MIR, and LLVM IR](lec05_materials/rust_mir_design.png)

:::tip 💡 Question: Why do real compilers often use several IRs instead of one?
Question: **If IR is so important, why not design one perfect IR and use it for everything?**

Answer: because different compiler tasks want different kinds of information exposed. Source-level analyses benefit from high-level structure, while low-level optimizations and code generation prefer explicit control flow, explicit storage effects, and machine-friendly operations. One form is usually not ideal for every phase.
:::

## 3. Graph-Structured IRs

### 3.1 Abstract Syntax Trees

**An AST is similar to a parse tree, but removes redundant information that does not affect semantics.** Parentheses, many grammar-specific helper nodes, and other syntactic scaffolding disappear.

For expressions, booleans, and statements, the lecture uses AST grammars like:

$$
\begin{aligned}
E &::= \operatorname{add}(E,E)\mid \operatorname{sub}(E,E)\mid \operatorname{mul}(E,E)\mid \operatorname{div}(E,E)\mid x\mid i \\
B &::= \operatorname{or}(B,B)\mid \operatorname{and}(B,B)\mid \operatorname{eq}(E,E)\mid \operatorname{le}(E,E)\mid \operatorname{not}(B)\mid \operatorname{true}\mid \operatorname{false} \\
S &::= \operatorname{block}(\vec S)\mid \operatorname{assign}(x,E)\mid \operatorname{if}(B,S,S)\mid \operatorname{while}(B,S)\mid \operatorname{ret}(E)
\end{aligned}
$$

The point is not the exact constructor names. The point is that ASTs preserve semantic structure while dropping grammar noise.

![AST example for an assignment statement](lec05_materials/ast_statement_example.png)

### 3.2 Directed Acyclic Graphs

**A DAG is like an AST, but merges identical subtrees.** That makes common subexpressions explicit.

For

```c
a = b * -c + b * -c;
```

an AST contains two separate copies of `b * -c`, while a DAG can share one node and show that both uses depend on the same computed expression.

This makes DAGs attractive when local common-subexpression elimination matters.

### 3.3 Control-Flow Graphs

ASTs and DAGs preserve expression or statement structure, but they do not make control flow explicit. That is why compilers use **control-flow graphs (CFGs)**.

**A CFG is a directed graph whose nodes are basic blocks and whose edges are control-flow transfers.** A basic block has linear structure, its last statement is a jump or a return, and control can enter only through its first instruction.

![CFG with basic blocks for a loop program](lec05_materials/control_flow_graph_basic_blocks.png)

The lecture also defines loops on a CFG. A loop is a set of nodes with a loop-entry node such that:

- predecessors from outside the loop can enter only through that entry;
- every node in the loop has a non-empty path back to the entry that stays inside the loop.

This definition matters because later loop optimizations are phrased over CFG structure rather than over source syntax like `while` or `for`.

![Loop structure on a control-flow graph](lec05_materials/loop_control_flow_graph.png)

## 4. Linear IRs

### 4.1 Three-Address Code

**Three-address code is a linear IR in which each instruction involves at most three addresses** such as program variables, temporaries, or constants.

Its core forms include:

$$
\begin{aligned}
I ::= {} & ID = ID\ bop\ ID \mid ID = uop\ ID \mid ID = ID \mid goto\ LABEL \\
& \mid if\ ID\ goto\ LABEL \mid ifFalse\ ID\ goto\ LABEL \mid if\ ID\ rop\ ID\ goto\ LABEL
\end{aligned}
$$

and extended forms for calls, arrays, and pointers:

$$
I ::= \cdots \mid param\ ID,INT \mid call\ ID,INT \mid ID = call\ ID,INT \mid return\ ID
$$

$$
I ::= \cdots \mid ID = ID[ID] \mid ID[ID] = ID \mid ID = \&ID \mid ID = *ID \mid *ID = ID
$$

The important consequence is that nested source expressions are flattened into explicit evaluation steps. For example:

```c
a = b * -c + b * -c;
```

becomes:

```text
t0 = 0 - c
t1 = b * t0
t2 = 0 - c
t3 = b * t2
t4 = t1 + t3
a  = t4
```

The lecture also shows why symbolic labels are convenient first, and why a later pass can resolve them to instruction positions.

### 4.2 Static Single Assignment

**In SSA, every assignment targets a variable with a different name, so each use can find a unique definition.**

That is the core property:

$$
\begin{aligned}
p &= a + b \\
q &= p - c \\
p &= q * d \\
p &= e - p \\
q &= p + q
\end{aligned}
\qquad \Longrightarrow \qquad
\begin{aligned}
p_1 &= a + b \\
q_1 &= p_1 - c \\
p_2 &= q_1 * d \\
p_3 &= e - p_2 \\
q_2 &= p_3 + q_1
\end{aligned}
$$

When control flow merges, SSA needs an explicit merge mechanism. One style uses a $\phi$ function:

$$
x_3=\phi(x_1,x_2)
$$

Another style, used by Koopa IR, passes values as block arguments:

```text
if (flag) { x1 = -1; goto L(x1); }
else      { x2 =  1; goto L(x2); }
L(z): y = z * a;
```

Loops also need $\phi$-like merges, because the name may have one definition site while its value is produced many times across iterations.

![SSA merge across control-flow paths](lec05_materials/ssa_control_flow_merge.png)

:::remark 📝 Question: Does modern IR still use three-address-code ideas after moving to SSA?
Question: **If modern compilers like LLVM use SSA, has three-address code become obsolete?**

Answer: no. SSA usually refines rather than replaces the three-address mindset. Operations are still broken into explicit steps, control flow is still explicit, and values are still named. SSA mainly strengthens naming discipline so dataflow becomes easier to analyze.
:::

## 5. Two Strategies for IR Generation

The lecture compares two implementation strategies.

1. Generate IR during syntax-directed semantic analysis.
2. First build an AST, then traverse the AST to generate IR.

The synchronized strategy is efficient because parsing and translation happen together, and no explicit parse tree is required. Its downside is that the SDD has to be designed carefully.

The AST-first strategy lowers coupling: parsing produces a reusable semantic tree, and later passes can translate or transform it independently. Its downside is the cost of explicitly building and traversing that tree.

In practice, both styles are common. Early compiler courses often start with syntax-directed translation because it exposes the mechanics of code generation clearly.

## 6. Translating Expressions and Assignments

To simplify the translation discussion, the lecture temporarily uses an equivalent ambiguous grammar:

$$
\begin{aligned}
E &::= E + E \mid E - E \mid E * E \mid E / E \mid (E) \mid ID \mid INT \\
S &::= ID = E;
\end{aligned}
$$

The translation uses two key attributes:

- `addr`: the address holding the value of an expression;
- `code`: the generated three-address code.

The essential rules are:

$$
\begin{aligned}
E \to ID &: \quad E.addr = genvar(ID.lexeme),\quad E.code = `` \\
E \to INT &: \quad E.addr = gencst(INT.intval),\quad E.code = `` \\
E \to E_1 + E_2 &: \quad E.addr = gentmp() \\
& \quad E.code = E_1.code \parallel E_2.code \parallel `{E.addr} = {E_1.addr} + {E_2.addr}` \\
E \to (E_1) &: \quad E.addr = E_1.addr,\quad E.code = E_1.code \\
S \to ID = E; &: \quad S.code = E.code \parallel `{genvar(ID.lexeme)} = {E.addr}`
\end{aligned}
$$

`genvar` maps source variables to IR addresses, `gencst` creates constant addresses, and `gentmp` creates fresh temporaries.

![Attribute grammar for translating expressions and assignments](lec05_materials/expression_translation_sdd.png)

What matters here is the discipline: every subexpression returns both where its value lives and which code had to run to produce it.

## 7. Translating Declarations and Blocks

Declarations need more than code emission. They also need symbol-table management.

The source grammar is:

$$
\begin{aligned}
S &::= \cdots \mid TID; \mid \{L\} \\
T &::= int \mid double \\
L &::= \epsilon \mid LS
\end{aligned}
$$

The lecture attaches table-flow attributes:

- `table_in`: symbol table before processing the construct;
- `table_out`: symbol table after processing it;
- `code`: generated IR.

Representative rules are:

$$
\begin{aligned}
S \to TID; &: \quad S.table\_out = S.table\_in.insert(ID.lexeme, T.type),\quad S.code = `` \\
S \to \{L\} &: \quad L.table\_in = S.table\_in.push\_scope() \\
& \quad S.table\_out = L.table\_out.pop\_scope(),\quad S.code = L.code \\
L \to L_1S &: \quad L_1.table\_in = L.table\_in,\quad S.table\_in = L_1.table\_out \\
& \quad L.table\_out = S.table\_out,\quad L.code = L_1.code \parallel S.code
\end{aligned}
$$

This is the bridge between semantic analysis and code generation: declarations affect later identifier resolution even when they do not themselves emit machine-like instructions.

## 8. Translating Boolean Expressions and Control Flow

### 8.1 Short-Circuit Boolean Expressions

If a compiler translated boolean operators exactly like arithmetic expressions, it would lose short-circuit behavior.

For

```c
if (x < 100 || (x > 200 && x != y)) x = 0;
```

the generated three-address code should skip unnecessary work:

```text
if      x < 100  goto L1
ifFalse x > 200  goto L0
ifFalse x != y   goto L0
L1: x = 0
L0: ...
```

The lecture therefore gives boolean expressions two inherited labels:

- `B.true`: where to go if the boolean is true;
- `B.false`: where to go if it is false.

Core rules include:

$$
\begin{aligned}
B \to true &: \quad B.code = `goto {B.true}` \\
B \to false &: \quad B.code = `goto {B.false}` \\
B \to !B_1 &: \quad B_1.true = B.false,\quad B_1.false = B.true,\quad B.code = B_1.code \\
B \to E_1 == E_2 &: \quad B.code = E_1.code \parallel E_2.code \parallel `if {E_1.addr} == {E_2.addr} goto {B.true}` \parallel `goto {B.false}`
\end{aligned}
$$

Short-circuit operators are then expressed by wiring labels carefully:

$$
\begin{aligned}
B \to B_1 \&\& B_2 &: \quad B_1.true = genlabel(),\quad B_1.false = B.false \\
& \quad B_2.true = B.true,\quad B_2.false = B.false \\
& \quad B.code = B_1.code \parallel `{B_1.true}:` \parallel B_2.code \\
B \to B_1 \parallel\!\parallel B_2 &: \quad B_1.true = B.true,\quad B_1.false = genlabel() \\
& \quad B_2.true = B.true,\quad B_2.false = B.false \\
& \quad B.code = B_1.code \parallel `{B_1.false}:` \parallel B_2.code
\end{aligned}
$$

:::warn ⚠️ Question: Why can boolean translation not be handled like ordinary arithmetic translation?
Question: **Why not translate `B1 || B2` by evaluating both sides into temporaries and then applying an `or` operator?**

Answer: because the source language usually requires short-circuit semantics. If `B1` already determines the final truth value, `B2` must not be evaluated. That affects correctness, not just efficiency, because `B2` may be expensive or may have side effects in richer languages.
:::

### 8.2 If and While Statements

Conditionals and loops add one more inherited label:

- `S.next`: the label of the next instruction after the current statement.

For conditionals, the essential rules are:

$$
\begin{aligned}
S \to if(B)S_1 &: \quad B.true = genlabel(),\quad B.false = S.next,\quad S_1.next = S.next \\
& \quad S.code = B.code \parallel `{B.true}:` \parallel S_1.code \\
S \to if(B)S_1 else S_2 &: \quad B.true = genlabel(),\quad B.false = genlabel() \\
& \quad S_1.next = S.next,\quad S_2.next = S.next \\
& \quad S.code = B.code \parallel `{B.true}:` \parallel S_1.code \parallel `goto {S.next}` \parallel `{B.false}:` \parallel S_2.code
\end{aligned}
$$

For loops:

$$
\begin{aligned}
S \to while(B)S_1 &: \quad B.true = genlabel(),\quad B.false = S.next,\quad S_1.next = genlabel() \\
& \quad S.code = `{S_1.next}:` \parallel B.code \parallel `{B.true}:` \parallel S_1.code \parallel `goto {S_1.next}`
\end{aligned}
$$

![Attribute grammar for translating while loops](lec05_materials/while_translation_sdd.png)

:::tip 💡 Question: How would we support `break` and `continue`?
Question: **The lecture asks: how can we support `break` and `continue` in loop translation?**

Answer: the clean solution is to add inherited labels for the current loop's exit and continue targets. `break` jumps to the loop-exit label; `continue` jumps to the loop-header or loop-update label, depending on the source construct. This is the same design pattern as `B.true`, `B.false`, and `S.next`: control-flow intent is carried downward as inherited context.
:::

## 9. Translating Calls, Switches, and Multiple Functions

The lecture also sketches three important extensions.

First, function calls:

$$
\begin{aligned}
x = f(E_1,E_2,\dots,E_n) \Longrightarrow {} & \text{compute } E_1 \to t_1;\ param\ t_1,1 \\
& \cdots \\
& \text{compute } E_n \to t_n;\ param\ t_n,n \\
& t = call\ f,n \\
& x = t
\end{aligned}
$$

Second, `switch` statements can be translated by:

1. computing the controlling expression into a temporary;
2. placing each branch body at its own label;
3. building a test chain that dispatches to the right branch label;
4. joining all cases at one `next` label.

Third, multi-function programs are translated one function at a time. Each procedure or function receives its own IR body, and callers use `param` plus `call`.

:::remark 📝 Question: How many IR forms should a compiler use?
Question: **Roughly how many intermediate forms should a compiler have?**

Answer: there is no universal number. A compiler should have enough forms to expose the information that each major phase needs, but not so many that every phase spends its time translating between nearly identical representations. In practice, a small sequence of clearly differentiated IRs is usually better than either one overloaded IR or a long chain of tiny variants.
:::

## 10. Toy Language Walkthrough

### 10.1 AST for the Toy Language

The lecture finishes with a toy language that has only `int`, only `main`, and straight-line core examples, but still includes scopes and nested declarations.

Its AST grammar is:

$$
\begin{aligned}
E &::= binop(op,E,E)\mid id(x)\mid number(i) \\
op &::= add \mid sub \mid mul \mid div \mid mod \\
S &::= scope(S)\mid decl(x,S)\mid assign(x,E)\mid ret(E)\mid seq(S,S)\mid nop \\
F &::= func(x,S) \\
P &::= prog(F)
\end{aligned}
$$

This form already makes scoping and sequencing explicit, so later translation does not depend on surface syntax.

### 10.2 Class-Three-Address IR

The toy target IR is a compromise between pure expression trees and strict three-address code:

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

![Toy-language class-three-address IR](lec05_materials/toy_language_class_three_address_ir.png)

Translation again combines symbol tables with code synthesis. Some representative rules are:

$$
\begin{aligned}
E \to id(x) &: \quad E.res = `id({E.table.lookup(x)})`,\quad E.code = `` \\
E \to number(i) &: \quad E.res = num(i),\quad E.code = `` \\
E \to binop(add,E_1,E_2) &: \quad E.res = `add({E_1.res}, {E_2.res})`,\quad E.code = E_1.code \parallel E_2.code \\
E \to binop(div,E_1,E_2) &: \quad E.res = `id({E.table.gentmp()})` \\
& \quad E.code = E_1.code \parallel E_2.code \parallel `div({E.res.name}, {E_1.res}, {E_2.res})`
\end{aligned}
$$

and:

$$
\begin{aligned}
S \to decl(x,S_1) &: \quad S_1.table\_in = S.table\_in.insert(x, genvar(x)),\quad S.table\_out = S_1.table\_out.remove(x) \\
S \to assign(x,E) &: \quad E.table = S.table = S.table\_in,\quad S.code = E.code \parallel `move({S.table\_in.lookup(x)}, {E.res})` \\
S \to ret(E) &: \quad E.table = S.table = S.table\_in,\quad S.code = E.code \parallel `ret({E.res})` \\
F \to func(x,S) &: \quad S.table\_in = newtable(),\quad F.code = `label({x})` \parallel S.code
\end{aligned}
$$

The big lesson is that IR generation is not only about expressions. It is about consistently threading naming, scope, control flow, and emitted code through one semantic framework.

The full translation table for the toy language makes that threading especially concrete:

![Toy-language translation rules from AST to class-three-address IR](lec05_materials/toy_language_translation_rules.png)

## 11. Exam Review

### 11.1 Must-Know Definitions

- **IR**: the compiler's internal representation of program semantics.
- **AST**: a source-like tree with redundant syntax removed.
- **DAG**: an AST-like graph that merges identical subexpressions.
- **CFG**: a directed graph of basic blocks and control-flow edges.
- **Three-address code**: a linear IR with at most three addresses per instruction.
- **SSA**: an IR discipline where each assignment defines a fresh name.
- **Basic block**: a linear instruction sequence with single entry and jump/return at the end.

### 11.2 Mechanisms You Should Be Able to Explain

- Why IR decouples front end, optimizer, and back end.
- How graph IR and linear IR expose different information.
- Why SSA needs $\phi$ or block-argument style merges.
- How `addr` and `code` work in syntax-directed translation.
- Why boolean translation uses labels instead of only temporaries.
- How symbol tables are threaded through block translation.
- Why one compiler may use several IRs at different abstraction levels.

### 11.3 Short-Answer Templates

- Why do we need IR:
  because source semantics and machine execution are different concerns, and IR separates them.
- Why does SSA help:
  because each use points to one definition, which simplifies dataflow analysis.
- Why use CFGs:
  because ASTs do not explicitly represent jumps, merges, and loop structure.
- Why short-circuit translation is special:
  because control flow, not only truth values, determines the correct evaluation behavior.

### 11.4 Common Mistakes

- assuming "graph IR" always means "higher level" without qualification;
- treating ASTs as enough for all optimization work;
- forgetting that three-address code makes evaluation order explicit;
- thinking SSA eliminates the need for control-flow structure;
- translating booleans as arithmetic values and losing short-circuit semantics;
- ignoring scope changes during declaration translation.

### 11.5 Self-Check

- Can you explain the three main IR design dimensions from the lecture?
- Can you compare AST, DAG, CFG, three-address code, and SSA in one coherent story?
- Can you derive expression translation rules using `addr` and `code`?
- Can you explain how `B.true`, `B.false`, and `S.next` drive boolean, `if`, and `while` translation?
- Can you justify why a compiler may lower one program through several IRs before code generation?
