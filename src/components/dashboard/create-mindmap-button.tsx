"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CreateMindmapButton() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  async function handleCreate() {
    setIsCreating(true);
    try {
      const res = await fetch("/api/mindmaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to create mindmap");
      const { id } = (await res.json()) as { id: string };
      router.push(`/mindmap/${id}`);
    } catch {
      setIsCreating(false);
    }
  }

  return (
    <Button onClick={handleCreate} disabled={isCreating}>
      {isCreating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
      New mindmap
    </Button>
  );
}
