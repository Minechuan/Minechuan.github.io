# Lecture 4: Abstraction 3 - IPC, Pipes, and Sockets (Programmer's View)

## Learning Objectives

By the end of this lecture, you should be able to:

1. Explain **Interprocess Communication (IPC)** and why process isolation makes it non-trivial.
2. Compare file-based communication, in-memory queues, and POSIX pipes.
3. Reason about pipe blocking, EOF behavior, and `SIGPIPE` conditions.
4. Define a protocol in terms of syntax, semantics, and state-machine behavior.
5. Explain the socket abstraction as network-capable file-descriptor I/O.
6. Describe naming in TCP/IP communication: hostnames, IP addresses, and port numbers.
7. Walk through client/server connection setup using `socket/bind/listen/accept/connect`.
8. Compare serial, process-per-connection, thread-per-connection, and thread-pool servers.

## 1. From File I/O to IPC

The lecture starts from a Unix design continuity:

- We already know how to do `open/read/write/close` on files.
- We want communication between protected processes to look similarly simple.
- The core abstraction goal remains the same: byte streams with clear system-call boundaries.

This is why IPC in Unix is not a disconnected topic. It is a direct extension of the file I/O worldview.

## 2. Why IPC Is Needed but Hard

Processes are isolated on purpose:

- Isolation protects security and fault containment.
- Isolation also blocks direct memory sharing by default.

So if two processes want to cooperate, they must use an agreed mechanism that the kernel mediates.

:::remark Key Question: If isolation is good, why allow IPC at all?
**Question (original intent): Why would the OS intentionally open communication channels between protected processes?**

Answer:
- Real systems are built from cooperating components (shell pipelines, servers, workers, databases).
- Security requires controlled communication, not zero communication.
- IPC is the "narrow, explicit hole" through isolation, with kernel-enforced rules.
:::

## 3. Communication Options: File, Queue, Pipe

A naive way to communicate is writing to a persistent file, then letting another process read it.

- It works, but it is often wasteful for transient exchanges.
- Disk persistence is unnecessary when data is short-lived.

A better model is an in-memory kernel queue exposed by syscalls.

![In-memory queue mediated by kernel](lec04_materials/ipc_in_memory_queue.png)

POSIX/Unix pipe is a concrete instance:

- one bounded queue,
- writer pushes bytes,
- reader consumes bytes,
- both sides interact via file descriptors.

![Pipe blocking model](lec04_materials/unix_pipe_blocking.png)

## 4. Pipe Semantics You Must Get Right

For a pipe with finite buffer:

- If writer writes when buffer is full, writer blocks.
- If reader reads when buffer is empty, reader blocks.

Typical setup API:

$$
\operatorname{pipe}(\text{fds}) \Rightarrow \text{fds}[0]=\text{read end},\;\text{fds}[1]=\text{write end}
$$

After `fork`, both parent and child inherit descriptors, so directionality must be enforced by closing unused ends.

:::tip Key Question: Why must each process close the unused pipe end?
**Question (original intent): If parent and child both inherit both fds, what breaks if we keep them all open?**

Answer:
- EOF detection depends on "last writer closed" and "last reader closed" conditions.
- Forgetting closes can cause blocking forever and confusing non-EOF behavior.
- Correct close discipline encodes the intended channel direction.
:::

EOF and broken-pipe rules:

- When the last write end closes, reads eventually return EOF (`0`).
- When the last read end closes, writes raise `SIGPIPE` (or return `EPIPE` if handled/ignored).

:::warn Key Question: Why does writing to a closed-read pipe raise `SIGPIPE`?
**Question (original intent): Why not silently drop bytes when no reader exists?**

Answer:
- A pipe with no readers is usually a logic error.
- Immediate signal/error propagation prevents silent data loss.
- This fail-fast behavior is important for robust pipeline programs.
:::

## 5. Protocol: More Than Just Bytes

Once a channel exists, we still need a protocol.

A protocol includes:

- **Syntax**: message format and ordering.
- **Semantics**: what each message means and what action follows.
- **State behavior**: often modeled as a state machine or transaction diagram.

Human conversation (phone call) and web requests are both protocol examples.

:::remark Key Question: Why is "just send bytes" not enough?
**Question (original intent): If sockets already transport bytes, why do applications still need protocol design?**

Answer:
- Receivers must know where one logical message ends and the next begins.
- Different peers must interpret payloads identically.
- Timeouts, retries, and error handling are protocol-level decisions, not transport defaults.
:::

## 6. Client-Server as Cross-Network IPC

In client-server systems:

- Clients are often intermittent ("sometimes on").
- Servers are expected to be continuously available ("always on").
- Many clients may access one shared service endpoint.

A client sends requests; server returns replies. This is IPC across machines.

## 7. Socket Abstraction: Endpoint That Looks Like File I/O

A socket is one endpoint of a network connection.

- It is represented by a file descriptor.
- `write` appends outgoing bytes toward the peer.
- `read` consumes incoming bytes from the peer.
- Some file operations (like `lseek`) do not apply.

A TCP connection is best modeled as two bounded queues (one each direction), giving a bidirectional byte stream.

![Socket interaction in client-server flow](lec04_materials/socket_client_server_concept.png)

## 8. Naming the Remote Endpoint: Host + IP + Port

To let independent programs "find each other," TCP/IP uses names:

- Hostname (e.g., `www.pku.edu.cn`)
- IP address (IPv4/IPv6)
- Port number (service endpoint on host)

Port classes:

$$
0 \le p \le 1023 \quad (\text{well-known/system})
$$
$$
1024 \le p \le 49151 \quad (\text{registered})
$$
$$
49152 \le p \le 65535 \quad (\text{dynamic/private})
$$

Range identity used in the slides:

$$
49152 = 2^{15} + 2^{14}, \qquad 65535 = 2^{16} - 1
$$

## 9. TCP Connection Setup and Connection Identity

Key setup flow:

- Server: `socket -> bind -> listen -> accept`
- Client: `socket -> connect`

`accept` creates a new **connection socket** per client; the listening socket remains for future clients.

![TCP connection setup overview](lec04_materials/tcp_connection_setup.png)

A TCP connection is uniquely identified by a 5-tuple:

$$
(\text{srcIP},\text{dstIP},\text{srcPort},\text{dstPort},\text{protocol})
$$

Usually:

- client source port is ephemeral and OS-assigned,
- server destination port is well-known.

:::remark Key Question: Why can a server handle many clients on one listening port?
**Question (original intent): If all clients connect to the same server port, how are connections distinguished?**

Answer:
- `accept` creates separate connected sockets.
- The kernel tracks each flow by the 5-tuple.
- Therefore multiple simultaneous connections coexist on one listening endpoint.
:::

## 10. Echo Example and Hidden Assumptions

Echo protocol pattern:

- client reads input,
- client sends request,
- server reads request and writes same bytes back,
- client reads response and prints.

![Echo protocol sequence](lec04_materials/echo_server_sequence.png)

A slide-highlighted send-size convention is:

$$
\text{bytes sent} = \operatorname{strlen}(\text{sndbuf}) + 1
$$

Assumptions behind this example:

- reliable delivery (for TCP),
- in-order byte-stream behavior,
- blocking read semantics when data is not yet available.

## 11. Server Evolution: v1 to v4

### v1: Serial server (single service loop)

- `accept`
- `serve_client`
- close
- then next client

Limitation: one slow client delays others.

### v2: Process-per-connection with protection

- `accept`
- `fork`
- child handles one connection
- parent waits

Benefit: process isolation.
Limitation: if parent waits immediately, concurrency is not realized.

### v3: Concurrent process-per-connection

- remove blocking `wait(NULL)` in hot path
- parent keeps accepting new clients

Benefit: overlap across clients.
Cost: process creation and context-switch overhead.

### v4: Thread-per-connection

- spawn a new thread per accepted socket
- lower creation/switch cost than process-per-connection

Tradeoff: weaker isolation than separate processes.

### Thread pool improvement

Unbounded thread creation can collapse throughput under burst load.

Use bounded worker threads + shared queue:

- master thread accepts and enqueues connections,
- workers dequeue and service,
- bounded pool controls multiprogramming level.

![Thread-pool server model](lec04_materials/thread_pool_model.png)

:::tip Key Question: Why does thread pool usually outperform unbounded thread creation at high load?
**Question (original intent): If threads are lightweight, why not spawn one per connection forever?**

Answer:
- Unbounded threads amplify scheduling and memory pressure.
- Queueing + bounded workers stabilize latency and throughput.
- Pools impose backpressure instead of letting overload explode the runtime.
:::

## 12. Practical Checklist for Building Network Services

When implementing client-server code with sockets, always verify:

1. Descriptor lifecycle: close the right fds in the right process/thread.
2. Blocking model: know where reads/writes may block.
3. Message framing: define boundaries over byte streams.
4. Failure policy: handle EOF, `EPIPE`, timeouts, and partial I/O.
5. Concurrency policy: serial vs process/thread model vs bounded pool.
6. Naming policy: host/IP/port choices and privilege constraints.

## 13. Takeaways

- **IPC** is controlled communication across protected process boundaries.
- Pipes give one-queue one-way communication, usually within one host and inherited descriptor paths.
- Sockets give two-queue bidirectional communication and scale naturally to networked client-server systems.
- TCP connection setup depends on `socket/bind/listen/accept/connect` and 5-tuple flow identity.
- Real servers evolve from serial handling to bounded-concurrency architectures (thread pools).

## 14. Exam Review

### 14.1 Must-Know Definitions

- **Interprocess Communication (IPC):** Kernel-mediated communication between isolated processes.
- **Pipe:** A one-way bounded kernel buffer exposed as two file descriptors.
- **Socket:** One endpoint of a network communication channel represented by an fd.
- **Server socket (listening socket):** Endpoint that accepts new connections, not for direct application data exchange.
- **Connection socket:** Per-client accepted socket used for request/response I/O.
- **5-tuple:** `(srcIP, dstIP, srcPort, dstPort, protocol)` identity of a TCP flow.

### 14.2 High-Value Short-Answer Templates

1. **Why not use regular files for transient IPC?**
   Files are persistent and disk-oriented; transient communication is cheaper and cleaner with in-memory queues/pipes/sockets.
2. **How does a pipe signal completion?**
   Reader gets EOF only after all write ends close; writer gets `SIGPIPE/EPIPE` when all read ends close.
3. **Why does `accept` return a new socket?**
   It preserves one listening endpoint while creating independent per-client channels.
4. **Why move from process-per-connection to thread pools?**
   To keep concurrency while avoiding unbounded creation and scheduling overhead.

### 14.3 Common Pitfalls

- Forgetting to close inherited pipe/socket descriptors after `fork`.
- Assuming byte stream transport gives message boundaries automatically.
- Treating listening socket and connected socket as the same role.
- Creating unbounded threads under heavy arrival rates.
- Ignoring partial reads/writes and signal/error paths (`SIGPIPE`, `EPIPE`, EOF).

### 14.4 Self-Check

:::tip Self-check 1
A parent and child share a pipe. Parent thinks it closed writing, but child's read never reaches EOF. Explain the most likely descriptor-lifecycle bug.
:::

:::tip Self-check 2
A server accepts on port 80 and serves 10k clients. Explain how flows are disambiguated if destination port is the same.
:::

:::tip Self-check 3
Design one scenario where process-per-connection is preferable to thread-per-connection, and one where thread pool is preferable.
:::
