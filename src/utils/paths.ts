import path from "node:path";

/** exe 실행 시 exe 옆 폴더, 개발 시 프로젝트 루트 */
export const APP_DIR: string = (process as any).pkg
  ? path.dirname(process.execPath)
  : path.resolve();
