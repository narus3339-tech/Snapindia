export async function uploadToCloudinary(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "mock-preset");
  const res = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "mock-cloud"}/auto/upload`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  return data.secure_url || "";
}
