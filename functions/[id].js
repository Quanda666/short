// 更新后的 functions/[id].js - 支持密码验证和过期时间检查

import page404 from './404.html';

const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function isLinkExpired(expireTime) {
    if (!expireTime) return false;
    return new Date(expireTime) < new Date();
}

function getPasswordCheckPage(slug, message = '') {
    return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>访问受限 - 请输入密码</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                padding: 20px;
            }
            .container {
                background: white;
                border-radius: 8px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
                padding: 40px;
                max-width: 400px;
                width: 100%;
            }
            h1 {
                color: #333;
                margin-bottom: 10px;
                font-size: 24px;
            }
            .icon {
                font-size: 48px;
                margin-bottom: 20px;
            }
            p {
                color: #666;
                margin-bottom: 20px;
                font-size: 14px;
            }
            .error {
                background: #fee;
                color: #c33;
                padding: 10px 15px;
                border-radius: 4px;
                margin-bottom: 20px;
                display: none;
                font-size: 13px;
            }
            .error.show {
                display: block;
            }
            input {
                width: 100%;
                padding: 12px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 16px;
                margin-bottom: 15px;
                transition: border-color 0.3s;
            }
            input:focus {
                outline: none;
                border-color: #667eea;
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
            }
            button {
                width: 100%;
                padding: 12px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 4px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: transform 0.2s, box-shadow 0.2s;
            }
            button:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
            }
            button:active {
                transform: translateY(0);
            }
            button:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none;
            }
            .loading {
                display: none;
                text-align: center;
                color: #667eea;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="icon">🔐</div>
            <h1>此链接受密码保护</h1>
            <p>请输入密码以继续访问此链接。</p>
            <div class="error" id="error"></div>
            <form id="passwordForm">
                <input 
                    type="password" 
                    id="password" 
                    placeholder="输入密码" 
                    autocomplete="off"
                    required
                >
                <button type="submit" id="submitBtn">验证密码</button>
                <div class="loading" id="loading">验证中...</div>
            </form>
        </div>
        <script>
            const slug = '${slug}';
            const form = document.getElementById('passwordForm');
            const passwordInput = document.getElementById('password');
            const errorDiv = document.getElementById('error');
            const submitBtn = document.getElementById('submitBtn');
            const loading = document.getElementById('loading');

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const password = passwordInput.value;
                
                if (!password) {
                    showError('请输入密码');
                    return;
                }

                submitBtn.style.display = 'none';
                loading.style.display = 'block';
                errorDiv.classList.remove('show');

                try {
                    const response = await fetch(window.location.href, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Password': password
                        },
                        body: JSON.stringify({ password })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.redirectUrl) {
                            window.location.href = data.redirectUrl;
                        }
                    } else if (response.status === 401) {
                        showError('密码错误，请重试');
                        submitBtn.style.display = 'block';
                        loading.style.display = 'none';
                        passwordInput.value = '';
                        passwordInput.focus();
                    } else {
                        showError('验证失败，请稍后重试');
                        submitBtn.style.display = 'block';
                        loading.style.display = 'none';
                    }
                } catch (error) {
                    showError('网络错误：' + error.message);
                    submitBtn.style.display = 'block';
                    loading.style.display = 'none';
                }
            });

            function showError(msg) {
                errorDiv.textContent = msg;
                errorDiv.classList.add('show');
            }

            passwordInput.focus();
        </script>
    </body>
    </html>
    `;
}

export async function onRequestGet(context) {
    const { request, env, params } = context;
    
    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('clientIP') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const Referer = request.headers.get('Referer') || 'Referer';
    const originurl = new URL(request.url);

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

    const slug = params.id;

    try {
        // 查询链接信息
        const linkData = await env.DB.prepare(
            `SELECT url, password, is_password_protected, expire_time FROM links WHERE slug = ?`
        ).bind(slug).first();

        if (!linkData) {
            return new Response(
                `<!DOCTYPE html><html><body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:system-ui"><div style="text-align:center"><h1>404</h1><p>链接不存在或已过期</p></div></body></html>`,
                {
                    status: 404,
                    headers: { 'content-type': 'text/html;charset=UTF-8' }
                }
            );
        }

        // 检查链接是否已过期
        if (isLinkExpired(linkData.expire_time)) {
            return new Response(
                `<!DOCTYPE html><html><body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:system-ui"><div style="text-align:center"><h1>⏰ 已过期</h1><p>此短链已过期，无法访问</p><p style="font-size:12px;color:#999;margin-top:20px">过期时间: ${new Date(linkData.expire_time).toLocaleString('zh-CN')}</p></div></body></html>`,
                {
                    status: 410,
                    headers: { 'content-type': 'text/html;charset=UTF-8' }
                }
            );
        }

        // 检查是否需要密码验证
        if (linkData.is_password_protected && linkData.password) {
            return new Response(
                getPasswordCheckPage(slug),
                {
                    status: 200,
                    headers: { 'content-type': 'text/html;charset=UTF-8' }
                }
            );
        }

        // 记录访问日志
        try {
            await env.DB.prepare(`
                INSERT INTO logs (url, slug, ip, referer, ua, create_time) 
                VALUES (?, ?, ?, ?, ?, ?)
            `).bind(linkData.url, slug, clientIP, Referer, userAgent, formattedDate).run();
        } catch (error) {
            console.error('Failed to log access:', error);
        }

        // 重定向到目标 URL
        return Response.redirect(linkData.url, 302);

    } catch (error) {
        console.error('Error:', error);
        return new Response(
            `<!DOCTYPE html><html><body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:system-ui"><div style="text-align:center"><h1>❌ 错误</h1><p>处理请求时出错，请稍后重试</p></div></body></html>`,
            {
                status: 500,
                headers: { 'content-type': 'text/html;charset=UTF-8' }
            }
        );
    }
}

export async function onRequestPost(context) {
    const { request, env, params } = context;
    
    const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('clientIP') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const Referer = request.headers.get('Referer') || 'Referer';

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

    const slug = params.id;

    try {
        const body = await request.json();
        const { password } = body;

        // 查询链接
        const linkData = await env.DB.prepare(
            `SELECT url, password, is_password_protected, expire_time FROM links WHERE slug = ?`
        ).bind(slug).first();

        if (!linkData) {
            return Response.json(
                { message: 'Link not found' },
                { headers: corsHeaders, status: 404 }
            );
        }

        // 检查是否已过期
        if (isLinkExpired(linkData.expire_time)) {
            return Response.json(
                { message: 'Link has expired' },
                { headers: corsHeaders, status: 410 }
            );
        }

        // 验证密码
        if (linkData.is_password_protected && linkData.password !== password) {
            return Response.json(
                { message: 'Invalid password' },
                { headers: corsHeaders, status: 401 }
            );
        }

        // 记录访问日志
        try {
            await env.DB.prepare(`
                INSERT INTO logs (url, slug, ip, referer, ua, create_time) 
                VALUES (?, ?, ?, ?, ?, ?)
            `).bind(linkData.url, slug, clientIP, Referer, userAgent, formattedDate).run();
        } catch (error) {
            console.error('Failed to log access:', error);
        }

        // 返回重定向 URL
        return Response.json(
            { redirectUrl: linkData.url },
            { headers: corsHeaders, status: 200 }
        );

    } catch (error) {
        console.error('Error:', error);
        return Response.json(
            { message: error.message },
            { headers: corsHeaders, status: 500 }
        );
    }
}
