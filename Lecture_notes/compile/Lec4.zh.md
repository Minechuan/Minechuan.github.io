# Lec4：语义分析

语义分析是编译器从“这个 token 序列是否合法”转向“这个结构到底是什么意思”的阶段。它负责提取上下文有关信息，构造更有用的内部表示，检查语义约束，并为后续的中间表示生成、优化和代码生成做准备。

![从语法树走向抽象语法树的语义分析](lec04_materials/semantic_translation_pipeline.png)

## 1. 语义分析做什么

**语义分析从语法分析树或抽象语法树中提取程序的核心含义。** 在不同场景里，这项工作可能表现为把语法结构翻译成中间表示、做类型检查，或者直接解释执行程序。

最典型的三类任务是：

- 把语法树翻译成 AST 或其他 IR；
- 计算并检查类型信息；
- 计算表达式与语句的执行结果。

它和语法分析的根本区别在于：语义分析是上下文有关的。它必须回答这类问题：

- `x` 里存的是什么类型的值；
- 需要多大的存储空间；
- 如果 `x` 是函数，它的参数和返回值是什么；
- 一个值的生命周期有多长；
- 存储空间应该在什么时候、由谁来分配和初始化。

语义分析可以有两种常见实现方式：

- 先完整构造语法分析树，再单独做一遍语义分析；
- 与语法分析同步，在分析过程中直接计算语义信息。

## 2. 属性文法是最主要的规约工具

理论上，直接用上下文有关文法来描述语义分析并非不可能，但工程上很别扭。像 $a^n b^n c^n$ 这样的语言，确实可以用上下文有关产生式刻画；但编译器通常并不需要这样做。它真正需要的是：先把程序分析成树，再在树上检查相关语义条件。

**属性文法 = 上下文无关文法 + 属性计算规则。** 它也叫 **语法制导定义（SDD）**。

如果语法树上的某个结点标号为文法符号 $X$，那么 `X.a` 表示这个结点的属性 `a`。每条产生式都可以附带多条语义规则，用来描述父结点和子结点属性之间的关系。

对四则运算表达式，一个最自然的属性就是值：

$$
\begin{aligned}
\text{Expr} &::= \text{Expr} + \text{Term} \mid \text{Expr} - \text{Term} \mid \text{Term} \\
\text{Term} &::= \text{Term} * \text{Factor} \mid \text{Term} / \text{Factor} \mid \text{Factor} \\
\text{Factor} &::= (\text{Expr}) \mid \text{INT}
\end{aligned}
$$

对应的语义规则会计算：

$$
\text{Expr.val} = \text{Expr}_1.\text{val} + \text{Term.val}, \qquad
\text{Factor.val} = \text{INT.intval}
$$

此时编译器仍然依附于文法结构，但属性规则让我们可以在局部产生式上直接写出语义。

:::remark 📝 问题：既然语义是上下文有关的，为什么不直接用上下文有关文法？
问题：**既然语义本来就是上下文有关的，为什么不直接用上下文有关文法来描述语义分析？**

解答：因为编译器更实际的工作模式通常是“先分析出语法结构，再在树上检查和计算”。上下文有关文法在编译器实现里不够顺手。属性文法保留了简单的 CFG 语法骨架，再把语义附着到已有的语法结构上，更适合工程实现。
:::

## 3. 综合属性与继承属性

**综合属性（synthesized attribute）自底向上流动。** 结点的属性值由其孩子结点的属性计算而来。

**继承属性（inherited attribute）自顶向下流动。** 结点的属性值由父结点以及受限情况下的兄弟结点属性决定。

四则运算求值是标准的综合属性例子：`Expr.val`、`Term.val`、`Factor.val` 都是从子树向上计算出来的。

有符号二进制数则需要两个方向的信息。考虑：

$$
\begin{aligned}
\text{Number} &::= \text{Sign}\ \text{List} \\
\text{Sign} &::= + \mid - \\
\text{List} &::= \text{Bit} \mid \text{List}\ \text{Bit} \\
\text{Bit} &::= 0 \mid 1
\end{aligned}
$$

这里：

- `val` 记录整数值；
- `sgn` 记录符号；
- `pos` 记录位的位置，最低位的位置是 `0`。

核心规则包括：

$$
\begin{aligned}
\text{Number.val} &= \text{Sign.sgn} \times \text{List.val} \\
\text{List.pos} &= 0 \\
\text{List.val} &= \text{List}_1.\text{val} + \text{Bit.val} \\
\text{List}_1.\text{pos} &= \text{List.pos} + 1 \\
\text{Bit.val} &= 2^{\text{Bit.pos}}
\end{aligned}
$$

也就是说，数值 `val` 是向上汇总的，而位置信息 `pos` 是向下传递的。

![带位置信息继承属性的有符号二进制求值树](lec04_materials/signed_binary_evaluation_tree.png)

:::tip 💡 问题：为什么 `pos` 必须是继承属性？
问题：**为什么位置信息 `pos` 是继承属性，而不是综合属性？**

解答：因为一个 bit 自己的子树并不能告诉它“我是第几位”。这个信息取决于它在整个数字中的上下文位置，所以只能从外部传下来，自然就应该设计成继承属性。
:::

## 4. 属性计算顺序与有环情况

当属性之间存在依赖时，必须先回答“按什么顺序计算”。

可以构造**属性依赖图**：

$$
c \to d
$$

表示属性 `d` 的计算依赖属性 `c`。如果依赖图无环，那么就可以按拓扑序计算。

![有符号二进制求值的属性依赖图](lec04_materials/attribute_dependency_graph.png)

这是最理想的情况。但语义计算并不总是无环的。

考虑这个极小的循环语言：

$$
\begin{aligned}
\text{Loop} &::= \text{repeat INT do Stmt} \\
\text{Stmt} &::= \epsilon \mid \text{cnt += INT ; Stmt}
\end{aligned}
$$

为了对它做解释执行，讲义引入：

- `cnt_init`：语句执行前 `cnt` 的值；
- `cnt_final`：语句执行后 `cnt` 的值。

对于 `repeat 10 do cnt += 50;`，最终结果应该是 `500`。这要求我们反复更新状态，因此某些依赖天然会形成“下一轮依赖上一轮”的循环。

真正要记住的不是“有环一定错”，而是：

- 无环依赖可以一次性按固定顺序算完；
- 有环依赖在语义本身就是迭代过程时，仍然完全有意义。

:::remark 📝 问题：依赖图有环为什么不一定错？
问题：**如果属性依赖图里有环，为什么这个语义定义不一定非法？**

解答：因为有些语义过程本来就是迭代式的。循环第 $k+1$ 轮的状态依赖第 $k$ 轮的结果，这反映的是“重复执行”，不是“自相矛盾”。在这种情况下，属性求值更像状态迭代，而不是一次性的树上归约。
:::

## 5. S 属性文法与 L 属性文法

一般属性文法表达力很强，但分析起来不够规整。两类受限形式尤其重要，因为它们保证了可实现的求值顺序。

**S 属性文法只有综合属性。** 信息始终自底向上流动。

**L 属性文法允许继承属性，但它们只能依赖父结点和左侧上下文。** 对于产生式

$$
A \to X_1 X_2 \cdots X_k
$$

$X_i$ 的继承属性只能依赖：

- `A` 的继承属性；
- `X_1, \dots, X_{i-1}` 的属性。

这意味着信息流向是“自顶向下、从左到右”，而这恰好和自顶向下语法分析看到输入的顺序一致。

讲义把表达式求值改写成 L 属性形式：

$$
\begin{aligned}
\text{Expr} &::= \text{Term}\ \text{Expr}' \\
\text{Expr}' &::= +\ \text{Term}\ \text{Expr}' \mid -\ \text{Term}\ \text{Expr}' \mid \epsilon \\
\text{Term} &::= \text{Factor}\ \text{Term}' \\
\text{Term}' &::= *\ \text{Factor}\ \text{Term}' \mid /\ \text{Factor}\ \text{Term}' \mid \epsilon
\end{aligned}
$$

并引入如下属性规则：

$$
\text{Expr}'.\text{inh} = \text{Term.val}, \qquad
\text{Expr.val} = \text{Expr}'.\text{syn}
$$

以及：

$$
\text{Expr}'_1.\text{inh} = \text{Expr}'.\text{inh} + \text{Term.val}, \qquad
\text{Expr}'.\text{syn} = \text{Expr}'_1.\text{syn}
$$

对 `31 + 8 * 50` 来说，继承属性就像一个向前传递的累加器，最终综合属性给出结果 `431`。

![`31 + 8 * 50` 的 L 属性求值树](lec04_materials/l_attributed_expression_tree.png)

:::tip 💡 问题：为什么课程里反复强调 S 属性和 L 属性文法？
问题：**为什么编译原理里总在强调 S 属性文法和 L 属性文法？**

解答：因为这两类文法有稳定、可执行的属性求值顺序。很多时候，我们可以在语法分析过程中直接完成语义计算，而不必先建完整语法树，再单独跑一个通用的属性求值器。
:::

## 6. 属性能计算什么

属性并不只用于算术求值。它可以承载很多不同类型的语义任务。

### 6.1 构造 AST 或其他 IR

我们完全可以不去计算一个数字，而是构造树状中间表示：

$$
E ::= \operatorname{add}(E,E) \mid \operatorname{sub}(E,E) \mid \operatorname{mul}(E,E) \mid \operatorname{div}(E,E) \mid \operatorname{intv}(i)
$$

这样 `31 + 8 * 50` 会变成：

$$
\operatorname{add}(\operatorname{intv}(31), \operatorname{mul}(\operatorname{intv}(8), \operatorname{intv}(50)))
$$

这通常就是语义分析的首个重要产物：把具体语法细节剥掉，只保留后续阶段真正需要的结构。

### 6.2 做表达式类型检查

类型信息也可以用属性表示。如果把 factor 扩展为支持浮点字面量：

$$
\text{Factor} ::= (\text{Expr}) \mid \text{INT} \mid \text{FLOAT}
$$

那么运算结果类型就可以通过语言规定的函数计算，例如：

$$
\text{Expr.type} = \mathcal{F}_{+}(\text{Expr}_1.\text{type}, \text{Term.type})
$$

减法、乘法、除法同理。

重点不在于“文法本身懂类型提升规则”，而在于：文法结构指出了运算发生在哪里，语义规则则在这些位置编码语言的类型系统策略。

### 6.3 定义小步解释执行

属性规则还可以描述“一步执行之后变成什么”。对表达式 AST：

$$
E.\text{next} = \mathcal{C}_{+}(E_1,E_2)
$$

表示 `next` 属性记录一次小步规约之后得到的新表达式。整体思路是：

- 如果左操作数还不是值，就先规约左边；
- 否则规约右操作数；
- 当两边都是值时，再真正执行运算。

这提醒我们：属性文法不仅能做静态检查，也能编码动态行为。

## 7. 在递归下降中手动实现语义分析

语义分析并不一定要等完整的语法树建好再做。如果文法属于比较规整的类别，递归下降分析器可以直接同步完成语义计算。

对于括号文法：

$$
\begin{aligned}
S' &\to S\ \text{EOF} \\
S &\to \epsilon \\
S &\to [S_1]S_2
\end{aligned}
$$

其中综合属性：

$$
S.\text{cnt} = 1 + S_1.\text{cnt} + S_2.\text{cnt}
$$

表示匹配括号对数。在 S 属性递归下降实现中，每个非终结符过程只需要返回自己的综合属性即可。

![括号计数的递归下降语义实现](lec04_materials/bracket_count_recursive_descent.png)

对于 L 属性文法，每个非终结符过程则需要：

- 用参数接收继承属性；
- 用返回值带回综合属性。

这正是 `inh` / `syn` 设计非常实用的原因：它和函数参数、返回值的映射几乎是直接的。

还有一个工程上很重要的细节：消除左递归以后，常常会引入继承属性。原本看起来像“纯自底向上累积”的语义信息，在改写成适合递归下降的形式后，往往需要显式携带一个累积参数。

:::warn ⚠️ 问题：为什么消除左递归会改变语义实现方式？
问题：**为什么消除左递归之后，经常必须引入继承属性？**

解答：因为原来的左递归天然把“已经算好的左边结果”留在结构左侧。改写成适合递归下降的右递归或尾递归形式后，这些左侧上下文必须显式向后传递，于是就需要一个类似累加器的继承属性来保存部分结果。
:::

## 8. 在 AST 上做进一步语义推敲

讲义随后把例子从表达式推进到一个小型语句语言。它的 AST 包含如下结构：

$$
\begin{aligned}
E &::= \operatorname{binop}(op,E,E) \mid \operatorname{id}(x) \mid \operatorname{number}(i) \\
S &::= \operatorname{block}(\vec S) \mid \operatorname{decl}(x) \mid \operatorname{decl}(x,E) \mid \operatorname{assign}(x,E) \mid \operatorname{ret}(E)
\end{aligned}
$$

在后续分析之前，先把它进一步规整成更简单的语句形式：

$$
\hat S ::= \operatorname{scope}(\hat S) \mid \operatorname{decl}(x,\hat S) \mid \operatorname{assign}(x,E) \mid \operatorname{ret}(E) \mid \operatorname{seq}(\hat S,\hat S) \mid \operatorname{nop}
$$

这个规整后的 AST 把作用域与语句顺序都显式写出来了。

![语句 AST 的进一步语义推敲示例](lec04_materials/semantic_elaboration_examples.png)

讲义用一种 **R 属性** 风格来完成这一过程。继承属性 `cont` 类似 continuation，记录当前语句后面已经推敲好的后缀；综合属性 `elab` 负责构造当前的规整结果。代表性规则有：

$$
\begin{aligned}
SS.\text{cont} &= \operatorname{nop} \\
S.\text{elab} &= \operatorname{seq}(\operatorname{scope}(SS.\text{elab}), S.\text{cont}) \\
SS.\text{elab} &= SS.\text{cont} \\
S.\text{elab} &= \operatorname{decl}(x, S.\text{cont}) \\
S.\text{elab} &= \operatorname{seq}(\operatorname{assign}(x,E), S.\text{cont})
\end{aligned}
$$

核心思想并不复杂：把语句列表显式改写成顺序结构，把声明改写成带作用域意识的结构，让后续阶段面对的是一棵更干净、更统一的树。

:::remark 📝 问题：为什么要先做 AST 推敲，再做类型检查？
问题：**为什么要引入 `scope`、`seq`、`nop` 这些结构，而不是直接在原始语句树上做类型检查？**

解答：因为规整后的树把真正重要的语义结构显式化了。后续分析不需要在许多表面语法形式里反复恢复“语句顺序”和“作用域边界”，只要面对一种统一表示即可，这会让符号表更新和作用域处理清晰得多。
:::

## 9. 用符号表与作用域做类型检查

语句层面的类型检查并不只是“运算结果是什么类型”，还必须处理作用域和初始化状态。

讲义特别强调至少要检查：

- 变量不会在声明或赋值之前被使用；
- 同一作用域内不会重复声明同名变量。

编译器会用**符号表（symbol table）**记录名字信息。从语义上看，每个作用域对应一个符号表，多个符号表形成一棵树；从实现上看，常常只需要一个栈：当前作用域在栈顶，查找时从栈顶向下寻找最近的匹配声明。

![作用域树与符号表栈的直观示意](lec04_materials/scope_symbol_tables.png)

核心接口通常包括：

- `push_scope()`
- `pop_scope()`
- `insert(name, info)`
- `lookup(name)`

在规整后的语句树上，类型检查属性文法使用继承属性 `table_in` 和综合属性 `table_out`。直观理解是：

- `table_in` 是处理当前结点前的符号表状态；
- `table_out` 是处理当前结点后的符号表状态。

典型规则包括：

$$
\hat S_1.\text{table\_in} = \hat S.\text{table\_in}.\operatorname{push\_scope}()
$$

$$
\hat S_1.\text{table\_in} = \hat S.\text{table\_in}.\operatorname{insert}(x,\operatorname{UNASSIGNED})
$$

$$
\hat S.\text{table\_out} = \hat S.\text{table\_in}.\operatorname{update}(x,\operatorname{ASSIGNED})
$$

而在使用标识符时，要检查：

$$
\text{error if } E.\text{table.lookup}(x) == \operatorname{UNASSIGNED}
$$

这是一种非常实用的语义分析模式：把语义状态显式表示出来，以固定方向穿过整棵树，并在第一次非法使用时报告错误。

## 10. Visitor Pattern

一旦 AST 建好，后续很多任务都需要遍历它：格式化打印、类型检查、优化、代码生成、解释执行都属于这一类。Visitor Pattern 的作用，就是把这些“操作”从 AST 结点定义中分离出来。

![语句 AST 上的 Visitor Pattern](lec04_materials/visitor_pattern.png)

讲义里的 C++ 结构大致是：

- 抽象基类 `Stmt`，提供 `accept(StmtVisitor&)`；
- 抽象访问者 `StmtVisitor`，提供 `visit_block`、`visit_decl`、`visit_assign`、`visit_ret`；
- 各个具体语句类在 `accept` 中分发到正确的 visitor 方法；
- 一个具体访问者，例如 `StmtPrinter`。

它带来的好处很直接，也很工程化：如果要为 AST 增加一种新操作，只需要新写一个 visitor 子类，而不必回头修改整套语句类层次。

## 11. Exam Review

### 11.1 必记定义

- **语义分析**：基于语法结构计算上下文有关语义。
- **属性文法 / SDD**：在 CFG 上附加语义规则。
- **综合属性**：信息从孩子向父结点流动。
- **继承属性**：信息从上下文流入当前结点。
- **S 属性文法**：所有属性都是综合属性。
- **L 属性文法**：继承属性只依赖父结点和左侧上下文。
- **语义推敲**：把表面语法转换成更适合后续处理的内部表示。
- **符号表**：记录作用域中名字信息的数据结构。

### 11.2 需要会讲清楚的机制

- 如何在语法树上计算属性值。
- 为什么属性依赖图能决定计算顺序。
- 为什么某些有环依赖在迭代语义里仍然合理。
- 为什么递归下降天然适合 S 属性和 L 属性场景。
- 为什么规整后的 AST 更利于后续分析。
- 如何用符号表栈实现作用域处理。

### 11.3 简答题模板

- 为什么需要语义分析：
  因为仅靠 CFG 语法分析无法得到上下文有关含义。
- 为什么属性文法有用：
  因为它把语义规则局部地挂在产生式上。
- 为什么需要继承属性：
  因为有些信息来自上下文，而不是当前子树自身。
- 为什么符号表重要：
  因为它把名字和声明、类型、作用域、初始化状态关联起来。

### 11.4 常见误区

- 把语法分析树和 AST 混为一谈；
- 把类型检查只理解为表达式类型，而忽略作用域和初始化；
- 认为所有依赖环都非法；
- 忽略消除左递归后语义数据流会变化；
- 忘记处理遮蔽和同一作用域内的重复声明。

### 11.5 自检清单

- 你能不用背诵式口号，自己解释综合属性和继承属性的区别吗？
- 你能用 `sgn`、`val`、`pos` 算出一个有符号二进制数的值吗？
- 你能解释为什么 `31 + 8 * 50` 在 L 属性版本里得到 `431` 吗？
- 你能说明 `table_in` 和 `table_out` 是如何穿过 `scope`、`decl`、`assign`、`seq` 的吗？
- 你能解释为什么 visitor 能在不改 AST 结点定义的情况下扩展功能吗？
