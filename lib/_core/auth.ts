import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { SESSION_TOKEN_KEY, USER_INFO_KEY } from "@/constants/oauth";
import { logger } from "@/lib/logger";

export type User = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  lastSignedIn: Date;
};

export async function getSessionToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return null;
    }
    const token = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
    logger.log("[Auth] Session token:", token ? "present" : "missing");
    return token;
  } catch (error) {
    logger.captureError(error, { context: "getSessionToken" });
    return null;
  }
}

export async function setSessionToken(token: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      return;
    }
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
    logger.log("[Auth] Session token stored");
  } catch (error) {
    logger.captureError(error, { context: "setSessionToken" });
    throw error;
  }
}

export async function removeSessionToken(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      return;
    }
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
    logger.log("[Auth] Session token removed");
  } catch (error) {
    logger.captureError(error, { context: "removeSessionToken" });
  }
}

export async function getUserInfo(): Promise<User | null> {
  try {
    let info: string | null = null;
    if (Platform.OS === "web") {
      info = window.localStorage.getItem(USER_INFO_KEY);
    } else {
      info = await SecureStore.getItemAsync(USER_INFO_KEY);
    }
    if (!info) return null;
    return JSON.parse(info);
  } catch (error) {
    logger.captureError(error, { context: "getUserInfo" });
    return null;
  }
}

export async function setUserInfo(user: User): Promise<void> {
  try {
    if (Platform.OS === "web") {
      window.localStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
      return;
    }
    await SecureStore.setItemAsync(USER_INFO_KEY, JSON.stringify(user));
  } catch (error) {
    logger.captureError(error, { context: "setUserInfo" });
  }
}

export async function clearUserInfo(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      window.localStorage.removeItem(USER_INFO_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(USER_INFO_KEY);
  } catch (error) {
    logger.captureError(error, { context: "clearUserInfo" });
  }
}
