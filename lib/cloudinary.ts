import { v2 as cloudinary } from "cloudinary";

if (
  !process.env.CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
}

// Diagnostic log to catch environment issues
console.log(
  "Cloudinary Config Check - Name:",
  process.env.CLOUDINARY_CLOUD_NAME ? "PRESENT" : "MISSING",
  "Value:",
  process.env.CLOUDINARY_CLOUD_NAME,
);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
  api_key: process.env.CLOUDINARY_API_KEY?.trim(),
  api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
  secure: true,
});

export default cloudinary;
