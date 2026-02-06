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
          'h-12 px-4 justify-start text-left font-normal w-full',
          !value && 'text-muted-foreground',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        onClick={() => !disabled && setIsOpen(true)}
        disabled={disabled}
      >
        <Keyboard className="w-5 h-5 mr-3 text-muted-foreground flex-shrink-0" />
        <span className="truncate flex-1">{value || placeholder}</span>
        {value && (
          <MessageSquare className="w-4 h-4 ml-2 text-primary flex-shrink-0" />
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
