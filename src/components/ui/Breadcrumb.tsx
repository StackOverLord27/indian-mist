import Link from "next/link";
import { cn } from "@/lib/utils";

export type BreadcrumbItem = {
  label: string;
  href?: string; // omit for the current (last) item
};

export function Breadcrumb({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "flex items-center flex-wrap gap-1 font-montserrat text-xs text-muted-text",
        className
      )}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={index} className="flex items-center gap-1">
            {index > 0 && (
              <span className="text-muted-text/40 select-none">›</span>
            )}
            {isLast || !item.href ? (
              <span className="text-forest font-medium">{item.label}</span>
            ) : (
              <Link
                href={item.href}
                className="hover:text-olive transition-colors"
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
