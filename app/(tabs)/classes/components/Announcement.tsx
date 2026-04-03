import React from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

type AnnouncementItem = {
  id: string;
  content: string;
  created_at: string;
  author?: {
    username: string | null;
    user_tag?: string | null;
  } | null;
};

type AnnouncementProps = {
  announcements: AnnouncementItem[];
  isLoading: boolean;
  canCreate: boolean;
  content: string;
  setContent: React.Dispatch<React.SetStateAction<string>>;
  isSubmitting: boolean;
  onCreate: () => void;
};

export function Announcement({
  announcements,
  isLoading,
  canCreate,
  content,
  setContent,
  isSubmitting,
  onCreate,
}: AnnouncementProps) {
  return (
    <View className="mx-4 bg-white border border-gray-200 rounded-2xl p-4">
      <Text className="text-base font-bold text-gray-900 mb-3">Announcement History</Text>

      {canCreate && (
        <View className="mb-4 pb-4 border-b border-gray-100">
          <Text className="text-sm font-semibold text-gray-700 mb-2">Post New Announcement</Text>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="Write announcement for this class..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            className="bg-white px-4 py-3 rounded-xl border border-gray-300 text-base text-gray-900"
          />
          <TouchableOpacity
            onPress={onCreate}
            disabled={isSubmitting}
            className="mt-3 bg-indigo-600 py-3 rounded-xl items-center"
          >
            <Text className="text-white font-semibold">{isSubmitting ? 'Posting...' : 'Post Announcement'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading ? (
        <View className="py-6 items-center">
          <ActivityIndicator size="small" />
          <Text className="text-sm text-gray-500 mt-2">Loading announcements...</Text>
        </View>
      ) : announcements.length === 0 ? (
        <Text className="text-sm text-gray-500">No announcements yet.</Text>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {announcements.map((item, index) => {
            const createdLabel = new Date(item.created_at).toLocaleString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <View
                key={item.id}
                className={`py-3 ${index !== announcements.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <Text className="text-sm text-gray-800 leading-5">{item.content}</Text>
                <Text className="text-xs text-gray-500 mt-2">
                  {item.author?.username || 'Unknown author'}
                  {item.author?.user_tag ? ` (@${item.author.user_tag})` : ''}
                  {` • ${createdLabel}`}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
