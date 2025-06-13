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
import EventSource, { EventSourceListener } from "react-native-sse";

const ChatPage = () => {
  const [gptVersion, setGptVersion] = useMMKVString("gptVersion", storage);
  const [height, setHeight] = useState(0);
  const [key, setKey] = useMMKVString("apikey", keyStorage);

  const [messages, setMessages] = useState<Message[]>([]);
  const db = useSQLiteContext();
  let { id } = useLocalSearchParams<{ id: string }>();

  if (!key || key === "") {
    return <Redirect href={"/(auth)/(modal)/settings"} />;
  }

  const [chatId, _setChatId] = useState(id);
  const chatIdRef = useRef(chatId);
  const messagesRef = useRef<Message[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
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
  
    // Add user message to DB and UI
    if (messages.length === 0) {
      const result = await addChat(db, text);
      const newChatId = result.lastInsertRowId;
      setChatId(newChatId.toString());
      currentChatId = newChatId.toString();
      await addMessage(db, newChatId, { content: text, role: Role.User });
    } else {
      await addMessage(db, parseInt(currentChatId!), {
        content: text,
        role: Role.User,
      });
    }
  
    // Update UI with user message
    const newMessages = [...messages, { content: text, role: Role.User }];
    setMessages(newMessages);
  
    // Add empty bot message as placeholder
    setMessages(prev => [...prev, { role: Role.Bot, content: "" }]);
  
    const messagesForApi = newMessages.map(msg => ({
      role: msg.role === Role.User ? "user" : "assistant",
      content: msg.content,
    }));
  
    try {
      // Create a new EventSource for this request
      const es = new EventSource("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: messagesForApi }),
      });
  
      let fullResponse = "";
  
      const onMessage = (event: MessageEvent) => {
        try {
          if (event.data) {
            const data = JSON.parse(event.data);
            
            if (data.done) {
              // Stream is complete, save the full response
              if (currentChatId && fullResponse) {
                addMessage(db, parseInt(currentChatId), {
                  content: fullResponse,
                  role: Role.Bot,
                });
              }
              es.close();
              return;
            }
  
            if (data.token) {
              // Append the token to the response
              fullResponse += data.token;
              
              // Update the UI with the new token
              setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg.role === Role.Bot) {
                  return [
                    ...prev.slice(0, -1),
                    { ...lastMsg, content: fullResponse }
                  ];
                }
                return prev;
              });
            } else if (data.error) {
              console.error("Error from server:", data.error);
              throw new Error(data.error);
            }
          }
        } catch (e) {
          console.error("Error processing message:", e);
          es.close();
        }
      };
  
      const onError = (error: Event) => {
        console.error("SSE Error:", error);
        es.close();
      };
  
      es.addEventListener("message", onMessage);
      es.addEventListener("error", onError);
  
      // Cleanup function
      return () => {
        es.removeEventListener("message", onMessage);
        es.removeEventListener("error", onError);
        if (es.readyState !== 2) { // 2 = CLOSED
          es.close();
        }
      };
  
    } catch (error) {
      console.error("Error in getCompletion:", error);
      // Remove the loading message if there was an error
      setMessages(prev => prev.slice(0, -1));
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
