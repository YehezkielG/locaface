import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { PopupPayload, PopupType, subscribePopup } from '@/src/lib/inAppPopup';

type PopupState = Required<Pick<PopupPayload, 'message'>> & {
  title?: string;
  type: PopupType;
  durationMs: number;
};

const TYPE_STYLES: Record<PopupType, { bg: string; border: string }> = {
  success: { bg: '#DCFCE7', border: '#16A34A' },
  error: { bg: '#FEE2E2', border: '#DC2626' },
  warning: { bg: '#FEF9C3', border: '#CA8A04' },
  info: { bg: '#DBEAFE', border: '#2563EB' },
};

export default function InAppPopupHost() {
  const [popup, setPopup] = useState<PopupState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = subscribePopup((payload) => {
      if (hideTimeout.current) {
        clearTimeout(hideTimeout.current);
      }

      const nextPopup: PopupState = {
        title: payload.title,
        message: payload.message,
        type: payload.type ?? 'info',
        durationMs: payload.durationMs ?? 2200,
      };

      setPopup(nextPopup);
      opacity.setValue(0);
      translateY.setValue(-16);

      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();

      hideTimeout.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -16, duration: 180, useNativeDriver: true }),
        ]).start(() => setPopup(null));
      }, nextPopup.durationMs);
    });

    return () => {
      unsubscribe();
      if (hideTimeout.current) {
        clearTimeout(hideTimeout.current);
      }
    };
  }, [opacity, translateY]);

  if (!popup) return null;

  const style = TYPE_STYLES[popup.type];

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 40,
        left: 14,
        right: 14,
        zIndex: 9999,
        opacity,
        transform: [{ translateY }],
      }}
    >
      <View
        style={{
          backgroundColor: style.bg,
          borderLeftWidth: 4,
          borderLeftColor: style.border,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      >
        {popup.title ? (
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827' }}>{popup.title}</Text>
        ) : null}
        <Text style={{ fontSize: 13, color: '#111827', marginTop: popup.title ? 2 : 0 }}>{popup.message}</Text>
      </View>
    </Animated.View>
  );
}
