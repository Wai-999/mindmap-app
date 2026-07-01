"use client";

import { useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TagSummary } from "@/types/mindmap";

const ALL_TAGS_VALUE = "__all__";

export function TagFilter({ tags, activeTagId }: { tags: TagSummary[]; activeTagId: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (tags.length === 0) return null;

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL_TAGS_VALUE) params.delete("tag");
    else params.set("tag", value);
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <Select value={activeTagId ?? ALL_TAGS_VALUE} onValueChange={handleChange}>
      <SelectTrigger className="w-40">
        <SelectValue placeholder="All tags" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_TAGS_VALUE}>All tags</SelectItem>
        {tags.map((tag) => (
          <SelectItem key={tag.id} value={tag.id}>
            {tag.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
