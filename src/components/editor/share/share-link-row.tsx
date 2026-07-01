"use client";

import { useState } from "react";
import { Check, Copy, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ShareLinkSummary } from "@/types/share";

interface ShareLinkRowProps {
  link: ShareLinkSummary;
  onRevoke: (linkId: string) => void;
}

export function ShareLinkRow({ link, onRevoke }: ShareLinkRowProps) {
  const [copied, setCopied] = useState(false);
  const path = `/shared/${link.token}`;

  async function handleCopy() {
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-center gap-2 rounded-md border p-2" data-testid="share-link-row">
      <Badge variant={link.permission === "EDIT" ? "default" : "secondary"} className="shrink-0">
        {link.permission === "EDIT" ? "Can edit" : "View only"}
      </Badge>
      <span
        className="text-muted-foreground flex-1 truncate text-xs"
        data-testid="share-link-path"
      >
        {path}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        onClick={handleCopy}
        aria-label="Copy link"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="hover:text-destructive size-8 shrink-0"
        onClick={() => onRevoke(link.id)}
        aria-label="Revoke link"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
