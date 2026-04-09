import { getCookieFromRequest, getClientIP } from '../utils/cookie.js';

const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000;

export async function handleAuthPost(c) {
  // 设置 CORS 头部
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  try {
    const request = c.req.raw;
    const env = c.env;
    
    const { action, password } = await request.json();
    const clientIP = getClientIP(request);
    const now = Date.now();
    
    if (action === 'login') {
      const attemptsKey = `login_attempts:${clientIP}`;
      const lockoutKey = `lockout:${clientIP}`;
      
      const lockoutData = await env.KV_STORE.get(lockoutKey);
      if (lockoutData) {
        const lockout = JSON.parse(lockoutData);
        if (now < lockout.until) {
          const remainingMinutes = Math.ceil((lockout.until - now) / 60000);
          return c.json({ 
            error: `账户已锁定，请 ${remainingMinutes} 分钟后再试` 
          }, 429);
        } else {
          await env.KV_STORE.delete(lockoutKey);
          await env.KV_STORE.delete(attemptsKey);
        }
      }
      
      const storedPassword = await env.KV_STORE.get('admin_password');
      const defaultPassword = 'yiyi2024';
      const correctPassword = storedPassword || defaultPassword;
      
      if (password === correctPassword) {
        await env.KV_STORE.delete(attemptsKey);
        
        const token = crypto.randomUUID();
        const expiresAt = now + (24 * 60 * 60 * 1000);
        
        await env.KV_STORE.put(`session:${token}`, JSON.stringify({
          ip: clientIP,
          createdAt: now,
          expiresAt
        }), { expirationTtl: 86400 });
        
        c.header('Set-Cookie', `admin_token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`);
        return c.json({ 
          success: true, 
          token,
          expiresAt
        });
      } else {
        const attemptsData = await env.KV_STORE.get(attemptsKey);
        let attempts = attemptsData ? JSON.parse(attemptsData) : { count: 0, firstAttempt: now };
        
        if (now - attempts.firstAttempt > LOCKOUT_TIME) {
          attempts = { count: 0, firstAttempt: now };
        }
        
        attempts.count++;
        attempts.lastAttempt = now;
        
        await env.KV_STORE.put(attemptsKey, JSON.stringify(attempts), { expirationTtl: 900 });
        
        if (attempts.count >= MAX_ATTEMPTS) {
          await env.KV_STORE.put(lockoutKey, JSON.stringify({ 
            until: now + LOCKOUT_TIME,
            attempts: attempts.count
          }), { expirationTtl: 900 });
          
          return c.json({ 
            error: `登录失败次数过多，账户已锁定 15 分钟` 
          }, 429);
        }
        
        const remaining = MAX_ATTEMPTS - attempts.count;
        return c.json({ 
          error: `密码错误，还剩 ${remaining} 次尝试机会` 
        }, 401);
      }
    }
    
    if (action === 'verify') {
      const token = request.headers.get('Authorization')?.replace('Bearer ', '') ||
                    getCookieFromRequest(request, 'admin_token');
      
      if (!token) {
        return c.json({ valid: false });
      }
      
      const sessionData = await env.KV_STORE.get(`session:${token}`);
      if (!sessionData) {
        return c.json({ valid: false });
      }
      
      const session = JSON.parse(sessionData);
      if (now > session.expiresAt) {
        await env.KV_STORE.delete(`session:${token}`);
        return c.json({ valid: false });
      }
      
      return c.json({ valid: true });
    }
    
    if (action === 'logout') {
      const token = request.headers.get('Authorization')?.replace('Bearer ', '') ||
                    getCookieFromRequest(request, 'admin_token');
      
      if (token) {
        await env.KV_STORE.delete(`session:${token}`);
      }
      
      c.header('Set-Cookie', 'admin_token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
      return c.json({ success: true });
    }
    
    if (action === 'change-password') {
      const token = request.headers.get('Authorization')?.replace('Bearer ', '') ||
                    getCookieFromRequest(request, 'admin_token');
      
      if (!token) {
        return c.json({ error: '未授权' }, 401);
      }
      
      const sessionData = await env.KV_STORE.get(`session:${token}`);
      if (!sessionData) {
        return c.json({ error: '会话无效' }, 401);
      }
      
      const { oldPassword, newPassword } = await request.json();
      
      if (!newPassword || newPassword.length < 6) {
        return c.json({ error: '新密码至少需要 6 个字符' }, 400);
      }
      
      const storedPassword = await env.KV_STORE.get('admin_password');
      const defaultPassword = 'yiyi2024';
      const correctPassword = storedPassword || defaultPassword;
      
      if (oldPassword !== correctPassword) {
        return c.json({ error: '原密码错误' }, 401);
      }
      
      await env.KV_STORE.put('admin_password', newPassword);
      
      return c.json({ success: true, message: '密码修改成功' });
    }
    
    return c.json({ error: '无效的操作' }, 400);
    
  } catch (error) {
    console.error('认证错误:', error);
    return c.json({ error: '服务器错误' }, 500);
  }
}

export async function handleAuthGet(c) {
  // 设置 CORS 头部
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  
  try {
    const request = c.req.raw;
    const env = c.env;
    const token = getCookieFromRequest(request, 'admin_token');
    
    if (!token) {
      return c.json({ valid: false });
    }
    
    const sessionData = await env.KV_STORE.get(`session:${token}`);
    if (!sessionData) {
      return c.json({ valid: false });
    }
    
    const session = JSON.parse(sessionData);
    const now = Date.now();
    
    if (now > session.expiresAt) {
      await env.KV_STORE.delete(`session:${token}`);
      return c.json({ valid: false });
    }
    
    return c.json({ valid: true });
  } catch (error) {
    console.error('认证错误:', error);
    return c.json({ valid: false });
  }
}
