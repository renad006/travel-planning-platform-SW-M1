"use client";

import { Button } from "@/components/ui/button";
import { redButton } from "@/features/hotels/styles";

export default function Error({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div role="alert" className="mx-auto flex w-full max-w-5xl flex-col items-start gap-3 p-6">
      <p className="text-destructive">We could not load hotels. Check your connection and try again.</p>
      <Button className={redButton} onClick={() => retry()}>Try again</Button>
    </div>
  );
}
