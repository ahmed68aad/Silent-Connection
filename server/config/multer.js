import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const extensionByType = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.resolve(__dirname, "..", "uploads");

const ensureUploadFolder = (folder) => {
  const uploadFolder = path.join(uploadsRoot, folder);
  fs.mkdirSync(uploadFolder, { recursive: true });
  return uploadFolder;
};

const createStorage = (folder) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, ensureUploadFolder(folder));
    },
    filename: (req, file, cb) => {
      const originalBase = path
        .basename(file.originalname, path.extname(file.originalname))
        .replace(/[^a-zA-Z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 40);
      const safeBase = originalBase || "image";
      const ext = extensionByType[file.mimetype] || ".jpg";
      const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      cb(null, `${uniquePart}-${safeBase}${ext}`);
    },
  });

const imageFileFilter = (req, file, cb) => {
  if (allowedImageTypes.has(file.mimetype)) {
    cb(null, true);
    return;
  }

  cb(new Error("Only JPG, PNG and WEBP images are allowed"));
};

const createImageUpload = ({ fileSize, folder }) =>
  multer({
    storage: createStorage(folder),
    fileFilter: imageFileFilter,
    limits: {
      fileSize,
      files: 1,
    },
  });

const upload = createImageUpload({ fileSize: 5 * 1024 * 1024, folder: "posts" });
const profileImageUpload = createImageUpload({
  fileSize: 2 * 1024 * 1024,
  folder: "profiles",
});

export default upload;
export { profileImageUpload, uploadsRoot };
