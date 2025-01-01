import fs from 'fs-extra';

export class FileUtils {
  static async isTextFile(filePath: string): Promise<boolean> {
    try {
      const buffer = await fs.readFile(filePath);
      const sample = buffer.slice(0, 1024);
      
      for (const byte of sample) {
        if (byte === 0 || (byte < 32 && ![9, 10, 13].includes(byte))) {
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error(`Error checking if file is text: ${error}`);
      return false;
    }
  }

  static async readFileContent(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf-8');
  }

  static async writeOutput(filePath: string, content: string): Promise<void> {
    await fs.writeFile(filePath, content, 'utf-8');
  }
}