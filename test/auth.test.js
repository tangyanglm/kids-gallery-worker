import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { handleAuthPost, handleAuthGet } from '../src/api/auth.js';

// 模拟 KV 存储
class MockKVStore {
  constructor() {
    this.data = {};
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
  const r2Bucket = new MockR2Bucket();

  return {
    req: {
      raw: request
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
    },
    text: (data, status) => {
      return new Response(data, {
        status: status || 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }
  };
}

describe('认证功能测试', () => {
  let kvStore;

  beforeEach(() => {
    kvStore = new MockKVStore();
  });

  afterEach(() => {
    kvStore.data = {};
  });

  // 模拟上下文，使用同一个 kvStore 实例
  function createMockContextWithKV(request, kvStore) {
    const r2Bucket = new MockR2Bucket();

    return {
      req: {
        raw: request
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
      },
      text: (data, status) => {
        return new Response(data, {
          status: status || 200,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    };
  }

  it('应该能够成功登录', async () => {
    const request = createMockRequest('POST', 'http://localhost:8787/api/auth', {
      action: 'login',
      password: 'yiyi2024'
    });

    const context = createMockContextWithKV(request, kvStore);
    const response = await handleAuthPost(context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.token).toBeDefined();
    expect(data.expiresAt).toBeDefined();
  });

  it('应该能够验证登录状态', async () => {
    // 先登录获取 token
    const loginRequest = createMockRequest('POST', 'http://localhost:8787/api/auth', {
      action: 'login',
      password: 'yiyi2024'
    });

    const loginContext = createMockContextWithKV(loginRequest, kvStore);
    const loginResponse = await handleAuthPost(loginContext);
    const loginData = await loginResponse.json();
    const token = loginData.token;

    // 验证登录状态
    const verifyRequest = createMockRequest('POST', 'http://localhost:8787/api/auth', {
      action: 'verify'
    }, {
      'Authorization': `Bearer ${token}`
    });

    const verifyContext = createMockContextWithKV(verifyRequest, kvStore);
    const verifyResponse = await handleAuthPost(verifyContext);
    const verifyData = await verifyResponse.json();

    expect(verifyResponse.status).toBe(200);
    expect(verifyData.valid).toBe(true);
  });

  it('应该能够登出', async () => {
    // 先登录获取 token
    const loginRequest = createMockRequest('POST', 'http://localhost:8787/api/auth', {
      action: 'login',
      password: 'yiyi2024'
    });

    const loginContext = createMockContextWithKV(loginRequest, kvStore);
    const loginResponse = await handleAuthPost(loginContext);
    const loginData = await loginResponse.json();
    const token = loginData.token;

    // 登出
    const logoutRequest = createMockRequest('POST', 'http://localhost:8787/api/auth', {
      action: 'logout'
    }, {
      'Authorization': `Bearer ${token}`
    });

    const logoutContext = createMockContextWithKV(logoutRequest, kvStore);
    const logoutResponse = await handleAuthPost(logoutContext);
    const logoutData = await logoutResponse.json();

    expect(logoutResponse.status).toBe(200);
    expect(logoutData.success).toBe(true);
  });

  it('应该能够修改密码', async () => {
    // 先登录获取 token
    const loginRequest = createMockRequest('POST', 'http://localhost:8787/api/auth', {
      action: 'login',
      password: 'yiyi2024'
    });

    const loginContext = createMockContextWithKV(loginRequest, kvStore);
    const loginResponse = await handleAuthPost(loginContext);
    const loginData = await loginResponse.json();
    const token = loginData.token;

    // 修改密码
    const changePasswordRequest = createMockRequest('POST', 'http://localhost:8787/api/auth', {
      action: 'change-password',
      oldPassword: 'yiyi2024',
      newPassword: 'newpassword123'
    }, {
      'Authorization': `Bearer ${token}`
    });

    const changePasswordContext = createMockContextWithKV(changePasswordRequest, kvStore);
    const changePasswordResponse = await handleAuthPost(changePasswordContext);
    const changePasswordData = await changePasswordResponse.json();

    expect(changePasswordResponse.status).toBe(200);
    expect(changePasswordData.success).toBe(true);
    expect(changePasswordData.message).toBe('密码修改成功');
  });

  it('登录失败应该返回错误信息', async () => {
    const request = createMockRequest('POST', 'http://localhost:8787/api/auth', {
      action: 'login',
      password: 'wrongpassword'
    });

    const context = createMockContextWithKV(request, kvStore);
    const response = await handleAuthPost(context);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBeDefined();
  });
});
