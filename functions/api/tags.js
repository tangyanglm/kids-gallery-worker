const TAG_COLORS = [
    'bg-candy-pink',
    'bg-sunny-yellow',
    'bg-sky-blue',
    'bg-grape-purple',
    'bg-ocean-blue',
    'bg-coral-orange'
];

export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'all';
    
    try {
        const artworkTagsData = await env.KV_STORE.get('tags:artwork');
        const bookTagsData = await env.KV_STORE.get('tags:book');
        
        const artworkTags = artworkTagsData ? JSON.parse(artworkTagsData) : getDefaultTags('artwork');
        const bookTags = bookTagsData ? JSON.parse(bookTagsData) : getDefaultTags('book');
        
        if (type === 'artwork') {
            return new Response(JSON.stringify({ success: true, data: artworkTags }), {
                headers: { 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=3600' // 1小时缓存
                }
            });
        } else if (type === 'book') {
            return new Response(JSON.stringify({ success: true, data: bookTags }), {
                headers: { 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=3600' // 1小时缓存
                }
            });
        } else {
            return new Response(JSON.stringify({ 
                success: true, 
                data: { artwork: artworkTags, book: bookTags } 
            }), {
                headers: { 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'public, max-age=3600' // 1小时缓存
                }
            });
        }
    } catch (error) {
        return new Response(JSON.stringify({ error: '获取标签失败' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export async function onRequestPost(context) {
    const { request, env } = context;
    
    try {
        const { action, type, tag } = await request.json();
        
        if (action === 'add') {
            if (!type || !tag || !tag.name) {
                return new Response(JSON.stringify({ error: '缺少必要参数' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            
            const tagsData = await env.KV_STORE.get(`tags:${type}`);
            let tags = tagsData ? JSON.parse(tagsData) : getDefaultTags(type);
            
            const id = tag.id || `tag_${Date.now()}`;
            const color = tag.color || TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
            
            const newTag = { id, name: tag.name, color };
            
            if (!tags.find(t => t.id === id)) {
                tags.push(newTag);
                await env.KV_STORE.put(`tags:${type}`, JSON.stringify(tags));
            }
            
            return new Response(JSON.stringify({ success: true, data: newTag }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        if (action === 'update') {
            if (!type || !tag || !tag.id) {
                return new Response(JSON.stringify({ error: '缺少必要参数' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            
            const tagsData = await env.KV_STORE.get(`tags:${type}`);
            let tags = tagsData ? JSON.parse(tagsData) : getDefaultTags(type);
            
            const index = tags.findIndex(t => t.id === tag.id);
            if (index !== -1) {
                tags[index] = { ...tags[index], ...tag };
                await env.KV_STORE.put(`tags:${type}`, JSON.stringify(tags));
                return new Response(JSON.stringify({ success: true, data: tags[index] }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            
            return new Response(JSON.stringify({ error: '标签不存在' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        if (action === 'delete') {
            if (!type || !tag || !tag.id) {
                return new Response(JSON.stringify({ error: '缺少必要参数' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            
            const tagsData = await env.KV_STORE.get(`tags:${type}`);
            let tags = tagsData ? JSON.parse(tagsData) : getDefaultTags(type);
            
            tags = tags.filter(t => t.id !== tag.id);
            await env.KV_STORE.put(`tags:${type}`, JSON.stringify(tags));
            
            return new Response(JSON.stringify({ success: true }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        return new Response(JSON.stringify({ error: '无效的操作' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: '操作失败: ' + error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

function getDefaultTags(type) {
    if (type === 'artwork') {
        return [
            { id: 'landscape', name: '风景', color: 'bg-sky-blue' },
            { id: 'animal', name: '动物', color: 'bg-coral-orange' },
            { id: 'portrait', name: '人物', color: 'bg-candy-pink' },
            { id: 'fantasy', name: '幻想', color: 'bg-grape-purple' },
            { id: 'nature', name: '自然', color: 'bg-sky-blue' },
            { id: 'abstract', name: '抽象', color: 'bg-ocean-blue' },
            { id: 'still-life', name: '静物', color: 'bg-sunny-yellow' }
        ];
    } else if (type === 'book') {
        return [
            { id: 'story', name: '故事', color: 'bg-candy-pink' },
            { id: 'fantasy', name: '幻想', color: 'bg-grape-purple' },
            { id: 'animal', name: '动物', color: 'bg-coral-orange' },
            { id: 'nature', name: '自然', color: 'bg-sky-blue' }
        ];
    }
    return [];
}
