import { parseCup, type Diagnostic } from "@checkup/parser";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckUpPreview } from "./CheckUpPreview.js";
import { DEFAULT_CUP_SOURCE } from "./default-source.js";
import { stringifyDocument } from "./debug-output.js";

type OutputTab = "preview" | "parsed";

const initialResult = parseCup(DEFAULT_CUP_SOURCE);

export function App() {
  const [source, setSource] = useState(DEFAULT_CUP_SOURCE);
  const [activeTab, setActiveTab] = useState<OutputTab>("preview");
  const [lastValidDocument, setLastValidDocument] = useState(initialResult.document);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const result = useMemo(() => parseCup(source), [source]);

  useEffect(() => {
    if (result.success) {
      setLastValidDocument(result.document);
    }
  }, [result]);

  function focusDiagnostic(diagnostic: Diagnostic): void {
    const editor = editorRef.current;
    if (editor === null) {
      return;
    }
    editor.focus();
    editor.setSelectionRange(diagnostic.source.start.offset, diagnostic.source.end.offset);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="brand-kicker">CHECKUP · FORMAT V2</p>
          <h1>Web Editor <span>MVP</span></h1>
        </div>
        <div className={`parse-status ${result.success ? "is-valid" : "is-invalid"}`} aria-live="polite">
          <span className="status-dot" />
          {result.success ? `解析成功 · ${result.document.fields.length} 個欄位` : `${result.diagnostics.length} 個問題`}
        </div>
      </header>

      <section className="workspace" aria-label="CheckUp 編輯工作區">
        <div className="editor-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-index">01</span>
              <h2>.cup Source</h2>
            </div>
            <button className="text-button" type="button" onClick={() => setSource(DEFAULT_CUP_SOURCE)}>
              重設範例
            </button>
          </div>
          <textarea
            ref={editorRef}
            className="source-editor"
            aria-label=".cup 原始碼"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            spellCheck={false}
          />

          <DiagnosticsPanel diagnostics={result.diagnostics} onSelect={focusDiagnostic} />
        </div>

        <div className="output-panel">
          <div className="panel-heading output-heading">
            <div>
              <span className="panel-index">02</span>
              <h2>Structured Output</h2>
            </div>
            <div className="tab-list" role="tablist" aria-label="輸出模式">
              <button
                className={activeTab === "preview" ? "is-active" : ""}
                type="button"
                role="tab"
                aria-selected={activeTab === "preview"}
                onClick={() => setActiveTab("preview")}
              >
                Preview
              </button>
              <button
                className={activeTab === "parsed" ? "is-active" : ""}
                type="button"
                role="tab"
                aria-selected={activeTab === "parsed"}
                onClick={() => setActiveTab("parsed")}
              >
                Parsed Output
              </button>
            </div>
          </div>

          <div className="output-body">
            {activeTab === "preview" ? (
              <>
                {!result.success ? (
                  <p className="stale-notice">目前來源有錯誤，預覽保留最近一次成功解析的文件。</p>
                ) : null}
                <CheckUpPreview document={result.success ? result.document : lastValidDocument} />
              </>
            ) : (
              <pre className="debug-output" aria-label="Parser JSON 輸出">
                {stringifyDocument(result.document)}
              </pre>
            )}
          </div>
        </div>
      </section>

      <footer className="pipeline">
        <span>.cup source</span><i>→</i><strong>@checkup/parser</strong><i>→</i><span>CupDocument</span><i>→</i><strong>CheckUpPreview</strong>
      </footer>
    </main>
  );
}

interface DiagnosticsPanelProps {
  readonly diagnostics: readonly Diagnostic[];
  readonly onSelect: (diagnostic: Diagnostic) => void;
}

function DiagnosticsPanel({ diagnostics, onSelect }: DiagnosticsPanelProps) {
  return (
    <section className="diagnostics" aria-label="Parser diagnostics">
      <div className="diagnostics-heading">
        <h3>Diagnostics</h3>
        <span>{diagnostics.length}</span>
      </div>
      {diagnostics.length === 0 ? (
        <p className="diagnostics-empty">沒有 parser errors。文件可安全交給 Preview。</p>
      ) : (
        <ul>
          {diagnostics.map((diagnostic, index) => (
            <li key={`${diagnostic.code}-${diagnostic.source.start.offset}-${index}`}>
              <button type="button" onClick={() => onSelect(diagnostic)}>
                <span className="diagnostic-code">{diagnostic.code}</span>
                <span className="diagnostic-message">{diagnostic.message}</span>
                <span className="diagnostic-location">
                  L{diagnostic.source.start.line}:C{diagnostic.source.start.column} · {diagnostic.source.length} chars
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
