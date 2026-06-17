# 第13讲 AI for Physics 与 Physics for AI

## 1. 全局图景
本讲围绕两个互补的问题展开：

1. AI 能怎样帮助我们表示、模拟，甚至发现物理规律？
2. 物理学里的思想又能怎样反过来帮助 AI 的模型设计与理论分析？

最清晰的总图是：

- `AI for Physics`：用学习方法做物理表示、加速仿真、正则化 ill-posed 任务、求解 inverse problem，并辅助科学发现。
- `Physics for AI`：把物理机制和物理视角带回机器学习，用来构造生成模型、学习理论和优化方法。

![AI for Physics vs Physics for AI](lec13_materials/ai_for_physics_vs_physics_for_ai.png)

理解这一讲时，最重要的心态不是“仿真和学习谁替代谁”，而是看清它们的接口：

- 方程和数据之间的接口，
- 结构和灵活性之间的接口，
- forward prediction 和 inverse inference 之间的接口，
- 科学建模和现代机器学习之间的接口。

## 2. 为什么要把 AI 和 Physics 结合起来？
### 2.1 从经验科学走向数据驱动科学
一个重要背景是“四种科学范式”的演进：

- empirical science：观察并记录现象；
- theoretical science：用定律和方程解释现象；
- computational science：把这些定律数值化并做仿真；
- data-driven science：当显式建模不完整、代价太高或部分未知时，从大规模数据中学习。

![Four paradigms of physics](lec13_materials/four_paradigms_of_physics.png)

物理仿真本来就属于第三范式，但很多现代任务天然会延伸到第四范式：

- 测量很稀疏，
- 参数并不确定，
- 几何非常复杂，
- 暴力计算代价过高，
- 而且很多目标本身就是 inverse 的，而不是 forward 的。

### 2.2 一个 Forward Simulator 到底在做什么
一个 forward simulator 通常从三类东西出发：

- 几何与状态表示，
- 守恒律、本构关系等物理规律，
- 将这些方程离散化并求解的数值算法。

然后它在时间上推进系统，产出轨迹、形变、流场，或者多物理场耦合行为。

![Forward simulation pipeline](lec13_materials/forward_simulation_pipeline.png)

讲义强调的典型对象包括：

- deformable bodies，
- thin shells 与 cloth，
- fluids，
- granular / multi-phase systems，
- 不同物理域之间的耦合现象。

### 2.3 数值仿真、深度学习与混合方法
纯数值仿真可解释性强，也更容易携带物理保证，但它可能很慢、很脆弱，而且在观测不完整的现实问题上并不好用。纯深度学习足够灵活、对数据自适应，但可能违反物理约束，或者一旦离开训练分布就明显失效。

混合方法想保留两边的优点：

- 用仿真提供结构、先验和可微约束；
- 用学习补速度、补缺失信息、补高表达能力的 surrogate；
- 当任何一方单独使用都不够时，让两者协同工作。

![Simulation-learning comparison](lec13_materials/simulation_learning_comparison.png)

:::remark 关键问题（原意复述）：为什么不能直接用深度学习彻底替代数值仿真？
因为两者的失败方式并不一样。数值仿真有结构、有物理含义，但常常昂贵而且不完整；深度学习很灵活，但可能不守恒、分布外泛化差、还依赖大量数据。很多图形学与物理任务真正需要的是物理归纳偏置和数据适应性同时存在。
:::

## 3. AI for Physics Representation
### 3.1 显式表示
AI 和 physics 最早交汇的地方之一，就是表示。

经典仿真常用的显式状态布局包括：

- Eulerian grid：存 pressure、density、velocity 这类场量；
- particles：做 Lagrangian 质量点、动量点或物质点采样；
- meshes：表示曲面、薄壳和可形变固体。

不同显式结构天然对应不同学习骨架：

- grid 很适合 CNN、U-Net、ResNet；
- particle 很适合 PointNet 风格、graph 和 continuous convolution；
- mesh 很适合 graph neural network、mesh convolution 以及拓扑感知网络。

![Physics representation overview](lec13_materials/physics_representation_overview.png)

最核心的结论是：表示不是表面选择，而是会直接决定模型能利用什么样的 locality、invariance、connectivity 和 resolution。

### 3.2 隐式神经表示
更近一步的方向，是把物理状态存在 coordinate-based neural field 里，而不是固定离散数组里。

典型例子有：

$$
 f(x,y,z)=\mathbf{u}
$$

表示神经 velocity field，或者

$$
 f(x,y,z)=\mathbf{x}
$$

表示神经 deformation map。

它的含义是：我们不再说“值只定义在 grid node 或 mesh vertex 上”，而是说“网络可以在任意空间坐标处被查询”。这样会带来：

- 连续的空间访问能力，
- 推理阶段的分辨率独立性，
- 表达复杂几何与场的自然方式。

![Implicit neural spatial representation](lec13_materials/implicit_neural_spatial_representation.png)

讲义还给出一个更激进的方向：直接在隐式神经表示上求 PDE。代表性的优化写法可以记成

$$
\theta^{n+1}=\arg\min_{\theta^{n+1}}\sum_{x\in\mathcal{M}\subset\Omega}\mathcal{I}\!\left(\Delta t,\{f_{\theta^{k}}\}_{k=0}^{n+1},\{\nabla f_{\theta^{k}}\}_{k=0}^{n+1},\{\nabla^2 f_{\theta^{k}}\}_{k=0}^{n+1},\ldots\right).
$$

它表达的意思是：通过优化网络参数，让网络所表示的场满足 PDE 残差与时间推进约束。

### 3.3 混合表示
讲义并不是在主张“隐式表示应当全面替代显式表示”。实践里很多强方法恰恰是混合的：

- explicit geometry + implicit field，
- particles + grid，
- Lagrangian motion + Eulerian solve，
- 在经典求解器里嵌入 neural surrogate。

之所以必须有这种混合视角，是因为仿真不只是“把状态存下来”。它还要求我们高效地施加局部算子、强制约束、并解稀疏数值子问题。

:::remark 关键问题（原意复述）：为什么隐式表示很有表达力，却依然不等于“仿真更容易做”？
因为“表达能力强”和“对求解器友好”是两件不同的事。神经场可以紧凑地表达连续函数，但 PDE 求解仍然需要导数、约束、稳定性控制和高效优化。连续表示并不会自动解决时间积分和约束施加的问题。
:::

## 4. AI for Physics Simulation
### 4.1 加速 Forward Problems
AI 在仿真里的第一大作用，是加速。

讲义强调了三类典型模式。

第一类是学习 **solution operator**：

$$
\{\mathbf{x}_0,\dot{\mathbf{x}}_0,\ldots\}+\{bc\}\xrightarrow{\mathrm{AI}}\{\mathbf{x}_t,\dot{\mathbf{x}}_t,\ldots\}.
$$

这里网络直接把初始条件与边界条件映射到最终解，或者整段解。

第二类是学习 **time evolution operator**：

$$
\{\mathbf{x}_{t-1},\dot{\mathbf{x}}_{t-1},\ldots\}+\{bc\}\xrightarrow{\mathrm{AI}}\{\mathbf{x}_t,\dot{\mathbf{x}}_t,\ldots\}.
$$

这里网络一次推进一步，更像 learned simulator 或 learned integrator。

第三类则是在已有仿真器外面做：

- super-resolution，
- correction，
- projection，
- 或者替换某个代价特别高的子步骤。

![Accelerate forward problems](lec13_materials/accelerate_forward_problems.png)

其中一个很强的例子是 fluid super-resolution：先跑低分辨率仿真，再用带时间一致性的学习方法恢复高分辨率结果。

![Fluid super-resolution example](lec13_materials/fluid_super_resolution_example.png)

这里的价值不只是“更快”。更关键的是，很多算子会在大量相似问题上反复被调用，而学习这些映射可以把重复求解代价摊薄掉。

:::remark 关键问题（原意复述）：solution operator 和 time evolution operator 在实际使用上有什么区别？
solution operator 更像“从题目直接跳到答案”，把问题设置映射到解；time evolution operator 更像“学一个积分器”，按状态一步一步往前推。当前者的整体映射稳定且可复用时很有吸引力；而当顺序 rollout 和交互过程本身很重要时，后者更自然。
:::

### 4.2 正则化 Ill-Posed Problems
很多任务缺的不是算力，而是信息。

一个问题如果不满足下面任一条件，就会变成 ill-posed：

- 解不一定存在；
- 解不一定唯一；
- 解对输入不一定稳定依赖。

讲义把几类处理方式整理得很清楚。

#### A. Data Complement
用学习到的先验或补全模型补上缺失信息。这在观测稀疏、含噪、低分辨率或不完整时尤其有用。

#### B. Data Translation
把容易拿到的观测空间，翻译成更有物理意义、更便于控制的状态空间或控制空间。

![Regularize ill-posed problems](lec13_materials/regularize_ill_posed_problems.png)

一个流体控制例子就是在 density observation 和 velocity/control variable 之间建立可学习映射，使结果不仅“看起来像”，而且真正可控、可编辑。

![Data translation for fluid control](lec13_materials/data_translation_fluid_control.png)

#### C. Physics-Aware Learning
physics-aware 方法会显式估计一些隐含物理量或物理参数，再用它们去约束学习。

讲义中的例子写成

$$
\mathbf{u}_t=\mathrm{Generator}(d_t,\ldots),
$$

并通过一个物理结构化的最后一层保证

$$
\mathbf{u}_t=\nabla\times\phi,
$$

同时满足 advection consistency：

$$
 d_{t+1}=\mathrm{Advection}(d_t,\mathbf{u}_t).
$$

再把物理参数、kinetic energy、vorticity 等条件注入进去，学到的控制器就不只是视觉上合理，而是真正具有物理语义。

![Physics-aware learning](lec13_materials/physics_aware_learning.png)

一个紧接着的问题是：当物理参数区间变化时，学到的模型还能不能维持合理行为？

![Physics parameter generalization](lec13_materials/physics_parameter_generalization.png)

#### D. Physics-Informed Learning 与 Differentiable Physics
physics-informed 方法会再往前走一步：它把方程、残差或可微仿真算子直接塞进训练或优化过程。

典型工具包括：

- differentiable physics engine，
- PINN，
- 可微弹性体与流体求解器，
- automatic differentiation，或更高精度的 finite-difference 梯度技术。

![Physics-informed learning](lec13_materials/physics_informed_learning.png)

当我们的目标不是“预测一个像物理的输出”，而是要在训练或推断过程中真正满足物理规律时，这个视角尤其重要。

:::remark 关键问题（原意复述）：physics-aware learning 和 physics-informed learning 到底差在哪里？
physics-aware learning 是把物理量、物理参数或物理结构拿来引导模型；physics-informed learning 则是把显式物理方程或可微仿真器直接写进优化目标或计算图。前者更像“受物理启发地设计”，后者更像“在训练或求解时被物理硬约束”。
:::

### 4.3 求解 Inverse Problems
inverse problem 本质上是在把仿真的箭头反过来。

我们不再从已知条件预测结果，而是要根据观测去反推出隐藏原因：

- 未知参数，
- 未知力，
- 未知状态，
- 未知几何，
- 或者能解释观测现象的控制信号。

讲义特别强调了现实世界 inverse problem 为什么难：

- 观测稀疏且不完整，
- 场景里存在复杂耦合物理，
- 测量含噪，
- 多种潜在状态可能对应几乎一样的观测。

![Inverse problem challenges](lec13_materials/inverse_problem_challenges.png)

一个代表性数据集例子是 ScalarFlow，其中只给出稀疏 RGB 视角。

![ScalarFlow sparse inputs](lec13_materials/scalarflow_sparse_inputs.png)

physics-informed neural field 可以同时表示外观和动力学：

$$
 f(x,y,z,t)=(\sigma,\mathbf{c}),
$$

$$
 f(x,y,z,t)=\mathbf{u},
$$

更明确地写，就是

$$
 f_{vis}(x,y,z,t)=(\sigma,\mathbf{c}),\qquad f_{vel}(x,y,z,t)=(u,v,w).
$$

然后利用 automatic differentiation 拿到

$$
\frac{\partial \mathbf{u}}{\partial t},\quad \frac{\partial \sigma}{\partial t},\quad \nabla \mathbf{u},\quad \nabla \sigma,\ldots
$$

再通过流体 PDE 先验进行约束：

$$
\frac{\partial \mathbf{u}}{\partial t}+\mathbf{u}\cdot\nabla\mathbf{u}=-\frac{1}{\rho}\nabla p+\nu\nabla\cdot\nabla\mathbf{u}+\mathbf{f},
$$

$$
\nabla\cdot\mathbf{u}=0,
$$

$$
\frac{\partial \sigma}{\partial t}+\mathbf{u}\cdot\nabla\sigma=0.
$$

![Physics-informed neural fields](lec13_materials/physics_informed_neural_fields.png)

讲义也提醒我们：inverse problem 并不一定都走“基于梯度的 physics-informed fitting”。当任务更像 sequential decision-making 或 control 时，reinforcement learning 也是一条路线。

![Reinforcement learning for control](lec13_materials/reinforcement_learning_for_control.png)

:::remark 关键问题（原意复述）：为什么真实世界的 inverse problem 会比干净 benchmark 里的情况难得多？
因为真实观测往往不完整、有噪声、而且具有歧义；同时底层物理过程又往往高维且耦合。因果到观测的映射本来就可能是 many-to-one，所以想把它反过来时，如果没有先验、正则化或额外物理结构，问题天然就会不稳定。
:::

### 4.4 小结与开放问题
讲义把 AI for simulation 的三条主线总结为：

1. 用 surrogate model 加速 forward simulation；
2. 用 differentiable physics 和 PINN 风格方法加入物理约束；
3. 用 reinforcement learning 与优化方法处理 control 或 inverse task。

![Simulation summary and open problems](lec13_materials/simulation_summary_and_open_problems.png)

但开放问题依然非常实在：

- 能不能跨场景、跨分辨率、跨参数区间泛化；
- 能不能给出不确定性与可靠性；
- 收敛效率到底如何；
- 训练成本是否可接受；
- 到底还需要更多数据，还是需要更多物理结构。

:::remark 关键问题（原问/原意保留）：Is it converged? Do we need more data or more training iterations? What is the convergence efficiency? Is it generalizable? Is there certainty?
这些问题到现在仍然是核心，因为学习式物理系统里常常混杂了近似误差、优化误差、模型偏差和数据偏差。一个方法不能只因为“视频看起来 plausible”就算成熟；我们更关心的是训练是否稳定、结果是否有可信不确定性、以及性能能否超出训练分布继续成立。
:::

## 5. AI for Physics Discovery
物理仿真不只是为了 prediction，它也可能成为 discovery 的工具。

讲义把相关方向概括为：

- intuitive / qualitative physics：学习常识层面的物理行为；
- symbolic physics：恢复可解释的方程或规则；
- new physics：借助 AI 帮助识别未知机制或新的科学模式；
- causal learning：区分相关性与因果结构；
- invariant learning：发现跨条件保持稳定的量或对称性；
- active learning / AI scientists：主动选择实验；
- world models：学习环境内部的预测模型；
- neurosymbolic methods：把神经网络的灵活性和符号结构结合起来。

![Physics discovery directions](lec13_materials/physics_discovery_directions.png)

这些方向的输出形式各不相同，但共享同一个目标：不只去拟合观测数据，而是尽量抽取可以复用的科学结构。

:::remark 关键问题（原意复述）：既然已经有数据和仿真器了，这里的“discovery”到底指什么？
discovery 指的是学到某种结构性的新东西，而不只是把已有观测拟合得更好。这个“新东西”可以是隐含定律、因果关系、不变量、符号表达式，或者有实验价值的假设。也就是说，目标是科学洞见，而不是单纯预测精度。
:::

## 6. Physics for AI
### 6.1 Physics-Inspired Generative Models
这种相互作用也会反过来发生：物理思想本身可以启发 AI 模型设计。

最典型的例子之一就是 diffusion model。它借用了扩散过程的直觉：

- forward process 逐步往数据里加噪声；
- reverse process 逐步学会把噪声还原回数据。

讲义里把前向 Markov 转移写成

$$
q(\mathbf{x}_t\mid \mathbf{x}_{t-1})
$$

把学习到的反向转移写成

$$
p_{\theta}(\mathbf{x}_{t-1}\mid \mathbf{x}_t).
$$

![Diffusion models](lec13_materials/diffusion_models.png)

它被称为 physics-inspired，并不是因为它真的在模拟流体或固体，而是因为它把“扩散”这个简单物理过程，转化成了一个可操作的生成建模框架。

:::remark 关键问题（原意复述）：为什么 diffusion model 会被看作 physics-inspired，而不只是普通神经网络结构？
因为它的组织方式本身就是一个物理过程隐喻：前向做随机扩散，反向学习逆动力学。时间演化、噪声注入和逆过程这些数学结构是它的设计核心，而不是后加的解释。
:::

### 6.2 Physics-Inspired Learning Theory and Optimization
物理还会贡献更深层的理论视角。

一个代表例子是 operator learning。经典 universal approximation 更常讨论函数，例如

$$
F:x\mapsto F(x),\qquad (x,y)\mapsto F(x,y).
$$

但很多科学计算任务天然是 operator-valued 的：

$$
G:u(x)\mapsto G(u)(y).
$$

也就是说，输入本身是一个函数，输出也是依赖于它的另一个函数。

讲义用它来说明 physics-inspired learning theory 的一个核心思想：很多时候我们真正关心的不是若干标量到若干标量，而是场、信号、边界条件空间之间的映射。

它还强调了 physics-inspired optimization 的一些主题：

- 用 momentum、energy 等视角理解训练；
- 做 convergence rate analysis；
- 研究 acceleration mechanism；
- 把训练看作 dynamical system。

![Operator learning and optimization](lec13_materials/operator_learning_and_optimization.png)

:::remark 关键问题（原意复述）：为什么说 operator learning 比普通 function approximation 更接近科学计算？
因为很多物理问题并不是“几个数映射到几个数”，而是“一个场、一个信号或一组边界条件函数，映射到整条解函数”。operator learning 直接以这个更高层抽象为目标，因此更贴近 PDE 求解器和科学模型真正的使用方式。
:::

## 7. Exam Review
### A. 必须准确说出的定义
- **AI for Physics**：用机器学习去表示、模拟、反演或发现物理系统。
- **Physics for AI**：用物理原理和物理视角去设计 AI 模型、理论或优化方法。
- **Solution operator**：从初始/边界条件直接映射到解的算子。
- **Time evolution operator**：从当前状态映射到下一状态的算子。
- **Physics-aware learning**：由物理量、物理参数或物理结构来引导的学习。
- **Physics-informed learning**：由显式方程、残差或可微仿真直接约束的学习。
- **Inverse problem**：根据观测反推出隐藏原因、参数或状态的问题。
- **Operator learning**：学习函数空间到函数空间的映射，而不是普通点值标量映射。

### B. 应记住的机制链条
1. 显式表示选择 $\rightarrow$ 模型归纳偏置 $\rightarrow$ 可学习的 locality / connectivity。
2. 隐式神经场 $\rightarrow$ 连续查询 $\rightarrow$ 基于导数的约束 $\rightarrow$ PDE 拟合或求解。
3. Forward acceleration $\rightarrow$ 学 solution/evolution/correction operator $\rightarrow$ 摊薄重复仿真代价。
4. Ill-posed regularization $\rightarrow$ 加先验、隐含物理变量或可微方程 $\rightarrow$ 降低歧义。
5. Inverse problem solving $\rightarrow$ 拟合观测 + 强制物理规律 $\rightarrow$ 反推出潜在原因。
6. Physics for AI $\rightarrow$ diffusion / operator / optimization 视角 $\rightarrow$ 改进模型设计与理论。

### C. 简答模板
- 为什么 simulation-learning hybrid 很有吸引力？
因为仿真提供结构和物理归纳偏置，而学习提供速度、先验以及对缺失或昂贵模块的灵活补偿。

- physics-aware learning 和 physics-informed learning 有什么区别？
physics-aware learning 用物理量或结构去引导模型；physics-informed learning 直接用方程或可微仿真去约束优化过程。

- 为什么 inverse inference 如果没有正则化会很不稳定？
因为很多潜在物理状态都可能解释同一组稀疏观测，所以逆映射天然含歧义，而且对噪声很敏感。

- 为什么 operator learning 对 scientific machine learning 很重要？
因为很多科学任务本质上是函数到函数的映射，而不是向量到向量，所以 operator learning 更符合 PDE 问题的真实抽象层级。

- 为什么 diffusion model 会出现在这一讲里？
因为它展示了反向影响：一个物理过程思想可以反过来成为强大 AI 模型的组织原则。

### D. 常见误区
- 把 AI 当成所有数值求解器的直接替代品。
- 忘记表示选择会深刻影响模型能否泛化。
- 把 super-resolution 和物理上 faithful 的预测混为一谈。
- 明明用了方程残差，却只把方法叫 physics-aware，而没有意识到它已属于 physics-informed。
- 误以为只要加了神经网络，inverse problem 就会自动变简单。
- 误以为 operator learning 只是把普通回归换成更大的张量输入输出。

### E. 自检问题
1. 为什么显式的 grids、particles、meshes 往往各自对应不同神经结构？
2. 当我们直接在隐式神经表示上求 PDE 时，会多出什么难点？
3. 什么情况下你会更想学 solution operator，而不是 time evolution operator？
4. 为什么加入物理变量或方程残差能帮助 ill-posed problem？
5. 为什么 sparse-view smoke reconstruction 同时受益于 differentiable rendering 和 differentiable physics？
6. 为什么 operator learning 比普通 function approximation 更贴近 scientific computing 的需要？

:::remark 自检参考答案
1. 因为每种表示暴露出来的 locality、connectivity、symmetry 和 resolution 都不一样，架构必须和这种结构匹配。
2. 有了表示还不够，我们仍然要处理稳定求导、时间推进和约束施加，并且这些都发生在网络参数优化过程中。
3. 当大量问题实例共享稳定的“问题设置到解”的映射时，更适合学 solution operator；当顺序 rollout 和交互过程本身很重要时，更适合学 time evolution operator。
4. 因为它们把“可能的解空间”缩小了，向其中注入了物理结构，从而降低歧义并提升稳定性。
5. differentiable rendering 负责把潜在体数据和图像观测连起来，differentiable physics 则负责用守恒律和 PDE 先验把跨时间的潜在场联系起来。
6. 因为科学求解器通常输入的是边界条件函数或场函数，输出的也是解函数，所以函数到函数的映射才是最自然的目标。
:::
