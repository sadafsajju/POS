import type { KeyboardLayout } from './types';

export const QWERTY_LAYOUT: KeyboardLayout = {
  id: 'qwerty',
  name: 'ABC',
  rows: [
    {
      keys: [
        { id: 'q', label: 'Q', value: 'q', type: 'char' },
        { id: 'w', label: 'W', value: 'w', type: 'char' },
        { id: 'e', label: 'E', value: 'e', type: 'char' },
        { id: 'r', label: 'R', value: 'r', type: 'char' },
        { id: 't', label: 'T', value: 't', type: 'char' },
        { id: 'y', label: 'Y', value: 'y', type: 'char' },
        { id: 'u', label: 'U', value: 'u', type: 'char' },
        { id: 'i', label: 'I', value: 'i', type: 'char' },
        { id: 'o', label: 'O', value: 'o', type: 'char' },
        { id: 'p', label: 'P', value: 'p', type: 'char' },
        { id: 'backspace', label: '⌫', type: 'backspace', width: 1.5, variant: 'destructive' },
      ],
    },
    {
      keys: [
        { id: 'a', label: 'A', value: 'a', type: 'char' },
        { id: 's', label: 'S', value: 's', type: 'char' },
        { id: 'd', label: 'D', value: 'd', type: 'char' },
        { id: 'f', label: 'F', value: 'f', type: 'char' },
        { id: 'g', label: 'G', value: 'g', type: 'char' },
        { id: 'h', label: 'H', value: 'h', type: 'char' },
        { id: 'j', label: 'J', value: 'j', type: 'char' },
        { id: 'k', label: 'K', value: 'k', type: 'char' },
        { id: 'l', label: 'L', value: 'l', type: 'char' },
      ],
    },
    {
      keys: [
        { id: 'shift', label: '⇧', type: 'shift', width: 1.5, variant: 'muted' },
        { id: 'z', label: 'Z', value: 'z', type: 'char' },
        { id: 'x', label: 'X', value: 'x', type: 'char' },
        { id: 'c', label: 'C', value: 'c', type: 'char' },
        { id: 'v', label: 'V', value: 'v', type: 'char' },
        { id: 'b', label: 'B', value: 'b', type: 'char' },
        { id: 'n', label: 'N', value: 'n', type: 'char' },
        { id: 'm', label: 'M', value: 'm', type: 'char' },
        { id: 'numbers', label: '123', type: 'symbols', width: 1.5, variant: 'muted' },
      ],
    },
    {
      keys: [
        { id: 'comma', label: ',', value: ',', type: 'char' },
        { id: 'space', label: 'Space', type: 'space', width: 5 },
        { id: 'period', label: '.', value: '.', type: 'char' },
        { id: 'enter', label: 'Done', type: 'enter', width: 2, variant: 'primary' },
      ],
    },
  ],
};

export const NUMBERS_LAYOUT: KeyboardLayout = {
  id: 'numbers',
  name: '123',
  rows: [
    {
      keys: [
        { id: '1', label: '1', value: '1', type: 'char' },
        { id: '2', label: '2', value: '2', type: 'char' },
        { id: '3', label: '3', value: '3', type: 'char' },
        { id: '4', label: '4', value: '4', type: 'char' },
        { id: '5', label: '5', value: '5', type: 'char' },
        { id: '6', label: '6', value: '6', type: 'char' },
        { id: '7', label: '7', value: '7', type: 'char' },
        { id: '8', label: '8', value: '8', type: 'char' },
        { id: '9', label: '9', value: '9', type: 'char' },
        { id: '0', label: '0', value: '0', type: 'char' },
        { id: 'backspace', label: '⌫', type: 'backspace', width: 1.5, variant: 'destructive' },
      ],
    },
    {
      keys: [
        { id: '-', label: '-', value: '-', type: 'char' },
        { id: '/', label: '/', value: '/', type: 'char' },
        { id: ':', label: ':', value: ':', type: 'char' },
        { id: ';', label: ';', value: ';', type: 'char' },
        { id: '(', label: '(', value: '(', type: 'char' },
        { id: ')', label: ')', value: ')', type: 'char' },
        { id: '$', label: '$', value: '$', type: 'char' },
        { id: '&', label: '&', value: '&', type: 'char' },
        { id: '@', label: '@', value: '@', type: 'char' },
      ],
    },
    {
      keys: [
        { id: 'symbols', label: '#+=', type: 'symbols', width: 1.5, variant: 'muted' },
        { id: '.', label: '.', value: '.', type: 'char' },
        { id: ',', label: ',', value: ',', type: 'char' },
        { id: '?', label: '?', value: '?', type: 'char' },
        { id: '!', label: '!', value: '!', type: 'char' },
        { id: "'", label: "'", value: "'", type: 'char' },
        { id: '"', label: '"', value: '"', type: 'char' },
        { id: 'abc', label: 'ABC', type: 'symbols', width: 1.5, variant: 'muted' },
      ],
    },
    {
      keys: [
        { id: 'space', label: 'Space', type: 'space', width: 6 },
        { id: 'enter', label: 'Done', type: 'enter', width: 2, variant: 'primary' },
      ],
    },
  ],
};

export const SYMBOLS_LAYOUT: KeyboardLayout = {
  id: 'symbols',
  name: 'Symbols',
  rows: [
    {
      keys: [
        { id: '!', label: '!', value: '!', type: 'char' },
        { id: '@', label: '@', value: '@', type: 'char' },
        { id: '#', label: '#', value: '#', type: 'char' },
        { id: '$', label: '$', value: '$', type: 'char' },
        { id: '%', label: '%', value: '%', type: 'char' },
        { id: '^', label: '^', value: '^', type: 'char' },
        { id: '&', label: '&', value: '&', type: 'char' },
        { id: '*', label: '*', value: '*', type: 'char' },
        { id: '(', label: '(', value: '(', type: 'char' },
        { id: ')', label: ')', value: ')', type: 'char' },
        { id: 'backspace', label: '⌫', type: 'backspace', width: 1.5, variant: 'destructive' },
      ],
    },
    {
      keys: [
        { id: '-', label: '-', value: '-', type: 'char' },
        { id: '_', label: '_', value: '_', type: 'char' },
        { id: '=', label: '=', value: '=', type: 'char' },
        { id: '+', label: '+', value: '+', type: 'char' },
        { id: '[', label: '[', value: '[', type: 'char' },
        { id: ']', label: ']', value: ']', type: 'char' },
        { id: '{', label: '{', value: '{', type: 'char' },
        { id: '}', label: '}', value: '}', type: 'char' },
        { id: '|', label: '|', value: '|', type: 'char' },
        { id: '\\', label: '\\', value: '\\', type: 'char' },
      ],
    },
    {
      keys: [
        { id: ':', label: ':', value: ':', type: 'char' },
        { id: ';', label: ';', value: ';', type: 'char' },
        { id: '"', label: '"', value: '"', type: 'char' },
        { id: "'", label: "'", value: "'", type: 'char' },
        { id: '<', label: '<', value: '<', type: 'char' },
        { id: '>', label: '>', value: '>', type: 'char' },
        { id: '?', label: '?', value: '?', type: 'char' },
        { id: '/', label: '/', value: '/', type: 'char' },
        { id: '~', label: '~', value: '~', type: 'char' },
      ],
    },
    {
      keys: [
        { id: 'abc', label: 'ABC', type: 'symbols', width: 1.5, variant: 'muted' },
        { id: 'clear', label: 'Clear', type: 'clear', width: 2, variant: 'destructive' },
        { id: 'space', label: 'Space', type: 'space', width: 4 },
        { id: 'enter', label: 'Done', type: 'enter', width: 2, variant: 'primary' },
      ],
    },
  ],
};
