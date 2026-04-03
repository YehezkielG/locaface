import { supabase } from './supabase';

export default async function uploadAvatar(imageUri: string, userId: string): Promise<string | null> {
  try {
    const ext = imageUri.substring(imageUri.lastIndexOf('.') + 1);
    const fileName = `${userId}_avatar.${ext}`; // Penamaan file unik
    const formData = new FormData();
    
    formData.append('file', {
      uri: imageUri,
      name: fileName,
      type: `image/${ext}`,
    });

    // Upload ke bucket 'avatar'
    const { error } = await supabase.storage
      .from('avatar')
      .upload(fileName, formData, { upsert: true });

    if (error) throw error;

    // Dapatkan Public URL
    const { data: publicUrlData } = supabase.storage
      .from('avatar')
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;

  } catch (error) {
    console.error("Failed to upload avatar:", error);
    return null;
  }
};