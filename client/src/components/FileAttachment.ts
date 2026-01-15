// aaaaa/client/src/components/FileAttachment.ts
import { Node, mergeAttributes } from '@tiptap/core';

export interface FileAttachmentOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fileAttachment: {
      /**
       * Set a file attachment node
       */
      setFileAttachment: (options: { src: string; filename: string }) => ReturnType;
    };
  }
}

export const FileAttachment = Node.create<FileAttachmentOptions>({
  name: 'fileAttachment',

  group: 'block', // 作为一个独立的块级元素存在

  atom: true, // 原子节点，不可再分

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      src: {
        default: null,
      },
      filename: {
        default: 'Unnamed File',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'a[data-type="file-attachment"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    // 渲染为一个带有下载属性的链接
    return [
      'a',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'file-attachment',
        href: node.attrs.src,
        target: '_blank', // 新窗口打开
        download: node.attrs.filename, // 触发下载
        class: 'file-attachment-link', // 用于添加 CSS 样式
      }),
      ['span', { class: 'file-icon' }, '📄 '], // 图标
      ['span', { class: 'file-name' }, node.attrs.filename], // 文件名
    ];
  },

  addCommands() {
    return {
      setFileAttachment:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },
});