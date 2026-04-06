import React, { useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';

interface CarouselProps {
  children: React.ReactNode[];
  onIndexChange?: (index: number) => void;
  style?: ViewStyle;
}

export function Carousel({ children, onIndexChange, style }: CarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const screenWidth = Dimensions.get('window').width - 32; // Account for padding

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / screenWidth);
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
    <View style={[styles.container, style]}>
      <FlatList
        ref={flatListRef}
        data={children}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        renderItem={({ item }) => (
          <View style={{ width: screenWidth }}>{item}</View>
        )}
        keyExtractor={(_, index) => `carousel-${index}`}
      />
      {children.length > 1 && (
        <>
          {currentIndex > 0 && (
            <Pressable
              style={[styles.navButton, styles.navLeft]}
              onPress={() => goTo(currentIndex - 1)}
            >
              <Text style={styles.navText}>‹</Text>
            </Pressable>
          )}
          {currentIndex < children.length - 1 && (
            <Pressable
              style={[styles.navButton, styles.navRight]}
              onPress={() => goTo(currentIndex + 1)}
            >
              <Text style={styles.navText}>›</Text>
            </Pressable>
          )}
          <View style={styles.dots}>
            {children.map((_, i) => (
              <View
                key={`dot-${i}`}
                style={[styles.dot, i === currentIndex && styles.activeDot]}
              />
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
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
  navText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
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
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  activeDot: {
    backgroundColor: '#D97706',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
