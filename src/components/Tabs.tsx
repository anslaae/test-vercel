import { useState, type ReactNode } from 'react';
import '../styles.css';

export interface TabDefinition {
  id: string;
  label: string;
  icon: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: TabDefinition[];
}

export default function Tabs({ tabs }: TabsProps) {
  const [activeId, setActiveId] = useState(tabs[0]?.id);
  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  return (
    <div className="tabs-container">
      <div className="tabs-bar" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === activeTab?.id}
            className={`tabs-tab${tab.id === activeTab?.id ? ' tabs-tab-active' : ''}`}
            onClick={() => setActiveId(tab.id)}
          >
            <span className="tabs-tab-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
      <div className="tabs-panel" role="tabpanel">
        {activeTab?.content}
      </div>
    </div>
  );
}
