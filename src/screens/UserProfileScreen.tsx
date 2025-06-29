import { useEffect, useState } from 'react';
import { User, Post } from '../types';
import { UserProfile } from '../components/profile/UserProfile';
import { PostsGalleryScreen } from './PostsGalleryScreen';
import { ChevronLeftIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { getUserPosts } from '../lib/posts';
import { BoltBadge } from '../components/common/BoltBadge';
import { demoPosts } from '../data/mockData';

interface Props {
  user: User;
  onBack?: () => void;
  onEditProfile?: () => void;
  onLogout?: () => void;
}

export const UserProfileScreen: React.FC<Props> = ({ user, onBack, onEditProfile, onLogout }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showGallery, setShowGallery] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const loadPosts = async () => {
      setIsLoading(true);
      if (user.isDemo) {
        setPosts(demoPosts);
      } else {
        const loaded = await getUserPosts(user.id);
        setPosts(loaded);
      }
      setIsLoading(false);
    };
    loadPosts();
  }, [user]);

  if (showGallery) {
    return (
      <PostsGalleryScreen
        user={user}
        posts={posts}
        onBack={() => setShowGallery(false)}
        onUserClick={() => {}}
      />
    );
  }

  return (
    <div className="min-h-full bg-black">
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-sm">
        <div className="flex items-center justify-between p-4">
          {/* Left side - Badge and Settings */}
          <div className="flex items-center gap-3">
            <BoltBadge />
            {(onEditProfile || onLogout) && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu((m) => !m)}
                  className="p-2 bg-gray-900/80 backdrop-blur-sm rounded-full shadow-lg hover:bg-gray-800 active:scale-95 transition-all"
                >
                  <Cog6ToothIcon className="w-5 h-5 text-white" />
                </button>
                {showMenu && (
                  <div className="absolute top-12 left-0 bg-gray-800 rounded-lg shadow-lg py-1 min-w-[120px]">
                    {onEditProfile && (
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          onEditProfile();
                        }}
                        className="block px-4 py-2 text-sm text-white hover:bg-gray-700 w-full text-left"
                      >
                        Edit Profile
                      </button>
                    )}
                    {onLogout && (
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          onLogout();
                        }}
                        className="block px-4 py-2 text-sm text-white hover:bg-gray-700 w-full text-left"
                      >
                        Logout
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Right side - Back Button */}
          {onBack && (
            <button
              onClick={onBack}
              className="p-3 bg-gray-900/80 backdrop-blur-sm rounded-full shadow-lg active:scale-95 transition-transform"
            >
              <ChevronLeftIcon className="w-5 h-5 text-white" />
            </button>
          )}
        </div>
      </div>
      
      {/* Content with top padding to account for fixed header */}
      <div className="pt-20">
        {isLoading ? (
          <div className="min-h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Loading profile...</p>
            </div>
          </div>
        ) : (
          <UserProfile user={user} posts={posts} onPostClick={() => setShowGallery(true)} />
        )}
      </div>
    </div>
  );
};