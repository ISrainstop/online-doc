import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles.css'; // 复用你的样式

interface Props {
  onLoginSuccess: (token: string, username: string) => void;
}

const AuthPage: React.FC<Props> = ({ onLoginSuccess }) => {
  // true = 登录模式, false = 注册模式
  const [isLoginMode, setIsLoginMode] = useState(true);
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState(''); // 注册时可选
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const apiUrl = import.meta.env.VITE_API_URL || '/api';
    // 根据模式决定请求 endpoint
    const endpoint = isLoginMode ? '/auth/login' : '/auth/register';

    try {
      const payload: any = { username, password };
      // 只有注册模式且填了邮箱才发送 email
      if (!isLoginMode && email) {
        payload.email = email;
      }

      const res = await axios.post(`${apiUrl}${endpoint}`, payload);
      
      const { token, user } = res.data;
      
      // 登录/注册成功逻辑一致
      if (token) {
        onLoginSuccess(token, user.username);
        navigate('/'); // 跳转回首页
      }
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.error || '请求失败，请检查网络';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container" style={{ display: 'flex', justifyContent: 'center', marginTop: '100px' }}>
      <div className="card" style={{ width: '350px', padding: '2rem', border: '1px solid #eee', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          {isLoginMode ? '欢迎回来' : '注册新账号'}
        </h2>
        
        {error && (
          <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px', borderRadius: '4px', marginBottom: '15px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>用户名</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              placeholder="请输入用户名"
            />
          </div>

          {!isLoginMode && (
             <div style={{ marginBottom: '1rem' }}>
             <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>邮箱 (可选)</label>
             <input
               type="email"
               value={email}
               onChange={(e) => setEmail(e.target.value)}
               style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
               placeholder="user@example.com"
             />
           </div>
          )}

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>密码</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              placeholder="请输入密码"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="btn-primary"
            style={{ width: '100%', padding: '10px', borderRadius: '4px', background: '#2563eb', color: 'white', border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? '处理中...' : (isLoginMode ? '登录' : '立即注册')}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '14px', color: '#666' }}>
          {isLoginMode ? '还没有账号？' : '已有账号？'}
          <span 
            onClick={() => {
              setIsLoginMode(!isLoginMode);
              setError('');
            }}
            style={{ color: '#2563eb', cursor: 'pointer', marginLeft: '5px', fontWeight: 'bold' }}
          >
            {isLoginMode ? '去注册' : '去登录'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;