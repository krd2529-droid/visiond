export const MIN_COURSE_PRICE_BAHT = 499;
export const MIN_COURSE_PRICE_SATANG = MIN_COURSE_PRICE_BAHT * 100;
export const MAX_COURSE_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;
export const COURSE_VIDEO_CHUNK_BYTES = 25 * 1024 * 1024;
export const coursePriceError = () => `ราคาคอร์สขั้นต่ำ ${MIN_COURSE_PRICE_BAHT} บาท`;
