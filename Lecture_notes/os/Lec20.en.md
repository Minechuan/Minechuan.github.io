# Lecture 20: File System 2 - Case Studies and Buffering-Oriented Design

## Learning Objectives

By the end of this lecture, you should be able to:

1. Explain how FAT, inode-based UNIX/FFS, and NTFS represent files and directories.
2. Compute key indexing capacities and access-depth implications in multilevel inode schemes.
3. Analyze why locality, free-space policy, and buffering directly shape file-system performance.
4. Distinguish hard links vs symbolic links and trace pathname resolution to final inode/data.
5. Compare design tradeoffs across FAT, FFS, and NTFS in real workloads.

## 1. Bridge from I/O Recap to File-System Structure

This lecture starts from three reminders and then moves into concrete file-system designs.

- Queueing fundamentals: utilization drives latency nonlinearly.
- Disk scheduling: ordering policy changes both throughput and fairness.
- Translation boundary: user byte ranges are transformed into block-level I/O.

![Queueing parameters and definitions](lec20_materials/queueing_parameters_and_definitions.png)
![Queueing results M/M/1 and M/G/1](lec20_materials/queueing_results_mm1_mg1.png)

Core formulas used again in this lecture context:

$$
\mu = \frac{1}{T_{ser}}, \qquad
\lambda = \frac{1}{T_A}, \qquad
u = \frac{\lambda}{\mu} = \lambda T_{ser}
$$

$$
L_q = \lambda T_q
$$

$$
\text{M/M/1: } T_q = T_{ser}\cdot\frac{u}{1-u}
$$

$$
\text{M/G/1 (slide form): } T_q = T_{ser}\cdot\frac{1}{2}(1+C)\cdot\frac{u}{1-u}
$$

![Disk scheduling FIFO and SSTF](lec20_materials/disk_scheduling_fifo_sstf.png)
![Disk scheduling SCAN](lec20_materials/disk_scheduling_scan.png)
![Disk scheduling C-SCAN](lec20_materials/disk_scheduling_cscan.png)

![Translation from user bytes to blocks](lec20_materials/translation_user_bytes_to_blocks.png)

:::remark Key Question: Why is block translation still central even with high-level file APIs?
**Question (original intent): What happens when user asks for a byte range rather than a full block?**

Answer:
- The file system must map that byte range to block(s).
- Reads return the requested byte slice after block fetch.
- Writes usually require read-modify-write at block granularity.
- So buffering and block placement remain core performance determinants.
:::

## 2. Case Study A: FAT (File Allocation Table)

FAT represents a file as a linked chain of blocks, indexed from a file number.

![FAT file mapping overview](lec20_materials/fat_file_mapping_overview.png)

Design idea:

- File data lives in ordinary disk blocks.
- FAT entries encode next-block links.
- A file number points to the root of its block chain.
- Free blocks are marked in FAT, discovered by scan or free-list-like policies.

![FAT storage and formatting](lec20_materials/fat_storage_and_formatting.png)

Formatting implications from the slides:

- FAT is stored on disk.
- Full format: clear blocks + mark FAT entries free.
- Quick format: mainly reset FAT/free metadata, not full data erase.

![FAT directories](lec20_materials/fat_directory_structure.png)

**Key definition:** **A directory is a file containing `<file_name: file_number>` mappings.**

In FAT specifically:

- Directory entries store naming plus many file attributes.
- Directory lookup is often linear in directory size.
- Root directory location is fixed by on-disk convention.

:::warn Key Question: What is the core performance weakness of FAT at scale?
**Question (original intent): Starting only from file number, what issues appear for lookup/layout/access?**

Answer:
- Following long linked chains can increase random-access cost.
- Physical layout can become fragmented.
- Large directories and large files amplify traversal overhead.
:::

## 3. Case Study B: UNIX Inodes and Multilevel Indexing

UNIX-style systems decouple naming from block mapping through inodes.

![Inode multilevel index structure](lec20_materials/inode_multilevel_index_structure.png)

**Key definition:** **File Number (inumber) is index into an array of inodes (index structure).**

Inode highlights:

- Each inode stores metadata (owner/group, permission bits, size, timestamps).
- Directory entries map names to inode numbers.
- Multiple names can point to the same inode (hard links).
- Block pointers are asymmetric: direct + indirect + double indirect + triple indirect.

![Inode direct pointers for small files](lec20_materials/inode_direct_pointers_small_files.png)
![Inode indirect pointers for large files](lec20_materials/inode_indirect_pointers_large_files.png)

Capacity math (4KB block, 4-byte pointer):

$$
N_{ptr} = \frac{4096}{4} = 1024
$$

$$
\text{Direct capacity} = 12\times4\text{KB} = 48\text{KB}
$$

$$
\text{Single-indirect capacity} = 1024\times4\text{KB} = 4\text{MB}
$$

$$
\text{Double-indirect capacity} = 1024^2\times4\text{KB} = 4\text{GB}
$$

$$
\text{Triple-indirect capacity} = 1024^3\times4\text{KB} = 4\text{TB}
$$

![Multilevel index access-cost example](lec20_materials/multilevel_index_access_cost_example.png)

Access-depth examples from the lecture setup:

- Block #5: one data access.
- Block #23: indirect block + data block.
- Block #340: double indirect + indirect + data.

:::tip Key Question: Why does this asymmetric tree work for both small and large files?
**Question (original intent): Why not use only one fixed indexing depth for every file?**

Answer:
- Most files are small, so direct pointers keep common-path latency low.
- Large files still scale via indirect levels.
- This avoids paying deep-index overhead on every tiny file.
:::

## 4. Case Study C: Berkeley FFS Locality and Free-Space Strategy

FFS keeps inode indexing ideas but redesigns layout policy for performance and reliability.

![FFS design goals and changes](lec20_materials/ffs_design_goals_and_changes.png)
![FFS inode placement motivation](lec20_materials/ffs_inode_placement_motivation.png)

Problem statements emphasized in class:

- If all inodes are centralized, header/data seeks grow.
- File size is unknown at creation time, making contiguous pre-allocation hard.
- Rotational timing can cause missed-next-block inefficiency.

![FFS block groups locality](lec20_materials/ffs_block_groups_locality.png)
![FFS block groups allocation policy](lec20_materials/ffs_block_groups_allocation_policy.png)

FFS solution direction:

- Partition disk into block groups.
- Co-locate metadata, file data, and free-space info within groups.
- Prefer local, near-sequential allocations.
- Keep reserve free space to preserve allocation flexibility.

![FFS first-fit block allocation](lec20_materials/ffs_first_fit_block_allocation.png)
![Rotational delay, skip-sector, and read-ahead](lec20_materials/rotational_delay_skip_sector_and_readahead.png)
![FFS pros and cons](lec20_materials/ffs_pros_and_cons.png)

:::remark Key Question: Why does FFS insist on keeping free space (often 10%+)?
**Question (original intent): Why reserve free space instead of filling disk aggressively?**

Answer:
- High occupancy shrinks contiguous choices, causing fragmentation.
- Fragmentation increases seeks and weakens sequential throughput.
- Reserved space preserves locality-aware placement options.
:::

## 5. Hard Links, Soft Links, and Pathname Traversal

![Hard links and reference counting](lec20_materials/hard_links_reference_counting.png)

Hard-link behavior:

- `link()` adds a directory entry to the same inode.
- `unlink()` removes one name-to-inode reference.
- File contents can be reclaimed when link count drops to zero (plus open-handle rules in runtime).

![Soft links (symbolic links)](lec20_materials/soft_links_symbolic_links.png)

Symbolic-link behavior:

- Directory entry stores destination pathname.
- Each access resolves that pathname again.
- Lookup may fail if destination path becomes invalid.

![Directory traversal inode lookup flow](lec20_materials/directory_traversal_inode_lookup_flow.png)

Path traversal example (`/home/pkuos/stuff.txt`) in inode terms:

1. Start from configured root inode.
2. Read directory data, find next name component, obtain next inode number.
3. Repeat per path component.
4. Open final inode, bind file descriptor to its block mapping.

:::error Key Question: Why can permission checks happen multiple times in one open?
**Question (original intent): Why check not only final file but also directories in the path?**

Answer:
- Traversal itself is an access operation on each directory.
- Missing execute/search permission on an intermediate directory blocks resolution.
- So security is enforced along the whole namespace path, not only at the leaf.
:::

## 6. Large Directory Optimization: B-Tree / dirhash

Linear directory scans become expensive as entry counts grow.

![Large directories B-tree intro](lec20_materials/large_directories_btree_intro.png)
![Large directories dirhash lookup](lec20_materials/large_directories_dirhash_lookup.png)

Key idea:

- Build a searchable index (B-tree/B+tree-style hashing/indexing) over names.
- Convert near-linear lookup behavior toward logarithmic index traversal + leaf resolution.
- Reduce disk accesses for large directory workloads.

## 7. Case Study D: NTFS (MFT + Extents)

NTFS uses a metadata-centric table design.

![NTFS MFT and extents overview](lec20_materials/ntfs_mft_and_extents_overview.png)

**Key definition:** **Everything (almost) is a sequence of `<attribute:value>` pairs.**

MFT-centered model:

- Each file has an MFT record (bounded record size).
- Small-file data may be resident in the MFT record.
- Larger data uses non-resident extents.
- Very large/fragmented files can chain metadata across multiple MFT records.

![NTFS small file resident data](lec20_materials/ntfs_small_file_resident_data.png)
![NTFS medium file extents](lec20_materials/ntfs_medium_file_extents.png)
![NTFS large file additional MFT records](lec20_materials/ntfs_large_file_additional_mft_records.png)
![NTFS huge fragmented file many records](lec20_materials/ntfs_huge_fragmented_file_many_records.png)

Extent arithmetic shown in diagrams:

$$
\text{Extent end} = \text{Start} + \text{Length}
$$

![NTFS directories and name attributes](lec20_materials/ntfs_directories_and_name_attributes.png)

NTFS directory notes:

- Directories are indexed (B-tree style).
- File number identifies MFT entry.
- Hard links can be represented by multiple file-name attributes in one MFT entry.

## 8. Unified Comparison and Design Tradeoffs

![File system summary 1](lec20_materials/file_system_summary_1.png)
![File system summary 2](lec20_materials/file_system_summary_2.png)

Cross-system comparison:

- FAT: simple linked allocation and directory model, but weak scalability under fragmentation and large-directory workloads.
- Inode/FFS: strong generality with multilevel indexing and locality-aware placement, but requires careful free-space policy.
- NTFS: attribute-centric records with extents and indexed directories, flexible for heterogeneous file sizes and metadata richness.

Unifying performance principle:

- File-system performance is not just about raw media speed.
- It is the interaction among naming, indexing depth, free-space policy, and buffering/read-ahead behavior.

## 9. Exam Review

### 9.1 Must-Know Definitions

- **File number / inumber**: index to file metadata record (inode or analogous structure).
- **Hard link**: additional name to same inode/object.
- **Symbolic link**: name whose data is another path.
- **Extent**: contiguous run represented by `(start, length)`.
- **Block group (FFS)**: locality unit integrating data, metadata, and free-space management.

### 9.2 Mechanism Checkpoints

- Derive `u`, `T_q`, and `L_q` from arrival/service assumptions.
- Compute inode addressing capacities across direct/indirect levels.
- Explain why block-group placement reduces seek overhead.
- Trace pathname resolution step-by-step to the final inode.
- Explain resident vs non-resident data in NTFS MFT records.

### 9.3 Short-Answer Templates

- "Why reserve free space in FFS?": to preserve contiguous allocation options and reduce fragmentation-driven seek cost.
- "When can a file be deleted under hard links?": when reference/link count semantics allow reclamation after names are removed.
- "Why are symbolic links fragile?": they depend on destination pathname re-resolution each access.
- "Why do large directories need indexing?": linear scan disk cost grows too quickly with entry count.

### 9.4 Common Pitfalls

- Assuming metadata placement is independent of data-path performance.
- Mixing up hard-link semantics (same inode) with symlink semantics (stored path).
- Ignoring intermediate-directory permission checks during path traversal.
- Treating full disk utilization as always desirable for throughput.

### 9.5 Self-Check

1. Can you explain FAT, inode/FFS, and NTFS in one coherent comparison story?
2. Can you derive 48KB / 4MB / 4GB / 4TB inode scaling numbers from first principles?
3. Can you justify SCAN/C-SCAN and FFS layout choices using queueing + locality arguments?
4. Can you trace a pathname open operation and pinpoint each metadata read?
5. Can you explain how NTFS handles tiny, medium, and huge fragmented files differently?
