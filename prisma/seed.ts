import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@example.com";
const DEMO_PASSWORD = "password123";

async function main() {
  const passwordHash = await hash(DEMO_PASSWORD, 12);

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: {
      name: "Demo User",
      email: DEMO_EMAIL,
      password: passwordHash,
    },
  });

  const demoContent = JSON.stringify({
    nodes: [
      {
        id: "root",
        type: "mindmapNode",
        position: { x: 0, y: 0 },
        data: { label: "Welcome to Mindmap", color: "#6366f1" },
      },
    ],
    edges: [],
  });

  await prisma.mindmap.upsert({
    where: { id: "demo-mindmap-seed" },
    update: { content: demoContent, thumbnail: null },
    create: {
      id: "demo-mindmap-seed",
      title: "Welcome to Mindmap",
      ownerId: user.id,
      content: demoContent,
    },
  });

  console.log(`Seeded demo user: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
