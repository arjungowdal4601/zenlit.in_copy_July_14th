import React, { useState, useEffect } from 'react';
import { PostsFeed } from '../components/post/PostsFeed';
import { UserProfile } from '../components/profile/UserProfile';
import { PostsGalleryScreen } from './PostsGalleryScreen';
import { User, Post } from '../types';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import { supabase } from '../lib/supabase';
import { getAllPosts, getUserPosts } from '../lib/posts';
import { getNearbyUsers } from '../lib/location';
import { transformProfileToUser } from '../../lib/utils';
import { BoltBadge } from '../components/common/BoltBadge';
import { isDemoUser } from '../utils/demo';
import { demoPosts } from '../data/mockData';

interface Props {
  userGender: 'male' | 'female';
}

export const HomeScreen: React.FC<Props> = ({ userGender }) => {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUserPosts, setSelectedUserPosts] = useState<Post[]>([]);
  const [showPostsGallery, setShowPostsGallery] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserLocation, setCurrentUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingUserProfile, setIsLoadingUserProfile] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  
  useEffect(() => {
    loadCurrentUserAndNearbyPosts();
  }, []);

  const loadCurrentUserAndNearbyPosts = async () => {
    try {
      // Get current user ID and location first
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      setIsDemo(isDemoUser(user?.email));
      
      if (userError || !user) {
        console.error('Error getting current user:', userError);
        setIsLoading(false);
        return;
      }

      if (isDemoUser(user?.email)) {
        setPosts(demoPosts);
        setIsLoading(false);
        return;
      }

      setCurrentUserId(user.id);
      console.log('Current user ID:', user.id);

      // Get current user's profile to check location
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('latitude, longitude')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError || !profile) {
        console.error('Error getting user profile:', profileError);
        setIsLoading(false);
        return;
      }

      // Check if user has location data
      if (!profile.latitude || !profile.longitude) {
        console.log('User has no location data - showing empty feed');
        setPosts([]);
        setIsLoading(false);
        return;
      }

      setCurrentUserLocation({
        latitude: profile.latitude,
        longitude: profile.longitude
      });

      console.log('User location:', { latitude: profile.latitude, longitude: profile.longitude });

      // Get nearby users using the same logic as radar
      const nearbyResult = await getNearbyUsers(user.id, {
        latitude: profile.latitude,
        longitude: profile.longitude,
        timestamp: Date.now()
      }, 50); // Get more users for posts

      if (!nearbyResult.success) {
        console.error('Error getting nearby users:', nearbyResult.error);
        setPosts([]);
        setIsLoading(false);
        return;
      }

      const nearbyUsers = nearbyResult.users || [];
      console.log('Found nearby users:', nearbyUsers.length);

      if (nearbyUsers.length === 0) {
        console.log('No nearby users found - showing empty feed');
        setPosts([]);
        setIsLoading(false);
        return;
      }

      // Get user IDs of nearby users
      const nearbyUserIds = nearbyUsers.map(user => user.id);
      console.log('Nearby user IDs:', nearbyUserIds);

      // Load all posts
      const allPosts = await getAllPosts(100); // Get more posts to filter from
      console.log('All posts loaded:', allPosts.length);
      
      // Filter posts to only show posts from nearby users (excluding current user)
      const nearbyUsersPosts = allPosts.filter(post => 
        nearbyUserIds.includes(post.userId) && post.userId !== user.id
      );
      
      console.log('Posts from nearby users:', nearbyUsersPosts.length);
      console.log('Filtered out posts from current user and non-nearby users:', allPosts.length - nearbyUsersPosts.length);
      
      setPosts(nearbyUsersPosts);
    } catch (error) {
      console.error('Error loading nearby posts:', error);
      setPosts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserClick = async (userId: string) => {
    setIsLoadingUserProfile(true);
    try {
      console.log('Loading user profile for userId:', userId);
      
      // Get user profile from database
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error || !profile) {
        console.error('Error loading user profile:', error);
        setIsLoadingUserProfile(false);
        return;
      }

      console.log('Profile loaded:', profile);

      // Transform database profile to User type
      const transformedUser: User = transformProfileToUser(profile);
      
      console.log('Transformed user:', transformedUser);

      // Load user's posts
      const userPosts = transformedUser.isDemo ? demoPosts : await getUserPosts(userId);
      console.log('User posts loaded:', userPosts.length);

      setSelectedUser(transformedUser);
      setSelectedUserPosts(userPosts);
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setIsLoadingUserProfile(false);
    }
  };

  const handleBackFromProfile = () => {
    setSelectedUser(null);
    setSelectedUserPosts([]);
    setShowPostsGallery(false);
  };

  const handlePostClick = () => {
    setShowPostsGallery(true);
  };

  const handleBackFromGallery = () => {
    setShowPostsGallery(false);
  };

  if (selectedUser) {
    if (showPostsGallery) {
      return (
        <PostsGalleryScreen
          user={selectedUser}
          posts={selectedUserPosts}
          onBack={handleBackFromGallery}
          onUserClick={() => {}}
        />
      );
    }

    return (
      <div className="min-h-full bg-black">
        <button
          onClick={handleBackFromProfile}
          className="fixed top-4 left-4 z-50 bg-gray-900/80 backdrop-blur-sm p-3 rounded-full shadow-lg active:scale-95 transition-transform"
        >
          <ChevronLeftIcon className="w-5 h-5 text-white" />
        </button>

        {isLoadingUserProfile ? (
          <div className="min-h-full bg-black flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-400">Loading profile...</p>
            </div>
          </div>
        ) : (
          <UserProfile
            user={selectedUser}
            posts={selectedUserPosts}
            onPostClick={handlePostClick}
          />
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-full bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading nearby posts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-black flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-black border-b border-gray-800">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <svg className="w-8 h-8 mr-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <div>
              <h1 className="text-xl font-bold text-white">Nearby Feed</h1>
              <p className="text-xs text-gray-400">Posts from people around you</p>
            </div>
          </div>
          
          {/* Right side - Bolt Badge */}
          <BoltBadge />
        </div>
      </div>

      {/* Posts Feed - Only showing posts from nearby users */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {posts.length > 0 ? (
          <PostsFeed posts={posts} onUserClick={handleUserClick} />
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-gray-400 mb-2">No posts from nearby people</p>
            <p className="text-gray-500 text-sm">
              {!currentUserLocation ? 
                "Enable location in Radar to see posts from people around you!" : 
                "When people nearby create posts, they'll appear here!"
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};