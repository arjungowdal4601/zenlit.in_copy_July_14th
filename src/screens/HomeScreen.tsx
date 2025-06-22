import React, { useState, useEffect } from 'react';
import { PostsFeed } from '../components/post/PostsFeed';
import { UserProfile } from '../components/profile/UserProfile';
import { User, Post } from '../types';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import { supabase } from '../lib/supabase';
import { getAllPosts } from '../lib/posts';

interface Props {
  userGender: 'male' | 'female';
}

export const HomeScreen: React.FC<Props> = ({ userGender }) => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    loadCurrentUserAndPosts();
  }, []);

  const loadCurrentUserAndPosts = async () => {
    try {
      // Get current user ID first
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('Error getting current user:', userError);
        setIsLoading(false);
        return;
      }

      setCurrentUserId(user.id);
      console.log('Current user ID:', user.id);

      // Load all posts
      const allPosts = await getAllPosts(50);
      console.log('All posts loaded:', allPosts.length);
      
      // Filter out current user's posts - only show posts from other users
      const otherUsersPosts = allPosts.filter(post => post.userId !== user.id);
      console.log('Posts from other users:', otherUsersPosts.length);
      console.log('Filtered out posts from current user:', allPosts.length - otherUsersPosts.length);
      
      setPosts(otherUsersPosts);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserClick = async (userId: string) => {
    try {
      // Get user profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error || !profile) {
        console.error('Error loading user profile:', error);
        return;
      }

      // Transform database profile to User type - use local default instead of stock image
      const transformedUser: User = {
        id: profile.id,
        name: profile.name,
        dpUrl: profile.profile_photo_url || '/images/default-avatar.png',
        bio: profile.bio,
        gender: profile.gender,
        age: profile.date_of_birth ? 
          new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear() : 25,
        distance: Math.floor(Math.random() * 50) + 1,
        links: {
          Twitter: profile.twitter_url || '#',
          Instagram: profile.instagram_url || '#',
          LinkedIn: profile.linked_in_url || '#',
        },
        instagramUrl: profile.instagram_url,
        linkedInUrl: profile.linked_in_url,
        twitterUrl: profile.twitter_url,
      };
      setSelectedUser(transformedUser);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  if (selectedUser) {
    return (
      <div className="min-h-full bg-black">
        <button
          onClick={() => setSelectedUser(null)}
          className="fixed top-4 left-4 z-50 bg-gray-900/80 backdrop-blur-sm p-3 rounded-full shadow-lg active:scale-95 transition-transform"
        >
          <ChevronLeftIcon className="w-5 h-5 text-white" />
        </button>
        <UserProfile user={selectedUser} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-full bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading feed...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-black">
      {/* Header */}
      <div className="bg-black border-b border-gray-800">
        <div className="px-4 py-3 flex items-center">
          <svg className="w-8 h-8 mr-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h1 className="text-xl font-bold text-white">Feed</h1>
        </div>
      </div>

      {/* Posts Feed - Only showing posts from other users */}
      <div className="px-4 py-4 space-y-6 pb-20">
        {posts.length > 0 ? (
          <PostsFeed posts={posts} onUserClick={handleUserClick} />
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <p className="text-gray-400 mb-2">No posts from other users yet</p>
            <p className="text-gray-500 text-sm">
              {currentUserId ? 
                "When other users create posts, they'll appear here!" : 
                "Posts from the community will appear here!"
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};