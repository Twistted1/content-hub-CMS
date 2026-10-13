import { LoadingState } from './LoadingState';

/**
 * Full-screen fallback for a lazily-loaded route chunk. Sized to the viewport
 * so navigating between code-split pages doesn't flash a layout collapse while
 * the next chunk downloads.
 */
export function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <LoadingState size="lg" />
    </div>
  );
}