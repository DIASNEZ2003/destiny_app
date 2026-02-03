import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, FlatList, 
  KeyboardAvoidingView, Platform, Image, ActivityIndicator,
  SafeAreaView, Keyboard, Alert 
} from 'react-native';
import { Ionicons } from "@expo/vector-icons";
import { ref, onValue, push, remove, update } from "firebase/database";
import { useIsFocused } from '@react-navigation/native';
import { auth, db } from "../firebaseConfig"; 

const Messenger = () => {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [adminInfo, setAdminInfo] = useState({ fullName: "Farm Admin", profileImage: null, status: 'offline' });
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);
  
  const [editingId, setEditingId] = useState(null);
  const flatListRef = useRef();
  const isFocused = useIsFocused();

  // 1. UNIVERSAL KEYBOARD LISTENER (Works on both Android & iOS)
  useEffect(() => {
    const keyboardShowEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const keyboardHideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(keyboardShowEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(keyboardHideEvent, () => setKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // 2. ADMIN SYNC
  useEffect(() => {
    const adminUid = "KLQoW8g03nT22j2vCd9NELRXq0r1"; 
    const adminRef = ref(db, `users/${adminUid}`);
    const unsubscribe = onValue(adminRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        setAdminInfo({
          fullName: data.fullName || "Admin Destiny",
          profileImage: data.profileImage || null,
          status: data.status || 'offline'
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // 3. CHAT SYNC (Auto Delivered/Seen)
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const chatRef = ref(db, `chats/${user.uid}`);
    
    const unsubscribe = onValue(chatRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const msgList = Object.keys(data).map(id => ({ id, ...data[id] }));
        setMessages(msgList.sort((a, b) => a.timestamp - b.timestamp));

        const updates = {};
        Object.keys(data).forEach(id => {
          const msg = data[id];
          if (isFocused && msg.sender === 'admin' && msg.seen !== true) {
            updates[`chats/${user.uid}/${id}/seen`] = true;
            updates[`chats/${user.uid}/${id}/status`] = 'seen';
          }
          if (msg.sender === 'user' && msg.status === 'sent' && adminInfo.status === 'online') {
            updates[`chats/${user.uid}/${id}/status`] = 'delivered';
          }
        });
        if (Object.keys(updates).length > 0) update(ref(db), updates);
      } else { setMessages([]); }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [isFocused, adminInfo.status]);

  const handleSend = async () => {
    if (inputText.trim() === "") return;
    const user = auth.currentUser;
    try {
      if (editingId) {
        await update(ref(db, `chats/${user.uid}/${editingId}`), { text: inputText, isEdited: true, editTimestamp: Date.now() });
        setEditingId(null);
      } else {
        const initialStatus = adminInfo.status === 'online' ? 'delivered' : 'sent';
        await push(ref(db, `chats/${user.uid}`), {
          text: inputText, sender: 'user', timestamp: Date.now(), isEdited: false, status: initialStatus, seen: false
        });
      }
      setInputText("");
    } catch (error) { Alert.alert("Error", "Action failed"); }
  };

  const renderItem = ({ item }) => {
    const isMe = item.sender === 'user';
    return (
      <View className={`mb-3 ${isMe ? 'items-end' : 'items-start'}`}>
        <TouchableOpacity 
          onLongPress={() => isMe && Alert.alert("Options", "Choose", [
            { text: "Edit", onPress: () => { setInputText(item.text); setEditingId(item.id); } },
            { text: "Delete", onPress: () => remove(ref(db, `chats/${auth.currentUser.uid}/${item.id}`)), style: 'destructive' },
            { text: "Cancel" }
          ])}
          className={`px-4 py-2.5 max-w-[80%] rounded-2xl ${isMe ? 'bg-red-900 rounded-br-none' : 'bg-gray-200 rounded-bl-none'}`}
        >
          <Text className={`text-[15px] ${isMe ? 'text-white' : 'text-black'}`}>{item.text}</Text>
        </TouchableOpacity>
        <View className="flex-row items-center mt-1 px-1">
          <Text className="text-[9px] text-gray-400">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
          {isMe && (
            <Text className={`text-[9px] font-black uppercase italic ml-1 ${item.seen ? 'text-blue-500' : 'text-gray-400'}`}>
               • {item.seen ? 'Seen' : item.status === 'delivered' ? 'Delivered' : 'Sent'}
            </Text>
          )}
        </View>
      </View>
    );
  };

  if (loading) return <View className="flex-1 justify-center items-center"><ActivityIndicator color="#7f1d1d" /></View>;

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* FIX: use 'padding' for iOS and 'height' for Android.
         'height' resizes the view when keyboard opens, preventing overlap.
      */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0} // Adjust if you have a custom header
      >
        
        {/* HEADER */}
        <View className="flex-row items-center px-5 py-3 border-b border-gray-100 bg-white">
          <View className="w-10 h-10 rounded-full bg-red-900 items-center justify-center overflow-hidden">
            {adminInfo.profileImage ? <Image source={{ uri: adminInfo.profileImage }} className="w-full h-full" /> : <Text className="text-white font-bold">{adminInfo.fullName[0]}</Text>}
          </View>
          <View className="ml-3">
            <Text className="font-black text-gray-900 text-sm">{adminInfo.fullName}</Text>
            <View className="flex-row items-center">
              <View className={`w-2 h-2 rounded-full mr-1 ${adminInfo.status === 'online' ? 'bg-green-500' : 'bg-gray-300'}`} />
              <Text className="text-gray-400 text-[9px] font-bold uppercase">{adminInfo.status}</Text>
            </View>
          </View>
        </View>

        {/* CHAT LIST */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          // Add extra padding at bottom so last message isn't hidden by input
          contentContainerStyle={{ padding: 20, paddingBottom: 20 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* INPUT BAR */}
        <View className="bg-white border-t border-gray-100 shadow-lg">
          {editingId && (
            <View className="bg-gray-50 px-4 py-2 flex-row justify-between items-center border-b border-gray-100">
              <Text className="text-[10px] text-gray-500 italic font-bold">Editing...</Text>
              <TouchableOpacity onPress={() => { setEditingId(null); setInputText(""); }}><Ionicons name="close-circle" size={18} color="gray" /></TouchableOpacity>
            </View>
          )}
          
          <View 
            style={{ 
              paddingHorizontal: 15, 
              paddingTop: 10, 
              // DYNAMIC PADDING:
              // - Keyboard OPEN: 10px (sits tight on keyboard)
              // - Keyboard CLOSED: 90px (clears the floating Tab Bar)
              paddingBottom: isKeyboardVisible ? 10 : 90, 
              flexDirection: 'row', 
              alignItems: 'center',
              backgroundColor: 'white'
            }}
          >
            <TextInput
              style={{
                flex: 1,
                backgroundColor: '#f3f4f6',
                borderRadius: 25,
                paddingHorizontal: 20,
                paddingVertical: 12,
                fontSize: 14,
                maxHeight: 100,
                color: '#000'
              }}
              placeholder="Write a message..."
              value={inputText}
              onChangeText={setInputText}
              multiline
            />
            <TouchableOpacity 
              onPress={handleSend}
              style={{
                marginLeft: 10,
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: editingId ? '#2563eb' : '#7f1d1d',
                alignItems: 'center',
                justifyContent: 'center',
                elevation: 2
              }}
            >
              <Ionicons name={editingId ? "checkmark" : "send"} size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default Messenger;