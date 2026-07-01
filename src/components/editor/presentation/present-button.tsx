"use client";

import { useState } from "react";
import { Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PresentationOverlay } from "@/components/editor/presentation/presentation-overlay";

interface PresentButtonProps {
  endpoint: string;
}

// Shared by EditorHeader (owner) and SharedViewBanner (share-link visitor, any
// permission) — presentation is a viewing feature, so it's available even read-only.
export function PresentButton({ endpoint }: PresentButtonProps) {
  const [isPresenting, setIsPresenting] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-9"
        onClick={() => setIsPresenting(true)}
        aria-label="Present"
        title="Present"
      >
        <Play className="size-4" />
      </Button>
      {isPresenting && (
        <PresentationOverlay endpoint={endpoint} onClose={() => setIsPresenting(false)} />
      )}
    </>
  );
}
