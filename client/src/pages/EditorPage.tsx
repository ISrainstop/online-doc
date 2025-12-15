import React, { useEffect, useState } from 'react';
import Editor from '../components/Editor';

interface Props {
  documentId: string;
  token: string;
  onBackToList: () => void;
}

const EditorPage: React.FC<Props> = ({ documentId, token, onBackToList }) => {
  const [initialContent, setInitialContent] = useState<any>(null);
  const [meta, setMeta] = useState<{ title?: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setError('');
      try {
        const res = await fetch((import.meta.env.VITE_API_URL || '/api') + `/documents/${documentId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const body = await res.json();
        if (!res.ok) {
          setError(body?.error || '获取文档失败');
          return;
        }
        setInitialContent(body.content || null);
        setMeta({ title: body.title });
      } catch (err: any) {
        setError(err?.message || '网络错误');
      }
    })();
  }, [documentId, token]);

  return (
    <div className="editor-page">
      <header className="doc-header">
        <div>
          <div className="muted">当前文档</div>
          <strong>{meta?.title || documentId}</strong>
        </div>
        <button onClick={onBackToList}>返回列表</button>
      </header>
      {error && <div className="error-text">{error}</div>}
      <Editor documentId={documentId} initialContent={initialContent} token={token} />
    </div>
  );
};

export default EditorPage;
