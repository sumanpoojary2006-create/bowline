import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { getDownloadURL } from 'firebase-admin/storage';
import { getFirebaseBucket, isFirebaseStorageEnabled } from '../config/firebase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ensureUploadsDir = async () => {
  const uploadsDir = path.join(__dirname, '../../uploads');
  await fs.mkdir(uploadsDir, { recursive: true });
  return uploadsDir;
};

const buildLocalFileUrl = (filename) => {
  const baseUrl =
    process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 5000}`;

  return `${baseUrl.replace(/\/$/, '')}/uploads/${filename}`;
};

const persistLocally = async (file) => {
  const uploadsDir = await ensureUploadsDir();
  const extension = path.extname(file.originalname || '');
  const safeBase = path
    .basename(file.originalname || 'upload', extension)
    .replace(/[^a-z0-9]/gi, '-')
    .toLowerCase();
  const filename = `${Date.now()}-${safeBase || 'file'}-${randomUUID()}${extension}`;
  const targetPath = path.join(uploadsDir, filename);

  await fs.writeFile(targetPath, file.buffer);

  return buildLocalFileUrl(filename);
};

const persistToFirebase = async (file) => {
  const bucket = getFirebaseBucket();
  const extension = path.extname(file.originalname || '');
  const safeBase = path
    .basename(file.originalname || 'upload', extension)
    .replace(/[^a-z0-9]/gi, '-')
    .toLowerCase();
  const objectName = `bowline/${Date.now()}-${safeBase || 'file'}-${randomUUID()}${extension}`;
  const bucketFile = bucket.file(objectName);

  await bucketFile.save(file.buffer, {
    metadata: {
      contentType: file.mimetype,
    },
    public: false,
  });

  return getDownloadURL(bucketFile);
};

export const persistUploadedFiles = async (files = []) =>
  Promise.all(
    files.map((file) =>
      isFirebaseStorageEnabled ? persistToFirebase(file) : persistLocally(file)
    )
  );
