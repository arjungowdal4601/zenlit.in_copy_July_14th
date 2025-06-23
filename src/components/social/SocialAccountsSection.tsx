import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { User, SocialProvider } from '../../types';
import { SocialLinkModal } from './SocialLinkModal';
import { 
  IconBrandInstagram, 
  IconBrandLinkedin, 
  IconBrandX
} from '@tabler/icons-react';
import { LinkIcon, PlusIcon } from '@heroicons/react/24/outline';
import { supabase } from '../../lib/supabase';
import { transformProfileToUser } from '../../../lib/utils';

interface Props {
  user: User;
  onUserUpdate: (updatedUser: User) => void;
}

// NEW: Add ref interface for external access
export interface SocialAccountsSectionRef {
  openPlatformModal: (platformId: string) => void;
}

export const SocialAccountsSection = forwardRef<SocialAccountsSectionRef, Props>(({ user, onUserUpdate }, ref) => {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  console.log(`🔍 [SocialAccountsSection] Component rendered with user:`, {
    id: user.id,
    name: user.name,
    instagramUrl: user.instagramUrl,
    linkedInUrl: user.linkedInUrl,
    twitterUrl: user.twitterUrl
  });

  const socialProviders: (SocialProvider & { 
    placeholder: string;
    getCurrentUrl: () => string | undefined;
    getIsVerified: () => boolean;
  })[] = [
    {
      id: 'instagram',
      name: 'Instagram',
      color: 'pink',
      icon: IconBrandInstagram,
      placeholder: 'https://instagram.com/yourusername',
      getCurrentUrl: () => user.instagramUrl,
      getIsVerified: () => !!user.instagramUrl // Changed from instagramVerified to just check if URL exists
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      color: 'blue',
      icon: IconBrandLinkedin,
      placeholder: 'https://linkedin.com/in/yourprofile',
      getCurrentUrl: () => user.linkedInUrl,
      getIsVerified: () => !!user.linkedInUrl // Changed from linkedInVerified to just check if URL exists
    },
    {
      id: 'twitter',
      name: 'X (Twitter)',
      color: 'gray',
      icon: IconBrandX,
      placeholder: 'https://twitter.com/yourusername',
      getCurrentUrl: () => user.twitterUrl,
      getIsVerified: () => !!user.twitterUrl // Changed from twitterVerified to just check if URL exists
    }
  ];

  // NEW: Expose method to open specific platform modal
  useImperativeHandle(ref, () => ({
    openPlatformModal: (platformId: string) => {
      console.log(`🔍 [SocialAccountsSection] Opening modal for platform: ${platformId}`);
      setActiveModal(platformId);
    }
  }));

  const handleSaveLink = async (providerId: string, url: string) => {
    console.log(`🔍 [SocialAccountsSection] handleSaveLink called for ${providerId} with URL: "${url}"`);

    setIsLoading(true);

    try {
      const columnMap: Record<string, string> = {
        instagram: 'instagram_url',
        linkedin: 'linked_in_url',
        twitter: 'twitter_url'
      };

      const column = columnMap[providerId];

      await supabase
        .from('profiles')
        .update({ [column]: url || null, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      const { data: refreshed } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (refreshed) {
        const updatedUser = transformProfileToUser(refreshed);
        onUserUpdate(updatedUser);
      }

      setActiveModal(null);
      console.log(`🔍 [SocialAccountsSection] Modal closed for ${providerId}`);
    } catch (error) {
      console.error(`🔍 [SocialAccountsSection] Failed to save ${providerId} link:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  const openModal = (providerId: string) => {
    console.log(`🔍 [SocialAccountsSection] Opening modal for ${providerId}`);
    setActiveModal(providerId);
  };

  const closeModal = () => {
    console.log(`🔍 [SocialAccountsSection] Closing modal`);
    setActiveModal(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Social Media Links</h2>
        <div className="text-sm text-gray-400">
          {socialProviders.filter(p => p.getIsVerified()).length} of {socialProviders.length} added
        </div>
      </div>
      
      <p className="text-sm text-gray-400 mb-6">
        Add links to your social media profiles to help others connect with you and build trust.
      </p>

      <div className="space-y-4">
        {socialProviders.map((provider) => {
          const currentUrl = provider.getCurrentUrl();
          const isConnected = !!currentUrl;
          const IconComponent = provider.icon;

          console.log(`🔍 [SocialAccountsSection] Rendering ${provider.id} - currentUrl: "${currentUrl}", isConnected: ${isConnected}`);

          return (
            <div key={provider.id} className="space-y-2">
              <div className="flex items-center justify-between p-4 bg-gray-800 border border-gray-600 rounded-lg">
                <div className="flex items-center space-x-3">
                  <IconComponent size={24} className="text-gray-300" />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-white">{provider.name}</h3>
                    {isConnected ? (
                      <p className="text-sm text-green-400 mt-1 truncate">
                        {currentUrl}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500">Not connected</p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => openModal(provider.id)}
                  disabled={isLoading}
                  className={`px-3 py-2 rounded-lg font-medium text-white transition-all active:scale-95 disabled:cursor-not-allowed flex items-center gap-2 text-sm ${
                    isConnected
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  {isConnected ? (
                    <>
                      <LinkIcon className="w-4 h-4" />
                      Edit Link
                    </>
                  ) : (
                    <>
                      <PlusIcon className="w-4 h-4" />
                      Add Link
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 mt-6">
        <div className="flex items-start gap-3">
          <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium text-blue-300 mb-1">Why add social links?</h3>
            <ul className="text-xs text-blue-200 space-y-1">
              <li>• Help others verify your identity</li>
              <li>• Build trust in the community</li>
              <li>• Show your authentic social presence</li>
              <li>• Make it easier for people to connect with you</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Modals */}
      {socialProviders.map((provider) => (
        <SocialLinkModal
          key={provider.id}
          isOpen={activeModal === provider.id}
          onClose={closeModal}
          onSave={(url) => handleSaveLink(provider.id, url)}
          platform={provider}
          currentUrl={provider.getCurrentUrl()}
          isLoading={isLoading}
        />
      ))}
    </div>
  );
});

SocialAccountsSection.displayName = 'SocialAccountsSection';