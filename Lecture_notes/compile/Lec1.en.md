# Lec1: Compiler Overview and Language Processing

A compiler translates a source program into a target program while preserving its meaning. A typical compiler pipeline includes lexical analysis, parsing, semantic analysis, intermediate representation generation, optimization, and target code generation.

## From Characters to Structure

At the beginning, source code is only a sequence of characters. The lexer groups characters into tokens, and the parser uses a grammar to build an abstract syntax tree. For the expression `a + b * c`, the multiplication node usually appears under the addition node to encode precedence.

Inline formula example: if `G` is a context-free grammar, one derivation step can be written as $\alpha A \beta \Rightarrow \alpha \gamma \beta$.

$$
E \rightarrow E + T \mid T,\qquad
T \rightarrow T * F \mid F,\qquad
F \rightarrow (E) \mid id
$$

:::note 📝 Why ASTs Matter
An abstract syntax tree removes punctuation and other purely syntactic details while keeping the program structure. Semantic checking, type inference, and IR generation are usually organized around the AST.
:::

## The Compiler Pipeline

- Lexical analysis: character stream to token stream.
- Parsing: token stream to parse tree or abstract syntax tree.
- Semantic analysis: names, scopes, types, and control-flow constraints.
- Intermediate representation: language-specific structures to optimization-friendly IR.
- Code generation: instruction selection, register allocation, and target emission.

:::hint 💡 Study Hint
For each phase, ask two questions first: what is the input, and what is the output. This keeps local algorithms connected to the whole pipeline.
:::

## A Tiny IR Fragment

```text
t1 = b * c
t2 = a + t1
return t2
```

> IR is not merely “closer to machine code”; its real job is to make analysis and transformation stable.

:::warning ⚠️ Common Confusion
Syntactically valid code is not necessarily semantically valid. For example, `x + true` may pass parsing but fail type checking.
:::

:::danger ⛔ Pitfall
Do not conflate a concrete parse tree with an abstract syntax tree. The former keeps the derivation details, while the latter focuses on semantic structure.
:::
