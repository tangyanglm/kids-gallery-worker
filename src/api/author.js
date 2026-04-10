import { getCookieFromRequest } from '../utils/cookie.js';

export async function handleGetAuthorProfile(c) {
  try {
    const env = c.env;
    const authorProfile = await env.KV_STORE.get('authorProfile');
    
    if (!authorProfile) {
      // 返回默认作者信息
      const defaultProfile = {
        name: '小画家',
        title: '热爱绘画的小朋友',
        avatar: null,
        bio: `<p>大家好！我是一个热爱画画的小朋友，今年8岁了。</p>
              <p class="mt-3">我喜欢用画笔记录生活中的美好瞬间，用色彩表达我的想象和梦想。每一幅画都是我心中的一个小故事。</p>
              <p class="mt-3">我最喜欢画动物和风景，还有我想象中的神奇世界。希望你们喜欢我的作品！</p>`,
        achievements: [
          { icon: '🥇', title: '校园绘画比赛', subtitle: '一等奖' },
          { icon: '🎨', title: '创意美术展', subtitle: '优秀作品奖' },
          { icon: '⭐', title: '小小艺术家', subtitle: '荣誉称号' }
        ],
        contact: {
          email: 'hello@example.com'
        },
        social: [
          { name: 'Instagram', icon: '📷', url: '#' },
          { name: 'Twitter', icon: '🐦', url: '#' },
          { name: 'YouTube', icon: '📺', url: '#' }
        ]
      };
      return c.json({ success: true, data: defaultProfile });
    }
    
    return c.json({ success: true, data: JSON.parse(authorProfile) });
  } catch (error) {
    console.error('获取作者信息失败:', error);
    return c.json({ error: '获取作者信息失败: ' + error.message }, 500);
  }
}


export async function handleUpdateAuthorProfile(c) {
  try {
    const request = c.req.raw;
    const env = c.env;
    
    // 检查是否已登录
    const token = request.headers.get('Authorization')?.replace('Bearer ', '') ||
                  getCookieFromRequest(request, 'admin_token');
    
    if (!token) {
      return c.json({ error: '未授权' }, 401);
    }
    
    const sessionData = await env.KV_STORE.get(`session:${token}`);
    if (!sessionData) {
      return c.json({ error: '会话无效' }, 401);
    }
    
    const session = JSON.parse(sessionData);
    const now = Date.now();
    
    if (now > session.expiresAt) {
      await env.KV_STORE.delete(`session:${token}`);
      return c.json({ error: '会话已过期' }, 401);
    }
    
    // 检查请求是否为 multipart/form-data
    const contentType = request.headers.get('content-type');
    let authorData;
    let avatarFile;
    
    if (contentType && contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      authorData = {
        name: formData.get('name'),
        title: formData.get('title'),
        bio: formData.get('bio'),
        achievements: formData.get('achievements') ? JSON.parse(formData.get('achievements')) : undefined,
        contact: formData.get('contact') ? JSON.parse(formData.get('contact')) : undefined,
        social: formData.get('social') ? JSON.parse(formData.get('social')) : undefined
      };
      avatarFile = formData.get('avatar');
    } else {
      authorData = await request.json();
    }
    
    // 处理头像上传
    if (avatarFile) {
      const timestamp = Date.now();
      const date = new Date(timestamp);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const random = Math.random().toString(36).substring(2, 8);
      const extension = avatarFile.name.split('.').pop() || 'png';
      const fileName = `${year}/${month}/${timestamp}-${random}.${extension}`;
      
      const arrayBuffer = await avatarFile.arrayBuffer();
      await env.R2_BUCKET.put(fileName, arrayBuffer, {
        httpMetadata: {
          contentType: avatarFile.type || 'image/png',
        },
      });
      
      authorData.avatar = `https://imgs.tangyiyi.dpdns.org/${fileName}`;
    }
    
    // 保存作者信息到 KV
    await env.KV_STORE.put('authorProfile', JSON.stringify(authorData));
    
    return c.json({ success: true, data: authorData });
  } catch (error) {
    console.error('更新作者信息失败:', error);
    return c.json({ error: '更新作者信息失败: ' + error.message }, 500);
  }
}