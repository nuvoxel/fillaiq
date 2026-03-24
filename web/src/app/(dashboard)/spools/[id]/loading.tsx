import { Skeleton } from "@/components/ui/skeleton";

export default function SpoolDetailLoading() {
  return (
    <div>
      <Skeleton className="w-[120px] h-8 mb-4" />
      <Skeleton className="w-[200px] h-10 mb-6" />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-8">
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <div className="md:col-span-4">
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <div className="md:col-span-12">
          <Skeleton className="h-[340px] rounded-xl" />
        </div>
        <div className="md:col-span-12">
          <Skeleton className="h-[280px] rounded-xl" />
        </div>
      </div>
    </div>
  );
}
