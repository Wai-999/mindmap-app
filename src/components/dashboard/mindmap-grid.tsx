"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { MindmapCard } from "@/components/dashboard/mindmap-card";
import { CreateMindmapButton } from "@/components/dashboard/create-mindmap-button";
import { EmptyState } from "@/components/dashboard/empty-state";
import type { MindmapSummary } from "@/types/mindmap";

export function MindmapGrid({ initialMindmaps }: { initialMindmaps: MindmapSummary[] }) {
  const router = useRouter();
  const [mindmaps, setMindmaps] = useState(initialMindmaps);

  // Resync when the server component re-fetches (router.refresh() after duplicate) —
  // useState's initializer only runs once, so without this the grid would never pick
  // up the newly duplicated mindmap.
  useEffect(() => setMindmaps(initialMindmaps), [initialMindmaps]);

  async function handleRename(id: string, title: string) {
    const previous = mindmaps;
    setMindmaps((prev) => prev.map((m) => (m.id === id ? { ...m, title } : m)));

    const res = await fetch(`/api/mindmaps/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });

    if (!res.ok) {
      setMindmaps(previous);
      toast.error("Couldn't rename the mindmap.");
    }
  }

  async function handleDuplicate(id: string) {
    const res = await fetch(`/api/mindmaps/${id}/duplicate`, { method: "POST" });
    if (!res.ok) {
      toast.error("Couldn't duplicate the mindmap.");
      return;
    }
    router.refresh();
  }

  async function handleDelete(id: string) {
    const previous = mindmaps;
    setMindmaps((prev) => prev.filter((m) => m.id !== id));

    const res = await fetch(`/api/mindmaps/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setMindmaps(previous);
      toast.error("Couldn't delete the mindmap.");
    }
  }

  if (mindmaps.length === 0) {
    return <EmptyState />;
  }

  return (
    <div>
      <div className="flex justify-end">
        <CreateMindmapButton />
      </div>
      <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {mindmaps.map((mindmap) => (
          <li key={mindmap.id}>
            <MindmapCard
              mindmap={mindmap}
              onRename={handleRename}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
