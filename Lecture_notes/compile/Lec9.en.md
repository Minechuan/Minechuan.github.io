# Lec9: Advanced Topics in Syntax Analysis

## 1. Why Advanced Syntax Analysis Matters

A parser consumes a token sequence and constructs a parse tree or a corresponding syntax structure. When the input is invalid, syntax errors should be reported with enough detail for the programmer to understand where parsing stopped and what kind of token or phrase was expected.

The previous lecture focused on predictive top-down parsing. Its key limitation is also the reason we need this lecture: LL parsing must decide which production to use before it has parsed the production body. **LL(k) uses the next k tokens to predict a production**, so any language whose decision requires unbounded future information is outside fixed-lookahead LL parsing.

![A non-LL language example that needs more information than any fixed lookahead can provide](lec09_materials/non_ll_language_limit.png)

Consider the language:

$$
\{a^i b^j \mid i \ge j\}
$$

One natural grammar is:

```text
[1] S -> aS
[2] S -> P
[3] P -> aPb
[4] P -> epsilon
```

The hard choice is whether an initial `a` belongs to the extra prefix from `S -> aS` or to the balanced part from `P -> aPb`. For every fixed lookahead length `k`, the prefixes of `a^k b^k` and `a^{k+1} b^k` look identical for too long, but the correct derivation choice differs. That is a structural limitation, not just a table-construction accident.

:::remark 📝 Question: why can no fixed LL(k) lookahead solve the example?
The question is: **why does the grammar force a choice before enough information is available?** The parser must choose between continuing to generate extra leading `a`s or switching to the balanced `P` part. The evidence that distinguishes the two cases only appears when the parser reaches the `b` region, and that distance can be arbitrarily large. A fixed `k` cannot cover all inputs.
:::

Bottom-up parsing reverses the viewpoint. Instead of predicting a production before seeing its body, it waits until the right-hand side has appeared on the analysis stack, then reduces it back to the left-hand side. This is why bottom-up parsers can handle many grammars that are painful or impossible for LL parsers.

## 2. Bottom-Up Parsing and Shift-Reduce Prediction

Bottom-up parsing reads tokens from left to right and builds a parse by reducing recognized substrings. Operationally it keeps an analysis stack and repeatedly performs two actions:

- **Shift**: push the next input token onto the analysis stack.
- **Reduce**: if the stack top matches the right-hand side `alpha` of a production `A -> alpha`, pop `alpha` and push `A`.

Because reductions undo a derivation step, bottom-up parsing constructs a rightmost derivation in reverse. The substring that is ready to be reduced is called a handle; in LR-style parsing, the handle is always at the top of the stack when it is reduced.

For the bracket grammar:

```text
S' -> S EOF
[1] S -> epsilon
[2] S -> [ S ] S
```

a parser can shift `[`, reduce empty `S` at the right time, shift `]`, and reduce `[ S ] S` back to `S`. The central difficulty is not the mechanics of shift or reduce; the difficulty is deciding which action is valid in a particular stack context.

:::tip 💡 Question: how do we determine shift or reduce?
The question is: **How to determine shift or reduce?** The naive strategy is to reduce whenever the top of stack matches some right-hand side and otherwise shift. That fails for epsilon productions and for states where both a reduction and a shift may appear locally plausible. A practical parser needs a prediction table indexed by the current stack state and the lookahead token.
:::

FOLLOW sets help but are not precise enough by themselves. If the stack top matches `A -> alpha`, a simple SLR-style idea is to reduce only when the next token is in `FOLLOW(A)`. This removes many false reductions, but it still forgets too much stack context.

![FOLLOW sets can be too coarse for shift-reduce prediction](lec09_materials/follow_shift_reduce_conflict.png)

For the grammar:

```text
S' -> S EOF
[1] S -> a b d
[2] S -> a A c
[3] S -> b A d
[4] A -> b
```

we have:

$$
FOLLOW(A) = \{c,d\}
$$

When the stack contains `a b` and the lookahead is `d`, `FOLLOW(A)` permits reducing `b` to `A`, but shifting `d` is also correct for production `[1]`. This is a shift-reduce conflict caused by coarse context.

:::warn ⚠️ Question: why is FOLLOW too coarse here?
The question is: **if the lookahead is in FOLLOW(A), why is reducing A -> b still unsafe?** FOLLOW only says that `d` can appear after some completed `A` somewhere. It does not say that the current stack prefix is one of those places. The stack prefix `a b` may be heading toward `S -> a b d`, where `b` should not be reduced to `A`.
:::

## 3. From Stack Patterns to LR Item Automata

The way out is to classify stack patterns more precisely. LR parsing represents partial progress through grammar productions using items. A dot marks how much of a right-hand side has already been recognized:

```text
S' -> . S EOF
S  -> [ . S ] S
S  -> [ S . ] S
S  -> [ S ] . S
S  -> [ S ] S .
```

An item can be read as a small parser state. Content left of the dot has already been matched on the stack; content right of the dot is still expected. If the symbol after the dot is a terminal, reading that terminal is a shift transition. If the symbol after the dot is a nonterminal `X`, the parser can enter items for each production of `X` by an epsilon transition, because `X` may begin there without consuming input.

This gives an NFA of LR items. A nondeterministic finite automaton is:

$$
N = (S, \Sigma, \delta, s_0, F)
$$

where:

$$
\delta : S \times (\Sigma \cup \{\epsilon\}) \to 2^S
$$

An NFA accepts if at least one possible path reaches an accepting state. Every NFA can be converted to a DFA with the same language:

$$
L(N) = L(D)
$$

The conversion is subset construction. A DFA state is a set of possible NFA states. The important operation is epsilon-closure, which repeatedly adds states reachable by epsilon transitions until a fixed point:

$$
T = T' \cup \bigcup_{s \in T'} \delta_N(s, \epsilon)
$$

![Epsilon-closure turns a set of NFA states into the full set reachable without consuming input](lec09_materials/epsilon_closure_nfa.png)

For LR parsing, subset construction turns the item NFA into a DFA whose states are item sets. The parser table is then derived from this DFA:

- terminal transition on `c` means shift on token `c`;
- nonterminal transition on `A` becomes a `GOTO` entry;
- a completed item `A -> alpha .` may produce a reduction;
- the completed start item `S' -> S . ; EOF` produces accept.

The item automaton is the central bridge between grammar theory and an executable shift-reduce parser.

## 4. LR(1), SLR, and LALR

SLR uses LR(0) item states plus FOLLOW sets. LR(1) refines the item itself by storing a one-token re-lookahead:

$$
\langle A \to \alpha \cdot \gamma ; c \rangle
$$

The lecture's wording is useful here: an LR(1) item is a **partial analysis state + "re-lookahead"**. The lookahead is not merely the next token used for shifting. It records which token is valid after the nonterminal represented by this item has been completed and reduced.

When an LR(1) item expects a nonterminal `X`, lookahead must be propagated through what follows `X`. For a state:

$$
\langle A \to \alpha \cdot X\gamma' ; c \rangle
$$

and a production `X -> delta`, the epsilon transition adds:

$$
\langle X \to \cdot \delta ; d \rangle,
\quad d \in FIRST(\gamma' c)
$$

![LR(1) item construction uses FIRST of the suffix plus the stored re-lookahead](lec09_materials/lr1_lookahead_automaton.png)

This is exactly the extra information missing from FOLLOW. In the earlier conflict, `A -> b . ; c` and `A -> b . ; d` are different items. The stack context that reaches `a b` with lookahead `d` should shift for `S -> a b d`; it should not reduce `A -> b`.

**LR grammar** means a context-free grammar recognized by conflict-free shift-reduce predictive parsing. The name has two parts:

- `L`: scan the input from left to right.
- `R`: construct a rightmost derivation, in reverse.

LR(k) means the partial analysis state can record `k` re-lookahead tokens. LR(k) is more expressive than LL(k) for the same `k` because LR can first see a complete candidate handle and then decide how to reduce it. LL must choose the production before it has parsed the body.

The common LR-family variants are:

- LR(0): items have no re-lookahead, written as `A -> alpha . gamma`.
- SLR(1): uses the LR(0) automaton but reduces only on tokens in `FOLLOW(A)`.
- LR(1): stores one re-lookahead token in each item.
- LALR(1): starts from LR(1)-style lookaheads but merges states whose LR(0) cores are the same, making the automaton close to LR(0) size.

LALR is popular because it is much smaller than canonical LR(1), but merging states can lose distinctions. It can even introduce reduce-reduce conflicts that were separate before merging.

![LALR state merging can introduce a reduce-reduce conflict](lec09_materials/lalr_reduce_reduce_conflict.png)

:::warn ⚠️ Question: why can LALR introduce reduce-reduce conflicts?
The question is: **why does merging LR(1) states sometimes create a conflict that was not present before?** Two states may have the same LR(0) core but different lookahead sets. After merging, the reductions share the union of those lookaheads. If two completed items now both reduce on the same token, the parser cannot choose a unique rule.
:::

One subtle point is the difference between ordinary lookahead and re-lookahead. During shift, LR parsers still use the immediate next token to index the action table. During reduce, LR(k) compares the next `k` tokens with the re-lookahead recorded in the item. A grammar may fail to be LR(1) but describe a language that has another LR(1) grammar. In fact, LR(k) does not recognize more languages than LR(1): if a language has some LR(k) grammar, it also has an LR(1) grammar.

## 5. Parser Generation and Table-Driven Drivers

Parser generation automates the route from a grammar specification to a parser implementation. The grammar side can be LL or LR; the implementation side can be recursive descent, shift-reduce code, or a table-driven driver.

![Parser generation separates grammar specification, table construction, and parser driver](lec09_materials/parser_generation_pipeline.png)

For LR parsing, the generator builds the item automaton and emits two tables:

- `ACTION[state][token]`: shift, reduce, accept, or error.
- `GOTO[state][nonterminal]`: next state after a reduction pushes a nonterminal.

The LR driver maintains a stack of states, initially containing `I0`.

![A table-driven LR(1) driver uses ACTION and GOTO with a state stack](lec09_materials/lr_driver_table.png)

The driver loop is:

1. Let `state` be the top stack state and `token` be the current input token.
2. If `ACTION[state][token]` is `shift Ij`, push `Ij` and read the next token.
3. If it is `reduce A -> alpha`, pop `|alpha|` states, inspect the new top state, and push `GOTO[top][A]`.
4. If it is accept, parsing succeeds.
5. Otherwise report a syntax error.

LR table construction follows directly from the DFA:

- a terminal transition gives a shift action;
- a completed item `⟨A -> alpha . ; c⟩` gives reduce `A -> alpha` on `c`;
- `⟨S' -> S . ; EOF⟩` gives accept;
- a nonterminal transition gives a GOTO entry.

For LL(1), the table is organized by stack top and lookahead token. If the stack top is a terminal, the only successful action is to match the same token. If the stack top is a nonterminal `A`, the table expands `A -> alpha` under tokens in `FIRST(alpha)`. If `epsilon` is in `FIRST(alpha)`, the same production is also entered under tokens in `FOLLOW(A)`.

![LL(1) parse-table construction uses FIRST and FOLLOW](lec09_materials/ll1_parse_table.png)

The LL driver also keeps a stack, but the stack stores grammar symbols. It accepts when both the stack top and input token are EOF; it matches terminals directly; and it expands nonterminals by pushing the chosen right-hand side in reverse order.

## 6. GLR and Incremental Parsing

Generalized LR is the broad version of LR parsing. When a shift-reduce or reduce-reduce conflict appears, GLR does not pick one branch immediately. It explores the possible actions in parallel and discards branches that later become impossible.

For an ambiguous grammar such as:

```text
S' -> E EOF
[1] E -> E + E
[2] E -> a
```

the string `a + a + a` has multiple parse trees. GLR keeps multiple analysis paths. To avoid duplicating huge stacks, it represents them with a graph-structured stack, or analysis stack DAG.

![GLR shares equivalent stack suffixes in an analysis stack DAG](lec09_materials/glr_graph_structured_stack.png)

:::tip 💡 Question: which GLR states are equivalent?
The question is: **Which states are equivalent?** In a GLR run, different branches often share the same stack suffix and current automaton state. Those shared suffixes can be represented once in a DAG. Sharing is what keeps breadth-first exploration from becoming a simple copy-everything explosion.
:::

Incremental parsing addresses a different problem: interactive editing. In an IDE, reparsing an entire file or project after every keystroke is wasteful, even if a full parse is linear in input size. Incremental parsers keep a parse tree and try to reuse unchanged subtrees.

![Incremental LR parsing must be careful because a changed lookahead can invalidate reuse](lec09_materials/incremental_parsing_reuse_caveat.png)

The tempting rule is: if the source span for a nonterminal did not change, reuse that subtree. LR parsing makes this subtle, because the validity of a reduction may depend on lookahead after the subtree. If the text after a reused subtree changes from one lookahead token to another, the old reduction may no longer be valid.

:::remark 📝 Question: in an IDE, should we re-parse after every character?
The question is: **should an IDE re-parse after every character?** It should update the syntax structure after edits, but it should not throw away all previous work. Incremental parsing reparses the edited region plus the context whose decisions may be affected by the edit. Tools such as tree-sitter are designed around this style of generated incremental parser.
:::

## 7. Why Top-Down Still Matters and LL(*)

If LR-family parsing is powerful, why not always use it? The lecture gives several practical reasons.

First, GLR accepts ambiguous grammars by keeping alternatives, but accepting ambiguity is not the same as diagnosing it. Second, PEG uses ordered choice to bypass ambiguity, but ordered choice can be surprising. In:

```text
A <- a / ab
```

the second alternative can never be selected for an input beginning with `a`, even though `ab` looks like a more specific case. Third, bottom-up parsers are hard to write and debug manually. Their internal process is about stack patterns and automaton states, not the recursive structure a programmer naturally sees in the grammar. Generated parsers may also produce poor error messages unless carefully customized.

:::tip 💡 Question: why still use top-down parsing?
The question is: **Why top-down?** Top-down parsing follows the grammar's recursive structure, is easy to implement by hand as recursive descent, and gives the programmer direct control over diagnostics. It is often the best engineering choice when the grammar is designed to be friendly to it.
:::

LL(*) extends the predictive idea beyond fixed `k`. The problem case is a grammar where the parser must scan an unbounded pattern before choosing between alternatives:

```text
S' -> S EOF
[1] S -> A
[2] S -> B
[3] A -> c A a
[4] A -> c a
[5] B -> c B b
[6] B -> c b
```

No fixed lookahead length can decide whether the final symbols will be all `a`-style or all `b`-style. LL(*) tries to build a DFA that recognizes the lookahead language needed for prediction. In full generality, deciding whether such a regular lookahead description exists is undecidable, so tools approximate.

![LL(*) uses subset-construction-like prediction and approximates call-stack context](lec09_materials/llstar_call_stack_approximation.png)

ANTLR-style LL(*) construction records which production an NFA path belongs to and tracks call-stack context approximately. The approximation may track only a bounded layer of calls; after returning, it may lose older call-stack information. If the construction fails, a parser generator can fall back to LL(k) or controlled backtracking.

## 8. Parser Combinators and Pratt Parsing

Parser combinators sit between fully manual parsing and fully automatic generation. The idea is to write small parsers and combine them with higher-order building blocks.

A parser can be modeled functionally: it reads an input string and returns a parsed value plus the remaining input, or reports failure. In object-oriented form, it can look like:

```cpp
template <typename A>
struct Parser {
  virtual pair<A, string_view> parse(string_view input) = 0;
};
```

The basic combinators are:

- `parser and_then parser ==> parser`: run the first parser, then run the second parser on the remaining input, returning a pair of results.
- `parser or_else parser ==> parser`: try the first parser; if it fails, try the second parser on the original input.
- `parser map(transformer) ==> parser`: run a parser and transform its successful result.

![The core parser combinators are sequencing, choice, and result transformation](lec09_materials/parser_combinator_evaluator.png)

From these, we can build common grammar idioms: `one_of`, `many`, `many1`, `between`, `throw_left`, `throw_right`, recursive parsers, and left-associative chains. An arithmetic expression parser can use `chain_left` to handle `*` and `/` at the term level, then `+` and `-` at the expression level.

Pratt Parsing removes much of the boilerplate around operator precedence and associativity. Its key idea is **Binding Power**: give each operator a pair of numbers `(lp, rp)`. For two adjacent operators around an operand, if the left operator's `rp` is greater than the right operator's `lp`, the operand binds left; otherwise it binds right.

![Pratt parsing uses binding-power pairs to decide precedence and associativity](lec09_materials/pratt_binding_power.png)

For the lecture example:

$$
\text{operators } +,- \text{ have } (lp,rp)=(1,2)
$$

$$
\text{operators } *,/ \text{ have } (lp,rp)=(3,4)
$$

The expression:

$$
a + b * c * d + e
$$

groups as:

$$
a + ((b*c)*d) + e
$$

The Pratt-style `chain` combinator parses an operand, then repeatedly tries to parse an operator. If the operator's left binding power is below the current minimum, the current parse stops; otherwise it recursively parses the right operand with the operator's right binding power as the new minimum.

![A Pratt-compatible chain parser carries the current minimum binding power](lec09_materials/pratt_chain_parser.png)

:::tip 💡 Question: how does Pratt Parsing solve precedence and associativity?
The question is: **handling operator precedence and associativity is cumbersome; what does Pratt Parsing change?** Instead of hard-coding one grammar layer per precedence level, Pratt Parsing puts the precedence and associativity information into binding-power numbers attached to operators. Adding a new operator mostly means adding one parser entry with its `(lp, rp)` pair.
:::

## 9. Exam Review

### Key definitions

- **Bottom-up parsing**: parse by shifting input tokens and reducing stack-top handles back to nonterminals.
- **Shift-reduce parsing**: a bottom-up method with two core actions, shift and reduce.
- **LR grammar**: **a context-free grammar recognized by conflict-free shift-reduce predictive parsing**.
- **LR item**: a production with a dot marking how much of the right-hand side has been recognized.
- **LR(1) item**: an LR item plus one re-lookahead token, written as `⟨A -> alpha . gamma ; c⟩`.
- **SLR(1)**: LR(0) automaton plus FOLLOW-filtered reductions.
- **LALR(1)**: LR(1)-style lookaheads merged over equal LR(0) cores.
- **GLR**: generalized LR that explores multiple shift/reduce choices in parallel.
- **LL(*)**: predictive top-down parsing using DFA-like lookahead recognition rather than a fixed `k`.
- **Parser combinator**: a higher-order parser-building function such as sequencing, choice, repetition, or mapping.
- **Pratt Parsing**: expression parsing driven by binding-power pairs for operators.

### Mechanisms to be able to explain

1. How shift and reduce reconstruct a rightmost derivation in reverse.
2. Why FOLLOW-based reduction is sometimes too coarse.
3. How LR items form an NFA and how subset construction gives a DFA of item sets.
4. How LR(1) propagates lookahead with `FIRST(gamma' c)`.
5. Why LR(1) is more powerful than LL(1) for grammar recognition.
6. How LR drivers use `ACTION` and `GOTO`.
7. Why LALR is smaller than LR(1) but can introduce reduce-reduce conflicts.
8. How GLR shares branches with a graph-structured stack.
9. Why incremental parsing must consider context after an unchanged subtree.
10. How parser combinators and Pratt Parsing support hand-written parsers.

### Short-answer templates

- **Explain a shift-reduce conflict**: identify the stack pattern, the lookahead token, the shift path, and the reduce path. Then explain what context is missing.
- **Explain LR(1) lookahead propagation**: start from `⟨A -> alpha . X gamma' ; c⟩`, add items for `X -> delta`, and compute the new lookahead from `FIRST(gamma' c)`.
- **Compare LR and LL**: LL predicts before parsing a production body; LR observes a completed handle before reducing, so it has more context.
- **Explain LALR risk**: merging equal LR(0) cores unions lookahead sets, and the union may create a new reduce-reduce conflict.
- **Explain Pratt Parsing**: each operator supplies `(lp, rp)`; the parser stops or recurses based on whether the next operator can bind tighter than the current minimum.

### Common mistakes

- Treating FOLLOW as if it knew the current stack prefix. It only describes possible following tokens globally.
- Confusing the shift lookahead token with LR re-lookahead stored in items.
- Saying LALR is simply LR(1) with no loss. It is smaller because it merges states, and merging can lose distinctions.
- Assuming GLR removes ambiguity. GLR preserves alternatives; ambiguity still needs semantic handling or grammar design.
- Reusing an unchanged subtree in incremental parsing without checking whether following context changed.
- Encoding every precedence level manually when a Pratt parser would be simpler and easier to extend.

### Self-check

- Can you build the LR(1) epsilon transition from `⟨A -> alpha . X gamma' ; c⟩`?
- Can you point to the exact reason the `FOLLOW(A) = {c,d}` example has a conflict?
- Can you explain why `a + b * c * d + e` groups as `a + ((b*c)*d) + e` under the given binding powers?
- Can you describe what `ACTION` and `GOTO` store without looking at a table?
- Can you give one reason top-down recursive descent remains valuable in real compilers?
