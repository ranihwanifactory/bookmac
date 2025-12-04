import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';

interface EditProfileModalProps {
  user: UserProfile;
  onClose: () => void;
  onUpdate: (updatedProfile: Partial<UserProfile>) => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ user, onClose, onUpdate }) => {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [bio, setBio] = useState(user.bio || '');
  const [photoURL, setPhotoURL] = useState(user.photoURL || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const userRef = doc(db, 'users', user.uid);
      const updates = {
        displayName: displayName.trim(),
        bio: bio.trim(),
        photoURL: photoURL.trim()
      };
      
      await updateDoc(userRef, updates);
      onUpdate(updates);
      onClose();
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("프로필 수정 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="font-bold text-lg text-gray-900">프로필 수정</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 transition-colors">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">이름 (Display Name)</label>
            <input 
              value={displayName} 
              onChange={e => setDisplayName(e.target.value)} 
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all" 
              placeholder="이름을 입력하세요"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">소개 (Bio)</label>
            <textarea 
              value={bio} 
              onChange={e => setBio(e.target.value)} 
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all resize-none" 
              rows={3} 
              placeholder="자신을 간단히 소개해주세요"
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">프로필 사진 URL</label>
            <input 
              value={photoURL} 
              onChange={e => setPhotoURL(e.target.value)} 
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all" 
              placeholder="https://example.com/photo.jpg"
            />
            <p className="text-[10px] text-gray-400 mt-1">이미지 주소를 입력하세요.</p>
          </div>
          
          <div className="pt-2">
            <button 
              type="submit"
              disabled={loading} 
              className="w-full bg-black text-white py-3 rounded-lg font-bold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : '저장하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProfileModal;