// src/lib/storage.ts
import { supabase } from './supabase';
import { resizeImage,dataURLtoBlob,  validateImageFile } from '../utils/imageUtils';

// Convert data URL (base64) to Blob for Supabase Storage upload
export function dataURLtoBlob(dataURL: string): Blob {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1].replace(/\s/g, ''));
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new Blob([u8arr], { type: mime });
}
// Check if bucket exists with improved error handling
async function checkBucketExists(bucketName: string): Promise<boolean> {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
      console.warn(`Could not list buckets: ${error.message}`);
      return true; // assume existence to avoid blocking
    }
    if (buckets.some(b => b.name === bucketName)) return true;
    // fallback direct access check
    const { error: testError } = await supabase.storage.from(bucketName).list('', { limit: 1 });
    return !testError;
  } catch {
    return true;
  }
}

// Generic upload helper with better error handling
export async function uploadImage(
  bucket: string,
  filePath: string,
  imageDataURL: string
): Promise<{ publicUrl: string | null; error: string | null }> {
  try {
    console.log(`Starting upload to bucket "${bucket}" with path "${filePath}"`);
    
    const bucketExists = await checkBucketExists(bucket);
    if (!bucketExists) {
      console.error(`Bucket "${bucket}" does not exist or is not accessible`);
      return { publicUrl: null, error: `Storage bucket "${bucket}" not found or accessible.` };
    }

    const blob = dataURLtoBlob(imageDataURL);
    console.log(`Created blob of size: ${blob.size} bytes, type: ${blob.type}`);
    
    const { data, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, blob, { 
        upsert: true, 
        contentType: blob.type,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error(`Upload to "${bucket}" failed:`, uploadError);
      return { publicUrl: null, error: uploadError.message };
    }

    console.log(`Upload successful, getting public URL...`);
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
    
    if (!urlData?.publicUrl) {
      console.error(`Failed to get public URL for uploaded file`);
      return { publicUrl: null, error: 'Failed to retrieve public URL after upload.' };
    }

    console.log(`Upload complete, public URL: ${urlData.publicUrl}`);
    return { publicUrl: urlData.publicUrl, error: null };
  } catch (error: any) {
    console.error(`Exception during upload to "${bucket}":`, error);
    return { publicUrl: null, error: error.message || 'An unknown error occurred during upload.' };
  }
}

// Upload profile image with resizing
export async function uploadProfileImage(file: File): Promise<{ publicUrl: string | null; error: string | null }>;
export async function uploadProfileImage(userId: string, imageDataURL: string): Promise<{ publicUrl: string | null; error: string | null }>;
export async function uploadProfileImage(arg1: File | string, arg2?: string): Promise<{ publicUrl: string | null; error: string | null }> {
  try {
    if (arg1 instanceof File) {
      const file = arg1;
      
      // Validate file
      const validation = validateImageFile(file, 5); // 5MB limit for profile images
      if (!validation.valid) {
        return { publicUrl: null, error: validation.error || 'Invalid file.' };
      }

      // Resize image for profile picture (400x400 max)
      const resizedDataURL = await resizeImage(file, {
        maxWidth: 400,
        maxHeight: 400,
        quality: 0.8
      });

      const blob = dataURLtoBlob(resizedDataURL);
      const path = `${Date.now()}_${file.name}`;
      
      const { error } = await supabase.storage.from('avatars').upload(path, blob, { upsert: true });
      if (error) return { publicUrl: null, error: error.message };
      
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      if (!urlData?.publicUrl) return { publicUrl: null, error: 'Failed to get public URL for avatar.' };
      return { publicUrl: urlData.publicUrl, error: null };
    } else {
      // fallback using data URL
      return await uploadImage('avatars', `${arg1}/profile.jpg`, arg2!);
    }
  } catch (error: any) {
    console.error('Profile image upload error:', error);
    return { publicUrl: null, error: error.message || 'An unknown error occurred during profile image upload.' };
  }
}

// Upload banner image with resizing
export async function uploadBannerImage(file: File): Promise<{ publicUrl: string | null; error: string | null }> {
  try {
    console.log('Starting banner image upload...');
    
    // Validate file
    const validation = validateImageFile(file, 10); // 10MB limit for banner images
    if (!validation.valid) {
      return { publicUrl: null, error: validation.error || 'Invalid file.' };
    }

    // Resize image for banner (1200x400 max, maintaining aspect ratio)
    const resizedDataURL = await resizeImage(file, {
      maxWidth: 1200,
      maxHeight: 400,
      quality: 0.8
    });

    const path = `${Date.now()}_${file.name}`;
    
    console.log(`Uploading banner image to path: ${path}`);
    
    const { publicUrl, error } = await uploadImage('banner', path, resizedDataURL);
    
    if (error) {
      console.error('Banner upload error:', error);
      return { publicUrl: null, error: error };
    }
    
    console.log('Banner upload successful:', publicUrl);
    
    return { publicUrl, error: null };
  } catch (error: any) {
    console.error('Banner image upload error:', error);
    return { publicUrl: null, error: error.message || 'An unknown error occurred during banner image upload.' };
  }
}

/**
 * Uploads a post image to the "posts" bucket and returns its storage path.
 */
export async function uploadPostImage(file: File, path: string): Promise<string> {
  const { data, error } = await supabase
    .storage
    .from('posts')
    .upload(path, file, { upsert: true });
  if (error) throw error;
  return data.path;
}

// Delete image from storage
export async function deleteImage(bucket: string, filePath: string): Promise<boolean> {
  try {
    const { error } = await supabase.storage.from(bucket).remove([filePath]);
    if (error) {
      console.error(`Failed to delete image from ${bucket}:`, error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Delete image error:', error);
    return false;
  }
}

// Extract file path from Supabase storage URL
export function extractFilePathFromUrl(url: string, bucket: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const bucketIndex = pathParts.findIndex(part => part === bucket);
    
    if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
      return pathParts.slice(bucketIndex + 1).join('/');
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting file path from URL:', error);
    return null;
  }
}

// Fallback placeholder
export function generatePlaceholderImage(): string {
  return '/images/default-post.jpg';
}

// Check storage availability
export async function checkStorageAvailability(): Promise<{
  avatarsAvailable: boolean;
  postsAvailable: boolean;
  bannerAvailable: boolean;
  message: string;
}> {
  try {
    const [avatarsExists, postsExists, bannerExists] = await Promise.all([
      checkBucketExists('avatars'),
      checkBucketExists('posts'),
      checkBucketExists('banner'),
    ]);
    
    let message = '';
    if (!avatarsExists && !postsExists && !bannerExists) {
      message = 'No storage buckets found; using placeholders.';
    } else if (!avatarsExists) {
      message = 'Profile uploads unavailable; posts and banners ok.';
    } else if (!postsExists) {
      message = 'Post uploads unavailable; profiles and banners ok.';
    } else if (!bannerExists) {
      message = 'Banner uploads unavailable; profiles and posts ok.';
    } else {
      message = 'All storage buckets available.';
    }
    
    return { 
      avatarsAvailable: avatarsExists, 
      postsAvailable: postsExists,
      bannerAvailable: bannerExists,
      message 
    };
  } catch (error) {
    console.warn('Storage availability check error:', error);
    return { 
      avatarsAvailable: true, 
      postsAvailable: true, 
      bannerAvailable: true,
      message: 'Assuming storage available.' 
    };
  }
}
