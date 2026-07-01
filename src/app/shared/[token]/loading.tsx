import { Loader2 } from "lucide-react";

export default function SharedLoading() {
  return (
    <div className="flex h-svh items-center justify-center">
      <Loader2 className="text-muted-foreground size-6 animate-spin" />
    </div>
  );
}
