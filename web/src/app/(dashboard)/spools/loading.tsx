import { Skeleton } from "@/components/ui/skeleton";

export default function SpoolsLoading() {
  return (
    <div>
      <div className="flex justify-between mb-6">
        <div>
          <Skeleton className="w-[100px] h-10" />
          <Skeleton className="w-[260px] h-5 mt-1" />
        </div>
        <Skeleton className="w-[120px] h-10 rounded-lg" />
      </div>
      <div className="flex gap-2 mb-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="w-20 h-9 rounded-lg" />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[52px] rounded-lg" />
        ))}
      </div>
    </div>
  );
}
