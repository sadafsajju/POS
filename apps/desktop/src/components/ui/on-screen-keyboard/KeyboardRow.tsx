import { KeyboardKey } from './KeyboardKey';
import type { KeyboardRow as RowType, KeyConfig } from './types';

interface KeyboardRowProps {
  row: RowType;
  isShifted: boolean;
  onKeyPress: (config: KeyConfig) => void;
}

export function KeyboardRow({ row, isShifted, onKeyPress }: KeyboardRowProps) {
  return (
    <div className="flex justify-center gap-2">
      {row.keys.map((key) => (
        <KeyboardKey
          key={key.id}
          config={key}
          isShifted={isShifted}
          onPress={onKeyPress}
        />
      ))}
    </div>
  );
}
