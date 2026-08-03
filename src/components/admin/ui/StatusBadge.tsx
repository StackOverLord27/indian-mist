import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function StatusBadge({ active }: { active: boolean }) {
  if (active) {
    return (
      <span className="inline-flex items-center gap-1 bg-olive/15 text-olive border border-olive/25 font-montserrat text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm">
        <CheckCircle2 className="size-2.5" /> Active
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 bg-muted/10 text-forest/60 border border-muted/20 font-montserrat text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm">
      <XCircle className="size-2.5" /> Inactive
    </span>
  );
}
