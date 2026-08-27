import { Skeleton } from '@/components/ui/skeleton';

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-8 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-10 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ className = '' }: { className?: string }) {
  return <Skeleton className={`h-40 rounded-lg ${className}`} />;
}

export function UserDetailSkeleton() {
  return (
    <div className="space-y-4">
      <CardSkeleton />
      <CardSkeleton className="h-64" />
      <CardSkeleton className="h-64" />
      <CardSkeleton className="h-64" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-6 w-64" />
      <CardSkeleton />
      <TableSkeleton />
    </div>
  );
}
