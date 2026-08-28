export const MIN_COURSE_PRICE_BAHT = 499;
export const MIN_COURSE_PRICE_SATANG = MIN_COURSE_PRICE_BAHT * 100;
export const MAX_COURSE_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;
export const COURSE_VIDEO_CHUNK_BYTES = 25 * 1024 * 1024;
export const coursePriceError = () => `ราคาคอร์สขั้นต่ำ ${MIN_COURSE_PRICE_BAHT} บาท`;

const lessonSchemaReadyByDatabase=new WeakMap();
export async function ensureCourseLessonSchema(env){
  let ready=lessonSchemaReadyByDatabase.get(env.DB);
  if(!ready){
    ready=(async()=>{const columns=(await env.DB.prepare('PRAGMA table_info(course_lessons)').all()).results.map(column=>column.name);if(!columns.includes('episode_label'))await env.DB.prepare('ALTER TABLE course_lessons ADD COLUMN episode_label TEXT').run();if(!columns.includes('document_name'))await env.DB.prepare("ALTER TABLE course_lessons ADD COLUMN document_name TEXT NOT NULL DEFAULT ''").run()})().catch(error=>{lessonSchemaReadyByDatabase.delete(env.DB);throw error});
    lessonSchemaReadyByDatabase.set(env.DB,ready);
  }
  return ready;
}
