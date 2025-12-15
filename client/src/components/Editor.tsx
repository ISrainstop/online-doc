import React, { useEffect, useMemo, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import Placeholder from '@tiptap/extension-placeholder';

interface Props {
  documentId: string;
  initialContent?: any;
  token?: string;
}

const Editor: React.FC<Props> = ({ documentId, initialContent, token: tokenProp }) => {
  const [status, setStatus] = useState('connecting');

  // Create Y.Doc and provider once per documentId
  const ydoc = useMemo(() => new Y.Doc(), [documentId]);

  const token = tokenProp || (typeof window !== 'undefined' ? localStorage.getItem('token') : undefined);
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:1234';

  // create a stable local user for awareness and cursor display
  const localUser = useMemo(() => {
    const name = (typeof window !== 'undefined' && localStorage.getItem('username')) || 'Anonymous';
    const color = '#'+Math.floor(Math.random()*16777215).toString(16);
    const id = `${Date.now()}-${Math.floor(Math.random()*10000)}`;
    return { name, color, id };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  const provider = useMemo(() => {
    const options = token ? { params: { token } } : undefined;
    const p = options ? new WebsocketProvider(wsUrl, documentId, ydoc, options) : new WebsocketProvider(wsUrl, documentId, ydoc);
    p.on('status', (ev: any) => setStatus(ev.status || 'unknown'));
    // set a default local user for awareness; include id so cursors are stable
    try {
      p.awareness.setLocalStateField('user', { name: localUser.name, color: localUser.color, id: localUser.id });
    } catch (e) {
      // ignore
    }
    return p;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, wsUrl, token, localUser]);

  // If initialContent is provided and doc empty, populate Y.Text
  useEffect(() => {
    try {
      const ytext = ydoc.getText('content');
      if (initialContent && ytext.length === 0) {
        ytext.insert(0, typeof initialContent === 'string' ? initialContent : JSON.stringify(initialContent));
      }
    } catch (e) {
      // ignore
    }
  }, [initialContent, ydoc]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Collaboration.configure({ document: ydoc }),
      CollaborationCursor.configure({
        provider,
        user: { name: localUser.name, color: localUser.color, id: localUser.id } as any,
        render: (user: any) => {
          // create a minimal, predictable DOM structure for the cursor
          const wrapper = document.createElement('span');
          wrapper.className = 'collaboration-cursor';

          const caret = document.createElement('span');
          caret.className = 'collaboration-cursor__caret';
          // apply color inline so CSS can be generic
          caret.style.background = user.color || '#4f46e5';
          caret.style.width = '2px';
          caret.style.minHeight = '1.2em';
          caret.style.display = 'block';

          const label = document.createElement('div');
          label.className = 'collaboration-cursor__label';
          label.textContent = user.name || 'Anonymous';
          label.style.background = user.color || '#4f46e5';
          label.style.color = '#fff';
          label.style.pointerEvents = 'none';

          wrapper.appendChild(caret);
          wrapper.appendChild(label);
          return wrapper;
        }
      }),
      Placeholder.configure({ placeholder: 'Start typing your document...'}),
    ],
    content: ''
  });

  // cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        provider.disconnect();
      } catch (e) {}
      try {
        ydoc.destroy();
      } catch (e) {}
      try {
        editor?.destroy();
      } catch (e) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  return (
    <div className="app-container">
      <div className="editor-shell">
        <div className="editor-toolbar">
          <button className={`btn ${editor?.isActive('bold') ? 'active' : ''}`} onClick={() => editor?.chain().focus().toggleBold().run()} title="Bold"><strong>B</strong></button>
          <button className={`btn ${editor?.isActive('italic') ? 'active' : ''}`} onClick={() => editor?.chain().focus().toggleItalic().run()} title="Italic"><em>I</em></button>
          <button className={`btn ${editor?.isActive('heading', { level: 1 }) ? 'active' : ''}`} onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()} title="H1">H1</button>
          <button className={`btn ${editor?.isActive('heading', { level: 2 }) ? 'active' : ''}`} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} title="H2">H2</button>
          <button className={`btn ${editor?.isActive('bulletList') ? 'active' : ''}`} onClick={() => editor?.chain().focus().toggleBulletList().run()} title="Bullet list">• List</button>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={async () => {
            try {
              // simple save: extract plain text
              const content = editor?.getText() || '';
              const headers: Record<string, string> = { 'Content-Type': 'application/json' };
              if (token) headers.Authorization = `Bearer ${token}`;
              await fetch((import.meta.env.VITE_API_URL || '/api') + `/documents/${documentId}`, { method: 'PUT', headers, body: JSON.stringify({ contentText: content }) });
              alert('Saved');
            } catch (e) { alert('Save failed'); }
          }} title="Save">Save</button>
        </div>

        <div className="editor-content prose">
          <div style={{ marginBottom: 8 }}><strong>Document:</strong> {documentId} — <span style={{ color: '#6b7280' }}>{status}</span></div>
          {editor ? <EditorContent editor={editor} /> : <div>Loading editor...</div>}
        </div>

        <div className="status-line">Collaborative editing — changes sync in real time</div>
      </div>
    </div>
  );
};

export default Editor;
