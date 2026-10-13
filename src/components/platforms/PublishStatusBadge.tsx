import { AlertTriangle, RotateCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTranslation } from 'react-i18next';
import type { Post } from '@/types';

/** Must match `p_max_attempts` in `claim_due_posts` / publish-due-posts. */
export const MAX_PUBLISH_ATTEMPTS = 5;

interface PublishStatusBadgeProps {
  post: Pick<Post, 'status' | 'publishAttempts' | 'publishError'>;
}

/**
 * Surfaces publish retry state. Without this, a post that failed delivery three
 * times looks identical to one that has never been attempted.
 */
export function PublishStatusBadge({ post }: PublishStatusBadgeProps) {
  const { t } = useTranslation();
  const attempts = post.publishAttempts ?? 0;

  if (attempts === 0) return null;

  const exhausted = attempts >= MAX_PUBLISH_ATTEMPTS;

  if (post.status === 'failed' || exhausted) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="destructive" className="text-[10px] gap-1">
            <AlertTriangle className="h-3 w-3" />
            {exhausted
              ? t('calendar.publishRetriesExhausted', { count: attempts })
              : t('calendar.publishFailed')}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs">
            {post.publishError || t('calendar.publishNoErrorDetail')}
          </p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/50 text-amber-600 dark:text-amber-400">
          <RotateCw className="h-3 w-3" />
          {t('calendar.publishRetry', { attempts, max: MAX_PUBLISH_ATTEMPTS })}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p className="text-xs">
          {post.publishError || t('calendar.publishRetryPending')}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}