/**
 * FILE_LIMITS defines the constraints for file uploads in the application.
 * These limits ensure efficient file handling and prevent system overloads.
 */
export const FILE_LIMITS = {
  /**
   * The maximum size allowed for an individual file upload.
   * 
   * @constant
   * @type {number}
   * @default 10 * 1024 * 1024 (10 MB)
   * @description Ensures no single file exceeds 10 megabytes in size.
   */
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB

  /**
   * The maximum number of files allowed in a single upload session.
   * 
   * @constant
   * @type {number}
   * @default 10_000
   * @description Prevents uploading an excessive number of files at once.
   */
  MAX_FILES: 10_000,

  /**
   * The maximum total size allowed for all files combined in a single upload session.
   * 
   * @constant
   * @type {number}
   * @default 500 * 1024 * 1024 (500 MB)
   * @description Ensures the total upload size does not exceed 500 megabytes.
   */
  MAX_TOTAL_SIZE: 500 * 1024 * 1024, // 500 MB
} as const;
