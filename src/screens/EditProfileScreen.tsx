// src/screens/EditProfileScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { ChevronLeftIcon, CameraIcon, CheckIcon, XMarkIcon, TrashIcon } from '@heroicons/react/24/outline';
import { SocialAccountsSection } from '../components/social/SocialAccountsSection';
import { uploadProfileImage, uploadBannerImage, deleteImage, extractFilePathFromUrl } from '../lib/storage';
import { supabase } from '../lib/supabaseClient';
import { transformProfileToUser } from '../../lib/utils';
import { validateImageFile } from '../utils/imageUtils';
import { BoltBadge } from '../components/common/BoltBadge';
import { isDemoUser } from '../utils/demo';

interface Props {
  user: User;
  onBack: () => void;
  onSave: (updatedUser: User) => void;
  initialPlatform?: string | null; // NEW: Platform to auto-open modal for
}

export const EditProfileScreen: React.FC<Props> = ({ user, onBack, onSave, initialPlatform }) => {
  const [formData, setFormData] = useState({
    name: user.name,
    bio: user.bio,
    instagramUrl: user.instagramUrl,
    linkedInUrl: user.linkedInUrl,
    twitterUrl: user.twitterUrl,
  });
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [profileUrl, setProfileUrl] = useState<string>(user.dpUrl);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState<string>(user.coverPhotoUrl || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [isDemo, setIsDemo] = useState(false);

  const profileFileInputRef = useRef<HTMLInputElement>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const socialAccountsSectionRef = useRef<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: auth } }) => {
      setIsDemo(isDemoUser(auth?.email));
    });
  }, []);

  console.log(`🔍 [EditProfileScreen] Component initialized with user:`, {
    id: user.id,
    name: user.name,
    instagramUrl: user.instagramUrl,
    linkedInUrl: user.linkedInUrl,
    twitterUrl: user.twitterUrl,
    initialPlatform: initialPlatform
  });

  console.log(`🔍 [EditProfileScreen] Initial formData:`, formData);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (data) {
        setProfileUrl(data.profile_photo_url || profileUrl);
        setCoverUrl(data.cover_photo_url || '');
        
        // Update formData with the latest social media URLs from database
        setFormData(prev => ({
          ...prev,
          instagramUrl: data.instagram_url || '',
          linkedInUrl: data.linked_in_url || '',
          twitterUrl: data.twitter_url || ''
        }));
      }
    })();
  }, []);

  // NEW: Auto-open specific platform modal when initialPlatform is provided
  useEffect(() => {
    if (initialPlatform && socialAccountsSectionRef.current) {
      console.log(`🔍 [EditProfileScreen] Auto-opening modal for platform: ${initialPlatform}`);
      // Small delay to ensure the SocialAccountsSection is fully rendered
      setTimeout(() => {
        if (socialAccountsSectionRef.current && socialAccountsSectionRef.current.openPlatformModal) {
          socialAccountsSectionRef.current.openPlatformModal(initialPlatform);
        }
      }, 100);
    }
  }, [initialPlatform]);

  const handleInputChange = (field: string, value: string) => {
    console.log(`🔍 [EditProfileScreen] handleInputChange - field: ${field}, value: "${value}"`);
    setFormData(prev => {
      const newFormData = { ...prev, [field]: value };
      console.log(`🔍 [EditProfileScreen] Updated formData:`, newFormData);
      return newFormData;
    });
    setHasChanges(true);
  };

  const handleUserUpdate = (u: User) => {
    console.log(`🔍 [EditProfileScreen] handleUserUpdate called with user:`, {
      id: u.id,
      instagramUrl: u.instagramUrl,
      linkedInUrl: u.linkedInUrl,
      twitterUrl: u.twitterUrl
    });

    setFormData(prev => {
      const newFormData = {
        ...prev,
        instagramUrl: u.instagramUrl,
        linkedInUrl: u.linkedInUrl,
        twitterUrl: u.twitterUrl,
      };
      console.log(`🔍 [EditProfileScreen] Updated formData after user update:`, newFormData);
      return newFormData;
    });
    setHasChanges(true);
  };

  const handleProfileImageSelect = () => {
    profileFileInputRef.current?.click();
  };

  const handleCoverImageSelect = () => {
    coverFileInputRef.current?.click();
  };

  const handleProfileFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file, 5); // 5MB limit
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setProfileUrl(url);
      setProfileFile(file);
      setHasChanges(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCoverFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file, 10); // 10MB limit
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setCoverUrl(url);
      setCoverFile(file);
      setHasChanges(true);
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteProfilePhoto = () => {
    if (confirm('Are you sure you want to remove your profile photo?')) {
      setProfileUrl('');
      setProfileFile(null);
      setHasChanges(true);
    }
  };

  const handleDeleteCoverPhoto = () => {
    if (confirm('Are you sure you want to remove your cover photo?')) {
      setCoverUrl('');
      setCoverFile(null);
      setHasChanges(true);
    }
  };

  const handleSaveProfile = async () => {
    console.log(`🔍 [EditProfileScreen] handleSaveProfile called`);
    console.log(`🔍 [EditProfileScreen] Current formData before save:`, formData);
    
    setLoading(true);
    try {
      // FIXED: Allow null values for profile and cover URLs
      let newProfileUrl: string | null = profileUrl;
      let newCoverUrl: string | null = coverUrl;

      // Handle profile photo deletion when clearing existing image
      if (!profileUrl && user.dpUrl && !user.dpUrl.includes('/images/default-')) {
        try {
          const profileFilePath = extractFilePathFromUrl(user.dpUrl, 'avatars');
          if (profileFilePath) {
            await supabase.storage.from('avatars').remove([profileFilePath]);
          }
          newProfileUrl = null; // FIXED: Now properly typed to allow null
        } catch (deleteErr) {
          console.error('Error deleting old avatar:', deleteErr);
          alert('Failed to delete previous profile photo');
        }
      } else if (profileFile) {
        // Replace existing avatar with new file
        try {
          if (user.dpUrl) {
            const oldAvatarPath = extractFilePathFromUrl(user.dpUrl, 'avatars');
            if (oldAvatarPath) {
              await supabase.storage.from('avatars').remove([oldAvatarPath]);
            }
          }
        } catch (deleteErr) {
          console.error('Error deleting old avatar:', deleteErr);
          alert('Failed to delete previous profile photo');
        }

        try {
          const { publicUrl: uploadedProfileUrl, error: profileUploadError } = await uploadProfileImage(profileFile);
          if (profileUploadError || !uploadedProfileUrl) {
            throw new Error(profileUploadError || 'Unknown error uploading profile photo.');
          }
          newProfileUrl = uploadedProfileUrl;
        } catch (uploadErr) {
          console.error('Avatar upload error:', uploadErr);
          alert(uploadErr instanceof Error ? uploadErr.message : 'Failed to upload profile photo');
        }
      }

      // Handle cover photo deletion when clearing existing image
      if (!coverUrl && user.coverPhotoUrl && !user.coverPhotoUrl.includes('/images/default-')) {
        try {
          const coverFilePath = extractFilePathFromUrl(user.coverPhotoUrl, 'banner');
          if (coverFilePath) {
            await supabase.storage.from('banner').remove([coverFilePath]);
          }
          newCoverUrl = null; // FIXED: Now properly typed to allow null
        } catch (deleteErr) {
          console.error('Error deleting old cover photo:', deleteErr);
          alert('Failed to delete previous cover photo');
        }
      } else if (coverFile) {
        // Replace existing cover with new file
        try {
          if (user.coverPhotoUrl) {
            const oldCoverPath = extractFilePathFromUrl(user.coverPhotoUrl, 'banner');
            if (oldCoverPath) {
              await supabase.storage.from('banner').remove([oldCoverPath]);
            }
          }
        } catch (deleteErr) {
          console.error('Error deleting old cover photo:', deleteErr);
          alert('Failed to delete previous cover photo');
        }

        try {
          const { publicUrl: uploadedCoverUrl, error: coverUploadError } = await uploadBannerImage(coverFile);
          if (coverUploadError || !uploadedCoverUrl) {
            // Specific error handling for RLS policy violation
            if (coverUploadError && (coverUploadError.includes('row-level security policy') || coverUploadError.includes('Unauthorized'))) {
              throw new Error('Failed to upload cover photo: Access denied due to security policy. Please ensure your account has permission.');
            }
            throw new Error(coverUploadError || 'Unknown error uploading cover photo.');
          }
          newCoverUrl = uploadedCoverUrl;
        } catch (uploadErr) {
          console.error('Cover upload error:', uploadErr);
          alert(uploadErr instanceof Error ? uploadErr.message : 'Failed to upload cover photo');
        }
      }

      // Update profile in database - only include the three social media URLs
      const updateData = {
        name: formData.name,
        bio: formData.bio,
        profile_photo_url: newProfileUrl || null,
        cover_photo_url: newCoverUrl || null,
        instagram_url: formData.instagramUrl || null,
        linked_in_url: formData.linkedInUrl || null,
        twitter_url: formData.twitterUrl || null,
        updated_at: new Date().toISOString(),
      };

      console.log(`🔍 [EditProfileScreen] Sending updateData to Supabase:`, updateData);

      const { data: updated, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        console.error(`🔍 [EditProfileScreen] Supabase update error:`, error);
        throw error;
      }

      console.log(`🔍 [EditProfileScreen] Supabase update successful:`, updated);

      setShowSuccess(true);
      setTimeout(() => {
        const transformedUser = transformProfileToUser({
          ...updated,
          profile_photo_url: newProfileUrl,
          cover_photo_url: newCoverUrl
        });
        console.log(`🔍 [EditProfileScreen] Calling onSave with transformed user:`, transformedUser);
        onSave(transformedUser);
      }, 1500);
    } catch (err) {
      console.error(`🔍 [EditProfileScreen] Save profile error:`, err);
      alert(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (!hasChanges || confirm('Discard changes?')) onBack();
  };

  if (isDemo) {
    return (
      <div className="h-full bg-black flex items-center justify-center">
        <p className="text-gray-400">Editing is disabled for demo accounts.</p>
      </div>
    );
  }

  if (showSuccess) {
    return (
      <div className="h-full bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <CheckIcon className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">Profile Updated!</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-black overflow-y-auto">
      <BoltBadge />
      
      {/* Header */}
      <div className="sticky top-0 bg-black/90 backdrop-blur-sm border-b border-gray-800 px-4 py-3 flex items-center justify-between z-50">
        <button onClick={handleCancel} className="p-2 rounded-full hover:bg-gray-800">
          <ChevronLeftIcon className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-lg font-semibold text-white">Edit Profile</h1>
        <button
          onClick={handleSaveProfile}
          disabled={loading}
          className="bg-blue-600 px-4 py-2 rounded-full text-white disabled:bg-gray-600 flex items-center gap-2"
        >
          {loading
            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : 'Save'}
        </button>
      </div>

      {/* Cover Photo Section */}
      <div className="relative h-48 bg-gray-800">
        {coverUrl ? (
          <img 
            src={coverUrl} 
            alt="Cover" 
            className="w-full h-full object-cover" 
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
            <CameraIcon className="w-12 h-12 text-gray-400" />
          </div>
        )}
        
        {/* Cover photo controls */}
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={handleCoverImageSelect}
            className="bg-black/50 backdrop-blur-sm p-2 rounded-full text-white hover:bg-black/70 transition-colors"
            title="Change cover photo"
          >
            <CameraIcon className="w-5 h-5" />
          </button>
          {coverUrl && (
            <button
              onClick={handleDeleteCoverPhoto}
              className="bg-black/50 backdrop-blur-sm p-2 rounded-full text-white hover:bg-black/70 transition-colors"
              title="Remove cover photo"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Profile Photo Section */}
      <div className="flex justify-center -mt-14 mb-6 relative z-10">
        <div className="relative">
          {profileUrl ? (
            <img 
              src={profileUrl} 
              alt="Profile" 
              className="w-28 h-28 rounded-full border-4 border-black object-cover shadow-xl" 
            />
          ) : (
            <div className="w-28 h-28 rounded-full border-4 border-black bg-gray-700 flex items-center justify-center shadow-xl">
              <CameraIcon className="w-8 h-8 text-gray-400" />
            </div>
          )}
          
          {/* Profile photo controls */}
          <div className="absolute -bottom-2 -right-2 flex gap-1">
            <button
              onClick={handleProfileImageSelect}
              className="bg-blue-600 p-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
              title="Change profile photo"
            >
              <CameraIcon className="w-4 h-4 text-white" />
            </button>
            {profileUrl && (
              <button
                onClick={handleDeleteProfilePhoto}
                className="bg-red-600 p-2 rounded-full shadow-lg hover:bg-red-700 transition-colors"
                title="Remove profile photo"
              >
                <TrashIcon className="w-4 h-4 text-white" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="px-4 space-y-8 pb-8">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Basic Information</h2>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Your display name"
              maxLength={50}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Bio
            </label>
            <textarea
              value={formData.bio}
              onChange={e => handleInputChange('bio', e.target.value)}
              className="w-full h-24 p-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Tell people about yourself…"
              maxLength={150}
            />
            <p className="text-xs text-gray-400 text-right mt-1">{formData.bio.length}/150</p>
          </div>
        </div>

        <SocialAccountsSection 
          ref={socialAccountsSectionRef}
          user={{ ...user, ...formData }} 
          onUserUpdate={handleUserUpdate} 
        />
      </div>

      {/* Hidden file inputs */}
      <input 
        ref={profileFileInputRef} 
        type="file" 
        accept="image/*" 
        onChange={handleProfileFileSelect} 
        className="hidden" 
      />
      <input 
        ref={coverFileInputRef} 
        type="file" 
        accept="image/*" 
        onChange={handleCoverFileSelect} 
        className="hidden" 
      />
    </div>
  );
};