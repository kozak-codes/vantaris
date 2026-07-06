import { FunctionalComponent } from 'preact';
import { ChatPanel } from './ChatPanel';
import { TopBar } from './TopBar';
import { WindowManager } from './WindowManager';

export const App: FunctionalComponent = () => {
  return (
    <>
      <TopBar />
      <WindowManager />
      <ChatPanel />
    </>
  );
};