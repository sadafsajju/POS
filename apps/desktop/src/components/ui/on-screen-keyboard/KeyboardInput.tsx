import { useState } from 'react';
import { Keyboard, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { OnScreenKeyboard } from './OnScreenKeyboard';
import type { KeyboardInputProps } from './types';

export function KeyboardInput({
  value,
  onChange,
  placeholder = 'Tap to type...',
  title = 'Enter Text',
  maxLength = 200,
  className,
  disabled = false,
  quickPhrases,
}: KeyboardInputProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        className={cn(
          'h-12 px-4 justify-start text-left font-normal w-full bg-zinc-900 border-zinc-700 text-zinc-100 hover:bg-zinc-800',
          !value && 'text-zinc-500',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        onClick={() => !disabled && setIsOpen(true)}
        disabled={disabled}
      >
        <Keyboard className="w-5 h-5 mr-3 text-zinc-500 flex-shrink-0" />
        <span className="truncate flex-1">{value || placeholder}</span>
        {value && (
          <MessageSquare className="w-4 h-4 ml-2 text-amber-400 flex-shrink-0" />
        )}
      </Button>

      <OnScreenKeyboard
        open={isOpen}
        onOpenChange={setIsOpen}
        value={value}
        onValueChange={onChange}
        title={title}
        placeholder={placeholder}
        maxLength={maxLength}
        quickPhrases={quickPhrases}
      />
    </>
  );
}
