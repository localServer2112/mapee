"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Hook for persisting data to localStorage with offline support
 */
export function useOfflineCache<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const [value, setValue] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from storage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        setValue(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Error loading from localStorage:", error);
    }
    setIsLoaded(true);
  }, [key]);

  // Save to storage when value changes
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        console.error("Error saving to localStorage:", error);
      }
    }
  }, [key, value, isLoaded]);

  const updateValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      setValue((prev) =>
        typeof newValue === "function"
          ? (newValue as (prev: T) => T)(prev)
          : newValue
      );
    },
    []
  );

  return [value, updateValue, isLoaded];
}

/**
 * Hook for tracking online/offline status
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

/**
 * IndexedDB helper for larger data storage
 */
const DB_NAME = "mapee-db";
const DB_VERSION = 1;
const STORE_NAME = "ping-logs";

export async function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

export async function saveToIndexedDB<T extends { id: string }>(
  data: T
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(data);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function loadFromIndexedDB<T>(): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function deleteFromIndexedDB(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}
