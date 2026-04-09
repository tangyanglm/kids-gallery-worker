import { Hono } from 'hono';
import { cors } from 'hono/cors'; 
import { handleAuthPost, handleAuthGet } from './api/auth.js';
import { handleListGet } from './api/list.js';
import { handleUploadPost } from './api/upload.js';
import { handleDeletePost } from './api/delete.js';
import { handleUpdatePost } from './api/update.js';
import { handleTagsGet, handleTagsPost } from './api/tags.js';
import { handleViewPost } from './api/view.js';
import { handleTestUploadPost } from './api/test-upload.js';

const app = new Hono();
// ✅ 一行搞定
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400,
}));

// 处理 CORS 预检请求
app.options('*', async (c) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  c.header('Access-Control-Max-Age', '86400');
  return c.body(null, 204);
});

// 认证路由
app.post('/api/auth', handleAuthPost);
app.get('/api/auth', handleAuthGet);

// 列表路由
app.get('/api/list', handleListGet);

// 上传路由
app.post('/api/upload', handleUploadPost);

// 删除路由
app.post('/api/delete', handleDeletePost);

// 更新路由
app.post('/api/update', handleUpdatePost);

// 标签路由
app.get('/api/tags', handleTagsGet);
app.post('/api/tags', handleTagsPost);

// 查看路由
app.post('/api/view', handleViewPost);

// 测试上传路由
app.post('/api/test-upload', handleTestUploadPost);

// 测试 API
app.get('/api/test', async (c) => {
  return c.text('API IS WORK');
});

export default app;
