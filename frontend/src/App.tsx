import { useEffect, useMemo, useState } from "react";
import { IconCommand, IconMoon, IconSearch, IconSun } from "@tabler/icons-react";
import { Command } from "cmdk";

import { tools, type ToolID } from "./app/tools";

type Theme = "light" | "dark";

function initialTheme(): Theme {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function App() {
  const [activeToolID, setActiveToolID] = useState<ToolID>("text-diff");
  const [commandOpen, setCommandOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const activeTool = useMemo(
    () => tools.find((tool) => tool.id === activeToolID) ?? tools[0],
    [activeToolID],
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

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

  const selectTool = (id: ToolID) => {
    setActiveToolID(id);
    setCommandOpen(false);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
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
                onClick={() => selectTool(tool.id)}
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
          onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        >
          {theme === "dark" ? <IconSun size={17} /> : <IconMoon size={17} />}
          {theme === "dark" ? "Light theme" : "Dark theme"}
        </button>
      </aside>

      <main className="workspace">
        <header className="workspace-header">
          <div>
            <p className="eyebrow">Utility</p>
            <h1>{activeTool.label}</h1>
            <p>{activeTool.description}</p>
          </div>
        </header>
        <section className="workspace-card" aria-label={`${activeTool.label} workspace`}>
          <activeTool.icon size={30} stroke={1.6} aria-hidden="true" />
          <p>{activeTool.label} is ready for its migration layer.</p>
        </section>
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
                <Command.Item key={tool.id} value={tool.label} onSelect={() => selectTool(tool.id)}>
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
