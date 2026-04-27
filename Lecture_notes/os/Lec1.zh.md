# 第 1 讲：操作系统与进程调度入门

操作系统的核心目标可以理解为：在有限硬件上高效、安全、公平地运行多个程序。

> 你可以把 OS 看成“资源协调器 + 抽象提供者”。

## 1. 为什么需要操作系统

- 抽象硬件细节，向上提供统一接口
- 管理 CPU、内存、I/O 与文件系统
- 在多任务场景下提供隔离与调度

常见指标包括响应时间 $T_{response}$、周转时间 $T_{turnaround}$ 与吞吐量。

---

## 2. 调度中的一个简单模型

轮转调度中，时间片为 $q$，上下文切换开销为 $c$，当 $q$ 过小时会导致切换成本比例升高。

$$
\eta = \frac{q}{q + c}
$$

这里 $\eta$ 可理解为有效执行占比。

:::remark 📝 备注：阅读顺序
先理解“调度目标”，再比较 FCFS、SJF、RR 等算法。
:::

:::hint 💡 提示：考试准备
整理每种调度算法的优缺点和适用场景，比死记公式更有效。
:::

:::warning ⚠️ 注意：不要混淆
高吞吐量不代表低延迟；批处理和交互式任务偏好不同。
:::

:::danger ⛔ 错误示例
把所有进程都当成同等优先级，可能导致交互任务体验很差。
:::

## 3. 一个最小调度器伪代码

```text
while ready_queue not empty:
  p = pick_next(ready_queue)
  run(p, quantum=q)
  if p not finished:
    ready_queue.push_back(p)
```

你可以继续阅读 [Linux CFS 文档](https://www.kernel.org/doc/html/latest/scheduler/sched-design-CFS.html) 了解工程实现细节。
