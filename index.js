import { useState, useEffect, useRef } from 'react';

// Base URL for the backend server.  You can override this at build time by
// defining NEXT_PUBLIC_SERVER_URL in your environment.  When deployed on
// Vercel, set NEXT_PUBLIC_SERVER_URL=https://firelinebridge.duckdns.org
const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || '';

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [code, setCode] = useState('');
  const [codeLanguage, setCodeLanguage] = useState('python');
  const [llmPrompt, setLlmPrompt] = useState('');
  const [llmProvider, setLlmProvider] = useState('groq');
  const [llmMode, setLlmMode] = useState('respond');
  const [useAi, setUseAi] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    // Connect to WebSocket only once
    const url = SERVER_URL.replace(/^http/, 'ws') + '/ws';
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => {
      console.log('WebSocket connected');
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setMessages((prev) => [...prev, { sender: 'system', text: JSON.stringify(data) }]);
      } catch (e) {
        console.error('WS message parse error', e);
      }
    };
    ws.onerror = (err) => {
      console.error('WebSocket error', err);
    };
    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };
    return () => {
      ws.close();
    };
  }, []);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    // Append user's message
    setMessages((prev) => [...prev, { sender: 'you', text }]);
    setInput('');
    try {
      const res = await fetch(`${SERVER_URL}/api/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      const reply = data.reply || data.error || 'No reply';
      setMessages((prev) => [...prev, { sender: 'vox', text: reply }]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { sender: 'system', text: 'Error sending message' }]);
    }
  };

  const evalCode = async () => {
    const codeText = code.trim();
    if (!codeText) return;
    try {
      const res = await fetch(`${SERVER_URL}/api/eval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeText, language: codeLanguage }),
      });
      const data = await res.json();
      const reply = data.reply || data.error || 'No reply';
      setMessages((prev) => [...prev, { sender: 'system', text: `Eval result: ${reply}` }]);
      setCode('');
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { sender: 'system', text: 'Error evaluating code' }]);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sendLlmQuery = async () => {
    const prompt = llmPrompt.trim();
    if (!prompt) return;
    setMessages((prev) => [...prev, { sender: 'you', text: `[LLM ${llmProvider}] ${prompt}` }]);
    setLlmPrompt('');
    try {
      const res = await fetch(`${SERVER_URL}/api/llm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, provider: llmProvider, mode: llmMode, use_ai: useAi }),
      });
      const data = await res.json();
      const reply = data.reply || data.error || 'No reply';
      setMessages((prev) => [...prev, { sender: 'system', text: `LLM reply: ${reply}` }]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { sender: 'system', text: 'Error calling LLM' }]);
    }
  };

  const runTests = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/api/test`, { method: 'POST' });
      const data = await res.json();
      const reply = data.reply || data.error || 'No reply';
      setMessages((prev) => [...prev, { sender: 'system', text: `Test report: ${reply}` }]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { sender: 'system', text: 'Error running tests' }]);
    }
  };

  const exportCode = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/api/export_code`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
      const data = await res.json();
      const reply = data.reply || data.error || 'No reply';
      setMessages((prev) => [...prev, { sender: 'system', text: reply }]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { sender: 'system', text: 'Error exporting code' }]);
    }
  };

  const generateDocs = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/api/doc`, { method: 'POST' });
      const data = await res.json();
      const reply = data.reply || data.error || 'No reply';
      setMessages((prev) => [...prev, { sender: 'system', text: `Documentation:\n${reply}` }]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { sender: 'system', text: 'Error generating docs' }]);
    }
  };

  return (
    <div className="container">
      <h1>Vox Chat</h1>
      <div className="chat-window">
        {messages.map((m, idx) => (
          <div key={idx} className={`message ${m.sender === 'you' ? 'user' : m.sender === 'vox' ? 'ai' : ''}`}>
            <strong>{m.sender}:</strong> {m.text}
          </div>
        ))}
      </div>
      <div className="input-group">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          rows={2}
          placeholder="Type your message..."
        />
        <button onClick={sendMessage} disabled={!input.trim()}>Send</button>
      </div>
      <h2>Evaluate Code</h2>
      <div className="input-group">
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          rows={2}
          placeholder="Enter code snippet..."
        />
        <select value={codeLanguage} onChange={(e) => setCodeLanguage(e.target.value)}>
          <option value="python">Python</option>
          <option value="javascript">JavaScript</option>
        </select>
        <button onClick={evalCode} disabled={!code.trim()}>Run</button>
      </div>

      <h2>LLM Query</h2>
      <div className="input-group">
        <textarea
          value={llmPrompt}
          onChange={(e) => setLlmPrompt(e.target.value)}
          rows={2}
          placeholder="Enter LLM prompt..."
        />
        <select value={llmProvider} onChange={(e) => setLlmProvider(e.target.value)}>
          <option value="groq">Groq</option>
          <option value="claude">Claude</option>
          <option value="openai">OpenAI</option>
          <option value="openrouter">OpenRouter</option>
          <option value="gemini">Gemini</option>
        </select>
        <select value={llmMode} onChange={(e) => setLlmMode(e.target.value)}>
          <option value="respond">Respond</option>
          <option value="learn">Learn</option>
          <option value="disagree">Disagree</option>
          <option value="critic">Critic</option>
        </select>
        <label>
          Use AI
          <input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} />
        </label>
        <button onClick={sendLlmQuery} disabled={!llmPrompt.trim()}>Send</button>
      </div>

      <h2>Developer Tools</h2>
      <div className="input-group">
        <button onClick={runTests}>Run Tests</button>
        <button onClick={exportCode}>Export Code</button>
        <button onClick={generateDocs}>Generate Docs</button>
      </div>
    </div>
  );
}