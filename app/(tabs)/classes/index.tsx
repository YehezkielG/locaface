import React, { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, TouchableOpacity, TextInput, Modal, ScrollView } from 'react-native';
import { router } from 'expo-router';
import JoinClassModal from '@/src/components/JoinClassModal';
import { fetchMyClasses, joinClassByCode } from '@/src/lib/classesLib';
import { showPopup } from '@/src/lib/inAppPopup';
// replaced Octicons with Ionicons for consistency

const DAY_FILTERS = [
  { id: 0, label: 'All' },
  { id: 1, label: 'Mon' },
  { id: 2, label: 'Tue' },
  { id: 3, label: 'Wed' },
  { id: 4, label: 'Thu' },
  { id: 5, label: 'Fri' },
  { id: 6, label: 'Sat' },
  { id: 7, label: 'Sun' },
];

export default function ClassesPage() {
  const [joinModalVisible, setJoinModalVisible] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'all' | 'instructor' | 'member'>('all');
  const [selectedValidityFilter, setSelectedValidityFilter] = useState<'all' | 'ongoing' | 'ended'>('all');
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

  const normalizeRole = (role: string | null | undefined) => {
    const normalized = String(role || '').toLowerCase();
    if (normalized === 'instructor' || normalized === 'owner') return 'instructor';
    return 'member';
  };

  const getValidityState = (validUntil: string | null | undefined) => {
    if (!validUntil) return 'ongoing';
    const parsed = new Date(validUntil);
    if (Number.isNaN(parsed.getTime())) return 'ongoing';
    return parsed.getTime() >= Date.now() ? 'ongoing' : 'ended';
  };

  const truncateText = (value: string | null | undefined, maxLength: number) => {
    if (!value) return '-';
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength)}...`;
  };

  const getRoleTextColorClass = (role: string | null | undefined) => {
    if (!role) return 'text-gray-500';
    return role.toLowerCase() === 'instructor' ? 'text-orange-700' : 'text-gray-500';
  };

  const getClassDays = (value: unknown): number[] => {
    if (Array.isArray(value)) {
      return value.map((day) => Number(day)).filter((day) => Number.isFinite(day));
    }

    if (typeof value === 'number') {
      return [value];
    }

    return [];
  };

  const filteredClasses = classes.filter((item) => {
    const className = String(item.class?.name || '').toLowerCase();
    const classDescription = String(item.class?.description || '').toLowerCase();
    const query = searchQuery.trim().toLowerCase();

    const matchesSearch =
      query.length === 0 ||
      className.includes(query) ||
      classDescription.includes(query);

    if (!matchesSearch) return false;

    if (selectedDay !== 0) {
      const classDays = getClassDays(item.class?.day_of_week);
      if (!classDays.includes(selectedDay)) return false;
    }

    if (selectedRoleFilter !== 'all') {
      const roleState = normalizeRole(item.role);
      if (roleState !== selectedRoleFilter) return false;
    }

    if (selectedValidityFilter !== 'all') {
      const validityState = getValidityState(item.class?.valid_until);
      if (validityState !== selectedValidityFilter) return false;
    }

    return true;
  });

  useEffect(() => {
    (async () => {
      try {
        setIsLoadingClasses(true);
        const myClasses = await fetchMyClasses();
        setClasses(myClasses || []);
      } catch (error) {
        console.warn('Failed to fetch classes:', error);
      } finally {
        setIsLoadingClasses(false);
      }
    })();
  }, []);

  const handleJoinClass = async () => {
    const normalizedCode = joinCode.replace(/\s/g, '').toUpperCase();

    if (normalizedCode.length !== 6) {
      showPopup({ title: 'Validation', message: 'Class code must be 6 characters.', type: 'warning' });
      return;
    }

    setIsJoining(true);
    const result = await joinClassByCode(normalizedCode);
    setIsJoining(false);

    if (!result.success) {
      showPopup({ title: 'Join Class', message: result.message, type: 'error' });
      return;
    }

    setJoinModalVisible(false);
    showPopup({ title: 'Success', message: result.message, type: 'success' });

    setIsLoadingClasses(true);
    const myClasses = await fetchMyClasses();
    setClasses(myClasses || []);
    setIsLoadingClasses(false);
  };

  return (
    <View className="flex-1 p-4 mt-4 pb-20">
      <View className="flex-row justify-between mb-8 gap-2 space-x-3 mt-2">
          <TouchableOpacity onPress={() => setJoinModalVisible(true)} className="flex-1 bg-white p-4 rounded-2xl items-center shadow-sm">
            <View className="w-12 h-12 rounded-full justify-center items-center mb-2 bg-indigo-100">
              <Ionicons name="enter-outline" size={24} color="#4F46E5" />
            </View>
            <Text className="text-sm font-semibold text-gray-700">Join Class</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/classes/create')} className="flex-1 bg-white p-4 rounded-2xl items-center shadow-sm">
            <View className="w-12 h-12 rounded-full justify-center items-center mb-2 bg-green-100">
              <Ionicons name="add-circle-outline" size={24} color="#16A34A" />
            </View>
            <Text className="text-sm font-semibold text-gray-700">Create Class</Text>
          </TouchableOpacity>
        </View>
          <View className="mb-3 flex-row items-center">
        <Ionicons name="people-outline" size={24} color="black" className='mr-2'/>
        <Text className="text-lg font-bold text-gray-900 mb-3">My Classes</Text>
        </View>
        <View className="bg-white rounded-lg p-2.5 mb-3 flex-row items-center shadow-sm border border-gray-100">
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search classes..."
            placeholderTextColor="#9CA3AF"
            className="ml-2 flex-1 text-gray-700"
          />
        </View>

        <TouchableOpacity
          onPress={() => setIsFilterModalVisible(true)}
          className="mb-3 bg-white rounded-lg p-3 flex-row items-center justify-between shadow-sm border border-gray-100"
        >
          <View className="flex-row items-center">
            <Ionicons name="filter-outline" size={18} color="#4B5563" />
            <Text className="ml-2 text-sm font-semibold text-gray-700">Filters</Text>
          </View>
          <Text className="text-xs text-gray-500">
            {selectedDay === 0 ? 'All days' : DAY_FILTERS.find((day) => day.id === selectedDay)?.label}
            {' • '}
            {selectedRoleFilter.toUpperCase()}
            {' • '}
            {selectedValidityFilter.toUpperCase()}
          </Text>
        </TouchableOpacity>

        <View className="mb-5">
          <Text className="text-xs text-gray-500">
            Showing {filteredClasses.length} of {classes.length} classes
          </Text>
        </View>

        {isLoadingClasses && (
          <Text className="text-sm text-gray-500">Loading my classes...</Text>
        )}

        {!isLoadingClasses && filteredClasses.length === 0 && (
          <Text className="text-sm text-gray-500">You are not enrolled in any classes yet.</Text>
        )}

        {!isLoadingClasses && filteredClasses.length > 0 && (
          filteredClasses.map((item, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => {
                if (!item.class?.id) return;
                router.push({
                  pathname: '/classes/[id]',
                  params: { id: String(item.class.id) },
                });
              }}
              className="bg-white rounded-lg p-4 mb-2 shadow-sm flex-row items-center"
            >
              <Text className="text-3xl mr-2">{item.class.icon || '📚'}</Text>
              <View className="flex-1">
                <View className="flex-row items-center justify-between">
                  <Text className="font-semibold text-gray-900 mr-2">{truncateText(item.class.name, 28)}</Text>
                  <Text className={`text-xs font-semibold uppercase ${getRoleTextColorClass(item.role)}`}>
                    {item.role || 'member'}
                  </Text>
                </View>
                <Text className="text-sm text-gray-600">{truncateText(item.class.description, 48)}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        <JoinClassModal
          visible={joinModalVisible}
          code={joinCode}
          isSubmitting={isJoining}
          onChangeCode={(value) => setJoinCode(value.replace(/\s/g, '').toUpperCase())}
          onClose={() => setJoinModalVisible(false)}
          onSubmit={handleJoinClass}
        />

        <Modal
          visible={isFilterModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsFilterModalVisible(false)}
        >
          <View className="flex-1 bg-black/40 items-center justify-center px-6">
            <View className="w-full bg-white rounded-2xl border border-gray-200 p-4 max-h-[80%]">
              <Text className="text-base font-bold text-gray-900 mb-3">Filter Classes</Text>

              <Text className="text-xs font-semibold text-gray-600 mb-2">Day</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
                <View className="flex-row gap-2 pr-1">
                  {DAY_FILTERS.map((day) => {
                    const isActive = selectedDay === day.id;
                    return (
                      <TouchableOpacity
                        key={`filter-day-${day.id}`}
                        onPress={() => setSelectedDay(day.id)}
                        className={`px-3 py-2 rounded-full border ${
                          isActive ? 'bg-indigo-50 border-indigo-400' : 'bg-white border-gray-200'
                        }`}
                      >
                        <Text className={`text-xs font-semibold ${isActive ? 'text-indigo-600' : 'text-gray-600'}`}>
                          {day.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>

              <Text className="text-xs font-semibold text-gray-600 mb-2">Role</Text>
              <View className="flex-row gap-2 mb-3">
                {(['all', 'instructor', 'member'] as const).map((role) => {
                  const isActive = selectedRoleFilter === role;
                  return (
                    <TouchableOpacity
                      key={`filter-role-${role}`}
                      onPress={() => setSelectedRoleFilter(role)}
                      className={`px-3 py-2 rounded-full border ${
                        isActive ? 'bg-indigo-50 border-indigo-400' : 'bg-white border-gray-200'
                      }`}
                    >
                      <Text className={`text-xs font-semibold ${isActive ? 'text-indigo-600' : 'text-gray-600'}`}>
                        {role === 'all' ? 'All Roles' : role.charAt(0).toUpperCase() + role.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text className="text-xs font-semibold text-gray-600 mb-2">Class Status (valid_until)</Text>
              <View className="flex-row gap-2 mb-4 flex-wrap">
                {(['all', 'ongoing', 'ended'] as const).map((state) => {
                  const isActive = selectedValidityFilter === state;
                  return (
                    <TouchableOpacity
                      key={`filter-validity-${state}`}
                      onPress={() => setSelectedValidityFilter(state)}
                      className={`px-3 py-2 rounded-full border ${
                        isActive ? 'bg-indigo-50 border-indigo-400' : 'bg-white border-gray-200'
                      }`}
                    >
                      <Text className={`text-xs font-semibold ${isActive ? 'text-indigo-600' : 'text-gray-600'}`}>
                        {state === 'all' ? 'All Status' : state.charAt(0).toUpperCase() + state.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => {
                    setSelectedDay(0);
                    setSelectedRoleFilter('all');
                    setSelectedValidityFilter('all');
                  }}
                  className="flex-1 bg-gray-100 rounded-xl py-3 items-center"
                >
                  <Text className="text-sm font-semibold text-gray-700">Reset</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setIsFilterModalVisible(false)}
                  className="flex-1 bg-indigo-600 rounded-xl py-3 items-center"
                >
                  <Text className="text-sm font-semibold text-white">Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
    </View>
  );
}
