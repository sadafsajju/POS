import { useState, useCallback, useEffect, useRef } from 'react';
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setLocalValue(value);
      setCurrentLayout(QWERTY_LAYOUT);
      setIsShifted(false);
      // Focus the hidden input so physical keyboard works
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, value]);

  // Keep input focused when interacting with on-screen keys
  const refocusInput = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleDone = useCallback(() => {
    onValueChange(localValue);
    onSubmit?.(localValue);
    onOpenChange(false);
  }, [localValue, onValueChange, onSubmit, onOpenChange]);

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
          handleDone();
          break;
      }
      refocusInput();
    },
    [localValue, isShifted, maxLength, handleDone, refocusInput]
  );

  const handleCancel = useCallback(() => {
    setLocalValue(value);
    onOpenChange(false);
  }, [value, onOpenChange]);

  // Save value and close, but don't trigger onSubmit (no field chaining)
  const handleDismiss = useCallback(() => {
    onValueChange(localValue);
    onOpenChange(false);
  }, [localValue, onValueChange, onOpenChange]);

  const handleClear = useCallback(() => {
    setLocalValue('');
    refocusInput();
  }, [refocusInput]);

  // Handle physical keyboard input via the hidden input
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVal = e.target.value;
      if (newVal.length <= maxLength) {
        setLocalValue(newVal);
      }
    },
    [maxLength]
  );

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleDone();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleDone, handleCancel]
  );

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex flex-col z-[9999]">
      {/* Backdrop - tap to close */}
      <div
        className="flex-1 flex items-start justify-center pt-8 px-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleDismiss();
        }}
      >
        <Card className="w-full max-w-2xl p-4 animate-in fade-in slide-in-from-top-4 duration-200 bg-zinc-900 border-zinc-800 text-zinc-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-zinc-100">{title}</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          <div
            className="relative cursor-text"
            onClick={() => inputRef.current?.focus()}
          >
            {/* Hidden input for physical/native keyboard */}
            <input
              ref={inputRef}
              value={localValue}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              maxLength={maxLength}
              className="absolute inset-0 w-full h-full opacity-0 pointer-events-none"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <div className="w-full min-h-14 px-4 py-3 pr-20 rounded-lg border-2 border-zinc-700 bg-zinc-950 text-lg overflow-x-auto whitespace-pre-wrap break-words flex items-center text-zinc-100">
              {localValue || (
                <span className="text-zinc-500">{placeholder}</span>
              )}
              <span className="inline-block w-0.5 h-5 bg-amber-500 ml-0.5 animate-pulse" />
            </div>
            {localValue.length > 0 && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                  className="h-7 w-7 p-0 text-zinc-500 hover:text-red-400 hover:bg-zinc-800"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Keyboard - Fixed at bottom */}
      <div
        className="w-full bg-zinc-900 border-t border-zinc-800 p-6 animate-in slide-in-from-bottom-4 duration-200"
        onMouseDown={(e) => e.preventDefault()}
        onTouchStart={(e) => e.preventDefault()}
      >
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
