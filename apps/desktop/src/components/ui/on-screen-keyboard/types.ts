// Key types
export type KeyType = 'char' | 'backspace' | 'enter' | 'space' | 'shift' | 'symbols' | 'clear';

export interface KeyConfig {
  id: string;
  label: string;
  value?: string;
  type: KeyType;
  width?: number;
  variant?: 'default' | 'primary' | 'destructive' | 'muted';
}

export interface KeyboardRow {
  keys: KeyConfig[];
}

export interface KeyboardLayout {
  id: string;
  name: string;
  rows: KeyboardRow[];
}

export interface OnScreenKeyboardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onValueChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  title?: string;
  placeholder?: string;
  maxLength?: number;
  quickPhrases?: string[];
}

export interface KeyboardKeyProps {
  config: KeyConfig;
  isShifted: boolean;
  onPress: (config: KeyConfig) => void;
}

export interface KeyboardInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  title?: string;
  maxLength?: number;
  className?: string;
  disabled?: boolean;
  quickPhrases?: string[];
}
