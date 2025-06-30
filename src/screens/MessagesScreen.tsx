import { useState, useEffect, useMemo } from 'react';
import { ChatList } from '../components/messaging/ChatList';
import { ChatWindow } from '../components/messaging/ChatWindow';
import { User, Message } from '../types';
import { supabase } from '../lib/supabase';
import { sendMessage, getConversationsForUser, markMessagesAsRead } from '../lib/messages';
import { getNearbyUsers } from '../lib/location';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { isDemoUser } from '../utils/demo';
import { demoMessages, demoUser } from '../data/mockData';
import { isValidUuid } from '../utils/uuid';

interface Props {
  selectedUser?: User | null;
  onClearSelectedUser?: () => void;
  onViewProfile?: (user: User) => void;
  onNavigationVisibilityChange?: (visible: boolean) => void; // New prop to control nav visibility
  onUnreadChange?: (hasUnread: boolean) => void;
}

export const MessagesScreen: React.FC<Props> = ({
  selectedUser: initialSelectedUser,
  onClearSelectedUser,
  onViewProfile,
  onNavigationVisibilityChange,
  onUnreadChange
}) => {
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | undefined>(initialSelectedUser || undefined);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [nearbyIds, setNearbyIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isMobile] = useState(window.innerWidth < 768);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUnread, setHasUnread] = useState(false);
  const [unreadByUser, setUnreadByUser] = useState<Record<string, boolean>>({});
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    onUnreadChange?.(hasUnread);
  }, [hasUnread, onUnreadChange]);

  useEffect(() => {
    loadUsersAndMessages();
  }, []);

  useEffect(() => {
    if (initialSelectedUser) {
      setSelectedUser(initialSelectedUser);
    }
  }, [initialSelectedUser]);

  // NEW: Control navigation visibility based on chat state
  useEffect(() => {
    if (onNavigationVisibilityChange) {
      // Hide navigation when in 1-on-1 chat on mobile, show when in chat list
      const shouldShowNavigation = !selectedUser || !isMobile;
      onNavigationVisibilityChange(shouldShowNavigation);
    }

    // Cleanup: Always show navigation when component unmounts
    return () => {
      if (onNavigationVisibilityChange) {
        onNavigationVisibilityChange(true);
      }
    };
  }, [selectedUser, isMobile, onNavigationVisibilityChange]);

  useEffect(() => {
    if (selectedUser) {
      setUnreadByUser((prev) => {
        const updated = { ...prev, [selectedUser.id]: false };
        const stillUnread = Object.entries(updated).some(([id, val]) => val && id !== selectedUser.id);
        setHasUnread(stillUnread);
        return updated;
      });
      if (isValidUuid(currentUserId)) {
        markMessagesAsRead(currentUserId, selectedUser.id);
      }
    }
  }, [selectedUser, currentUserId]);

  // Listen for new messages in real time
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase.channel(`inbox-${currentUserId}`);

    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${currentUserId}` },
      (payload) => {
        const data = payload.new as any;
        const incoming: Message = {
          id: data.id,
          senderId: data.sender_id,
          receiverId: data.receiver_id,
          content: data.content,
          timestamp: data.created_at,
          read: data.read,
        };

        setAllMessages((prev) => {
          if (prev.some((m) => m.id === incoming.id)) return prev;
          return [...prev, incoming];
        });

        if (selectedUser?.id !== incoming.senderId) {
          setHasUnread(true);
          setUnreadByUser((prev) => ({ ...prev, [incoming.senderId]: true }));
        } else if (isValidUuid(currentUserId)) {
          markMessagesAsRead(currentUserId, incoming.senderId);
        }
      }
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, selectedUser]);

  const loadUsersAndMessages = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      if (!currentUser) return;

      setIsDemo(isDemoUser(currentUser.email));
      setCurrentUserId(currentUser.id);

      if (isDemoUser(currentUser.email)) {
        setAllMessages(demoMessages);
        setAllUsers([demoUser]);
        setIsLoading(false);
        return;
      }

      // Load all conversations for the current user
      const conversations = await getConversationsForUser(currentUser.id);
      setAllMessages(conversations);

      // Determine conversation partner IDs
      const partnerIds = Array.from(
        new Set(
          conversations.map(m =>
            m.senderId === currentUser.id ? m.receiverId : m.senderId
          )
        )
      );

      // Get current user's location
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('latitude, longitude')
        .eq('id', currentUser.id)
        .maybeSingle();

      let nearbyProfiles: any[] = [];
      let nearIds: string[] = [];

      if (myProfile?.latitude && myProfile?.longitude) {
        const result = await getNearbyUsers(currentUser.id, {
          latitude: myProfile.latitude,
          longitude: myProfile.longitude,
          timestamp: Date.now()
        });

        if (result.success && result.users) {
          nearbyProfiles = result.users;
          nearIds = result.users.map((u: any) => u.id);
        }
      }

      // Load profiles for conversation partners not already in nearby list
      const idsToFetch = partnerIds.filter(id => !nearIds.includes(id));

      let historyProfiles: any[] = [];
      if (idsToFetch.length > 0) {
        const { data: extraProfiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', idsToFetch);
        historyProfiles = extraProfiles || [];
      }

      const allProfiles = [...nearbyProfiles, ...historyProfiles];
      const transformedUsers: User[] = allProfiles.map(profile => ({
        id: profile.id,
        name: profile.name,
        username: profile.username,
        dpUrl: profile.profile_photo_url || '/images/default-avatar.png',
        bio: profile.bio,
        gender: profile.gender,
        age: profile.date_of_birth
          ? new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear()
          : 25,
        distance: Math.floor(Math.random() * 50) + 1,
        links: {
          Twitter: profile.twitter_url || '#',
          Instagram: profile.instagram_url || '#',
          LinkedIn: profile.linked_in_url || '#',
        },
        instagramUrl: profile.instagram_url,
        linkedInUrl: profile.linked_in_url,
        twitterUrl: profile.twitter_url,
      }));

      const finalUsers = transformedUsers.map(u => {
        if (!nearIds.includes(u.id)) {
          return { ...u, name: 'Anonymous', dpUrl: '/images/default-avatar.png' };
        }
        return u;
      });

      setAllUsers(finalUsers);
      setNearbyIds(nearIds);
    } catch (error) {
      console.error('Error loading users and messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) {
      return allUsers;
    }

    const query = searchQuery.toLowerCase().trim();
    return allUsers.filter(user => {
      const nameMatch = user.name.toLowerCase().includes(query);
      const usernameMatch = user.username?.toLowerCase().includes(query);
      const usernameWithoutAt = query.startsWith('@') ? query.slice(1) : query;
      const usernameExactMatch = user.username?.toLowerCase().includes(usernameWithoutAt);
      
      return nameMatch || usernameMatch || usernameExactMatch;
    });
  }, [allUsers, searchQuery]);

  const getMessagesForUser = (userId: string): Message[] => {
    return allMessages.filter(msg => 
      msg.senderId === userId || msg.receiverId === userId
    );
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedUser) return;
    if (!isValidUuid(currentUserId)) return;

    if (isDemo) {
      alert('Messaging is read-only in demo mode.');
      return;
    }

    const newMessage = await sendMessage(currentUserId, selectedUser.id, content);
    if (newMessage) {
      setAllMessages(prev => [...prev, newMessage]);
      setUnreadByUser((prev) => ({ ...prev, [selectedUser.id]: false }));
    }
  };

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setUnreadByUser((prev) => {
      const updated = { ...prev, [user.id]: false };
      const stillUnread = Object.entries(updated).some(([id, val]) => val && id !== user.id);
      setHasUnread(stillUnread);
      return updated;
    });
    if (isValidUuid(currentUserId)) {
      markMessagesAsRead(currentUserId, user.id);
    }
    if (onClearSelectedUser) {
      onClearSelectedUser();
    }
  };

  const handleBackToList = () => {
    setSelectedUser(undefined);
    const stillUnread = Object.values(unreadByUser).some(Boolean);
    setHasUnread(stillUnread);
    if (onClearSelectedUser) {
      onClearSelectedUser();
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  const selectedUserMessages = selectedUser ? getMessagesForUser(selectedUser.id) : [];

  if (isLoading) {
    return (
      <div className="h-full bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-black flex">
      {/* Mobile: Show either chat list or chat window */}
      {isMobile ? (
        <>
          {!selectedUser ? (
            <div className="w-full flex flex-col">
              {/* Header with Search */}
              <div className="px-4 py-3 bg-black border-b border-gray-800 flex-shrink-0">
                <h2 className="text-xl font-bold text-white mb-3">Messages</h2>
                
                {/* Search Input */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Search by name or @username"
                  />
                  {searchQuery && (
                    <button
                      onClick={clearSearch}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      <XMarkIcon className="h-5 w-5 text-gray-400 hover:text-white transition-colors" />
                    </button>
                  )}
                </div>
                
                {/* Search Results Count */}
                {searchQuery && (
                  <p className="text-sm text-gray-400 mt-2">
                    {filteredUsers.length === 0 
                      ? 'No users found' 
                      : `${filteredUsers.length} user${filteredUsers.length !== 1 ? 's' : ''} found`
                    }
                  </p>
                )}
              </div>
              
              {/* Chat List */}
              <div className="flex-1 overflow-hidden">
                <ChatList
                  users={filteredUsers}
                  messages={allMessages}
                  nearbyIds={nearbyIds}
                  selectedUser={selectedUser}
                  onSelectUser={handleSelectUser}
                  searchQuery={searchQuery}
                  unreadByUser={unreadByUser}
                />
              </div>
            </div>
          ) : (
            <div className="w-full">
              <ChatWindow
                user={selectedUser}
                messages={selectedUserMessages}
                onSendMessage={handleSendMessage}
                currentUserId={currentUserId}
                readOnly={isDemo}
                onBack={handleBackToList}
                onViewProfile={onViewProfile}
              />
            </div>
          )}
        </>
      ) : (
        /* Desktop: Show both panels */
        <>
          <div className="w-80 border-r border-gray-800 flex flex-col">
            {/* Header with Search */}
            <div className="px-4 py-3 bg-black border-b border-gray-800 flex-shrink-0">
              <h2 className="text-xl font-bold text-white mb-3">Messages</h2>
              
              {/* Search Input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Search by name or @username"
                />
                {searchQuery && (
                  <button
                    onClick={clearSearch}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-400 hover:text-white transition-colors" />
                  </button>
                )}
              </div>
              
              {/* Search Results Count */}
              {searchQuery && (
                <p className="text-sm text-gray-400 mt-2">
                  {filteredUsers.length === 0 
                    ? 'No users found' 
                    : `${filteredUsers.length} user${filteredUsers.length !== 1 ? 's' : ''} found`
                  }
                </p>
              )}
            </div>
            
            {/* Chat List */}
            <div className="flex-1 overflow-hidden">
              <ChatList
                users={filteredUsers}
                messages={allMessages}
                nearbyIds={nearbyIds}
                selectedUser={selectedUser}
                onSelectUser={handleSelectUser}
                searchQuery={searchQuery}
                unreadByUser={unreadByUser}
              />
            </div>
          </div>
          
          <div className="flex-1">
            {selectedUser ? (
              <ChatWindow
                user={selectedUser}
                messages={selectedUserMessages}
                onSendMessage={handleSendMessage}
                currentUserId={currentUserId}
                readOnly={isDemo}
                onBack={isMobile ? handleBackToList : undefined}
                onViewProfile={onViewProfile}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-gray-400">Select a conversation to start messaging</p>
                  {searchQuery && (
                    <p className="text-gray-500 text-sm mt-2">
                      Or search for someone to start a new conversation
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};