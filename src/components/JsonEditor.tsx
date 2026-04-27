"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter, lintGutter, forEachDiagnostic, type Diagnostic } from "@codemirror/lint";
import { EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";

export type ValidationStatus =
  | { ok: true }
  | { ok: false; line: number; col: number; from: number; message: string };

export interface JsonEditorHandle {
  scrollToError: () => void;
  format: () => void;
  getValidation: () => ValidationStatus;
}

export interface JsonEditorProps {
  value: string;
  onChange: (v: string) => void;
  minHeight?: string;
  ariaLabel?: string;
  onValidationChange?: (s: ValidationStatus) => void;
}

const editorTheme = EditorView.theme({
  "&": { fontSize: "13px" },
  ".cm-gutters": { backgroundColor: "#f9fafb", color: "#9ca3af", border: "none" },
  ".cm-activeLine": { backgroundColor: "#f3f4f6" },
  ".cm-activeLineGutter": { backgroundColor: "#eff6ff", color: "#2563eb" },
  ".cm-lintRange-error": {
    backgroundImage: "none",
    textDecoration: "underline wavy #ef4444",
  },
  ".cm-content": { padding: "8px 0" },
});

function diagnosticsToStatus(view: EditorView): ValidationStatus {
  let first: Diagnostic | null = null;
  forEachDiagnostic(view.state, (d) => {
    if (!first) first = d;
  });
  if (!first) return { ok: true };
  const diag: Diagnostic = first;
  const line = view.state.doc.lineAt(diag.from);
  return {
    ok: false,
    line: line.number,
    col: diag.from - line.from + 1,
    from: diag.from,
    message: diag.message,
  };
}

const JsonEditor = forwardRef<JsonEditorHandle, JsonEditorProps>(function JsonEditor(
  { value, onChange, minHeight = "480px", ariaLabel, onValidationChange },
  ref
) {
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const [status, setStatus] = useState<ValidationStatus>({ ok: true });

  const setStatusRef = useRef(setStatus);
  const onValidRef = useRef(onValidationChange);
  setStatusRef.current = setStatus;
  onValidRef.current = onValidationChange;

  const extensions = useMemo(() => {
    const statusPlugin = ViewPlugin.fromClass(
      class {
        constructor(view: EditorView) {
          this.publish(view);
        }
        update(u: ViewUpdate) {
          this.publish(u.view);
        }
        publish(view: EditorView) {
          const next = diagnosticsToStatus(view);
          requestAnimationFrame(() => {
            setStatusRef.current(next);
            onValidRef.current?.(next);
          });
        }
      }
    );
    return [
      json(),
      lintGutter(),
      linter(jsonParseLinter(), { delay: 250 }),
      editorTheme,
      statusPlugin,
    ];
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      format: () => {
        const view = cmRef.current?.view;
        if (!view) return;
        const text = view.state.doc.toString();
        try {
          const pretty = JSON.stringify(JSON.parse(text), null, 2);
          if (pretty !== text) {
            view.dispatch({
              changes: { from: 0, to: view.state.doc.length, insert: pretty },
            });
          }
        } catch {
          /* no-op */
        }
      },
      scrollToError: () => {
        const view = cmRef.current?.view;
        if (!view) return;
        const cur = diagnosticsToStatus(view);
        if (cur.ok) return;
        view.dispatch({
          effects: EditorView.scrollIntoView(cur.from, { y: "center" }),
          selection: { anchor: cur.from },
        });
        view.focus();
      },
      getValidation: (): ValidationStatus => {
        const view = cmRef.current?.view;
        if (!view) return { ok: true };
        return diagnosticsToStatus(view);
      },
    }),
    []
  );

  const lineCount = value === "" ? 1 : value.split("\n").length;

  const handleFormat = () => {
    const view = cmRef.current?.view;
    if (!view) return;
    const text = view.state.doc.toString();
    try {
      const pretty = JSON.stringify(JSON.parse(text), null, 2);
      if (pretty !== text) {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: pretty },
        });
      }
    } catch {
      /* 정렬 불가 — 상태바에 이미 에러가 표시되어 있음 */
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-white">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b text-xs">
        <span className="text-gray-500 font-medium">JSON</span>
        <button
          type="button"
          onClick={handleFormat}
          disabled={!status.ok}
          className="px-2 py-0.5 rounded text-gray-600 hover:text-gray-900 hover:bg-gray-200 transition disabled:opacity-40 disabled:cursor-not-allowed"
          title="JSON을 2칸 들여쓰기로 정렬"
        >
          정렬
        </button>
      </div>
      <CodeMirror
        ref={cmRef}
        value={value}
        onChange={onChange}
        extensions={extensions}
        minHeight={minHeight}
        aria-label={ariaLabel}
      />
      <div className="flex items-center justify-between px-3 py-1 border-t bg-gray-50 text-xs">
        {status.ok ? (
          <span className="text-green-600">✓ 유효한 JSON · {lineCount}줄</span>
        ) : (
          <span className="text-red-600 truncate">
            ✕ {status.line}행 {status.col}열: {status.message}
          </span>
        )}
        <span className="text-gray-400 ml-3 shrink-0">CodeMirror</span>
      </div>
    </div>
  );
});

export default JsonEditor;
