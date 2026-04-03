import React from 'react';
import { ActivityIndicator, Image, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type MemberRow = {
  user_id: string;
  role: string | null;
  joined_at: string | null;
};

type ProfileRow = {
  id: string;
  username: string | null;
  avatar_url?: string | null;
  user_tag?: string | null;
};

type MembersProps = {
  members: (MemberRow & { profile?: ProfileRow | null })[];
  ownerId: string;
  currentUserId: string;
  canManageClass: boolean;
  isRemovingMemberId: string | null;
  onRemoveMember: (userId: string, username?: string | null) => void;
  canLeaveClass: boolean;
  isLeavingClass: boolean;
  onLeaveClass: () => void;
};

export function Members({
  members,
  ownerId,
  currentUserId,
  canManageClass,
  isRemovingMemberId,
  onRemoveMember,
  canLeaveClass,
  isLeavingClass,
  onLeaveClass,
}: MembersProps) {
  return (
    <View className="mx-4 bg-white border border-gray-200 rounded-2xl p-4">
      <View className="flex-row items-center mb-3">
        <Ionicons name="people-outline" size={18} color="#111827" />
        <Text className="text-base font-bold text-gray-900 ml-2">Class Members ({members.length})</Text>
      </View>
      {members.length === 0 ? (
        <Text className="text-sm text-gray-500">No members found.</Text>
      ) : (
        members.map((member) => {
          const isClassOwner = member.user_id === ownerId;
          const normalizedRole = String(member.role || 'member').toLowerCase();
          const canRemoveThisMember = canManageClass && !isClassOwner && normalizedRole === 'member';
          const isRemovingThisMember = isRemovingMemberId === member.user_id;

          return (
            <View key={member.user_id} className="flex-row items-center justify-between py-2 border-b border-gray-100">
              <View className="flex-row items-center flex-1 mr-3">
                {member.profile?.avatar_url ? (
                  <Image source={{ uri: member.profile.avatar_url }} className="w-10 h-10 rounded-full mr-3" />
                ) : (
                  <View className="w-10 h-10 rounded-full mr-3 bg-gray-200 justify-center items-center">
                    <Text className="text-sm font-semibold text-gray-700">
                      {((member.profile?.username || '')[0] || '?').toUpperCase()}
                    </Text>
                  </View>
                )}
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-900" numberOfLines={1}>
                    {member.profile?.username || member.user_id}
                  </Text>
                  <Text className="text-xs text-gray-500">{member.profile?.user_tag ? `@${member.profile.user_tag}` : ''}</Text>
                </View>
              </View>
              <View className="items-end">
                <View className="flex-row items-center">
                  <Ionicons
                    name={isClassOwner ? 'shield-checkmark-outline' : 'person-outline'}
                    size={12}
                    color={isClassOwner ? '#EA580C' : '#4B5563'}
                  />
                  <Text className={`ml-1 text-xs font-semibold uppercase ${isClassOwner ? 'text-orange-600' : 'text-gray-600'}`}>
                    {isClassOwner ? 'owner' : member.role || 'member'}
                  </Text>
                </View>

                {canRemoveThisMember && member.user_id !== currentUserId ? (
                  <TouchableOpacity
                    onPress={() => onRemoveMember(member.user_id, member.profile?.username)}
                    disabled={isRemovingThisMember}
                    className="mt-1 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 flex-row items-center"
                  >
                    {isRemovingThisMember ? (
                      <ActivityIndicator size="small" color="#E11D48" />
                    ) : (
                      <>
                        <Ionicons name="person-remove-outline" size={12} color="#BE123C" />
                        <Text className="ml-1 text-[11px] font-semibold text-rose-700">Remove</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          );
        })
      )}

      {canLeaveClass ? (
        <TouchableOpacity
          onPress={onLeaveClass}
          disabled={isLeavingClass}
          className={`mt-4 rounded-xl py-3 items-center flex-row justify-center ${isLeavingClass ? 'bg-rose-300' : 'bg-rose-600'}`}
        >
          {isLeavingClass ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="exit-outline" size={16} color="#fff" />
              <Text className="ml-2 text-white font-bold">Leave Class</Text>
            </>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
