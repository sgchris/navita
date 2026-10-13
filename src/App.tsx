export default function App() {
  return (
    <div className="app">
      <div className="sidebar-col">
        <div className="sidebar-col__drag" data-tauri-drag-region />
        <div className="sidebar" />
      </div>
      <div className="content-col">
        <div className="toolbar" data-tauri-drag-region>
          <span className="toolbar__title" data-tauri-drag-region>
            Navita
          </span>
        </div>
        <div className="content" />
        <div className="path-bar" />
        <div className="status-bar" />
      </div>
    </div>
  );
}
