import React, { useState } from 'react';
import { View, TextInput, Text, TouchableOpacity, ImageBackground, ScrollView, StatusBar, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { auth } from './firebaseConfig'; 
import { signInWithEmailAndPassword } from 'firebase/auth';

export default function Login() {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert("Error", "Please enter both username and password");
      return;
    }

    setLoading(true);
    // MUST match the suffix used in your admin-create-user logic
    const email = `${username.trim().toLowerCase()}@poultry.com`;

    try {
      // 1. SIGN IN ONLY (Prevents new UID creation)
      await signInWithEmailAndPassword(auth, email, password);
      
      // 2. SUCCESS: Navigate to home
      router.replace('/home'); 

    } catch (error: any) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        Alert.alert("Login Failed", "Incorrect credentials. Contact Admin for registration.");
      } else {
        Alert.alert("Error", "Server not responding. Ensure Port 8001 is open on your laptop.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fef2f2' }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <StatusBar barStyle="light-content" />
        <View className="h-[300px] w-full bg-red-900 justify-center items-center relative overflow-hidden">
          <ImageBackground 
            source={{ uri: "https://images.unsplash.com/photo-1563205844-3d9178cb7717?auto=format&fit=crop&w=1350&q=80" }}
            className="absolute inset-0 w-full h-full opacity-40"
            resizeMode="cover"
          />
          <Text className="text-white text-3xl font-bold text-center px-4">
            Destiny Angas{"\n"}Monitoring System
          </Text>
        </View>

        <View className="flex-1 px-8 py-10 bg-white -mt-10 rounded-t-[40px]">
          <Text className="text-gray-700 font-bold mb-2">Username</Text>
          <TextInput 
            className="w-full p-4 rounded-xl bg-gray-100 mb-4"
            placeholder="Username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />

          <Text className="text-gray-700 font-bold mb-2">Password</Text>
          <TextInput 
            className="w-full p-4 rounded-xl bg-gray-100 mb-6"
            placeholder="••••••••"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity 
            className="bg-red-800 p-5 rounded-2xl items-center"
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-bold text-lg">SIGN IN</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}