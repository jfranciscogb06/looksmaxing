import React, { useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ProfileScreen() {
  const authContext = useContext(AuthContext);
  
  if (!authContext) {
    return null;
  }
  
  const { logout, token } = authContext;

  // Extract email from token (JWT) or use default
  const getEmail = () => {
    if (!token) return 'U';
    try {
      // JWT format: header.payload.signature
      const payload = token.split('.')[1];
      if (!payload) return 'U';
      const decoded = JSON.parse(atob(payload));
      return decoded.email || 'U';
    } catch {
      return 'U';
    }
  };

  const email = getEmail();
  const initial = email.charAt(0).toUpperCase();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <View style={styles.container}>
      <View style={styles.profileSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.email}>{email !== 'U' ? email : 'User'}</Text>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    padding: 20,
  },
  profileSection: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 40,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarText: {
    color: '#fff',
    fontSize: 48,
    fontWeight: 'bold',
  },
  email: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
  },
  section: {
    marginTop: 20,
  },
  logoutButton: {
    backgroundColor: '#2a2a2a',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutText: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: '600',
  },
});


