import { supabase } from './supabase';
import { Message } from '../types';
import { isValidUuid } from '../utils/uuid';

export async function sendMessage(
  senderId: string,
  receiverId: string,
  content: string
): Promise<Message | null> {
  if (!isValidUuid(senderId) || !isValidUuid(receiverId)) {
    console.warn('sendMessage called with invalid UUIDs');
    return null;
  }
  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({ sender_id: senderId, receiver_id: receiverId, content })
      .select()
      .single();

    if (error || !data) {
      throw error;
    }

    const message: Message = {
      id: data.id,
      senderId: data.sender_id,
      receiverId: data.receiver_id,
      content: data.content,
      timestamp: data.created_at,
      read: data.read,
    };

    return message;
  } catch (err) {
    console.error('Error sending message:', err);
    return null;
  }
}

export async function getConversation(
  userId1: string,
  userId2: string
): Promise<Message[]> {
  if (!isValidUuid(userId1) || !isValidUuid(userId2)) {
    console.warn('getConversation called with invalid UUIDs');
    return [];
  }
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(
        `and(sender_id.eq.${userId1},receiver_id.eq.${userId2}),and(sender_id.eq.${userId2},receiver_id.eq.${userId1})`
      )
      .order('created_at', { ascending: true });

    if (error || !data) {
      throw error;
    }

    return data.map((row) => ({
      id: row.id,
      senderId: row.sender_id,
      receiverId: row.receiver_id,
      content: row.content,
      timestamp: row.created_at,
      read: row.read,
    }));
  } catch (err) {
    console.error('Error fetching conversation:', err);
    return [];
  }
}

export async function getConversationsForUser(
  userId: string
): Promise<Message[]> {
  if (!isValidUuid(userId)) {
    console.warn('getConversationsForUser called with invalid UUID');
    return [];
  }
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: true });

    if (error || !data) {
      throw error;
    }

    return data.map((row) => ({
      id: row.id,
      senderId: row.sender_id,
      receiverId: row.receiver_id,
      content: row.content,
      timestamp: row.created_at,
      read: row.read,
    }));
  } catch (err) {
    console.error('Error fetching conversations:', err);
    return [];
  }
}

export async function markMessagesAsRead(
  currentUserId: string,
  partnerId: string
) {
  if (!isValidUuid(currentUserId) || !isValidUuid(partnerId)) {
    console.warn('markMessagesAsRead called with invalid UUIDs');
    return;
  }
  try {
    await supabase
      .from('messages')
      .update({ read: true })
      .match({
        sender_id: partnerId,
        receiver_id: currentUserId,
        read: false,
      });
  } catch (err) {
    console.error('Error marking messages as read:', err);
  }
}
