import React, { useState, useRef } from 'react';
import { CameraIcon, PhotoIcon, XMarkIcon, CheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { generateId } from '../utils/generateId';
import { supabase } from '../lib/supabase';
import { uploadPostImage } from '../lib/storage';
import { generatePlaceholderImage, checkStorageAvailability } from '../lib/storage';
import { createPost } from '../lib/posts';
import { isDemoUser } from '../utils/demo';

export const CreatePostScreen: React.FC = () => {
  const [caption, setCaption] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [storageStatus, setStorageStatus] = useState<{
    available: boolean;
    message: string;
  }>({ available: true, message: '' });
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load current user data and check storage
  React.useEffect(() => {
    loadCurrentUser();
    checkStorage();
  }, []);

  const checkStorage = async () => {
    try {
      const status = await checkStorageAvailability();
      setStorageStatus({
        available: status.postsAvailable,
        message: status.message
      });
    } catch (error) {
      console.error('Storage check error:', error);
      setStorageStatus({
        available: true, // Default to true to avoid blocking functionality
        message: 'Storage status unknown, proceeding normally.'
      });
    }
  };

  const loadCurrentUser = async () => {
    try {
      // Check if Supabase is available
      if (!supabase) {
        console.warn('Supabase not available, using offline mode');
        // Set a default user for offline mode
        setCurrentUser({
          id: 'offline-user',
          name: 'Offline User',
          profile_photo_url: null
        });
        setIsLoading(false);
        return;
      }

      const { data: { user }, error } = await supabase.auth.getUser();

      setIsDemo(isDemoUser(user?.email));
      
      if (error || !user) {
        setIsLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Profile fetch error:', profileError);
        setIsLoading(false);
        return;
      }

      // If no profile exists, create one
      if (!profile) {
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'New User',
            email: user.email,
            bio: 'New to Zenlit! 👋',
            created_at: new Date().toISOString()
          })
          .select()
          .maybeSingle();

        if (createError) {
          console.error('Profile creation error:', createError);
          setIsLoading(false);
          return;
        }

        setCurrentUser(newProfile);
      } else {
        setCurrentUser(profile);
      }
    } catch (error) {
      console.error('Load user error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePost = async () => {
    if (!selectedMedia && !caption.trim()) {
      alert('Please add some content to your post');
      return;
    }

    if (!currentUser) {
      alert('Please log in to create a post');
      return;
    }
    
    setIsPosting(true);
    
    try {
      let mediaUrl = selectedMedia;
      let uploadAttempted = false;
      
      // If we have a selected media that's a data URL (captured photo), try to upload it
      if (selectedMedia && selectedMedia.startsWith('data:')) {
        uploadAttempted = true;
        
        if (storageStatus.available) {
          console.log('Attempting to upload image to Supabase...');
          
          try {
            const response = await fetch(selectedMedia);
            const blob = await response.blob();
            const fileName = `${generateId()}.jpg`;
            const filePath = `${currentUser.id}/${fileName}`;
            const file = new File([blob], fileName, { type: blob.type });
            const uploadedPath = await uploadPostImage(file, filePath);
            const { data: urlData } = supabase.storage.from('posts').getPublicUrl(uploadedPath);
            const uploadedUrl = urlData.publicUrl;

            if (uploadedUrl) {
              mediaUrl = uploadedUrl;
              console.log('Image uploaded successfully:', uploadedUrl);
            } else {
              console.warn('Image upload failed, using placeholder');
              mediaUrl = generatePlaceholderImage();
            }
          } catch (uploadError) {
            console.error('Upload error:', uploadError);
            mediaUrl = generatePlaceholderImage();
          }
        } else {
          console.warn('Storage not available, using placeholder image');
          mediaUrl = generatePlaceholderImage();
        }
      } else if (!selectedMedia) {
        // If no media selected, use a placeholder
        mediaUrl = generatePlaceholderImage();
      }

      // Create post using the posts service
      const newPost = await createPost({
        title: `Post by ${currentUser.name}`,
        caption: caption.trim() || 'New post from Zenlit!',
        mediaUrl: mediaUrl!,
        mediaType: 'image'
      });

      if (!newPost) {
        throw new Error('Failed to create post');
      }

      console.log('Post created successfully:', newPost);
      
      setIsPosting(false);
      setShowSuccess(true);
      
      // Reset form after success animation
      setTimeout(() => {
        setCaption('');
        setSelectedMedia(null);
        setShowSuccess(false);
      }, 2000);

    } catch (error) {
      console.error('Post creation error:', error);
      setIsPosting(false);
      
      // Show user-friendly error message
      if (error instanceof Error) {
        if (error.message.includes('storage') || error.message.includes('bucket')) {
          alert('Image upload is currently unavailable. Your post was created with a placeholder image.');
        } else if (error.message.includes('posts') || error.message.includes('database')) {
          alert('Failed to save post. Please try again.');
        } else {
          alert(`Failed to create post: ${error.message}`);
        }
      } else {
        alert('Failed to create post. Please try again.');
      }
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    
    try {
      // Check if we're on HTTPS or localhost
      const isSecure = location.protocol === 'https:' || location.hostname === 'localhost';
      
      if (!isSecure) {
        throw new Error('Camera access requires HTTPS or localhost');
      }

      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported in this browser');
      }

      console.log('Requesting camera access...');
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      
      console.log('Camera access granted');
      setStream(mediaStream);
      setShowCamera(true);
      
      // Wait for video element to be ready
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(err => {
            console.error('Error playing video:', err);
            setCameraError('Failed to start camera preview');
          });
        }
      }, 100);
      
    } catch (error: any) {
      console.error('Camera error:', error);
      
      let errorMessage = 'Unable to access camera. ';
      
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Please allow camera permissions and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No camera found on this device.';
      } else if (error.name === 'NotReadableError') {
        errorMessage += 'The camera is currently in use by another application or process. Please close other applications that might be using the camera and try again.';
      } else if (error.name === 'NotSupportedError') {
        errorMessage += 'Camera is not supported in this browser.';
      } else if (error.message.includes('HTTPS')) {
        errorMessage += 'Camera requires HTTPS connection.';
      } else {
        errorMessage += error.message || 'Unknown error occurred.';
      }
      
      setCameraError(errorMessage);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('Camera track stopped');
      });
      setStream(null);
    }
    setShowCamera(false);
    setCameraError(null);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context && video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        
        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setSelectedMedia(imageDataUrl);
        stopCamera();
      } else {
        setCameraError('Camera preview not ready. Please try again.');
      }
    }
  };

  const openGallery = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check if it's an image
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setSelectedMedia(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        alert('Please select an image file');
      }
    }
  };

  const handleMediaSelect = (type: 'camera' | 'gallery') => {
    if (type === 'camera') {
      startCamera();
    } else {
      openGallery();
    }
  };

  const removeMedia = () => {
    setSelectedMedia(null);
  };

  // Show loading if user not loaded yet
  if (isLoading) {
    return (
      <div className="h-full bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show error if no user available
  if (!currentUser) {
    return (
      <div className="h-full bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <XMarkIcon className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Unable to Load Profile</h2>
          <p className="text-gray-400">Please try refreshing the page or logging in again.</p>
        </div>
      </div>
    );
  }

  if (isDemo) {
    return (
      <div className="h-full bg-black flex items-center justify-center">
        <p className="text-gray-400">Posting is disabled for demo accounts.</p>
      </div>
    );
  }

  // Success Animation Component
  if (showSuccess) {
    return (
      <div className="h-full bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <CheckIcon className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Post Shared!</h2>
          <p className="text-gray-400">Your post has been saved successfully</p>
        </div>
      </div>
    );
  }

  // Camera Error Display
  if (cameraError) {
    return (
      <div className="h-full bg-black flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <XMarkIcon className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Camera Error</h2>
          <p className="text-gray-300 mb-6">{cameraError}</p>
          <div className="space-y-3">
            <button
              onClick={() => {
                setCameraError(null);
                startCamera();
              }}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 active:scale-95 transition-all"
            >
              Try Again
            </button>
            <button
              onClick={() => setCameraError(null)}
              className="w-full bg-gray-600 text-white py-3 rounded-lg font-medium hover:bg-gray-700 active:scale-95 transition-all"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Camera Preview Component
  if (showCamera) {
    return (
      <div className="h-full bg-black flex flex-col">
        {/* Camera Header */}
        <div className="flex items-center justify-between p-4 bg-black/80 backdrop-blur-sm">
          <button
            onClick={stopCamera}
            className="text-white p-2 rounded-full hover:bg-gray-800 active:scale-95 transition-all"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold text-white">Take Photo</h1>
          <div className="w-10" /> {/* Spacer */}
        </div>

        {/* Camera Preview */}
        <div className="flex-1 relative overflow-hidden bg-gray-900">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            onLoadedMetadata={() => {
              console.log('Video metadata loaded');
            }}
            onError={(e) => {
              console.error('Video error:', e);
              setCameraError('Failed to load camera preview');
            }}
          />
          
          {/* Camera Controls */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center">
            <button
              onClick={capturePhoto}
              className="w-16 h-16 bg-white rounded-full border-4 border-gray-300 hover:border-gray-400 active:scale-95 transition-all shadow-lg flex items-center justify-center"
            >
              <div className="w-12 h-12 bg-white rounded-full" />
            </button>
          </div>
        </div>

        {/* Hidden canvas for photo capture */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-black">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-sm border-b border-gray-800">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-xl font-bold text-white">Create Post</h1>
          <button
            onClick={handlePost}
            disabled={(!selectedMedia && !caption.trim()) || isPosting}
            className="bg-blue-600 text-white px-6 py-2 rounded-full font-medium hover:bg-blue-700 active:scale-95 transition-all disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isPosting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sharing...
              </>
            ) : (
              'Share'
            )}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-6 pb-20">
        {/* Storage Status Info (only show if there might be issues) */}
        {!storageStatus.available && (
          <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-blue-300 mb-1">Storage Info</h3>
                <p className="text-xs text-blue-200">
                  {storageStatus.message}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* User Info */}
        <div className="flex items-center space-x-3">
          <img
            src={currentUser.profile_photo_url || '/images/default-avatar.png'}
            alt="Your profile"
            className="w-10 h-10 rounded-full object-cover ring-2 ring-blue-500"
          />
          <div>
            <h3 className="font-semibold text-white">{currentUser.name}</h3>
          </div>
        </div>

        {/* Caption Input */}
        <div>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="What's happening?"
            className="w-full h-32 px-0 py-0 bg-transparent border-none text-white placeholder-gray-400 focus:outline-none resize-none text-lg"
            maxLength={500}
          />
          <div className="flex justify-end mt-2">
            <span className={`text-xs ${caption.length > 450 ? 'text-red-400' : 'text-gray-400'}`}>
              {caption.length}/500
            </span>
          </div>
        </div>

        {/* Selected Media Preview */}
        {selectedMedia && (
          <div className="relative">
            <img
              src={selectedMedia}
              alt="Selected media"
              className="w-full h-64 object-cover rounded-lg"
            />
            <button
              onClick={removeMedia}
              className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm p-2 rounded-full text-white hover:bg-black/80 active:scale-95 transition-all"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Media Upload Options */}
        {!selectedMedia && (
          <div className="border-2 border-dashed border-gray-700 rounded-xl p-8">
            <div className="text-center">
              <div className="flex justify-center space-x-6 mb-4">
                <button 
                  onClick={() => handleMediaSelect('camera')}
                  className="flex flex-col items-center p-6 bg-gray-800 rounded-xl hover:bg-gray-700 active:scale-95 transition-all"
                >
                  <CameraIcon className="w-10 h-10 text-blue-400 mb-3" />
                  <span className="text-sm font-medium text-white">Camera</span>
                  <span className="text-xs text-gray-400 mt-1">Take a photo</span>
                </button>
                <button 
                  onClick={() => handleMediaSelect('gallery')}
                  className="flex flex-col items-center p-6 bg-gray-800 rounded-xl hover:bg-gray-700 active:scale-95 transition-all"
                >
                  <PhotoIcon className="w-10 h-10 text-green-400 mb-3" />
                  <span className="text-sm font-medium text-white">Gallery</span>
                  <span className="text-xs text-gray-400 mt-1">Choose from library</span>
                </button>
              </div>
              <p className="text-gray-400 text-sm">Add photos or videos to your post</p>
            </div>
          </div>
        )}

        {/* Hidden file input for gallery selection */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  );
};