import axios from "axios";
import FormData from "form-data";

/**
 * Uploads an image to ImgBB using their public API.
 * Requires an API key from https://imgbb.com/
 */
export async function uploadToImgBB(
  imageUrl: string,
  apiKey: string,
): Promise<string> {
  const form = new FormData();
  form.append("image", imageUrl);

  const response = await axios.post(
    `https://api.imgbb.com/1/upload?key=${apiKey}`,
    form,
    {
      headers: {
        ...form.getHeaders(),
      },
    },
  );

  if (response.data?.data?.url) {
    return response.data.data.url;
  }

  throw new Error("Invalid response from ImgBB API");
}
