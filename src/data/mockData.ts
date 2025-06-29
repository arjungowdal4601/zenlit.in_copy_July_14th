// This file now only contains utility functions for managing real data
import { Message, Post, User } from '../types';

export const demoUser: User = {
  id: 'demo-user',
  name: 'Zenlit Demo',
  username: 'demo',
  dpUrl: '/images/default-avatar.png',
  bio: 'Demo user account',
  gender: 'male',
  age: 30,
  distance: 0,
  links: {
    Twitter: '#',
    Instagram: 'https://instagram.com/zenlit',
    LinkedIn: 'https://linkedin.com/company/zenlit'
  },
  latitude: 12.9716,
  longitude: 77.5946,
  coverPhotoUrl: '',
  instagramUrl: 'https://instagram.com/zenlit',
  linkedInUrl: 'https://linkedin.com/company/zenlit',
  twitterUrl: '#',
  isDemo: true
};

export const demoPosts: Post[] = [
  {
    id: 'demo-post-1',
    userId: demoUser.id,
    userName: demoUser.name,
    userDpUrl: demoUser.dpUrl,
    title: 'Demo Post 1',
    mediaUrl: 'https://source.unsplash.com/random/800x600?city',
    caption: 'Welcome to Zenlit!',
    timestamp: new Date().toISOString()
  },
  {
    id: 'demo-post-2',
    userId: demoUser.id,
    userName: demoUser.name,
    userDpUrl: demoUser.dpUrl,
    title: 'Demo Post 2',
    mediaUrl: 'https://source.unsplash.com/random/800x600?nature',
    caption: 'Exploring the app',
    timestamp: new Date().toISOString()
  },
  {
    id: 'demo-post-3',
    userId: demoUser.id,
    userName: demoUser.name,
    userDpUrl: demoUser.dpUrl,
    title: 'Demo Post 3',
    mediaUrl: 'https://source.unsplash.com/random/800x600?technology',
    caption: 'Follow us on social media',
    timestamp: new Date().toISOString()
  }
];

export const demoMessages: Message[] = [
  {
    id: 'msg-1',
    senderId: demoUser.id,
    receiverId: 'friend-1',
    content: 'Hey there! Thanks for trying the demo.',
    timestamp: new Date().toISOString(),
    read: true
  },
  {
    id: 'msg-2',
    senderId: 'friend-1',
    receiverId: demoUser.id,
    content: 'Looks great!',
    timestamp: new Date().toISOString(),
    read: true
  }
];

export function getMessagesForUsers(currentUserId: string, messages: Message[], userId: string): Message[] {
  return messages.filter(msg => 
    (msg.senderId === currentUserId && msg.receiverId === userId) ||
    (msg.senderId === userId && msg.receiverId === currentUserId)
  );
}

export function getLatestMessageForUser(messages: Message[], userId: string): Message | undefined {
  return messages
    .filter(msg => msg.senderId === userId || msg.receiverId === userId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .shift();
}