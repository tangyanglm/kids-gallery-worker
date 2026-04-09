import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleUploadPost } from '../src/api/upload.js';
import { handleDeletePost } from '../src/api/delete.js';
import { handleUpdatePost } from '../src/api/update.js';
import { handleTagsGet, handleTagsPost } from '../src/api/tags.js';

// 模拟 KV 存储
class MockKVStore {
  constructor() {
    this.data = {
      'artworks': JSON.stringify(['1']),
      'books': JSON.stringify([]),
      'image:1': JSON.stringify({
        id: '1',
        title: '测试作品1',
        type: 'artwork',
        tags: ['landscape', 'nature'],
        description: '测试作品1描述',
        imageUrl: 'https://example.com/image1.jpg',
        uploadTime: Date.now() - 1000,
        views: 10
      }),
      'artwork_tags': JSON.stringify([
        { id: 'landscape', name: '风景', color: 'bg-sky-blue' },
        { id: 'animal', name: '动物', color: 'bg-coral-orange' }
      ]),
      'book_tags': JSON.stringify([
        { id: 'story', name: '故事', color: 'bg-candy-pink' },
        { id: 'fantasy', name: '幻想', color: 'bg-grape-purple' }
      ])
    };
  }

  async get(key) {
    return this.data[key] || null;
  }

  async put(key, value, options) {
    this.data[key] = value;
  }

  async delete(key) {
    delete this.data[key];
  }
}

// 模拟 R2 存储
class MockR2Bucket {
  async put(key, value, options) {
    // 模拟存储
  }

  async delete(key) {
    // 模拟删除
  }
}

// 模拟 FormData
class MockFormData {
  constructor(data) {
    this.data = data;
  }

  get(key) {
    return this.data[key];
  }
}

// 模拟文件
class MockFile {
  constructor(name, content, type) {
    this.name = name;
    this.type = type;
    this.content = content;
  }

  async arrayBuffer() {
    return new ArrayBuffer(this.content.length);
  }
}

// 模拟请求
function createMockRequest(method, url, body = null, headers = {}) {
  const request = new Request(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    }
  });

  if (body) {
    if (body instanceof MockFormData) {
      request.formData = async () => body;
    } else {
      request.json = async () => body;
    }
  }

  return request;
}

// 模拟上下文
function createMockContext(request) {
  const kvStore = new MockKVStore();
  const r2Bucket = new MockR2Bucket();

  return {
    req: {
      raw: request,
      url: request.url
    },
    env: {
      KV_STORE: kvStore,
      R2_BUCKET: r2Bucket
    },
    header: (name, value) => {
      // 模拟设置头部
    },
    json: (data, status) => {
      return new Response(JSON.stringify(data), {
        status: status || 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  };
}

describe('CRUD 功能测试', () => {
  it('应该能够上传图片', async () => {
    const formData = new MockFormData({
      file: new MockFile('test.jpg', 'test content', 'image/jpeg'),
      title: '新测试作品',
      description: '新测试作品描述',
      tags: JSON.stringify(['landscape', 'nature']),
      type: 'artwork'
    });

    const request = createMockRequest('POST', 'http://localhost:8787/api/upload', formData, {
      'Content-Type': 'multipart/form-data'
    });

    const context = createMockContext(request);
    const response = await handleUploadPost(context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.id).toBeDefined();
    expect(data.data.title).toBe('新测试作品');
  });

  it('应该能够删除图片', async () => {
    const request = createMockRequest('POST', 'http://localhost:8787/api/delete', {
      id: '1',
      type: 'artwork'
    });

    const context = createMockContext(request);
    const response = await handleDeletePost(context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('应该能够更新图片信息', async () => {
    const request = createMockRequest('POST', 'http://localhost:8787/api/update', {
      id: '1',
      title: '更新后的测试作品',
      description: '更新后的测试作品描述',
      tags: ['landscape', 'nature', 'animal']
    });

    const context = createMockContext(request);
    const response = await handleUpdatePost(context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.title).toBe('更新后的测试作品');
    expect(data.data.description).toBe('更新后的测试作品描述');
    expect(data.data.tags).toContain('animal');
  });

  it('应该能够获取标签列表', async () => {
    const request = createMockRequest('GET', 'http://localhost:8787/api/tags?type=artwork');
    const context = createMockContext(request);
    const response = await handleTagsGet(context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.length).toBe(2);
  });

  it('应该能够添加标签', async () => {
    const request = createMockRequest('POST', 'http://localhost:8787/api/tags', {
      action: 'add',
      type: 'artwork',
      tag: {
        name: '抽象',
        color: 'bg-ocean-blue'
      }
    });

    const context = createMockContext(request);
    const response = await handleTagsPost(context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.name).toBe('抽象');
  });

  it('应该能够更新标签', async () => {
    const request = createMockRequest('POST', 'http://localhost:8787/api/tags', {
      action: 'update',
      type: 'artwork',
      tag: {
        id: 'landscape',
        name: '风景画',
        color: 'bg-sky-blue'
      }
    });

    const context = createMockContext(request);
    const response = await handleTagsPost(context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.name).toBe('风景画');
  });

  it('应该能够删除标签', async () => {
    const request = createMockRequest('POST', 'http://localhost:8787/api/tags', {
      action: 'delete',
      type: 'artwork',
      tag: {
        id: 'animal'
      }
    });

    const context = createMockContext(request);
    const response = await handleTagsPost(context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
