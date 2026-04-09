function getCookieFromRequest(request, name) {
  try {
    if (!request || !request.headers) {
      return null;
    }
    const cookies = request.headers.get('Cookie') || '';
    const match = cookies.match(new RegExp(`${name}=([^;]+)`));
    return match ? match[1] : null;
  } catch (error) {
    console.error('获取 cookie 失败:', error);
    return null;
  }
}

function getClientIP(request) {
  return request.headers.get('CF-Connecting-IP') || 
         request.headers.get('X-Forwarded-For') || 
         'unknown';
}

export { getCookieFromRequest, getClientIP };
