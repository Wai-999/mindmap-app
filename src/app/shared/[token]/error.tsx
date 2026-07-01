"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function SharedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-svh flex-col items-center justify-center gap-4 text-center">
      <AlertTriangle className="text-muted-foreground size-10" />
      <div>
        <p className="font-medium">Something went wrong loading this link</p>
        <p className="text-muted-foreground text-sm">Try again, or ask the owner for a new link.</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={reset}>
          Try again
        </Button>
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}
