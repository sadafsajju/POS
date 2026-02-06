import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { KeyboardRow } from './KeyboardRow';
import { QWERTY_LAYOUT, NUMBERS_LAYOUT, SYMBOLS_LAYOUT } from './keyboard-layouts';
import type { OnScreenKeyboardProps, KeyConfig, KeyboardLayout } from './types';

export function OnScreenKeyboard({
  open,
  onOpenChange,
  value,
  onValueChange,
  onSubmit,
  title = 'Enter Text',
  placeholder = 'Type here...',
  maxLength = 200,
}: OnScreenKeyboardProps) {
  const [isShifted, setIsShifted] = useState(false);
  const [currentLayout, setCurrentLayout] =
    useState<KeyboardLayout>(QWERTY_LAYOUT);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    if (open) {
      setLocalValue(value);
      setCurrentLayout(QWERTY_LAYOUT);
      setIsShifted(false);
    }
  }, [open, value]);

  const handleKeyPress = useCallback(
    (config: KeyConfig) => {
      switch (config.type) {
        case 'char':
          if (localValue.length < maxLength) {
            const char = isShifted
              ? (config.value || '').toUpperCase()
              : config.value || '';
            setLocalValue((prev) => prev + char);
            if (isShifted) setIsShifted(false);
          }
          break;

        case 'backspace':
          setLocalValue((prev) => prev.slice(0, -1));
          break;

        case 'space':
          if (localValue.length < maxLength) {
            setLocalValue((prev) => prev + ' ');
          }
          break;

        case 'shift':
          setIsShifted((prev) => !prev);
          break;

        case 'symbols':
          // Check button id to determine which layout to switch to
          if (config.id === 'numbers' || config.id === '123') {
            setCurrentLayout(NUMBERS_LAYOUT);
          } else if (config.id === 'abc' || config.id === 'ABC') {
            setCurrentLayout(QWERTY_LAYOUT);
          } else if (config.id === 'symbols') {
            setCurrentLayout(SYMBOLS_LAYOUT);
          }
          break;

        case 'clear':
          setLocalValue('');
          break;

        case 'enter':
          onValueChange(localValue);
          onSubmit?.(localValue);
          onOpenChange(false);
          break;
      }
    },
    [localValue, isShifted, maxLength, onValueChange, onSubmit, onOpenChange]
  );

  const handleCancel = useCallback(() => {
    setLocalValue(value);
    onOpenChange(false);
  }, [value, onOpenChange]);

  const handleClear = useCallback(() => {
    setLocalValue('');
  }, []);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex flex-col z-[9999]">
      {/* Input Dialog - Floating at top */}
      <div className="flex-1 flex items-start justify-center pt-8 px-4">
        <Card className="w-full max-w-2xl p-4 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">{title}</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="h-8 w-8 p-0"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          <div className="relative">
            <div className="w-full min-h-14 px-4 py-3 pr-20 rounded-lg border-2 border-input bg-background text-lg overflow-x-auto whitespace-pre-wrap break-words flex items-center">
              {localValue || (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
              <span className="inline-block w-0.5 h-5 bg-primary ml-0.5 animate-pulse" />
            </div>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {localValue.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
              <span className="text-xs text-muted-foreground">
                {localValue.length}/{maxLength}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Keyboard - Fixed at bottom */}
      <div className="w-full bg-card border-t border-border p-6 animate-in slide-in-from-bottom-4 duration-200">
        <div className="space-y-2">
          {currentLayout.rows.map((row, index) => (
            <KeyboardRow
              key={`row-${index}`}
              row={row}
              isShifted={isShifted}
              onKeyPress={handleKeyPress}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
