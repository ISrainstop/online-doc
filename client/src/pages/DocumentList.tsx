import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles.css'; // 复用样式

interface DocumentItem {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  createdById: string;
}

interface Props {
  token: string;
  onLogout: () => void;
}

const DocumentList: React.FC<Props> = ({ token, onLogout }) => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newTitle, setNewTitle] = useState('');
  
  // 获取当前用户名用于展示
  const username = localStorage.getItem('username') || '用户';
  const apiUrl = import.meta.env.VITE_API_URL || '/api';

  // 获取文档列表
  const fetchDocuments = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiUrl}/documents`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || '获取文档列表失败');
      }
      setDocuments(body || []);
    } catch (err: any) {
      setError(err?.message || '网络错误');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 创建新文档
  const handleCreate = async () => {
    const titleToUse = newTitle.trim() || '未命名文档';
    try {
      const res = await fetch(`${apiUrl}/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title: titleToUse })
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || '创建失败');
      }
      // 创建成功后，直接跳转到编辑器
      navigate(`/doc/${body.id}`); 
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 删除文档
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 防止触发点击行进入文档的事件
    if (!window.confirm('确定要删除这个文档吗？')) return;

    try {
      const res = await fetch(`${apiUrl}/documents/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('删除失败');
      
      // 成功后从本地状态移除，避免重新刷新页面
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      alert('删除失败，可能没有权限');
    }
  };

  return (
    <div className="doc-list-container">
      {/* 顶部导航栏 */}
      <header className="doc-list-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="avatar-circle">{username.charAt(0).toUpperCase()}</div>
          <div>
            <div className="muted" style={{ fontSize: '12px' }}>欢迎回来</div>
            <strong>{username}</strong>
          </div>
        </div>
        <button onClick={onLogout} className="btn-outline">退出登录</button>
      </header>

      {/* 创建区域 */}
      <section className="doc-create-section">
        <div className="card">
          <h3>新建文档</h3>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <input
              type="text"
              placeholder="输入文档标题..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              style={{ flex: 1, padding: '10px' }}
            />
            <button onClick={handleCreate} className="btn-primary">
              + 创建
            </button>
          </div>
        </div>
      </section>

      {/* 列表区域 */}
      <section className="doc-list-section">
        <div className="section-title">我的文档</div>
        
        {loading && <div className="loading">加载中...</div>}
        {error && <div className="error-text">{error}</div>}
        
        {!loading && documents.length === 0 && !error && (
          <div className="empty-state">
            暂无文档，试着创建一个吧！
          </div>
        )}

        <div className="doc-grid">
          {documents.map((d) => (
            <div 
              key={d.id} 
              className="doc-card"
              onClick={() => navigate(`/doc/${d.id}`)} // 点击卡片跳转
            >
              <div className="doc-card-icon">📄</div>
              <div className="doc-card-content">
                <div className="doc-title">{d.title}</div>
                <div className="doc-meta">
                  更新于 {new Date(d.updatedAt).toLocaleDateString()}
                </div>
              </div>
              <button 
                className="delete-btn"
                onClick={(e) => handleDelete(d.id, e)}
                title="删除文档"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default DocumentList;