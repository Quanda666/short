## 介绍

一个使用 Cloudflare Pages 创建的 URL 缩短器

*Demo* : [https://oooo.vvvv.ee/](https://oooo.vvvv.ee/)


### 利用Tencent EdgeOne Pages 部署
> 未完成，Tencent EdgeOne的KV 存储还在申请中

一键部署：

[![Use EdgeOne Pages to deploy](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository-url=https://github.com/x-dr/short)


### 利用Cloudflare pages部署


1. fork本项目
2. 登录到[Cloudflare](https://dash.cloudflare.com/)控制台.
3. 在帐户主页中，选择`pages`> ` Create a project` > `Connect to Git`
4. 选择你创建的项目存储库，在`Set up builds and deployments`部分中，全部默认即可。
5. 点击`Save and Deploy`，稍等片刻，你的网站就部署好了。
6. 创建D1数据库参考[这里](https://github.com/x-dr/telegraph-Image/blob/main/docs/manage.md)
7. 执行sql命令创建表（在控制台输入框粘贴下面语句执行即可）

```sql
DROP TABLE IF EXISTS links;
CREATE TABLE IF NOT EXISTS links (
  `id` integer PRIMARY KEY NOT NULL,
  `url` text,
  `slug` text,
  `ua` text,
  `ip` text,
  `status` int,
  `create_time` DATE
);
DROP TABLE IF EXISTS logs;
CREATE TABLE IF NOT EXISTS logs (
  `id` integer PRIMARY KEY NOT NULL,
  `url` text ,
  `slug` text,
  `referer` text,
  `ua` text ,
  `ip` text ,
  `create_time` DATE
);

```
####新增功能
🔐 访问密码保护
可选的 4+ 字符密码
漂亮的密码输入表单
密码验证逻辑
⏰ 链接过期管理
永不过期（默认）
1 小时/1 天/1 周/1 月 自动预设
自定义过期时间（分钟）
🔗 组合使用
密码 + 过期时间
独立使用任一功能
完全向后兼容
####具体操作：
进入 Cloudflare D1 控制台，执行 01_database_migration.sql 中的 SQL，要分开执行；
```sql
ALTER TABLE links ADD COLUMN password TEXT DEFAULT NULL;
ALTER TABLE links ADD COLUMN expire_type TEXT DEFAULT 'never';
ALTER TABLE links ADD COLUMN expire_time DATETIME DEFAULT NULL;
ALTER TABLE links ADD COLUMN is_password_protected INT DEFAULT 0;
```
```sql
CREATE INDEX idx_expire_time ON links(expire_time);
```
```sql
CREATE INDEX idx_slug_with_password ON links(slug, password);
```
```sql
-- 过期时间索引
CREATE INDEX IF NOT EXISTS idx_expire_time ON links(expire_time);
-- 短码+密码复合索引
CREATE INDEX IF NOT EXISTS idx_slug_with_password ON links(slug, password);
```
8. 选择部署完成short项目，前往后台依次点击`设置`->`函数`->`D1 数据库绑定`->`编辑绑定`->变量名称填写：`DB` 命名空间 `选择你提前创建好的D1` 数据库绑定

9. 重新部署项目，完成。


### API

#### 短链生成

```bash
# POST /create
curl -X POST -H "Content-Type: application/json" -d '{"url":"https://131213.xyz"}' https://d.131213.xyz/create

# 指定slug
curl -X POST -H "Content-Type: application/json" -d '{"url":"https://131213.xyz","slug":"scxs"}' https://d.131213.xyz/create

```



> response:

```json
{
  "slug": "<slug>",
  "link": "http://d.131213.xyz/<slug>"
}
```



