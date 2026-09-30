export const PHOTO_SIZE = 256;
// The server accepts up to 70 KB; aim well below it
const TARGET_BYTES = 60 * 1024;

const bytesOf = (dataUrl: string) => Math.ceil(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4);

// Crops the middle square of a photo and shrinks it to 256px, as a JPEG data URL. Drawing onto a
// canvas also drops the file's hidden details, such as where a phone photo was taken.
export async function preparePhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = PHOTO_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  // Transparent areas (e.g. in a PNG) would turn black in a JPEG
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, PHOTO_SIZE, PHOTO_SIZE);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
  bitmap.close();

  let dataUrl = "";
  for (const quality of [0.85, 0.7, 0.55, 0.4]) {
    dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (bytesOf(dataUrl) <= TARGET_BYTES) break;
  }
  return dataUrl;
}
