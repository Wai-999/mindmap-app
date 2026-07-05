import { promises as fs } from "fs";
import path from "path";
import { put, get, del } from "@vercel/blob";

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

// Used for local dev, Docker/VPS, and the Electron app's own local server — anywhere
// with a persistent, single-instance filesystem (see the Docker Compose
// `attachments-data` volume). Vercel deployments use VercelBlobAdapter below instead.
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

// Vercel's serverless functions have no persistent/shared filesystem — this is the
// S3-compatible swap the comment above anticipated, using Vercel's own Blob store
// (works out of the box when the project has one attached; free tier covers a
// personal-scale app). "private" access: attachments stay gated behind this app's
// own owner/share-token authorization checks (see the attachment routes), the same
// as they already are on disk — nothing here is ever handed to a client as a
// direct, unauthenticated storage URL.
class VercelBlobAdapter implements StorageAdapter {
  async save(key: string, buffer: Buffer): Promise<void> {
    await put(key, buffer, { access: "private", addRandomSuffix: false });
  }

  async read(key: string): Promise<Buffer> {
    const result = await get(key, { access: "private" });
    if (!result || result.statusCode !== 200) throw new Error(`Attachment not found: ${key}`);
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    await del(key).catch(() => {});
  }
}

// Vercel injects BLOB_READ_WRITE_TOKEN automatically once a Blob store is attached
// to the project — its presence is what distinguishes "running on Vercel" from
// local dev/Docker/the Electron app, all of which keep using the local disk.
export const storage: StorageAdapter = process.env.BLOB_READ_WRITE_TOKEN
  ? new VercelBlobAdapter()
  : new LocalFilesystemAdapter();
