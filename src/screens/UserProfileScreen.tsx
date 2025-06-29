import { useEffect, useState } from 'react';
import { User, Post } from '../types';
import { UserProfile } from '../components/profile/UserProfile';
import { PostsGalleryScreen } from './PostsGalleryScreen';
import { BoltBadge } from '../components/common/BoltBadge';
import { ChevronLeftIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { getUserPosts } from '../lib/posts';

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
      {/* Fixed Header with inline badge */}
      <div className="flex-shrink-0 bg-black/90 backdrop-blur-sm">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            {onBack && (
              <button
                onClick={onBack}
                className="mr-3 p-2 rounded-full hover:bg-gray-800 active:scale-95 transition-all"
              >
                <ChevronLeftIcon className="w-5 h-5 text-white" />
              </button>
            )}
            <div>
              <h1 className="text-xl font-bold text-white">{user.name}</h1>
              <p className="text-xs text-gray-400">Profile</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Settings Menu */}
            {(onEditProfile || onLogout) && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu((m) => !m)}
                  className="p-2 bg-gray-800/50 rounded-full shadow-lg hover:bg-gray-700 active:scale-95 transition-all"
                >
                  <Cog6ToothIcon className="w-5 h-5 text-white" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 mt-2 bg-gray-800 rounded-lg shadow-lg py-1 min-w-[120px] z-50">
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
            
            {/* Bolt Badge */}
            <BoltBadge />
          </div>
        </div>
      </div>

      {/* Scrollable Profile Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
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