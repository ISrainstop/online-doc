import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { EditorView } from '@tiptap/pm/view';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import Placeholder from '@tiptap/extension-placeholder';
import { useDebouncedCallback } from 'use-debounce';
import axios from 'axios';

// 图标库
import {
  Bold, Italic, Code, ListTodo, Image as ImageIcon, FileUp,
  Undo, Redo, Loader2, Wifi, WifiOff, History, RotateCcw, Save
} from 'lucide-react'; // 🔥 新增 History, RotateCcw, Save

// ... 扩展引入 (CodeBlockLowlight, FileAttachment 等保持不变) ...
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { lowlight } from 'lowlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import ImageResize from 'tiptap-extension-resize-image';
import { FileAttachment } from './FileAttachment';

interface Props {
  documentId: string;
  initialContent?: any;
  token?: string;
  permission?: 'VIEW' | 'EDIT' | 'OWNER';
}

// 定义版本类型
interface Version {
  id: string;
  createdAt: string;
  versionName?: string;
  creatorName?: string;
  content: any;
}

const Editor: React.FC<Props> = ({
  documentId,
  token: tokenProp,
  permission = 'EDIT'
}) => {
  const [status, setStatus] = useState('connecting');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [provider, setProvider] = useState<WebsocketProvider | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // 🔥 新增：历史相关状态
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const token = tokenProp || (typeof window !== 'undefined' ? localStorage.getItem('token') : undefined);
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:1234';
  const apiUrl = import.meta.env.VITE_API_URL || '/api';

  const localUser = useMemo(() => {
    const name = (typeof window !== 'undefined' && localStorage.getItem('username')) || 'Anonymous';
    const color = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    return { name, color };
  }, []);

  // ... uploadFile 函数保持不变 ...
  const uploadFile = useCallback(async (file: File): Promise<{ url: string, filename: string }> => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(`${apiUrl}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data', 'Authorization': `Bearer ${token}` }
      });
      return { url: res.data.url, filename: file.name };
    } catch (error) {
      console.error('Upload failed', error);
      alert('文件上传失败');
      throw error;
    } finally {
      setIsUploading(false);
    }
  }, [apiUrl, token]);

  // WebSocket 初始化 useEffect 保持不变
  useEffect(() => {
    if (!token) return;
    const ydoc = new Y.Doc();
    const newProvider = new WebsocketProvider(wsUrl, documentId, ydoc, { params: { token } });
    newProvider.on('status', (ev: any) => setStatus(ev.status));
    newProvider.on('connection-close', (event: any) => {
      if (event.code === 4401 || event.code === 4403) {
        setStatus('disconnected');
      }
    });
    newProvider.awareness.setLocalStateField('user', localUser);
    setProvider(newProvider);
    return () => { newProvider.disconnect(); ydoc.destroy(); };
  }, [documentId, wsUrl, token, localUser]);

  // 自动保存 (仅保存文本用于搜索，不作为版本)
  const autoSave = useDebouncedCallback(async (text: string) => {
    if (!token || permission === 'VIEW') return;
    try {
      await fetch(`${apiUrl}/documents/${documentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ contentText: text })
      });
      setLastSaved(new Date());
    } catch (e) { console.error(e) }
  }, 2000);

  // --- 🔥 新增：版本历史功能函数 ---

  // 1. 手动创建快照版本
  const createSnapshot = async () => {
    if (!editor || !token) return;
    const name = prompt('为当前版本起个名字（可选）：', '手动保存');
    if (name === null) return; // 取消
    
    try {
      await axios.post(`${apiUrl}/documents/${documentId}/versions`, {
        content: editor.getJSON(), // 获取当前完整 JSON
        versionName: name
      }, { headers: { Authorization: `Bearer ${token}` }});
      
      alert('版本保存成功！');
      if (showHistory) fetchVersions(); // 如果侧边栏开着，刷新列表
    } catch (e) {
      alert('保存版本失败');
    }
  };

  // 2. 获取版本列表
  const fetchVersions = async () => {
    if (!token) return;
    setLoadingVersions(true);
    try {
      const res = await axios.get(`${apiUrl}/documents/${documentId}/versions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVersions(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingVersions(false);
    }
  };

  // 3. 回档 (Restore)
  const handleRestore = (version: Version) => {
    if (!editor) return;
    if (!confirm(`确定要回退到版本 "${version.versionName || '未命名'}" 吗？\n当前未保存的内容将丢失。`)) return;

    // Tiptap 的核心魔法：setContent 会替换当前所有内容，并同步给其他 Yjs 客户端
    editor.commands.setContent(version.content);
    
    // 自动触发一次保存
    autoSave(editor.getText());
    alert('已回退到该版本');
    setShowHistory(false); // 关闭侧边栏
  };

  // ... handleFileInputChange, triggerUpload 等图片上传逻辑保持不变 ...
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTypeRef = useRef<'image' | 'file'>('image'); 
  const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
     // (此处代码保持原样，省略以节省篇幅，逻辑同上一版)
     const file = event.target.files?.[0];
     if (!file || !editor) return;
     event.target.value = '';
     try {
       const { url, filename } = await uploadFile(file);
       if (uploadTypeRef.current === 'image') {
         editor.chain().focus().setImage({ src: url }).run();
       } else {
         editor.chain().focus().setFileAttachment({ src: url, filename }).run();
       }
     } catch (e) {}
  };
  const triggerUpload = (type: 'image' | 'file') => {
    uploadTypeRef.current = type;
    fileInputRef.current?.setAttribute('accept', type === 'image' ? 'image/*' : '*/*');
    fileInputRef.current?.click();
  };

  // Tiptap 初始化
  const editor = useEditor({
    editable: permission !== 'VIEW',
    extensions: [
      StarterKit.configure({ history: false, codeBlock: false }),
      Placeholder.configure({ placeholder: '输入内容...' }),
      CodeBlockLowlight.configure({ lowlight }),
      TaskList, TaskItem.configure({ nested: true }),
      ImageResize.configure({ inline: true, allowBase64: true }),
      FileAttachment,
      ...(provider ? [
        Collaboration.configure({ document: provider.doc }),
        CollaborationCursor.configure({ provider, user: localUser })
      ] : [])
    ],
    editorProps: {
      handlePaste: (view: EditorView, event: ClipboardEvent, slice: any) => {
         // (粘贴图片逻辑保持原样，省略)
         const items = Array.from(event.clipboardData?.items || []);
         const imageItem = items.find(item => item.type.indexOf('image') === 0);
         if (imageItem) {
           event.preventDefault();
           const file = imageItem.getAsFile();
           if (file) {
             uploadFile(file).then(({ url }) => {
               const { schema } = view.state;
               const imageNode = schema.nodes.image.create({ src: url });
               const transaction = view.state.tr.replaceSelectionWith(imageNode);
               view.dispatch(transaction);
             });
           }
           return true;
         }
         return false;
      }
    },
    onUpdate: ({ editor }) => autoSave(editor.getText())
  }, [provider]);

  // 监听历史开关
  useEffect(() => {
    if (showHistory) {
      fetchVersions();
    }
  }, [showHistory]);

  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.setEditable(permission !== 'VIEW');
  }, [editor, permission]);

  if (!editor || !provider) return <div className="app-container" style={{ padding: 20 }}>连接中...</div>;
  const isEditMode = permission !== 'VIEW';

  return (
    <div className="app-container" style={{ position: 'relative' }}>
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileInputChange} />

      <div className="editor-toolbar">
        {/* 撤销/重做 */}
        <button className="btn" onClick={() => editor.chain().focus().undo().run()} disabled={!isEditMode} title="撤销"><Undo /></button>
        <button className="btn" onClick={() => editor.chain().focus().redo().run()} disabled={!isEditMode} title="重做"><Redo /></button>
        <div className="toolbar-divider" />
        
        {/* 基础格式 */}
        <button className={`btn ${editor.isActive('bold') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleBold().run()} disabled={!isEditMode}><Bold /></button>
        <button className={`btn ${editor.isActive('italic') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleItalic().run()} disabled={!isEditMode}><Italic /></button>
        <button className={`btn ${editor.isActive('codeBlock') ? 'is-active' : ''}`} onClick={() => editor.chain().focus().toggleCodeBlock().run()} disabled={!isEditMode}><Code /></button>
        
        {/* 上传 */}
        <div className="toolbar-divider" />
        <button className="btn" onClick={() => triggerUpload('image')} disabled={!isEditMode || isUploading}><ImageIcon /></button>
        <button className="btn" onClick={() => triggerUpload('file')} disabled={!isEditMode || isUploading}><FileUp /></button>

        {/* 🔥 新增：版本历史控制按钮 */}
        <div className="toolbar-divider" />
        <button className="btn" onClick={createSnapshot} disabled={!isEditMode} title="保存当前版本">
          <Save size={18} />
        </button>
        <button className={`btn ${showHistory ? 'is-active' : ''}`} onClick={() => setShowHistory(!showHistory)} title="历史记录">
          <History size={18} />
        </button>

        <div style={{ flex: 1 }} />
        
        {/* 状态 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
          {status === 'connected' ? <Wifi size={14} color="#10b981"/> : <WifiOff size={14} color="#ef4444"/>}
          {lastSaved && <span>{lastSaved.toLocaleTimeString()}</span>}
        </div>
      </div>

      <div className="editor-shell" onClick={() => editor?.commands.focus()}>
        <div className="editor-content prose" onClick={(e) => e.stopPropagation()}>
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* 🔥 新增：历史版本侧边栏 */}
      {showHistory && (
        <div className="history-sidebar">
          <div className="history-header">
            <h4>版本历史</h4>
            <button className="close-btn" onClick={() => setShowHistory(false)}>×</button>
          </div>
          <div className="history-list">
            {loadingVersions && <div style={{padding: 20, textAlign: 'center'}}>加载中...</div>}
            {!loadingVersions && versions.length === 0 && <div className="muted" style={{padding: 20}}>暂无历史版本</div>}
            
            {versions.map(v => (
              <div key={v.id} className="history-item">
                <div style={{ marginBottom: 4 }}>
                  <strong>{v.versionName || '未命名版本'}</strong>
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {new Date(v.createdAt).toLocaleString()}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  由 {v.creatorName || '未知'} 保存
                </div>
                
                {isEditMode && (
                  <button className="restore-btn" onClick={() => handleRestore(v)}>
                    <RotateCcw size={12} style={{marginRight: 4}}/> 
                    回退到此版本
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Editor;