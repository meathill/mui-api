-- 博客内容源切换到 muicv CMS（articles 集合，site=muirouter），本地 metadata 表下线。
-- 正文此前在 packages/dashboard/src/content/blog/*.mdx（已删除），元数据在下面两张表。
DROP TABLE IF EXISTS blog_post_translations;
DROP TABLE IF EXISTS blog_posts;
