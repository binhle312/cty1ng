import { Skeleton, SkeletonArea } from "../../components/ui/skeleton.tsx";

// What a lazy page shows while its code loads (frontend-conventions.md §4): the shapes of a
// page title and a few lines, after 200 ms.
export function PageSkeleton() {
  return (
    <SkeletonArea label="Loading page">
      <div className="flex flex-col gap-3 px-8 py-6">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-4 w-80" />
      </div>
    </SkeletonArea>
  );
}
