import { useContext } from 'react';
import { EditorContext } from './EditorContext';
import type { EditorContextValue } from './EditorContext';

export function useEditorContext(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditorContext must be used within EditorContext.Provider');
  return ctx;
}
