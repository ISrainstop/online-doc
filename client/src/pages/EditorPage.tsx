import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Editor from '../components/Editor';
import classNames from 'classnames';

// 图标
import { Users, UserPlus, Trash2, ArrowLeft, Share2 } from 'lucide-react';
interface EditorPageProps {
  documentId: string;
  token: string;
  onBackToList: () => void;
}
interface Collaborator {
  id: string;
  userId: string;
  permission: 'OWNER' | 'EDIT' | 'VIEW';
  user?: {
    username: string;
    email: string;
  };
}

interface DocumentData {
  id: string;
  title: string;
  content: any;
  collaborators: Collaborator[];
  permission: 'OWNER' | 'EDIT' | 'VIEW'; 
}

const EditorPage: React.FC<EditorPageProps> = ({ documentId, onBackToList }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [document, setDocument] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // 弹窗状态
  const [showShareModal, setShowShareModal] = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');
  const [invitePermission, setInvitePermission] = useState<'VIEW' | 'EDIT'>('VIEW');

  const token = localStorage.getItem('token');
  const apiUrl = import.meta.env.VITE_API_URL || '/api';

  // 获取文档详情
  const fetchDocument = async () => {
    try {
      const res = await axios.get(`${apiUrl}/documents/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocument(res.data);
    } catch (err: any) {
      console.error(err);
      if (err.response?.status === 403) {
        setError('您没有权限访问此文档');
      } else if (err.response?.status === 404) {
        setError('文档不存在');
      } else {
        setError('加载失败');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchDocument();
  }, [id, token, navigate]);

  // 邀请协作者
  const handleInvite = async () => {
    if (!inviteUsername.trim()) return;
    try {
      const res = await axios.post(`${apiUrl}/documents/${id}/collaborators`, {
        targetUsername: inviteUsername,
        permission: invitePermission
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      setDocument(prev => prev ? {
        ...prev,
        collaborators: [...prev.collaborators, res.data]
      } : null);
      setInviteUsername('');
      alert('邀请成功');
    } catch (err: any) {
      alert(err.response?.data?.error || '邀请失败，请检查用户名');
    }
  };

  // 移除协作者
  const handleRemove = async (userId: string) => {
    if (!confirm('确定要移除该协作者吗？')) return;
    try {
      await axios.delete(`${apiUrl}/documents/${id}/collaborators`, {
        data: { userId }, 
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocument(prev => prev ? {
        ...prev,
        collaborators: prev.collaborators.filter(c => c.userId !== userId)
      } : null);
    } catch (err) {
      alert('移除失败');
    }
  };

  if (loading) return <div style={{padding: 40, textAlign: 'center', color: '#666'}}>加载文档中...</div>;
  if (error) return <div style={{padding: 40, textAlign: 'center', color: 'var(--danger-color)'}}>{error} <br/> <button className="btn" onClick={() => navigate('/')} style={{marginTop: 10}}>返回首页</button></div>;
  if (!document) return null;

  return (
    <div className="app-container">
      {/* 1. 顶部 Header (对应 CSS Section 5 .doc-header) */}
      <header className="doc-header">
        {/* 左侧：返回按钮 + 标题 + 权限徽章 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button onClick={() => navigate('/')} className="btn-icon" title="返回列表">
            <ArrowLeft size={20} />
          </button>
          
          <h1 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>{document.title}</h1>
          
          <span className="badge" style={{ 
            backgroundColor: document.permission === 'OWNER' ? '#ecfdf5' : '#eff6ff',
            color: document.permission === 'OWNER' ? '#047857' : '#1d4ed8'
          }}>
            {document.permission === 'OWNER' ? '所有者' : document.permission === 'EDIT' ? '可编辑' : '只读'}
          </span>
        </div>

        {/* 右侧：头像组 + 分享按钮 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {/* 头像列表 (使用 CSS Section 4 .avatar-circle 复用样式) */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
                {document.collaborators.slice(0, 3).map((c) => (
                    <div 
                        key={c.userId} 
                        className="avatar-circle" 
                        title={c.user?.username}
                        style={{ width: '32px', height: '32px', fontSize: '12px', border: '2px solid white', marginLeft: '-8px' }}
                    >
                        {c.user?.username?.substring(0, 2).toUpperCase() || 'U'}
                    </div>
                ))}
                {document.collaborators.length > 3 && (
                    <div className="avatar-circle" style={{ width: '32px', height: '32px', fontSize: '12px', border: '2px solid white', marginLeft: '-8px', background: '#e5e7eb', color: '#666' }}>
                        +{document.collaborators.length - 3}
                    </div>
                )}
            </div>

            {/* 分享按钮 (仅 Owner 可见) */}
            {document.permission === 'OWNER' && (
                <button 
                    onClick={() => setShowShareModal(true)}
                    className="btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                    <Share2 size={16} />
                    分享
                </button>
            )}
        </div>
      </header>

      {/* 2. 编辑器主体 (无需修改容器，Editor 组件内部会处理 toolbar 和 content) */}
      <Editor 
        documentId={id!} 
        token={token!}
        permission={document.permission}
        initialContent={document.content}
      />

      {/* 3. 分享管理弹窗 (对应 CSS Section 7 .modal-*) */}
      {showShareModal && (
        <div className="modal-overlay" onClick={() => setShowShareModal(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                
                {/* 弹窗标题 */}
                <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    <Users size={20}/> 协作管理
                </h3>

                {/* 邀请区域 */}
                <div className="modal-section">
                    <h4>邀请新成员</h4>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <input 
                            type="text" 
                            className="input-field"
                            placeholder="输入用户名..."
                            value={inviteUsername}
                            onChange={e => setInviteUsername(e.target.value)}
                        />
                        <select 
                            className="input-field"
                            style={{ width: 'auto' }}
                            value={invitePermission}
                            onChange={e => setInvitePermission(e.target.value as any)}
                        >
                            <option value="VIEW">只读</option>
                            <option value="EDIT">编辑</option>
                        </select>
                        <button onClick={handleInvite} className="btn-primary" style={{ padding: '8px 12px' }}>
                            <UserPlus size={18} />
                        </button>
                    </div>
                </div>

                {/* 成员列表 */}
                <div>
                    <h4>当前成员 ({document.collaborators.length})</h4>
                    <ul className="user-list">
                        {document.collaborators.map(c => (
                            <li key={c.userId} className="user-list-item">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div className="avatar-circle" style={{ width: '32px', height: '32px', fontSize: '12px' }}>
                                        {c.user?.username?.slice(0, 1).toUpperCase() || '?'}
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '14px', fontWeight: 500 }}>
                                            {c.user?.username || '未知用户'}
                                        </div>
                                        <div className="muted" style={{ fontSize: '12px' }}>
                                            {c.permission === 'OWNER' ? '所有者' : c.permission === 'EDIT' ? '可编辑' : '只读'}
                                        </div>
                                    </div>
                                </div>
                                
                                {c.permission !== 'OWNER' && (
                                    <button 
                                        onClick={() => handleRemove(c.userId)}
                                        className="remove-link"
                                        title="移除权限"
                                    >
                                        移除
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>

                <button onClick={() => setShowShareModal(false)} className="close-modal-btn">
                    关闭
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default EditorPage;