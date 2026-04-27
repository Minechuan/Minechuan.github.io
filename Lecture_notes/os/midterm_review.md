# Pintos 期中复习提纲

本提纲面向你当前仓库代码，覆盖 `threads + userprog + filesys(base)`，不包含 `vm` 部分。
目标是把“会背 API 名字”升级为“知道签名、语义、调用链、和 PPT 里的概念如何对应”。

---

## 1. 考试范围速览（按 Lab + PPT 主题）

1. `Project 1 (Threads)`
- Alarm Clock（`timer_sleep`）
- Priority Scheduling / Priority Donation
- MLFQS 基础（若纳入）
- PPT 对应主题：
  - 线程生命周期与状态迁移
  - 上下文切换（context switch）
  - 同步原语（semaphore / lock / condition variable）
  - 优先级与调度策略

2. `Project 2 (User Programs)`
- 参数传递（Argument Passing）
- Syscall 分发与参数/指针校验
- `exec / wait / exit` 父子同步
- 文件描述符表（per-process fd table）
- PPT 对应主题：
  - 用户态/内核态切换
  - Trap/Interrupt/System Call 路径
  - 进程创建、等待、退出语义

3. `filesys/base`（通常与 P2 一起测）
- `create/remove/open/read/write/seek/tell/close`
- `file/inode/directory/free-map` 分层关系
- PPT 对应主题：
  - 文件抽象（fd -> file object -> inode）
  - 目录与命名
  - 磁盘块分配与回收

---

## 2. 高频 API 清单（具体签名 + 语义 + PPT 关联）

## 2.1 线程与调度（`src/threads` + `src/devices/timer.*`）

### 线程核心 API

- `tid_t thread_create(const char *name, int priority, thread_func *function, void *aux)`
  - 作用：创建内核线程并放入就绪队列。
  - 返回：新线程 tid；失败返回 `TID_ERROR`。
  - 常考点：为什么“还没运行”的线程可以直接从 `kernel_thread` 开始执行。
  - PPT 关联：线程创建、就绪队列、第一次调度切入。

- `void thread_block(void)` / `void thread_unblock(struct thread *t)`
  - 作用：阻塞当前线程 / 唤醒指定线程。
  - 语义：`thread_block` 只能阻塞 current；`thread_unblock` 仅改变目标线程状态并入 ready_list。
  - 常考点：与关中断一起使用，保证状态切换原子性。
  - PPT 关联：线程状态迁移图（Running/Ready/Blocked）。

- `void thread_yield(void)` / `void thread_exit(void)`
  - 作用：主动让出 CPU / 线程退出。
  - 常考点：`yield` 与抢占触发的切换区别；`exit` 何时回收资源。
  - PPT 关联：调度切换触发来源。

- `void thread_set_priority(int new_priority)` / `int thread_get_priority(void)`
  - 作用：设置/查询有效优先级。
  - 常考点：Donation 存在时，“原始优先级”与“有效优先级”如何区分。
  - PPT 关联：优先级调度、优先级反转。

- `void thread_set_nice(int nice)` / `int thread_get_nice(void)` / `int thread_get_recent_cpu(void)` / `int thread_get_load_avg(void)`
  - 作用：MLFQS 指标配置与观测。
  - 常考点：不依赖 donation 的调度分支。
  - PPT 关联：多级反馈队列、CPU 使用统计。

### 调度与切换 API

- `void schedule(void)`
  - 作用：执行调度决策，选择下一个线程。
  - PPT 关联：调度器主循环。

- `static struct thread *next_thread_to_run(void)`
  - 作用：从 ready_list 取最高优先级 runnable 线程（你的实现若用了排序/最大值）。
  - 常考点：ready_list 数据结构与时间复杂度。
  - PPT 关联：调度策略落地。

- `struct thread *switch_threads(struct thread *cur, struct thread *next)`（汇编）
  - 作用：保存/恢复寄存器上下文，真正切换内核栈。
  - 常考点：`cur->stack` 本质是该线程 kernel stack 的 `esp` 快照。
  - PPT 关联：Context Switch 的硬件/软件边界。

- `void thread_schedule_tail(struct thread *prev)`
  - 作用：切换收尾，必要时回收 `THREAD_DYING`。
  - PPT 关联：切换后清理阶段。

### 时钟与抢占 API

- `void timer_sleep(int64_t ticks)`
  - 作用：把 current 阻塞到未来 tick，不能 busy waiting。
  - 常考点：`sleep_list` 插入与 `thread_block` 必须在临界区完成。
  - PPT 关联：阻塞式等待 vs 忙等。

- `void timer_interrupt(struct intr_frame *args)` / `void thread_tick(void)` / `void intr_yield_on_return(void)`
  - 作用：周期中断更新 tick、统计时间片、触发抢占。
  - 常考点：为什么在中断上下文里常用 `intr_yield_on_return` 而不是直接 `thread_yield`。
  - PPT 关联：时钟中断驱动的抢占式调度。

### 同步原语 API（签名级）

- 信号量：
  - `void sema_init(struct semaphore *sema, unsigned value)`
  - `void sema_down(struct semaphore *sema)`
  - `bool sema_try_down(struct semaphore *sema)`
  - `void sema_up(struct semaphore *sema)`
- 锁：
  - `void lock_init(struct lock *lock)`
  - `void lock_acquire(struct lock *lock)`
  - `bool lock_try_acquire(struct lock *lock)`
  - `void lock_release(struct lock *lock)`
  - `bool lock_held_by_current_thread(const struct lock *lock)`
- 条件变量：
  - `void cond_init(struct condition *cond)`
  - `void cond_wait(struct condition *cond, struct lock *lock)`
  - `void cond_signal(struct condition *cond, struct lock *lock)`
  - `void cond_broadcast(struct condition *cond, struct lock *lock)`

PPT 关联：临界区、互斥、等待队列、公平性与唤醒策略。

---

## 2.2 用户程序与系统调用（`src/userprog` + `src/lib/user/syscall.h`）

### 用户态 syscall API（考试最爱问“参数/返回值”）

- 进程控制：
  - `void halt(void)`：关机
  - `void exit(int status)`：退出并上报状态
  - `pid_t exec(const char *cmd_line)`：创建子进程并执行
  - `int wait(pid_t pid)`：等待子进程并取退出码

- 文件相关：
  - `bool create(const char *file, unsigned initial_size)`
  - `bool remove(const char *file)`
  - `int open(const char *file)`：成功返回 `fd >= 2`，失败 `-1`
  - `int filesize(int fd)`
  - `int read(int fd, void *buffer, unsigned size)`
  - `int write(int fd, const void *buffer, unsigned size)`
  - `void seek(int fd, unsigned position)`
  - `unsigned tell(int fd)`
  - `void close(int fd)`

PPT 关联：系统调用 ABI、用户库封装、错误返回约定。

### 内核侧 syscall 入口（你的代码命名为准）

- `void syscall_init(void)`：注册 `int 0x30` 中断门。
- `static void syscall_handler(struct intr_frame *f)`：按 syscall number 分发。
- `syscall_arg(f, idx)`：从用户栈提取参数。
- `copy_in/copy_out/copy_in_string`：跨特权级安全访存。

必须会答：
- 为什么用户指针必须校验：非法地址会导致内核崩溃或越权访问。
- 为什么要有 copy_in/out：把“可能 fault 的用户地址访问”控制在可恢复路径。

PPT 关联：Trap Frame、保护边界、内核健壮性。

### 进程生命周期 API

- `tid_t process_execute(const char *file_name)`
- `static void start_process(void *aux)`
- `bool load(const char *cmdline, void (**eip)(void), void **esp)`
- `int process_wait(tid_t child_tid)`
- `void process_exit(void)`
- `void process_activate(void)`

PPT 关联：进程创建、装载器、用户态入口、父子同步。

---

## 2.3 文件系统基础（`src/filesys`）

### 顶层接口

- `void filesys_init(bool format)` / `void filesys_done(void)`
- `bool filesys_create(const char *name, off_t initial_size)`
- `struct file *filesys_open(const char *name)`
- `bool filesys_remove(const char *name)`

### file 对象层

- `struct file *file_open(struct inode *inode)` / `struct file *file_reopen(struct file *file)` / `void file_close(struct file *file)`
- `off_t file_read(struct file *file, void *buffer, off_t size)`
- `off_t file_write(struct file *file, const void *buffer, off_t size)`
- `off_t file_read_at(...)` / `off_t file_write_at(...)`（不移动当前文件偏移）
- `void file_seek(struct file *file, off_t new_pos)` / `off_t file_tell(struct file *file)` / `off_t file_length(struct file *file)`
- `void file_deny_write(struct file *file)` / `void file_allow_write(struct file *file)`

### inode / dir / free-map 层

- inode：`inode_open/reopen/close/remove/read_at/write_at/length`
- directory：`dir_open_root/open/reopen/close/lookup/add/remove/readdir`
- free map：`free_map_allocate` / `free_map_release`

PPT 关联：文件系统分层、命名到数据块映射、空间分配回收。

---

## 3. 重要内核过程（流程链 + PPT 锚点）

## 3.1 线程创建到第一次运行

调用链（简化）：
`thread_create` -> 预构造新线程内核栈帧 -> `thread_unblock` 入 ready_list -> `schedule` -> `switch_threads` -> `switch_entry` -> `kernel_thread` -> `function(aux)`。

PPT 锚点：
- 线程启动并不是“普通 C 调用”，而是“伪造返回现场 + 一次上下文切换”。

---

## 3.2 线程切换（Context Switch）

触发来源：
- 主动：`thread_yield`
- 阻塞：`thread_block`
- 退出：`thread_exit`
- 抢占：时钟中断 + `thread_tick` + `intr_yield_on_return`

切换主链：
`schedule` -> `switch_threads(cur,next)` -> `thread_schedule_tail(prev)`。

PPT 锚点：
- “保存旧线程寄存器 + 切新线程栈 + 恢复寄存器”三步。

---

## 3.3 Alarm Clock 机制

`timer_sleep(ticks)`：
1. 关中断进临界区
2. 计算 `wakeup_tick`
3. 按唤醒时间插入 `sleep_list`
4. `thread_block`
5. 恢复中断

`timer_interrupt`：
1. tick 递增
2. 唤醒到期睡眠线程
3. `thread_tick` 维护时间片和抢占

PPT 锚点：
- “中断驱动唤醒”与“busy waiting”对比。

---

## 3.4 优先级调度与 Donation

`lock_acquire`（被低优先级持有时）关键动作：
- 设置 `wait_on_lock`
- 向 holder 记录 donation
- 沿等待链传播优先级

`lock_release` 关键动作：
- 移除与该锁相关 donation
- 重新计算有效优先级
- 必要时让出 CPU

PPT 锚点：
- Priority Inversion 与 Priority Inheritance。

---

## 3.5 用户进程创建与切换到用户态

主链：
`process_execute` -> `thread_create(... start_process ...)` -> `load` -> 构造 `intr_frame`（`cs/ss/eip/esp`）-> `intr_exit` -> `iret`。

关键结论：
- 真正 `kernel -> user` 的硬件边界是 `iret`。
- 前面的 `schedule/switch_threads` 仍是内核线程级切换。

PPT 锚点：
- 特权级切换与中断返回指令。

---

## 3.6 Syscall 处理路径

主链：
用户态触发 `int 0x30` -> `intr_entry` 保存现场 -> `intr_handler` -> `syscall_handler` -> `sys_xxx` -> 返回值写 `f->eax` -> `intr_exit` -> `iret`。

必答点：
- 参数从用户栈取，必须逐项校验。
- 所有用户缓冲区访问都需要安全拷贝或安全探测。

PPT 锚点：
- Trap frame、系统调用门、返回寄存器约定。

---

## 3.7 `exec / wait / exit` 同步

常见结构（命名因仓库而异）：`child_status` / `wait_status`，通常含：
- `load_sema`：父等子 load 成败
- `exit_sema`：父等子退出
- `waited`：保证 `wait` 只能成功一次
- `ref_cnt`：父子共享状态回收

语义三件套：
- `exec` 失败要让父进程可见（通常返回 `-1`）
- `wait` 对非子进程或重复等待返回 `-1`
- `exit` 必须保存退出码并唤醒等待者

PPT 锚点：
- 父子进程同步与一次性消费语义。

---

## 3.8 FD 表与文件系统访问路径

每进程 `fd table`（或 `fd_list`）维护：
- `fd(int)` -> `struct file *`
- 常见约定：`0=stdin`, `1=stdout`, 常规文件从 `2` 开始

读写链路：
`sys_read/sys_write` -> 查 fd 对象 -> `file_read/file_write` -> `inode_read_at/inode_write_at` -> 块设备。

PPT 锚点：
- 文件抽象分层：进程私有句柄 vs 内核共享 inode。

---

## 4. API 级高频快答模板

1. 为什么 `wait(pid)` 不能重复成功？
- 因为退出状态是“一次性消费”语义；实现上通常由 `waited` 标记保护。

2. `open()` 返回什么才算失败？
- 约定失败返回 `-1`，成功返回进程私有 `fd >= 2`。

3. `read_at/write_at` 与 `read/write` 区别？
- `read/write` 使用并推进当前 file position；`*_at` 以显式 offset 读写，不改变当前 file position。

4. 为什么 `syscall_handler` 不能直接解引用用户指针？
- 用户地址可能非法或跨页无映射；必须先校验/安全拷贝，避免内核 fault。

5. Donation 何时撤销？
- 在 `lock_release`，撤销该锁相关 donation 后重算有效优先级。

---

## 5. 考前最后检查清单（按“API + 流程 + PPT 概念”）

- 能写出 `thread_create`、`thread_block/unblock`、`schedule/switch_threads` 的签名和职责。
- 能解释 `timer_sleep` 的原子化要求（关中断 + 入睡眠队列 + block）。
- 能说明 donation 的触发、传播、回收对应哪个锁路径。
- 能画 `int 0x30 -> syscall_handler -> f->eax -> iret`。
- 能讲清 `exec/wait/exit` 一次性等待语义和父子同步点。
- 能区分 `fd table`、`file`、`inode` 各自归属与职责。

如果时间很紧，优先背：
- 第 2 节（具体 API 签名 + 语义）
- 第 3 节（流程链）
- 第 5 节（检查清单）
