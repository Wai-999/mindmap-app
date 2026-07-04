import type { MindmapContent, MindmapNode, MindmapEdge } from "@/types/mindmap";
import { NODE_COLORS } from "@/lib/mindmap/defaults";

// Starter maps so "New mindmap" isn't always a blank canvas. Each is plain content
// JSON (the same shape the editor saves), used server-side by the create route to seed
// a new mindmap. Node ids only need to be unique within one map, so static ids are
// fine here. Children are laid out in a simple column to the root's right — a sensible
// starting arrangement the user can re-flow with Tidy Up.
export interface MindmapTemplate {
  id: string;
  name: string;
  description: string;
  build: () => MindmapContent;
}

function makeNode(id: string, label: string, x: number, y: number, color: string): MindmapNode {
  return { id, type: "mindmapNode", position: { x, y }, data: { label, color } };
}

function makeEdge(source: string, target: string): MindmapEdge {
  return { id: `e_${source}_${target}`, type: "mindmapEdge", source, target };
}

function rootWithChildren(rootLabel: string, children: string[]): MindmapContent {
  const nodes: MindmapNode[] = [makeNode("root", rootLabel, 0, 0, NODE_COLORS[0])];
  const edges: MindmapEdge[] = [];
  const count = children.length;
  children.forEach((label, i) => {
    const id = `n${i}`;
    const y = (i - (count - 1) / 2) * 80;
    nodes.push(makeNode(id, label, 280, y, NODE_COLORS[(i + 1) % NODE_COLORS.length]));
    edges.push(makeEdge("root", id));
  });
  return { nodes, edges };
}

export const TEMPLATES: MindmapTemplate[] = [
  {
    id: "project-plan",
    name: "Project plan",
    description: "Goals, milestones, tasks, team, risks",
    build: () => rootWithChildren("Project", ["Goals", "Milestones", "Tasks", "Team", "Risks"]),
  },
  {
    id: "meeting-notes",
    name: "Meeting notes",
    description: "Agenda, discussion, decisions, action items",
    build: () => rootWithChildren("Meeting", ["Agenda", "Discussion", "Decisions", "Action items"]),
  },
  {
    id: "swot",
    name: "SWOT analysis",
    description: "Strengths, weaknesses, opportunities, threats",
    build: () => rootWithChildren("SWOT", ["Strengths", "Weaknesses", "Opportunities", "Threats"]),
  },
  {
    id: "weekly-planner",
    name: "Weekly planner",
    description: "Priorities and the working week",
    build: () =>
      rootWithChildren("This week", [
        "Top priorities",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
      ]),
  },
  {
    id: "brainstorm",
    name: "Brainstorm",
    description: "A central idea with open branches",
    build: () => rootWithChildren("Central idea", ["", "", "", ""]),
  },
];

export function getTemplate(id: string): MindmapTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

// Seeded once for every brand-new registration (see the register route) so a first-time
// user lands on something they can explore instead of a blank canvas. Deliberately not
// listed in TEMPLATES — it's onboarding content, not a pickable template.
export function buildWelcomeContent(): MindmapContent {
  return rootWithChildren("Welcome to your first mind map", [
    "Tab adds a child idea",
    "Enter adds a sibling idea",
    "Insert menu adds images, files, and shapes",
    "Share button invites others to collaborate",
    "Keyboard icon in the toolbar lists every shortcut",
  ]);
}
