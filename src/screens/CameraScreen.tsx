import React, { useEffect, useRef, useState } from 'react'
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { Camera, FlashMode, CameraType } from 'expo-camera'
import { capturePhoto, getCameraPermissions, uploadToSupabase, pickImageFromGallery } from '../lib/cameraUtils'
import { supabase } from '../lib/supabase'

const cycleFlash = (mode: FlashMode): FlashMode => {
  if (mode === FlashMode.off) return FlashMode.on
  if (mode === FlashMode.on) return FlashMode.auto
  return FlashMode.off
}

export const CameraScreen: React.FC = () => {
  const cameraRef = useRef<Camera>(null)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [flash, setFlash] = useState<FlashMode>(FlashMode.off)
  const [cameraType, setCameraType] = useState<CameraType>(CameraType.back)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUri, setLastUri] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const granted = await getCameraPermissions()
      setHasPermission(granted)
    })()
  }, [])

  const handleCapture = async () => {
    try {
      setLoading(true)
      const uri = await capturePhoto(cameraRef, { flash })
      setLastUri(uri)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user')
      await uploadToSupabase(user.id, uri)
      setLoading(false)
    } catch (err: any) {
      setLoading(false)
      setError(err.message)
    }
  }

  const handleRetry = async () => {
    if (!lastUri) return
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user')
      await uploadToSupabase(user.id, lastUri)
      setError(null)
      setLoading(false)
    } catch (err: any) {
      setLoading(false)
      setError(err.message)
    }
  }

  const handleGallery = async () => {
    const uri = await pickImageFromGallery()
    if (!uri) return
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user')
      await uploadToSupabase(user.id, uri)
      setLoading(false)
    } catch (err: any) {
      setLoading(false)
      setError(err.message)
    }
  }

  if (hasPermission === null) {
    return <View style={styles.container} />
  }
  if (hasPermission === false) {
    return (
      <View style={styles.center}>
        <Text>No access to camera</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Camera ref={cameraRef} style={styles.camera} type={cameraType} flashMode={flash} />
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
      <View style={styles.controls}>
        <TouchableOpacity onPress={() => setFlash(cycleFlash(flash))} style={styles.button}>
          <Text style={styles.text}>Flash</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setCameraType(cameraType === CameraType.back ? CameraType.front : CameraType.back)} style={styles.button}>
          <Text style={styles.text}>Flip</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleCapture} style={styles.button}>
          <Text style={styles.text}>Capture</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleGallery} style={styles.button}>
          <Text style={styles.text}>Gallery</Text>
        </TouchableOpacity>
        {error && (
          <TouchableOpacity onPress={handleRetry} style={styles.button}>
            <Text style={styles.text}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },
  controls: { flexDirection: 'row', justifyContent: 'space-around', padding: 16 },
  button: { padding: 8, backgroundColor: '#00000080', borderRadius: 4 },
  text: { color: '#fff' },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' }
})

export default CameraScreen
