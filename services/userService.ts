
import { Module, User } from '../types';

const USERS_STORAGE_KEY = 'appUsers';

// Function to get all users from localStorage
export const getUsers = (): User[] => {
  try {
    const storedUsers = localStorage.getItem(USERS_STORAGE_KEY);
    return storedUsers ? JSON.parse(storedUsers) : [];
  } catch (error) {
    console.error("Failed to load users from localStorage", error);
    return [];
  }
};

// Function to update user activity or create a new user
export const updateUserActivity = (userName: string, module: Module): User[] => {
  if (!userName.trim()) {
    return getUsers(); // Do not track empty names
  }

  const users = getUsers();
  const normalizedName = userName.trim().toLowerCase();
  const now = new Date().toISOString();

  const userIndex = users.findIndex(user => user.id === normalizedName);

  if (userIndex > -1) {
    // Update existing user
    users[userIndex].lastSeen = now;
    users[userIndex].usageStats[module] = (users[userIndex].usageStats[module] || 0) + 1;
    users[userIndex].totalGenerations += 1;
    // Update name in case capitalization changes
    users[userIndex].name = userName.trim();
  } else {
    // Create new user
    const newUser: User = {
      id: normalizedName,
      name: userName.trim(),
      firstSeen: now,
      lastSeen: now,
      usageStats: {
        admin: module === 'admin' ? 1 : 0,
        soal: module === 'soal' ? 1 : 0,
        tryout: module === 'tryout' ? 1 : 0,
      },
      totalGenerations: 1,
    };
    users.push(newUser);
  }

  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (error) {
    console.error("Failed to save users to localStorage", error);
  }
  
  return users;
};
