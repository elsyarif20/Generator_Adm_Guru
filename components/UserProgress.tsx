
import React from 'react';
import { User } from '../types';

interface UserProgressProps {
  users: User[];
}

const timeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    let interval = seconds / 86400; // days
    if (interval > 1) return Math.floor(interval) + " hari lalu";
    
    interval = seconds / 3600; // hours
    if (interval > 1) return Math.floor(interval) + " jam lalu";
    
    interval = seconds / 60; // minutes
    if (interval > 1) return Math.floor(interval) + " menit lalu";
    
    return "Baru saja";
};

const UserProgress: React.FC<UserProgressProps> = ({ users }) => {

  const sortedUsers = [...users].sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());

  return (
    <div className="bg-white rounded-lg card-shadow p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Progres Pengguna</h2>
      <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
        {sortedUsers.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Belum ada data pengguna.</p>
        ) : (
          sortedUsers.map(user => (
            <div key={user.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow fade-in">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-800">{user.name}</h3>
                <span className="text-xs text-gray-500">Terakhir aktif: {timeAgo(user.lastSeen)}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="text-gray-600">Total Generate:</div>
                <div className="font-semibold text-gray-800 text-right">{user.totalGenerations} kali</div>
                
                <div className="text-blue-600">Modul Administrasi:</div>
                <div className="font-semibold text-blue-800 text-right">{user.usageStats.admin} kali</div>
                
                <div className="text-green-600">Modul Bank Soal:</div>
                <div className="font-semibold text-green-800 text-right">{user.usageStats.soal} kali</div>
                
                <div className="text-orange-600">Modul Try Out:</div>
                <div className="font-semibold text-orange-800 text-right">{user.usageStats.tryout} kali</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default UserProgress;
