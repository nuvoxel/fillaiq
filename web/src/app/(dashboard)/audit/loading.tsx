import { Skeleton } from "@/components/ui/skeleton";

export default function AuditLoading() {
  return (
    <div>
      {/* Page header skeleton */}
      <div className="mb-6">
        <Skeleton className="h-10 w-[144px] mb-1" />
        <Skeleton className="h-5 w-[256px]" />
      </div>

      {/* Filter pills skeleton */}
      <div className="flex gap-2 mb-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-16 rounded-full" />
        ))}
      </div>
      <div className="mb-6">
        <Skeleton className="h-10 w-[200px] rounded" />
      </div>

      {/* Card skeletons */}
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded" />
        ))}
      </div>
    </div>
  );
}
