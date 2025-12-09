// 更新后的 functions/create.js - 支持密码和过期时间

const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

function generateRandomString(length) {
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

/**
 * 计算过期时间
 * @param {string} expireType - 'never', 'hour', 'day', 'week', 'month', 'custom'
 * @param {number} customMinutes - 自定义过期分钟数（仅当 expireType 为 'custom' 时使用）
 * @returns {string|null} - ISO 格式的过期时间或 null
 */
function calculateExpireTime(expireType, customMinutes = 0) {
    if (expireType === 'never') return null;
    
    const now = new Date();
    let expireDate = new Date(now);
    
    const timeConfig = {
        'hour': 60,
        'day': 24 * 60,
        'week': 7 * 24 * 60,
        'month': 30 * 24 * 60,
        'custom': customMinutes
    };
    
    if (timeConfig[expireType]) {
        expireDate.setMinutes(expireDate.getMinutes() + timeConfig[expireType]);
    }
    
    return expireDate.toISOString();
}

/**
 * 检查链接是否已过期
 * @param {string} expireTime - 过期时间 ISO 字符串
 * @returns {boolean} - true 表示已过期
 */
function isLinkExpired(expireTime) {
    if (!expireTime) return false;
    return new Date(expireTime) < new Date();
}

export async function onRequestPost(context) {
    const { request, env } = context;
    
    const corsResponse = request.method === 'OPTIONS' ? new Response('OK', { headers: corsHeaders }) : null;
    if (corsResponse) return corsResponse;

    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('clientIP') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const originurl = new URL(request.url);
    const origin = originurl.origin;

    const options = {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    };
    const timedata = new Date();
    const formattedDate = new Intl.DateTimeFormat('zh-CN', options).format(timedata);

    try {
        const body = await request.json();
        let { url, slug, password, expireType = 'never', customMinutes = 0 } = body;

        // 验证 URL
        if (!url) {
            return Response.json(
                { message: 'Missing url parameter. Correct format: url.' },
                { headers: corsHeaders, status: 400 }
            );
        }

        // 验证 URL 格式
        try {
            new URL(url);
        } catch {
            return Response.json(
                { message: 'Invalid URL format: url.' },
                { headers: corsHeaders, status: 400 }
            );
        }

        // 验证 slug 长度
        if (slug && (slug.length < 2 || slug.length > 10 || /.+\.[a-zA-Z]+$/.test(slug))) {
            return Response.json(
                { message: 'Illegal length: slug, (>= 2 && <= 10), or not ending with a file extension.' },
                { headers: corsHeaders, status: 400 }
            );
        }

        // 验证过期类型
        const validExpireTypes = ['never', 'hour', 'day', 'week', 'month', 'custom'];
        if (!validExpireTypes.includes(expireType)) {
            return Response.json(
                { message: `Invalid expireType. Must be one of: ${validExpireTypes.join(', ')}` },
                { headers: corsHeaders, status: 400 }
            );
        }

        // 验证密码（如果提供）
        if (password && password.length < 4) {
            return Response.json(
                { message: 'Password must be at least 4 characters long.' },
                { headers: corsHeaders, status: 400 }
            );
        }

        // 检查自定义 slug 是否已存在
        if (slug) {
            const existUrl = await env.DB.prepare(
                `SELECT url FROM links WHERE slug = ? AND password IS NULL`
            ).bind(slug).first();

            if (existUrl && existUrl.url === url) {
                return Response.json(
                    { slug, link: `${origin}/${slug}` },
                    { headers: corsHeaders, status: 200 }
                );
            }

            if (existUrl) {
                return Response.json(
                    { message: 'Slug already exists.' },
                    { headers: corsHeaders, status: 409 }
                );
            }
        }

        // 检查目标 URL 是否已存在
        const existSlug = await env.DB.prepare(
            `SELECT slug FROM links WHERE url = ? AND password IS NULL AND expire_type = 'never'`
        ).bind(url).first();

        if (existSlug && !slug) {
            return Response.json(
                { slug: existSlug.slug, link: `${origin}/${existSlug.slug}` },
                { headers: corsHeaders, status: 200 }
            );
        }

        // 检查目标 URL 的域名是否与当前域名相同
        const bodyUrl = new URL(url);
        if (bodyUrl.hostname === originurl.hostname) {
            return Response.json(
                { message: 'You cannot shorten a link to the same domain.' },
                { headers: corsHeaders, status: 400 }
            );
        }

        // 生成随机 slug
        const generatedSlug = slug || generateRandomString(4);
        const expireTime = calculateExpireTime(expireType, customMinutes);
        const isPasswordProtected = password ? 1 : 0;

        // 插入数据库
        const info = await env.DB.prepare(`
            INSERT INTO links (
                url, slug, ip, status, ua, create_time, 
                password, expire_type, expire_time, is_password_protected
            ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
        `).bind(
            url,
            generatedSlug,
            clientIP,
            userAgent,
            formattedDate,
            password || null,
            expireType,
            expireTime,
            isPasswordProtected
        ).run();

        return Response.json(
            {
                slug: generatedSlug,
                link: `${origin}/${generatedSlug}`,
                isPasswordProtected: isPasswordProtected === 1,
                expireType,
                expireTime: expireTime ? new Intl.DateTimeFormat('zh-CN', { 
  timeZone: 'Asia/Shanghai',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit'
}).format(new Date(expireTime)) : 'Never'



            },
            { headers: corsHeaders, status: 200 }
        );

    } catch (e) {
        console.error('Error:', e);
        return Response.json(
            { message: e.message },
            { headers: corsHeaders, status: 500 }
        );
    }
}
