import { Skeleton } from "@/components/ui/skeleton";

export default function SubmissionsLoading() {
  return (
    <div>
      <div className="flex justify-between mb-6">
        <div>
          <Skeleton className="h-10 w-[140px] mb-1" />
          <Skeleton className="h-5 w-[280px]" />
        </div>
        <Skeleton className="h-10 w-[150px] rounded" />
      </div>
      <div className="flex gap-2 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-20 rounded-lg" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[52px] w-full rounded" />
        ))}
      </div>
    </div>
  );
}
