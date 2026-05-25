import * as React from "react";

import { cn } from "@/lib/utils";

function Progress({
  value = 0,
  className,
  indicatorClassName,
}: {
  value?: number;
  className?: string;
  indicatorClassName?: string;
}) {
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full border border-border/60 bg-muted", className)}>
      <div
        className={cn("stock-fan-fill h-full rounded-full transition-all duration-500", indicatorClassName)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export { Progress };
