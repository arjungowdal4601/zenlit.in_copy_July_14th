import React, { useState, useEffect } from 'react';
import { User, Post } from '../types';
import { ChevronLeftIcon, TrashIcon } from '@heroicons/react/24/outline';
import { BoltBadge } from '../components/common/BoltBadge';
import { formatPostDate } from '../utils/dateUtils';
import { deletePost } from '../lib/posts';
import { supabase } from '../lib/supabase';

interface Props {
  user: User;
  posts?: Post[];
  onBack: () => void;
  onUserClick?: (userId: string) => void;
  onPostDeleted?: (postId: string) => void;
}

export const PostsGalleryScreen: React.FC<Props> = ({ 
  user, 
  posts = [], 
  onBack, 
  onUserClick,
  onPostDeleted 
}) => {
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  
  // Only use real posts from props - no more mock data generation
  const displayPosts = posts;

  useEffect(() => {
    // Get current user ID to show delete buttons only for own posts
    const getCurrentUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (user && !error) {
          setCurrentUserId(user.id);
        }
      } catch (error) {
        console.error('Error getting current user:', error);
      }
    };

    getCurrentUser();
  }, []);

  const handleDeletePost = async (post: Post) => {
    if (!confirm(`Are you sure you want to delete this post: "${post.caption}"?`)) {
      return;
    }

    setDeletingPostId(post.id);

    try {
      const result = await deletePost(post.id, currentUserId);
      
      if (result.success) {
        // Notify parent component about the deletion
        if (onPostDeleted) {
          onPostDeleted(post.id);
        }
      } else {
        alert(result.error || 'Failed to delete post');
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('An error occurred while deleting the post');
    } finally {
      setDeletingPostId(null);
    }
  };

  return (
    <div className="h-full bg-black overflow-y-auto">
      {/* Bolt.new Badge */}
      <BoltBadge />

      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-sm border-b border-gray-800">
        <div className="flex items-center px-4 py-3">
          <button
            onClick={onBack}
            className="mr-3 p-2 rounded-full hover:bg-gray-800 active:scale-95 transition-all"
          >
            <ChevronLeftIcon className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center">
            <img
              src={user.dpUrl}
              alt={user.name}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-blue-500 mr-3"
            />
            <div>
              <h1 className="text-lg font-semibold text-white">{user.name}&apos;s Posts</h1>
              {displayPosts.length > 0 && (
                <p className="text-xs text-gray-400">
                  {displayPosts.length} post{displayPosts.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Posts Feed */}
      <div className="px-4 py-4">
        {displayPosts.length > 0 ? (
          <div className="space-y-6">
            {displayPosts.map((post) => (
              <div key={post.id} className="bg-gray-900 rounded-lg overflow-hidden">
                {/* Post Header */}
                <div className="flex items-center justify-between px-4 py-3">
                  <button
                    onClick={() => onUserClick?.(post.userId)}
                    className="flex items-center space-x-3 hover:bg-gray-800 active:bg-gray-700 transition-colors rounded-lg p-2 -m-2"
                  >
                    <img
                      src={post.userDpUrl}
                      alt={post.userName}
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-blue-500"
                    />
                    <div className="text-left">
                      <h3 className="font-semibold text-white">{post.userName}</h3>
                      <p className="text-xs text-gray-400">
                        {formatPostDate(post.timestamp)}
                      </p>
                    </div>
                  </button>

                  {/* Delete button - only show for current user's posts */}
                  {currentUserId === post.userId && (
                    <button
                      onClick={() => handleDeletePost(post)}
                      disabled={deletingPostId === post.id}
                      className="p-2 rounded-full hover:bg-red-600/20 text-red-500 hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete post"
                    >
                      {deletingPostId === post.id ? (
                        <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <TrashIcon className="w-5 h-5" />
                      )}
                    </button>
                  )}
                </div>

                {/* Post Image */}
                <img
                  src={post.mediaUrl}
                  alt={post.title}
                  className="w-full aspect-square object-cover"
                />

                {/* Post Content */}
                <div className="p-4">
                  <p className="text-gray-200 leading-relaxed">{post.caption}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-400 mb-2">No posts yet</p>
            <p className="text-gray-500 text-sm">Posts will appear here when shared</p>
          </div>
        )}
      </div>
    </div>
  );
};