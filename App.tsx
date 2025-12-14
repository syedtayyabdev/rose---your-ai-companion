import React from 'react';
import { ChatInterface } from './components/ChatInterface';

const App: React.FC = () => {
  return (
    <div className="h-screen w-screen bg-rose-50 font-sans overflow-hidden">
      <ChatInterface />
    </div>
  );
};

export default App;