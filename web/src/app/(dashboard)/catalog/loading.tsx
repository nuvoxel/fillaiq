import { Skeleton } from "@/components/ui/skeleton";

export default function CatalogLoading() {
  return (
    <div>
      <div className="mb-6">
        <Skeleton className="h-10 w-[120px] mb-1" />
        <Skeleton className="h-5 w-[280px]" />
      </div>
      <div className="flex gap-4 mb-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-[90px] rounded" />
        ))}
      </div>
      <Skeleton className="h-10 w-[320px] mb-4 rounded" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[52px] w-full rounded" />
        ))}
      </div>
    </div>
  );
}
