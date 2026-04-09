const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000;

function getClientIP(request) {
  return request.headers.get('CF-Connecting-IP') || 
         request.headers.get('X-Forwarded-For') || 
         'unknown';
}

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
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
          return new Response(JSON.stringify({ 
            error: `账户已锁定，请 ${remainingMinutes} 分钟后再试` 
          }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' }
          });
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
        
        return new Response(JSON.stringify({ 
          success: true, 
          token,
          expiresAt
        }), {
          headers: { 
            'Content-Type': 'application/json',
            'Set-Cookie': `admin_token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`
          }
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
          
          return new Response(JSON.stringify({ 
            error: `登录失败次数过多，账户已锁定 15 分钟` 
          }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        const remaining = MAX_ATTEMPTS - attempts.count;
        return new Response(JSON.stringify({ 
          error: `密码错误，还剩 ${remaining} 次尝试机会` 
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    if (action === 'verify') {

      const token = request.headers.get('Authorization')?.replace('Bearer ', '') ||
                    getCookieFromRequest(request, 'admin_token');
      
      if (!token) {
        return new Response(JSON.stringify({ valid: false }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const sessionData = await env.KV_STORE.get(`session:${token}`);
      if (!sessionData) {
        return new Response(JSON.stringify({ valid: false }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const session = JSON.parse(sessionData);
      if (now > session.expiresAt) {
        await env.KV_STORE.delete(`session:${token}`);
        return new Response(JSON.stringify({ valid: false }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({ valid: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (action === 'logout') {
      const token = request.headers.get('Authorization')?.replace('Bearer ', '') ||
                    getCookieFromRequest(request, 'admin_token');
      
      if (token) {
        await env.KV_STORE.delete(`session:${token}`);
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 
          'Content-Type': 'application/json',
          'Set-Cookie': 'admin_token=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'
        }
      });
    }
    
    if (action === 'change-password') {
      const token = request.headers.get('Authorization')?.replace('Bearer ', '') ||
                    getCookieFromRequest(request, 'admin_token');
      
      if (!token) {
        return new Response(JSON.stringify({ error: '未授权' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const sessionData = await env.KV_STORE.get(`session:${token}`);
      if (!sessionData) {
        return new Response(JSON.stringify({ error: '会话无效' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const { oldPassword, newPassword } = await request.json();
      
      if (!newPassword || newPassword.length < 6) {
        return new Response(JSON.stringify({ error: '新密码至少需要 6 个字符' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const storedPassword = await env.KV_STORE.get('admin_password');
      const defaultPassword = 'yiyi2024';
      const correctPassword = storedPassword || defaultPassword;
      
      if (oldPassword !== correctPassword) {
        return new Response(JSON.stringify({ error: '原密码错误' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      await env.KV_STORE.put('admin_password', newPassword);
      
      return new Response(JSON.stringify({ success: true, message: '密码修改成功' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ error: '无效的操作' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('认证错误:', error);
    return new Response(JSON.stringify({ error: '服务器错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const token = getCookieFromRequest(request, 'admin_token');
  
  if (!token) {
    return new Response(JSON.stringify({ valid: false }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const sessionData = await env.KV_STORE.get(`session:${token}`);
  if (!sessionData) {
    return new Response(JSON.stringify({ valid: false }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const session = JSON.parse(sessionData);
  const now = Date.now();
  
  if (now > session.expiresAt) {
    await env.KV_STORE.delete(`session:${token}`);
    return new Response(JSON.stringify({ valid: false }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  return new Response(JSON.stringify({ valid: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

function getCookieFromRequest(request, name) {
  const cookies = request.headers.get('Cookie') || '';
  const match = cookies.match(new RegExp(`${name}=([^;]+)`));
  return match ? match[1] : null;
}
