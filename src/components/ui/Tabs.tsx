import React, { createContext, useContext, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
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
    <View
      style={[styles.tabsList, { backgroundColor: theme.muted }, style]}
    >
      {children}
    </View>
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
    flexDirection: 'row',
    borderRadius: 25,
    padding: 4,
  },
  trigger: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTrigger: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  triggerText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
});
