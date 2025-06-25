import { Camera, CameraType, FlashMode } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from './supabase'

export type CaptureOptions = {
  flash: FlashMode
}

export const getCameraPermissions = async () => {
  const { status } = await Camera.requestCameraPermissionsAsync()
  return status === 'granted'
}

export const capturePhoto = async (
  cameraRef: React.RefObject<Camera>,
  options: CaptureOptions
): Promise<string> => {
  if (!cameraRef.current) throw new Error('Camera not ready')
  const photo = await cameraRef.current.takePictureAsync({ flashMode: options.flash, quality: 0.8 })
  return photo.uri
}

export const pickImageFromGallery = async (): Promise<string | null> => {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images })
  if (!result.canceled && result.assets.length > 0) {
    return result.assets[0].uri
  }
  return null
}

export const uploadToSupabase = async (userId: string, uri: string): Promise<string> => {
  const timestamp = Date.now()
  const path = `photos/${userId}/${timestamp}.jpg`
  const response = await fetch(uri)
  const blob = await response.blob()
  const { data, error } = await supabase.storage.from('posts').upload(path, blob, { upsert: true })
  if (error) throw error
  return data.path
}
