import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div>
      <div className="mb-6">
        <Skeleton className="h-10 w-[160px] mb-1" />
        <Skeleton className="h-5 w-[300px]" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[100px] w-full rounded" />
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[7fr_5fr] gap-6">
        <Skeleton className="h-[380px] w-full rounded" />
        <Skeleton className="h-[380px] w-full rounded" />
      </div>
    </div>
  );
}
