import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import EditorPage from './pages/EditorPage';

type DocumentItem = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  createdById: string;
};

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function App() {
  const params = useParams();
  const navigate = useNavigate();

  type User = { id: string; username: string; email?: string | null };

  const [token, setToken] = useState(() => (typeof window !== 'undefined' ? localStorage.getItem('token') || '' : ''));
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loginName, setLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docError, setDocError] = useState('');
  const [newTitle, setNewTitle] = useState('');

  const isLoggedIn = useMemo(() => Boolean(token), [token]);

  useEffect(() => {
    if (isLoggedIn && !params.id) {
      void fetchDocuments();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, params.id]);

  const fetchDocuments = async () => {
    setLoadingDocs(true);
    setDocError('');
    try {
      const res = await fetch(`${API_BASE}/documents`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const body = await res.json();
      if (!res.ok) {
        setDocError(body?.error || '获取文档列表失败');
        return;
      }
      setDocuments(body || []);
    } catch (err: any) {
      setDocError(err?.message || '网络错误');
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginName.trim(), password: loginPassword })
      });
      const body = await res.json();
      if (!res.ok) {
        setLoginError(body?.error || '登录失败');
        return;
      }
      setToken(body.token);
      setUser(body.user);
      localStorage.setItem('token', body.token);
      localStorage.setItem('user', JSON.stringify(body.user));
      localStorage.setItem('username', body.user.username);
      setLoginPassword('');
      if (!params.id) {
        void fetchDocuments();
      }
    } catch (err: any) {
      setLoginError(err?.message || '网络错误');
    }
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
    setDocuments([]);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('username');
    navigate('/');
  };

  const handleBackToList = () => {
    navigate('/');
  };

  const handleCreate = async () => {
    const titleToUse = newTitle.trim() || '新文档';
    if (!newTitle.trim()) setNewTitle('新文档');
    try {
      const res = await fetch(`${API_BASE}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title: titleToUse })
      });
      const body = await res.json();
      if (!res.ok) {
        setDocError(body?.error || '创建失败');
        return;
      }
      setNewTitle('');
      navigate(`/documents/${body.id}`);
    } catch (err: any) {
      setDocError(err?.message || '网络错误');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('确定删除此文档？')) return;
    try {
      const res = await fetch(`${API_BASE}/documents/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDocError(body?.error || '删除失败');
        return;
      }
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err: any) {
      setDocError(err?.message || '网络错误');
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="auth-container">
        <h2>登录以继续</h2>
        <form onSubmit={handleLogin} className="auth-form">
          <input
            type="text"
            placeholder="用户名"
            value={loginName}
            onChange={(e) => setLoginName(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="密码"
            value={loginPassword}
            onChange={(e) => setLoginPassword(e.target.value)}
            required
          />
          <button type="submit">登录 / 注册</button>
        </form>
        {loginError && <div className="error-text">{loginError}</div>}
      </div>
    );
  }

  if (params.id) {
    return <EditorPage documentId={params.id!} token={token} onBackToList={handleBackToList} />;
  }

  return (
    <div className="doc-list-container">
      <header className="doc-list-header">
        <div>
          <div className="muted">当前用户</div>
          <strong>{user?.username}</strong>
        </div>
        <button onClick={handleLogout}>退出</button>
      </header>

      <section className="doc-create">
        <input
          type="text"
          placeholder="输入标题，创建新文档"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <button onClick={handleCreate}>创建</button>
      </section>

      <section className="doc-list">
        <div className="doc-list-title">我的文档</div>
        {loadingDocs && <div>加载中...</div>}
        {docError && <div className="error-text">{docError}</div>}
        {!loadingDocs && !documents.length && <div className="muted">暂无文档，先创建一个吧。</div>}
        {documents.map((d) => (
          <div key={d.id} className="doc-list-item">
            <div>
              <div className="doc-title">{d.title}</div>
              <div className="muted">更新于 {new Date(d.updatedAt).toLocaleString()}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => navigate(`/documents/${d.id}`)}>打开</button>
              <button onClick={() => handleDelete(d.id)} style={{ borderColor: '#ef4444', color: '#ef4444' }}>删除</button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
