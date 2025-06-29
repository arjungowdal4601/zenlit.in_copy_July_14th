import { useEffect, useState } from 'react';
import { User, Post } from '../types';
import { UserProfile } from '../components/profile/UserProfile';
import { PostsGalleryScreen } from './PostsGalleryScreen';
import { ChevronLeftIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { getUserPosts } from '../lib/posts';
import { BoltBadge } from '../components/common/BoltBadge';

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
      const loaded = await getUserPosts(user.id);
      setPosts(loaded);
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
    <div className="h-full bg-black flex flex-col">
      <BoltBadge />
      
      {/* Header */}
      <div className="flex-shrink-0 bg-black/90 backdrop-blur-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-full hover:bg-gray-800 active:scale-95 transition-all"
            >
              <ChevronLeftIcon className="w-5 h-5 text-white" />
            </button>
          )}
          
          <div className="flex-1" />
          
          {(onEditProfile || onLogout) && (
            <div className="relative">
              <button
                onClick={() => setShowMenu((m) => !m)}
                className="p-2 rounded-full hover:bg-gray-800 active:scale-95 transition-all"
              >
                <Cog6ToothIcon className="w-5 h-5 text-white" />
              </button>
              {showMenu && (
                <div className="absolute top-full right-0 mt-2 bg-gray-800 rounded-lg shadow-lg py-1 z-10">
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
      </div>
      
      {/* Profile Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
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