export const COURSE = {
  code: "GFX-SIM",
  titleZh: "图形学与物理仿真课程笔记站",
  titleEn: "Graphics and Physical Simulation Notes",
  semester: "2026 Spring",
  track: "Visual Computing Lab",
  description:
    "面向长期维护的双语课程笔记子站，支持 Markdown 渲染、LaTeX 公式、折叠备注与 GitHub Pages 部署。"
};

export const NOTES = [
  {
    id: "Lec1",
    titleZh: "第1讲 渲染管线与时间积分基础",
    titleEn: "Lec1 Rendering Pipeline and Time Integration Basics",
    summaryZh:
      "建立图形渲染与物理仿真的统一视角，介绍离散时间步、状态更新与视觉反馈之间的关系。",
    updated: "2026-03-10"
  },
  {
    id: "Lec2",
    titleZh: "第2讲 刚体动力学：姿态、惯量与时间积分",
    titleEn: "Lec2 Rigid Body Dynamics: Orientation, Inertia, and Time Integration",
    summaryZh:
      "系统讲解刚体平动与转动耦合、四元数姿态更新、力矩与惯量张量，以及可落地的时间积分流程。",
    updated: "2026-03-12"
  },
  {
    id: "Lec3",
    titleZh: "第3讲 刚体碰撞、接触与 Shape Matching",
    titleEn: "Lec3 Rigid Body Collision, Contact, and Shape Matching",
    summaryZh:
      "覆盖 SDF 检测、Penalty/Impulse 碰撞响应、刚体摩擦冲量、多接触耦合，以及位置方法中的 Shape Matching。",
    updated: "2026-03-19"
  }
];
