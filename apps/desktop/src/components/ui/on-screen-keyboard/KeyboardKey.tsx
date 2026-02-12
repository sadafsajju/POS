import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { KeyboardKeyProps } from './types';

const BASE_KEY_WIDTH = 80;
const KEY_GAP = 8;

export function KeyboardKey({ config, isShifted, onPress }: KeyboardKeyProps) {
  const { label, type, width = 1, variant = 'default' } = config;

  const keyWidth = width * BASE_KEY_WIDTH + (width - 1) * KEY_GAP;

  const displayLabel =
    type === 'char' && isShifted ? label.toUpperCase() : label;

  const buttonVariant =
    variant === 'primary'
      ? 'default'
      : variant === 'destructive'
        ? 'destructive'
        : variant === 'muted'
          ? 'secondary'
          : 'outline';

  // Dark zinc theme overrides for each variant
  const variantClass =
    variant === 'primary'
      ? 'bg-amber-500 hover:bg-amber-400 text-white'
      : variant === 'destructive'
        ? ''
        : variant === 'muted'
          ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600 border-zinc-700'
          : 'bg-zinc-800 border-zinc-700 text-zinc-100 hover:bg-zinc-700';

  return (
    <Button
      variant={buttonVariant}
      className={cn(
        'h-[72px] text-2xl font-medium touch-manipulation select-none',
        'active:scale-95 transition-transform',
        variantClass,
        type === 'space' && 'text-zinc-500',
        type === 'shift' && isShifted && 'bg-amber-500 text-white'
      )}
      style={{ width: keyWidth, minWidth: keyWidth }}
      onClick={() => onPress(config)}
    >
      {displayLabel}
    </Button>
  );
}
