import { promises as fs } from "fs";
import path from "path";

export interface StorageAdapter {
  save(key: string, buffer: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

// Function, not a constant, so tests can override ATTACHMENT_STORAGE_PATH before the
// first call rather than needing to control module-load order.
function getStorageRoot(): string {
  return process.env.ATTACHMENT_STORAGE_PATH || path.join(process.cwd(), "storage", "attachments");
}

// PRODUCTION SWAP: implement StorageAdapter against S3-compatible storage (S3/R2/MinIO)
// for deployments that need durable storage shared across multiple app instances —
// this adapter only works for a single-instance deployment with a persistent volume
// (see the Docker Compose `attachments-data` volume), mirroring the SQLite-vs-Postgres
// swap documented in the README for the same single-vs-multi-instance reason.
class LocalFilesystemAdapter implements StorageAdapter {
  private resolveKeyPath(key: string): string {
    // `key` is always an attachment's own cuid, generated server-side — path.basename
    // is a defensive guard against path traversal, not a trust boundary this code
    // actually relies on.
    return path.join(getStorageRoot(), path.basename(key));
  }

  async save(key: string, buffer: Buffer): Promise<void> {
    await fs.mkdir(getStorageRoot(), { recursive: true });
    await fs.writeFile(this.resolveKeyPath(key), buffer);
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFile(this.resolveKeyPath(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolveKeyPath(key), { force: true });
  }
}

export const storage: StorageAdapter = new LocalFilesystemAdapter();
