export const COURSE = {
  code: "GFX-SIM",
  titleZh: "图形学与物理仿真课程笔记站",
  titleEn: "Graphics and Physical Simulation Notes",
  semester: "2026 Spring",
  track: "Visual Computing Lab",
  description:
    "面向长期维护的双语课程笔记站，支持 Markdown 渲染、LaTeX 公式、折叠备注与 GitHub Pages 部署。"
};

export const NOTES = [
  {
    id: "Lec1",
    titleZh: "第1讲 渲染管线与时间积分基础",
    titleEn: "Lec1 Rendering Pipeline and Time Integration Basics",
    summaryZh:
      "建立图形渲染与物理仿真的统一视角，介绍离散时间步、状态更新与视觉反馈之间的基本关系。",
    updated: "2026-03-10"
  },
  {
    id: "Lec2",
    titleZh: "第2讲 刚体动力学：姿态、惯量与时间积分",
    titleEn: "Lec2 Rigid Body Dynamics: Orientation, Inertia, and Time Integration",
    summaryZh:
      "系统整理刚体平动与转动、四元数姿态更新、力矩与惯量张量，以及可落地的时间积分流程。",
    updated: "2026-03-12"
  },
  {
    id: "Lec3",
    titleZh: "第3讲 刚体碰撞与 Shape Matching",
    titleEn: "Lec3 Rigid Body Collision and Shape Matching",
    summaryZh:
      "覆盖刚体碰撞检测、碰撞响应与 Shape Matching 的基本思想，建立从接触到形状保持的整体图景。",
    updated: "2026-03-19"
  },
  {
    id: "Lec4",
    titleZh: "第4讲 约束动力学：拉格朗日乘子、接触与互补问题",
    titleEn: "Lec4 Constrained Dynamics: Lagrange Multipliers, Contact, and Complementarity",
    summaryZh:
      "系统梳理约束动力学建模、接触处理、互补条件与稳定化方法，帮助理解刚体接触求解框架。",
    updated: "2026-03-26"
  },
  {
    id: "Lec5",
    titleZh: "第5讲 流体仿真：欧拉管线、自由表面追踪与数值扩散控制",
    titleEn: "Lec5 Fluid Simulation: Eulerian Pipeline, Free Surface Tracking, and Numerical Diffusion Control",
    summaryZh:
      "覆盖 Navier-Stokes 与不可压投影、MAC 网格、自由液面表示以及降低数值扩散的核心思路。",
    updated: "2026-04-02"
  },
  {
    id: "Lec6",
    titleZh: "第6讲 FLIP：粒子-网格混合流体、漂移补偿与抗扩散增强",
    titleEn: "Lec6 FLIP: Particle-Grid Hybrid Fluids, Drift Compensation, and Diffusion-Reduction Enhancements",
    summaryZh:
      "系统整理 PIC/FLIP、不可压投影、密度漂移补偿，以及 MacCormack、Vorticity Confinement 等抗扩散策略。",
    updated: "2026-04-09"
  },
  {
    id: "Lec7",
    titleZh: "第7讲 SPH 与 APIC：粒子流体、仿射传输与连续体守恒",
    titleEn: "Lec7 SPH and APIC: Particle-Based Fluids, Affine Transfers, and Continuum Conservation",
    summaryZh:
      "覆盖 SPH 核函数插值与守恒离散、PIC/RPIC/APIC 传输公式，以及粒子与网格混合框架的关键思想。",
    updated: "2026-04-16"
  },
  {
    id: "Lec8",
    titleZh: "第8讲 FEM 与超弹性材料模型",
    titleEn: "Lec8 FEM and Hyperelastic Material Models",
    summaryZh:
      "从守恒律与应力出发构建 FEM 变形管线，并整理超弹性、各向同性材料与应力转换的核心公式。",
    updated: "2026-04-30"
  },
  {
    id: "Lec9",
    titleZh: "第9讲 弹簧-质点系统：显式/隐式欧拉与能量最小化",
    titleEn: "Lec9 Spring-Mass System: Explicit/Implicit Euler and Energy Minimization",
    summaryZh:
      "系统讲解弹簧-质点离散、显式与隐式欧拉、能量最小化改写，以及 Newton/Hessian 求解流程。",
    updated: "2026-05-08"
  },
  {
    id: "Lec10",
    titleZh: "第10讲 布料仿真：弯曲模型、锁死问题、PBD 与应变限制",
    titleEn: "Lec10 Cloth Simulation: Bending Models, Locking, PBD, and Strain Limiting",
    summaryZh:
      "梳理布料拉伸、剪切、弯曲建模与 locking 问题，并总结 PBD 与应变限制的实用修正策略。",
    updated: "2026-05-08"
  },
  {
    id: "Lec11",
    titleZh: "第11讲 Projective Dynamics 与 MPM",
    titleEn: "Lec11 Projective Dynamics and MPM",
    summaryZh:
      "围绕 Projective Dynamics 的 local-global 优化与 MPM/MLS-MPM 管线，整理 APIC、形变梯度与本构应力耦合。",
    updated: "2026-05-08"
  },
  {
    id: "Lec12",
    titleZh: "第12讲 碰撞、塑性与断裂",
    titleEn: "Lec12 Collision, Plasticity, and Fracture",
    summaryZh:
      "系统整理 broad phase、DCD/CCD、IPC 与 impact zone 等碰撞处理方法，并延伸到塑性与断裂建模。",
    updated: "2026-06-17"
  },
  {
    id: "Lec13",
    titleZh: "第13讲 AI for Physics 与 Physics for AI",
    titleEn: "Lec13 AI for Physics and Physics for AI",
    summaryZh:
      "围绕 AI 与物理仿真的双向结合展开，系统整理物理表示、前向加速、ill-posed 正则化、inverse problem、physics discovery，以及 diffusion、operator learning 和 physics-inspired optimization。",
    updated: "2026-06-17"
  }
];