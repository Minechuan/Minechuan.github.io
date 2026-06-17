# Lec3: Syntax Analysis

Syntax analysis is the stage that turns a flat token sequence into a structured parse tree. Lexical analysis groups characters into words; syntax analysis groups those words into sentences of the programming language.

![Parser in the compiler pipeline](lec03_materials/parser_pipeline.png)

## 1. What Syntax Analysis Does

**Syntax analysis processes a token sequence and constructs a parse tree.** Its input is the token stream produced by the lexer. Its main jobs are to recognize syntactic variables, check whether the token sequence follows the language grammar, build a tree-shaped representation, and report useful syntax errors when the program is malformed.

For an assignment such as:

```c
a = a * 2 * b * c * d;
```

the lexer gives tokens such as `ID`, `EQ`, `MUL`, `NUMBER`, and `SEMI`. The parser groups them into higher-level syntactic categories such as assignment and expression.

:::remark 📝 Question: Why does compilation need syntax analysis?
Question: **Why do we need syntax analysis? What kinds of languages do not need it?**

Answer: syntax analysis is needed when a program's meaning depends on nested or hierarchical structure, such as parentheses, operator precedence, statement blocks, or matched `if`/`else` constructs. A language whose semantics are simply "execute characters from left to right" may need little or no syntax analysis. BF is the canonical example: apart from matching `[` and `]`, each character directly denotes an operation.
:::

:::tip 💡 Why lex before parsing?
Question: **What are the benefits of lexical analysis before syntax analysis?**

Answer: the parser can work with token classes instead of raw characters. This makes the grammar smaller, lets the lexer hide whitespace and comments, centralizes rules for identifiers and numbers, and gives the parser meaningful units such as `ID`, `INT`, `LPAREN`, and `RETURN`.
:::

Parsing is the move from a linear structure to a nonlinear one. The token sequence for `a * 2 * b` and `a + 2 * b` is linear, but the parse tree records which operations bind together first. That structure already contains semantic information, especially for expression evaluation.

## 2. Grammar as a Syntax Specification

Lexical specifications use regular expressions to describe languages over characters. Syntax specifications need to describe languages over tokens. For that, compilers usually use grammars.

### Grammar

**A grammar $G=(V_T,V_N,S,P)$ is a four-tuple.** $V_T$ is a nonempty finite set of terminal symbols, $V_N$ is a nonempty finite set of nonterminal symbols, $V_T\cap V_N=\varnothing$, $S\in V_N$ is the start symbol, and $P$ is the set of production rules.

More formally:

$$
P=\{\alpha \to \beta \mid \alpha,\beta \in (V_T \cup V_N)^*,\ \alpha \text{ contains at least one nonterminal}\}
$$

**Derivation starts from the start symbol $S$ and repeatedly applies production rules until the string contains only terminal symbols.** The language represented by the grammar is:

$$
L(G)=\{w \mid S \Rightarrow^* w,\ w \in V_T^*\}
$$

Terminals are the parser's alphabet, usually token classes. Nonterminals, also called syntactic variables, stand for phrases such as expression, statement, block, or function.

### Context-Free Grammars

General grammars are extremely expressive: deciding whether a string belongs to the language of an arbitrary grammar is undecidable. Compiler front ends therefore usually use context-free grammars.

**In a context-free grammar, the left-hand side of every production rule contains exactly one nonterminal.** Each rule has the form:

$$
A \to \beta
$$

where $A$ is a nonterminal. The phrase "context-free" means that $A$ can be expanded without checking the symbols before or after it.

The language of balanced bracket strings can be described by:

```text
S -> ε
S -> [S]
S -> SS
```

Regular expressions cannot express the general language of balanced brackets, but CFGs can. This is the core reason parsers use grammars rather than only regular expressions: programming languages contain nested structure everywhere.

:::remark 📝 Question: Why not use regular expressions as syntax specifications?
Question: **Can balanced parentheses or brackets be expressed by a regular expression? Why not use regular expressions for syntax analysis?**

Answer: no regular expression can count arbitrarily deep matching pairs. Syntax often needs this unbounded nesting: parentheses, blocks, function calls, array indexing, and nested statements. CFGs naturally express these recursive structures.
:::

### BNF

Backus-Naur Form, or BNF, is a common notation for grammars:

$$
A ::= \beta
$$

If a nonterminal has several alternatives, they can be grouped:

$$
A ::= \beta_1 \mid \beta_2
$$

For example:

```text
Expr ::= (Expr)
       | Expr Op ID
       | ID

Op   ::= +
       | -
       | *
       | /
```

This notation is compact, but the grammar designer must still make sure it has the intended meaning and is suitable for parsing.

## 3. Derivations and Parse Trees

If $\alpha\to\beta$ is a production and $\gamma,\delta$ are strings of grammar symbols, then:

$$
\gamma\alpha\delta \Rightarrow \gamma\beta\delta
$$

is a direct derivation. A sequence of direct derivations is written:

$$
\alpha_0 \Rightarrow \alpha_1 \Rightarrow \cdots \Rightarrow \alpha_n
$$

and abbreviated as $\alpha_0\Rightarrow^*\alpha_n$. If at least one derivation step is required, write $\alpha_0\Rightarrow^+\alpha_n$. Reduction is derivation in reverse:

$$
\gamma\alpha\delta \Leftarrow \gamma\beta\delta
$$

**A parse tree is a visualization of a CFG derivation.** The root is the start symbol, each internal node is a nonterminal, and each internal node's children are the right-hand side of one applied production.

![Parse tree for balanced brackets](lec03_materials/bracket_parse_tree.png)

A leftmost derivation expands the leftmost nonterminal at every step; a rightmost derivation expands the rightmost nonterminal at every step. The two derivation sequences may differ even when they correspond to the same parse tree.

:::tip 💡 Parse tree versus derivation order
The parse tree records which production expands which nonterminal. The exact order in which independent nonterminals are expanded is less important than the final tree shape. That is why the same tree can have different leftmost and rightmost derivations.
:::

## 4. Ambiguity and How to Remove It

**If a string has two different parse trees, the string is ambiguous. If a grammar produces an ambiguous string, the grammar is ambiguous.** In practice, parsers usually need unambiguous grammars.

The grammar:

```text
Expr ::= (Expr)
       | Expr Op Expr
       | ID

Op   ::= + | - | * | /
```

is ambiguous for `a + b * c`: one parse tree evaluates addition first and the other evaluates multiplication first.

![Ambiguous parse trees for expression grammar](lec03_materials/expression_ambiguity.png)

The fix is to encode precedence into the grammar. Introduce one nonterminal per precedence level:

```text
Expr   ::= Expr + Term
         | Expr - Term
         | Term

Term   ::= Term * Factor
         | Term / Factor
         | Factor

Factor ::= (Expr)
         | ID
```

`Factor` handles the highest precedence, `Term` handles multiplication and division, and `Expr` handles addition and subtraction.

![Disambiguated parse tree with precedence](lec03_materials/precedence_parse_tree.png)

Another classic ambiguity is the dangling `else`. The ambiguous grammar is:

```text
Statement ::= if Expr then Statement else Statement
            | if Expr then Statement
            | ...
```

The usual rule is: each `else` matches the nearest unmatched `if`. One grammar-level solution separates statements that already have a matched `else`:

```text
Statement ::= if Expr then Statement
            | if Expr then WithElse else Statement
            | ...

WithElse  ::= if Expr then WithElse else WithElse
            | ...
```

:::warn ⚠️ Question: Can recursive descent parse an ambiguous grammar?
Question: **Can recursive descent be used on an ambiguous grammar? What is the problem?**

Answer: a recursive-descent program can be written for some ambiguous grammars if it fixes a rule priority or backtracking strategy. The problem is that the parse tree is no longer determined by the grammar alone; implementation choices decide the meaning. For compilers, this is dangerous unless the priority rule is an explicit part of the language design.
:::

## 5. Top-Down Parsing and Recursive Descent

Top-down parsing starts from the grammar's start symbol and expands production rules until the generated symbols match the input tokens. The notation:

$$
w:\beta
$$

means that we are trying to establish $\beta\Rightarrow^*w$, where $w$ is the remaining token stream and $\beta$ is the current parsing goal.

When the leftmost symbol of $\beta$ is a nonterminal, top-down parsing expands it. When the leftmost symbol is a terminal, the parser matches it against the current input token.

Top-down parsing constructs a leftmost derivation.

### Recursive Descent

Recursive descent implements top-down parsing with one function per nonterminal. The parser keeps the current token in a global field or parser state and asks the lexer for the next token when a terminal is matched.

For balanced brackets, the ambiguous grammar:

```text
S -> ε
S -> [S]
S -> SS
```

is inconvenient for recursive descent because the parser may not know which rule to try, and the grammar is ambiguous. A better form is:

```text
S' -> S EOF
S  -> ε
S  -> [S]S
```

Now the parser can use one-token lookahead:

- if the current token is `[`, choose `S -> [S]S`;
- if the current token is `]` or `EOF`, choose `S -> ε`;
- otherwise report a syntax error.

![Predictive parsing for bracket grammar](lec03_materials/predictive_parsing_brackets.png)

This is predictive parsing: use lookahead symbols to select a production rule.

## 6. Making Predictive Parsing Deterministic

Backtracking recursive descent tries several rules until one works. Predictive recursive descent avoids backtracking, but only if the grammar is shaped so that the current lookahead token determines the rule.

### Left Recursion

Direct left recursion has a production of the form:

$$
A ::= A\alpha
$$

Indirect left recursion occurs when:

$$
A \Rightarrow^+ A\alpha
$$

Left recursion is a problem for naive top-down parsers because a function for `A` may call itself before consuming any token.

Direct left recursion can be removed by transforming:

$$
A ::= A\alpha \mid \beta
$$

into:

$$
A ::= \beta A'
$$

$$
A' ::= \alpha A' \mid \epsilon
$$

For expressions, this changes the grammar into a right-recursive or iterative form:

```text
Expr   ::= Term Expr'
Expr'  ::= + Term Expr'
         | - Term Expr'
         | ε

Term   ::= Factor Term'
Term'  ::= * Factor Term'
         | / Factor Term'
         | ε

Factor ::= (Expr)
         | ID
```

Indirect left recursion can be removed by ordering nonterminals $A_1,A_2,\ldots,A_n$, substituting earlier nonterminals into later ones, and then removing direct left recursion at each step. The final grammar may depend on the chosen order, but it recognizes the same language.

### FIRST Sets

**$FIRST(\beta)$ is the set of terminal symbols that can appear first in strings derived from $\beta$.** If $\beta\Rightarrow^*\epsilon$, then $\epsilon\in FIRST(\beta)$.

The fixed-point rules are:

$$
FIRST(a)=\{a\}\quad (a\text{ is terminal})
$$

If $A\to\epsilon$, then $\epsilon\in FIRST(A)$. If $A\to X_1X_2\cdots X_k$, then:

$$
a \in FIRST(X_i)\ \wedge\ \forall j<i,\ \epsilon \in FIRST(X_j) \Rightarrow a \in FIRST(A)
$$

If all $X_j$ can derive $\epsilon$, then $\epsilon\in FIRST(A)$.

For the expression grammar above:

$$
FIRST(Factor)=\{(,ID\}
$$

$$
FIRST(Term')=\{*,/,\epsilon\},\qquad FIRST(Expr')=\{+,-,\epsilon\}
$$

$$
FIRST(Term)=FIRST(Expr)=FIRST(S)=\{(,ID\}
$$

### FOLLOW Sets

When a production can derive $\epsilon$, FIRST alone is not enough. For example, in `Expr'`, the parser should choose `Expr' -> ε` exactly when the current token can legally appear after an expression suffix.

**$FOLLOW(X)$ is the set of terminals that may immediately follow nonterminal $X$ in some sentential form.**

For each production $A\to\alpha X\beta$:

$$
FIRST(\beta)-\{\epsilon\}\subseteq FOLLOW(X)
$$

If $\epsilon\in FIRST(\beta)$, then:

$$
FOLLOW(A)\subseteq FOLLOW(X)
$$

For the expression grammar:

$$
FOLLOW(Expr)=FOLLOW(Expr')=\{EOF,)\}
$$

$$
FOLLOW(Term)=FOLLOW(Term')=\{+,-,EOF,)\}
$$

$$
FOLLOW(Factor)=\{*,/,+,-,EOF,)\}
$$

![FOLLOW sets for expression grammar](lec03_materials/follow_sets_expression.png)

### Backtracking-Free Predictive Parsing

For:

$$
A ::= \beta_1 \mid \beta_2 \mid \cdots \mid \beta_n
$$

deterministic predictive parsing requires:

$$
\forall i\ne j,\ FIRST(\beta_i)\cap FIRST(\beta_j)=\varnothing
$$

and if $\epsilon\in FIRST(\beta_i)$, then:

$$
FOLLOW(A)\cap FIRST(\beta_j)=\varnothing \quad (i\ne j)
$$

The parser then chooses rule $A\to\beta_i$ when the current token is in $FIRST(\beta_i)$. If $\beta_i$ can derive $\epsilon$, the parser may choose it when the current token is in $FOLLOW(A)$.

### Left Factoring

If two alternatives share a prefix, one-token prediction cannot distinguish them. Transform:

$$
A ::= \alpha\beta_1 \mid \alpha\beta_2
$$

into:

$$
A ::= \alpha A'
$$

$$
A' ::= \beta_1 \mid \beta_2
$$

For example:

```text
Factor ::= (Expr)
         | ID
         | ID[Expr]
         | ID(Expr)
```

becomes:

```text
Factor   ::= (Expr)
           | ID Argument

Argument ::= [Expr]
           | (Expr)
           | ε
```

## 7. LL Grammars

**An LL grammar is a CFG that can be recognized by backtracking-free recursive-descent predictive parsing.** The first `L` means the input tokens are scanned from left to right. The second `L` means the parser constructs a leftmost derivation.

An LL($k$) grammar allows the parser to look ahead $k$ tokens. LL(1) is the most common case.

For LL(1), the decision conditions are exactly the FIRST/FOLLOW disjointness rules above. Important properties:

- LL(1) grammars are unambiguous.
- LL(1) grammars have no left recursion.
- LL(1) grammars have no left factors.

:::warn ⚠️ Small technical caveat
The formal LL(1) test can classify `S ::= S a` as LL(1) because the language of `S` is empty. This edge case is usually harmless in compiler practice, where grammars are intended to generate real programs.
:::

Not every context-free language has an LL grammar. The language:

$$
\{a^ib^j \mid i\ge j\}
$$

with grammar:

```text
S -> aS | P
P -> aPb | ε
```

is not expressible by any LL grammar. With any fixed lookahead $k$, the strings $a^kb^k$ and $a^{k+1}b^k$ start with the same $k$ symbols, but they require different choices before the parser sees the deciding `b`.

:::remark 📝 Question: Can we construct an LL(0) grammar? Is it meaningful?
Question: **Try to construct an LL(0) grammar. Is this kind of grammar meaningful?**

Answer: LL(0) means the parser chooses productions without looking at any input token. Such grammars are extremely limited: each nonterminal must essentially have at most one viable production unless alternatives are unreachable or generate empty languages. They are not useful for practical programming languages, but the idea clarifies why lookahead is necessary.
:::

## 8. PEG and Packrat Parsing

Generative grammars define a language by deriving strings. Regular expressions and CFGs are generative. Recognition-based grammars define a language by recognition rules; this is often closer to what a parser implementation actually does.

Parsing Expression Grammar, or PEG, is recognition-based. The key semantic difference is choice:

$$
A \to \alpha_1 \mid \alpha_2
$$

in CFG gives no priority between $\alpha_1$ and $\alpha_2$, but:

$$
A \leftarrow \alpha_1/\alpha_2
$$

in PEG first tries $\alpha_1$ and tries $\alpha_2$ only if $\alpha_1$ fails.

![PEG ordered choice](lec03_materials/peg_ordered_choice.png)

So in CFG:

$$
A\to 01\mid 0
$$

and:

$$
A\to 0\mid 01
$$

are equivalent. In PEG:

$$
A\leftarrow 01/0
$$

and:

$$
A\leftarrow 0/01
$$

are not equivalent, because the second rule never considers `01` after `0` succeeds.

PEG operators include:

- terminal `a`: recognize symbol `a`;
- sequence $e_1e_2$: recognize $e_1$, then $e_2$;
- ordered choice $e_1/e_2$: try $e_1$, then $e_2$ from the same position if $e_1$ fails;
- $e?$, $e^*$, $e^+$: greedy optional/repetition operators;
- `&e`: positive lookahead predicate, succeeds without consuming input if `e` would match;
- `!e`: negative lookahead predicate, succeeds without consuming input if `e` would not match.

Examples:

$$
S \leftarrow iSeS/iS/a
$$

handles dangling `else` by ordered choice, and:

$$
C \leftarrow o(C/(!c\ a))^*c
$$

can recognize nested comments with lookahead.

PEG parsing is essentially recursive descent with backtracking. Two issues need attention: left recursion and efficiency. Left recursion can be eliminated; efficiency is handled by Packrat parsing.

**Packrat parsing memoizes recursive-descent results.** The result of parsing a nonterminal depends only on the nonterminal and the current input position. Storing that result turns repeated backtracking work into table lookups, trading memory for linear-time parsing.

![Packrat memo table](lec03_materials/packrat_memo_table.png)

## 9. Toy Language Syntax

The toy language is a small C-like language with only `main`, only `int`, and straight-line code. Its syntax can be written in PEG style:

```text
Expr   <- Term ((+ / -) Term)*
Term   <- Factor ((* / / / %) Factor)*
Factor <- (Expr) / ID / NUMBER

Stmt   <- Block
        / int ID (= Expr)? ;
        / ID = Expr ;
        / return Expr ;

Block  <- { Stmt* }
Func   <- int ID () Block
Prog   <- Func EOF
```

![Toy language syntax specification](lec03_materials/toy_language_syntax_spec.png)

The expression rules encode precedence and left associativity by construction. `EOF` explicitly marks the end of the program. If conditional statements are later added, PEG ordered choice can directly express the nearest-`else` behavior:

```text
Stmt <- if (Expr) Stmt else Stmt
      / if (Expr) Stmt
      / ...
```

A memoized parser can store, for each nonterminal and starting position, whether parsing succeeds, the parse tree produced, and the next input position. Repetition such as `((+ / -) Term)*` can be implemented by a greedy loop that consumes as many repetitions as possible.

## 10. Summary

Syntax analysis gives the programming language a grammar. CFGs are the standard generative specification, especially for LL grammars and recursive descent. Predictive recursive descent constructs a leftmost derivation, requires eliminating left recursion and left factors, and uses FIRST/FOLLOW sets to choose rules without backtracking. PEG provides a recognition-based alternative with ordered choice, greedy repetition, lookahead predicates, and Packrat parsing for efficient memoized recognition.

## Exam Review

Core definitions:

- Grammar: $G=(V_T,V_N,S,P)$, a terminal set, nonterminal set, start symbol, and production set.
- CFG: a grammar whose production left-hand side is exactly one nonterminal.
- Derivation: repeated application of productions from the start symbol.
- Reduction: derivation in reverse.
- Parse tree: a tree visualization of a CFG derivation.
- Ambiguity: a string has more than one parse tree, or a grammar generates such a string.
- FIRST: terminals that may begin strings derived from a grammar symbol sequence.
- FOLLOW: terminals that may appear immediately after a nonterminal.
- LL(1): left-to-right input scan, leftmost derivation, one-token lookahead.
- PEG: ordered, recognition-based grammar.
- Packrat: memoized recursive-descent parsing.

Mechanisms to be able to explain:

- Why parsing turns a token sequence into a tree.
- Why CFGs express nested structures that regexes cannot.
- How precedence is encoded with `Expr`, `Term`, and `Factor`.
- How nearest-`else` can be encoded by grammar or PEG priority.
- How recursive descent maps nonterminals to functions.
- How FIRST/FOLLOW decide productions in predictive parsing.
- How left recursion and left factoring are removed.
- How PEG ordered choice differs from CFG alternatives.

Short-answer templates:

- Why syntax analysis? It checks token order against the language grammar and constructs a tree that records nesting, precedence, and statement structure.
- Why not only regex? Regex cannot represent unbounded nesting such as balanced parentheses; CFGs can.
- What goes wrong with ambiguity? The same token sequence can produce different parse trees and therefore different meanings.
- Why eliminate left recursion? Naive recursive descent may call the same nonterminal before consuming input, causing nontermination.
- Why need FOLLOW? When an alternative can derive $\epsilon$, the parser must know which tokens can legally appear after the nonterminal.
- Can lexical and syntax analysis be merged? Yes in principle, and PEG-style scanners can combine recognition layers, but separating them keeps token rules, whitespace, comments, and source locations easier to manage.
- Are all syntax specifications CFG-expressible? Many programming-language cores are CFG-like, but indentation sensitivity, context-sensitive name/type restrictions, and some layout or macro systems need extra semantic checks, lexer modes, parser actions, or recognition-based parsing.

Common mistakes:

- Confusing token classes with terminals in a grammar.
- Treating a grammar with precedence bugs as merely an implementation issue.
- Assuming every CFG is suitable for recursive descent.
- Forgetting the $\epsilon$ case in FIRST/FOLLOW computation.
- Using FIRST sets alone to choose an $\epsilon$ production.
- Thinking PEG `/` is the same as CFG `|`.
- Ignoring EOF, which can let a parser accept only a prefix of the input.

Self-check:

- Can you write the four components of $G=(V_T,V_N,S,P)$ for a small grammar?
- Can you draw two parse trees for the ambiguous grammar of `a+b*c`?
- Can you rewrite the expression grammar to encode precedence?
- Can you remove direct left recursion from $A ::= A\alpha \mid \beta$?
- Can you compute FIRST and FOLLOW for the expression grammar?
- Can you explain why a grammar is not LL(1) when FIRST sets overlap?
- Can you explain why `A <- 0 / 01` fails to match `01` as a two-character alternative in PEG?
