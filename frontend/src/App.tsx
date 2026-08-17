import { useEffect, useMemo, useRef, useState } from "react";
import { IconCommand, IconMoon, IconSearch, IconSun } from "@tabler/icons-react";
import { Command } from "cmdk";

import { tools, type ToolID } from "./app/tools";
import type { AppServices, RecoveryInfo } from "./services/types";
import { wailsServices } from "./services/wails";
import { Base64PdfTool } from "./tools/base64-pdf/Base64PdfTool";
import { TextDiffTool } from "./features/text-diff/TextDiffTool";
import type { TextDiffDraft } from "../bindings/github.com/brxyxn/work-tools-local/internal/storage/models";

type Theme = "light" | "dark";

function initialTheme(): Theme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

interface AppProps {
  services?: AppServices;
}

function DatabaseRecovery({ recovery }: { recovery: RecoveryInfo }) {
  return (
    <main className="recovery-screen">
      <h1>Local data needs attention</h1>
      <p>Work Tools left the database untouched because it could not be opened safely.</p>
      <dl>
        <div><dt>Details</dt><dd>{recovery.message}</dd></div>
        <div><dt>Database</dt><dd>{recovery.databasePath}</dd></div>
        <div><dt>Log</dt><dd>{recovery.logPath || "Log file unavailable"}</dd></div>
      </dl>
      <p>Make a copy of the database before attempting any repair.</p>
    </main>
  );
}

function App({ services = wailsServices }: AppProps) {
  const [activeToolID, setActiveToolID] = useState<ToolID>("text-diff");
  const [commandOpen, setCommandOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState<RecoveryInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [textDiffDraft, setTextDiffDraft] = useState<TextDiffDraft>({
    originalText: "", changedText: "", viewMode: "split", updatedAt: 0,
  });
  const textDiffFlushRef = useRef<(() => Promise<void>) | null>(null);
  const activeTool = useMemo(
    () => tools.find((tool) => tool.id === activeToolID) ?? tools[0],
    [activeToolID],
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    services.workspace.load().then((result) => {
      if (cancelled) return;
      if (result.recovery) {
        setRecovery(result.recovery);
        setLoading(false);
        return;
      }
      const settings = result.state?.settings ?? {};
      const savedDraft = result.state?.textDiffDraft;
      if (savedDraft) setTextDiffDraft(savedDraft);
      const savedTool = settings.selected_tool;
      if (typeof savedTool === "string" && tools.some((tool) => tool.id === savedTool)) {
        setActiveToolID(savedTool as ToolID);
      }
      const savedTheme = settings.theme;
      if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
      setLoading(false);
    }).catch((error: unknown) => {
      if (cancelled) return;
      setLoadError(error instanceof Error ? error.message : "Unable to load the local workspace.");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [services]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
      if (event.key === "Escape") setCommandOpen(false);
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const selectTool = async (id: ToolID) => {
    setMutationError(null);
    try {
      if (activeToolID === "text-diff" && id !== "text-diff") await textDiffFlushRef.current?.();
      await services.workspace.saveSettings({ selected_tool: id });
      setActiveToolID(id);
      setCommandOpen(false);
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Unable to save the selected tool.");
    }
  };

  const toggleTheme = async () => {
    const next = theme === "dark" ? "light" : "dark";
    setMutationError(null);
    try {
      await services.workspace.saveSettings({ theme: next });
      setTheme(next);
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Unable to save the theme.");
    }
  };

  if (loading) return <main className="loading-screen" aria-label="Loading workspace">Loading Work Tools…</main>;
  if (recovery) return <DatabaseRecovery recovery={recovery} />;
  if (loadError) throw new Error(loadError);

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">W</span>
          <span><strong>Work Tools</strong><small>Local utilities</small></span>
        </div>

        <button className="command-trigger" type="button" onClick={() => setCommandOpen(true)}>
          <IconSearch size={16} aria-hidden="true" />
          <span>Find a tool</span>
          <kbd><IconCommand size={12} aria-label="Command" />K</kbd>
        </button>

        <nav className="tool-navigation" aria-label="Tools">
          <span className="navigation-label">Tools</span>
          {tools.map((tool) => {
            const ToolIcon = tool.icon;
            return (
              <button
                className="tool-navigation-item"
                type="button"
                key={tool.id}
                aria-current={tool.id === activeToolID ? "page" : undefined}
                onClick={() => void selectTool(tool.id)}
              >
                <ToolIcon size={18} stroke={1.8} aria-hidden="true" />
                {tool.label}
              </button>
            );
          })}
        </nav>

        <button
          className="theme-toggle"
          type="button"
          aria-label={`Use ${theme === "dark" ? "light" : "dark"} theme`}
          onClick={() => void toggleTheme()}
        >
          {theme === "dark" ? <IconSun size={17} /> : <IconMoon size={17} />}
          {theme === "dark" ? "Light theme" : "Dark theme"}
        </button>
      </aside>

      <main className="workspace">
        {mutationError && <div className="mutation-error" role="alert">{mutationError}</div>}
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Utility</p>
            <h1>{activeTool.label}</h1>
            <p>{activeTool.description}</p>
          </div>
        </header>
        {activeToolID === "text-diff" ? (
          <section className="workspace-card tool-workspace" aria-label="Text Diff workspace">
            <TextDiffTool
              initialDraft={textDiffDraft}
              workspace={services.workspace}
              onMutationError={setMutationError}
              flushRef={textDiffFlushRef}
            />
          </section>
        ) : activeToolID === "base64-pdf" ? (
          <section className="workspace-card tool-workspace" aria-label="Base64 → PDF workspace">
            <Base64PdfTool files={services.files} />
          </section>
        ) : (
          <section className="workspace-card" aria-label={`${activeTool.label} workspace`}>
            <activeTool.icon size={30} stroke={1.6} aria-hidden="true" />
            <p>{activeTool.label} is ready for its migration layer.</p>
          </section>
        )}
      </main>

      {commandOpen && (
        <div className="command-backdrop" role="presentation" onMouseDown={() => setCommandOpen(false)}>
          <Command.Dialog
            open
            label="Find a tool"
            className="command-dialog"
            onOpenChange={setCommandOpen}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="command-input-row">
              <IconSearch size={18} aria-hidden="true" />
              <Command.Input autoFocus placeholder="Search tools…" />
            </div>
            <Command.List>
              <Command.Empty>No matching tools.</Command.Empty>
              {tools.map((tool) => (
                <Command.Item key={tool.id} value={tool.label} onSelect={() => void selectTool(tool.id)}>
                  <tool.icon size={18} aria-hidden="true" />
                  <span>{tool.label}</span>
                </Command.Item>
              ))}
            </Command.List>
          </Command.Dialog>
        </div>
      )}
    </div>
  );
}

export default App;
