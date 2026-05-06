import { Tabs } from 'expo-router';
import { Text } from 'react-native';

function Icon({ emoji }: { emoji: string }) {
  return <Text style={{ fontSize: 20 }}>{emoji}</Text>;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#dedede',
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: '#BE1E2D',
        tabBarInactiveTintColor: '#979797',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Browse',
          tabBarIcon: () => <Icon emoji="🔍" />,
        }}
      />
      <Tabs.Screen
        name="sell"
        options={{
          title: 'Sell',
          tabBarIcon: () => <Icon emoji="➕" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: () => <Icon emoji="👤" />,
        }}
      />
    </Tabs>
  );
}
