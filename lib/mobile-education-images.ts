import type { ImageURISource } from 'react-native';

// These are the original PNG bytes inside the launch bundle, with their original dimensions.
// This avoids consuming a separate OTA asset slot for each introduction capture.
const images = require('./mobile-education-image-data') as Record<string, ImageURISource>;
export function educationImage(name: string): ImageURISource {
  const image = images[name];
  if (!image) throw new Error(`Unknown education image: ${name}`);
  return image;
}
