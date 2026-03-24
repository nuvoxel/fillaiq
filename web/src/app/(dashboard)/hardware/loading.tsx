import { Skeleton } from "@/components/ui/skeleton";

export default function HardwareLoading() {
  return (
    <div>
      <div className="flex justify-between mb-6">
        <div>
          <Skeleton className="h-10 w-[120px] mb-1" />
          <Skeleton className="h-5 w-[260px]" />
        </div>
        <Skeleton className="h-10 w-[120px] rounded" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[140px] w-full rounded" />
        ))}
      </div>
    </div>
  );
}
