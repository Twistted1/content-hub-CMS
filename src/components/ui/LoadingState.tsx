import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  message?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

export function LoadingState({
  message,
  className,
  size = 'md',
}: LoadingStateProps) {
  const { t } = useTranslation();
  const resolvedMessage = message ?? t('common.loading');
  return (
    <div className={cn('flex flex-col items-center justify-center py-12', className)}>
      <Loader2 className={cn('animate-spin text-primary', sizeClasses[size])} />
      {resolvedMessage && (
        <p className="text-sm text-muted-foreground mt-3">{resolvedMessage}</p>
      )}
    </div>
  );
}
