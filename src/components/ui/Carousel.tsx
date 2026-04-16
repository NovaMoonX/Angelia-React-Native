import React, { useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

interface CarouselProps {
  children: React.ReactNode[];
  onIndexChange?: (index: number) => void;
  style?: ViewStyle;
}

export function Carousel({ children, onIndexChange, style }: CarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (containerWidth === 0) return;
    const offsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / containerWidth);
    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
      onIndexChange?.(newIndex);
    }
  };

  const goTo = (index: number) => {
    if (index >= 0 && index < children.length) {
      flatListRef.current?.scrollToIndex({ index, animated: true });
    }
  };

  return (
    <View>
      <View
        style={[styles.container, style]}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        {containerWidth > 0 && (
          <FlatList
            ref={flatListRef}
            data={children}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScroll}
            renderItem={({ item }) => (
              <View style={{ width: containerWidth }}>{item}</View>
            )}
            keyExtractor={(_, index) => `carousel-${index}`}
            getItemLayout={(_, index) => ({
              length: containerWidth,
              offset: containerWidth * index,
              index,
            })}
          />
        )}
        {children.length > 1 && (
          <>
            {currentIndex > 0 && (
              <Pressable
                style={[styles.navButton, styles.navLeft]}
                onPress={() => goTo(currentIndex - 1)}
              >
                <Feather name="chevron-left" size={20} color="#FFFFFF" />
              </Pressable>
            )}
            {currentIndex < children.length - 1 && (
              <Pressable
                style={[styles.navButton, styles.navRight]}
                onPress={() => goTo(currentIndex + 1)}
              >
                <Feather name="chevron-right" size={20} color="#FFFFFF" />
              </Pressable>
            )}
          </>
        )}
      </View>
      {children.length > 1 && (
        <View style={styles.dots}>
          {children.map((_, i) => (
            <View
              key={`dot-${i}`}
              style={[styles.dot, i === currentIndex && styles.activeDot]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 8,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  navLeft: {
    left: 8,
  },
  navRight: {
    right: 8,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(150,150,150,0.5)',
  },
  activeDot: {
    backgroundColor: '#D97706',
  },
});
