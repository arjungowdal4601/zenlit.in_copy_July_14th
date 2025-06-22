'use client'
import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { CameraIcon, CheckIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';
import { supabase } from '../../lib/supabase';
import { uploadProfileImage } from '../../lib/utils';
import { completeProfileSetup } from '../lib/auth';
import { reserveUsername, checkUsernameAvailability } from '../lib/username';
import { UsernameInput } from '../components/common/UsernameInput';

interface Props {
  onComplete: (profileData: any) => void;
  onBack?: () => void;
}

export const ProfileSetupScreen: React.FC<Props> = ({ onComplete, onBack }) => {
  const [step, setStep] = useState<'basic' | 'photo' | 'bio'>('basic');
  const [isLoading, setIsLoading] = useState(false);
  const [isUsernameValid, setIsUsernameValid] = useState(false);
  const [profileData, setProfileData] = useState({
    displayName: '',
    username: '',
    dateOfBirth: '',
    gender: '' as 'male' | 'female' | '',
    profilePhoto: null as string | null,
    bio: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (field: string, value: any) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleUsernameValidation = (isValid: boolean, username: string) => {
    setIsUsernameValid(isValid);
    if (username !== profileData.username) {
      handleInputChange('username', username);
    }
  };

  const handlePhotoSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfileData(prev => ({
          ...prev,
          profilePhoto: e.target?.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const canProceedFromBasic = () => {
    return profileData.displayName.trim() && 
           profileData.username.trim() &&
           isUsernameValid &&
           profileData.dateOfBirth && 
           profileData.gender;
  };

  const handleNext = () => {
    if (step === 'basic' && canProceedFromBasic()) {
      setStep('photo');
    } else if (step === 'photo') {
      setStep('bio');
    }
  };

  const handleBack = () => {
    if (step === 'photo') {
      setStep('basic');
    } else if (step === 'bio') {
      setStep('photo');
    } else if (onBack) {
      onBack();
    }
  };

  const handleComplete = async () => {
    if (!profileData.bio.trim()) {
      alert('Please add a bio to complete your profile');
      return;
    }

    // CRITICAL: Double-check username availability immediately before proceeding
    if (!profileData.username.trim()) {
      alert('Please choose a username');
      return;
    }

    console.log('Final username validation before profile completion...');
    
    // Perform immediate username check (bypass debounce)
    try {
      const usernameCheck = await checkUsernameAvailability(profileData.username);
      
      if (!usernameCheck.available) {
        alert(`Username error: ${usernameCheck.error || 'Username is not available'}`);
        setStep('basic'); // Go back to basic info step
        return;
      }
      
      console.log('Username is available, proceeding with profile setup');
    } catch (error) {
      console.error('Username validation error:', error);
      alert('Unable to verify username availability. Please try again.');
      return;
    }

    setIsLoading(true);

    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('User not found');
      }

      // First, reserve the username
      console.log('Reserving username:', profileData.username);
      const usernameResult = await reserveUsername(profileData.username, user.id);
      
      if (!usernameResult.success) {
        throw new Error(usernameResult.error || 'Failed to reserve username');
      }

      let profilePhotoUrl: string | null = null;

      // Handle profile photo upload if a new photo was selected
      if (profileData.profilePhoto && profileData.profilePhoto.startsWith('data:')) {
        console.log('Uploading profile photo...');
        
        // FIXED: Properly handle the upload response object
        const uploadResult = await uploadProfileImage(user.id, profileData.profilePhoto);
        
        if (uploadResult && typeof uploadResult === 'string') {
          // If uploadResult is a string, it's the URL
          profilePhotoUrl = uploadResult;
          console.log('Profile photo uploaded successfully:', profilePhotoUrl);
        } else if (uploadResult && typeof uploadResult === 'object' && uploadResult.publicUrl) {
          // If uploadResult is an object with publicUrl, extract it
          profilePhotoUrl = uploadResult.publicUrl;
          console.log('Profile photo uploaded successfully:', profilePhotoUrl);
        } else {
          // Photo upload failed, but continue with profile creation
          console.warn('Profile photo upload failed, continuing without photo');
          profilePhotoUrl = null;
        }
      }

      // Complete profile setup using the auth service
      const result = await completeProfileSetup({
        fullName: profileData.displayName,
        username: profileData.username,
        bio: profileData.bio,
        dateOfBirth: profileData.dateOfBirth,
        gender: profileData.gender,
        profilePhotoUrl: profilePhotoUrl || undefined // FIXED: Extract publicUrl properly
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to complete profile setup');
      }

      console.log('Profile setup completed successfully');
      
      // Complete profile setup with the updated data from database
      onComplete(result.data);

    } catch (error) {
      console.error('Profile setup error:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('username')) {
          alert(`Username error: ${error.message}`);
          setStep('basic'); // Go back to username step
        } else if (error.message.includes('avatars')) {
          alert('Failed to upload profile photo. Please ensure you have a stable internet connection and try again.');
        } else {
          alert(`Failed to save profile: ${error.message}`);
        }
      } else {
        alert('Failed to save profile. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const renderBasicInfo = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">Tell us about yourself</h2>
          <p className="text-gray-400">Let&apos;s set up your profile</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Display Name *
        </label>
        <input
          type="text"
          value={profileData.displayName}
          onChange={(e) => handleInputChange('displayName', e.target.value)}
          className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="How should people know you?"
          maxLength={50}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Username *
        </label>
        <UsernameInput
          value={profileData.username}
          onChange={(value) => handleInputChange('username', value)}
          onValidationChange={handleUsernameValidation}
          placeholder="username123"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Date of Birth *
        </label>
        <input
          type="date"
          value={profileData.dateOfBirth}
          onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
          className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [color-scheme:dark]"
          max={new Date(new Date().setFullYear(new Date().getFullYear() - 13)).toISOString().split('T')[0]}
          placeholder=""
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Gender *
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleInputChange('gender', 'male')}
            className={`p-3 rounded-lg border-2 transition-all ${
              profileData.gender === 'male'
                ? 'border-blue-500 bg-blue-600/20 text-blue-400'
                : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-500'
            }`}
          >
            Male
          </button>
          <button
            type="button"
            onClick={() => handleInputChange('gender', 'female')}
            className={`p-3 rounded-lg border-2 transition-all ${
              profileData.gender === 'female'
                ? 'border-blue-500 bg-blue-600/20 text-blue-400'
                : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-500'
            }`}
          >
            Female
          </button>
        </div>
      </div>
    </motion.div>
  );

  const renderPhotoStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Add a profile photo</h2>
        <p className="text-gray-400">Help others recognize you</p>
      </div>

      <div className="flex flex-col items-center space-y-6">
        <div className="relative">
          {profileData.profilePhoto ? (
            <img
              src={profileData.profilePhoto}
              alt="Profile"
              className="w-32 h-32 rounded-full object-cover border-4 border-blue-500"
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-gray-800 border-4 border-gray-600 flex items-center justify-center">
              <CameraIcon className="w-12 h-12 text-gray-400" />
            </div>
          )}
          
          <button
            onClick={handlePhotoSelect}
            className="absolute bottom-0 right-0 bg-blue-600 p-3 rounded-full text-white hover:bg-blue-700 active:scale-95 transition-all shadow-lg"
          >
            <CameraIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="text-center">
          <button
            onClick={handlePhotoSelect}
            className="text-blue-400 hover:text-blue-300 transition-colors font-medium"
          >
            {profileData.profilePhoto ? 'Change Photo' : 'Add Photo'}
          </button>
          <p className="text-gray-500 text-sm mt-2">
            You can skip this step and add a photo later
          </p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </motion.div>
  );

  const renderBioStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Tell your story</h2>
        <p className="text-gray-400">Write a bio that represents you</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Bio *
        </label>
        <textarea
          value={profileData.bio}
          onChange={(e) => handleInputChange('bio', e.target.value)}
          className="w-full h-32 px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          placeholder="Tell people about yourself, what you're looking for..."
          maxLength={200}
        />
        <div className="flex justify-end mt-1">
          <span className={`text-xs ${profileData.bio.length > 180 ? 'text-red-400' : 'text-gray-400'}`}>
            {profileData.bio.length}/200
          </span>
        </div>
      </div>

      <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-300 mb-2">Profile Preview</h3>
        <div className="flex items-start gap-3">
          {profileData.profilePhoto ? (
            <img
              src={profileData.profilePhoto}
              alt="Profile"
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
              <span className="text-gray-400 text-xs">No Photo</span>
            </div>
          )}
          <div className="flex-1">
            <h4 className="font-semibold text-white">{profileData.displayName || 'Your Name'}</h4>
            {profileData.username && (
              <p className="text-gray-400 text-sm">@{profileData.username}</p>
            )}
            <p className="text-gray-300 text-sm mt-1">
              {profileData.bio || 'Your bio will appear here...'}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const getStepProgress = () => {
    const steps = ['basic', 'photo', 'bio'];
    return ((steps.indexOf(step) + 1) / steps.length) * 100;
  };

  const canProceed = () => {
    switch (step) {
      case 'basic':
        return canProceedFromBasic();
      case 'photo':
        return true; // Photo is optional
      case 'bio':
        return profileData.bio.trim().length > 0;
      default:
        return false;
    }
  };

  return (
    <div className="auth-screen mobile-screen bg-black">
      <div className="mobile-full-height flex flex-col p-4 py-8">
        <div className="w-full max-w-md mx-auto flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={handleBack}
              className="p-2 rounded-full hover:bg-gray-800 active:scale-95 transition-all"
            >
              <ChevronLeftIcon className="w-5 h-5 text-white" />
            </button>
            
            <div className="flex-1 mx-4">
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${getStepProgress()}%` }}
                />
              </div>
            </div>
            
            <span className="text-sm text-gray-400 min-w-0">
              {step === 'basic' && '1/3'}
              {step === 'photo' && '2/3'}
              {step === 'bio' && '3/3'}
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto mobile-scroll">
            {step === 'basic' && renderBasicInfo()}
            {step === 'photo' && renderPhotoStep()}
            {step === 'bio' && renderBioStep()}
          </div>

          {/* Footer */}
          <div className="mt-6 pt-4">
            {step === 'bio' ? (
              <button
                onClick={handleComplete}
                disabled={!canProceed() || isLoading}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 active:scale-95 transition-all disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating Profile...
                  </>
                ) : (
                  <>
                    <CheckIcon className="w-5 h-5" />
                    Complete Profile
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={!canProceed()}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 active:scale-95 transition-all disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};