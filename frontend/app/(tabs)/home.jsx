import React, { useState, useEffect } from 'react';
import { View, Text, Image, ActivityIndicator, ScrollView, TouchableOpacity, Alert, Modal, Dimensions } from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import { ref, update, onDisconnect, onValue } from "firebase/database";
import { auth, db } from "../firebaseConfig"; 
import * as ImagePicker from 'expo-image-picker';
import { supabase } from "../../supabaseClient";
import { useRouter } from "expo-router";

const Home = () => {
  const [firstName, setFirstName] = useState("");
  const [profileImage, setProfileImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [weather, setWeather] = useState({ temp: "--", icon: "☁️" });

  const router = useRouter();
  const [batchData, setBatchData] = useState({ batchName: "No Active Batch", currentDay: 0, totalDays: 30, progressPercentage: 0 });

  const getWeatherIcon = (code) => {
    if (code === 0) return "☀️";
    if (code >= 1 && code <= 3) return "🌤️";
    if (code >= 51 && code <= 67) return "🌧️";
    return "☁️";
  };

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // --- REAL-TIME WEATHER ---
    const unsubscribeWeather = onValue(ref(db, 'current_weather'), (snap) => {
      if (snap.exists()) {
        const d = snap.val();
        setWeather({ temp: d.temperature || "--", icon: getWeatherIcon(d.weatherCode) });
      }
    });

    // --- USER STATUS & PROFILE ---
    const userRef = ref(db, `users/${user.uid}`);
    update(userRef, { status: "online" });
    onDisconnect(userRef).update({ status: "offline" });

    const unsubscribeProfile = onValue(userRef, (snap) => {
      if (snap.exists()) {
        const d = snap.val();
        setFirstName(d.firstName || "Farmer");
        setProfileImage(d.profilePicture || null);
      }
    });

    // --- BATCH DATA ---
    const unsubscribeBatches = onValue(ref(db, 'global_batches'), (snap) => {
      if (snap.exists()) {
        const batches = snap.val();
        const activeId = Object.keys(batches).find(id => batches[id].status === 'active');
        if (activeId) {
          const active = batches[activeId];
          const start = new Date(active.dateCreated).getTime();
          const totalDays = Math.ceil((new Date(active.expectedCompleteDate).getTime() - start) / (1000 * 60 * 60 * 24)) || 30;
          const diff = new Date().getTime() - start;
          setBatchData({
            batchName: active.batchName,
            currentDay: Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24))),
            totalDays,
            progressPercentage: Math.min(Math.round((diff / (new Date(active.expectedCompleteDate).getTime() - start)) * 100), 100)
          });
        }
      }
      setLoading(false);
    });

    return () => { unsubscribeWeather(); unsubscribeProfile(); unsubscribeBatches(); };
  }, []);

  const uploadProfileImage = async () => {
    try {
      setShowProfileModal(false);
      setUploading(true);
      const res = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
      if (res.canceled) { setUploading(false); return; }
      const response = await fetch(res.assets[0].uri);
      const arrayBuffer = await response.arrayBuffer();
      const fileName = `${auth.currentUser.uid}_${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("avatars").upload(fileName, arrayBuffer, { contentType: 'image/jpeg' });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(fileName);
      await update(ref(db, `users/${auth.currentUser.uid}`), { profilePicture: data.publicUrl });
    } catch (err) { Alert.alert("Error", err.message); } finally { setUploading(false); }
  };

  const handleLogout = async () => {
    await update(ref(db, `users/${auth.currentUser.uid}`), { status: "offline" });
    await auth.signOut();
    router.replace("/");
  };

  if (loading) return (
    <View className="flex-1 justify-center items-center bg-white">
      <ActivityIndicator size="large" color="#7f1d1d" />
    </View>
  );

  return (
    <ScrollView className="flex-1 bg-gray-50">
      
      {/* PROFILE DROPDOWN MODAL */}
      <Modal visible={showProfileModal} transparent animationType="none">
        <TouchableOpacity 
          className="flex-1" 
          activeOpacity={1} 
          onPress={() => setShowProfileModal(false)}
        >
          <View 
            className="absolute bg-white rounded-2xl shadow-xl w-44 p-1"
            style={{ top: 100, right: 20, elevation: 20 }}
          >
            <TouchableOpacity onPress={uploadProfileImage} className="flex-row items-center p-3 border-b border-gray-100">
              <Ionicons name="camera-outline" size={20} color="#374151" />
              <Text className="ml-3 font-semibold text-gray-700">Change Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => {setShowProfileModal(false); setShowLogoutModal(true);}} 
              className="flex-row items-center p-3"
            >
              <Ionicons name="log-out-outline" size={20} color="red" />
              <Text className="ml-3 font-semibold text-red-600">Logout</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* LOGOUT ALERT MODAL */}
      <Modal visible={showLogoutModal} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center items-center">
          <View className="bg-white p-7 rounded-3xl w-72 items-center">
            <Text className="text-lg font-black text-gray-900">Logout Account?</Text>
            <Text className="text-gray-500 text-center mt-2">You will be marked as offline.</Text>
            <View className="flex-row gap-3 mt-6">
              <TouchableOpacity 
                onPress={() => setShowLogoutModal(false)} 
                className="flex-1 p-3 bg-gray-100 rounded-xl items-center"
              >
                <Text className="font-bold text-gray-700">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handleLogout} 
                className="flex-1 p-3 bg-red-900 rounded-xl items-center"
              >
                <Text className="font-bold text-white">Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* HEADER SECTION (REDUCED MARGINS) */}
      <View className="px-5 pt-10 pb-4 flex-row justify-between items-center">
        <View>
          <Text className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Welcome back,</Text>
          <Text className="text-2xl font-black text-red-900">{firstName}!</Text>
        </View>

        <View className="flex-row items-center">
          {/* WEATHER BADGE */}
          <View className="bg-white px-3 py-1.5 rounded-full flex-row items-center shadow-sm border border-gray-100 mr-3">
            <Text className="text-lg">{weather.icon}</Text>
            <Text className="ml-1.5 font-black text-gray-700 text-sm">{weather.temp}°</Text>
          </View>

          {/* AVATAR */}
          <TouchableOpacity 
            onPress={() => setShowProfileModal(true)} 
            className="w-12 h-12 rounded-full bg-red-900 justify-center items-center overflow-hidden border-2 border-white shadow-md"
          >
            {profileImage ? (
              <Image source={{ uri: profileImage }} className="w-full h-full" />
            ) : (
              <Text className="text-white font-bold text-lg">{firstName?.[0]}</Text>
            )}
            {uploading && (
              <View className="absolute inset-0 bg-black/30 justify-center items-center">
                <ActivityIndicator size="small" color="white" />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* BATCH PROGRESS CARD */}
      <View className="px-5 mt-2">
        <View className="bg-red-900 p-6 rounded-[30px] shadow-lg shadow-red-900/40">
          <View className="flex-row items-center mb-4">
            <Ionicons name="layers" size={20} color="white" />
            <Text className="text-white font-black text-lg ml-2 uppercase tracking-tight">
              {batchData.batchName}
            </Text>
          </View>
          
          <View className="h-2.5 bg-white/20 rounded-full overflow-hidden">
            <View 
              className="h-full bg-white" 
              style={{ width: `${batchData.progressPercentage}%` }} 
            />
          </View>
          
          <View className="flex-row justify-between mt-4">
            <View>
              <Text className="text-white/60 text-[10px] font-bold uppercase tracking-tighter">Current Status</Text>
              <Text className="text-white font-bold text-sm">Day {batchData.currentDay} of {batchData.totalDays}</Text>
            </View>
            <View className="items-end">
              <Text className="text-white/60 text-[10px] font-bold uppercase tracking-tighter">Overall Progress</Text>
              <Text className="text-white font-bold text-sm">{batchData.progressPercentage}%</Text>
            </View>
          </View>
        </View>
      </View>

    </ScrollView>
  );
};

export default Home;