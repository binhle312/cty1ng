import { Skeleton, SkeletonArea } from "../../components/ui/skeleton.tsx";

// The skill page while it loads: the page top, the tabs and three fields.
export function SkillEditorSkeleton() {
  return (
    <SkeletonArea label="Loading the skill">
      <div className="flex flex-col gap-3 px-8 py-6">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="mt-4 h-8 w-72" />
        <Skeleton className="mt-4 h-9" />
        <Skeleton className="h-16" />
        <Skeleton className="h-64" />
      </div>
    </SkeletonArea>
  );
}
