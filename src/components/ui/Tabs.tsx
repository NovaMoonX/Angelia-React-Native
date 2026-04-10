import React, { createContext, useContext, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface TabsContextType {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = createContext<TabsContextType>({
  activeTab: '',
  setActiveTab: () => {},
});

// Tabs
interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Tabs({ value, defaultValue = '', onValueChange, children, style }: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const activeTab = value ?? internalValue;

  const setActiveTab = (newValue: string) => {
    if (value === undefined) setInternalValue(newValue);
    onValueChange?.(newValue);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <View style={style}>{children}</View>
    </TabsContext.Provider>
  );
}

// TabsList
export function TabsList({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { theme } = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.tabsList, { backgroundColor: theme.muted }, style]}
      contentContainerStyle={styles.tabsListContent}
    >
      {children}
    </ScrollView>
  );
}

// TabsTrigger
interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
}

export function TabsTrigger({ value, children }: TabsTriggerProps) {
  const { activeTab, setActiveTab } = useContext(TabsContext);
  const { theme } = useTheme();
  const isActive = activeTab === value;

  return (
    <Pressable
      onPress={() => setActiveTab(value)}
      style={[
        styles.trigger,
        isActive && [styles.activeTrigger, { backgroundColor: theme.card }],
      ]}
    >
      <Text
        style={[
          styles.triggerText,
          { color: theme.mutedForeground },
          isActive && { color: theme.foreground, fontWeight: '600' },
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

// TabsContent
interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function TabsContent({ value, children, style }: TabsContentProps) {
  const { activeTab } = useContext(TabsContext);
  if (activeTab !== value) return null;
  return <View style={style}>{children}</View>;
}

const styles = StyleSheet.create({
  tabsList: {
    borderRadius: 8,
    padding: 4,
    maxHeight: 44,
  },
  tabsListContent: {
    flexDirection: 'row',
    gap: 4,
  },
  trigger: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  activeTrigger: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  triggerText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
