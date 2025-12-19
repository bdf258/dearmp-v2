/**
 * Triage Skeletons
 *
 * Loading state skeletons for triage components.
 */

import { cn } from '@/lib/utils';

// Animated skeleton base
function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded bg-muted', className)} />
  );
}

export const TriageSkeletons = {
  // Message list item skeleton
  MessageCard: function MessageCardSkeleton({ className }: { className?: string }) {
    return (
      <div className={cn('flex items-start gap-3 p-3 border-b', className)}>
        <Skeleton className="h-9 w-9 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-full" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
      </div>
    );
  },

  // Message list skeleton
  MessageList: function MessageListSkeleton({ count = 5 }: { count?: number }) {
    return (
      <div>
        {Array.from({ length: count }).map((_, i) => (
          <TriageSkeletons.MessageCard key={i} />
        ))}
      </div>
    );
  },

  // Campaign card skeleton
  CampaignCard: function CampaignCardSkeleton({ className }: { className?: string }) {
    return (
      <div className={cn('p-4 border rounded-lg space-y-3', className)}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full" />
        <div className="flex gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    );
  },

  // Campaign list skeleton
  CampaignList: function CampaignListSkeleton({ count = 3 }: { count?: number }) {
    return (
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <TriageSkeletons.CampaignCard key={i} />
        ))}
      </div>
    );
  },

  // Triage panel skeleton
  TriagePanel: function TriagePanelSkeleton({ className }: { className?: string }) {
    return (
      <div className={cn('space-y-4 p-4', className)}>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </div>
    );
  },

  // Message detail skeleton
  MessageDetail: function MessageDetailSkeleton({ className }: { className?: string }) {
    return (
      <div className={cn('space-y-4', className)}>
        {/* Header */}
        <div className="space-y-3">
          <Skeleton className="h-6 w-3/4" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-3 w-24" />
          </div>
        </div>

        {/* Body */}
        <div className="space-y-2 pt-4 border-t">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  },

  // Dropdown skeleton
  Dropdown: function DropdownSkeleton({ className }: { className?: string }) {
    return (
      <div className={cn('space-y-2', className)}>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    );
  },

  // Inline badge skeleton
  Badge: function BadgeSkeleton({ className }: { className?: string }) {
    return <Skeleton className={cn('h-5 w-16 rounded-full inline-block', className)} />;
  },
};
