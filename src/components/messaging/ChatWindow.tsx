import { useState, useEffect, useRef } from 'react';
import { Message, User } from '../../types';
import { supabase } from '../../lib/supabase';
import { markMessagesAsRead } from '../../lib/messages';
import { isValidUuid } from '../../utils/uuid';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';

interface ChatWindowProps {
  user: User;
  messages: Message[];
  onSendMessage: (content: string) => void;
  currentUserId: string;
  readOnly?: boolean;
  onBack?: () => void;
  onViewProfile?: (user: User) => void;
}

export const ChatWindow = ({
  user,
  messages,
  onSendMessage,
  currentUserId,
  readOnly = false,
  onBack,
  onViewProfile
}: ChatWindowProps) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>(messages);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  useEffect(() => {
    setChatMessages(messages);
    scrollToBottom();
  }, [messages]);

  // Subscribe to realtime messages for this conversation
  useEffect(() => {
    const channel = supabase.channel(`chat-${currentUserId}-${user.id}`);

    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => {
        const data = payload.new as any;
        const newMessage: Message = {
          id: data.id,
          senderId: data.sender_id,
          receiverId: data.receiver_id,
          content: data.content,
          timestamp: data.created_at,
          read: data.read,
        };

        if (
          (newMessage.senderId === user.id && newMessage.receiverId === currentUserId) ||
          (newMessage.senderId === currentUserId && newMessage.receiverId === user.id)
        ) {
          setChatMessages((prev) => {
            if (prev.some((m) => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
          });

          // Mark message as read if it's from the other user
          if (newMessage.senderId === user.id && isValidUuid(currentUserId)) {
            markMessagesAsRead(currentUserId, user.id);
          }
        }
      }
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, user.id]);

  // Mark existing unread messages as read on mount
  useEffect(() => {
    if (isValidUuid(currentUserId)) {
      markMessagesAsRead(currentUserId, user.id);
    }
  }, [currentUserId, user.id]);

  const isAnonymous = user.name === 'Anonymous';

  const handleProfileClick = () => {
    if (isAnonymous) return;
    if (onViewProfile) {
      onViewProfile(user);
    }
  };

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Pinned Chat Header with Back Button */}
      <div className="sticky top-0 z-10 bg-black/90 backdrop-blur-sm border-b border-gray-800">
        <div className="flex items-center px-4 py-3">
          {onBack && (
            <button
              onClick={onBack}
              className="mr-3 p-2 rounded-full hover:bg-gray-800 active:scale-95 transition-all"
            >
              <ChevronLeftIcon className="w-5 h-5 text-white" />
            </button>
          )}
          
          {/* Clickable profile area */}
          <button
            onClick={handleProfileClick}
            disabled={isAnonymous}
            title={isAnonymous ? 'User not available' : undefined}
            className={`flex items-center flex-1 rounded-lg p-2 -m-2 transition-colors ${
              isAnonymous
                ? 'cursor-not-allowed text-gray-400'
                : 'hover:bg-gray-800/50 active:scale-95'
            }`}
          >
            <img 
              src={user.dpUrl} 
              alt={user.name} 
              className="w-9 h-9 rounded-full object-cover ring-2 ring-blue-500 mr-3"
            />
            <div className="text-left">
              <h3 className="font-semibold text-white">{user.name}</h3>
            </div>
          </button>
        </div>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {chatMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <img 
                src={user.dpUrl} 
                alt={user.name} 
                className="w-16 h-16 rounded-full mx-auto mb-4"
              />
              <p className="text-gray-400">Start a conversation with {user.name}</p>
            </div>
          </div>
        ) : (
          <>
            {chatMessages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isCurrentUser={message.senderId === currentUserId}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      <div className="border-t border-gray-800 p-4">
        {readOnly ? (
          <p className="text-center text-sm text-gray-400">Messaging is read-only in demo mode.</p>
        ) : (
          <MessageInput onSendMessage={onSendMessage} />
        )}
      </div>
    </div>
  );
};