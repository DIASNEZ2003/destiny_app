import React, { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { ref, onValue } from "firebase/database";
import { auth, db } from "../firebaseConfig"; 

export default function TabLayout() {
  const [unreadCount, setUnreadCount] = useState(0);

  // Real-time listener for the notification number
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const chatRef = ref(db, `chats/${user.uid}`);
    const unsubscribe = onValue(chatRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        // Count messages sent by admin that are not 'seen'
        const count = Object.values(data).filter(
          (msg: any) => msg.sender === 'admin' && msg.seen !== true
        ).length;
        setUnreadCount(count);
      } else {
        setUnreadCount(0);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#7f1d1d', // Dark Red matching your Poultry theme
        tabBarInactiveTintColor: '#9ca3af',
        tabBarShowLabel: true,
        
        // --- THIS FIXES THE TABS FOLLOWING THE KEYBOARD ON ANDROID ---
        tabBarHideOnKeyboard: true, 

        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: 'bold',
        },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#f3f4f6',
          
          // --- POSITIONING ---
          position: 'absolute',
          bottom: 0,              // STUCK TO THE BOTTOM
          left: 0,
          right: 0,
          
          // --- PADDING & HEIGHT ---
          height: 60,             // Height must be enough for padding
          paddingBottom: 25,      // Space below the icons
          paddingTop: 10,         // Space above the icons
          
          // --- SHADOW ---
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 5,
          elevation: 5,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <Ionicons name="home" size={26} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="messenger"
        options={{
          title: 'Messenger',
          // Show the notification number bubble
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#ef4444',
            color: 'white',
            fontSize: 10,
            lineHeight: 15,
          },
          tabBarIcon: ({ color }) => (
            <Ionicons name="chatbubble-ellipses" size={26} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}