import HeaderDropDown from "@/components/HeaderDropDown";
import MessageInput from "@/components/MessageInput";
import { defaultStyles } from "@/constants/Styles";
import { keyStorage, storage } from "@/utils/Storage";
import { Redirect, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useMMKVString } from "react-native-mmkv";
import { FlashList } from "@shopify/flash-list";
import ChatMessage from "@/components/ChatMessage";
import { Message, Role } from "@/utils/Interfaces";
import MessageIdeas from "@/components/MessageIdeas";
import { addChat, addMessage, getMessages } from "@/utils/Database";
import { useSQLiteContext } from "expo-sqlite/next";

const ChatPage = () => {
  const [gptVersion, setGptVersion] = useMMKVString("gptVersion", storage);
  const [height, setHeight] = useState(0);
  const [key, setKey] = useMMKVString("apikey", keyStorage);
  const [organization, setOrganization] = useMMKVString("org", keyStorage);
  const [messages, setMessages] = useState<Message[]>([]);
  const db = useSQLiteContext();
  let { id } = useLocalSearchParams<{ id: string }>();

  if (!key || key === "" || !organization || organization === "") {
    return <Redirect href={"/(auth)/(modal)/settings"} />;
  }

  const [chatId, _setChatId] = useState(id);
  const chatIdRef = useRef(chatId);
  // https://stackoverflow.com/questions/55265255/react-usestate-hook-event-handler-using-initial-state
  function setChatId(id: string) {
    chatIdRef.current = id;
    _setChatId(id);
  }

  useEffect(() => {
    if (id) {
      getMessages(db, parseInt(id)).then((res) => {
        setMessages(res);
      });
    }
  }, [id, db]);

  const onGptVersionChange = (version: string) => {
    setGptVersion(version);
  };

  const onLayout = (event: any) => {
    const { height } = event.nativeEvent.layout;
    setHeight(height / 2);
  };

  const getCompletion = async (text: string) => {
    let currentChatId = chatIdRef.current;

    // Add user message to DB
    if (messages.length === 0) {
      // New chat
      try {
        const result = await addChat(db, text); // text is the first message title
        const newChatIdNum = result.lastInsertRowId;
        setChatId(newChatIdNum.toString());
        currentChatId = newChatIdNum.toString();
        await addMessage(db, newChatIdNum, { content: text, role: Role.User });
      } catch (e) {
        console.error("Failed to create new chat or add first message", e);
        Alert.alert("Database Error", "Could not start a new chat.");
        return;
      }
    } else if (currentChatId) {
      // Existing chat
      try {
        await addMessage(db, parseInt(currentChatId), {
          content: text,
          role: Role.User,
        });
      } catch (e) {
        console.error("Failed to add user message to existing chat", e);
        Alert.alert("Database Error", "Could not save your message.");
        return;
      }
    } else {
      console.error(
        "Error: Chat ID is missing for an existing conversation thread."
      );
      Alert.alert(
        "Error",
        "Chat context is missing. Please try starting a new chat or reloading."
      );
      return;
    }

    // Prepare messages for API, based on history BEFORE current user input is added to UI state
    const messagesForApi = [
      ...messages.map(msg => ({
        role: msg.role === Role.User ? 'user' : 'assistant', // Map Role.Bot to 'assistant' for API
        content: msg.content,
      })),
      { role: 'user', content: text }, // Add current user's new message
    ];

    // UI update: Add user message and bot placeholder
    setMessages((prevMessages) => [
      ...prevMessages,
      { role: Role.User, content: text },
      { role: Role.Bot, content: "" }, // Placeholder for bot response
    ]);

    // API call
    try {
      const response = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: messagesForApi }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error:", response.status, errorText);
        Alert.alert(
          "API Error",
          `Failed to get completion: ${errorText || response.statusText}`
        );
        setMessages((prevMessages) => prevMessages.slice(0, -1)); // Remove bot placeholder
        return;
      }

      const data = await response.json();
      const botResponseContent = data.response || "Received an empty response.";

      // Update bot placeholder with actual response
      setMessages((prevMessages) => {
        const updatedMessages = [...prevMessages];
        const botMessageIndex = updatedMessages.length - 1;
        if (
          botMessageIndex >= 0 &&
          updatedMessages[botMessageIndex].role === Role.Bot
        ) {
          updatedMessages[botMessageIndex].content = botResponseContent;
        }
        return updatedMessages;
      });

      // Save bot's response to DB
      if (currentChatId) {
        try {
          await addMessage(db, parseInt(currentChatId), {
            content: botResponseContent,
            role: Role.Bot,
          });
        } catch (e) {
          console.error("Failed to save bot message", e);
          Alert.alert("Database Error", "Could not save the bot's response.");
        }
      }
    } catch (error: any) {
      console.error("Fetch Error:", error);
      Alert.alert("Network Error", `Failed to connect: ${error.message}`);
      setMessages((prevMessages) => prevMessages.slice(0, -1)); // Remove bot placeholder
    }
  };

  return (
    <View style={defaultStyles.pageContainer}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <HeaderDropDown
              title="ChatGPT"
              items={[
                { key: "3.5", title: "GPT-3.5", icon: "bolt" },
                { key: "4", title: "GPT-4", icon: "sparkles" },
              ]}
              onSelect={onGptVersionChange}
              selected={gptVersion}
            />
          ),
        }}
      />
      <View style={styles.page} onLayout={onLayout}>
        {messages.length == 0 && (
          <View style={[styles.logoContainer, { marginTop: height / 2 - 100 }]}>
            <Image
              source={require("@/assets/images/logo-white.png")}
              style={styles.image}
            />
          </View>
        )}
        <FlashList
          data={messages}
          renderItem={({ item }) => <ChatMessage {...item} />}
          estimatedItemSize={400}
          contentContainerStyle={{ paddingTop: 30, paddingBottom: 150 }}
          keyboardDismissMode="on-drag"
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={70}
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: "100%",
        }}
      >
        {messages.length === 0 && <MessageIdeas onSelectCard={getCompletion} />}
        <MessageInput onShouldSend={getCompletion} />
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  logoContainer: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    width: 50,
    height: 50,
    backgroundColor: "#000",
    borderRadius: 50,
  },
  image: {
    width: 30,
    height: 30,
    resizeMode: "cover",
  },
  page: {
    flex: 1,
  },
});
export default ChatPage;
