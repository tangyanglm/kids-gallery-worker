import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleListGet } from '../src/api/list.js';

// 模拟 KV 存储
class MockKVStore {
  constructor() {
    this.data = {
      'artworks': JSON.stringify(['1', '2']),
      'books': JSON.stringify(['3']),
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
      'image:2': JSON.stringify({
        id: '2',
        title: '测试作品2',
        type: 'artwork',
        tags: ['animal'],
        description: '测试作品2描述',
        imageUrl: 'https://example.com/image2.jpg',
        uploadTime: Date.now() - 2000,
        views: 20
      }),
      'image:3': JSON.stringify({
        id: '3',
        title: '测试书籍1',
        type: 'book',
        tags: ['story', 'fantasy'],
        description: '测试书籍1描述',
        imageUrl: 'https://example.com/book1.jpg',
        uploadTime: Date.now() - 3000,
        views: 30
      })
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
    request.json = async () => body;
  }

  return request;
}

// 模拟上下文
function createMockContext(request) {
  const kvStore = new MockKVStore();

  return {
    req: {
      raw: request,
      url: request.url
    },
    env: {
      KV_STORE: kvStore
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

describe('列表功能测试', () => {
  it('应该能够获取所有类型的列表', async () => {
    const request = createMockRequest('GET', 'http://localhost:8787/api/list');
    const context = createMockContext(request);
    const response = await handleListGet(context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.length).toBe(3);
  });

  it('应该能够按类型获取列表', async () => {
    const request = createMockRequest('GET', 'http://localhost:8787/api/list?type=artwork');
    const context = createMockContext(request);
    const response = await handleListGet(context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.length).toBe(2);
    expect(data.data.every(item => item.type === 'artwork')).toBe(true);
  });

  it('应该能够按标签筛选列表', async () => {
    const request = createMockRequest('GET', 'http://localhost:8787/api/list?tag=animal');
    const context = createMockContext(request);
    const response = await handleListGet(context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.length).toBe(1);
    expect(data.data[0].tags.includes('animal')).toBe(true);
  });

  it('应该能够按搜索词筛选列表', async () => {
    const request = createMockRequest('GET', 'http://localhost:8787/api/list?search=测试作品');
    const context = createMockContext(request);
    const response = await handleListGet(context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.length).toBe(2);
    expect(data.data.every(item => item.title.includes('测试作品'))).toBe(true);
  });
});
