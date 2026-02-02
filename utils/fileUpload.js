// utils/fileUpload.js
import { uploadToCloudinary } from "./cloudinary";

export async function handleFileUpload(files, folder = "kyc_documents") {
  try {
    const uploadResults = [];

    for (const file of files) {
      if (file && file.data) {
        // Convert base64 or buffer to uploadable format
        const uploadResult = await uploadToCloudinary(
          `data:${file.type};base64,${file.data}`,
          folder,
        );
        uploadResults.push(uploadResult);
      }
    }

    return uploadResults;
  } catch (error) {
    console.error("File upload error:", error);
    throw new Error("Failed to upload files");
  }
}

// Alternative for handling FormData
export async function handleFormDataFileUpload(formData, fieldName) {
  const files = formData.getAll(fieldName);
  const uploadResults = [];

  for (const file of files) {
    if (file instanceof File) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const uploadResult = await uploadToCloudinary(
        `data:${file.type};base64,${buffer.toString("base64")}`,
        "kyc_documents",
      );
      uploadResults.push(uploadResult);
    }
  }

  return uploadResults;
}
