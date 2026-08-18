ALTER TABLE courses ADD COLUMN course_plan TEXT NOT NULL DEFAULT 'rights';
ALTER TABLE orders ADD COLUMN course_plan TEXT NOT NULL DEFAULT 'rights';
ALTER TABLE orders ADD COLUMN teacher_revenue INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN visiond_revenue INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN course_api_fee INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_courses_plan_owner ON courses(course_plan,owner_user_id,created_at DESC);
