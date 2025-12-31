import React, { useContext } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import ScanScreen from '../screens/ScanScreen';
import ScansScreen from '../screens/ScansScreen';
import ScanDetailScreen from '../screens/ScanDetailScreen';
import TrendsScreen from '../screens/TrendsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { AuthContext } from '../context/AuthContext';

// Scan Icon Component
const ScanIcon = ({ color }: { color: string }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24">
    <Path
      d="m24,11.5c0,.829-.671,1.5-1.5,1.5H1.5c-.829,0-1.5-.671-1.5-1.5s.671-1.5,1.5-1.5h21c.829,0,1.5.671,1.5,1.5ZM1.5,8c.829,0,1.5-.671,1.5-1.5v-1c0-1.378,1.122-2.5,2.5-2.5h1c.829,0,1.5-.671,1.5-1.5s-.671-1.5-1.5-1.5h-1C2.467,0,0,2.467,0,5.5v1c0,.829.671,1.5,1.5,1.5Zm5,13h-1c-1.378,0-2.5-1.122-2.5-2.5v-1c0-.829-.671-1.5-1.5-1.5s-1.5.671-1.5,1.5v1c0,3.033,2.467,5.5,5.5,5.5h1c.829,0,1.5-.671,1.5-1.5s-.671-1.5-1.5-1.5Zm16-5c-.829,0-1.5.671-1.5,1.5v1c0,1.378-1.122,2.5-2.5,2.5h-1c-.829,0-1.5.671-1.5,1.5s.671,1.5,1.5,1.5h1c3.033,0,5.5-2.467,5.5-5.5v-1c0-.829-.671-1.5-1.5-1.5ZM18.5,0h-1c-.829,0-1.5.671-1.5,1.5s.671,1.5,1.5,1.5h1c1.378,0,2.5,1.122,2.5,2.5v1c0,.829.671,1.5,1.5,1.5s1.5-.671,1.5-1.5v-1c0-3.033-2.467-5.5-5.5-5.5Z"
      fill={color}
    />
  </Svg>
);

// Progress Icon Component
const ProgressIcon = ({ color }: { color: string }) => (
  <Svg width="24" height="24" viewBox="0 0 24 24">
    <Path
      d="M12,6A3,3,0,0,0,9,9V21a3,3,0,0,0,6,0V9A3,3,0,0,0,12,6Z"
      fill={color}
    />
    <Path
      d="M21,0a3,3,0,0,0-3,3V21a3,3,0,0,0,6,0V3A3,3,0,0,0,21,0Z"
      fill={color}
    />
    <Path
      d="M3,12a3,3,0,0,0-3,3v6a3,3,0,0,0,6,0V15A3,3,0,0,0,3,12Z"
      fill={color}
    />
  </Svg>
);

// Trends Icon Component
const TrendsIcon = ({ color }: { color: string }) => (
  <Svg width="24" height="24" viewBox="0 0 512 512">
    <Path
      d="M399.211,256H298.667C275.103,256,256,236.897,256,213.333V112.512c0.059-19.89-9.134-38.678-24.875-50.837  c-14.916-11.812-34.474-16.022-52.928-11.392C52.767,81.419-23.674,208.342,7.463,333.773  c21.937,88.372,93.145,155.995,182.532,173.342c122.11,23.373,241.257-52.547,271.659-173.099  c4.647-18.478,0.445-38.066-11.371-53.013C437.984,265.29,419.165,256.076,399.211,256z"
      fill={color}
    />
    <Path
      d="M504.555,158.848c-4.87-18.102-12.123-35.477-21.568-51.669c-28.41-48.738-74.818-84.375-129.237-99.243  C350.165,6.969,342.144,6.4,342.144,6.4c-2.866,0.001-15.21,0-24.981,7.915c-14.361,11.301-16.619,24.149-16.832,25.152  c-0.745,3.146-1.132,6.367-1.152,9.6v100.267c0,35.346,28.654,64,64,64h100.672c13.356,0.038,25.927-6.303,33.835-17.067  c5.848-7.885,8.856-17.517,8.533-27.328C506.049,165.523,505.491,162.137,504.555,158.848z"
      fill={color}
    />
  </Svg>
);

const ScansStack = createNativeStackNavigator();

function ScansStackNavigator() {
  return (
    <ScansStack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#1a1a1a' },
        animation: 'none',
      }}
    >
      <ScansStack.Screen 
        name="ScansList" 
        component={ScansScreen}
        options={{
          contentStyle: { backgroundColor: '#1a1a1a' },
        }}
      />
      <ScansStack.Screen name="ScanDetail" component={ScanDetailScreen} />
    </ScansStack.Navigator>
  );
}

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  const authContext = useContext(AuthContext);

  if (!authContext) {
    return null;
  }

  const { token } = authContext;

  // Extract email from token for profile initial
  const getEmail = () => {
    if (!token) return 'U';
    try {
      const payload = token.split('.')[1];
      if (!payload) return 'U';
      const decoded = JSON.parse(atob(payload));
      return decoded.email || 'U';
    } catch {
      return 'U';
    }
  };

  const email = getEmail();
  const initial = email !== 'U' ? email.charAt(0).toUpperCase() : 'U';

  // Profile Icon Component
  const ProfileIcon = ({ color }: { color: string }) => (
    <View style={[styles.profileIconContainer, { backgroundColor: color }]}>
      <Text style={styles.profileIconText}>{initial}</Text>
    </View>
  );

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#1a1a1a',
          borderTopColor: '#333',
          borderTopWidth: 1,
          paddingBottom: 40,
          paddingTop: 5,
          height: 100,
        },
        tabBarActiveTintColor: '#2196F3',
        tabBarInactiveTintColor: '#666',
        tabBarLabelStyle: {
          marginTop: 4,
          paddingBottom: 2,
        },
        tabBarIconStyle: {
          marginTop: 5,
        },
      }}
    >
      <Tab.Screen
        name="Scan"
        component={ScanScreen}
        options={{
          tabBarIcon: ({ color }) => <ScanIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="Progress"
        component={ScansStackNavigator}
        options={{
          tabBarIcon: ({ color }) => <ProgressIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="Trends"
        component={TrendsScreen}
        options={{
          tabBarIcon: ({ color }) => <TrendsIcon color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color }) => <ProfileIcon color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  profileIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileIconText: {
    color: '#333',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

